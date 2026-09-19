import * as Blockly from 'blockly/core';

export function registerTelemarkBlocks(): void {
  if (Blockly.Blocks.telemark_start) return;
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'telemark_start',
      message0: 'when run starts',
      nextStatement: null,
      colour: 210,
      tooltip: 'The program begins with the first block connected below this one.',
      hat: 'cap',
    },
    {
      type: 'telemark_print',
      message0: 'print %1',
      args0: [{type: 'input_value', name: 'VALUE'}],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'Add a value to the program output.',
    },
    {
      type: 'telemark_move',
      message0: 'move %1 steps',
      args0: [{type: 'input_value', name: 'STEPS', check: 'Number'}],
      previousStatement: null,
      nextStatement: null,
      colour: 35,
      tooltip: 'Move forward in the current direction.',
    },
    {
      type: 'telemark_turn_right',
      message0: 'turn right',
      previousStatement: null,
      nextStatement: null,
      colour: 35,
      tooltip: 'Turn one quarter turn to the right.',
    },
    {
      type: 'telemark_function',
      message0: 'define function %1 with parameter %2',
      args0: [
        {type: 'field_input', name: 'NAME', text: 'calculate'},
        {type: 'field_input', name: 'PARAM', text: 'value'},
      ],
      message1: 'do %1',
      args1: [{type: 'input_statement', name: 'DO'}],
      colour: 285,
      tooltip: 'Define a named function with one parameter.',
      hat: 'cap',
    },
    {
      type: 'telemark_call',
      message0: 'call %1 with %2',
      args0: [
        {type: 'field_input', name: 'NAME', text: 'calculate'},
        {type: 'input_value', name: 'ARG'},
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 285,
      tooltip: 'Call a function and give it one argument.',
    },
    {
      type: 'telemark_call_value',
      message0: 'result from %1 with %2',
      args0: [
        {type: 'field_input', name: 'NAME', text: 'calculate'},
        {type: 'input_value', name: 'ARG'},
      ],
      output: null,
      colour: 285,
      tooltip: 'Call a function and use its returned result.',
    },
    {
      type: 'telemark_return',
      message0: 'return %1',
      args0: [{type: 'input_value', name: 'VALUE'}],
      previousStatement: null,
      colour: 285,
      tooltip: 'Send a result back to the block that called this function.',
    },
  ]);
}

const block = (type: string, extra: Record<string, unknown> = {}) => ({kind: 'block', type, ...extra});

export function toolboxForUnit(unit: number): Blockly.utils.toolbox.ToolboxDefinition {
  const categories: Blockly.utils.toolbox.ToolboxItemInfo[] = [
    {
      kind: 'category',
      name: 'Program',
      colour: '210',
      contents: [
        block('telemark_start'),
        block('telemark_print'),
        block('telemark_move', {inputs: {STEPS: {shadow: {type: 'math_number', fields: {NUM: 1}}}}}),
        block('telemark_turn_right'),
      ],
    },
    {
      kind: 'category',
      name: 'Values',
      colour: '160',
      contents: [block('math_number'), block('text'), block('logic_boolean'), block('math_arithmetic'), block('text_join')],
    },
  ];
  if (unit >= 1) categories.push({kind: 'category', name: 'Variables', colour: '330', custom: 'VARIABLE'});
  if (unit >= 2) categories.push({
    kind: 'category', name: 'Logic', colour: '210', contents: [block('logic_compare'), block('logic_operation'), block('logic_negate'), block('controls_if')],
  });
  if (unit >= 3) categories.push({
    kind: 'category', name: 'Loops', colour: '120', contents: [
      block('controls_repeat_ext', {inputs: {TIMES: {shadow: {type: 'math_number', fields: {NUM: 4}}}}}),
      block('controls_whileUntil'), block('controls_for'), block('controls_forEach'),
    ],
  });
  if (unit >= 4) categories.push(
    {kind: 'category', name: 'Functions', colour: '285', contents: [block('telemark_function'), block('telemark_call'), block('telemark_call_value'), block('telemark_return')]},
    {kind: 'category', name: 'Lists', colour: '260', contents: [block('lists_create_with'), block('lists_getIndex'), block('lists_length')]},
  );
  return {kind: 'categoryToolbox', contents: categories};
}
