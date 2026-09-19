import {deleteField, doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import type {User} from 'firebase/auth';
import {db} from './firebase';
import type {MainTrackId} from './tracks';

export type SoftwareLevel =
  | 'complete_beginner'
  | 'block_experience'
  | 'text_experience';

export interface LearnerProfile {
  version: 1;
  selectedTracks: MainTrackId[];
  softwareLevel?: SoftwareLevel;
  blocksPlacement?: 'required' | 'auto_completed';
  postBlocksChoice?: 'python' | 'java' | 'fll';
  onboardingComplete: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeLearnerProfile(value: unknown): LearnerProfile | null {
  if (!isRecord(value) || value.version !== 1 || value.onboardingComplete !== true) {
    return null;
  }
  const selectedTracks = Array.isArray(value.selectedTracks)
    ? [...new Set(value.selectedTracks.filter(
      (track): track is MainTrackId => track === 'software' || track === 'mechanical',
    ))]
    : [];
  if (selectedTracks.length === 0) return null;

  const softwareSelected = selectedTracks.includes('software');
  const softwareLevel = value.softwareLevel === 'complete_beginner'
    || value.softwareLevel === 'block_experience'
    || value.softwareLevel === 'text_experience'
    ? value.softwareLevel
    : undefined;
  if (softwareSelected && !softwareLevel) return null;

  const blocksPlacement = softwareSelected
    ? softwareLevel === 'complete_beginner' ? 'required' : 'auto_completed'
    : undefined;
  const postBlocksChoice = value.postBlocksChoice === 'python'
    || value.postBlocksChoice === 'java'
    || value.postBlocksChoice === 'fll'
    ? value.postBlocksChoice
    : undefined;

  return {
    version: 1,
    selectedTracks,
    ...(softwareSelected ? {softwareLevel, blocksPlacement} : {}),
    ...(postBlocksChoice ? {postBlocksChoice} : {}),
    onboardingComplete: true,
  };
}

export function profileDestination(profile: LearnerProfile): string {
  if (profile.selectedTracks.includes('software')) {
    if (profile.softwareLevel === 'complete_beginner') return '/blocks';
    if (profile.softwareLevel === 'block_experience' && profile.postBlocksChoice === 'python') {
      return '/blocks/python-resources';
    }
    return '/docs';
  }
  return '/mechanical';
}

function profileRef(user: User) {
  return doc(db, 'users', user.uid, 'telemark', 'profile');
}

function requireVerified(user: User): void {
  if (!user.emailVerified) {
    throw new Error('A verified Google email is required for account personalization.');
  }
}

export async function readLearnerProfile(user: User): Promise<LearnerProfile | null> {
  requireVerified(user);
  const snapshot = await getDoc(profileRef(user));
  return snapshot.exists() ? normalizeLearnerProfile(snapshot.data()) : null;
}

export async function writeLearnerProfile(
  user: User,
  value: LearnerProfile,
): Promise<LearnerProfile> {
  requireVerified(user);
  const normalized = normalizeLearnerProfile(value);
  if (!normalized) throw new Error('Choose at least one track and a valid software level.');
  await setDoc(profileRef(user), {
    ...normalized,
    softwareLevel: normalized.softwareLevel ?? deleteField(),
    blocksPlacement: normalized.blocksPlacement ?? deleteField(),
    postBlocksChoice: normalized.postBlocksChoice ?? deleteField(),
    updatedAt: serverTimestamp(),
  }, {merge: true});
  return normalized;
}
