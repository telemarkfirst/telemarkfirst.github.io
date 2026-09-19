import {httpsCallable} from 'firebase/functions';
import {functions} from './firebase';

export type MetricsRange = '7d' | '28d' | '90d';

export interface AdminMetrics {
  generatedAt: string;
  range: MetricsRange;
  warnings: string[];
  traffic: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    engagedSessions: number;
    engagementRate: number;
    averageSessionDuration: number;
    curriculumUsers: number;
  };
  actions: {
    logins: number;
    signUps: number;
    curriculumStarts: number;
    lessonCompletions: number;
    unitCompletions: number;
    simulatorLaunches: number;
    simulatorFullscreen: number;
  };
  accounts: {
    totalAccounts: number;
    newAccounts: number;
  };
  learning: {
    accountsWithProgress: number;
    startedLearners: number;
    fullyCompletedLearners: number;
    averageCompletionRate: number;
    totalLessonCompletions: number;
    units: Array<{
      slug: string;
      label: string;
      lessonCount: number;
      completedLessonSlots: number;
      learnersCompleted: number;
      averageCompletionRate: number;
    }>;
  };
  trend: Array<{
    date: string;
    visitors: number;
    sessions: number;
    signUps: number;
    lessonCompletions: number;
  }>;
  topPages: Array<{
    path: string;
    title: string;
    pageViews: number;
    activeUsers: number;
  }>;
}

const getMetrics = httpsCallable<{range: MetricsRange}, AdminMetrics>(
  functions,
  'getAdminMetrics',
);

export async function fetchAdminMetrics(range: MetricsRange): Promise<AdminMetrics> {
  const response = await getMetrics({range});
  return response.data;
}
