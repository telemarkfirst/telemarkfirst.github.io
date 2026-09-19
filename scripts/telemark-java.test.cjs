const assert = require('node:assert/strict');
const TelemarkJava = require('../static/simulator/telemark-java.js');

function compile(source, runtime = {}) {
  const result = TelemarkJava.compile(source, runtime);
  assert.equal(result.ok, true, result.diagnostics?.[0]?.message);
  return result;
}

function testIterativeExecution() {
  const program = compile(`
    public class LifecycleTest extends OpMode {
      int count = 0;
      public void init() { count = 1; }
      public void init_loop() { count++; }
      public void start() { count += 10; }
      public void loop() {
        for (int i = 0; i < 3; i++) {
          if (i > 0) count += i;
        }
      }
      public void stop() { count = -1; }
    }
  `);

  program.methods.init();
  program.methods.init_loop();
  program.methods.start();
  program.methods.loop();
  assert.equal(program.scope.count, 15);
  program.methods.stop();
  assert.equal(program.scope.count, -1);
}

function testArraysAndEnhancedFor() {
  const program = compile(`
    public class ArrayTest extends OpMode {
      int total = 0;
      public void loop() {
        int[] values = new int[3];
        values[0] = 2;
        values[1] = 3;
        values[2] = 4;
        for (int value : values) {
          total += value;
        }
      }
    }
  `);
  program.methods.loop();
  assert.equal(program.scope.total, 9);
}

function testClassesAndInheritance() {
  const program = compile(`
    class Mechanism {
      int power = 0;
      void setPower(int nextPower) { power = nextPower; }
      int getPower() { return power; }
    }
    class Lift extends Mechanism {
      void stop() { power = 0; }
    }
    public class RobotTest extends OpMode {
      Lift lift;
      int measured;
      public void init() {
        lift = new Lift();
        lift.setPower(7);
        measured = lift.getPower();
      }
    }
  `);
  program.methods.init();
  assert.equal(program.scope.measured, 7);
}

function testStructuralMetadata() {
  const ast = TelemarkJava.parse(`
    @TeleOp(name="Metadata")
    public final class MetadataTest extends OpMode {
      private static final String NAME = "motor";
      private DcMotor motor;
      @Override public void init() {
        motor = hardwareMap.get(DcMotor.class, NAME);
        motor.setPower(0.5);
      }
    }
  `);
  const classNode = ast.classes[0];
  assert.deepEqual(classNode.modifiers, ['public', 'final']);
  assert.deepEqual(classNode.annotations, ['TeleOp']);
  assert.equal(classNode.superClass, 'OpMode');
  assert.deepEqual(classNode.fields[0].modifiers, ['private', 'static', 'final']);
  assert.deepEqual(classNode.methods[0].modifiers, ['public']);
  assert.deepEqual(classNode.methods[0].annotations, ['Override']);
  assert.deepEqual(classNode.methods[0].calls.map((call) => [call.qualifier, call.name]), [
    ['hardwareMap', 'get'],
    ['motor', 'setPower'],
  ]);
}

function testEnumsAndSwitch() {
  const program = compile(`
    enum State { READY, RUNNING, DONE }
    public class StateTest extends OpMode {
      State state = State.READY;
      int result = 0;
      public void loop() {
        switch (state) {
          case READY:
            result = 1;
            break;
          default:
            result = 2;
        }
      }
    }
  `);
  program.methods.loop();
  assert.equal(program.scope.result, 1);
}

function testHardwareAndTelemetry() {
  let motorPower = 0;
  const telemetry = [];
  const runtime = TelemarkJava.createRuntime({
    gamepad: {a: true},
    onPower(power) {
      motorPower = power;
    },
    onTelemetry(key, value) {
      telemetry.push([key, value]);
    },
  });
  const program = compile(`
    public class HardwareTest extends OpMode {
      DcMotor motor;
      public void init() {
        motor = hardwareMap.get(DcMotor.class, "lift");
      }
      public void loop() {
        if (gamepad1.a) {
          motor.setPower(0.5);
        } else {
          motor.setPower(0.0);
        }
        telemetry.addData("Power", 0.5);
      }
    }
  `, runtime);
  program.methods.init();
  program.methods.loop();
  assert.equal(motorPower, 0.5);
  assert.deepEqual(telemetry, [['Power', 0.5]]);
}

function testJavaMathHelpers() {
  const program = compile(`
    import java.lang.Math;
    public class MathTest extends OpMode {
      double result;
      public void loop() {
        result = Math.min(Math.abs(-0.75), Math.max(0.2, 0.5));
      }
    }
  `);
  program.methods.loop();
  assert.equal(program.scope.result, 0.5);
}

function testElapsedTimeFieldInitializer() {
  const program = compile(`
    public class TimerTest extends OpMode {
      final ElapsedTime timer = new ElapsedTime();
      double measured = -1;
      public void loop() {
        timer.reset();
        measured = timer.seconds();
      }
    }
  `);
  assert.equal(typeof program.scope.timer.milliseconds, 'function');
  program.methods.loop();
  assert.ok(program.scope.measured >= 0);
}

function testClassFieldInitializersPersistAcrossLoops() {
  const gamepad = {a: false};
  const program = compile(`
    class CurveSettings {
      double exponent = 2.0;
    }
    public class Unit4FieldState extends OpMode {
      boolean prevA;
      double curve = -1;
      double scale = Math.max(0.25, 0.5);
      double scaledCurve = curve * scale;
      CurveSettings settings = new CurveSettings();
      static final Rect zone = new Rect(45, 250, 60, 60);
      DcMotor motor;

      public void loop() {
        if (gamepad1.a && !prevA) {
          curve *= -1;
        }
        prevA = gamepad1.a;
      }
    }
  `, TelemarkJava.createRuntime({gamepad}));

  assert.equal(program.scope.prevA, false, 'uninitialized booleans must use the Java default');
  assert.equal(program.scope.curve, -1, 'signed numeric field initializers must be evaluated');
  assert.equal(program.scope.scale, 0.5, 'Math expressions must work in field initializers');
  assert.equal(program.scope.scaledCurve, -0.5, 'field initializers must run in source order');
  assert.equal(program.scope.settings.exponent, 2, 'supporting classes must be constructible in fields');
  assert.deepEqual(
    {...program.scope.zone},
    {x: 45, y: 250, width: 60, height: 60},
    'SDK value objects must be constructible in field initializers without page globals',
  );
  assert.equal(program.scope.motor, null, 'uninitialized object fields must use the Java default');

  program.methods.loop();
  assert.equal(program.scope.curve, -1);
  gamepad.a = true;
  program.methods.loop();
  assert.equal(program.scope.curve, 1);
  program.methods.loop();
  assert.equal(program.scope.curve, 1, 'holding A must not retrigger the edge toggle');
  gamepad.a = false;
  program.methods.loop();
  gamepad.a = true;
  program.methods.loop();
  assert.equal(program.scope.curve, -1, 'field state must persist across loop calls');
}

function testGeneratedSyntaxDiagnosticUsesStatementLocation() {
  const source = [
    'import com.qualcomm.robotcore.eventloop.opmode.OpMode;',
    'public class LocatedError extends OpMode {',
    '  public void loop() {',
    '    double validPower = 0.0;',
    '    double brokenPower = ;',
    '  }',
    '}',
  ].join('\n');
  const result = TelemarkJava.compile(source);
  const diagnostic = result.diagnostics[0];

  assert.equal(result.ok, false);
  assert.equal(diagnostic.line, 5, 'generated syntax errors must retain the Java source line');
  assert.equal(
    diagnostic.column,
    source.split('\n')[4].indexOf(';') + 1,
    'generated syntax errors must point at the failing Java token',
  );
}

function testMethodLocalVariableTracking() {
  const gamepad = {a: false, left_bumper: false, left_stick_y: -0.8};
  const runtime = TelemarkJava.createRuntime({gamepad});
  const program = TelemarkJava.compile(`
    public class InspectorTest extends OpMode {
      double scaleFactor = 0.5;

      public void loop() {
        boolean buttonState = gamepad1.a;
        double input = -gamepad1.left_stick_y;
        double finalPower;

        if (gamepad1.left_bumper) {
          finalPower = input * scaleFactor;
        } else {
          finalPower = input;
        }
      }
    }
  `, runtime, {trackVariables: true});

  assert.equal(program.ok, true, program.diagnostics?.[0]?.message);
  program.methods.loop();
  assert.deepEqual(
    program.locals,
    {buttonState: false, input: 0.8, finalPower: 0.8},
    'method locals must reflect the branch that actually executed',
  );

  gamepad.a = true;
  gamepad.left_bumper = true;
  program.methods.loop();
  assert.deepEqual(
    program.locals,
    {buttonState: true, input: 0.8, finalPower: 0.4},
    'tracked locals must refresh on every loop call',
  );
}

function testTelemetryFramesAutoClear() {
  const frames = [];
  const clears = [];
  const runtime = TelemarkJava.createRuntime({
    onTelemetryUpdate(frame) {
      frames.push(frame);
    },
    onTelemetryClear(event) {
      clears.push(event);
    },
  });

  runtime.addTelemetry('Loop', 1);
  runtime.updateTelemetry();
  runtime.addTelemetry('Loop', 2);
  runtime.updateTelemetry();

  assert.deepEqual(frames, [
    [{key: 'Loop', value: 1}],
    [{key: 'Loop', value: 2}],
  ]);
  assert.deepEqual(clears, [{automatic: true}, {automatic: true}]);

  runtime.clearTelemetry();
  assert.deepEqual(clears.at(-1), {automatic: false});

  const retainedFrames = [];
  const retained = TelemarkJava.createRuntime({
    autoClearTelemetry: false,
    onTelemetryUpdate(frame) {
      retainedFrames.push(frame);
    },
  });
  retained.addTelemetry('Loop', 1);
  retained.updateTelemetry();
  retained.addTelemetry('Loop', 2);
  retained.updateTelemetry();
  assert.deepEqual(retainedFrames, [
    [{key: 'Loop', value: 1}],
    [{key: 'Loop', value: 1}, {key: 'Loop', value: 2}],
  ]);
}

function testResetRuntimeBindingInEditedStart() {
  let resetCalls = 0;
  const telemetry = [];
  const runtime = TelemarkJava.createRuntime({
    resetRuntime() {
      resetCalls += 1;
    },
    onTelemetry(key, value) {
      telemetry.push([key, value]);
    },
  });
  const program = compile(`
    public class EditedStartTest extends OpMode {
      int startStatements = 0;

      public void start() {
        startStatements++;
        resetRuntime();
        telemetry.addData("Start", "continued");
        startStatements++;
      }
    }
  `, runtime);

  program.methods.start();

  assert.equal(resetCalls, 1, 'student resetRuntime() must call the browser runtime hook');
  assert.equal(
    program.scope.startStatements,
    2,
    'statements after resetRuntime() in an edited start() body must still execute',
  );
  assert.deepEqual(telemetry, [['Start', 'continued']]);
}

async function testLifecycleController() {
  const events = [];
  const lifecycle = TelemarkJava.createLifecycle({
    tickMs: 5,
    runtime: {
      addTelemetry(key) {
        events.push(key);
      },
    },
  });
  const result = lifecycle.init(`
    public class LifecycleOrder extends OpMode {
      public void init() { telemetry.addData("init", 1); }
      public void init_loop() { telemetry.addData("init_loop", 1); }
      public void start() { telemetry.addData("start", 1); }
      public void loop() { telemetry.addData("loop", 1); }
      public void stop() { telemetry.addData("stop", 1); }
    }
  `);
  assert.equal(result.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 12));
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 12));
  lifecycle.stop();
  assert.equal(events[0], 'init');
  assert.ok(events.includes('init_loop'));
  assert.ok(events.indexOf('start') > events.indexOf('init_loop'));
  assert.ok(events.indexOf('loop') > events.indexOf('start'));
  assert.equal(events.at(-1), 'stop');
}

async function testLinearWaitForStart() {
  let releaseStart;
  let active = false;
  const events = [];
  const runtime = TelemarkJava.createRuntime({
    waitForStart: () => new Promise((resolve) => {
      releaseStart = resolve;
    }),
    opModeIsActive: () => active,
    onTelemetry: (key) => events.push(key),
  });
  const program = compile(`
    public class LinearTest extends LinearOpMode {
      public void runOpMode() {
        telemetry.addData("before", 1);
        waitForStart();
        telemetry.addData("after", 1);
      }
    }
  `, runtime);
  const running = program.methods.runOpMode();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(events, ['before']);
  active = true;
  releaseStart();
  await running;
  assert.deepEqual(events, ['before', 'after']);
}

async function testLinearLoopsYieldToRuntime() {
  let busy = true;
  let ticks = 0;
  let mode = null;
  const positions = [];
  const powers = [];
  const motor = {
    setMode(nextMode) {
      mode = nextMode;
    },
    isBusy() {
      return busy;
    },
    getCurrentPosition() {
      return ticks;
    },
    setPower(power) {
      powers.push(power);
    },
  };
  const program = compile(`
    public class CooperativeLoop extends LinearOpMode {
      DcMotorEx slider;
      public void runOpMode() {
        slider = hardwareMap.get(DcMotorEx.class, "slider");
        slider.setMode(DcMotorEx.RunMode.RUN_TO_POSITION);
        waitForStart();
        slider.setPower(0.8);
        while (opModeIsActive() && slider.isBusy()) {
          telemetry.addData("Position", slider.getCurrentPosition());
          telemetry.update();
        }
        slider.setPower(0.0);
      }
    }
  `, {
    hardwareMap: {get: () => motor},
    waitForStart: () => Promise.resolve(),
    opModeIsActive: () => true,
    linearTick: async () => {
      ticks += 1;
      if (ticks === 3) busy = false;
    },
    addTelemetry(_key, value) {
      positions.push(value);
    },
    updateTelemetry() {},
  });

  await program.methods.runOpMode();
  assert.equal(ticks, 3);
  assert.equal(mode, 'RUN_TO_POSITION');
  assert.deepEqual(positions, [1, 2, 3]);
  assert.deepEqual(powers, [0.8, 0]);
}

async function testLinearLoopFallbackYieldsToBrowserTimers() {
  let active = true;
  const program = compile(`
    public class TimerYield extends LinearOpMode {
      public void runOpMode() {
        while (opModeIsActive()) {
        }
      }
    }
  `, {
    opModeIsActive: () => active,
  });

  setTimeout(() => {
    active = false;
  }, 0);
  await program.methods.runOpMode();
  assert.equal(active, false);
}

function testAsyncLoopInstrumentation() {
  const source = `
    for (int i = 0; i < 2; i++) { }
    while (false) { }
    do { } while (false);
  `;
  const asyncBody = TelemarkJava.transpileBody(source, {async: true});
  const synchronousBody = TelemarkJava.transpileBody(source);
  assert.equal((asyncBody.match(/await linearTick\(\)/g) || []).length, 3);
  assert.doesNotMatch(synchronousBody, /await linearTick/);
}

async function testUnbracedLoopsAreInstrumented() {
  let ticks = 0;
  const program = compile(`
    public class UnbracedLoops extends LinearOpMode {
      int visits = 0;
      public void runOpMode() {
        if (visits == 0)
          for (int i = 0; i < 2; i++) visits++;
        while (visits < 4) visits++;
        do visits++; while (visits < 6);
      }
    }
  `, {
    linearTick: async () => {
      ticks += 1;
    },
  });

  await program.methods.runOpMode();
  assert.equal(program.scope.visits, 6);
  assert.equal(ticks, 6);

  const output = TelemarkJava.transpileBody(
    'do telemetry.update(); while (opModeIsActive());',
    {async: true},
  );
  assert.doesNotThrow(
    () => new (Object.getPrototypeOf(async function () {}).constructor)(
      'updateTelemetry',
      'opModeIsActive',
      'linearTick',
      output,
    ),
  );
  assert.equal((output.match(/await linearTick\(\)/g) || []).length, 1);
}

function testDiagnostics() {
  const result = TelemarkJava.compile(`
    public class Broken extends OpMode {
      public void loop() {
        if (true) {
      }
    }
  `);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].line > 0, true);
  assert.equal(result.diagnostics[0].column > 0, true);
}

function testMethodExtractionDistinguishesMissingAndMalformedMethods() {
  const missing = TelemarkJava.findMethod(`
    public class MissingLoop extends OpMode {
      public void init() { }
    }
  `, 'loop');
  assert.equal(missing, null, 'a genuinely missing method must return null');

  assert.throws(
    () => TelemarkJava.findMethod(`
      public class MalformedLoop extends OpMode {
        public void loop() {
          telemetry.addData("Status", "broken");
      }
    `, 'loop'),
    (error) => {
      assert.match(error.message, /Missing closing delimiter|Unexpected/i);
      assert.equal(error.line > 0, true);
      assert.equal(error.column > 0, true);
      return true;
    },
    'malformed method extraction must preserve a visible source diagnostic',
  );
}

function testInfiniteLoopProtection() {
  const program = compile(`
    public class GuardTest extends OpMode {
      public void loop() {
        while (true) {
        }
      }
    }
  `);
  assert.throws(() => program.methods.loop(), /Loop limit exceeded/);
}

function testQualifiedTypesAndArrayInitializers() {
  const qualified = compile(`
    public class QualifiedTypeSyntax extends OpMode {
      public void init() {
        IMU.Parameters parameters = new IMU.Parameters(null);
      }
    }
  `);
  assert.equal(qualified.ok, true);

  const program = compile(`
    public class ModernFtcSyntax extends OpMode {
      DcMotor[] motors;
      public void init() {
        motors = new DcMotor[] {
          hardwareMap.get(DcMotor.class, "left"),
          hardwareMap.get(DcMotor.class, "right")
        };
      }
    }
  `, {
    hardwareMap: {
      get(_type, name) {
        return {name};
      },
    },
  });
  program.methods.init();
  assert.equal(program.scope.motors.length, 2);
}

async function testReinitializationResetsFields() {
  const lifecycle = TelemarkJava.createLifecycle({tickMs: 5});
  const source = `
    public class ResetTest extends OpMode {
      int count = 0;
      public void init() { count++; }
      public void loop() { count++; }
    }
  `;
  const first = lifecycle.init(source);
  assert.equal(first.scope.count, 1);
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 8));
  lifecycle.stop();

  const second = lifecycle.init(source);
  assert.equal(second.scope.count, 1);
  lifecycle.stop();
}

async function testStopInterruptsLinearSleep() {
  const events = [];
  const lifecycle = TelemarkJava.createLifecycle({
    tickMs: 5,
    runtime: {
      addTelemetry(key) {
        events.push(key);
      },
    },
  });
  const result = lifecycle.init(`
    public class SleepTest extends LinearOpMode {
      public void runOpMode() {
        waitForStart();
        telemetry.addData("started", 1);
        sleep(10000);
        if (!isStopRequested()) {
          telemetry.addData("late", 1);
        }
      }
    }
  `);
  assert.equal(result.ok, true);
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  lifecycle.stop();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(events, ['started']);
  assert.equal(lifecycle.phase, 'stopped');
}

async function main() {
  testIterativeExecution();
  testArraysAndEnhancedFor();
  testClassesAndInheritance();
  testStructuralMetadata();
  testEnumsAndSwitch();
  testHardwareAndTelemetry();
  testJavaMathHelpers();
  testElapsedTimeFieldInitializer();
  testClassFieldInitializersPersistAcrossLoops();
  testGeneratedSyntaxDiagnosticUsesStatementLocation();
  testMethodLocalVariableTracking();
  testTelemetryFramesAutoClear();
  testResetRuntimeBindingInEditedStart();
  await testLifecycleController();
  await testLinearWaitForStart();
  await testLinearLoopsYieldToRuntime();
  await testLinearLoopFallbackYieldsToBrowserTimers();
  testAsyncLoopInstrumentation();
  await testUnbracedLoopsAreInstrumented();
  testDiagnostics();
  testMethodExtractionDistinguishesMissingAndMalformedMethods();
  testInfiniteLoopProtection();
  testQualifiedTypesAndArrayInitializers();
  await testReinitializationResetsFields();
  await testStopInterruptsLinearSleep();
  console.log('TelemarkJava tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
