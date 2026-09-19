export interface BlockNode {
  id: string;
  type: string;
  getFieldValue(name: string): string | null;
  getInputTargetBlock(name: string): BlockNode | null;
  getNextBlock(): BlockNode | null;
}

export interface WorkspaceNode {
  getTopBlocks(ordered: boolean): BlockNode[];
  getVariableById?(id: string): {name?: string; getName?: () => string} | null;
  getVariableMap?(): {
    getVariableById(id: string): {name?: string; getName?: () => string} | null;
  };
}

export interface BlockScene {
  x: number;
  y: number;
  direction: number;
  moves: number;
}

export interface BlockStep {
  blockId: string;
  output: string[];
  variables: Record<string, unknown>;
  scene: BlockScene;
}

export type BlockPlaybackKind =
  | 'start'
  | 'command'
  | 'move'
  | 'turn'
  | 'decision'
  | 'loop'
  | 'function'
  | 'return';

export interface BlockPlaybackFrame extends BlockStep {
  blockType: string;
  kind: BlockPlaybackKind;
}

export interface BlockRunResult {
  output: string[];
  variables: Record<string, unknown>;
  scene: BlockScene;
  steps: BlockStep[];
  playback: BlockPlaybackFrame[];
  error: string | null;
  operations: number;
  executedBlockTypes: string[];
}

interface FunctionDefinition {
  parameter: string;
  body: BlockNode | null;
}

interface ReturnSignal {
  returned: true;
  value: unknown;
}

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

function cloneVariables(scopes: Array<Record<string, unknown>>): Record<string, unknown> {
  return Object.assign({}, ...scopes);
}

function number(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function truth(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

export function runBlockProgram(
  workspace: WorkspaceNode,
  limits: {operations?: number; recursion?: number} = {},
): BlockRunResult {
  const maxOperations = limits.operations ?? 500;
  const maxRecursion = limits.recursion ?? 20;
  const output: string[] = [];
  const scopes: Array<Record<string, unknown>> = [{}];
  const scene: BlockScene = {x: 0, y: 0, direction: 0, moves: 0};
  const steps: BlockStep[] = [];
  const playback: BlockPlaybackFrame[] = [];
  const functions = new Map<string, FunctionDefinition>();
  const executedBlockTypes = new Set<string>();
  let operations = 0;
  let recursionDepth = 0;

  const countOperation = (): void => {
    operations += 1;
    if (operations > maxOperations) {
      throw new Error('The program ran for too many steps. Check the stopping rule in each loop.');
    }
  };

  const variableName = (block: BlockNode): string => {
    const id = block.getFieldValue('VAR') ?? '';
    const variable = workspace.getVariableById?.(id)
      ?? workspace.getVariableMap?.().getVariableById(id);
    return variable?.name ?? variable?.getName?.() ?? (id || 'value');
  };

  const readVariable = (name: string): unknown => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (Object.prototype.hasOwnProperty.call(scopes[index], name)) return scopes[index][name];
    }
    return 0;
  };

  const writeVariable = (name: string, value: unknown): void => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (Object.prototype.hasOwnProperty.call(scopes[index], name)) {
        scopes[index][name] = value;
        return;
      }
    }
    scopes[scopes.length - 1][name] = value;
  };

  const snapshot = (block: BlockNode): void => {
    executedBlockTypes.add(block.type);
    countOperation();
    steps.push({
      blockId: block.id,
      output: [...output],
      variables: cloneVariables(scopes),
      scene: {...scene},
    });
  };

  const playbackFrame = (block: BlockNode, kind: BlockPlaybackKind): void => {
    playback.push({
      blockId: block.id,
      blockType: block.type,
      kind,
      output: [...output],
      variables: cloneVariables(scopes),
      scene: {...scene},
    });
  };

  const callFunction = (name: string, argument: unknown): unknown => {
    const definition = functions.get(name);
    if (!definition) throw new Error(`The function ${name || '(unnamed)'} is not defined.`);
    recursionDepth += 1;
    if (recursionDepth > maxRecursion) {
      throw new Error('The program called functions too deeply. Check for a function that calls itself without stopping.');
    }
    scopes.push(definition.parameter ? {[definition.parameter]: argument} : {});
    const signal = executeChain(definition.body);
    scopes.pop();
    recursionDepth -= 1;
    return signal?.value ?? null;
  };

  const valueOf = (block: BlockNode | null): unknown => {
    if (!block) return 0;
    snapshot(block);
    switch (block.type) {
      case 'math_number': return number(block.getFieldValue('NUM'));
      case 'text': return block.getFieldValue('TEXT') ?? '';
      case 'logic_boolean': return block.getFieldValue('BOOL') === 'TRUE';
      case 'variables_get': return readVariable(variableName(block));
      case 'math_arithmetic': {
        const left = number(valueOf(block.getInputTargetBlock('A')));
        const right = number(valueOf(block.getInputTargetBlock('B')));
        switch (block.getFieldValue('OP')) {
          case 'MINUS': return left - right;
          case 'MULTIPLY': return left * right;
          case 'DIVIDE': return right === 0 ? 0 : left / right;
          case 'POWER': return left ** right;
          default: return left + right;
        }
      }
      case 'logic_compare': {
        const left = valueOf(block.getInputTargetBlock('A'));
        const right = valueOf(block.getInputTargetBlock('B'));
        switch (block.getFieldValue('OP')) {
          case 'NEQ': return left !== right;
          case 'LT': return number(left) < number(right);
          case 'LTE': return number(left) <= number(right);
          case 'GT': return number(left) > number(right);
          case 'GTE': return number(left) >= number(right);
          default: return left === right;
        }
      }
      case 'logic_operation': {
        const left = truth(valueOf(block.getInputTargetBlock('A')));
        if (block.getFieldValue('OP') === 'AND') {
          return left && truth(valueOf(block.getInputTargetBlock('B')));
        }
        return left || truth(valueOf(block.getInputTargetBlock('B')));
      }
      case 'logic_negate': return !truth(valueOf(block.getInputTargetBlock('BOOL')));
      case 'text_join': {
        const parts: string[] = [];
        for (let index = 0; index < 20; index += 1) {
          const input = block.getInputTargetBlock(`ADD${index}`);
          if (!input) {
            if (index > 1) break;
            parts.push('');
          } else {
            parts.push(String(valueOf(input)));
          }
        }
        return parts.join('');
      }
      case 'lists_create_with': {
        const items: unknown[] = [];
        for (let index = 0; index < 100; index += 1) {
          const item = block.getInputTargetBlock(`ADD${index}`);
          if (!item) {
            if (index > 2) break;
          } else {
            items.push(valueOf(item));
          }
        }
        return items;
      }
      case 'lists_length': {
        const list = valueOf(block.getInputTargetBlock('VALUE'));
        return Array.isArray(list) || typeof list === 'string' ? list.length : 0;
      }
      case 'lists_getIndex': {
        const source = valueOf(block.getInputTargetBlock('VALUE'));
        if (!Array.isArray(source) && typeof source !== 'string') return null;
        const where = block.getFieldValue('WHERE');
        const at = Math.max(1, Math.floor(number(valueOf(block.getInputTargetBlock('AT')))));
        if (where === 'LAST') return source[source.length - 1];
        if (where === 'FROM_END') return source[source.length - at];
        return source[where === 'FIRST' ? 0 : at - 1];
      }
      case 'telemark_call_value':
        return callFunction(
          block.getFieldValue('NAME') ?? '',
          valueOf(block.getInputTargetBlock('ARG')),
        );
      default: return 0;
    }
  };

  const executeStatement = (block: BlockNode): ReturnSignal | null => {
    snapshot(block);
    switch (block.type) {
      case 'telemark_start':
        playbackFrame(block, 'start');
        return null;
      case 'telemark_function':
        playbackFrame(block, 'function');
        return null;
      case 'telemark_print':
      case 'text_print':
        output.push(String(valueOf(block.getInputTargetBlock('VALUE') ?? block.getInputTargetBlock('TEXT'))));
        playbackFrame(block, 'command');
        return null;
      case 'telemark_move': {
        const distance = Math.max(0, Math.floor(number(valueOf(block.getInputTargetBlock('STEPS')))));
        const [dx, dy] = DIRECTIONS[scene.direction];
        for (let step = 0; step < distance; step += 1) {
          countOperation();
          scene.x += dx;
          scene.y += dy;
          scene.moves += 1;
          playbackFrame(block, 'move');
        }
        if (distance === 0) playbackFrame(block, 'move');
        return null;
      }
      case 'telemark_turn_right':
        scene.direction = (scene.direction + 1) % DIRECTIONS.length;
        playbackFrame(block, 'turn');
        return null;
      case 'variables_set':
        writeVariable(variableName(block), valueOf(block.getInputTargetBlock('VALUE')));
        playbackFrame(block, 'command');
        return null;
      case 'math_change': {
        const name = variableName(block);
        writeVariable(name, number(readVariable(name)) + number(valueOf(block.getInputTargetBlock('DELTA'))));
        playbackFrame(block, 'command');
        return null;
      }
      case 'controls_if': {
        let index = 0;
        while (block.getInputTargetBlock(`IF${index}`)) {
          if (truth(valueOf(block.getInputTargetBlock(`IF${index}`)))) {
            playbackFrame(block, 'decision');
            return executeChain(block.getInputTargetBlock(`DO${index}`));
          }
          index += 1;
        }
        playbackFrame(block, 'decision');
        return executeChain(block.getInputTargetBlock('ELSE'));
      }
      case 'controls_repeat_ext': {
        const times = Math.max(0, Math.floor(number(valueOf(block.getInputTargetBlock('TIMES')))));
        playbackFrame(block, 'loop');
        for (let index = 0; index < times; index += 1) {
          const signal = executeChain(block.getInputTargetBlock('DO'));
          if (signal) return signal;
        }
        return null;
      }
      case 'controls_whileUntil': {
        const until = block.getFieldValue('MODE') === 'UNTIL';
        playbackFrame(block, 'loop');
        while (until !== truth(valueOf(block.getInputTargetBlock('BOOL')))) {
          const signal = executeChain(block.getInputTargetBlock('DO'));
          if (signal) return signal;
        }
        return null;
      }
      case 'controls_for': {
        const name = variableName(block);
        const from = number(valueOf(block.getInputTargetBlock('FROM')));
        const to = number(valueOf(block.getInputTargetBlock('TO')));
        const by = Math.abs(number(valueOf(block.getInputTargetBlock('BY')))) || 1;
        const direction = from <= to ? 1 : -1;
        playbackFrame(block, 'loop');
        for (let current = from; direction > 0 ? current <= to : current >= to; current += by * direction) {
          writeVariable(name, current);
          const signal = executeChain(block.getInputTargetBlock('DO'));
          if (signal) return signal;
        }
        return null;
      }
      case 'controls_forEach': {
        const name = variableName(block);
        const list = valueOf(block.getInputTargetBlock('LIST'));
        playbackFrame(block, 'loop');
        for (const item of Array.isArray(list) ? list : []) {
          writeVariable(name, item);
          const signal = executeChain(block.getInputTargetBlock('DO'));
          if (signal) return signal;
        }
        return null;
      }
      case 'telemark_call':
        playbackFrame(block, 'function');
        callFunction(block.getFieldValue('NAME') ?? '', valueOf(block.getInputTargetBlock('ARG')));
        return null;
      case 'telemark_return': {
        const value = valueOf(block.getInputTargetBlock('VALUE'));
        playbackFrame(block, 'return');
        return {returned: true, value};
      }
      default:
        playbackFrame(block, 'command');
        return null;
    }
  };

  function executeChain(start: BlockNode | null): ReturnSignal | null {
    let current = start;
    while (current) {
      const signal = executeStatement(current);
      if (signal) return signal;
      current = current.getNextBlock();
    }
    return null;
  }

  try {
    const topBlocks = workspace.getTopBlocks(true);
    topBlocks.filter((block) => block.type === 'telemark_function').forEach((block) => {
      functions.set(block.getFieldValue('NAME') ?? '', {
        parameter: block.getFieldValue('PARAM') ?? '',
        body: block.getInputTargetBlock('DO'),
      });
    });
    const starts = topBlocks.filter((block) => block.type === 'telemark_start');
    const runnable = starts.length > 0
      ? starts
      : topBlocks.filter((block) => block.type !== 'telemark_function');
    runnable.forEach((block) => executeChain(block));
    return {
      output,
      variables: cloneVariables(scopes),
      scene,
      steps,
      playback,
      error: null,
      operations,
      executedBlockTypes: [...executedBlockTypes],
    };
  } catch (reason) {
    return {
      output,
      variables: cloneVariables(scopes),
      scene,
      steps,
      playback,
      error: reason instanceof Error ? reason.message : 'The program could not run.',
      operations,
      executedBlockTypes: [...executedBlockTypes],
    };
  }
}
