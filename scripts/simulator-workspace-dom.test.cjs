const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(repoRoot, 'static/simulator/simulator-workspace.js'),
  'utf8',
);
const baseSource = fs.readFileSync(
  path.join(repoRoot, 'static/simulator/simulator_base.js'),
  'utf8',
);

function widget(window, identifier, title, position, bounds, category = 'hardware') {
  const node = window.document.createElement('div');
  node.id = `source-${identifier}`;
  node.textContent = title;
  window.document.body.appendChild(node);
  return {identifier, title, node, position, bounds, category};
}

function waitForTasks(window) {
  return new Promise((resolve) => window.setTimeout(resolve, 20));
}

function pointer(window, target, type, x, y, pointerId = 1) {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'pointerId', {value: pointerId});
  target.dispatchEvent(event);
  return event;
}

function recordFor(workspace, identifier) {
  return workspace.getLayout().find((entry) => entry.identifier === identifier);
}

function frameFor(window, identifier) {
  return window.document.querySelector(`[data-widget-id="${identifier}"]`);
}

async function testSeparatedLessonSurfaces() {
  const dom = new JSDOM(`<!doctype html><html data-telemark-mode="legacy"><head></head><body>
    <div id="sim-left-panel">
      <div class="sim-panel-header"><h1 id="sim-header-title">Motor power</h1><p id="sim-header-sub">Unit 8.1</p></div>
      <section id="sim-challenge-card">
        <h2 id="sim-challenge-title-text">Set motor power</h2>
        <div class="sim-challenge-body">
          <p class="sim-challenge-desc">Motor practice</p>
          <div id="sim-requirements-list">Set the motor to 75% power.</div>
          <button id="sim-grading-review-button">Review grading</button>
        </div>
      </section>
      <div class="sim-code-wrapper"><textarea id="sim-code-editor">motor.setPower(0.75);</textarea></div>
      <div class="sim-bottom-bar">
        <button id="sim-btn-run">Init</button>
        <div id="sim-ds-state">STOPPED</div>
        <div id="sim-telemetry-log">Ready</div>
      </div>
    </div>
    <div id="sim-right-panel"><div id="lesson-output">Motor</div></div>
    <div id="gamepad-float-card"><div class="gp-instruction">Press B to stop</div></div>
  </body></html>`, {
    url: 'https://telemark.test/simulator/unit8.1.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const {window} = dom;
  let capturedWidgets = null;
  let mounts = 0;
  window.TelemarkSimulatorWorkspace = {
    mount({widgets}) {
      capturedWidgets = widgets;
      mounts += 1;
      const scroll = window.document.createElement('div');
      scroll.id = 'sim-dashboard-scroll';
      const grid = window.document.createElement('section');
      grid.className = 'sim-dashboard-grid';
      scroll.appendChild(grid);
      window.document.body.appendChild(scroll);
      return {scroll, grid};
    },
  };
  window.eval(baseSource);
  await waitForTasks(window);
  const stylesheet = window.document.getElementById('telemark-simulator-workspace-css');
  assert.ok(stylesheet, 'prebuilt simulator must request workspace styles');
  stylesheet.dispatchEvent(new window.Event('load'));
  await waitForTasks(window);
  assert.equal(mounts, 1, 'the prebuilt lesson should mount one workspace');

  const definition = (identifier) => capturedWidgets.find((entry) => entry.identifier === identifier);
  const coding = definition('coding');
  const requirements = definition('requirements');
  const execution = definition('execution');
  assert.ok(coding?.node.querySelector('#sim-code-editor'), 'the code editor must remain in its own panel');
  assert.equal(coding.node.querySelector('#sim-challenge-card'), null, 'requirements must leave the editor panel');
  assert.equal(coding.node.querySelector('#sim-btn-run'), null, 'run controls must leave the editor panel');
  assert.equal(coding.node.querySelector('#sim-telemetry-log'), null, 'telemetry must leave the editor panel');
  assert.ok(requirements?.node.querySelector('#sim-requirements-list'), 'requirements must be an independent panel');
  assert.ok(requirements.node.querySelector('#sim-grading-review-button'), 'grading must stay with requirements');
  assert.equal(requirements.node.querySelector('.gp-instruction')?.textContent, 'Press B to stop',
    'control instructions must sit with requirements instead of covering the gamepad');
  assert.ok(execution?.node.querySelector('#sim-btn-run'), 'run controls must be an independent panel');
  assert.ok(execution.node.querySelector('#sim-telemetry-log'), 'live telemetry must stay with run controls');

  const header = window.document.querySelector('#sim-workspace-lesson-header');
  assert.ok(header, 'the simulator and lesson names need a persistent workspace header');
  assert.match(header.textContent, /Motor power|Unit 8\.1/i);
  assert.equal(header.closest('.sim-dashboard-grid'), null, 'the lesson header must sit outside panel and tab layout');
  assert.equal(coding.node.contains(header), false);
  assert.equal(requirements.node.contains(header), false);
  assert.equal(execution.node.contains(header), false);
  window.close();
}

function testSavedSplitPanelMigration() {
  const oldLayout = [
    {identifier: 'coding', position_x: 0, position_y: 0, width: 14, height: 20, tab_group: null},
    {identifier: 'robot_view', position_x: 14, position_y: 0, width: 10, height: 12, tab_group: null},
    {identifier: 'gamepad', position_x: 14, position_y: 12, width: 10, height: 8, tab_group: null},
  ];
  const defaults = [
    ['coding', 0, 0, 14, 13],
    ['requirements', 0, 13, 14, 7],
    ['execution', 14, 0, 10, 5],
    ['robot_view', 14, 5, 10, 8],
    ['gamepad', 14, 13, 10, 7],
  ];
  const overlaps = (a, b) => a.position_x < b.position_x + b.width
    && a.position_x + a.width > b.position_x
    && a.position_y < b.position_y + b.height
    && a.position_y + a.height > b.position_y;

  function loadSaved(layout) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://telemark.test/simulator/unit8.4.html',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    });
    const {window} = dom;
    window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
    window.eval(source);
    window.localStorage.setItem('telemark:sim-layout:v2:shared', JSON.stringify({version: 2, layout, hidden: []}));
    const definitions = defaults.map(([identifier, x, y, width, height]) => widget(
      window, identifier, identifier,
      {position_x: x, position_y: y, width, height, tab_group: null},
      {minWidth: 5, maxWidth: 24, minHeight: 5, maxHeight: 48},
    ));
    return {dom, workspace: window.TelemarkSimulatorWorkspace.mount({
      root: window.document.body, lessonId: 'saved-layout', widgets: definitions,
    })};
  }

  const oldPreset = loadSaved(oldLayout);
  for (const [identifier, x, y, width, height] of defaults) {
    const record = recordFor(oldPreset.workspace, identifier);
    assert.deepEqual(
      [record.position_x, record.position_y, record.width, record.height],
      [x, y, width, height],
      `the untouched old preset must reveal ${identifier} in the new five-panel arrangement`,
    );
  }
  oldPreset.workspace.destroy();
  oldPreset.dom.window.close();

  const customized = oldLayout.map((record, index) => index === 0
    ? {...record, width: 12, height: 18}
    : index === 1
      ? {...record, position_x: 12, width: 12, height: 11}
      : {...record, position_x: 12, position_y: 11, width: 12, height: 7});
  const customWorkspace = loadSaved(customized);
  for (const saved of customized) {
    const record = recordFor(customWorkspace.workspace, saved.identifier);
    assert.deepEqual(
      [record.position_x, record.position_y, record.width, record.height, record.tab_group],
      [saved.position_x, saved.position_y, saved.width, saved.height, saved.tab_group],
      'the saved custom panel must retain its geometry');
  }
  for (const identifier of ['requirements', 'execution']) {
    const newPanel = recordFor(customWorkspace.workspace, identifier);
    assert.ok(newPanel, `${identifier} must be added to an old custom layout`);
    assert.ok(customized.every((saved) => !overlaps(newPanel, saved)),
      `${identifier} must not cover an existing custom panel`);
  }
  customWorkspace.workspace.destroy();
  customWorkspace.dom.window.close();
}

async function main() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://telemark.test/simulator/unit-test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const {window} = dom;
  window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.Element.prototype.setPointerCapture = function () {};
  window.eval(source);
  window.localStorage.clear();

  const coding = widget(
    window,
    'coding',
    'Coding',
    {position_x: 0, position_y: 0, width: 14, height: 20, tab_group: null},
    {minWidth: 10, maxWidth: 24, minHeight: 10, maxHeight: 36},
    'software',
  );
  const output = widget(
    window,
    'robot_view',
    'Robot view',
    {position_x: 14, position_y: 0, width: 10, height: 12, tab_group: null},
    {minWidth: 8, maxWidth: 24, minHeight: 8, maxHeight: 36},
  );
  const gamepad = widget(
    window,
    'gamepad',
    'Gamepad',
    {position_x: 14, position_y: 12, width: 10, height: 8, tab_group: null},
    {minWidth: 6, maxWidth: 24, minHeight: 6, maxHeight: 32},
  );
  const originalNodes = [coding.node, output.node, gamepad.node];
  const dormantOutput = window.document.createElement('div');
  dormantOutput.id = 'legacy-output-wrapper';
  window.document.body.appendChild(dormantOutput);
  const workspace = window.TelemarkSimulatorWorkspace.mount({
    root: window.document.body,
    lessonId: 'lesson-a',
    collision: 'overlap',
    widgets: [coding, output, gamepad],
    dormantNodes: [dormantOutput],
  });

  assert.equal(workspace.collision, 'overlap', 'panels must be free to overlap');
  assert.equal(window.document.querySelectorAll('.sim-widget').length, 3, 'preset widgets must render immediately');
  assert.equal(window.document.querySelector('.sim-workspace-toolbar'), null, 'the simulator must not show a workspace toolbar');
  assert.equal(window.document.querySelector('[aria-label="Import layout"]'), null, 'the simulator must not expose import controls');
  assert.equal(window.document.querySelector('[aria-label="Export layout"]'), null, 'the simulator must not expose export controls');
  assert.equal(window.document.querySelector('.sim-widget-position'), null, 'tile headers must not repeat grid coordinates');
  assert.equal(dormantOutput.getAttribute('data-sim-workspace-dormant'), 'true', 'bundled legacy output must be dormant while isolated tiles are active');
  assert.equal(dormantOutput.getAttribute('aria-hidden'), 'true');
  assert.equal(dormantOutput.inert, true);

  Object.defineProperty(workspace.grid, 'clientWidth', {configurable: true, value: 1196});
  workspace.grid.getBoundingClientRect = () => ({left: 0, top: 0, width: 1196, height: 712});
  workspace.refreshGridMetrics();
  assert.equal(
    workspace.grid.style.getPropertyValue('--sim-grid-pitch-x'),
    '50.000px',
    'guide dots must use the exact measured horizontal grid pitch',
  );

  assert.equal(workspace.setLayout([
    {identifier: 'coding', position_x: 0, position_y: 0, width: 14, height: 20, tab_group: null},
    {identifier: 'robot_view', position_x: 12, position_y: 0, width: 10, height: 12, tab_group: null},
    {identifier: 'gamepad', position_x: 8, position_y: 40, width: 8, height: 8, tab_group: null},
  ]), true, 'overlapping root panels must be accepted by the public layout API');
  assert.equal(recordFor(workspace, 'robot_view').position_x, 12);

  const codingOnTop = frameFor(window, 'coding');
  const outputUnder = frameFor(window, 'robot_view');
  pointer(window, codingOnTop.querySelector('.sim-widget-content'), 'pointerdown', 50, 50);
  assert.ok(
    Number(codingOnTop.style.zIndex) > Number(outputUnder.style.zIndex),
    'clicking an overlapped panel must bring it above the other panel',
  );
  pointer(window, outputUnder.querySelector('.sim-widget-content'), 'pointerdown', 650, 50);
  assert.ok(
    Number(outputUnder.style.zIndex) > Number(codingOnTop.style.zIndex),
    'clicking the other panel must reverse the visible stacking order',
  );
  const savedStack = JSON.parse(window.localStorage.getItem(workspace.storageKey())).stack;
  assert.ok(
    savedStack.indexOf('robot_view') > savedStack.indexOf('coding'),
    'the panel last brought forward must remain on top after saving',
  );

  for (const [edge, dx, dy, expected] of [
    ['top-left', -50, -36, {position_x: 7, position_y: 39, width: 9, height: 9}],
    ['top-right', 50, -36, {position_x: 8, position_y: 39, width: 9, height: 9}],
    ['bottom-left', -50, 36, {position_x: 7, position_y: 40, width: 9, height: 9}],
    ['bottom-right', 50, 36, {position_x: 8, position_y: 40, width: 9, height: 9}],
  ]) {
    assert.equal(workspace.setLayout([
      {identifier: 'coding', position_x: 0, position_y: 0, width: 14, height: 20, tab_group: null},
      {identifier: 'robot_view', position_x: 12, position_y: 0, width: 10, height: 12, tab_group: null},
      {identifier: 'gamepad', position_x: 8, position_y: 40, width: 8, height: 8, tab_group: null},
    ]), true);
    const frame = frameFor(window, 'gamepad');
    const handle = frame.querySelector(`[data-resize-edge="${edge}"]`);
    assert.ok(handle, `${edge} must expose a drag handle`);
    assert.match(handle.getAttribute('aria-label'), /Resize Gamepad/i, 'corner resize handles need accessible names');
    pointer(window, handle, 'pointerdown', 0, 0);
    pointer(window, window.document, 'pointermove', dx, dy);
    assert.equal(frame.dataset.width, String(expected.width), `${edge} must update width while dragging`);
    assert.equal(frame.dataset.height, String(expected.height), `${edge} must update height while dragging`);
    pointer(window, window.document, 'pointerup', dx, dy);
    const actual = recordFor(workspace, 'gamepad');
    assert.deepEqual(
      {position_x: actual.position_x, position_y: actual.position_y, width: actual.width, height: actual.height},
      expected,
      `${edge} drag must commit the expected size and anchored corner`,
    );
  }
  workspace.resetLayout();

  const gamepadFrame = window.document.querySelector('[data-widget-id="gamepad"]');
  workspace.dragState = {
    kind: 'resize',
    edge: 'bottom',
    identifier: 'gamepad',
    record: workspace.getLayout().find((entry) => entry.identifier === 'gamepad'),
    candidate: workspace.getLayout().find((entry) => entry.identifier === 'gamepad'),
    liveCandidate: workspace.getLayout().find((entry) => entry.identifier === 'gamepad'),
    frame: gamepadFrame,
    grid: workspace.grid,
    gridRect: workspace.grid.getBoundingClientRect(),
    startX: 0,
    startY: 0,
    pitchX: 50,
    pitchY: 36,
    valid: true,
  };
  workspace.onPointerMove({clientX: 0, clientY: 36, preventDefault() {}});
  assert.equal(gamepadFrame.dataset.height, '9', 'a valid resize must update the actual tile before pointer release');
  assert.equal(
    workspace.getLayout().find((entry) => entry.identifier === 'gamepad').height,
    8,
    'live geometry must not persist until the resize is committed',
  );
  workspace.finishPointer({preventDefault() {}}, true);
  assert.equal(
    workspace.getLayout().find((entry) => entry.identifier === 'gamepad').height,
    9,
    'the live resize candidate must commit on pointer release',
  );

  const outputFrame = window.document.querySelector('[data-widget-id="robot_view"]');
  const dragOutputRecord = workspace.getLayout().find((entry) => entry.identifier === 'robot_view');
  workspace.dragState = {
    kind: 'move',
    identifier: 'robot_view',
    pointerId: 7,
    record: dragOutputRecord,
    candidate: dragOutputRecord,
    liveCandidate: dragOutputRecord,
    frame: outputFrame,
    grid: workspace.grid,
    gridRect: workspace.grid.getBoundingClientRect(),
    offset: {x: 0, y: 0},
    valid: true,
  };
  const movedOutsideHeader = new window.MouseEvent('pointermove', {
    bubbles: true, cancelable: true, clientX: 700, clientY: 1080,
  });
  Object.defineProperty(movedOutsideHeader, 'pointerId', {value: 7});
  window.document.dispatchEvent(movedOutsideHeader);
  assert.equal(outputFrame.dataset.positionY, '30', 'a drag must keep moving after pointer capture leaves its header');
  assert.equal(workspace.getLayout().find((entry) => entry.identifier === 'robot_view').position_y, 0);
  const releasedOutsideHeader = new window.MouseEvent('pointerup', {bubbles: true});
  Object.defineProperty(releasedOutsideHeader, 'pointerId', {value: 7});
  window.document.dispatchEvent(releasedOutsideHeader);
  assert.equal(workspace.getLayout().find((entry) => entry.identifier === 'robot_view').position_y, 30,
    'releasing outside the header must commit the live tile position');
  workspace.resetLayout();

  window.dispatchEvent(new window.MessageEvent('message', {
    data: {type: 'telemark:simulator-fullscreen-state', fullscreen: true},
    origin: window.location.origin,
    source: window.parent,
  }));
  assert.equal(
    window.document.documentElement.getAttribute('data-sim-host-fullscreen'),
    'true',
    'the iframe workspace must react to host full-screen transitions',
  );

  const lifecycle = [];
  workspace.registerWidgetLifecycle('robot_view', {
    mount() { lifecycle.push('mount'); },
    resume() { lifecycle.push('resume'); },
    pause() { lifecycle.push('pause'); },
    unmount() { lifecycle.push('unmount'); },
  });
  assert.deepEqual(lifecycle, ['mount', 'resume'], 'late lifecycle registration must mount and resume an active widget');
  workspace.removeWidget('robot_view');
  assert.deepEqual(lifecycle, ['mount', 'resume', 'pause', 'unmount']);
  workspace.addWidget('robot_view');
  assert.deepEqual(lifecycle, ['mount', 'resume', 'pause', 'unmount', 'mount', 'resume']);

  const codingFrame = window.document.querySelector('[data-widget-id="coding"]');
  const codingHeader = codingFrame.querySelector('.sim-widget-header');
  const removeCoding = codingFrame.querySelector('[aria-label="Remove Coding"]');
  const buttonKey = new window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
  removeCoding.dispatchEvent(buttonKey);
  assert.equal(buttonKey.defaultPrevented, false, 'header move mode must not consume a child control key event');
  assert.ok(workspace.getLayout().some((entry) => entry.identifier === 'coding'));

  codingHeader.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
  assert.doesNotThrow(() => {
    codingHeader.dispatchEvent(new window.MouseEvent('pointermove', {bubbles: true, clientX: 50, clientY: 50}));
  }, 'pointer movement during keyboard move mode must not enter resize code');
  codingHeader.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));

  assert.equal(workspace.addWidget('tab_group'), true);
  assert.equal(
    Number(frameFor(window, 'tab_group').style.order),
    workspace.narrowOrder.indexOf('tab_group'),
    'a newly added group must take its mobile position before the first pointer interaction',
  );
  assert.equal(workspace.moveToTab('gamepad'), true);
  let gamepadPane = frameFor(window, 'gamepad').closest('[role="tabpanel"]');
  assert.equal(gamepadPane?.id, 'sim-tab-pane-tab_group-tab-1', 'docking must put the panel into the visible tab');
  assert.equal(gamepadPane.getAttribute('aria-hidden'), 'false');
  assert.equal(workspace.isWidgetActive('gamepad'), true, 'the docked panel must stay active');
  assert.equal(gamepad.node.isConnected, true, 'docking must preserve the actual interactive panel node');
  workspace.addTab('tab_group');
  assert.equal(workspace.moveToTab('coding'), true);
  const savedTabbedLayout = workspace.getLayout();
  assert.ok(savedTabbedLayout.some((entry) => entry.tab_group === 'tab_group/tab-3'), 'custom tab membership must remain in layout state');
  const dockedEditor = recordFor(workspace, 'coding');
  const tabContainer = recordFor(workspace, 'tab_group');
  assert.equal(dockedEditor.position_x, 0, 'the editor must start at the left edge of its tab');
  assert.ok(dockedEditor.width >= 20, 'the editor must use the available tab width');
  assert.ok(dockedEditor.height <= tabContainer.height, 'docking must keep the editor within the tabbed group');
  let codingPane = frameFor(window, 'coding').closest('[role="tabpanel"]');
  assert.equal(codingPane?.id, 'sim-tab-pane-tab_group-tab-3', 'the new tab must receive the selected panel');
  assert.equal(codingPane.getAttribute('aria-hidden'), 'false');
  assert.equal(workspace.isWidgetActive('coding'), true);
  assert.equal(workspace.isWidgetActive('gamepad'), false, 'panels in other tabs must pause while hidden');
  gamepadPane = frameFor(window, 'gamepad').closest('[role="tabpanel"]');
  assert.equal(gamepadPane.getAttribute('aria-hidden'), 'true');
  assert.equal(gamepadPane.inert, true, 'inactive tab content must not receive input');
  assert.equal(gamepad.node.isConnected, true, 'switching tabs must preserve the hidden panel state');
  workspace.resetLayout();
  assert.equal(workspace.setLayout(savedTabbedLayout), true, 'the render loop must restore custom-tab layout data after reset');
  assert.ok(workspace.tabExists('tab_group', 'tab-3'));

  frameFor(window, 'tab_group').querySelector('[data-tab-identifier="tab-1"]').click();
  await waitForTasks(window);
  assert.equal(
    window.document.activeElement?.dataset.tabIdentifier,
    'tab-1',
    'tab activation must restore focus after rerendering',
  );
  gamepadPane = frameFor(window, 'gamepad').closest('[role="tabpanel"]');
  codingPane = frameFor(window, 'coding').closest('[role="tabpanel"]');
  assert.equal(gamepadPane.getAttribute('aria-hidden'), 'false', 'clicking a tab must reveal its docked panel');
  assert.equal(gamepadPane.inert, false);
  assert.equal(codingPane.getAttribute('aria-hidden'), 'true', 'clicking a tab must hide the previous panel');
  assert.equal(workspace.isWidgetActive('gamepad'), true);
  assert.equal(workspace.isWidgetActive('coding'), false);
  frameFor(window, 'tab_group').querySelector('[data-tab-identifier="tab-3"]').click();
  await waitForTasks(window);
  assert.equal(frameFor(window, 'coding').closest('[role="tabpanel"]').getAttribute('aria-hidden'), 'false',
    'switching back must restore the editor panel');
  assert.equal(coding.node.isConnected, true, 'switching tabs must not replace the editor node');

  workspace.removeWidget('tab_group');
  assert.equal(workspace.isWidgetActive('coding'), false, 'removing a tab container must deactivate its children');
  assert.equal(workspace.isWidgetActive('gamepad'), false, 'all removed tab children must be inactive');
  assert.ok(!workspace.getLayout().some((entry) => entry.tab_group), 'tab children must not remain stranded in layout data');
  const paletteLabels = [...window.document.querySelectorAll('.sim-widget-palette-option strong')]
    .map((node) => node.textContent);
  assert.ok(paletteLabels.includes('Coding') && paletteLabels.includes('Gamepad'), 'removed tab children must be restorable');

  workspace.addWidget('coding');
  workspace.addWidget('gamepad');
  const beforeReorder = workspace.getLayout();
  const beforeNarrowOrder = workspace.narrowOrder.slice();
  assert.equal(workspace.reorderNarrow('gamepad', -1), true);
  const reordered = workspace.getLayout();
  const validation = window.TelemarkSimulatorWorkspace.helpers.validateLayout(
    reordered,
    workspace.registry,
    {maxRows: workspace.maxRows, tabExists: workspace.tabExists.bind(workspace)},
  );
  assert.equal(validation.ok, true, 'narrow reorder must preserve a valid desktop grid');
  assert.ok(
    reordered.some((entry) => entry.position_x > 0),
    'narrow reorder must not collapse every desktop panel into column zero',
  );
  assert.deepEqual(reordered, beforeReorder, 'narrow reorder must preserve desktop panel geometry');
  assert.notDeepEqual(workspace.narrowOrder, beforeNarrowOrder, 'narrow reorder must change mobile panel order');
  assert.equal(
    Number(frameFor(window, 'gamepad').style.order),
    workspace.narrowOrder.indexOf('gamepad'),
    'the visible narrow layout must follow the saved mobile order',
  );

  const sensorNode = window.document.createElement('div');
  sensorNode.id = 'source-sensor';
  window.document.body.appendChild(sensorNode);
  workspace.registerWidget({
    identifier: 'sensor',
    title: 'Sensor',
    node: sensorNode,
    position: {position_x: 0, position_y: 0, width: 6, height: 6, tab_group: null},
    bounds: {minWidth: 4, maxWidth: 12, minHeight: 4, maxHeight: 12},
  });
  assert.ok(window.document.querySelector('[data-widget-id="sensor"]'), 'late widget registration must render immediately');

  const persistedBeforeLateTool = JSON.parse(window.localStorage.getItem(workspace.storageKey()));
  persistedBeforeLateTool.layout.push({
    identifier: 'logic_visualizer',
    position_x: 0,
    position_y: 40,
    width: 8,
    height: 7,
    tab_group: null,
  });
  persistedBeforeLateTool.hidden.push('logic_visualizer');
  window.localStorage.setItem(workspace.storageKey(), JSON.stringify(persistedBeforeLateTool));
  const logicNode = window.document.createElement('div');
  window.document.body.appendChild(logicNode);
  workspace.registerWidget({
    identifier: 'logic_visualizer',
    title: 'Logic Visualizer',
    node: logicNode,
    position: {position_x: 0, position_y: 20, width: 8, height: 7, tab_group: null},
    bounds: {minWidth: 6, maxWidth: 24, minHeight: 6, maxHeight: 20},
  });
  assert.equal(window.document.querySelector('[data-widget-id="logic_visualizer"]'), null, 'late registration must preserve a saved hidden state');
  assert.equal(workspace.addWidget('logic_visualizer'), true, 'a hidden late lesson tile must remain available from Add panel');
  const restoredLogic = workspace.getLayout().find((entry) => entry.identifier === 'logic_visualizer');
  assert.deepEqual(
    {position_x: restoredLogic.position_x, position_y: restoredLogic.position_y, width: restoredLogic.width, height: restoredLogic.height},
    {position_x: 0, position_y: 40, width: 8, height: 7},
    'restoring a late lesson tile must use its saved geometry instead of its default',
  );

  assert.equal(workspace.setLayout([
    {identifier: 'coding', position_x: 0, position_y: 0, width: 12, height: 20, tab_group: null},
    {identifier: 'robot_view', position_x: 12, position_y: 0, width: 12, height: 12, tab_group: null},
    {identifier: 'gamepad', position_x: 12, position_y: 12, width: 12, height: 8, tab_group: null},
  ]), true, 'shared layout fixture must be valid');
  workspace.removeWidget('gamepad');

  const sharedKey = workspace.storageKey();
  assert.equal(sharedKey, 'telemark:sim-layout:v2:shared', 'all simulator lessons must use one shared storage key');
  const persisted = JSON.parse(window.localStorage.getItem(sharedKey));
  assert.deepEqual(persisted.grid, {columns: 24, row_height: 32, gap: 4});
  assert.ok(persisted.hidden.includes('gamepad'), 'removing a tile must persist its hidden state across lessons');

  workspace.destroy();
  const restored = [...window.document.body.children].filter((node) => originalNodes.includes(node));
  assert.deepEqual(restored, originalNodes, 'destroy must restore original sibling order');
  assert.deepEqual(lifecycle.slice(-2), ['pause', 'unmount'], 'destroy must pause and unmount live resources');
  assert.equal(dormantOutput.hasAttribute('data-sim-workspace-dormant'), false, 'destroy must reactivate the legacy output wrapper');
  assert.equal(dormantOutput.hasAttribute('aria-hidden'), false);
  assert.equal(dormantOutput.inert, false);

  const codingB = widget(
    window,
    'coding',
    'Coding',
    {position_x: 0, position_y: 0, width: 14, height: 20, tab_group: null},
    {minWidth: 10, maxWidth: 24, minHeight: 10, maxHeight: 36},
    'software',
  );
  const outputB = widget(
    window,
    'lesson_output',
    'Lesson output',
    {position_x: 14, position_y: 0, width: 10, height: 12, tab_group: null},
    {minWidth: 8, maxWidth: 24, minHeight: 8, maxHeight: 36},
  );
  const gamepadB = widget(
    window,
    'gamepad',
    'Gamepad',
    {position_x: 14, position_y: 12, width: 10, height: 8, tab_group: null},
    {minWidth: 6, maxWidth: 24, minHeight: 6, maxHeight: 32},
  );
  const workspaceB = window.TelemarkSimulatorWorkspace.mount({
    root: window.document.body,
    lessonId: 'lesson-without-three-view',
    widgets: [codingB, outputB, gamepadB],
  });
  const outputRecord = workspaceB.getLayout().find((entry) => entry.identifier === 'lesson_output');
  assert.deepEqual(
    outputRecord && {
      position_x: outputRecord.position_x,
      position_y: outputRecord.position_y,
      width: outputRecord.width,
      height: outputRecord.height,
    },
    {position_x: 12, position_y: 0, width: 12, height: 12},
    'lesson_output must inherit the shared robot_view slot geometry',
  );
  assert.ok(!workspaceB.getLayout().some((entry) => entry.identifier === 'gamepad'), 'hidden widgets must stay hidden in another simulator');

  const externallyUpdated = JSON.parse(window.localStorage.getItem(sharedKey));
  const sharedOutput = externallyUpdated.layout.find((entry) => entry.identifier === 'robot_view');
  sharedOutput.position_x = 0;
  sharedOutput.position_y = 20;
  window.localStorage.setItem(sharedKey, JSON.stringify(externallyUpdated));
  window.dispatchEvent(new window.StorageEvent('storage', {
    key: sharedKey,
    newValue: JSON.stringify(externallyUpdated),
    storageArea: window.localStorage,
    url: window.location.href,
  }));
  const liveOutput = workspaceB.getLayout().find((entry) => entry.identifier === 'lesson_output');
  assert.equal(liveOutput.position_x, 0, 'storage events must live-update another simulator horizontal position');
  assert.equal(liveOutput.position_y, 20, 'storage events must live-update another simulator vertical position');

  assert.equal(workspaceB.addWidget('gamepad'), true, 'a hidden shared widget must remain restorable from Add panel');
  const restoredEnvelope = JSON.parse(window.localStorage.getItem(sharedKey));
  assert.ok(!restoredEnvelope.hidden.includes('gamepad'), 'restoring a widget must clear its shared hidden state');
  workspaceB.destroy();
  dom.window.close();
  await testSeparatedLessonSurfaces();
  testSavedSplitPanelMigration();
  console.log('Simulator workspace DOM regressions passed: overlap, stacking, four-corner resize, full-screen reflow, interactive tabs, shared persistence, storage sync, hidden widgets, and teardown.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
