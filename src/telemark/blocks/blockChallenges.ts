import type {BlockRunResult} from './blockInterpreter';

export interface BlockCheck {
  label: string;
  test: (result: BlockRunResult) => boolean;
}

export interface BlockLessonConfig {
  lessonId: string;
  unit: number;
  challenge: boolean;
  goal: string;
  objectives: string[];
  toolboxUnit: number;
  initialScene: {x: number; y: number; direction: number; moves: number};
  initialData: Record<string, unknown>;
  expectedFinalState?: Record<string, unknown>;
  checks: BlockCheck[];
  starter: Record<string, unknown>;
}

const lessonGuides: Record<string, {goal: string; objectives: string[]}> = {
  'workspace-and-run-controls': {
    goal: 'Connect a print command, run it, then reset and rebuild it.',
    objectives: ['Use Run, Step, Reset, Download, and Import for the correct job.'],
  },
  'commands-in-order': {
    goal: 'Print three values in a predicted order, then change the sequence.',
    objectives: ['Trace connected commands from top to bottom.'],
  },
  'start-blocks-and-events': {
    goal: 'Compare a connected command with a loose command when Run is pressed.',
    objectives: ['Identify the event and the stack that handles it.'],
  },
  'step-through-and-debug': {
    goal: 'Build a short route, step through it, and repair one command that is out of order.',
    objectives: ['Find the first step where actual state differs from expected state.'],
  },
  'numbers-text-booleans': {
    goal: 'Print a number, text, a Boolean, and the result of one comparison.',
    objectives: ['Identify the data type of each value and result.'],
  },
  'set-and-change-variables': {
    goal: 'Set a score, change it twice, and trace every stored value.',
    objectives: ['Separate assignment, variable reading, and state changes.'],
  },
  'math-and-text-expressions': {
    goal: 'Store a nested math result, then join its value with clear output text.',
    objectives: ['Trace an expression from its inner inputs to its final value.'],
  },
  'input-output-tracing': {
    goal: 'Build a value trace with two variables and at least two visible outputs.',
    objectives: ['Record state after each instruction in execution order.'],
  },
  'compare-values': {
    goal: 'Run equal, not-equal, and ordered comparisons with true and false results.',
    objectives: ['Explain why every comparison produces a Boolean.'],
  },
  'choose-with-if': {
    goal: 'Use one condition so a message appears for one input and not another.',
    objectives: ['Trace the condition and the commands inside its branch.'],
  },
  'else-and-else-if': {
    goal: 'Build large, medium, and small branches, then test their boundary values.',
    objectives: ['Order branches so the first true rule is the correct rule.'],
  },
  'and-or-not': {
    goal: 'Combine two package rules, then test every true-and-false input pair.',
    objectives: ['Use and, or, and not according to their Boolean results.'],
  },
  'repeat-known-count': {
    goal: 'Repeat a movement four times and compare an inside-loop output with an outside output.',
    objectives: ['Count how many times the loop body runs.'],
  },
  'repeat-while-true': {
    goal: 'Change a counter in a while loop until its condition becomes false.',
    objectives: ['Identify which command makes the loop stop.'],
  },
  'counting-loops': {
    goal: 'Print every value in a planned counting range.',
    objectives: ['Check both loop boundaries for an off-by-one error.'],
  },
  'nested-and-nonstop-loops': {
    goal: 'Build a two-by-three nested loop and trace the inner body six times.',
    objectives: ['Separate the outer repeat from the inner repeats.'],
  },
  'define-and-call-functions': {
    goal: 'Define one named function and call it twice from the main program.',
    objectives: ['Trace execution into a function body and back to its caller.'],
  },
  'function-parameters': {
    goal: 'Call one function with three different argument values.',
    objectives: ['Track the local parameter value during each call.'],
  },
  'return-a-result': {
    goal: 'Return a doubled number from a function and store the result.',
    objectives: ['Separate returned data from printed output.'],
  },
  'store-and-process-lists': {
    goal: 'Store three values in a list, read chosen positions, and process every item.',
    objectives: ['Trace list order, displayed positions, and Java-style indexes.'],
  },
  'break-programs-into-parts': {
    goal: 'Split a score-report program into a list, a function, and a main sequence.',
    objectives: ['Give each program part one clear job.'],
  },
  'combine-programming-tools': {
    goal: 'Process a list with state, a decision, a loop, and a function.',
    objectives: ['Choose the programming tool that fits each part of the plan.'],
  },
  'test-cases-and-debugging': {
    goal: 'Run a normal, boundary, and below-boundary test against one function.',
    objectives: ['Write each expected result before running its test.'],
  },
  'blocks-beside-java': {
    goal: 'Build the block form of a variable, loop, and decision shown beside Java-shaped code.',
    objectives: ['Match each block structure to the Java syntax with the same job.'],
  },
};

const starter = (message: string): Record<string, unknown> => ({
  blocks: {
    languageVersion: 0,
    blocks: [{
      type: 'telemark_start',
      id: 'start',
      x: 28,
      y: 28,
      next: {
        block: {
          type: 'telemark_print',
          id: 'first-output',
          inputs: {VALUE: {shadow: {type: 'text', id: 'starter-text', fields: {TEXT: message}}}},
        },
      },
    }],
  },
});

const LOOP_TYPES = new Set([
  'controls_repeat_ext',
  'controls_whileUntil',
  'controls_for',
  'controls_forEach',
]);

const usesLoop = (result: BlockRunResult) => result.executedBlockTypes.some(
  (type) => LOOP_TYPES.has(type),
);

const challengeByUnit: Record<number, {goal: string; expected: Record<string, unknown>; checks: BlockCheck[]}> = {
  0: {
    goal: 'Move two steps east, turn right, move one step south, and print done.',
    expected: {x: 2, y: 1, moves: 3, output: ['done']},
    checks: [
      {label: 'Ends at x 2 and y 1', test: (result) => result.scene.x === 2 && result.scene.y === 1},
      {label: 'Uses exactly three movement steps', test: (result) => result.scene.moves === 3},
      {label: 'Prints done', test: (result) => result.output.some((line) => line.toLowerCase() === 'done')},
    ],
  },
  1: {
    goal: 'Store a score, change it to 12, and print the final number.',
    expected: {score: 12, output: ['12']},
    checks: [
      {label: 'A variable stores 12', test: (result) => Object.values(result.variables).some((value) => value === 12)},
      {label: 'Prints 12', test: (result) => result.output.includes('12')},
      {label: 'Uses an assignment', test: (result) => result.executedBlockTypes.includes('variables_set')},
      {label: 'Calculates or changes the score', test: (result) => result.executedBlockTypes.some((type) => type === 'math_change' || type === 'math_arithmetic')},
      {label: 'Runs without an error', test: (result) => result.error === null},
    ],
  },
  2: {
    goal: 'Use a condition to print accept when a stored value is at least 10.',
    expected: {output: ['accept']},
    checks: [
      {label: 'Prints accept', test: (result) => result.output.some((line) => line.toLowerCase() === 'accept')},
      {label: 'Does not print reject', test: (result) => !result.output.some((line) => line.toLowerCase() === 'reject')},
      {label: 'Uses a decision', test: (result) => result.executedBlockTypes.includes('controls_if')},
      {label: 'Compares two values', test: (result) => result.executedBlockTypes.includes('logic_compare')},
      {label: 'Runs without an error', test: (result) => result.error === null},
    ],
  },
  3: {
    goal: 'Use loops to move eight total steps and finish at x 4 and y 4.',
    expected: {x: 4, y: 4, moves: 8},
    checks: [
      {label: 'Moves eight total steps', test: (result) => result.scene.moves === 8},
      {label: 'Ends at x 4 and y 4', test: (result) => result.scene.x === 4 && result.scene.y === 4},
      {label: 'Uses a loop', test: usesLoop},
      {label: 'Stays inside the operation limit', test: (result) => result.error === null},
    ],
  },
  4: {
    goal: 'Build a list, process its values with a function, and print at least three results.',
    expected: {minimumOutputLines: 3, requiresList: true, requiresFunction: true},
    checks: [
      {label: 'Prints at least three results', test: (result) => result.output.length >= 3},
      {label: 'Stores a list', test: (result) => Object.values(result.variables).some(Array.isArray)},
      {label: 'Calls a function', test: (result) => result.executedBlockTypes.some((type) => type === 'telemark_call' || type === 'telemark_call_value')},
      {label: 'Runs without an error', test: (result) => result.error === null},
    ],
  },
  5: {
    goal: 'Use variables, a decision, a loop, a function, and a list to print ready and move six steps.',
    expected: {moves: 6, output: ['ready'], requiresAllFoundations: true},
    checks: [
      {label: 'Prints ready', test: (result) => result.output.some((line) => line.toLowerCase() === 'ready')},
      {label: 'Moves six total steps', test: (result) => result.scene.moves === 6},
      {label: 'Stores at least two named values', test: (result) => Object.keys(result.variables).length >= 2},
      {label: 'Stores a number', test: (result) => Object.values(result.variables).some((value) => typeof value === 'number')},
      {label: 'Stores a list', test: (result) => Object.values(result.variables).some(Array.isArray)},
      {label: 'Uses a decision', test: (result) => result.executedBlockTypes.includes('controls_if')},
      {label: 'Uses a loop', test: usesLoop},
      {label: 'Calls a function', test: (result) => result.executedBlockTypes.some((type) => type === 'telemark_call' || type === 'telemark_call_value')},
      {label: 'Runs without an error', test: (result) => result.error === null},
    ],
  },
};

export function blockLessonConfig(lessonId: string): BlockLessonConfig {
  const unit = Number.parseInt(lessonId.match(/blocks-unit-(\d{2})/)?.[1] ?? '0', 10);
  const challenge = /challenge$/.test(lessonId);
  const challengeConfig = challengeByUnit[unit];
  const lessonSlug = lessonId.split('/')[1] ?? '';
  const guide = lessonGuides[lessonSlug];
  return {
    lessonId,
    unit,
    challenge,
    goal: challenge ? challengeConfig.goal : guide?.goal
      ?? 'Change the starter program, run it, and explain the result.',
    objectives: challenge
      ? challengeConfig.checks.map((check) => check.label)
      : guide?.objectives ?? ['Run the program and explain its output.'],
    toolboxUnit: unit,
    initialScene: {x: 0, y: 0, direction: 0, moves: 0},
    initialData: {},
    ...(challenge ? {expectedFinalState: challengeConfig.expected} : {}),
    checks: challenge ? challengeConfig.checks : [],
    starter: starter(unit === 0 ? 'ready' : 'change this output'),
  };
}
