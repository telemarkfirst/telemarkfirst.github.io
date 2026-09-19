import {BetaAnalyticsDataClient} from '@google-analytics/data';
import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {defineString} from 'firebase-functions/params';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {setGlobalOptions} from 'firebase-functions/v2/options';
import {
  aggregateProgress,
  buildDateKeys,
  isAuthorizedAdmin,
  parseRange,
  rangeDays,
  toDateKey,
  type MetricsRange,
} from './metrics';
import {adminEmail, callableCors} from './runtimeConfig';

export {
  cancelClassroomInvite,
  createTelemarkClassroom,
  getTelemarkAccount,
  getTelemarkClassroomDashboard,
  inviteStudentToClassroom,
  leaveTelemarkClassroom,
  removeStudentFromClassroom,
  respondToClassroomInvite,
  saveTelemarkAccount,
} from './classroomFunctions';

if (getApps().length === 0) initializeApp();

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 5,
  memory: '256MiB',
  timeoutSeconds: 60,
});

const ga4PropertyId = defineString('GA4_PROPERTY_ID');
const analyticsClient = new BetaAnalyticsDataClient();

type NumericMap = Record<string, number>;

interface DailyMetric {
  date: string;
  visitors: number;
  sessions: number;
  signUps: number;
  lessonCompletions: number;
}

function numberValue(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertAdmin(auth: {token: Record<string, unknown>} | undefined): void {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Sign in with Google to view analytics.');
  }
  if (!isAuthorizedAdmin(auth.token.email, auth.token.email_verified, adminEmail.value())) {
    throw new HttpsError('permission-denied', 'This account is not authorized.');
  }
}

async function getAccountMetrics(range: MetricsRange, dateKeys: string[]) {
  const auth = getAuth();
  const startKey = dateKeys[0];
  const signUpsByDate: NumericMap = {};
  let totalAccounts = 0;
  let newAccounts = 0;
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    totalAccounts += page.users.length;

    page.users.forEach((user) => {
      const creationTime = user.metadata.creationTime;
      if (!creationTime) return;
      const key = toDateKey(new Date(creationTime));
      if (key >= startKey && dateKeys.includes(key)) {
        newAccounts += 1;
        signUpsByDate[key] = (signUpsByDate[key] ?? 0) + 1;
      }
    });

    pageToken = page.pageToken;
  } while (pageToken);

  return {totalAccounts, newAccounts, signUpsByDate, range};
}

async function getLearningMetrics() {
  const snapshot = await getFirestore().collectionGroup('telemark').get();
  const records = snapshot.docs
    .filter((document) => document.id === 'progress')
    .map((document) => document.data());
  return aggregateProgress(records);
}

async function runGaReport(propertyId: string, range: MetricsRange) {
  const property = `properties/${propertyId}`;
  const startDate = `${rangeDays(range) - 1}daysAgo`;
  const dateRanges = [{startDate, endDate: 'today'}];

  const [summaryResult, trendResult, completionTrendResult, actionsResult, pagesResult, curriculumResult] =
    await Promise.all([
      analyticsClient.runReport({
        property,
        dateRanges,
        metrics: [
          {name: 'totalUsers'},
          {name: 'activeUsers'},
          {name: 'newUsers'},
          {name: 'sessions'},
          {name: 'screenPageViews'},
          {name: 'engagedSessions'},
          {name: 'engagementRate'},
          {name: 'averageSessionDuration'},
        ],
      }),
      analyticsClient.runReport({
        property,
        dateRanges,
        dimensions: [{name: 'date'}],
        metrics: [{name: 'activeUsers'}, {name: 'sessions'}],
        orderBys: [{dimension: {dimensionName: 'date'}}],
      }),
      analyticsClient.runReport({
        property,
        dateRanges,
        dimensions: [{name: 'date'}],
        metrics: [{name: 'eventCount'}],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: {matchType: 'EXACT', value: 'lesson_complete'},
          },
        },
        orderBys: [{dimension: {dimensionName: 'date'}}],
      }),
      analyticsClient.runReport({
        property,
        dateRanges,
        dimensions: [{name: 'eventName'}],
        metrics: [{name: 'eventCount'}],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: [
                'login',
                'sign_up',
                'curriculum_start',
                'lesson_complete',
                'unit_complete',
                'simulator_launch',
                'simulator_fullscreen',
              ],
            },
          },
        },
      }),
      analyticsClient.runReport({
        property,
        dateRanges,
        dimensions: [{name: 'pagePath'}, {name: 'pageTitle'}],
        metrics: [{name: 'screenPageViews'}, {name: 'activeUsers'}],
        orderBys: [{metric: {metricName: 'screenPageViews'}, desc: true}],
        limit: 10,
      }),
      analyticsClient.runReport({
        property,
        dateRanges,
        metrics: [{name: 'totalUsers'}],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: {matchType: 'EXACT', value: 'curriculum_start'},
          },
        },
      }),
    ]);

  const summaryValues = summaryResult[0].rows?.[0]?.metricValues ?? [];
  const summary = {
    totalUsers: numberValue(summaryValues[0]?.value),
    activeUsers: numberValue(summaryValues[1]?.value),
    newUsers: numberValue(summaryValues[2]?.value),
    sessions: numberValue(summaryValues[3]?.value),
    pageViews: numberValue(summaryValues[4]?.value),
    engagedSessions: numberValue(summaryValues[5]?.value),
    engagementRate: numberValue(summaryValues[6]?.value),
    averageSessionDuration: numberValue(summaryValues[7]?.value),
    curriculumUsers: numberValue(curriculumResult[0].rows?.[0]?.metricValues?.[0]?.value),
  };

  const dailyTraffic: Record<string, Pick<DailyMetric, 'visitors' | 'sessions'>> = {};
  trendResult[0].rows?.forEach((row) => {
    const date = row.dimensionValues?.[0]?.value ?? '';
    dailyTraffic[date] = {
      visitors: numberValue(row.metricValues?.[0]?.value),
      sessions: numberValue(row.metricValues?.[1]?.value),
    };
  });

  const lessonCompletionsByDate: NumericMap = {};
  completionTrendResult[0].rows?.forEach((row) => {
    const date = row.dimensionValues?.[0]?.value ?? '';
    lessonCompletionsByDate[date] = numberValue(row.metricValues?.[0]?.value);
  });

  const actions: NumericMap = {};
  actionsResult[0].rows?.forEach((row) => {
    const name = row.dimensionValues?.[0]?.value ?? '';
    actions[name] = numberValue(row.metricValues?.[0]?.value);
  });

  const topPages = (pagesResult[0].rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '',
    title: row.dimensionValues?.[1]?.value ?? '',
    pageViews: numberValue(row.metricValues?.[0]?.value),
    activeUsers: numberValue(row.metricValues?.[1]?.value),
  }));

  return {summary, dailyTraffic, lessonCompletionsByDate, actions, topPages};
}

export const getAdminMetrics = onCall(
  {
    cors: callableCors(),
  },
  async (request) => {
    assertAdmin(request.auth);

    let range: MetricsRange;
    try {
      range = parseRange(request.data?.range);
    } catch (error) {
      throw new HttpsError('invalid-argument', (error as Error).message);
    }

    const warnings: string[] = [];
    const dateKeys = buildDateKeys(range);

    let accounts = {
      totalAccounts: 0,
      newAccounts: 0,
      signUpsByDate: {} as NumericMap,
      range,
    };
    try {
      accounts = await getAccountMetrics(range, dateKeys);
    } catch (error) {
      console.error('Account aggregation failed', error);
      warnings.push('Firebase account totals are temporarily unavailable.');
    }

    let learning = aggregateProgress([]);
    try {
      learning = await getLearningMetrics();
    } catch (error) {
      console.error('Progress aggregation failed', error);
      warnings.push('Curriculum progress totals are temporarily unavailable.');
    }

    let gaData: Awaited<ReturnType<typeof runGaReport>> | null = null;
    const propertyId = ga4PropertyId.value().trim();
    if (!/^\d+$/.test(propertyId)) {
      warnings.push('GA4 reporting is not configured with a numeric property ID.');
    } else {
      try {
        gaData = await runGaReport(propertyId, range);
      } catch (error) {
        console.error('GA4 reporting failed', error);
        warnings.push('Google Analytics reporting is temporarily unavailable.');
      }
    }

    const trend: DailyMetric[] = dateKeys.map((date) => ({
      date,
      visitors: gaData?.dailyTraffic[date]?.visitors ?? 0,
      sessions: gaData?.dailyTraffic[date]?.sessions ?? 0,
      signUps: accounts.signUpsByDate[date] ?? 0,
      lessonCompletions: gaData?.lessonCompletionsByDate[date] ?? 0,
    }));

    return {
      generatedAt: new Date().toISOString(),
      range,
      warnings,
      traffic: gaData?.summary ?? {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        sessions: 0,
        pageViews: 0,
        engagedSessions: 0,
        engagementRate: 0,
        averageSessionDuration: 0,
        curriculumUsers: 0,
      },
      actions: {
        logins: gaData?.actions.login ?? 0,
        signUps: gaData?.actions.sign_up ?? 0,
        curriculumStarts: gaData?.actions.curriculum_start ?? 0,
        lessonCompletions: gaData?.actions.lesson_complete ?? 0,
        unitCompletions: gaData?.actions.unit_complete ?? 0,
        simulatorLaunches: gaData?.actions.simulator_launch ?? 0,
        simulatorFullscreen: gaData?.actions.simulator_fullscreen ?? 0,
      },
      accounts: {
        totalAccounts: accounts.totalAccounts,
        newAccounts: accounts.newAccounts,
      },
      learning,
      trend,
      topPages: gaData?.topPages ?? [],
    };
  },
);
