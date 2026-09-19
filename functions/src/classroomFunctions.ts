import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';
import {getFirestore} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {
  normalizeClassroomName,
  normalizeClassroomProgress,
  normalizeUsername,
  parseAccountRole,
  type AccountRole,
  type ClassroomProgress,
} from './classroom';
import {callableCors} from './runtimeConfig';

const CALLABLE_OPTIONS = {
  cors: callableCors(),
  region: 'us-central1',
  maxInstances: 5,
  memory: '256MiB' as const,
  timeoutSeconds: 60,
};

const MAX_CLASSROOMS_PER_COACH = 12;
const MAX_CLASSROOMS_PER_STUDENT = 5;
const MAX_STUDENTS_PER_CLASSROOM = 50;
const MAX_PENDING_INVITES_PER_CLASSROOM = 100;

type AuthContext = {
  uid: string;
  token: Record<string, unknown>;
} | undefined;

interface TelemarkAccount {
  role: AccountRole;
  username: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CoachRosterMember {
  studentId: string;
  username: string;
  joinedAt: string | null;
  progress: ClassroomProgress;
}

interface CoachPendingInvite {
  studentId: string;
  username: string;
  createdAt: string | null;
}

interface CoachClassroomView {
  classroomId: string;
  name: string;
  createdAt: string | null;
  students: CoachRosterMember[];
  pendingInvites: CoachPendingInvite[];
}

interface StudentClassmate {
  username: string;
  isCurrentUser: boolean;
  progress: Pick<
    ClassroomProgress,
    'completedLessons' | 'skippedLessons' | 'autoCompletedLessons'
  >;
}

interface StudentClassroomView {
  classroomId: string;
  name: string;
  coachUsername: string;
  joinedAt: string | null;
  students: StudentClassmate[];
}

interface StudentPendingInvite {
  classroomId: string;
  classroomName: string;
  coachUsername: string;
  createdAt: string | null;
}

function accountRef(uid: string) {
  return getFirestore().collection('accounts').doc(uid);
}

function usernameRef(username: string) {
  return getFirestore().collection('usernames').doc(username);
}

function classroomRef(classroomId: string) {
  return getFirestore().collection('classrooms').doc(classroomId);
}

function memberRef(classroomId: string, uid: string) {
  return classroomRef(classroomId).collection('members').doc(uid);
}

function inviteRef(classroomId: string, studentId: string) {
  return classroomRef(classroomId).collection('invites').doc(studentId);
}

function userInviteRef(studentId: string, classroomId: string) {
  return getFirestore()
    .collection('userInvites').doc(studentId)
    .collection('invites').doc(classroomId);
}

function userClassroomRef(uid: string, classroomId: string) {
  return getFirestore()
    .collection('userClassrooms').doc(uid)
    .collection('classrooms').doc(classroomId);
}

function progressRef(uid: string) {
  return getFirestore().collection('users').doc(uid).collection('telemark').doc('progress');
}

function assertVerified(auth: AuthContext): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in to use classrooms.');
  if (auth.token.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Verify your email before using classrooms.');
  }
  return auth.uid;
}

function isoTimestamp(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as {toDate?: () => Date};
  if (typeof candidate.toDate !== 'function') return null;
  const date = candidate.toDate();
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function accountFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): TelemarkAccount | null {
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data || (data.role !== 'student' && data.role !== 'coach')) return null;
  let username: string;
  try {
    username = normalizeUsername(data.username);
  } catch {
    return null;
  }
  return {
    role: data.role,
    username,
    createdAt: isoTimestamp(data.createdAt),
    updatedAt: isoTimestamp(data.updatedAt),
  };
}

async function requireAccount(uid: string, role?: AccountRole): Promise<TelemarkAccount> {
  const account = accountFromSnapshot(await accountRef(uid).get());
  if (!account) {
    throw new HttpsError('failed-precondition', 'Finish account setup before using classrooms.');
  }
  if (role && account.role !== role) {
    throw new HttpsError('permission-denied', `Only ${role}s can do that.`);
  }
  return account;
}

function parseStringId(value: unknown, label: string): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 128
    || value.includes('/')
  ) {
    throw new HttpsError('invalid-argument', `Choose a valid ${label}.`);
  }
  return value;
}

function invalidArgument<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'The submitted value is invalid.',
    );
  }
}

function progressFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): ClassroomProgress {
  const data = snapshot.exists ? snapshot.data() : undefined;
  // The document update time is assigned by Firestore. The data field itself
  // is learner-writable and therefore cannot be trusted as activity evidence.
  const updatedAt = isoTimestamp(snapshot.updateTime);
  return normalizeClassroomProgress(data, updatedAt);
}

function peerProgress(progress: ClassroomProgress): StudentClassmate['progress'] {
  return {
    completedLessons: progress.completedLessons,
    skippedLessons: progress.skippedLessons,
    autoCompletedLessons: progress.autoCompletedLessons,
  };
}

function counter(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

async function snapshots(
  refs: Array<DocumentReference<DocumentData>>,
): Promise<Array<DocumentSnapshot<DocumentData>>> {
  return Promise.all(refs.map((ref) => ref.get()));
}

export const getTelemarkAccount = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = assertVerified(request.auth);
  return accountFromSnapshot(await accountRef(uid).get());
});

export const saveTelemarkAccount = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = assertVerified(request.auth);
  const role = invalidArgument(() => parseAccountRole(request.data?.role));
  const username = invalidArgument(() => normalizeUsername(request.data?.username));
  const db = getFirestore();
  const userAccountRef = accountRef(uid);
  const claimedUsernameRef = usernameRef(username);

  await db.runTransaction(async (transaction) => {
    const currentAccountSnapshot = await transaction.get(userAccountRef);
    const current = currentAccountSnapshot.data();
    if (currentAccountSnapshot.exists && current?.role !== role) {
      throw new HttpsError(
        'failed-precondition',
        'Account roles cannot be changed after setup.',
      );
    }

    const oldUsername = typeof current?.username === 'string'
      ? current.username.toLowerCase()
      : null;
    const newClaimSnapshot = await transaction.get(claimedUsernameRef);
    const oldClaimSnapshot = oldUsername && oldUsername !== username
      ? await transaction.get(usernameRef(oldUsername))
      : newClaimSnapshot;

    if (newClaimSnapshot.exists && newClaimSnapshot.data()?.uid !== uid) {
      throw new HttpsError('already-exists', 'That username is already taken.');
    }

    if (
      oldUsername
      && oldUsername !== username
      && oldClaimSnapshot.exists
      && oldClaimSnapshot.data()?.uid === uid
    ) {
      transaction.delete(oldClaimSnapshot.ref);
    }

    const now = FieldValue.serverTimestamp();
    transaction.set(claimedUsernameRef, {
      uid,
      username,
      createdAt: newClaimSnapshot.exists
        ? newClaimSnapshot.data()?.createdAt ?? now
        : now,
      updatedAt: now,
    });
    transaction.set(userAccountRef, {
      version: 1,
      role,
      username,
      createdAt: currentAccountSnapshot.exists
        ? current?.createdAt ?? now
        : now,
      updatedAt: now,
    }, {merge: true});
  });

  const saved = accountFromSnapshot(await userAccountRef.get());
  if (!saved) throw new HttpsError('internal', 'The account could not be saved.');
  return saved;
});

export const createTelemarkClassroom = onCall(CALLABLE_OPTIONS, async (request) => {
  const coachId = assertVerified(request.auth);
  const name = invalidArgument(() => normalizeClassroomName(request.data?.name));
  const db = getFirestore();
  const classroom = db.collection('classrooms').doc();

  await db.runTransaction(async (transaction) => {
    const coachAccountRef = accountRef(coachId);
    const coachSnapshot = await transaction.get(coachAccountRef);
    const coach = accountFromSnapshot(coachSnapshot);
    if (!coach || coach.role !== 'coach') {
      throw new HttpsError('permission-denied', 'Only coaches can create classrooms.');
    }
    const classroomCount = counter(coachSnapshot.data()?.classroomCount);
    if (classroomCount >= MAX_CLASSROOMS_PER_COACH) {
      throw new HttpsError('resource-exhausted', 'This coach account has reached its classroom limit.');
    }

    const now = FieldValue.serverTimestamp();
    transaction.create(classroom, {
      version: 1,
      name,
      ownerUid: coachId,
      studentCount: 0,
      pendingInviteCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(classroom.collection('members').doc(coachId), {
      role: 'coach',
      joinedAt: now,
    });
    transaction.create(userClassroomRef(coachId, classroom.id), {
      classroomId: classroom.id,
      role: 'coach',
      joinedAt: now,
    });
    transaction.update(coachAccountRef, {
      classroomCount: classroomCount + 1,
      updatedAt: now,
    });
  });
  return {classroomId: classroom.id, name};
});

export const inviteStudentToClassroom = onCall(CALLABLE_OPTIONS, async (request) => {
  const coachId = assertVerified(request.auth);
  await requireAccount(coachId, 'coach');
  const classroomId = parseStringId(request.data?.classroomId, 'classroom');
  const username = invalidArgument(() => normalizeUsername(request.data?.username));
  const db = getFirestore();
  let invitedStudentId = '';

  await db.runTransaction(async (transaction) => {
    const roomRef = classroomRef(classroomId);
    const claimRef = usernameRef(username);
    const roomSnapshot = await transaction.get(roomRef);
    const claimSnapshot = await transaction.get(claimRef);
    if (!roomSnapshot.exists || roomSnapshot.data()?.ownerUid !== coachId) {
      throw new HttpsError('permission-denied', 'You do not own that classroom.');
    }
    if (!claimSnapshot.exists || typeof claimSnapshot.data()?.uid !== 'string') {
      throw new HttpsError('not-found', 'No student has that username.');
    }

    const studentId = claimSnapshot.data()!.uid as string;
    invitedStudentId = studentId;
    if (studentId === coachId) {
      throw new HttpsError('invalid-argument', 'You cannot invite yourself.');
    }
    const targetAccountRef = accountRef(studentId);
    const targetMemberRef = memberRef(classroomId, studentId);
    const targetInviteRef = inviteRef(classroomId, studentId);
    const targetAccountSnapshot = await transaction.get(targetAccountRef);
    const memberSnapshot = await transaction.get(targetMemberRef);
    const invitationSnapshot = await transaction.get(targetInviteRef);
    const targetAccount = accountFromSnapshot(targetAccountSnapshot);

    if (!targetAccount || targetAccount.role !== 'student' || targetAccount.username !== username) {
      throw new HttpsError('not-found', 'No student has that username.');
    }
    if (memberSnapshot.exists) {
      throw new HttpsError('already-exists', 'That student is already in the classroom.');
    }
    if (invitationSnapshot.data()?.status === 'pending') {
      throw new HttpsError('already-exists', 'That student already has a pending invitation.');
    }
    const pendingInviteCount = counter(roomSnapshot.data()?.pendingInviteCount);
    if (pendingInviteCount >= MAX_PENDING_INVITES_PER_CLASSROOM) {
      throw new HttpsError('resource-exhausted', 'This classroom has reached its pending invitation limit.');
    }

    const now = FieldValue.serverTimestamp();
    const invitation = {
      version: 1,
      classroomId,
      coachUid: coachId,
      studentUid: studentId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    transaction.set(targetInviteRef, invitation);
    transaction.set(userInviteRef(studentId, classroomId), invitation);
    transaction.update(roomRef, {
      pendingInviteCount: pendingInviteCount + 1,
      updatedAt: now,
    });
  });

  return {
    classroomId,
    studentId: invitedStudentId,
    username,
    status: 'pending' as const,
  };
});

export const respondToClassroomInvite = onCall(CALLABLE_OPTIONS, async (request) => {
  const studentId = assertVerified(request.auth);
  await requireAccount(studentId, 'student');
  const classroomId = parseStringId(request.data?.classroomId, 'classroom');
  const response = request.data?.response;
  if (response !== 'accept' && response !== 'decline') {
    throw new HttpsError('invalid-argument', 'Choose accept or decline.');
  }
  const db = getFirestore();

  await db.runTransaction(async (transaction) => {
    const roomRef = classroomRef(classroomId);
    const sourceInviteRef = inviteRef(classroomId, studentId);
    const mirrorInviteRef = userInviteRef(studentId, classroomId);
    const studentAccountRef = accountRef(studentId);
    const roomSnapshot = await transaction.get(roomRef);
    const invitationSnapshot = await transaction.get(sourceInviteRef);
    const studentAccountSnapshot = await transaction.get(studentAccountRef);
    if (!roomSnapshot.exists) throw new HttpsError('not-found', 'That classroom no longer exists.');
    const invitation = invitationSnapshot.data();
    if (
      !invitationSnapshot.exists
      || invitation?.studentUid !== studentId
      || invitation?.classroomId !== classroomId
      || invitation?.status !== 'pending'
    ) {
      throw new HttpsError('failed-precondition', 'That invitation is no longer pending.');
    }

    const now = FieldValue.serverTimestamp();
    if (response === 'accept') {
      const studentAccount = accountFromSnapshot(studentAccountSnapshot);
      if (!studentAccount || studentAccount.role !== 'student') {
        throw new HttpsError('failed-precondition', 'This student account is no longer available.');
      }
      const studentCount = counter(roomSnapshot.data()?.studentCount);
      if (studentCount >= MAX_STUDENTS_PER_CLASSROOM) {
        throw new HttpsError('resource-exhausted', 'That classroom is full.');
      }
      const classroomCount = counter(studentAccountSnapshot.data()?.classroomCount);
      if (classroomCount >= MAX_CLASSROOMS_PER_STUDENT) {
        throw new HttpsError('resource-exhausted', 'This student account has reached its classroom limit.');
      }
      transaction.set(memberRef(classroomId, studentId), {
        role: 'student',
        joinedAt: now,
      });
      transaction.set(userClassroomRef(studentId, classroomId), {
        classroomId,
        coachUid: roomSnapshot.data()?.ownerUid,
        role: 'student',
        joinedAt: now,
      });
      transaction.update(studentAccountRef, {
        classroomCount: classroomCount + 1,
        updatedAt: now,
      });
      transaction.update(roomRef, {
        studentCount: studentCount + 1,
        pendingInviteCount: Math.max(0, counter(roomSnapshot.data()?.pendingInviteCount) - 1),
        updatedAt: now,
      });
    } else {
      transaction.update(roomRef, {
        pendingInviteCount: Math.max(0, counter(roomSnapshot.data()?.pendingInviteCount) - 1),
        updatedAt: now,
      });
    }
    transaction.update(sourceInviteRef, {
      status: response === 'accept' ? 'accepted' : 'declined',
      respondedAt: now,
      updatedAt: now,
    });
    transaction.delete(mirrorInviteRef);
  });

  return {
    classroomId,
    status: response === 'accept' ? 'accepted' as const : 'declined' as const,
  };
});

export const cancelClassroomInvite = onCall(CALLABLE_OPTIONS, async (request) => {
  const coachId = assertVerified(request.auth);
  await requireAccount(coachId, 'coach');
  const classroomId = parseStringId(request.data?.classroomId, 'classroom');
  const studentId = parseStringId(request.data?.studentId, 'student');
  const db = getFirestore();

  await db.runTransaction(async (transaction) => {
    const roomRef = classroomRef(classroomId);
    const sourceInviteRef = inviteRef(classroomId, studentId);
    const roomSnapshot = await transaction.get(roomRef);
    const invitationSnapshot = await transaction.get(sourceInviteRef);
    if (!roomSnapshot.exists || roomSnapshot.data()?.ownerUid !== coachId) {
      throw new HttpsError('permission-denied', 'You do not own that classroom.');
    }
    if (invitationSnapshot.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'That invitation is no longer pending.');
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(sourceInviteRef, {
      status: 'cancelled',
      respondedAt: now,
      updatedAt: now,
    });
    transaction.delete(userInviteRef(studentId, classroomId));
    transaction.update(roomRef, {
      pendingInviteCount: Math.max(0, counter(roomSnapshot.data()?.pendingInviteCount) - 1),
      updatedAt: now,
    });
  });

  return {classroomId, status: 'cancelled' as const};
});

export const removeStudentFromClassroom = onCall(CALLABLE_OPTIONS, async (request) => {
  const coachId = assertVerified(request.auth);
  await requireAccount(coachId, 'coach');
  const classroomId = parseStringId(request.data?.classroomId, 'classroom');
  const studentId = parseStringId(request.data?.studentId, 'student');
  if (studentId === coachId) {
    throw new HttpsError('invalid-argument', 'A coach cannot remove the classroom owner.');
  }
  const db = getFirestore();

  await db.runTransaction(async (transaction) => {
    const roomRef = classroomRef(classroomId);
    const studentMemberRef = memberRef(classroomId, studentId);
    const studentAccountRef = accountRef(studentId);
    const roomSnapshot = await transaction.get(roomRef);
    const memberSnapshot = await transaction.get(studentMemberRef);
    const studentAccountSnapshot = await transaction.get(studentAccountRef);
    if (!roomSnapshot.exists || roomSnapshot.data()?.ownerUid !== coachId) {
      throw new HttpsError('permission-denied', 'You do not own that classroom.');
    }
    if (!memberSnapshot.exists || memberSnapshot.data()?.role !== 'student') {
      throw new HttpsError('not-found', 'That student is not in the classroom.');
    }
    transaction.delete(studentMemberRef);
    transaction.delete(userClassroomRef(studentId, classroomId));
    transaction.update(roomRef, {
      studentCount: Math.max(0, counter(roomSnapshot.data()?.studentCount) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (studentAccountSnapshot.exists) {
      transaction.update(studentAccountRef, {
        classroomCount: Math.max(0, counter(studentAccountSnapshot.data()?.classroomCount) - 1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return {classroomId, removed: true};
});

export const leaveTelemarkClassroom = onCall(CALLABLE_OPTIONS, async (request) => {
  const studentId = assertVerified(request.auth);
  await requireAccount(studentId, 'student');
  const classroomId = parseStringId(request.data?.classroomId, 'classroom');
  const db = getFirestore();

  await db.runTransaction(async (transaction) => {
    const roomRef = classroomRef(classroomId);
    const studentMemberRef = memberRef(classroomId, studentId);
    const studentAccountRef = accountRef(studentId);
    const roomSnapshot = await transaction.get(roomRef);
    const memberSnapshot = await transaction.get(studentMemberRef);
    const studentAccountSnapshot = await transaction.get(studentAccountRef);
    if (!roomSnapshot.exists || !memberSnapshot.exists || memberSnapshot.data()?.role !== 'student') {
      throw new HttpsError('not-found', 'You are not in that classroom.');
    }
    transaction.delete(studentMemberRef);
    transaction.delete(userClassroomRef(studentId, classroomId));
    transaction.update(roomRef, {
      studentCount: Math.max(0, counter(roomSnapshot.data()?.studentCount) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(studentAccountRef, {
      classroomCount: Math.max(0, counter(studentAccountSnapshot.data()?.classroomCount) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {classroomId, left: true};
});

async function coachClassroomView(
  coachId: string,
  membership: DocumentSnapshot<DocumentData>,
): Promise<CoachClassroomView | null> {
  const classroomId = membership.id;
  const roomSnapshot = await classroomRef(classroomId).get();
  const room = roomSnapshot.data();
  if (!roomSnapshot.exists || room?.ownerUid !== coachId || typeof room.name !== 'string') return null;

  const [memberQuery, inviteQuery] = await Promise.all([
    classroomRef(classroomId).collection('members')
      .where('role', '==', 'student').limit(MAX_STUDENTS_PER_CLASSROOM).get(),
    classroomRef(classroomId).collection('invites')
      .where('status', '==', 'pending').limit(MAX_PENDING_INVITES_PER_CLASSROOM).get(),
  ]);
  const studentMembers = memberQuery.docs;
  const pending = inviteQuery.docs;
  const [memberAccounts, memberProgress, inviteAccounts] = await Promise.all([
    snapshots(studentMembers.map((item) => accountRef(item.id))),
    snapshots(studentMembers.map((item) => progressRef(item.id))),
    snapshots(pending.map((item) => accountRef(item.id))),
  ]);

  const students = studentMembers.flatMap((member, index): CoachRosterMember[] => {
    const account = accountFromSnapshot(memberAccounts[index]);
    if (!account || account.role !== 'student') return [];
    return [{
      studentId: member.id,
      username: account.username,
      joinedAt: isoTimestamp(member.data().joinedAt),
      progress: progressFromSnapshot(memberProgress[index]),
    }];
  }).sort((left, right) => left.username.localeCompare(right.username));

  const pendingInvites = pending.flatMap((invitation, index): CoachPendingInvite[] => {
    const account = accountFromSnapshot(inviteAccounts[index]);
    if (!account || account.role !== 'student') return [];
    return [{
      studentId: invitation.id,
      username: account.username,
      createdAt: isoTimestamp(invitation.data().createdAt),
    }];
  }).sort((left, right) => left.username.localeCompare(right.username));

  return {
    classroomId,
    name: room.name,
    createdAt: isoTimestamp(room.createdAt),
    students,
    pendingInvites,
  };
}

async function studentClassroomView(
  studentId: string,
  membership: DocumentSnapshot<DocumentData>,
): Promise<StudentClassroomView | null> {
  const classroomId = membership.id;
  const roomRef = classroomRef(classroomId);
  const [roomSnapshot, currentMemberSnapshot, memberQuery] = await Promise.all([
    roomRef.get(),
    roomRef.collection('members').doc(studentId).get(),
    roomRef.collection('members')
      .where('role', '==', 'student').limit(MAX_STUDENTS_PER_CLASSROOM).get(),
  ]);
  const room = roomSnapshot.data();
  if (
    !roomSnapshot.exists
    || !currentMemberSnapshot.exists
    || currentMemberSnapshot.data()?.role !== 'student'
    || typeof room?.ownerUid !== 'string'
    || typeof room.name !== 'string'
  ) return null;

  const studentMembers = memberQuery.docs;
  const [coachAccountSnapshot, memberAccounts, memberProgress] = await Promise.all([
    accountRef(room.ownerUid).get(),
    snapshots(studentMembers.map((item) => accountRef(item.id))),
    snapshots(studentMembers.map((item) => progressRef(item.id))),
  ]);
  const coachAccount = accountFromSnapshot(coachAccountSnapshot);
  if (!coachAccount || coachAccount.role !== 'coach') return null;

  const students = studentMembers.flatMap((member, index): StudentClassmate[] => {
    const account = accountFromSnapshot(memberAccounts[index]);
    if (!account || account.role !== 'student') return [];
    return [{
      username: account.username,
      isCurrentUser: member.id === studentId,
      progress: peerProgress(progressFromSnapshot(memberProgress[index])),
    }];
  }).sort((left, right) => left.username.localeCompare(right.username));

  return {
    classroomId,
    name: room.name,
    coachUsername: coachAccount.username,
    joinedAt: isoTimestamp(currentMemberSnapshot.data()?.joinedAt),
    students,
  };
}

async function studentPendingInvites(studentId: string): Promise<StudentPendingInvite[]> {
  const mirrors = await getFirestore()
    .collection('userInvites').doc(studentId)
    .collection('invites').limit(MAX_PENDING_INVITES_PER_CLASSROOM).get();

  const candidates = mirrors.docs.filter((mirror) => mirror.data().status === 'pending');
  const [sources, rooms] = await Promise.all([
    snapshots(candidates.map((item) => inviteRef(item.id, studentId))),
    snapshots(candidates.map((item) => classroomRef(item.id))),
  ]);
  const coachIds = rooms.map((room) => (
    typeof room.data()?.ownerUid === 'string' ? room.data()!.ownerUid as string : ''
  ));
  const coachAccounts = await Promise.all(coachIds.map((coachId) => (
    coachId ? accountRef(coachId).get() : Promise.resolve(null)
  )));

  return candidates.flatMap((mirror, index): StudentPendingInvite[] => {
    const source = sources[index].data();
    const room = rooms[index].data();
    const coachSnapshot = coachAccounts[index];
    const coach = coachSnapshot ? accountFromSnapshot(coachSnapshot) : null;
    if (
      source?.status !== 'pending'
      || source.studentUid !== studentId
      || source.classroomId !== mirror.id
      || typeof room?.name !== 'string'
      || !coach
      || coach.role !== 'coach'
    ) return [];
    return [{
      classroomId: mirror.id,
      classroomName: room.name,
      coachUsername: coach.username,
      createdAt: isoTimestamp(source.createdAt),
    }];
  }).sort((left, right) => left.classroomName.localeCompare(right.classroomName));
}

export const getTelemarkClassroomDashboard = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = assertVerified(request.auth);
  const account = accountFromSnapshot(await accountRef(uid).get());
  if (!account) {
    return {role: null, account: null, classrooms: [], pendingInvites: []};
  }

  const memberships = await getFirestore()
    .collection('userClassrooms').doc(uid)
    .collection('classrooms')
    .where('role', '==', account.role)
    .limit(account.role === 'coach' ? MAX_CLASSROOMS_PER_COACH : MAX_CLASSROOMS_PER_STUDENT)
    .get();

  if (account.role === 'coach') {
    const views = await Promise.all(
      memberships.docs.map((membership) => coachClassroomView(uid, membership)),
    );
    return {
      role: 'coach' as const,
      account: {...account, role: 'coach' as const},
      classrooms: views.filter((view): view is CoachClassroomView => view !== null),
      pendingInvites: [],
    };
  }

  const [views, pendingInvites] = await Promise.all([
    Promise.all(
      memberships.docs.map((membership) => studentClassroomView(uid, membership)),
    ),
    studentPendingInvites(uid),
  ]);
  return {
    role: 'student' as const,
    account: {...account, role: 'student' as const},
    classrooms: views.filter((view): view is StudentClassroomView => view !== null),
    pendingInvites,
  };
});
