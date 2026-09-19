const assert = require('node:assert/strict');
const java = require('../static/simulator/telemark-java.js');
const {createPageHarness} = require('./unit6-unit7-runtime.test.cjs');

for (const [unit, hardware, gamepad, output] of [
  ['8.1', 'intake', 'gamepad', 'intakePower'],
  ['8.2', 'left_front', 'gamepad', 'commandPower.leftFront'],
  ['8.3', 'lift', 'gamepad', 'currentPower'],
  ['8.4', 'motor1', 'gamepadState', 'motor1Power'],
  ['8.5', 'lift', 'gamepadState', 'currentPower'],
]) {
  const page = createPageHarness(`static/simulator/unit${unit}.html`);
  const files = [
    {name:'Main.java',source:`package robot; import robot.mechanisms.Mechanism;
      public class Main extends OpMode {
        Mechanism mechanism=new Mechanism();
        public void init(){mechanism.init(hardwareMap);}
        public void loop(){mechanism.move(gamepad1.left_stick_y);telemetry.addData("Power",mechanism.power());}
      }`},
    {name:'Mechanism.java',source:`package robot.mechanisms;
      public class Mechanism {
        DcMotor motor; DigitalChannel limit;
        public void init(HardwareMap hw){motor=hw.get(DcMotor.class,"${hardware}");
          motor.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
          motor.setDirection(DcMotor.Direction.REVERSE);
          limit=hw.get(DigitalChannel.class,"limit_upper");}
        public void move(double power){motor.setPower(limit.getState()?power:0);}
        public double power(){return motor.getPower();}
      }`},
  ];
  const editor=page.elements.get('code-editor');
  editor.value=files[1].source; // Running while a helper tab is active must work.
  editor.__telemarkProject={source:()=>java.serializeProject(files)};
  page.evaluate(`${gamepad}.left_stick_y=0.65; handleRun();`);
  assert.equal(page.evaluate('running'),true,`${unit}: ${page.elements.get('telemetry-log').innerHTML}`);
  page.runInterval(page.evaluate('loopInterval'));
  assert.equal(page.evaluate(output),0.65,`${unit}: helper controls simulated hardware`);
  if(unit==='8.2') assert.equal(page.evaluate('motorDirections.leftFront'),'REVERSE');
  if(unit==='8.3') assert.equal(page.evaluate('zeroPowerBehavior'),'BRAKE');
  if(unit==='8.5') {
    page.evaluate('upperLimitPressed=true;');
    page.runInterval(page.evaluate('loopInterval'));
    assert.equal(page.evaluate(output),0,'limit sensor read in an imported helper stops the lift');
  }
  page.evaluate('handleStop();');
  assert.equal(page.evaluate(output),0,`${unit}: Stop zeroes hardware`);
  files[0].source=files[0].source.replace('import robot.mechanisms.Mechanism;','');
  page.context.console={...console,error(){}};
  page.evaluate('handleRun();');
  assert.equal(page.evaluate('running'),false,`${unit}: a missing import cannot start the simulation`);
}
console.log('Legacy Unit 8 multi-file hardware runtime tests passed.');
