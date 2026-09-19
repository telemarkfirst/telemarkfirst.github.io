const assert = require('node:assert/strict');
const TelemarkJava = require('../static/simulator/telemark-java.js');

function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

function advance(target, seconds, step = 0.05) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining);
    target.tick(dt);
    remaining -= dt;
  }
}

function testBatteryTimelineAndSag() {
  const battery = TelemarkJava.createBatteryModel();
  battery.start();
  advance(battery, 60);
  near(battery.snapshot().openCircuitVoltage, 12, 1e-9, 'open-circuit voltage at 60 active seconds');
  advance(battery, 60);
  near(battery.snapshot().openCircuitVoltage, 11, 1e-9, 'open-circuit voltage at 120 active seconds');
  battery.stop();
  battery.tick(0.05, Array.from({length: 4}, () => ({mode: 'power', requestedPower: 1, demand: 1})));
  near(battery.snapshot().terminalVoltage, 10.5, 1e-9, 'terminal voltage respects the lower clamp');

  advance(battery, 20);
  near(battery.snapshot().activeSeconds, 120, 1e-9, 'stopped battery time must remain frozen');
  battery.reset();
  near(battery.snapshot().terminalVoltage, 13, 1e-9, 'initialization resets the battery');

  battery.start();
  battery.tick(0.05, Array.from({length: 4}, () => ({mode: 'power', requestedPower: 1, demand: 1})));
  near(battery.snapshot().sagVoltage, 0.55, 1e-9, 'four full-demand motors produce maximum sag');
  battery.tick(0.05, []);
  near(battery.snapshot().sagVoltage, 0, 1e-9, 'load sag recovers when demand disappears');
}

function testOpenLoopAndVelocityControl() {
  const openLoop = TelemarkJava.createRuntime();
  const motor = openLoop.hardwareMap.get('DcMotorEx', 'flywheel');
  motor.setPower(0.8);
  openLoop.start();
  openLoop.tick(0.05);
  assert.ok(motor.getVelocity() > 0 && motor.getVelocity() < 2000, 'motor velocity accelerates instead of changing instantly');
  advance(openLoop, 2);
  const freshVelocity = motor.getVelocity();
  advance(openLoop, 118);
  const depletedVelocity = motor.getVelocity();
  assert.ok(depletedVelocity < freshVelocity * 0.9, 'fixed setPower loses more than 10% speed as voltage falls');
  assert.equal(motor.getPower(), 0.8, 'getPower retains the requested open-loop command');
  assert.equal(motor._state.controlMode, 'power');
  assert.notEqual(motor._state.measuredVelocity, motor._state.requestedPower, 'requested power and measured velocity remain separate');

  const closedLoop = TelemarkJava.createRuntime();
  const flywheel = closedLoop.hardwareMap.get('DcMotorEx', 'flywheel');
  flywheel.setVelocityPIDFCoefficients(12, 0.8, 0.1, 0.0042);
  assert.deepEqual(flywheel.getVelocityPIDFCoefficients(), {p: 12, i: 0.8, d: 0.1, f: 0.0042});
  flywheel.setVelocity(1800);
  closedLoop.start();
  advance(closedLoop, 2);
  near(flywheel.getVelocity(), 1800, 1, 'fresh-battery velocity target');
  advance(closedLoop, 118);
  near(flywheel.getVelocity(), 1800, 1, 'velocity control compensates for battery drain');
  assert.equal(flywheel.getPower(), 0, 'velocity commands do not overwrite requested open-loop power');

  flywheel.setVelocity(3200);
  advance(closedLoop, 2);
  const available = 2800 * closedLoop.getBatteryState().terminalVoltage / 12;
  near(Math.abs(flywheel.getVelocity()), available, 1, 'velocity control saturates at available voltage');
}

function testWarningThresholdAndDeduplication() {
  let warnings = 0;
  const runtime = TelemarkJava.createRuntime({onBatteryWarning() { warnings += 1; }});
  runtime.hardwareMap.get('DcMotorEx', 'flywheel').setPower(0.75);
  runtime.start();
  advance(runtime, 56);
  assert.equal(warnings, 0, 'warning requires three continuous seconds of sufficient speed loss');
  advance(runtime, 3.3);
  assert.equal(warnings, 1, 'open-loop battery warning appears after the threshold');
  advance(runtime, 30);
  assert.equal(warnings, 1, 'warning appears only once per run');
  runtime.stop();
  const stoppedAt = runtime.getBatteryState().activeSeconds;
  advance(runtime, 10);
  near(runtime.getBatteryState().activeSeconds, stoppedAt, 1e-9, 'runtime stop pauses battery drain');
  runtime.resetBattery();
  assert.equal(runtime.getBatteryState().warningShown, false, 'reinitialization resets warning deduplication');
}

testBatteryTimelineAndSag();
testOpenLoopAndVelocityControl();
testWarningThresholdAndDeduplication();
console.log('Motor velocity and virtual battery physics checks passed.');
