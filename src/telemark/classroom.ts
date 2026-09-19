import {httpsCallable} from 'firebase/functions';
import {functions} from './firebase';

export type AccountRole = 'student' | 'coach';

export interface TelemarkAccount {
  role: AccountRole;
  username: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export type StudentAccount = TelemarkAccount & {role: 'student'};
export type CoachAccount = TelemarkAccount & {role: 'coach'};

export interface ClassroomProgress {
  completedLessons: string[];
  skippedLessons: string[];
  autoCompletedLessons: string[];
  reviewingUnits: string[];
  lastLesson: string | null;
  updatedAt: string | null;
}

/** The only progress fields shared with accepted student classmates. */
export type PeerClassroomProgress = Pick<
  ClassroomProgress,
  'completedLessons' | 'skippedLessons' | 'autoCompletedLessons'
>;

export interface CoachRosterMember {
  /** Firebase id used only for coach actions such as removing this student. */
  studentId: string;
  username: string;
  joinedAt: string | null;
  progress: ClassroomProgress;
}

export interface CoachPendingInvite {
  /** Firebase id used only for cancelling this invitation. */
  studentId: string;
  username: string;
  createdAt: string | null;
}

export interface CoachClassroomView {
  classroomId: string;
  name: string;
  createdAt: string | null;
  students: CoachRosterMember[];
  pendingInvites: CoachPendingInvite[];
}

export interface StudentClassmate {
  username: string;
  isCurrentUser: boolean;
  progress: PeerClassroomProgress;
}

export interface StudentClassroomView {
  classroomId: string;
  name: string;
  coachUsername: string;
  joinedAt: string | null;
  students: StudentClassmate[];
}

export interface StudentPendingInvite {
  classroomId: string;
  classroomName: string;
  coachUsername: string;
  createdAt: string | null;
}

export interface AccountSetupDashboard {
  role: null;
  account: null;
  classrooms: [];
  pendingInvites: [];
}

export interface CoachClassroomDashboard {
  role: 'coach';
  account: CoachAccount;
  classrooms: CoachClassroomView[];
  pendingInvites: [];
}

export interface StudentClassroomDashboard {
  role: 'student';
  account: StudentAccount;
  classrooms: StudentClassroomView[];
  pendingInvites: StudentPendingInvite[];
}

export type TelemarkClassroomDashboard =
  | AccountSetupDashboard
  | CoachClassroomDashboard
  | StudentClassroomDashboard;

export interface CreateClassroomResult {
  classroomId: string;
  name: string;
}

export interface InviteStudentResult {
  classroomId: string;
  studentId: string;
  username: string;
  status: 'pending';
}

const getAccountCall = httpsCallable<Record<string, never>, TelemarkAccount | null>(
  functions,
  'getTelemarkAccount',
);
const saveAccountCall = httpsCallable<
  {role: AccountRole; username: string},
  TelemarkAccount
>(functions, 'saveTelemarkAccount');
const createClassroomCall = httpsCallable<{name: string}, CreateClassroomResult>(
  functions,
  'createTelemarkClassroom',
);
const getDashboardCall = httpsCallable<Record<string, never>, TelemarkClassroomDashboard>(
  functions,
  'getTelemarkClassroomDashboard',
);
const inviteStudentCall = httpsCallable<
  {classroomId: string; username: string},
  InviteStudentResult
>(functions, 'inviteStudentToClassroom');
const respondToInviteCall = httpsCallable<
  {classroomId: string; response: 'accept' | 'decline'},
  {classroomId: string; status: 'accepted' | 'declined'}
>(functions, 'respondToClassroomInvite');
const cancelInviteCall = httpsCallable<
  {classroomId: string; studentId: string},
  {classroomId: string; status: 'cancelled'}
>(functions, 'cancelClassroomInvite');
const removeStudentCall = httpsCallable<
  {classroomId: string; studentId: string},
  {classroomId: string; removed: true}
>(functions, 'removeStudentFromClassroom');
const leaveClassroomCall = httpsCallable<
  {classroomId: string},
  {classroomId: string; left: true}
>(functions, 'leaveTelemarkClassroom');

export async function getTelemarkAccount(): Promise<TelemarkAccount | null> {
  return (await getAccountCall({})).data;
}

/** Role is selected once; subsequent calls may safely rename the account. */
export async function saveTelemarkAccount(
  role: AccountRole,
  username: string,
): Promise<TelemarkAccount> {
  return (await saveAccountCall({role, username})).data;
}

export async function createTelemarkClassroom(name: string): Promise<CreateClassroomResult> {
  return (await createClassroomCall({name})).data;
}

export async function getTelemarkClassroomDashboard(): Promise<TelemarkClassroomDashboard> {
  return (await getDashboardCall({})).data;
}

export async function inviteStudentToClassroom(
  classroomId: string,
  username: string,
): Promise<InviteStudentResult> {
  return (await inviteStudentCall({classroomId, username})).data;
}

export async function respondToClassroomInvite(
  classroomId: string,
  response: 'accept' | 'decline',
): Promise<{classroomId: string; status: 'accepted' | 'declined'}> {
  return (await respondToInviteCall({classroomId, response})).data;
}

export async function cancelClassroomInvite(
  classroomId: string,
  studentId: string,
): Promise<{classroomId: string; status: 'cancelled'}> {
  return (await cancelInviteCall({classroomId, studentId})).data;
}

export async function removeStudentFromClassroom(
  classroomId: string,
  studentId: string,
): Promise<{classroomId: string; removed: true}> {
  return (await removeStudentCall({classroomId, studentId})).data;
}

export async function leaveTelemarkClassroom(
  classroomId: string,
): Promise<{classroomId: string; left: true}> {
  return (await leaveClassroomCall({classroomId})).data;
}
