const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const repoRoot = path.resolve(__dirname, '..');
const runtimeFile = path.join(repoRoot, 'static/simulator/simulator-workspace.js');
const source = fs.readFileSync(runtimeFile, 'utf8');
const workspaceCss = fs.readFileSync(
  path.join(repoRoot, 'static/simulator/simulator-workspace.css'),
  'utf8',
);
const simulatorBaseSource = fs.readFileSync(
  path.join(repoRoot, 'static/simulator/simulator_base.js'),
  'utf8',
);
const gamepadArtwork = fs.readFileSync(
  path.join(repoRoot, 'static/simulator/gamepad-controller-original.jpg'),
);
const simulatorHtmlSource = fs.readdirSync(path.join(repoRoot, 'static/simulator'))
  .filter((name) => name.endsWith('.html'))
  .map((name) => fs.readFileSync(path.join(repoRoot, 'static/simulator', name), 'utf8'))
  .join('\n');
const context = vm.createContext({
  console,
  globalThis: null,
  setTimeout,
  clearTimeout,
});
context.globalThis = context;
vm.runInContext(source, context, {filename: runtimeFile});

const api = context.TelemarkSimulatorWorkspace;
assert.ok(api && Object.isFrozen(api), 'workspace runtime must expose a frozen API');
const helpers = api.helpers;
assert.equal(helpers.columns, 24, 'workspace must expose the finer 24-column matrix');
assert.equal(helpers.rowHeight, 32, 'workspace must use locked 32px grid rows');
assert.equal(helpers.gap, 4, 'workspace must use a 4px cell gap');

const registry = {
  coding: {bounds: {minWidth: 10, maxWidth: 24, minHeight: 10, maxHeight: 36}},
  robot_view: {bounds: {minWidth: 8, maxWidth: 24, minHeight: 8, maxHeight: 36}},
  gamepad: {bounds: {minWidth: 6, maxWidth: 24, minHeight: 6, maxHeight: 32}},
  tab_group: {kind: 'tabs', bounds: {minWidth: 8, maxWidth: 24, minHeight: 8, maxHeight: 48}},
};

function record(identifier, position_x, position_y, width, height, tab_group = null) {
  return {identifier, position_x, position_y, width, height, tab_group};
}

const preset = [
  record('coding', 0, 0, 14, 20),
  record('robot_view', 14, 0, 10, 12),
  record('gamepad', 14, 12, 10, 8),
];
let result = helpers.validateLayout(preset, registry, {maxRows: 96});
assert.equal(result.ok, true, 'preset panels must form a valid layout');
assert.deepEqual(
  Object.keys(result.records[0]).sort(),
  ['height', 'identifier', 'position_x', 'position_y', 'tab_group', 'width'],
  'export records must contain exactly the documented six fields',
);

result = helpers.validateLayout([{...preset[0], surprise: true}], registry, {maxRows: 96});
assert.equal(result.ok, false, 'imports with undocumented fields must be rejected atomically');
assert.match(result.error, /exactly the six documented fields/);

assert.equal(
  helpers.validateLayout([record('unknown', 0, 0, 10, 10)], registry).ok,
  false,
  'unknown widget identifiers must be rejected',
);
assert.equal(
  helpers.validateLayout([record('coding', 0, 0, 8, 10)], registry).ok,
  false,
  'widget minimum dimensions must be enforced',
);
assert.equal(
  helpers.validateLayout([record('coding', 16, 0, 10, 10)], registry).ok,
  false,
  'widgets may not extend beyond column 24',
);
assert.equal(
  helpers.validateLayout([
    record('coding', 0, 0, 14, 20),
    record('robot_view', 12, 0, 10, 12),
  ], registry).ok,
  true,
  'panels in the same workspace must be allowed to overlap',
);

result = helpers.validateLayout([
  record('tab_group', 0, 0, 14, 16),
  record('coding', 0, 0, 14, 16, 'tab_group/tab-1'),
  record('robot_view', 2, 1, 10, 12, 'tab_group/tab-1'),
  record('gamepad', 14, 0, 10, 8, 'tab_group/tab-1'),
], registry, {
  maxRows: 96,
  tabExists(group, tab) { return group === 'tab_group' && ['tab-1', 'tab-2'].includes(tab); },
});
assert.equal(result.ok, true, 'tab children must also be allowed to overlap');

const slot = helpers.firstOpenSlot(preset, 8, 6, null, 96);
assert.deepEqual(
  JSON.parse(JSON.stringify(slot)),
  record('__candidate__', 0, 20, 8, 6),
  'restored widgets must use the first complete unoccupied grid slot',
);
const point = helpers.pointToCell(
  {left: 100, top: 50, width: 1196},
  100 + 3 * 50 + 17,
  50 + 2 * 36 + 9,
  {x: 17, y: 9},
  96,
);
assert.equal(point.x, 3, 'raw horizontal pointer pixels must snap to an integer column');
assert.equal(point.y, 2, 'raw vertical pointer pixels must snap to an integer row');
assert.equal(point.pitchY, 36, 'vertical movement must step on the finer 36px row pitch');

assert.match(source, /telemark:sim-layout:v2:shared/, 'every simulator must use one shared v2 layout key');
assert.match(source, /robot_view"\s*\|\|\s*value\s*===\s*"lesson_output"/, '3D and non-3D output tiles must share one persistence slot');
assert.match(source, /grid:\s*\{columns:\s*COLUMNS,\s*row_height:\s*ROW_HEIGHT,\s*gap:\s*GAP\}/, 'saved layouts must describe the fine grid contract');
assert.match(source, /global\.addEventListener\("storage",\s*this\.storageHandler\)/, 'open simulators must subscribe to shared layout updates');
assert.match(source, /telemark:widget-visibility/, 'hidden tab resources need visibility notifications');
assert.match(source, /isWidgetActive[\s\S]*activeTabs\.get/, 'hidden tab resources need active-tab lifecycle checks');
assert.match(source, /--sim-grid-pitch-x/, 'grid guide spacing must derive from the measured 24-column pitch');
assert.match(source, /telemark:simulator-fullscreen-state/, 'the workspace must reflow when its host enters full screen');
assert.match(source, /applyRecordStyle\(state\.frame, candidate\)/, 'valid pointer movement must update tile geometry live');
assert.doesNotMatch(source, /sim-workspace-toolbar|sim-layout-import|sim-layout-export/, 'the workspace must not render toolbar or import/export controls');
assert.doesNotMatch(source, /sim-widget-position/, 'tile headers must not repeat raw layout coordinates');
assert.doesNotMatch(simulatorBaseSource, /id:\s*["']sim-badge-strip["']/, 'the shared base must not render hardware badges');
assert.match(simulatorBaseSource, /window\.setBadges\s*=\s*function\s*\(\)\s*\{\}/, 'legacy badge calls must remain harmless compatibility no-ops');
assert.match(simulatorBaseSource, /identifier:\s*"robot_view"[\s\S]{0,120}title:\s*"3D view"/, 'mechanism tiles must use the concise 3D view title');
assert.match(simulatorBaseSource, /title:\s*"Gamepad"/, 'the controller tile must use the concise gamepad title');
assert.match(simulatorBaseSource, /SCENE_ONLY_LESSONS[\s\S]*"8\.1"[\s\S]*"11\.2"/, 'beginner mechanism lessons must opt into distilled scene-only output');
assert.match(simulatorBaseSource, /identifier:\s*"logic_flow"[\s\S]{0,100}title:\s*"Logic Flow Visualizer"/, 'the logic visualizer must be an independent lesson tile');
assert.match(simulatorBaseSource, /identifier:\s*"pedro_visualizer"[\s\S]{0,100}title:\s*"Pedro Pathing Visualizer"/, 'the Pedro visualizer must be an independent lesson tile');
assert.match(simulatorBaseSource, /collectIndependentWorkspaceWidgets\(output\)/, 'lesson surfaces must be collected separately from the 3D scene');
assert.match(simulatorBaseSource, /node:\s*sceneHost/, 'the 3D tile must mount the isolated scene surface instead of the whole output wrapper');
assert.match(simulatorBaseSource, /dormantNodes:\s*hasThreeView/, 'the obsolete bundled output wrapper must remain hidden but connected for compatibility');
assert.match(
  simulatorBaseSource,
  /window\.onSimulatorReady\(\);[\s\S]{0,900}mountSimulatorWorkspace\(\);/,
  'generated lesson surfaces must be created before the workspace scans them',
);
assert.match(workspaceCss, /\[data-sim-scene-only="true"\]\s*>\s*:not\(\[data-sim-scene-core="true"\]\)[\s\S]{0,80}display:\s*none\s*!important/, 'scene-only lessons must keep diagnostic DOM alive but out of the 3D tile');
assert.match(simulatorBaseSource, /output\.querySelector\("#sim-scene-container"\)[\s\S]{0,180}\|\| output\.querySelector\("#scene-container"\)/, 'explicit scene containers must be resolved before wrapper elements');
assert.doesNotMatch(
  simulatorBaseSource,
  /#sim-robot-canvas[^\n]*,\s*canvas/,
  'unrelated 2D lesson canvases must not be classified as a 3D view',
);
assert.match(
  workspaceCss,
  /\[data-sim-scene-viewport="true"\]\s*>\s*:not\(canvas\):not\(\.sim-cad-unavailable\)[\s\S]{0,80}display:\s*none\s*!important/,
  'distilled scene viewports must hide internal HUD elements without hiding the canvas or CAD errors',
);

assert.match(simulatorBaseSource, /GAMEPAD_ARTWORK\s*=\s*["']gamepad-controller-original\.jpg["']/, 'the shared gamepad must use a local copy of its original artwork');
assert.doesNotMatch(simulatorBaseSource, /resource\.logitechg\.com/, 'the shared base must not depend on remote controller artwork');
assert.doesNotMatch(simulatorHtmlSource, /resource\.logitechg\.com/, 'prebuilt gamepads must not request remote controller artwork before shared normalization runs');
assert.match(simulatorHtmlSource, /src=["']\.\/gamepad-controller-original\.jpg["']/, 'prebuilt gamepads must reuse the original controller photo locally');
assert.match(simulatorBaseSource, /data-telemark-gamepad-artwork/, 'legacy controller images must be normalized before workspace measurement');
assert.equal(gamepadArtwork.subarray(0, 3).toString('hex'), 'ffd8ff', 'the original local controller artwork must remain a JPEG');
assert.equal(
  crypto.createHash('sha256').update(gamepadArtwork).digest('hex'),
  '1d0c25f268e62d325e29e8d563652c1f4863c30265f362d35e9c0aa006d1b0ff',
  'the original Logitech controller artwork must not be redrawn or replaced',
);
assert.match(workspaceCss, /#sim-badge-strip,[\s\S]{0,100}\.badge-strip[\s\S]{0,80}display:\s*none\s*!important/, 'prebuilt badge strips must be hidden throughout tile simulators');
assert.match(workspaceCss, /\.sim-dashboard-grid::before\s*\{[\s\S]{0,420}background-image:\s*radial-gradient/, 'the workspace must expose dot guides on a dedicated pseudo-layer');
assert.match(workspaceCss, /--sim-grid-dot:\s*rgba\([^)]*,\s*0\.(?:5[2-9]|6\d|7\d|8\d|9\d)\)/, 'grid dots must be visibly contrasted against the canvas');
assert.match(workspaceCss, /circle at 1px 1px[\s\S]{0,180}background-position:\s*-1px -1px/, 'dot centers must begin at the exact tile snap origin');
assert.match(workspaceCss, /\.sim-dashboard-grid::before\s*\{[\s\S]{0,120}z-index:\s*0/, 'dot guides must remain beneath all tiles');
assert.match(workspaceCss, /\.sim-widget\s*\{[\s\S]{0,100}z-index:\s*1/, 'opaque tiles must cover the guide layer');
assert.match(workspaceCss, /min-height:\s*calc\(24 \* var\(--sim-grid-row-height\)/, 'the preset must leave open guide rows below its tiles');
assert.match(workspaceCss, /--sim-grid-pitch-y:\s*calc\(var\(--sim-grid-row-height\) \+ var\(--sim-grid-gap\)\)/, 'tiles and guides must share one browser-rounded vertical pitch');
assert.match(workspaceCss, /grid-auto-rows:\s*var\(--sim-grid-pitch-y\)[\s\S]{0,100}row-gap:\s*0/, 'CSS Grid must not round row height and row gap separately');
assert.match(workspaceCss, /\.sim-widget\s*\{[\s\S]{0,500}margin-block-end:\s*var\(--sim-grid-gap\)/, 'tile spans must preserve the visible gutter inside each single-pitch row span');
assert.match(workspaceCss, /\.sim-widget-drop-preview\s*\{[\s\S]{0,260}margin-block-end:\s*var\(--sim-grid-gap\)/, 'drop previews must use the same single-pitch geometry as tiles');
assert.match(
  workspaceCss,
  /background-size:\s*var\(--sim-grid-pitch-x\)\s*var\(--sim-grid-pitch-y\)/,
  'guide dots must repeat at the measured column pitch and exact 36px vertical row pitch',
);
assert.match(
  workspaceCss,
  /\[data-widget-id="gamepad"\][\s\S]{0,240}z-index:\s*auto\s*!important/,
  'legacy floating-gamepad stacking must not cover workspace resize handles',
);

console.log('Simulator workspace contracts passed: fine grid, visible guides, shared persistence, live movement, overlap, bounds, tabs, schema, and snapping.');
