import * as Blockly from 'blockly/core';

const block = (type: string, extra: Record<string, unknown> = {}) => ({kind: 'block', type, ...extra});
const numberShadow = (value: number) => ({shadow: {type: 'math_number', fields: {NUM: value}}});

export function registerFllBlocks(): void {
  if (Blockly.Blocks.fll_start) return;
  Blockly.common.defineBlocksWithJsonArray([
    {type: 'fll_start', message0: 'when mission starts', nextStatement: null, colour: 48, hat: 'cap', tooltip: 'Begin an autonomous mission program.'},
    {type: 'fll_set_speed', message0: 'set movement speed to %1 %%', args0: [{type: 'input_value', name: 'SPEED', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 210},
    {type: 'fll_drive', message0: 'move %1 for %2 cm', args0: [{type: 'field_dropdown', name: 'DIRECTION', options: [['forward', 'FORWARD'], ['backward', 'BACKWARD']]}, {type: 'input_value', name: 'DISTANCE', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 210},
    {type: 'fll_turn', message0: 'turn %1 %2 degrees', args0: [{type: 'field_dropdown', name: 'DIRECTION', options: [['right', 'RIGHT'], ['left', 'LEFT']]}, {type: 'input_value', name: 'ANGLE', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 210},
    {type: 'fll_steer', message0: 'steer %1 for %2 cm', args0: [{type: 'input_value', name: 'STEERING', check: 'Number'}, {type: 'input_value', name: 'DISTANCE', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 210},
    {type: 'fll_stop', message0: 'stop movement', previousStatement: null, nextStatement: null, colour: 210},
    {type: 'fll_attachment', message0: 'move attachment to %1 degrees', args0: [{type: 'input_value', name: 'ANGLE', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 12},
    {type: 'fll_wait_distance', message0: 'move until distance is below %1 cm', args0: [{type: 'input_value', name: 'DISTANCE', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 120},
    {type: 'fll_wait_line', message0: 'move until reflected light is below %1 %%', args0: [{type: 'input_value', name: 'REFLECTION', check: 'Number'}], previousStatement: null, nextStatement: null, colour: 120},
    {type: 'fll_reset_heading', message0: 'reset yaw angle', previousStatement: null, nextStatement: null, colour: 190},
    {type: 'fll_distance_sensor', message0: 'distance sensor cm', output: 'Number', colour: 190},
    {type: 'fll_reflection_sensor', message0: 'reflected light %%', output: 'Number', colour: 190},
    {type: 'fll_heading_sensor', message0: 'yaw angle degrees', output: 'Number', colour: 190},
  ]);
}

export function fllToolboxForUnit(unit: number): Blockly.utils.toolbox.ToolboxDefinition {
  const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = [
    {kind: 'category', name: 'Events', colour: '48', contents: [block('fll_start')]},
    {kind: 'category', name: 'Movement', colour: '210', contents: [
      block('fll_set_speed', {inputs: {SPEED: numberShadow(35)}}),
      block('fll_drive', {inputs: {DISTANCE: numberShadow(40)}}),
      block('fll_turn', {inputs: {ANGLE: numberShadow(90)}}),
      block('fll_steer', {inputs: {STEERING: numberShadow(35), DISTANCE: numberShadow(40)}}),
      block('fll_stop'),
    ]},
    {kind: 'category', name: 'Control', colour: '120', contents: [
      block('controls_repeat_ext', {inputs: {TIMES: numberShadow(2)}}),
      block('controls_whileUntil'), block('controls_if'),
    ]},
    {kind: 'category', name: 'Operators', colour: '230', contents: [
      block('math_number'), block('math_arithmetic'), block('logic_compare'), block('logic_operation'), block('logic_negate'), block('logic_boolean'),
    ]},
    {kind: 'category', name: 'Variables', colour: '330', custom: 'VARIABLE'},
  ];
  if (unit >= 1) contents.splice(2, 0,
    {kind: 'category', name: 'Motors', colour: '12', contents: [block('fll_attachment', {inputs: {ANGLE: numberShadow(70)}})]},
    {kind: 'category', name: 'Sensors', colour: '190', contents: [
      block('fll_distance_sensor'), block('fll_reflection_sensor'), block('fll_heading_sensor'),
      block('fll_wait_distance', {inputs: {DISTANCE: numberShadow(15)}}),
      block('fll_wait_line', {inputs: {REFLECTION: numberShadow(35)}}), block('fll_reset_heading'),
    ]},
  );
  if (unit >= 2) contents.push({kind: 'category', name: 'My Blocks', colour: '285', contents: [
    block('telemark_function'), block('telemark_call'), block('telemark_call_value'), block('telemark_return'),
  ]});
  return {kind: 'categoryToolbox', contents};
}
