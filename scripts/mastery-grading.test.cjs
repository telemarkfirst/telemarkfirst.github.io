const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const java = require('../static/simulator/telemark-java.js');

const context = {window: {TelemarkJava: java}, document: {currentScript: null}};
vm.runInNewContext(fs.readFileSync('static/simulator/mastery_challenge.js', 'utf8'), context);
const mastery = context.window.TelemarkMasteryChallenge;

const drivetrain = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
public class Drivetrain {
  private DcMotor alpha; private DcMotor beta; private DcMotor gamma; private DcMotor delta;
  public void init(HardwareMap map) {
    alpha = map.get(DcMotor.class, "leftFront");
    beta = map.get(DcMotor.class, "rightFront");
    gamma = map.get(DcMotor.class, "leftBack");
    delta = map.get(DcMotor.class, "rightBack");
  }
  private double clean(double value) { return Math.abs(value) < 0.05 ? 0 : value; }
  public void drive(double forwardValue, double sidewaysValue, double rotationValue) {
    double forwardPower = clean(forwardValue);
    double sidewaysPower = clean(sidewaysValue);
    double rotationPower = clean(rotationValue);
    double scale = Math.max(1, Math.abs(forwardPower) + Math.abs(sidewaysPower) + Math.abs(rotationPower));
    alpha.setPower((forwardPower + sidewaysPower + rotationPower) / scale);
    beta.setPower((forwardPower - sidewaysPower - rotationPower) / scale);
    gamma.setPower((forwardPower - sidewaysPower + rotationPower) / scale);
    delta.setPower((forwardPower + sidewaysPower - rotationPower) / scale);
  }
  public void stop() { alpha.setPower(0); beta.setPower(0); gamma.setPower(0); delta.setPower(0); }
}`;
const teleop = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
@TeleOp(name="Alternative") public class CompetitionTeleOp extends OpMode {
  private final Drivetrain chassis = new Drivetrain();
  public void init() { chassis.init(hardwareMap); }
  public void loop() { chassis.drive(-gamepad1.left_stick_y, gamepad1.left_stick_x, gamepad1.right_stick_x); }
}`;
const unit4Files = [
  {name: 'CompetitionTeleOp.java', source: teleop},
  {name: 'Drivetrain.java', source: drivetrain},
];
const unit4 = java.serializeProject(unit4Files, 'org.firstinspires.ftc.teamcode.CompetitionTeleOp');
assert.ok(mastery.evaluate(4, unit4).every(Boolean), 'different identifiers, helpers, ternaries, and delegation must pass mecanum grading');
assert.ok(mastery.evaluate(4, java.serializeProject([...unit4Files].reverse(), 'org.firstinspires.ftc.teamcode.CompetitionTeleOp')).every(Boolean), 'file ordering must not affect grading');
assert.equal(mastery.evaluate(4, unit4.replace('"leftFront"', '"wrongFront"'))[2], false, 'wrong hardware names fail the behavioral fixture');
assert.equal(mastery.evaluate(4, unit4.replace('chassis.drive(-gamepad1.left_stick_y, gamepad1.left_stick_x, gamepad1.right_stick_x);', '')).every(Boolean), false, 'unused drivetrain code cannot complete the stage');
assert.ok(!mastery.evaluate(4, '/*' + unit4 + '*/').every(Boolean), 'commented-out code cannot satisfy criteria');
assert.ok(!mastery.evaluate(4, unit4.replace('double scale =', 'double scale = ;')).every(Boolean), 'invalid Java cannot pass grading');

const mechanisms = `package org.firstinspires.ftc.teamcode;
class Intake {
  private DcMotor device; void init(HardwareMap map) { device = map.get(DcMotor.class, "intake"); }
  void collect() { device.setPower(0.8); } void reverse() { device.setPower(-0.8); } void stop() { device.setPower(0); }
}
class Transfer {
  private DcMotor device; void init(HardwareMap map) { device = map.get(DcMotor.class, "transfer"); }
  void forward() { device.setPower(0.7); } void reverse() { device.setPower(-0.7); } void stop() { device.setPower(0); }
}
public class CompetitionTeleOp extends OpMode {
  Intake intake = new Intake(); Transfer transfer = new Transfer();
  public void init() { intake.init(hardwareMap); transfer.init(hardwareMap); }
  public void loop() {
    if (gamepad1.right_bumper) { intake.collect(); transfer.forward(); return; }
    if (gamepad1.left_bumper) { intake.reverse(); transfer.reverse(); return; }
    intake.stop(); transfer.stop();
  }
}`;
assert.ok(mastery.evaluate(5, mechanisms).every(Boolean), 'early-return conditionals must pass when behavior is correct');
const switchMechanisms = mechanisms.replace(
  `if (gamepad1.right_bumper) { intake.collect(); transfer.forward(); return; }
    if (gamepad1.left_bumper) { intake.reverse(); transfer.reverse(); return; }
    intake.stop(); transfer.stop();`,
  `int command = gamepad1.right_bumper ? 1 : (gamepad1.left_bumper ? -1 : 0);
    switch (command) {
      case 1: intake.collect(); transfer.forward(); break;
      case -1: intake.reverse(); transfer.reverse(); break;
      default: intake.stop(); transfer.stop();
    }`,
);
assert.ok(mastery.evaluate(5, switchMechanisms).every(Boolean), 'switch-based control flow must pass when behavior is correct');
assert.equal(mastery.evaluate(5, mechanisms.replace('transfer.reverse();', 'transfer.stop();')).at(-1), false, 'incorrect reverse behavior must fail');

const allIds = [];
for (let unit = 2; unit <= 15; unit += 1) {
  for (const criterion of mastery.checksForUnit(unit)) {
    allIds.push(criterion.id);
    assert.ok(criterion.structural && Array.isArray(criterion.structural.patterns));
    assert.ok(Array.isArray(criterion.behavioralFixtures));
    assert.ok(criterion.diagnostic);
  }
}
assert.equal(new Set(allIds).size, allIds.length, 'criterion IDs are stable and globally unique');

console.log('Mastery structural and behavioral grading checks passed.');
