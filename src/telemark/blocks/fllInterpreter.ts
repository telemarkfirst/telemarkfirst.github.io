import type {BlockNode, WorkspaceNode} from './blockInterpreter';

export interface FllMissionState {
  crossedLine: boolean;
  targetActive: boolean;
  carryingObject: boolean;
  deliveredObject: boolean;
  atHome: boolean;
}

export interface FllSceneState {
  xCm: number;
  zCm: number;
  headingDeg: number;
  speedPercent: number;
  attachmentDeg: number;
  elapsedSeconds: number;
  distanceCm: number;
  reflection: number;
  score: number;
  collision: boolean;
  objectX: number;
  objectZ: number;
  missions: FllMissionState;
}

export type FllPlaybackKind = 'start' | 'drive' | 'turn' | 'sensor' | 'attachment' | 'control' | 'function';

export interface FllPlaybackFrame {
  blockId: string;
  blockType: string;
  kind: FllPlaybackKind;
  scene: FllSceneState;
  variables: Record<string, unknown>;
}

export interface FllRunResult {
  scene: FllSceneState;
  playback: FllPlaybackFrame[];
  variables: Record<string, unknown>;
  error: string | null;
  operations: number;
  executedBlockTypes: string[];
  repeatabilityPasses: number;
}

interface FunctionDefinition {parameter: string; body: BlockNode | null}
interface ReturnSignal {returned: true; value: unknown}

const FIELD_X = 118;
const FIELD_Z = 54;
const ROBOT_RADIUS = 9;
const OBSTACLE = {x: 20, z: 0, radius: 12};
const CARGO_START = {x: -5, z: 20};
const DELIVERY = {x: 78, z: -28, radius: 18};
const TARGET = {x: 38, z: 36, radius: 15};

export const FLL_REPEATABILITY_PROFILES = [-0.02, 0, 0.02] as const;

export function initialFllScene(): FllSceneState {
  return {
    xCm: -100, zCm: 38, headingDeg: 0, speedPercent: 35, attachmentDeg: 0,
    elapsedSeconds: 0, distanceCm: 200, reflection: 78, score: 0, collision: false,
    objectX: CARGO_START.x, objectZ: CARGO_START.z,
    missions: {crossedLine: false, targetActive: false, carryingObject: false, deliveredObject: false, atHome: true},
  };
}

const cloneScene = (scene: FllSceneState): FllSceneState => ({...scene, missions: {...scene.missions}});
const numeric = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const truth = (value: unknown): boolean => typeof value === 'number' ? value !== 0 : Boolean(value);
const normalizeHeading = (value: number): number => ((value + 180) % 360 + 360) % 360 - 180;
const distance = (x1: number, z1: number, x2: number, z2: number) => Math.hypot(x2 - x1, z2 - z1);

function executeFllProgram(workspace: WorkspaceNode, wheelBias: number, collectPlayback: boolean): FllRunResult {
  const scene = initialFllScene();
  const playback: FllPlaybackFrame[] = [];
  const scopes: Array<Record<string, unknown>> = [{}];
  const functions = new Map<string, FunctionDefinition>();
  const executed = new Set<string>();
  let operations = 0;
  let yawOffset = 0;
  let recursion = 0;

  const vars = () => Object.assign({}, ...scopes);
  const count = () => {
    operations += 1;
    if (operations > 1200) throw new Error('The mission used too many operations. Check each loop and sensor stop.');
    if (scene.elapsedSeconds > 150) throw new Error('The program exceeded the 150-second match limit.');
  };
  const variableName = (block: BlockNode) => {
    const id = block.getFieldValue('VAR') ?? 'value';
    const variable = workspace.getVariableById?.(id) ?? workspace.getVariableMap?.().getVariableById(id);
    return variable?.name ?? variable?.getName?.() ?? id;
  };
  const read = (name: string) => {
    for (let i = scopes.length - 1; i >= 0; i -= 1) if (Object.hasOwn(scopes[i], name)) return scopes[i][name];
    return 0;
  };
  const write = (name: string, value: unknown) => {
    for (let i = scopes.length - 1; i >= 0; i -= 1) if (Object.hasOwn(scopes[i], name)) { scopes[i][name] = value; return; }
    scopes[scopes.length - 1][name] = value;
  };
  const frame = (block: BlockNode, kind: FllPlaybackKind) => {
    executed.add(block.type);
    if (collectPlayback) playback.push({blockId: block.id, blockType: block.type, kind, scene: cloneScene(scene), variables: vars()});
  };
  const updateSensorsAndMissions = () => {
    scene.reflection = Math.abs(scene.xCm + 20) < 3 ? 18 : 78;
    const heading = scene.headingDeg * Math.PI / 180;
    const candidates = [OBSTACLE, {x: scene.objectX, z: scene.objectZ, radius: 5}, TARGET];
    scene.distanceCm = 200;
    for (const item of candidates) {
      const dx = item.x - scene.xCm;
      const dz = item.z - scene.zCm;
      const forward = dx * Math.cos(heading) + dz * Math.sin(heading);
      const side = Math.abs(-dx * Math.sin(heading) + dz * Math.cos(heading));
      if (forward > 0 && side < item.radius + 5) scene.distanceCm = Math.min(scene.distanceCm, Math.max(0, forward - item.radius));
    }
    scene.missions.crossedLine ||= scene.xCm >= -20;
    if (!scene.missions.targetActive && scene.attachmentDeg >= 45
      && distance(scene.xCm, scene.zCm, TARGET.x, TARGET.z) <= TARGET.radius) scene.missions.targetActive = true;
    if (!scene.missions.carryingObject && !scene.missions.deliveredObject && scene.attachmentDeg >= 55
      && distance(scene.xCm, scene.zCm, scene.objectX, scene.objectZ) <= 14) scene.missions.carryingObject = true;
    if (scene.missions.carryingObject) {
      scene.objectX = scene.xCm + Math.cos(heading) * 9;
      scene.objectZ = scene.zCm + Math.sin(heading) * 9;
      if (scene.attachmentDeg <= 12) {
        scene.missions.carryingObject = false;
        if (distance(scene.objectX, scene.objectZ, DELIVERY.x, DELIVERY.z) <= DELIVERY.radius) scene.missions.deliveredObject = true;
      }
    }
    scene.missions.atHome = scene.xCm < -82 && scene.zCm > 25;
    scene.score = (scene.missions.crossedLine ? 10 : 0) + (scene.missions.targetActive ? 20 : 0) + (scene.missions.deliveredObject ? 30 : 0);
  };
  const move = (block: BlockNode, requestedCm: number, steering = 0) => {
    const actual = requestedCm * (1 + wheelBias);
    const parts = Math.max(1, Math.ceil(Math.abs(actual) / 4));
    for (let i = 0; i < parts; i += 1) {
      count();
      const step = actual / parts;
      scene.headingDeg = normalizeHeading(scene.headingDeg + steering * step * 0.035);
      const rad = scene.headingDeg * Math.PI / 180;
      scene.xCm += Math.cos(rad) * step;
      scene.zCm += Math.sin(rad) * step;
      scene.elapsedSeconds += Math.abs(step) / Math.max(4, scene.speedPercent * 0.55);
      if (Math.abs(scene.xCm) > FIELD_X - ROBOT_RADIUS || Math.abs(scene.zCm) > FIELD_Z - ROBOT_RADIUS
        || distance(scene.xCm, scene.zCm, OBSTACLE.x, OBSTACLE.z) < ROBOT_RADIUS + OBSTACLE.radius) {
        scene.collision = true;
        throw new Error('The robot collided with a wall or practice-field obstacle.');
      }
      updateSensorsAndMissions();
      frame(block, 'drive');
    }
  };
  const callFunction = (name: string, argument: unknown): unknown => {
    const definition = functions.get(name);
    if (!definition) throw new Error(`The My Block ${name || '(unnamed)'} is not defined.`);
    recursion += 1;
    if (recursion > 20) throw new Error('A My Block called itself too deeply.');
    scopes.push(definition.parameter ? {[definition.parameter]: argument} : {});
    const signal = executeChain(definition.body);
    scopes.pop(); recursion -= 1;
    return signal?.value ?? null;
  };
  const valueOf = (block: BlockNode | null): unknown => {
    if (!block) return 0;
    count(); executed.add(block.type);
    switch (block.type) {
      case 'math_number': return numeric(block.getFieldValue('NUM'));
      case 'logic_boolean': return block.getFieldValue('BOOL') === 'TRUE';
      case 'variables_get': return read(variableName(block));
      case 'fll_distance_sensor': updateSensorsAndMissions(); return scene.distanceCm;
      case 'fll_reflection_sensor': updateSensorsAndMissions(); return scene.reflection;
      case 'fll_heading_sensor': return normalizeHeading(scene.headingDeg - yawOffset);
      case 'math_arithmetic': {
        const a = numeric(valueOf(block.getInputTargetBlock('A'))); const b = numeric(valueOf(block.getInputTargetBlock('B')));
        if (block.getFieldValue('OP') === 'MINUS') return a - b;
        if (block.getFieldValue('OP') === 'MULTIPLY') return a * b;
        if (block.getFieldValue('OP') === 'DIVIDE') return b === 0 ? 0 : a / b;
        return a + b;
      }
      case 'logic_compare': {
        const a = valueOf(block.getInputTargetBlock('A')); const b = valueOf(block.getInputTargetBlock('B'));
        if (block.getFieldValue('OP') === 'LT') return numeric(a) < numeric(b);
        if (block.getFieldValue('OP') === 'LTE') return numeric(a) <= numeric(b);
        if (block.getFieldValue('OP') === 'GT') return numeric(a) > numeric(b);
        if (block.getFieldValue('OP') === 'GTE') return numeric(a) >= numeric(b);
        if (block.getFieldValue('OP') === 'NEQ') return a !== b;
        return a === b;
      }
      case 'logic_operation': {
        const a = truth(valueOf(block.getInputTargetBlock('A')));
        return block.getFieldValue('OP') === 'AND' ? a && truth(valueOf(block.getInputTargetBlock('B'))) : a || truth(valueOf(block.getInputTargetBlock('B')));
      }
      case 'logic_negate': return !truth(valueOf(block.getInputTargetBlock('BOOL')));
      case 'telemark_call_value': return callFunction(block.getFieldValue('NAME') ?? '', valueOf(block.getInputTargetBlock('ARG')));
      default: return 0;
    }
  };
  const execute = (block: BlockNode): ReturnSignal | null => {
    count(); executed.add(block.type);
    switch (block.type) {
      case 'fll_start': frame(block, 'start'); return null;
      case 'fll_set_speed': scene.speedPercent = Math.min(100, Math.max(5, numeric(valueOf(block.getInputTargetBlock('SPEED'))))); frame(block, 'control'); return null;
      case 'fll_drive': move(block, Math.abs(numeric(valueOf(block.getInputTargetBlock('DISTANCE')))) * (block.getFieldValue('DIRECTION') === 'BACKWARD' ? -1 : 1)); return null;
      case 'fll_turn': {
        const sign = block.getFieldValue('DIRECTION') === 'LEFT' ? 1 : -1;
        scene.headingDeg = normalizeHeading(scene.headingDeg + sign * numeric(valueOf(block.getInputTargetBlock('ANGLE'))) * (1 + wheelBias));
        scene.elapsedSeconds += Math.abs(numeric(valueOf(block.getInputTargetBlock('ANGLE'))) / Math.max(25, scene.speedPercent * 2));
        updateSensorsAndMissions(); frame(block, 'turn'); return null;
      }
      case 'fll_steer': move(block, numeric(valueOf(block.getInputTargetBlock('DISTANCE'))), numeric(valueOf(block.getInputTargetBlock('STEERING')))); return null;
      case 'fll_stop': frame(block, 'control'); return null;
      case 'fll_attachment': scene.attachmentDeg = Math.min(90, Math.max(0, numeric(valueOf(block.getInputTargetBlock('ANGLE'))))); scene.elapsedSeconds += 0.4; updateSensorsAndMissions(); frame(block, 'attachment'); return null;
      case 'fll_wait_distance': {
        const threshold = numeric(valueOf(block.getInputTargetBlock('DISTANCE'))); let guard = 0;
        updateSensorsAndMissions(); while (scene.distanceCm > threshold && guard++ < 60) move(block, 3);
        frame(block, 'sensor'); return null;
      }
      case 'fll_wait_line': {
        const threshold = numeric(valueOf(block.getInputTargetBlock('REFLECTION'))); let guard = 0;
        updateSensorsAndMissions(); while (scene.reflection >= threshold && guard++ < 60) move(block, 3);
        frame(block, 'sensor'); return null;
      }
      case 'fll_reset_heading': yawOffset = scene.headingDeg; frame(block, 'sensor'); return null;
      case 'variables_set': write(variableName(block), valueOf(block.getInputTargetBlock('VALUE'))); frame(block, 'control'); return null;
      case 'math_change': write(variableName(block), numeric(read(variableName(block))) + numeric(valueOf(block.getInputTargetBlock('DELTA')))); frame(block, 'control'); return null;
      case 'controls_if': {
        let i = 0; while (block.getInputTargetBlock(`IF${i}`)) { if (truth(valueOf(block.getInputTargetBlock(`IF${i}`)))) { frame(block, 'control'); return executeChain(block.getInputTargetBlock(`DO${i}`)); } i += 1; }
        frame(block, 'control'); return executeChain(block.getInputTargetBlock('ELSE'));
      }
      case 'controls_repeat_ext': {
        const times = Math.max(0, Math.floor(numeric(valueOf(block.getInputTargetBlock('TIMES'))))); frame(block, 'control');
        for (let i = 0; i < times; i += 1) { const signal = executeChain(block.getInputTargetBlock('DO')); if (signal) return signal; } return null;
      }
      case 'controls_whileUntil': {
        const until = block.getFieldValue('MODE') === 'UNTIL'; frame(block, 'control');
        while (until !== truth(valueOf(block.getInputTargetBlock('BOOL')))) { const signal = executeChain(block.getInputTargetBlock('DO')); if (signal) return signal; count(); } return null;
      }
      case 'telemark_call': frame(block, 'function'); callFunction(block.getFieldValue('NAME') ?? '', valueOf(block.getInputTargetBlock('ARG'))); return null;
      case 'telemark_return': frame(block, 'function'); return {returned: true, value: valueOf(block.getInputTargetBlock('VALUE'))};
      default: frame(block, 'control'); return null;
    }
  };
  function executeChain(start: BlockNode | null): ReturnSignal | null { let current = start; while (current) { const signal = execute(current); if (signal) return signal; current = current.getNextBlock(); } return null; }

  try {
    const tops = workspace.getTopBlocks(true);
    tops.filter((block) => block.type === 'telemark_function').forEach((block) => functions.set(block.getFieldValue('NAME') ?? '', {parameter: block.getFieldValue('PARAM') ?? '', body: block.getInputTargetBlock('DO')}));
    const starts = tops.filter((block) => block.type === 'fll_start');
    (starts.length ? starts : tops.filter((block) => block.type !== 'telemark_function')).forEach((block) => executeChain(block));
    updateSensorsAndMissions();
    return {scene, playback, variables: vars(), error: null, operations, executedBlockTypes: [...executed], repeatabilityPasses: 0};
  } catch (reason) {
    return {scene, playback, variables: vars(), error: reason instanceof Error ? reason.message : 'The mission could not run.', operations, executedBlockTypes: [...executed], repeatabilityPasses: 0};
  }
}

function profilePassed(result: FllRunResult): boolean {
  return result.error === null && !result.scene.collision && result.scene.missions.atHome;
}

export function runFllProgram(workspace: WorkspaceNode): FllRunResult {
  const result = executeFllProgram(workspace, 0, true);
  result.repeatabilityPasses = FLL_REPEATABILITY_PROFILES
    .map((bias) => executeFllProgram(workspace, bias, false))
    .filter(profilePassed).length;
  return result;
}
