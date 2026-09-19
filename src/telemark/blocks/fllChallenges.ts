import type {FllRunResult, FllSceneState} from './fllInterpreter';
import {initialFllScene} from './fllInterpreter';

export interface FllCheck {label: string; test: (result: FllRunResult) => boolean}
export interface FllLessonConfig {
  lessonId: string;
  unit: number;
  challenge: boolean;
  goal: string;
  objectives: string[];
  initialScene: FllSceneState;
  checks: FllCheck[];
  starter: Record<string, unknown>;
}

const guides: Record<string, {goal: string; objectives: string[]}> = {
  'what-is-fll-challenge': {goal: 'Run a short autonomous route and identify when the robot is acting without remote control.', objectives: ['Connect the Robot Game to the wider FLL Challenge experience.']},
  'spike-app-and-simulator': {goal: 'Use Run, Step, Reset, telemetry, and the 3D camera, then find the matching command family in the SPIKE App.', objectives: ['Separate simulator practice from code downloaded to a physical Hub.']},
  'motor-pairs-and-distance': {goal: 'Compare two distances and two speed settings while watching pose and simulated time.', objectives: ['Use centimeters for a measured route and percent for speed.']},
  'turns-and-steering': {goal: 'Build a point turn and a curved steering move, then compare their paths.', objectives: ['Choose point, pivot, or arc motion for the space available.']},
  'color-and-reflected-light': {goal: 'Move until the downward sensor reaches the dark practice line.', objectives: ['Use reflected light as a field landmark.']},
  'distance-and-wait-until': {goal: 'Approach an object and stop from a distance reading instead of a fixed drive time.', objectives: ['Choose a safe sensor threshold and stopping rule.']},
  'hub-heading': {goal: 'Reset yaw, turn, and use the heading reporter in a correction decision.', objectives: ['Distinguish physical heading from the zeroed yaw reading.']},
  'attachment-motors': {goal: 'Close the front attachment near the object, carry it, and release it inside the delivery zone.', objectives: ['Sequence drive and attachment motion without losing the object.']},
  'my-blocks': {goal: 'Define one parameterized My Block and call it more than once.', objectives: ['Map Telemark functions to SPIKE My Blocks.']},
  'launch-plan-and-home': {goal: 'Start from the home guide, complete one objective, and return to the home region.', objectives: ['Use a repeatable launch pose and plan the return before running.']},
  'calibration-and-repeatability': {goal: 'Run the same route against all three fixed wheel-calibration profiles.', objectives: ['Treat repeatability as evidence, not a single successful run.']},
  'mission-order-and-time': {goal: 'Order two objectives so the robot travels less and stays inside 150 simulated seconds.', objectives: ['Budget travel, mechanism, and return time.']},
};

const start = (next?: Record<string, unknown>): Record<string, unknown> => ({
  blocks: {languageVersion: 0, blocks: [{type: 'fll_start', id: 'fll-start', x: 28, y: 28, ...(next ? {next: {block: next}} : {})}]},
});
const num = (value: number) => ({shadow: {type: 'math_number', fields: {NUM: value}}});
const drive = (value: number, next?: Record<string, unknown>) => ({type: 'fll_drive', fields: {DIRECTION: 'FORWARD'}, inputs: {DISTANCE: num(value)}, ...(next ? {next: {block: next}} : {})});

const challenges: Record<number, {goal: string; checks: FllCheck[]}> = {
  0: {
    goal: 'Leave home, cross the dark line, finish beyond x = 40 cm, and avoid every wall and obstacle.',
    checks: [
      {label: 'Crosses the dark practice line', test: (r) => r.scene.missions.crossedLine},
      {label: 'Finishes beyond x = 40 cm', test: (r) => r.scene.xCm > 40},
      {label: 'Uses drive and turn or steering blocks', test: (r) => r.executedBlockTypes.includes('fll_drive') && r.executedBlockTypes.some((t) => t === 'fll_turn' || t === 'fll_steer')},
      {label: 'Finishes without a collision or runtime error', test: (r) => !r.scene.collision && r.error === null},
    ],
  },
  1: {
    goal: 'Use sensor-assisted motion and the attachment to collect the loose object and release it in the delivery zone.',
    checks: [
      {label: 'Delivers the loose object', test: (r) => r.scene.missions.deliveredObject},
      {label: 'Uses a color or distance sensor command', test: (r) => r.executedBlockTypes.some((t) => ['fll_wait_distance', 'fll_wait_line', 'fll_distance_sensor', 'fll_reflection_sensor'].includes(t))},
      {label: 'Moves the attachment', test: (r) => r.executedBlockTypes.includes('fll_attachment')},
      {label: 'Finishes without a collision or runtime error', test: (r) => !r.scene.collision && r.error === null},
    ],
  },
  2: {
    goal: 'Cross the line, activate the target, deliver the object, and return home within 150 seconds using a My Block.',
    checks: [
      {label: 'Completes all three practice objectives', test: (r) => r.scene.score === 60},
      {label: 'Returns to the home region', test: (r) => r.scene.missions.atHome},
      {label: 'Uses a My Block', test: (r) => r.executedBlockTypes.some((t) => t === 'telemark_call' || t === 'telemark_call_value')},
      {label: 'Finishes within 150 simulated seconds', test: (r) => r.scene.elapsedSeconds <= 150 && r.error === null},
      {label: 'Returns home in at least two calibration profiles', test: (r) => r.repeatabilityPasses >= 2},
    ],
  },
};

export function fllLessonConfig(lessonId: string): FllLessonConfig {
  const unit = Number.parseInt(lessonId.match(/fll-unit-(\d{2})/)?.[1] ?? '0', 10);
  const challenge = /challenge|capstone/.test(lessonId.split('/')[1] ?? '');
  const slug = lessonId.split('/')[1] ?? '';
  const challengeConfig = challenges[unit];
  const guide = guides[slug];
  return {
    lessonId, unit, challenge,
    goal: challenge ? challengeConfig.goal : guide?.goal ?? 'Build, run, and explain the mission program.',
    objectives: challenge ? challengeConfig.checks.map((check) => check.label) : guide?.objectives ?? ['Run the program and explain the field result.'],
    initialScene: initialFllScene(),
    checks: challenge ? challengeConfig.checks : [],
    starter: start(challenge ? undefined : drive(unit === 0 ? 35 : 20)),
  };
}
