const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTs(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  });
  const loaded = {exports: {}};
  new Function('exports', 'require', 'module', outputText)(loaded.exports, require, loaded);
  return loaded.exports;
}

const curriculum = loadTs('src/telemark/blocksCurriculum.ts');
const challenges = loadTs('src/telemark/blocks/blockChallenges.ts');
const interpreter = loadTs('src/telemark/blocks/blockInterpreter.ts');

assert.equal(curriculum.BLOCKS_UNITS.length, 6);
assert.equal(curriculum.BLOCKS_LESSONS.length, 30);
assert.equal(curriculum.BLOCKS_LESSONS.filter((lesson) => curriculum.isBlocksChallenge(lesson.id)).length, 6);
assert.equal(new Set(curriculum.BLOCKS_LESSONS.map((lesson) => lesson.id)).size, 30);

for (const unit of curriculum.BLOCKS_UNITS) {
  const unitDirectory = path.join(root, 'blocks', unit.slug);
  assert.ok(fs.existsSync(path.join(unitDirectory, '_category_.json')), `${unit.slug} has no category`);
  const overview = fs.readdirSync(unitDirectory).find((file) => file.endsWith('overview.mdx'));
  assert.ok(overview, `${unit.slug} has no overview`);
  assert.match(fs.readFileSync(path.join(unitDirectory, overview), 'utf8'), new RegExp(`unitSlug="${unit.slug}"`));
}

for (const lesson of curriculum.BLOCKS_LESSONS) {
  const directory = path.join(root, 'blocks', lesson.unitSlug);
  const lessonSource = fs.readdirSync(directory)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => fs.readFileSync(path.join(directory, file), 'utf8'))
    .find((source) => source.includes(`lessonId="${lesson.id}"`));
  assert.ok(lessonSource, `${lesson.id} has no MDX lesson with BlockPractice`);
  assert.match(lessonSource, /<BlockPractice/);
  if (!curriculum.isBlocksChallenge(lesson.id)) assert.match(lessonSource, /<MarkComplete/);
  const config = challenges.blockLessonConfig(lesson.id);
  assert.ok(config.objectives.length > 0, `${lesson.id} has no visible objective`);
  assert.deepEqual(config.initialScene, {x: 0, y: 0, direction: 0, moves: 0});
  assert.equal(config.toolboxUnit, Number.parseInt(lesson.unitSlug.slice(-2), 10));
}

const blockMdx = fs.readdirSync(path.join(root, 'blocks'), {recursive: true})
  .filter((name) => name.endsWith('.mdx'))
  .map((name) => fs.readFileSync(path.join(root, 'blocks', name), 'utf8'))
  .join('\n');
assert.doesNotMatch(blockMdx, /—/, 'blocks prose contains an em dash');
assert.doesNotMatch(blockMdx, /!/, 'blocks prose contains an exclamation mark');
assert.match(blockMdx, /Code\.org/);
assert.match(blockMdx, /Scratch/);
assert.match(blockMdx, /Blockly/);

const passingResults = [
  {output: ['done'], variables: {}, scene: {x: 2, y: 1, moves: 3, direction: 1}, error: null, executedBlockTypes: []},
  {output: ['12'], variables: {score: 12}, scene: {}, error: null, executedBlockTypes: ['variables_set', 'math_change']},
  {output: ['accept'], variables: {}, scene: {}, error: null, executedBlockTypes: ['controls_if', 'logic_compare']},
  {output: [], variables: {}, scene: {x: 4, y: 4, moves: 8}, error: null, executedBlockTypes: ['controls_repeat_ext']},
  {output: ['1', '2', '3'], variables: {items: [1, 2, 3]}, scene: {}, error: null, executedBlockTypes: ['telemark_call']},
  {output: ['ready'], variables: {items: [1], count: 6}, scene: {moves: 6}, error: null, executedBlockTypes: ['controls_if', 'controls_repeat_ext', 'telemark_call']},
];

curriculum.BLOCKS_LESSONS.filter((lesson) => curriculum.isBlocksChallenge(lesson.id))
  .forEach((lesson, index) => {
    const config = challenges.blockLessonConfig(lesson.id);
    assert.equal(config.challenge, true);
    assert.ok(config.checks.length >= 3);
    assert.ok(config.checks.every((check) => check.test(passingResults[index])), `${lesson.id} passing fixture failed`);
    assert.ok(config.checks.some((check) => !check.test({
      output: [], variables: {}, scene: {x: 0, y: 0, moves: 0, direction: 0},
      error: null, executedBlockTypes: [], steps: [], operations: 0,
    })), `${lesson.id} has no failing check`);
  });

let nextId = 0;
function block(type, fields = {}, inputs = {}) {
  return {
    id: `test-${nextId += 1}`,
    type,
    fields,
    inputs,
    next: null,
    getFieldValue(name) { return this.fields[name] ?? null; },
    getInputTargetBlock(name) { return this.inputs[name] ?? null; },
    getNextBlock() { return this.next; },
  };
}
function chain(...blocks) {
  blocks.slice(0, -1).forEach((item, index) => { item.next = blocks[index + 1]; });
  return blocks[0];
}
const num = (value) => block('math_number', {NUM: String(value)});
const text = (value) => block('text', {TEXT: value});
const get = (name) => block('variables_get', {VAR: name});
const set = (name, value) => block('variables_set', {VAR: name}, {VALUE: value});
const change = (name, value) => block('math_change', {VAR: name}, {DELTA: num(value)});

const doubleDefinition = block('telemark_function', {NAME: 'double', PARAM: 'value'}, {
  DO: block('telemark_return', {}, {
    VALUE: block('math_arithmetic', {OP: 'MULTIPLY'}, {A: get('value'), B: num(2)}),
  }),
});
const repeated = block('controls_repeat_ext', {}, {TIMES: num(2), DO: change('score', 2)});
const counted = block('controls_for', {VAR: 'i'}, {FROM: num(1), TO: num(2), BY: num(1), DO: change('score', 1)});
const whileLoop = block('controls_whileUntil', {MODE: 'WHILE'}, {
  BOOL: block('logic_compare', {OP: 'LT'}, {A: get('score'), B: num(10)}),
  DO: change('score', 1),
});
const decision = block('controls_if', {}, {
  IF0: block('logic_operation', {OP: 'AND'}, {
    A: block('logic_compare', {OP: 'GTE'}, {A: get('score'), B: num(10)}),
    B: block('logic_negate', {}, {BOOL: block('logic_boolean', {BOOL: 'FALSE'})}),
  }),
  DO0: block('telemark_print', {}, {VALUE: text('accept')}),
});
const list = block('lists_create_with', {}, {ADD0: num(1), ADD1: num(2), ADD2: num(3)});
const each = block('controls_forEach', {VAR: 'item'}, {
  LIST: get('items'),
  DO: block('telemark_print', {}, {VALUE: get('item')}),
});
const start = block('telemark_start');
start.next = chain(
  set('score', num(3)), repeated, counted, whileLoop, decision,
  set('items', list),
  set('length', block('lists_length', {}, {VALUE: get('items')})),
  set('last', block('lists_getIndex', {WHERE: 'FROM_START'}, {VALUE: get('items'), AT: num(3)})),
  set('joined', block('text_join', {}, {ADD0: text('A'), ADD1: get('score')})),
  each,
  set('doubled', block('telemark_call_value', {NAME: 'double'}, {ARG: get('score')})),
  block('telemark_call', {NAME: 'double'}, {ARG: num(1)}),
  block('telemark_move', {}, {STEPS: num(2)}),
  block('telemark_turn_right'),
  block('telemark_move', {}, {STEPS: num(1)}),
);
const workspace = {
  getTopBlocks: () => [doubleDefinition, start],
  getVariableById: (id) => ({name: id}),
};
const result = interpreter.runBlockProgram(workspace);
assert.equal(result.error, null);
assert.deepEqual(result.output, ['accept', '1', '2', '3']);
assert.equal(result.variables.score, 10);
assert.equal(result.variables.length, 3);
assert.equal(result.variables.last, 3);
assert.equal(result.variables.joined, 'A10');
assert.equal(result.variables.doubled, 20);
assert.deepEqual(result.scene, {x: 2, y: 1, direction: 1, moves: 3});
assert.deepEqual(
  result.playback.filter((frame) => frame.kind === 'move').map((frame) => frame.scene),
  [
    {x: 1, y: 0, direction: 0, moves: 1},
    {x: 2, y: 0, direction: 0, moves: 2},
    {x: 2, y: 1, direction: 1, moves: 3},
  ],
  'movement playback should show one grid position per movement step',
);
assert.deepEqual(
  result.playback.filter((frame) => frame.kind === 'turn').map((frame) => frame.scene.direction),
  [1],
  'turn playback should show the new direction',
);
assert.ok(
  result.playback.some((frame) => frame.blockType === 'telemark_print' && frame.output.includes('accept')),
  'print playback should include newly printed output',
);

const forever = block('telemark_start');
forever.next = block('controls_whileUntil', {MODE: 'WHILE'}, {
  BOOL: block('logic_boolean', {BOOL: 'TRUE'}),
  DO: block('telemark_print', {}, {VALUE: text('again')}),
});
const limited = interpreter.runBlockProgram({getTopBlocks: () => [forever]}, {operations: 20});
assert.match(limited.error, /too many steps/i);

const longMove = block('telemark_start');
longMove.next = block('telemark_move', {}, {STEPS: num(5000)});
const limitedMove = interpreter.runBlockProgram({getTopBlocks: () => [longMove]}, {operations: 20});
assert.match(limitedMove.error, /too many steps/i);
assert.ok(limitedMove.playback.length <= 20, 'movement playback must respect the operation limit');

const recurse = block('telemark_function', {NAME: 'recurse', PARAM: 'value'}, {
  DO: block('telemark_call', {NAME: 'recurse'}, {ARG: num(1)}),
});
const recurseStart = block('telemark_start');
recurseStart.next = block('telemark_call', {NAME: 'recurse'}, {ARG: num(1)});
const recursive = interpreter.runBlockProgram({getTopBlocks: () => [recurse, recurseStart]}, {recursion: 4});
assert.match(recursive.error, /too deeply/i);

const practiceSource = fs.readFileSync(path.join(root, 'src/components/blocks/BlockPractice.tsx'), 'utf8');
const robotSceneSource = fs.readFileSync(path.join(root, 'src/components/blocks/BlockRobotScene.tsx'), 'utf8');
assert.doesNotMatch(practiceSource, /window\.(?:alert|confirm|prompt)\s*\(/, 'block practice uses in-page confirmation cards');
for (const requirement of [
  'telemark:blocks:workspace:v1:',
  'ConfirmDialog',
  'Download',
  'Import',
  'requestFullscreen',
  'aria-live="polite"',
  'Keyboard:',
  'BlockRobotScene',
  'PLAYBACK_DELAY_MS',
]) assert.ok(practiceSource.includes(requirement), `BlockPractice is missing ${requirement}`);
for (const requirement of [
  'Robot field',
  'Facing',
  'Position',
  'Moved',
  'aria-label={ariaLabel}',
]) assert.ok(robotSceneSource.includes(requirement), `BlockRobotScene is missing ${requirement}`);

console.log('Blocks curriculum, challenge, interpreter, and workspace checks passed');
