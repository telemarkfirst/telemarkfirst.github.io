import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import type {User} from 'firebase/auth';
import {db} from './firebase';
import {
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  readLocalProgress,
  writeLocalProgress,
  type ProgressData,
} from './progressStore';

const activeSyncs = new Map<string, Promise<ProgressData>>();

function progressRef(user: User) {
  return doc(db, 'users', user.uid, 'telemark', 'progress');
}

function sameProgress(left: ProgressData, right: ProgressData): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Merge this browser's work into a signed-in learner's cloud record. */
export function syncLocalProgressWithUser(user: User): Promise<ProgressData> {
  const existing = activeSyncs.get(user.uid);
  if (existing) return existing;

  const sync = (async () => {
    const local = readLocalProgress();
    const ref = progressRef(user);
    const snapshot = await getDoc(ref);
    const cloud = snapshot.exists() ? normalizeProgress(snapshot.data()) : emptyProgress();
    const merged = mergeProgress(cloud, local);
    if (!snapshot.exists() || !sameProgress(cloud, merged)) {
      await setDoc(ref, {...merged, updatedAt: serverTimestamp()}, {merge: true});
    }
    writeLocalProgress(merged);
    return merged;
  })().finally(() => {
    activeSyncs.delete(user.uid);
  });

  activeSyncs.set(user.uid, sync);
  return sync;
}

export async function saveCloudProgress(
  user: User,
  progress: ProgressData,
): Promise<ProgressData> {
  // If sign-in synchronization is still running, merge the new change after
  // it finishes. The requested state is then written exactly: unioning here
  // would resurrect lessons that the learner deliberately unmarked.
  await syncLocalProgressWithUser(user);
  const normalized = normalizeProgress(progress);
  await setDoc(progressRef(user), {...normalized, updatedAt: serverTimestamp()}, {merge: true});
  writeLocalProgress(normalized);
  return normalized;
}
