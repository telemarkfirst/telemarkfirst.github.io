/**
 * Shared runtime for the Unit 2-15 comprehensive coding challenges.
 *
 * Each unit owns a small HTML entry point, while this adapter owns the editor,
 * compiler integration, requirement checks, telemetry, and hardware map.
 * simulator_base.js remains the sole owner of the simulator shell and lifecycle.
 */
(function (global) {
  "use strict";

  function shell(imports, annotation, className, parent) {
    const sdkImports = imports.slice();
    if (sdkImports.indexOf("import java.lang.Math;") === -1) {
      sdkImports.push("import java.lang.Math;");
    }
    return sdkImports.join("\n")
      + "\n\n" + annotation
      + "\npublic class " + className + " extends " + parent + " {\n\n}";
  }

  const DECODE_PROJECT_KEY = "telemark:decode-project:v1";
  const TEAM_PACKAGE = "org.firstinspires.ftc.teamcode";
  function decodeSource(body) {
    return "package " + TEAM_PACKAGE + ";\n\n" + body.trim() + "\n";
  }

  const DECODE_FILE_STAGES = Object.freeze([
    {
      unit: 2,
      name: "CompetitionTeleOp.java",
      className: "CompetitionTeleOp",
      methods: ["init", "start", "loop", "stop"],
      source: decodeSource(`
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="DECODE Competition TeleOp")
public class CompetitionTeleOp extends OpMode {
    @Override
    public void init() {
        // Report that the robot is ready.
    }

    @Override
    public void start() {
        // Reset match timing here.
    }

    @Override
    public void loop() {
        // Repeated driver-control code belongs here.
    }

    @Override
    public void stop() {
        // Leave every mechanism safe.
    }
}`)
    },
    {
      unit: 3,
      name: "RobotConfig.java",
      className: "RobotConfig",
      source: decodeSource(`
public final class RobotConfig {
    private RobotConfig() {}

    // Add shared hardware names, powers, deadzones, and mechanism state here.
}`)
    },
    {
      unit: 4,
      name: "Drivetrain.java",
      className: "Drivetrain",
      methods: ["init", "drive", "stop"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Drivetrain {
    // Keep the four drive motors private.

    public void init(HardwareMap hardwareMap) {}

    public void drive(double forward, double strafe, double turn) {}

    public void stop() {}
}`)
    },
    {
      unit: 5,
      name: "Intake.java",
      className: "Intake",
      methods: ["init", "collect", "reverse", "stop"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Intake {
    private DcMotor motor;

    public void init(HardwareMap hardwareMap) {}
    public void collect() {}
    public void reverse() {}
    public void stop() {}
}`)
    },
    {
      unit: 5,
      name: "Transfer.java",
      className: "Transfer",
      methods: ["init", "forward", "reverse", "stop"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Transfer {
    private DcMotor motor;

    public void init(HardwareMap hardwareMap) {}
    public void forward() {}
    public void reverse() {}
    public void stop() {}
}`)
    },
    {
      unit: 7,
      name: "Launcher.java",
      className: "Launcher",
      methods: ["init", "update", "launch", "stop"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Launcher {
    private DcMotor flywheel;

    public void init(HardwareMap hardwareMap) {}
    public void update(double nowSeconds) {}
    public void launch(double nowSeconds) {}
    public void stop() {}
}`)
    },
    {
      unit: 7,
      name: "ArtifactSensors.java",
      className: "ArtifactSensors",
      methods: ["init", "update", "hasCapacity"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.HardwareMap;

public class ArtifactSensors {
    private int storedArtifacts;

    public void init(HardwareMap hardwareMap) {}
    public void update() {}
    public boolean hasCapacity() { return storedArtifacts < 3; }
}`)
    },
    {
      unit: 13,
      name: "PoweredMechanism.java",
      className: "PoweredMechanism",
      methods: ["init", "setPower", "stop"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class PoweredMechanism {
    protected DcMotor motor;

    public void init(HardwareMap hardwareMap, String hardwareName) {}
    public void setPower(double power) {}
    public void stop() {}
}`)
    },
    {
      unit: 13,
      name: "RobotHardware.java",
      className: "RobotHardware",
      methods: ["init", "update", "stopAll"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.HardwareMap;

public class RobotHardware {
    public final Drivetrain drivetrain = new Drivetrain();
    public final Intake intake = new Intake();
    public final Transfer transfer = new Transfer();
    public final Launcher launcher = new Launcher();
    public final ArtifactSensors sensors = new ArtifactSensors();

    public void init(HardwareMap hardwareMap) {}
    public void update(double nowSeconds) {}
    public void stopAll() {}
}`)
    },
    {
      unit: 14,
      name: "Vision.java",
      className: "Vision",
      methods: ["init", "update", "close"],
      source: decodeSource(`
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Vision {
    public void init(HardwareMap hardwareMap) {}
    public void update() {}
    public void close() {}
}`)
    },
    {
      unit: 15,
      name: "FullAutonomous.java",
      className: "FullAutonomous",
      methods: ["runOpMode"],
      source: decodeSource(`
import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

@Autonomous(name="DECODE Full Autonomous")
public class FullAutonomous extends LinearOpMode {
    @Override
    public void runOpMode() {
        // Coordinate vision, localization, paths, and robot subsystems here.
    }
}`)
    }
  ]);

  function publicClassName(source) {
    const match = String(source || "").match(/\bpublic\s+(?:final\s+|abstract\s+)?class\s+(\w+)/)
      || String(source || "").match(/\bclass\s+(\w+)/);
    return match ? match[1] : "Main";
  }

  function decodeScaffold(file) {
    return {
      name: file.name,
      source: file.source
    };
  }

  function decodeProjectOptions(unit, config) {
    const byName = new Map();
    DECODE_FILE_STAGES.filter(function (file) { return file.unit <= unit; }).forEach(function (file) {
      if (!byName.has(file.name)) byName.set(file.name, decodeScaffold(file));
    });
    const stageId = "unit-" + String(unit).padStart(2, "0") + "/mastery-coding-challenge";
    const stageFiles = new Set(config.stageFiles || [config.activeFile]);
    DECODE_FILE_STAGES.filter(function (file) { return file.unit === unit; }).forEach(function (file) { stageFiles.add(file.name); });
    return {
      key: DECODE_PROJECT_KEY,
      initialFiles: Array.from(byName.values()),
      preferredActiveFile: config.activeFile,
      preferredEntry: TEAM_PACKAGE + "." + (config.entryClass || "CompetitionTeleOp"),
      preserveProjectOnReset: true,
      snapshotsOnly: true,
      enableSnapshots: true,
      stage: {id: stageId, title: config.title, files: Array.from(stageFiles)},
      prerequisites: DECODE_FILE_STAGES.filter(function (file) { return file.unit < unit; }).map(function (file) {
        return {file: file.name, className: file.className, methods: file.methods || []};
      })
    };
  }

  const CONFIGS = {
    2: {
      title: "Unit 2 Coding Challenge: Complete OpMode Lifecycle",
      scenario: "Build a competition TeleOp that registers correctly, reports a pre-match health check, resets its clock at Start, updates driver telemetry in every loop, and shuts down cleanly.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;"
      ], "@TeleOp(name=\"Unit_2_Mastery\")", "Unit2Mastery", "OpMode"),
      inputs: ["a"],
      checks: [
        ["Use init() for one-time status setup", /\bvoid\s+init\s*\(\s*\)[\s\S]*?telemetry\s*\.\s*addData\s*\(/],
        ["Use init_loop() for a repeated telemetry health check", /\bvoid\s+init_loop\s*\(\s*\)[\s\S]*?telemetry\s*\.\s*addData\s*\(/],
        ["Create start() and reset the match clock", /\bvoid\s+start\s*\(\s*\)[\s\S]*?resetRuntime\s*\(/],
        ["Create loop() for repeated driver logic", /\bvoid\s+loop\s*\(\s*\)/],
        ["Report runtime and gamepad state through telemetry", /getRuntime\s*\(/, /gamepad1\s*\./, /telemetry\s*\.\s*addData\s*\(/],
        ["Create stop() with a shutdown telemetry message", /\bvoid\s+stop\s*\(\s*\)[\s\S]*?telemetry\s*\.\s*addData\s*\(/]
      ]
    },
    3: {
      title: "Unit 3 Coding Challenge: Robot State Variables",
      scenario: "Build a TeleOp that maps a motor by a String name, uses double power scaling, tracks an enabled boolean, counts completed actions with an int, and reports every value.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;"
      ], "@TeleOp(name=\"Unit_3_Mastery\")", "Unit3Mastery", "OpMode"),
      inputs: ["a", "left_bumper", "left_stick_y"],
      checks: [
        ["Declare and use a String hardware name", /\bString\s+\w+\s*=\s*\"[^\"]+\"/, /hardwareMap\s*\.\s*get\s*\(\s*DcMotor\.class\s*,\s*\w+\s*\)/],
        ["Declare a double scale or power value", /\bdouble\s+\w+\s*=/],
        ["Declare and use a boolean mechanism state", /\bboolean\s+(\w+)\s*=[^;]+;[\s\S]*?(?:if\s*\(\s*\1\s*\)|\1\s*\?)/],
        ["Declare and update an int action counter", /\bint\s+(\w+)\s*=\s*\d+\s*;[\s\S]*?(?:\1\s*(?:\+\+|\+=)|\1\s*=\s*\1\s*\+\s*1)/],
        ["Combine gamepad input with the double scale", /gamepad1\s*\.[a-zA-Z_]+[\s\S]*?[*/+-][\s\S]*?\w+/],
        ["Command the mapped motor with the calculated value", /\.\s*setPower\s*\(\s*\w+\s*\)/],
        ["Report the variables through telemetry", /telemetry\s*\.\s*addData\s*\([^)]*\w+\s*\)/]
      ]
    },
    4: {
      title: "Unit 4 Coding Challenge: Driver-Controlled Drivetrain",
      scenario: "Build an arcade-drive TeleOp with a button-controlled mode, joystick deadzones, trigger-based speed limiting, signed sensitivity shaping, and normalized left/right motor commands.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.util.Range;"
      ], "@TeleOp(name=\"Unit_4_Mastery\")", "Unit4Mastery", "OpMode"),
      inputs: ["a", "left_stick_y", "right_stick_x", "right_trigger"],
      checks: [
        ["Map left and right drive motors in init()", /\bvoid\s+init\s*\(\s*\)[\s\S]*?hardwareMap\s*\.\s*get[\s\S]*?hardwareMap\s*\.\s*get/],
        ["Read forward and turn joystick axes", /gamepad1\s*\.\s*left_stick_y/, /gamepad1\s*\.\s*right_stick_x/],
        ["Apply a joystick deadzone", /Math\s*\.\s*abs\s*\([^)]*\)\s*[<>]=?\s*(?:0?\.\d+|[A-Z][A-Z0-9_]*)/i],
        ["Use a trigger as an analog speed limit", /gamepad1\s*\.\s*(?:left|right)_trigger/],
        ["Create and call a signed sensitivity-curve method", /\bdouble\s+\w+\s*\(\s*double\s+\w+\s*\)[\s\S]*?(?:Math\s*\.\s*(?:signum|copySign)|\w+\s*\*\s*\w+)/],
        ["Toggle a drive mode only on a button press edge", /gamepad1\s*\.\s*[abxy]/, /(?:previous|last|was|old)\w*/i, /(?:gamepad1\s*\.\s*[abxy]\s*&&\s*!\s*\w+|!\s*\w+\s*&&\s*gamepad1\s*\.\s*[abxy])/],
        ["Calculate and clip left/right arcade power", /Range\s*\.\s*clip\s*\(/, /(?:left|right)\w*\s*=\s*[^;]*(?:forward|drive|y)[^;]*[+-][^;]*(?:turn|x)/i],
        ["Send power to both drivetrain motors", /\.\s*setPower\s*\([^)]*\)[\s\S]*?\.\s*setPower\s*\(/],
        ["Report final drive powers through telemetry", /telemetry\s*\.\s*addData\s*\([^)]*(?:power|left|right)/i]
      ]
    },
    5: {
      title: "Unit 5 Coding Challenge: Red Alliance Sample Sorter",
      scenario: "Program a red-alliance intake. Collect a red sample at 0.8 only when it is closer than 10 cm. Eject a blue sample at -0.5 when it is closer than 10 cm. Stop for ties and anything 10 cm away or farther.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.hardware.ColorSensor;",
        "import com.qualcomm.robotcore.hardware.DistanceSensor;",
        "import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;"
      ], "@TeleOp(name=\"Unit_5_Mastery\")", "Unit5Mastery", "OpMode"),
      inputs: [],
      checks: [
        ["Map DcMotor \"intake\"", /hardwareMap\s*\.\s*get\s*\(\s*DcMotor\.class\s*,\s*"intake"\s*\)/],
        ["Map ColorSensor \"intake_color\"", /hardwareMap\s*\.\s*get\s*\(\s*ColorSensor\.class\s*,\s*"intake_color"\s*\)/],
        ["Map DistanceSensor \"intake_distance\"", /hardwareMap\s*\.\s*get\s*\(\s*DistanceSensor\.class\s*,\s*"intake_distance"\s*\)/],
        ["Store one CM distance, red, and blue reading per loop", /\bdouble\s+\w+\s*=\s*\w+\.getDistance\s*\(\s*DistanceUnit\.CM\s*\)/, /\bint\s+\w+\s*=\s*\w+\.red\s*\(\s*\)/, /\bint\s+\w+\s*=\s*\w+\.blue\s*\(\s*\)/],
        ["Use an if / else-if / else decision chain", /\bif\s*\(/, /\belse\s+if\s*\(/, /\belse\b/],
        ["Require distance below 10 cm and compare red with blue", /<\s*10(?:\.0+)?/, /&&/, />/],
        ["Collect red at 0.8 and eject blue at -0.5", /\.\s*setPower\s*\(\s*0\.8(?:0*)?\s*\)/, /\.\s*setPower\s*\(\s*-0\.5(?:0*)?\s*\)/],
        ["Stop explicitly for a tie or out-of-range sample", /\belse\b[\s\S]*?\.\s*setPower\s*\(\s*0(?:\.0+)?\s*\)/],
        ["Report distance, color readings, and sorter state", /telemetry\s*\.\s*addData\s*\([^)]*(?:distance|cm)/i, /telemetry\s*\.\s*addData\s*\([^)]*(?:red|blue|color)/i, /telemetry\s*\.\s*addData\s*\([^)]*state/i]
      ]
    },
    6: {
      title: "Unit 6 Coding Challenge: Non-Blocking Autonomous Loop",
      scenario: "Build a safe LinearOpMode that maps a motor array, initializes it with iteration, and runs simultaneous timed actions without sleep or an unbounded loop.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.Autonomous;",
        "import com.qualcomm.robotcore.hardware.DcMotor;"
      ], "@Autonomous(name=\"Unit_6_Mastery\")", "Unit6Mastery", "LinearOpMode"),
      inputs: [],
      checks: [
        ["Implement runOpMode() and call waitForStart()", /\bvoid\s+runOpMode\s*\(\s*\)/, /waitForStart\s*\(/],
        ["Create and populate a DcMotor array", /DcMotor\s*\[\s*\]\s+\w+/, /hardwareMap\s*\.\s*get\s*\(\s*DcMotor\.class/],
        ["Use a for loop for fixed-count work", /for\s*\(\s*int\s+\w+\s*=/],
        ["Use a for-each loop over the motor array", /for\s*\(\s*DcMotor\s+\w+\s*:\s*\w+\s*\)/],
        ["Guard repeated work with opModeIsActive()", /while\s*\([^)]*opModeIsActive\s*\(\s*\)/],
        ["Create a non-blocking getRuntime() deadline", /\bdouble\s+\w+\s*=\s*getRuntime\s*\(\s*\)\s*\+/, /getRuntime\s*\(\s*\)\s*[<>]=?\s*\w+/],
        ["Keep telemetry updating inside the active loop", /while\s*\([^)]*opModeIsActive[\s\S]*?telemetry\s*\.\s*update\s*\(/],
        ["Stop every motor after the loop", /\.\s*setPower\s*\(\s*0(?:\.0+)?\s*\)/]
      ],
      forbidden: [["Do not block parallel work with sleep()", /\bsleep\s*\(/], ["Do not use while(true)", /while\s*\(\s*true\s*\)/]]
    },
    7: {
      title: "Unit 7 Coding Challenge: Reusable Hardware Subsystem",
      scenario: "Build a TeleOp with centralized configuration names and a reusable mechanism class (in its own Java file or in the same file) that maps a motor, a digital limit, and an analog sensor exactly once.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.hardware.DigitalChannel;",
        "import com.qualcomm.robotcore.hardware.AnalogInput;",
        "import com.qualcomm.robotcore.hardware.HardwareMap;"
      ], "@TeleOp(name=\"Unit_7_Mastery\")", "Unit7Mastery", "OpMode"),
      inputs: ["left_stick_y"],
      checks: [
        ["Centralize hardware names as constants and use them for mapping", /static\s+final\s+String\s+\w+\s*=\s*\"[^\"]+\"/, /\.\s*get\s*\(\s*DcMotor\.class\s*,\s*[A-Z][A-Z0-9_]*\s*\)/],
        ["Create a reusable mechanism class", /class\s+\w*(?:Mechanism|Subsystem|System)\b/],
        ["Give the mechanism an init(HardwareMap) method", /\bvoid\s+init\s*\(\s*HardwareMap\s+\w+\s*\)/],
        ["Map a DcMotor through the supplied HardwareMap", /\w+\s*\.\s*get\s*\(\s*DcMotor\.class\s*,/],
        ["Map a DigitalChannel and set INPUT mode", /\w+\s*\.\s*get\s*\(\s*DigitalChannel\.class\s*,/, /setMode\s*\(\s*DigitalChannel\.Mode\.INPUT\s*\)/],
        ["Map and read an AnalogInput", /\w+\s*\.\s*get\s*\(\s*AnalogInput\.class\s*,/, /getVoltage\s*\(/],
        ["Initialize the mechanism once from OpMode init()", /\bvoid\s+init\s*\(\s*\)[\s\S]*?\.\s*init\s*\(\s*hardwareMap\s*\)/],
        ["Delegate gamepad control to a mechanism method", /\bvoid\s+loop\s*\(\s*\)[\s\S]*?gamepad1\s*\.[\s\S]*?\.\s*\w+\s*\(/],
        ["Stop the motor when the digital limit blocks motion", /getState\s*\(\s*\)/, /setPower\s*\(\s*0(?:\.0+)?\s*\)/]
      ]
    },
    8: {
      title: "Unit 8 Coding Challenge: Team 11115 Limit-Safe Lift",
      scenario: "Control Team 11115 Gluten Free's SKYSTONE double-reverse four-bar with one lift motor and two limits. Correct its direction, select braking, accept proportional driver power, and always stop at a limit.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.hardware.DcMotorSimple;",
        "import com.qualcomm.robotcore.hardware.DigitalChannel;"
      ], "@TeleOp(name=\"Unit_8_Mastery\")", "Unit8Mastery", "OpMode"),
      inputs: ["left_stick_y"],
      checks: [
        ["Map the lift motor and both limit switches", /hardwareMap\s*\.\s*get\s*\(\s*DcMotor\.class\s*,\s*"lift"\s*\)/, /hardwareMap\s*\.\s*get\s*\(\s*DigitalChannel\.class[\s\S]*?hardwareMap\s*\.\s*get\s*\(\s*DigitalChannel\.class/],
        ["Configure both digital channels as inputs", /setMode\s*\(\s*DigitalChannel\.Mode\.INPUT\s*\)[\s\S]*?setMode\s*\(\s*DigitalChannel\.Mode\.INPUT\s*\)/],
        ["Correct the motor direction with REVERSE", /setDirection\s*\([^)]*Direction\.REVERSE\s*\)/],
        ["Select BRAKE zero-power behavior", /setZeroPowerBehavior\s*\(\s*DcMotor\.ZeroPowerBehavior\.BRAKE\s*\)/],
        ["Read proportional joystick power", /gamepad1\s*\.\s*left_stick_y/],
        ["Use upper and lower limit states in direction checks", /getState\s*\(\s*\)[\s\S]*?getState\s*\(\s*\)/, /[<>]\s*0/],
        ["Command motion in both directions", /setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)/],
        ["Stop explicitly when motion is unsafe", /setPower\s*\(\s*0(?:\.0+)?\s*\)/],
        ["Report lift power and both limits through telemetry", /telemetry\s*\.\s*addData\s*\([^)]*(?:power|lift)[^)]*\)[\s\S]*?telemetry\s*\.\s*addData\s*\(/i]
      ]
    },
    9: {
      title: "Unit 9 Coding Challenge: Coordinated Servo Mechanism",
      scenario: "Build a TeleOp for a mirrored dual-servo gripper and CRServo intake, including safe travel ranges, direction correction, discrete positions, and a neutral intake state.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.Servo;",
        "import com.qualcomm.robotcore.hardware.CRServo;"
      ], "@TeleOp(name=\"Unit_9_Mastery\")", "Unit9Mastery", "OpMode"),
      inputs: ["a", "b", "left_bumper", "right_bumper"],
      checks: [
        ["Map two positional servos and one CRServo", /hardwareMap\s*\.\s*get\s*\(\s*Servo\.class[\s\S]*?hardwareMap\s*\.\s*get\s*\(\s*Servo\.class/, /hardwareMap\s*\.\s*get\s*\(\s*CRServo\.class/],
        ["Limit both positional servo ranges", /scaleRange\s*\([^)]*\)[\s\S]*?scaleRange\s*\(/],
        ["Reverse one mirrored servo", /setDirection\s*\(\s*Servo\.Direction\.REVERSE\s*\)/],
        ["Use A and B for separate open and closed positions", /gamepad1\s*\.\s*a[\s\S]*?setPosition\s*\(/, /gamepad1\s*\.\s*b[\s\S]*?setPosition\s*\(/],
        ["Command both gripper servos together", /setPosition\s*\([^)]*\)[\s\S]*?setPosition\s*\(/],
        ["Run the CRServo forward and reverse", /setPower\s*\(\s*(?:1(?:\.0+)?|0\.\d+)\s*\)/, /setPower\s*\(\s*-(?:1(?:\.0+)?|0\.\d+)\s*\)/],
        ["Give the CRServo a neutral zero-power state", /setPower\s*\(\s*0(?:\.0+)?\s*\)/],
        ["Report gripper and intake state through telemetry", /telemetry\s*\.\s*addData\s*\([^)]*(?:grip|servo|intake)/i]
      ]
    },
    10: {
      title: "Unit 10 Coding Challenge: Encoder Distance Autonomous",
      scenario: "Build an autonomous drive that converts distance to encoder ticks, resets encoders, uses RUN_TO_POSITION safely, reports progress, stops, and restores closed-loop velocity mode.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.Autonomous;",
        "import com.qualcomm.robotcore.hardware.DcMotor;"
      ], "@Autonomous(name=\"Unit_10_Mastery\")", "Unit10Mastery", "LinearOpMode"),
      inputs: [],
      checks: [
        ["Declare ticks-per-revolution and wheel-size constants", /static\s+final\s+(?:double|int)\s+\w*(?:TICK|COUNTS)\w*\s*=/i, /static\s+final\s+double\s+\w*(?:WHEEL|DIAMETER|CIRCUMFERENCE)\w*\s*=/i],
        ["Convert a requested distance into target ticks", /Math\s*\.\s*(?:PI|round)/, /(?:tick|count)/i],
        ["Reset the drive encoders", /STOP_AND_RESET_ENCODER/],
        ["Set target positions on the drive motors", /setTargetPosition\s*\(/],
        ["Switch into RUN_TO_POSITION", /RUN_TO_POSITION/],
        ["Guard the motion loop with active and busy checks", /opModeIsActive\s*\(\s*\)/, /isBusy\s*\(\s*\)/],
        ["Read and report current encoder positions", /getCurrentPosition\s*\(/, /telemetry\s*\.\s*addData\s*\(/],
        ["Stop the motors and restore RUN_USING_ENCODER", /setPower\s*\(\s*0(?:\.0+)?\s*\)/, /RUN_USING_ENCODER/]
      ]
    },
    11: {
      title: "Unit 11 Coding Challenge: Safe Red Sample Sorter",
      scenario: "Run the red-alliance intake at 0.8 only for a red sample closer than 10 cm while storage is not full and the arm is between 20 and 160 degrees. Eject a close blue sample at -0.5 under the same safety limits. Stop in every other case.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.hardware.DigitalChannel;",
        "import com.qualcomm.robotcore.hardware.AnalogInput;",
        "import com.qualcomm.robotcore.hardware.ColorSensor;",
        "import com.qualcomm.robotcore.hardware.DistanceSensor;",
        "import com.qualcomm.robotcore.util.Range;",
        "import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;"
      ], "@TeleOp(name=\"Unit_11_Mastery\")", "Unit11Mastery", "OpMode"),
      inputs: [],
      checks: [
        ["Map DcMotor \"intake\"", /hardwareMap\s*\.\s*get\s*\(\s*DcMotor\.class\s*,\s*"intake"\s*\)/],
        ["Map \"storage_full\", \"arm_pot\", \"intake_color\", and \"intake_range\"", /DigitalChannel\.class\s*,\s*"storage_full"/, /AnalogInput\.class\s*,\s*"arm_pot"/, /ColorSensor\.class\s*,\s*"intake_color"/, /DistanceSensor\.class\s*,\s*"intake_range"/],
        ["Configure the active-low storage switch as an input", /DigitalChannel\.Mode\.INPUT/, /!\s*\w+\.getState\s*\(\s*\)/],
        ["Scale 0 to 3.3 V into 0 to 180 degrees", /getVoltage\s*\(/, /Range\s*\.\s*scale\s*\([^;]*0(?:\.0+)?\s*,\s*3\.3\s*,\s*0(?:\.0+)?\s*,\s*180(?:\.0+)?\s*\)/],
        ["Compare red and blue color channels", /\.\s*red\s*\(\s*\)/, /\.\s*blue\s*\(\s*\)/, /[<>]/],
        ["Read distance in centimeters and compare it with 10", /getDistance\s*\(\s*DistanceUnit\.CM\s*\)/, /<\s*10(?:\.0+)?/],
        ["Gate movement with storage, angle, distance, and color conditions", /&&[\s\S]*?&&[\s\S]*?&&/, /(?:20(?:\.0+)?\s*[<=>]|[<=>]\s*20(?:\.0+)?)/, /(?:160(?:\.0+)?\s*[<=>]|[<=>]\s*160(?:\.0+)?)/],
        ["Collect red at 0.8 and eject blue at -0.5", /setPower\s*\(\s*0\.8(?:0*)?\s*\)/, /setPower\s*\(\s*-0\.5(?:0*)?\s*\)/],
        ["Stop the intake in the final fallback", /\belse\b[\s\S]*?setPower\s*\(\s*0(?:\.0+)?\s*\)/],
        ["Report all five readings and the sorter state", /telemetry\s*\.\s*addData\s*\([^)]*\)[\s\S]*?telemetry\s*\.\s*addData\s*\([^)]*\)[\s\S]*?telemetry\s*\.\s*addData\s*\([^)]*\)[\s\S]*?telemetry\s*\.\s*addData\s*\([^)]*\)[\s\S]*?telemetry\s*\.\s*addData\s*\(/]
      ]
    },
    12: {
      title: "Unit 12 Coding Challenge: IMU Field-Centric Drive",
      scenario: "Build field-centric mecanum control that initializes hub orientation, reads yaw, pitch, and roll, resets heading on command, detects tipping, normalizes wheel power, and applies heading correction.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.hardware.rev.RevHubOrientationOnRobot;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.hardware.IMU;",
        "import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;",
        "import org.firstinspires.ftc.robotcore.external.navigation.YawPitchRollAngles;"
      ], "@TeleOp(name=\"Unit_12_Mastery\")", "Unit12Mastery", "OpMode"),
      inputs: ["a", "left_stick_x", "left_stick_y", "right_stick_x"],
      checks: [
        ["Map and initialize the IMU with hub orientation", /hardwareMap\s*\.\s*get\s*\(\s*IMU\.class/, /new\s+RevHubOrientationOnRobot\s*\(/, /\.\s*initialize\s*\(/],
        ["Read YawPitchRollAngles", /getRobotYawPitchRollAngles\s*\(/],
        ["Read yaw, pitch, and roll in AngleUnit", /getYaw\s*\(\s*AngleUnit\./, /getPitch\s*\(\s*AngleUnit\./, /getRoll\s*\(\s*AngleUnit\./],
        ["Reset yaw from a gamepad command", /gamepad1\s*\.[abxy][\s\S]*?resetYaw\s*\(/],
        ["Rotate joystick input with sine and cosine", /Math\s*\.\s*cos\s*\(/, /Math\s*\.\s*sin\s*\(/],
        ["Calculate and normalize four wheel powers", /Math\s*\.\s*max\s*\(/, /setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)[\s\S]*?setPower\s*\(/],
        ["Use pitch or roll to detect a tip condition", /Math\s*\.\s*abs\s*\([^)]*(?:pitch|roll)[^)]*\)\s*[<>]=?/i],
        ["Apply a yaw error correction or heading target", /(?:target|error|correction|heading)[\s\S]*?[*/+-]/i],
        ["Report orientation through telemetry", /telemetry\s*\.\s*addData\s*\([^)]*(?:yaw|pitch|roll|heading)/i]
      ]
    },
    13: {
      title: "Unit 13 Coding Challenge: Modular Robot Architecture",
      scenario: "Complete a six-file TeleOp project with shared configuration, encapsulated intake and lift hardware, inherited behavior, one composed RobotHardware object, and no raw mechanism control in the OpMode.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;",
        "import com.qualcomm.robotcore.hardware.DcMotor;",
        "import com.qualcomm.robotcore.hardware.Servo;",
        "import com.qualcomm.robotcore.hardware.HardwareMap;"
      ], "@TeleOp(name=\"Unit_13_Mastery\")", "Unit13Mastery", "OpMode"),
      starterFiles: [
        {name: "Unit13Mastery.java", source: shell([
          "import com.qualcomm.robotcore.eventloop.opmode.OpMode;",
          "import com.qualcomm.robotcore.eventloop.opmode.TeleOp;"
        ], "@TeleOp(name=\"Unit_13_Mastery\")", "Unit13Mastery", "OpMode")},
        {name: "RobotConfig.java", source: "package org.firstinspires.ftc.teamcode;\n\npublic final class RobotConfig {\n    // Add static final hardware names and calibration values.\n}\n"},
        {name: "Intake.java", source: "package org.firstinspires.ftc.teamcode;\n\nimport com.qualcomm.robotcore.hardware.CRServo;\nimport com.qualcomm.robotcore.hardware.HardwareMap;\n\npublic class Intake {\n    // Encapsulate intake hardware and commands.\n}\n"},
        {name: "MotorMechanism.java", source: "package org.firstinspires.ftc.teamcode;\n\nimport com.qualcomm.robotcore.hardware.DcMotor;\nimport com.qualcomm.robotcore.hardware.HardwareMap;\n\npublic class MotorMechanism {\n    // Add protected motor state and shared behavior.\n}\n"},
        {name: "Lift.java", source: "package org.firstinspires.ftc.teamcode;\n\nimport com.qualcomm.robotcore.hardware.HardwareMap;\n\npublic class Lift extends MotorMechanism {\n    // Add non-blocking lift behavior and override stop().\n}\n"},
        {name: "RobotHardware.java", source: "package org.firstinspires.ftc.teamcode;\n\nimport com.qualcomm.robotcore.hardware.HardwareMap;\n\npublic class RobotHardware {\n    // Compose, initialize, update, and stop the subsystems.\n}\n"}
      ],
      inputs: ["a", "left_stick_y"],
      checks: [
        ["Keep intake hardware private inside Intake", /class\s+Intake[\s\S]*?private\s+CRServo\s+\w+/],
        ["Put shared motor setup in MotorMechanism", /class\s+MotorMechanism[\s\S]*?protected\s+DcMotor\s+\w+[\s\S]*?void\s+init\s*\(\s*HardwareMap/],
        ["Make Lift extend MotorMechanism", /class\s+Lift\s+extends\s+MotorMechanism/],
        ["Override Lift stop behavior", /class\s+Lift[\s\S]*?@Override[\s\S]*?void\s+stop\s*\(/],
        ["Store hardware names and powers as static final configuration", /class\s+RobotConfig[\s\S]*?static\s+final\s+String\s+INTAKE_NAME[\s\S]*?static\s+final\s+(?:double|int)\s+\w+\s*=/],
        ["Compose Intake and Lift inside RobotHardware", /class\s+RobotHardware[\s\S]*?new\s+Intake\s*\([\s\S]*?new\s+Lift\s*\(/],
        ["Initialize and update both subsystems through RobotHardware", /class\s+RobotHardware[\s\S]*?intake\s*\.\s*init\s*\(\s*hardwareMap\s*\)[\s\S]*?lift\s*\.\s*init\s*\(\s*hardwareMap\s*\)[\s\S]*?lift\s*\.\s*update\s*\(/],
        ["Delegate TeleOp controls through subsystem public methods", /class\s+Unit13Mastery[\s\S]*?robot\s*\.\s*init\s*\(\s*hardwareMap\s*\)[\s\S]*?robot\s*\.\s*update\s*\([\s\S]*?robot\s*\.\s*(?:intake|lift)\s*\./],
        ["Stop all hardware through robot.stopAll()", /class\s+Unit13Mastery[\s\S]*?void\s+stop\s*\([\s\S]*?robot\s*\.\s*stopAll\s*\(/],
        ["Keep raw intake and lift hardware access out of the OpMode", /class\s+Unit13Mastery/]
      ]
    },
    14: {
      title: "Unit 14 Coding Challenge: Vision-Guided Autonomous",
      scenario: "Build an autonomous vision pipeline that opens a webcam through VisionPortal, processes AprilTags and pose, classifies OpenCV zones, reports a stable selection, and releases camera resources.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.Autonomous;",
        "import com.qualcomm.robotcore.hardware.WebcamName;",
        "import org.firstinspires.ftc.vision.VisionPortal;",
        "import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;",
        "import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;",
        "import org.opencv.core.Rect;"
      ], "@Autonomous(name=\"Unit_14_Mastery\")", "Unit14Mastery", "LinearOpMode"),
      inputs: [],
      checks: [
        ["Map the configured webcam", /hardwareMap\s*\.\s*get\s*\(\s*WebcamName\.class\s*,\s*\"[^\"]+\"\s*\)/],
        ["Build an AprilTagProcessor", /AprilTagProcessor\s*\.\s*(?:easyCreate|get|Builder)|new\s+AprilTagProcessor\.Builder/],
        ["Build a VisionPortal with camera and processor", /new\s+VisionPortal\.Builder\s*\(\s*\)/, /setCamera\s*\(/, /addProcessor\s*\(/, /build\s*\(/],
        ["Iterate over current AprilTag detections", /getDetections\s*\(\s*\)/, /for\s*\(\s*AprilTagDetection\s+\w+\s*:/],
        ["Read a detection ID and pose values safely", /\.\s*id\b/, /\.\s*ftcPose\s*\./, /\bif\s*\([^)]*(?:detection|ftcPose|isEmpty|size)/i],
        ["Define multiple OpenCV Rect zones", /new\s+Rect\s*\([^)]*\)[\s\S]*?new\s+Rect\s*\(/],
        ["Classify at least three autonomous zones", /(?:LEFT|CENTER|RIGHT)[\s\S]*?(?:LEFT|CENTER|RIGHT)[\s\S]*?(?:LEFT|CENTER|RIGHT)/],
        ["Report the selected zone before Start", /while\s*\([^)]*(?:isStarted|isStopRequested)[\s\S]*?telemetry\s*\.\s*addData\s*\(/],
        ["Close VisionPortal when vision work is done", /\.\s*close\s*\(\s*\)/]
      ]
    },
    15: {
      title: "Unit 15 Coding Challenge: Full Sensor-Fused Autonomous",
      scenario: "Build a non-blocking Pedro 3 autonomous that combines Limelight validation, current Paths helpers, Ivy commands, pose correction, and the RobotHardware project from Unit 13.",
      starter: shell([
        "import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;",
        "import com.qualcomm.robotcore.eventloop.opmode.Autonomous;",
        "import com.qualcomm.hardware.limelightvision.Limelight3A;",
        "import com.qualcomm.hardware.limelightvision.LLResult;",
        "import com.pedropathing.api.PoseFactory;",
        "import com.pedropathing.follower.Follower;",
        "import com.pedropathing.ivy.Command;",
        "import com.pedropathing.ivy.Scheduler;",
        "import com.pedropathing.math.Pose;",
        "import com.pedropathing.paths.Path;",
        "import org.firstinspires.ftc.teamcode.pedro.Constants;",
        "import static com.pedropathing.api.Paths.*;",
        "import static com.pedropathing.ivy.Scheduler.schedule;",
        "import static com.pedropathing.ivy.commands.Commands.*;",
        "import static com.pedropathing.ivy.groups.Groups.sequential;",
        "import static com.pedropathing.ivy.pedro.PedroCommands.follow;"
      ], "@Autonomous(name=\"Unit_15_Mastery\")", "Unit15Mastery", "LinearOpMode"),
      inputs: [],
      checks: [
        ["Map, select, and start the Limelight pipeline", /hardwareMap\s*\.\s*get\s*\(\s*Limelight3A\.class/, /pipelineSwitch\s*\(\s*\d+\s*\)/, /\.\s*start\s*\(\s*\)/],
        ["Create a Pedro 3 Follower and set its starting Pose", /Constants\s*\.\s*create\s*\(\s*hardwareMap\s*\)/, /follower\s*\.\s*setPose\s*\(/],
        ["Build line and curve segments with the Pedro 3 Paths API", /\bline\s*\(/, /\bcurve\s*\(/, /\bpath\s*\(/],
        ["Compose and schedule an Ivy command routine", /sequential\s*\(/, /follow\s*\(\s*follower\s*,/, /schedule\s*\(/],
        ["Update the follower, robot, and Ivy scheduler every active loop", /while\s*\([^)]*opModeIsActive[\s\S]*?follower\s*\.\s*update\s*\([\s\S]*?robot\s*\.\s*update\s*\([\s\S]*?Scheduler\s*\.\s*execute\s*\(/],
        ["Validate LLResult before reading target data", /getLatestResult\s*\(/, /\.\s*isValid\s*\(\s*\)/],
        ["Fuse a valid vision pose back into the Follower", /getBotpose\s*\(/, /follower\s*\.\s*setPose\s*\(/],
        ["Create and initialize one RobotHardware object", /new\s+RobotHardware\s*\(/, /robot\s*\.\s*init\s*\(\s*hardwareMap\s*\)/],
        ["Coordinate lift and intake without blocking updates", /robot\s*\.\s*lift\s*\./, /robot\s*\.\s*intake\s*\./, /(?:waitMs|waitUntil)\s*\(/],
        ["Stop RobotHardware and Limelight, then report final state", /robot\s*\.\s*stopAll\s*\(/, /limelight\s*\.\s*stop\s*\(/i, /telemetry\s*\.\s*addData\s*\(/],
        ["Keep raw intake and lift hardware access out of the OpMode", /class\s+Unit15Mastery/]
      ],
      forbidden: [["Do not block follower updates with sleep()", /\bsleep\s*\(/]]
    }
  };

  // Part 3 turns each mastery challenge into the next stage of one DECODE
  // project. The earlier CONFIGS remain above as historical lesson fixtures;
  // these stage definitions are the learner-facing cumulative progression.
  const DECODE_STAGE_CONFIGS = {
    2: {
      title: "Stage 1 · CompetitionTeleOp Lifecycle",
      scenario: "Start the shared DECODE project by turning CompetitionTeleOp.java into a registered iterative OpMode with a complete, safe lifecycle.",
      activeFile: "CompetitionTeleOp.java",
      entryClass: "CompetitionTeleOp",
      registration: "teleop",
      inputs: ["a"],
      checks: [
        ["Report robot status during init()", /void\s+init\s*\(\s*\)[\s\S]*?telemetry\s*\.\s*addData\s*\(/],
        ["Reset match time in start()", /void\s+start\s*\(\s*\)[\s\S]*?resetRuntime\s*\(/],
        ["Read gamepad1 and update telemetry in loop()", /void\s+loop\s*\(\s*\)[\s\S]*?gamepad1\s*\.[\s\S]*?telemetry\s*\.\s*(?:addData|update)\s*\(/],
        ["Provide a stop() safety lifecycle method", /void\s+stop\s*\(\s*\)/]
      ]
    },
    3: {
      title: "Stage 2 · Shared Robot Configuration",
      scenario: "Add RobotConfig.java and centralize the names, constants, primitive values, and mechanism state that later DECODE subsystems will share.",
      activeFile: "RobotConfig.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["RobotConfig.java", "CompetitionTeleOp.java"],
      inputs: ["a", "left_bumper", "left_stick_y"],
      checks: [
        ["Make RobotConfig a non-instantiable final class", /final\s+class\s+RobotConfig[\s\S]*?private\s+RobotConfig\s*\(\s*\)/],
        ["Define shared String hardware names", /class\s+RobotConfig[\s\S]*?static\s+final\s+String\s+\w+\s*=\s*"[^"]+"/],
        ["Define double power, deadzone, and launcher values", /static\s+final\s+double\s+\w*(?:POWER|SPEED)\w*\s*=/i, /static\s+final\s+double\s+\w*DEADZONE\w*\s*=/i, /static\s+final\s+double\s+\w*(?:VELOCITY|FLYWHEEL)\w*\s*=/i],
        ["Track mechanism state with boolean and int values", /\bboolean\s+\w+\s*=/, /\bint\s+\w+\s*=/],
        ["Use a RobotConfig value outside RobotConfig.java", /class\s+(?!RobotConfig)\w+[\s\S]*?RobotConfig\s*\.\s*\w+/]
      ]
    },
    4: {
      title: "Stage 3 · Mecanum Drivetrain",
      scenario: "Build Drivetrain.java with four mapped motors, joystick deadzones, normalized mecanum math, and one-gamepad control delegated by CompetitionTeleOp.",
      activeFile: "Drivetrain.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Drivetrain.java", "CompetitionTeleOp.java"],
      inputs: ["left_stick_x", "left_stick_y", "right_stick_x"],
      checks: [
        ["Keep and map four drivetrain motors", /class\s+Drivetrain[\s\S]*?(?:DcMotor\s+\w+[\s\S]*?){4}/, /class\s+Drivetrain[\s\S]*?(?:\w+\s*\.\s*get\s*\(\s*DcMotor\.class[\s\S]*?){4}/],
        ["Apply a joystick deadzone", /Math\s*\.\s*abs\s*\([^)]*\)\s*[<>]=?\s*(?:0?\.\d+|(?:RobotConfig\s*\.\s*)?[A-Z][A-Z0-9_]*)/],
        ["Calculate four mecanum wheel values", /class\s+Drivetrain[\s\S]*?(?:void|double\s*\[\s*\])\s+\w*(?:drive|mecanum)\w*\s*\(/i],
        ["Normalize wheel power to the available range", /(?:Math\s*\.\s*(?:max|min|abs)|Range\s*\.\s*clip)\s*\(/],
        ["Send power to all four motors", /setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)[\s\S]*?setPower\s*\(/],
        ["Delegate gamepad1 drive axes from CompetitionTeleOp", /class\s+CompetitionTeleOp[\s\S]*?\w+\s*\.\s*\w*(?:drive|mecanum)\w*\s*\([^;]*gamepad1\s*\./i]
      ]
    },
    5: {
      title: "Stage 4 · Intake and Transfer Logic",
      scenario: "Complete Intake.java and Transfer.java, then use clear conditional driver controls to collect, feed, reverse, and stop them safely.",
      activeFile: "Intake.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Intake.java", "Transfer.java", "CompetitionTeleOp.java"],
      inputs: ["right_bumper", "left_bumper"],
      checks: [
        ["Map private intake and transfer motors in init(HMap)", /class\s+Intake[\s\S]*?private\s+DcMotor[\s\S]*?\w+\s*\.\s*get\s*\(\s*DcMotor\.class/, /class\s+Transfer[\s\S]*?private\s+DcMotor[\s\S]*?\w+\s*\.\s*get\s*\(\s*DcMotor\.class/],
        ["Give Intake collect, reverse, and stop commands", /class\s+Intake[\s\S]*?void\s+collect\s*\(/, /class\s+Intake[\s\S]*?void\s+reverse\s*\(/, /class\s+Intake[\s\S]*?void\s+stop\s*\(/],
        ["Give Transfer forward, reverse, and stop commands", /class\s+Transfer[\s\S]*?void\s+forward\s*\(/, /class\s+Transfer[\s\S]*?void\s+reverse\s*\(/, /class\s+Transfer[\s\S]*?void\s+stop\s*\(/],
        ["Use clear conditional control logic", /(?:\bif\s*\(|\bswitch\s*\(|\?[^:]+:)/],
        ["Run both mechanisms forward and reverse from the bumpers", /gamepad1\s*\.\s*right_bumper[\s\S]*?(?:intake|transfer)\s*\./, /gamepad1\s*\.\s*left_bumper[\s\S]*?(?:reverse|stop)/]
      ]
    },
    6: {
      title: "Stage 5 · Arrays and Non-Blocking Launch Timing",
      scenario: "Use motor collections and loops to keep repeated setup concise, then add a launch sequence that advances by timestamps without blocking TeleOp updates.",
      activeFile: "CompetitionTeleOp.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["CompetitionTeleOp.java", "Drivetrain.java"],
      inputs: ["a"],
      checks: [
        ["Store related drive motors in an array", /DcMotor\s*\[\s*\]\s+\w+/],
        ["Use a loop to configure or stop the motor array", /for\s*\([^)]*(?:;|:)\s*[^)]*\)[\s\S]*?\w+\s*\.\s*(?:setMode|setZeroPowerBehavior|setPower)\s*\(/],
        ["Start launch timing on an A-button rising edge", /gamepad1\s*\.\s*a\s*&&\s*!\s*\w+/],
        ["Advance launch state with a getRuntime() deadline", /getRuntime\s*\(\s*\)\s*\+\s*[^;]+/, /getRuntime\s*\(\s*\)\s*[<>]=?\s*\w+/],
        ["Keep stop() responsible for safe shutdown", /void\s+stop\s*\(\s*\)[\s\S]*?(?:stop|setPower\s*\(\s*0)/]
      ],
      forbidden: [
        ["Do not block TeleOp with sleep()", /\bsleep\s*\(/],
        ["Do not add an unbounded while(true) loop", /while\s*\(\s*true\s*\)/]
      ]
    },
    7: {
      title: "Stage 6 · Subsystem Hardware Mapping",
      scenario: "Move every hardware lookup into subsystem init(HardwareMap) methods and add the Launcher and ArtifactSensors scaffolds without exposing raw hardware in CompetitionTeleOp.",
      activeFile: "Launcher.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Drivetrain.java", "Intake.java", "Transfer.java", "Launcher.java", "ArtifactSensors.java", "CompetitionTeleOp.java"],
      inputs: ["a", "right_bumper"],
      checks: [
        ["Give all five subsystems init(HardwareMap)", /class\s+Drivetrain[\s\S]*?init\s*\(\s*HardwareMap/, /class\s+Intake[\s\S]*?init\s*\(\s*HardwareMap/, /class\s+Transfer[\s\S]*?init\s*\(\s*HardwareMap/, /class\s+Launcher[\s\S]*?init\s*\(\s*HardwareMap/, /class\s+ArtifactSensors[\s\S]*?init\s*\(\s*HardwareMap/],
        ["Map hardware inside subsystem classes", /class\s+(?:Drivetrain|Intake|Transfer|Launcher|ArtifactSensors)[\s\S]*?hardwareMap\s*\.\s*get\s*\(/],
        ["Keep Launcher flywheel hardware private", /class\s+Launcher[\s\S]*?private\s+DcMotor\s+\w+/],
        ["Give ArtifactSensors stored-artifact state", /class\s+ArtifactSensors[\s\S]*?\bint\s+\w+/, /class\s+ArtifactSensors[\s\S]*?boolean\s+hasCapacity\s*\(/],
        ["Initialize and command subsystems from CompetitionTeleOp", /class\s+CompetitionTeleOp[\s\S]*?\.\s*init\s*\(\s*hardwareMap\s*\)[\s\S]*?gamepad1\s*\./],
        ["Keep raw hardwareMap.get calls out of CompetitionTeleOp", /class\s+CompetitionTeleOp/]
      ]
    },
    8: {
      title: "Stage 7 · Safe Motor Configuration",
      scenario: "Configure drivetrain and mechanism direction, encoder modes, braking, and reliable zero-power shutdown inside their subsystem classes.",
      activeFile: "Drivetrain.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Drivetrain.java", "Intake.java", "Transfer.java", "Launcher.java"],
      inputs: ["left_stick_y"],
      checks: [
        ["Set the required motor directions", /setDirection\s*\([^)]*Direction\.REVERSE/],
        ["Configure RUN_USING_ENCODER", /setMode\s*\(\s*DcMotor\.RunMode\.RUN_USING_ENCODER\s*\)/],
        ["Configure BRAKE at zero power", /setZeroPowerBehavior\s*\(\s*DcMotor\.ZeroPowerBehavior\.BRAKE\s*\)/],
        ["Stop every powered subsystem at zero", /class\s+Drivetrain[\s\S]*?void\s+stop\s*\([^)]*\)[\s\S]*?setPower\s*\(\s*0/, /class\s+Intake[\s\S]*?void\s+stop\s*\([^)]*\)[\s\S]*?setPower\s*\(\s*0/, /class\s+Transfer[\s\S]*?void\s+stop\s*\([^)]*\)[\s\S]*?setPower\s*\(\s*0/, /class\s+Launcher[\s\S]*?void\s+stop\s*\([^)]*\)[\s\S]*?setPower\s*\(\s*0/]
      ]
    },
    9: {
      title: "Stage 8 · Launcher Trigger Servo",
      scenario: "Add a positional trigger Servo to Launcher and release exactly one artifact from an A-button press without pausing the OpMode loop.",
      activeFile: "Launcher.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Launcher.java", "CompetitionTeleOp.java", "RobotConfig.java"],
      inputs: ["a", "right_trigger"],
      checks: [
        ["Map a private positional Servo trigger", /class\s+Launcher[\s\S]*?private\s+Servo\s+\w+[\s\S]*?hardwareMap\s*\.\s*get\s*\(\s*Servo\.class/],
        ["Configure fire and rest positions", /(?:static\s+final\s+double|RobotConfig\s*\.\s*\w+)[\s\S]*?setPosition\s*\([^)]*\)[\s\S]*?setPosition\s*\([^)]*\)/],
        ["Launch on the A-button rising edge", /gamepad1\s*\.\s*a\s*&&\s*!\s*\w+[\s\S]*?launcher\s*\.\s*launch\s*\(/],
        ["Return the trigger using non-blocking timing", /class\s+Launcher[\s\S]*?void\s+update\s*\([^)]*\)[\s\S]*?(?:deadline|return|release|trigger)[\s\S]*?setPosition\s*\(/i]
      ],
      forbidden: [["Do not block trigger timing with sleep()", /\bsleep\s*\(/]]
    },
    10: {
      title: "Stage 9 · Closed-Loop Flywheel Velocity",
      scenario: "Convert Launcher to DcMotorEx, command velocity, measure it, and tune PIDF so the flywheel can resist battery-related speed loss.",
      activeFile: "Launcher.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Launcher.java", "CompetitionTeleOp.java"],
      inputs: ["right_trigger", "a"],
      checks: [
        ["Use DcMotorEx for the flywheel", /class\s+Launcher[\s\S]*?DcMotorEx\s+\w+[\s\S]*?hardwareMap\s*\.\s*get\s*\(\s*DcMotorEx\.class/],
        ["Run the flywheel with encoders", /setMode\s*\(\s*DcMotor\.RunMode\.RUN_USING_ENCODER\s*\)/],
        ["Set PIDF coefficients", /setVelocityPIDFCoefficients\s*\(/],
        ["Command proportional target velocity", /gamepad1\s*\.\s*right_trigger[\s\S]*?setVelocity\s*\(/],
        ["Read measured velocity", /getVelocity\s*\(\s*\)/],
        ["Report target and measured velocity", /telemetry\s*\.\s*addData\s*\([^)]*(?:target|command)/i, /telemetry\s*\.\s*addData\s*\([^)]*(?:measured|actual|velocity)/i]
      ]
    },
    11: {
      title: "Stage 10 · Artifact Capacity and Interlocks",
      scenario: "Finish ArtifactSensors and prevent intake, transfer, or launch actions that would violate the three-artifact capacity or mechanism state.",
      activeFile: "ArtifactSensors.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["ArtifactSensors.java", "Intake.java", "Transfer.java", "Launcher.java", "CompetitionTeleOp.java"],
      inputs: ["right_bumper", "left_bumper", "a"],
      checks: [
        ["Map and read artifact sensors", /class\s+ArtifactSensors[\s\S]*?hardwareMap\s*\.\s*get\s*\([^;]+[\s\S]*?(?:getState|getDistance)\s*\(/],
        ["Track a maximum capacity of three", /class\s+ArtifactSensors[\s\S]*?(?:<\s*3|MAX\w*\s*=\s*3)/],
        ["Update stored count from sensor transitions", /class\s+ArtifactSensors[\s\S]*?void\s+update\s*\([^)]*\)[\s\S]*?(?:\+\+|--|\+=|-=)/],
        ["Expose storage and capacity state", /class\s+ArtifactSensors[\s\S]*?boolean\s+hasCapacity\s*\(/],
        ["Interlock intake or transfer when storage is full", /hasCapacity\s*\(\s*\)/, /(?:intake|transfer)\s*\./],
        ["Launch only when an artifact is ready", /(?:hasArtifact|isReady|readyToLaunch|storedArtifacts\s*>\s*0)[\s\S]*?launcher\s*\.\s*launch\s*\(/]
      ]
    },
    12: {
      title: "Stage 11 · IMU Field-Centric Drive",
      scenario: "Upgrade Drivetrain to field-centric mecanum control with IMU heading, heading reset, rotated joystick vectors, and normalized output.",
      activeFile: "Drivetrain.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Drivetrain.java", "CompetitionTeleOp.java"],
      inputs: ["x", "left_stick_x", "left_stick_y", "right_stick_x"],
      checks: [
        ["Map and initialize the IMU", /hardwareMap\s*\.\s*get\s*\(\s*IMU\.class/, /new\s+RevHubOrientationOnRobot\s*\(/, /imu\s*\.\s*initialize\s*\(/],
        ["Read robot yaw in radians", /getRobotYawPitchRollAngles\s*\(\s*\)[\s\S]*?getYaw\s*\(\s*AngleUnit\.RADIANS\s*\)/],
        ["Reset heading from the X button", /gamepad1\s*\.\s*x[\s\S]*?(?:resetYaw|resetHeading)\s*\(/],
        ["Rotate field input with sine and cosine", /Math\s*\.\s*cos\s*\(/, /Math\s*\.\s*sin\s*\(/],
        ["Normalize and command four mecanum powers", /Math\s*\.\s*max\s*\(/, /setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)[\s\S]*?setPower\s*\([^)]*\)[\s\S]*?setPower\s*\(/]
      ]
    },
    13: {
      title: "Stage 12 · Complete Modular TeleOp",
      scenario: "Add PoweredMechanism and RobotHardware, compose every DECODE subsystem, and finish CompetitionTeleOp as coordination-only code with no raw hardware access.",
      activeFile: "RobotHardware.java",
      entryClass: "CompetitionTeleOp",
      registration: "teleop",
      stageFiles: ["PoweredMechanism.java", "RobotHardware.java", "CompetitionTeleOp.java", "Intake.java", "Transfer.java", "Launcher.java"],
      inputs: ["a", "x", "y", "left_bumper", "right_bumper", "left_stick_x", "left_stick_y", "right_stick_x", "right_trigger"],
      checks: [
        ["Put shared powered behavior in PoweredMechanism", /class\s+PoweredMechanism[\s\S]*?protected\s+DcMotor\s+\w+[\s\S]*?void\s+setPower\s*\([^)]*\)[\s\S]*?void\s+stop\s*\(/],
        ["Reuse PoweredMechanism in powered subsystems", /class\s+(?:Intake|Transfer|Launcher)\s+extends\s+PoweredMechanism/],
        ["Compose every subsystem in RobotHardware", /class\s+RobotHardware[\s\S]*?new\s+Drivetrain\s*\([\s\S]*?new\s+Intake\s*\([\s\S]*?new\s+Transfer\s*\([\s\S]*?new\s+Launcher\s*\([\s\S]*?new\s+ArtifactSensors\s*\(/],
        ["Initialize every subsystem through RobotHardware", /class\s+RobotHardware[\s\S]*?void\s+init\s*\(\s*HardwareMap[\s\S]*?drivetrain\s*\.\s*init[\s\S]*?intake\s*\.\s*init[\s\S]*?transfer\s*\.\s*init[\s\S]*?launcher\s*\.\s*init[\s\S]*?sensors\s*\.\s*init/],
        ["Update mechanisms without blocking", /class\s+RobotHardware[\s\S]*?void\s+update\s*\([^)]*\)[\s\S]*?(?:launcher|sensors)\s*\.\s*update/],
        ["Stop every subsystem through stopAll()", /class\s+RobotHardware[\s\S]*?void\s+stopAll\s*\([^)]*\)[\s\S]*?drivetrain\s*\.\s*stop[\s\S]*?intake\s*\.\s*stop[\s\S]*?transfer\s*\.\s*stop[\s\S]*?launcher\s*\.\s*stop/],
        ["Delegate TeleOp init, loop, and stop to RobotHardware", /class\s+CompetitionTeleOp[\s\S]*?robot\s*\.\s*init\s*\(\s*hardwareMap\s*\)[\s\S]*?robot\s*\.\s*update\s*\([\s\S]*?robot\s*\.\s*stopAll\s*\(/],
        ["Keep raw hardware access out of CompetitionTeleOp", /class\s+CompetitionTeleOp/]
      ],
      forbidden: [["Do not block TeleOp updates with sleep()", /\bsleep\s*\(/]]
    },
    14: {
      title: "Stage 13 · Vision Subsystem",
      scenario: "Add Vision.java beside the finished TeleOp, own the camera pipeline there, and let RobotHardware initialize, update, and close it without replacing driver control.",
      activeFile: "Vision.java",
      entryClass: "CompetitionTeleOp",
      stageFiles: ["Vision.java", "RobotHardware.java", "CompetitionTeleOp.java"],
      inputs: [],
      checks: [
        ["Map Webcam 1 inside Vision", /class\s+Vision[\s\S]*?hardwareMap\s*\.\s*get\s*\(\s*WebcamName\.class\s*,\s*"Webcam 1"\s*\)/],
        ["Build an AprilTag processor and VisionPortal", /class\s+Vision[\s\S]*?AprilTagProcessor[\s\S]*?VisionPortal/],
        ["Inspect current detections safely", /getDetections\s*\(\s*\)/, /for\s*\(\s*AprilTagDetection\s+\w+\s*:/, /metadata\s*!=\s*null/],
        ["Classify left, center, and right zones", /(?:LEFT|CENTER|RIGHT)[\s\S]*?(?:LEFT|CENTER|RIGHT)[\s\S]*?(?:LEFT|CENTER|RIGHT)/],
        ["Initialize and update Vision through RobotHardware", /class\s+RobotHardware[\s\S]*?vision\s*\.\s*init\s*\(\s*hardwareMap\s*\)[\s\S]*?vision\s*\.\s*update\s*\(/],
        ["Close camera resources during shutdown", /class\s+Vision[\s\S]*?void\s+close\s*\([^)]*\)[\s\S]*?\.\s*close\s*\(/]
      ]
    },
    15: {
      title: "Stage 14 · Full Sensor-Fused Autonomous",
      scenario: "Add FullAutonomous.java to the same DECODE project and coordinate Limelight validation, Pedro 3 Paths, Ivy commands, non-blocking subsystem updates, and clean shutdown.",
      activeFile: "FullAutonomous.java",
      entryClass: "FullAutonomous",
      registration: "autonomous",
      stageFiles: ["FullAutonomous.java", "RobotHardware.java", "Vision.java"],
      inputs: [],
      checks: [
        ["Map, select, and start the Limelight pipeline", /hardwareMap\s*\.\s*get\s*\(\s*Limelight3A\.class\s*,\s*"limelight"\s*\)/, /pipelineSwitch\s*\(/, /limelight\s*\.\s*start\s*\(/],
        ["Create a Pedro 3 Follower with a starting Pose", /Constants\s*\.\s*create\s*\(\s*hardwareMap\s*\)/, /follower\s*\.\s*setPose\s*\(/],
        ["Build a compound Path with line() and curve()", /\bline\s*\(/, /\bcurve\s*\(/, /\bpath\s*\(/],
        ["Compose and schedule an Ivy autonomous routine", /sequential\s*\(/, /follow\s*\(\s*follower\s*,/, /schedule\s*\(/],
        ["Keep follower, robot, and scheduler updates non-blocking", /while\s*\([^)]*opModeIsActive[\s\S]*?follower\s*\.\s*update\s*\([\s\S]*?robot\s*\.\s*update\s*\([\s\S]*?Scheduler\s*\.\s*execute\s*\(/],
        ["Validate Limelight results before reading pose", /getLatestResult\s*\(/, /\.\s*isValid\s*\(\s*\)/],
        ["Correct localization from a valid vision pose", /getBotpose\s*\(/, /follower\s*\.\s*setPose\s*\(/],
        ["Initialize the existing RobotHardware project", /new\s+RobotHardware\s*\(/, /robot\s*\.\s*init\s*\(\s*hardwareMap\s*\)/],
        ["Coordinate launcher, transfer, and intake through subsystems", /robot\s*\.\s*launcher\s*\./, /robot\s*\.\s*transfer\s*\./, /robot\s*\.\s*intake\s*\./],
        ["Stop robot, vision, and Limelight cleanly", /robot\s*\.\s*stopAll\s*\(/, /vision\s*\.\s*close\s*\(/, /limelight\s*\.\s*stop\s*\(/],
        ["Keep raw hardware access out of FullAutonomous", /class\s+FullAutonomous/]
      ],
      forbidden: [["Do not block follower updates with sleep()", /\bsleep\s*\(/]]
    }
  };

  function criterionAstRule(unit, index) {
    const rules = {
      "2:0": {classes: [{name: "CompetitionTeleOp", methods: ["init"]}]},
      "2:1": {classes: [{name: "CompetitionTeleOp", methods: ["start"]}]},
      "2:2": {classes: [{name: "CompetitionTeleOp", methods: ["loop"]}]},
      "2:3": {classes: [{name: "CompetitionTeleOp", methods: ["stop"]}]},
      "3:0": {classes: [{name: "RobotConfig", modifiers: ["final"]}]},
      "3:1": {classes: [{name: "RobotConfig", fields: [{type: "String", static: true, final: true}]}]},
      "4:0": {classes: [{name: "Drivetrain", methods: ["init"]}]},
      "4:4": {classes: [{name: "Drivetrain", calls: ["setPower"]}]},
      "4:5": {classes: [{name: "CompetitionTeleOp", methods: ["loop"]}]},
      "5:1": {classes: [{name: "Intake", methods: ["collect", "reverse", "stop"]}]},
      "5:2": {classes: [{name: "Transfer", methods: ["forward", "reverse", "stop"]}]},
      "7:0": {classes: [
        {name: "Drivetrain", methods: ["init"]}, {name: "Intake", methods: ["init"]},
        {name: "Transfer", methods: ["init"]}, {name: "Launcher", methods: ["init"]},
        {name: "ArtifactSensors", methods: ["init"]}
      ]},
      "9:0": {classes: [{name: "Launcher", fields: [{type: "Servo", modifiers: ["private"]}]}]},
      "10:0": {classes: [{name: "Launcher", fields: [{type: "DcMotorEx"}]}]},
      "10:1": {classes: [{name: "Launcher", calls: ["setMode"]}]},
      "10:2": {classes: [{name: "Launcher", calls: ["setVelocityPIDFCoefficients"]}]},
      "10:3": {classes: [{name: "Launcher", calls: ["setVelocity"]}]},
      "10:4": {classes: [{name: "Launcher", calls: ["getVelocity"]}]},
      "11:3": {classes: [{name: "ArtifactSensors", methods: ["hasCapacity"]}]},
      "13:0": {classes: [{name: "PoweredMechanism", methods: ["setPower", "stop"], fields: [{type: "DcMotor", modifiers: ["protected"]}]}]},
      "13:1": {anyClass: {names: ["Intake", "Transfer", "Launcher"], superClass: "PoweredMechanism"}},
      "13:2": {classes: [{name: "RobotHardware"}]},
      "14:0": {classes: [{name: "Vision", methods: ["init"]}]},
      "14:5": {classes: [{name: "Vision", methods: ["close"], calls: ["close"]}]},
      "15:7": {classes: [{name: "FullAutonomous", fields: [{type: "RobotHardware"}]}]}
    };
    return rules[unit + ":" + index] || null;
  }

  function criterionDescriptor(unit, check, index) {
    const fixtureIds = {
      "2:0": ["telemetry-init"],
      "2:2": ["telemetry-loop"],
      "4:2": ["mecanum-drive"],
      "5:4": ["intake-transfer-controls"],
      "9:2": ["launcher-trigger-edge"],
      "11:4": ["storage-full-interlock"]
    };
    return Object.freeze({
      id: "unit-" + String(unit).padStart(2, "0") + "-criterion-" + String(index + 1).padStart(2, "0"),
      label: check[0],
      structural: Object.freeze({patterns: Object.freeze(check.slice(1)), ast: criterionAstRule(unit, index)}),
      behavioralFixtures: Object.freeze(fixtureIds[unit + ":" + index] || []),
      diagnostic: "Not yet demonstrated: " + check[0] + "."
    });
  }

  Object.keys(DECODE_STAGE_CONFIGS).forEach(function (unit) {
    Object.assign(CONFIGS[unit], DECODE_STAGE_CONFIGS[unit]);
    CONFIGS[unit].checks = CONFIGS[unit].checks.map(function (check, index) {
      return criterionDescriptor(Number(unit), check, index);
    });
    delete CONFIGS[unit].starter;
    delete CONFIGS[unit].starterFiles;
  });

  const TEAM_30450_CAD_CREDIT = Object.freeze({
    sourceLabel: "FTC Team 30450 Sharp Face Robotics CAD · used with explicit team permission · modified from the original",
    sourceUrl: "https://ftc-events.firstinspires.org/2025/team/30450"
  });

  const ROBOT_PROFILES = Object.freeze({
    2: {
      name: "DECODE competition robot · Fundamentals",
      detail: "Team CAD model driven by student motor commands",
      accent: 0x22d3ee,
      driveYaw: 0,
      ...TEAM_30450_CAD_CREDIT
    },
    3: {
      name: "Quixilver 8404 · Into the Deep robot",
      detail: "Full Team 8404 competition robot CAD, optimized for the browser",
      accent: 0x38bdf8,
      driveYaw: -Math.PI / 2,
      wheelAxis: "z",
      sourceLabel: "Open Vault FTC · ITD 2024–2025 Robot — By Quixilver",
      sourceUrl: "https://www.open-vault-ftc.org/cad/robots"
    },
    4: {
      name: "2025 FTC Robot",
      detail: "Manning competition robot CAD, optimized for the browser",
      accent: 0x60a5fa,
      sourceLabel: "Manning, 2025 FTC Robot, Cad Crowd, 2025 · Creative Commons Attribution · Modified from the original",
      sourceUrl: "https://www.cadcrowd.com/3d-models/2025-ftc-robot"
    },
    5: {
      name: "2024 FTC Robot — CENTERSTAGE",
      detail: "Manning CENTERSTAGE competition robot CAD, optimized for the browser",
      accent: 0xf59e0b,
      // The STEP model's negative-X end is the intake/sloped front.
      driveYaw: Math.PI / 2,
      wheelSpinSign: 1,
      sourceLabel: "Manning, 2024 FTC Robot — CENTERSTAGE, Cad Crowd, 2025 · Creative Commons Attribution · Modified from the original",
      sourceUrl: "https://www.cadcrowd.com/3d-models/2024-ftc-robot"
    },
    6: {
      name: "FTC 17438 Input/Output Robot",
      detail: "Team 17438 competition robot CAD, optimized for the browser",
      accent: 0xa78bfa,
      sourceLabel: "FTC Team 17438 Input/Output, FTC17438 Input/Output Robot Model 29.03.2024, Charleston Dragon Robotics · CC BY 4.0 · Modified from the original",
      sourceUrl: "https://charlestondragonrobotics.org/ftc/"
    },
    7: {name: "Reusable subsystem robot", detail: "Mapped motor, limit switch, and analog sensor module", accent: 0x2dd4bf},
    8: {
      name: "FTC 11115 Gluten Free · SKYSTONE robot",
      detail: "One-motor DR4B lift · real rollers, linkage bars, and scoring assembly",
      accent: 0xfb7185,
      driveYaw: Math.PI / 2,
      wheelAxis: "z",
      wheelSpinSign: 1,
      // CAD left/right labels face the opposite direction to our driving frame.
      wheelMotionOrder: [2, 3, 0, 1],
      sourceLabel: "FTC Team 11115 Gluten Free CAD · used with explicit team permission · Modified from the original; simplified lift motion",
      sourceUrl: "https://www.youtube.com/watch?v=i2g_b54MEFI"
    },
    9: {name: "Servo gripper robot", detail: "Mirrored fingers with a continuous-rotation intake roller", accent: 0xf472b6},
    10: {name: "Encoder distance robot", detail: "Marked drive wheels for measured RUN_TO_POSITION travel", accent: 0x4ade80},
    11: {name: "Multi-sensor intake robot", detail: "Touch, potentiometer, color, and distance sensing around the intake", accent: 0xfbbf24},
    12: {name: "Field-centric mecanum robot", detail: "Four-wheel drive with a visible Control Hub IMU and orientation axes", accent: 0x818cf8},
    // The imported DECODE assembly is on the simulator's drive axes but faces the
    // opposite direction. A half-turn preserves forward/strafe axes while
    // aligning both signs with the visible chassis and intake opening.
    13: {name: "DECODE competition robot", detail: "Student code drives the three-stage intake, anti-jam transfer, flywheel, trigger, and mecanum chassis", accent: 0x22d3ee, driveYaw: 0, modelYaw: Math.PI, ...TEAM_30450_CAD_CREDIT},
    14: {name: "DECODE competition robot · Vision", detail: "The finished TeleOp robot gains a camera and three analysis zones", accent: 0x22c55e, driveYaw: 0, modelYaw: Math.PI, ...TEAM_30450_CAD_CREDIT},
    15: {name: "DECODE competition robot · Full Autonomous", detail: "The same robot follows a Bézier path with Limelight pose correction", accent: 0x06b6d4, driveYaw: 0, modelYaw: Math.PI, ...TEAM_30450_CAD_CREDIT}
  });

  const GENERATED_MECHANISM_UNITS = Object.freeze([7, 9, 11]);

  function cadSourceUnitFor(unit) {
    const numericUnit = Number(unit);
    if (numericUnit < 2 || numericUnit > 15) return null;
    if (numericUnit >= 13) return 2;
    // These challenges need several independently controlled parts that the
    // flattened imported CAD cannot articulate faithfully. Their dedicated
    // models preserve the exact motor, sensor, and servo behavior being coded.
    if (GENERATED_MECHANISM_UNITS.indexOf(numericUnit) >= 0) return null;
    if (numericUnit === 8) return 8;
    return 2 + ((numericUnit - 2) % 5);
  }

  function robotProfileForUnit(unit) {
    if (Number(unit) >= 13) return ROBOT_PROFILES[Number(unit)];
    return ROBOT_PROFILES[cadSourceUnitFor(unit)] || ROBOT_PROFILES[unit];
  }

  const DRIVE_HARDWARE = Object.freeze([
    {label: "LF", name: "leftFront"},
    {label: "LB", name: "leftBack"},
    {label: "RF", name: "rightFront"},
    {label: "RB", name: "rightBack"}
  ]);
  const DECODE_MECHANISM_HARDWARE = Object.freeze([
    {label: "Intake", name: "intake"},
    {label: "Transfer", name: "transfer"},
    {label: "Flywheel motor", name: "launcher"},
    {label: "Trigger servo", name: "launcher_trigger"},
    {label: "Intake sensor", name: "intake_sensor"},
    {label: "Storage sensor", name: "storage_sensor"}
  ]);
  const DECODE_HARDWARE = Object.freeze(DRIVE_HARDWARE.concat(DECODE_MECHANISM_HARDWARE));
  const HARDWARE_PROFILES = Object.freeze({
    2: [],
    3: [{label: "Front slide motor", name: "intake_slide"}],
    4: DRIVE_HARDWARE,
    5: [
      {label: "Intake motor", name: "intake"},
      {label: "Color sensor", name: "intake_color"},
      {label: "Distance sensor", name: "intake_distance"}
    ],
    6: DRIVE_HARDWARE.concat([{label: "Arm", name: "arm"}]),
    7: [
      {label: "Mechanism motor", name: "mechanism"},
      {label: "Limit switch", name: "mechanism_limit"},
      {label: "Potentiometer", name: "mechanism_pot"}
    ],
    8: [
      {label: "Lift motor", name: "lift"},
      {label: "Upper limit", name: "limit_upper"},
      {label: "Lower limit", name: "limit_lower"}
    ],
    9: [
      {label: "Left claw servo", name: "left_claw"},
      {label: "Right claw servo", name: "right_claw"},
      {label: "Intake CRServo", name: "intake_servo"}
    ],
    10: [
      {label: "Left drive", name: "left_drive"},
      {label: "Right drive", name: "right_drive"}
    ],
    11: [
      {label: "Intake motor", name: "intake"},
      {label: "Storage switch", name: "storage_full"},
      {label: "Arm potentiometer", name: "arm_pot"},
      {label: "Color sensor", name: "intake_color"},
      {label: "Distance sensor", name: "intake_range"}
    ],
    12: DRIVE_HARDWARE.concat([{label: "IMU", name: "imu"}]),
    13: DECODE_HARDWARE.concat([{label: "IMU", name: "imu"}]),
    14: DECODE_HARDWARE.concat([{label: "IMU", name: "imu"}, {label: "Camera", name: "Webcam 1"}]),
    15: DECODE_HARDWARE.concat([
      {label: "IMU", name: "imu"},
      {label: "Camera", name: "Webcam 1"},
      {label: "Vision", name: "limelight"}
    ])
  });

  const CAD_WHEEL_ORDER = Object.freeze(["left-front", "left-back", "right-front", "right-back"]);

  const DECODE_ROBOT_MODEL_URL = "./models/30450-decode-robot-telemark.glb";
  const QUIXILVER_ROBOT_MODEL_URL = "./models/quixilver-8404-itd-telemark.glb";
  const FTC_2025_ROBOT_MODEL_URL = "./models/2025-ftc-robot-manning-telemark.glb";
  const FTC_2024_ROBOT_MODEL_URL = "./models/2024-centerstage-manning-telemark.glb";
  const FTC_17438_ROBOT_MODEL_URL = "./models/ftc17438-inputoutput-telemark.glb";
  const FTC_11115_ROBOT_MODEL_URL = "./models/11115-gluten-free-skystone-telemark.glb";
  const GLTF_LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";

  function setImportedRobotStatus(message) {
    const label = document.getElementById("mastery-robot-label");
    const detail = label && label.querySelector(".mastery-robot-status");
    if (detail) detail.textContent = message;
    if (/unavailable|could not|missing|did not contain/.test(message)) {
      const button = document.getElementById('sim-btn-run');
      if (button && button.textContent === 'Loading robot…') {
        button.textContent = 'Robot failed to load — reload page';
      }
    }
  }

  function ensureGltfLoader(THREE, callback) {
    if (THREE.GLTFLoader) {
      callback(null);
      return;
    }

    let script = document.querySelector("script[data-telemark-gltf-loader]");
    if (!script) {
      script = document.createElement("script");
      script.src = GLTF_LOADER_URL;
      script.dataset.telemarkGltfLoader = "true";
      document.head.appendChild(script);
    }

    script.addEventListener("load", function () {
      callback(THREE.GLTFLoader ? null : new Error("The GLB loader did not initialize."));
    }, {once: true});
    script.addEventListener("error", function () {
      callback(new Error("The GLB loader could not be downloaded."));
    }, {once: true});
  }

  function importedCadBounds(THREE, part) {
    const stored = part && part.userData && part.userData.telemarkCadBounds;
    if (!stored || !Array.isArray(stored.min) || !Array.isArray(stored.max)) {
      return new THREE.Box3().setFromObject(part);
    }
    part.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3();
    [stored.min[0], stored.max[0]].forEach(function (x) {
      [stored.min[1], stored.max[1]].forEach(function (y) {
        [stored.min[2], stored.max[2]].forEach(function (z) {
          bounds.expandByPoint(part.localToWorld(new THREE.Vector3(x, y, z)));
        });
      });
    });
    return bounds;
  }

  function importedCadCenter(THREE, part) {
    const stored = part && part.userData && part.userData.telemarkCadCenter;
    if (Array.isArray(stored) && stored.length === 3) {
      part.updateWorldMatrix(true, false);
      return part.localToWorld(new THREE.Vector3(stored[0], stored[1], stored[2]));
    }
    return importedCadBounds(THREE, part).getCenter(new THREE.Vector3());
  }

  function loadImportedRobot(THREE, robot, options) {
    ensureGltfLoader(THREE, function (loaderError) {
      if (loaderError) {
        console.error("[Imported robot loader]", loaderError);
        setImportedRobotStatus(options.name + " unavailable: " + loaderError.message);
        return;
      }

      const loader = new THREE.GLTFLoader();
      loader.load(
        options.url,
        function (gltf) {
          const model = gltf && gltf.scene;
          if (!model) {
            setImportedRobotStatus(options.name + " file did not contain a scene.");
            return;
          }

          // Normalize the real footprint to the presentation scale used by the
          // mastery field, center the chassis, and sink it slightly into the
          // floor so wheel contact reads clearly. STEP-derived assets retain
          // their CAD Z-up orientation and are rotated before measuring bounds.
          if (options.rotation) {
            model.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
          }
          model.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(model);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const wheelBounds = new THREE.Box3();
          const wheelCenters = [];
          CAD_WHEEL_ORDER.forEach(function (name) {
            const wheel = model.getObjectByName && model.getObjectByName("telemark-cad-wheel-" + name);
            if (wheel) {
              wheelBounds.union(importedCadBounds(THREE, wheel));
              wheelCenters.push(importedCadCenter(THREE, wheel));
            }
          });
          const driveCenter = wheelCenters.length
            ? wheelCenters.reduce(function (total, wheelCenter) {
                return total.add(wheelCenter);
              }, new THREE.Vector3()).multiplyScalar(1 / wheelCenters.length)
            : center;
          const groundY = wheelBounds.isEmpty() ? bounds.min.y : wheelBounds.min.y;
          const footprint = Math.max(size.x, size.z);
          const scale = footprint > 0 ? (options.footprint || 2.15) / footprint : 1;
          model.scale.setScalar(scale);
          model.position.set(
            -driveCenter.x * scale,
            -groundY * scale + (options.groundClearance || 0),
            -driveCenter.z * scale
          );

          model.traverse(function (object) {
            if (!object.isMesh) return;
            object.castShadow = options.castShadow !== false;
            object.receiveShadow = false;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(function (entry) {
              if (!entry) return;
              entry.side = THREE.FrontSide;
              entry.needsUpdate = true;
            });
          });

          robot.add(model);
          setImportedRobotStatus(options.loadedMessage);
          if (typeof options.onLoad === "function") options.onLoad(model, scale);
        },
        function (event) {
          if (!event || !event.total) return;
          const percent = Math.min(100, Math.round(event.loaded / event.total * 100));
          setImportedRobotStatus("Loading " + options.name + "… " + percent + "%");
        },
        function (error) {
          console.error("[Imported robot model]", error);
          setImportedRobotStatus(options.name + " could not be loaded.");
        }
      );
    });
  }

  function loadDecodeRobot(THREE, robot, onLoad, destinationUnit) {
    loadImportedRobot(THREE, robot, {
      name: "DECODE competition robot model",
      url: DECODE_ROBOT_MODEL_URL,
      // The DECODE field is rendered at twice its real dimensions, so the
      // 18-inch robot uses the same scale instead of the enlarged lesson view.
      footprint: Number(destinationUnit) >= 13 ? 1.18 : 2.15,
      groundClearance: 0,
      loadedMessage: "Optimized team CAD model · real wheels driven by student code",
      onLoad: onLoad
    });
  }

  function loadQuixilverRobot(THREE, robot, onLoad) {
    loadImportedRobot(THREE, robot, {
      name: "Quixilver 8404 robot",
      url: QUIXILVER_ROBOT_MODEL_URL,
      footprint: 2.4,
      rotation: [Math.PI / 2, 0, 0],
      groundClearance: 0,
      loadedMessage: "Full Team 8404 CAD · real wheels and mechanism driven by student code",
      onLoad: onLoad
    });
  }

  function load2025FtcRobot(THREE, robot, onLoad) {
    loadImportedRobot(THREE, robot, {
      name: "2025 FTC Robot",
      url: FTC_2025_ROBOT_MODEL_URL,
      footprint: 2.15,
      rotation: [-Math.PI / 2, 0, 0],
      groundClearance: 0,
      castShadow: false,
      loadedMessage: "Manning competition CAD · real wheels driven by student code",
      onLoad: onLoad
    });
  }

  function load2024CenterstageRobot(THREE, robot, onLoad) {
    loadImportedRobot(THREE, robot, {
      name: "2024 FTC Robot — CENTERSTAGE",
      url: FTC_2024_ROBOT_MODEL_URL,
      footprint: 2.15,
      rotation: [-Math.PI / 2, 0, 0],
      groundClearance: 0,
      castShadow: false,
      loadedMessage: "Manning CENTERSTAGE CAD · real wheels and intake driven by student code",
      onLoad: onLoad
    });
  }

  function load17438Robot(THREE, robot, onLoad) {
    loadImportedRobot(THREE, robot, {
      name: "FTC 17438 Input/Output robot",
      url: FTC_17438_ROBOT_MODEL_URL,
      footprint: 2.15,
      groundClearance: 0,
      castShadow: false,
      loadedMessage: "FTC 17438 Input/Output CAD · real wheels and front arm driven by student code",
      onLoad: onLoad
    });
  }

  function load11115Robot(THREE, robot, onLoad) {
    loadImportedRobot(THREE, robot, {
      name: "FTC 11115 Gluten Free SKYSTONE robot",
      url: FTC_11115_ROBOT_MODEL_URL,
      footprint: 2.2,
      rotation: [-Math.PI / 2, 0, 0],
      groundClearance: 0,
      castShadow: false,
      loadedMessage: "Team 11115 CAD · one-motor DR4B linkage driven by student code",
      onLoad: onLoad
    });
  }

  function loadCadRobotForUnit(sourceUnit, THREE, robot, onLoad, destinationUnit) {
    if (sourceUnit === 2) return loadDecodeRobot(THREE, robot, onLoad, destinationUnit);
    if (sourceUnit === 3) return loadQuixilverRobot(THREE, robot, onLoad);
    if (sourceUnit === 4) return load2025FtcRobot(THREE, robot, onLoad);
    if (sourceUnit === 5) return load2024CenterstageRobot(THREE, robot, onLoad);
    if (sourceUnit === 6) return load17438Robot(THREE, robot, onLoad);
    if (sourceUnit === 8) return load11115Robot(THREE, robot, onLoad);
    return null;
  }

  function createChallengeRobot(unit, challengeMotion) {
    const THREE = global.THREE;
    const scene = global.scene;
    const cadSourceUnit = cadSourceUnitFor(unit);
    const profile = robotProfileForUnit(unit);
    if (!THREE || !scene || !profile) return null;
    const motion = challengeMotion || global.TelemarkMasteryMotion.create(unit);
    let modelReady = !cadSourceUnit;
    if (cadSourceUnit) {
      const button = document.getElementById('sim-btn-run');
      if (button) { button.disabled = true; button.textContent = 'Loading robot…'; }
    }

    const oldVisual = scene.getObjectByName && scene.getObjectByName("mastery-challenge-visual");
    if (oldVisual) scene.remove(oldVisual);

    const visual = new THREE.Group();
    visual.name = "mastery-challenge-visual";
    visual.userData.isModelReady = function () { return modelReady; };
    const robot = new THREE.Group();
    robot.name = "unit-" + unit + "-challenge-robot";
    visual.add(robot);
    scene.add(visual);

    function material(color, options) {
      const settings = options || {};
      return new THREE.MeshPhongMaterial({
        color: color,
        emissive: settings.emissive || 0x000000,
        emissiveIntensity: settings.emissiveIntensity || 0,
        shininess: settings.shininess == null ? 55 : settings.shininess,
        transparent: Boolean(settings.transparent),
        opacity: settings.opacity == null ? 1 : settings.opacity,
        side: settings.side
      });
    }

    const frameMat = material(0xb8c4cc, {shininess: 85});
    const darkMat = material(0x18232d, {shininess: 35});
    const tireMat = material(0x111318, {shininess: 10});
    const accentMat = material(profile.accent, {emissive: profile.accent, emissiveIntensity: 0.08});
    const warningMat = material(0xfbbf24, {emissive: 0x6b4500, emissiveIntensity: 0.22});
    const sensorMat = material(0x0f172a, {shininess: 95});
    const redMat = material(0xef4444, {emissive: 0x7f1d1d, emissiveIntensity: 0.2});
    const greenMat = material(0x22c55e, {emissive: 0x14532d, emissiveIntensity: 0.22});
    const blueMat = material(0x3b82f6, {emissive: 0x1e3a8a, emissiveIntensity: 0.22});

    function mesh(geometry, meshMaterial, position, rotation, parent) {
      const item = new THREE.Mesh(geometry, meshMaterial);
      const xyz = position || [0, 0, 0];
      const rxyz = rotation || [0, 0, 0];
      item.position.set(xyz[0], xyz[1], xyz[2]);
      item.rotation.set(rxyz[0], rxyz[1], rxyz[2]);
      item.castShadow = true;
      item.receiveShadow = true;
      (parent || robot).add(item);
      return item;
    }

    function box(size, position, meshMaterial, parent, rotation) {
      return mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), meshMaterial, position, rotation, parent);
    }

    function cylinder(radius, depth, position, meshMaterial, rotation, parent, segments) {
      return mesh(
        new THREE.CylinderGeometry(radius, radius, depth, segments || 20),
        meshMaterial,
        position,
        rotation,
        parent
      );
    }

    function sphere(radius, position, meshMaterial, parent) {
      return mesh(new THREE.SphereGeometry(radius, 18, 12), meshMaterial, position, null, parent);
    }

    function visibleRoller(radius, depth, position, meshMaterial, rotation, parent) {
      const mount = new THREE.Group();
      mount.position.set(position[0], position[1], position[2]);
      const rxyz = rotation || [0, 0, 0];
      mount.rotation.set(rxyz[0], rxyz[1], rxyz[2]);
      (parent || robot).add(mount);
      const rotor = new THREE.Group();
      mount.add(rotor);
      mesh(new THREE.CylinderGeometry(radius, radius, depth, 24), meshMaterial, [0, 0, 0], null, rotor);
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI / 2;
        const vane = box([0.055, depth * 1.04, 0.09], [Math.cos(angle) * radius * 1.03, 0, Math.sin(angle) * radius * 1.03], darkMat, rotor);
        vane.rotation.y = -angle;
      }
      return rotor;
    }

    function rigCadMechanism(model, pivotFractions) {
      const part = model.getObjectByName && model.getObjectByName("telemark-cad-mechanism");
      if (!part) {
        setImportedRobotStatus("The optimized CAD is missing its movable mechanism node.");
        return null;
      }
      robot.updateMatrixWorld(true);
      const bounds = importedCadBounds(THREE, part);
      const fractions = pivotFractions || [0.5, 0.5, 0.5];
      const pivotWorld = new THREE.Vector3(
        THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, fractions[0]),
        THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, fractions[1]),
        THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, fractions[2])
      );
      const pivot = new THREE.Group();
      pivot.name = "telemark-cad-mechanism-pivot";
      robot.add(pivot);
      pivot.position.copy(robot.worldToLocal(pivotWorld.clone()));
      robot.updateMatrixWorld(true);
      pivot.attach(part);
      return pivot;
    }

    function rigCadTranslation(model) {
      const part = model.getObjectByName && model.getObjectByName("telemark-cad-mechanism");
      if (!part) {
        setImportedRobotStatus("The optimized CAD is missing its movable mechanism node.");
        return null;
      }
      const travel = new THREE.Group();
      travel.name = "telemark-cad-mechanism-travel";
      robot.add(travel);
      robot.updateMatrixWorld(true);
      travel.attach(part);
      return travel;
    }

    function rig11115Lift(model, modelScale) {
      function part(name) {
        return model.getObjectByName && model.getObjectByName(name);
      }

      function pivotPart(name) {
        const movingPart = part(name);
        const rawPivot = movingPart && movingPart.userData && movingPart.userData.telemarkCadPivot;
        if (!movingPart || !Array.isArray(rawPivot)) return null;
        model.updateWorldMatrix(true, false);
        const pivotWorld = model.localToWorld(new THREE.Vector3(rawPivot[0], rawPivot[1], rawPivot[2]));
        const pivot = new THREE.Group();
        pivot.name = name + "-pivot";
        robot.add(pivot);
        pivot.position.copy(robot.worldToLocal(pivotWorld.clone()));
        robot.updateMatrixWorld(true);
        pivot.attach(movingPart);
        pivot.userData.restPosition = pivot.position.clone();
        return pivot;
      }

      function travelPart(name) {
        const movingPart = part(name);
        if (!movingPart) return null;
        const travel = new THREE.Group();
        travel.name = name + "-travel";
        robot.add(travel);
        robot.updateMatrixWorld(true);
        travel.attach(movingPart);
        travel.userData.restPosition = travel.position.clone();
        return travel;
      }

      const rig = {
        lowerLow: pivotPart("telemark-cad-lift-lower-low"),
        lowerHigh: pivotPart("telemark-cad-lift-lower-high"),
        upperLow: pivotPart("telemark-cad-lift-upper-low"),
        upperHigh: pivotPart("telemark-cad-lift-upper-high"),
        middle: travelPart("telemark-cad-lift-middle"),
        carriage: travelPart("telemark-cad-lift-carriage"),
        scale: modelScale
      };
      if (Object.values(rig).some(function (value) { return value == null; })) {
        setImportedRobotStatus("The optimized Team 11115 CAD is missing a lift linkage group.");
        return null;
      }
      return rig;
    }

    function animate11115Lift(rig) {
      const progress = THREE.MathUtils.clamp((motion.state.slidePosition - 0.72) / 1.10, 0, 1);
      const restingAngle = 0.322;
      const deployedAngle = 1.32;
      const angle = THREE.MathUtils.lerp(restingAngle, deployedAngle, progress);
      const deltaAngle = angle - restingAngle;
      const linkLength = 0.441;
      const baseMidpoint = {x: -0.2, z: 0.2685};
      const middleRest = {x: 0.2195, z: 0.408};
      const middleNow = {
        x: baseMidpoint.x + linkLength * Math.cos(angle),
        z: baseMidpoint.z + linkLength * Math.sin(angle)
      };
      const middleDelta = {
        x: middleNow.x - middleRest.x,
        z: middleNow.z - middleRest.z
      };
      const upperAnchorRest = {x: 0.2195, z: 0.306};
      const topRest = {x: -0.2, z: 0.4455};
      const upperAngle = Math.PI - angle;
      const topNow = {
        x: upperAnchorRest.x + middleDelta.x + linkLength * Math.cos(upperAngle),
        z: upperAnchorRest.z + middleDelta.z + linkLength * Math.sin(upperAngle)
      };
      const topDelta = {x: topNow.x - topRest.x, z: topNow.z - topRest.z};

      rig.lowerLow.rotation.z = deltaAngle;
      rig.lowerHigh.rotation.z = deltaAngle;
      [rig.upperLow, rig.upperHigh].forEach(function (pivot) {
        pivot.rotation.z = -deltaAngle;
        pivot.position.copy(pivot.userData.restPosition);
        pivot.position.x += middleDelta.x * rig.scale;
        pivot.position.y += middleDelta.z * rig.scale;
      });
      rig.middle.position.copy(rig.middle.userData.restPosition);
      rig.middle.position.x += middleDelta.x * rig.scale;
      rig.middle.position.y += middleDelta.z * rig.scale;
      rig.carriage.position.copy(rig.carriage.userData.restPosition);
      rig.carriage.position.x += topDelta.x * rig.scale;
      rig.carriage.position.y += topDelta.z * rig.scale;
    }

    function rigCadChassis(model) {
      const rigged = [];
      CAD_WHEEL_ORDER.forEach(function (name) {
        const part = model.getObjectByName && model.getObjectByName("telemark-cad-wheel-" + name);
        if (!part) return;
        const spinAxis = part.userData && part.userData.spinAxis || profile.wheelAxis || "x";
        robot.updateMatrixWorld(true);
        const center = importedCadCenter(THREE, part);
        const pivot = new THREE.Group();
        pivot.name = "telemark-cad-wheel-pivot-" + name;
        robot.add(pivot);
        pivot.position.copy(robot.worldToLocal(center.clone()));
        robot.updateMatrixWorld(true);
        pivot.attach(part);
        rigged.push({object: pivot, axis: spinAxis, name: name});
      });
      if (rigged.length !== CAD_WHEEL_ORDER.length) {
        setImportedRobotStatus("The optimized CAD is missing one or more movable wheel nodes.");
      }
      wheels.splice(0, wheels.length);
      CAD_WHEEL_ORDER.forEach(function (name) {
        const wheel = rigged.find(function (entry) { return entry.name === name; });
        if (wheel) wheels.push(wheel);
      });
      return rigged.length === CAD_WHEEL_ORDER.length;
    }

    function rigDecodeMechanisms(model) {
      const rig = {};
      const intakeStages = ["intake-stage-1", "intake-stage-2", "intake-stage-3"];
      const mechanismNames = intakeStages.concat(["transfer", "flywheel", "trigger"]);
      mechanismNames.forEach(function (name) {
        const part = model.getObjectByName && model.getObjectByName("telemark-cad-" + name);
        if (!part) return;
        robot.updateMatrixWorld(true);
        const storedPivot = part.userData && part.userData.telemarkCadPivot;
        let center = importedCadCenter(THREE, part);
        if (Array.isArray(storedPivot) && storedPivot.length === 3) {
          part.updateWorldMatrix(true, false);
          center = part.localToWorld(new THREE.Vector3(storedPivot[0], storedPivot[1], storedPivot[2]));
        }
        const pivot = new THREE.Group();
        pivot.name = "telemark-cad-" + name + "-pivot";
        robot.add(pivot);
        pivot.position.copy(robot.worldToLocal(center.clone()));
        robot.updateMatrixWorld(true);
        pivot.attach(part);
        rig[name] = {
          object: pivot,
          axis: part.userData && part.userData.spinAxis || "x"
        };
      });
      if (mechanismNames.some(function (name) { return !rig[name]; })) {
        setImportedRobotStatus("The optimized DECODE competition CAD is missing an animated mechanism.");
        return null;
      }
      rig.intakeStages = intakeStages.map(function (name) { return rig[name]; });
      return rig;
    }

    const wheels = [];
    if (!cadSourceUnit) {
      // The generated challenge robots share a competition-scale chassis.
      // Units 2–6 use imported full-robot CAD models instead.
      box([1.85, 0.22, 1.35], [0, 0.34, 0], darkMat);
      box([1.72, 0.10, 1.18], [0, 0.49, 0], accentMat);
      [-0.78, 0.78].forEach(function (x) {
        box([0.09, 0.15, 1.3], [x, 0.59, 0], frameMat);
      });
      [-1, 1].forEach(function (side) {
        [-0.48, 0.48].forEach(function (z) {
          wheels.push(cylinder(0.27, 0.20, [side * 1.0, 0.29, z], tireMat, [0, 0, Math.PI / 2]));
        });
      });
      box([0.68, 0.23, 0.48], [0, 0.67, 0.12], sensorMat);
      box([0.48, 0.025, 0.34], [0, 0.795, 0.12], accentMat);
    }

    let animation = null;
    let motionReadout = null;
    let decodeGameView = null;

    function generatedMotionText() {
      const power = Number(motion.state.primaryPower || 0);
      const direction = power > 0.02 ? "forward" : power < -0.02 ? "reverse" : "stopped";
      if (unit === 7) return "Mechanism " + direction + " · power " + power.toFixed(2);
      if (unit === 9) {
        const position = motion.servoValues()[0];
        return "Intake " + direction + " · gripper " + (position == null ? "waiting" : Math.round(position * 100) + "%");
      }
      if (unit === 11) return "Intake " + direction + " · power " + power.toFixed(2);
      if (unit === 13) {
        return "DECODE mechanisms " + direction + " · coordinated by RobotHardware";
      }
      return "Student hardware output drives this model";
    }

    function applyDriveState() {
      const driveYaw = profile.driveYaw || 0;
      const wheelSpinSign = profile.wheelSpinSign == null ? -1 : profile.wheelSpinSign;
      const cosYaw = Math.cos(driveYaw);
      const sinYaw = Math.sin(driveYaw);
      robot.position.x = cosYaw * motion.state.x + sinYaw * motion.state.z;
      robot.position.z = -sinYaw * motion.state.x + cosYaw * motion.state.z;
      robot.rotation.y = (profile.modelYaw || 0) - motion.state.heading;
      wheels.forEach(function (wheel, index) {
        const object = wheel.object || wheel;
        const axis = wheel.axis || "x";
        const motionIndex = profile.wheelMotionOrder ? profile.wheelMotionOrder[index] : index;
        // Match each CAD axle and physical side to the simulator's driving frame.
        object.rotation[axis] = wheelSpinSign * motion.state.wheelAngles[motionIndex];
      });
    }

    let decodeMechanisms = null;

    let visionCameraHead = null;
    let limelightIndicator = null;
    let autonomousPath = null;
    if (unit === 14) {
      box([0.1, 0.92, 0.1], [0, 1.08, -0.12], frameMat);
      visionCameraHead = new THREE.Group();
      visionCameraHead.name = "telemark-cad-vision-camera";
      visionCameraHead.position.set(0, 1.55, -0.12);
      robot.add(visionCameraHead);
      box([0.52, 0.28, 0.3], [0, 0, 0], darkMat, visionCameraHead);
      cylinder(0.1, 0.08, [0, 0, -0.19], blueMat, [Math.PI / 2, 0, 0], visionCameraHead);
      [-1.45, 0, 1.45].forEach(function (x, index) {
        const zoneMat = index === 0 ? redMat : index === 1 ? warningMat : greenMat;
        const zone = box([0.9, 0.025, 0.9], [x, 0.025, -2.05], zoneMat, visual);
        zone.name = "telemark-vision-zone-" + ["left", "center", "right"][index];
        box([0.42, 0.65, 0.06], [x, 0.34, -2.47], sensorMat, visual);
        box([0.24, 0.24, 0.025], [x, 0.38, -2.51], zoneMat, visual);
      });
    }
    if (unit === 15) {
      box([0.1, 0.72, 0.1], [-0.45, 1.0, -0.02], frameMat);
      limelightIndicator = box(
        [0.42, 0.25, 0.28],
        [-0.45, 1.4, -0.02],
        material(0x18232d, {emissive: 0x064e3b, emissiveIntensity: 0.18})
      );
      limelightIndicator.name = "telemark-cad-limelight";
      cylinder(0.09, 0.08, [-0.45, 1.4, -0.2], greenMat, [Math.PI / 2, 0, 0]);
      autonomousPath = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-2.55, 0.04, 2.1),
        new THREE.Vector3(2.6, 0.04, 1.4),
        new THREE.Vector3(1.9, 0.04, -2.25)
      );
      const pathLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(autonomousPath.getPoints(48)),
        new THREE.LineBasicMaterial({color: profile.accent, transparent: true, opacity: 0.75})
      );
      pathLine.name = "telemark-autonomous-path";
      visual.add(pathLine);
    }

    function animateDecodeMechanisms() {
      if (!decodeMechanisms) return;
      decodeMechanisms.intakeStages.forEach(function (stage) {
        stage.object.rotation[stage.axis] = motion.state.intakeAngle;
      });
      decodeMechanisms.transfer.object.rotation[decodeMechanisms.transfer.axis] = motion.state.transferAngle;
      decodeMechanisms.flywheel.object.rotation[decodeMechanisms.flywheel.axis] = motion.state.flywheelAngle;
      decodeMechanisms.trigger.object.rotation[decodeMechanisms.trigger.axis] = motion.state.triggerAngle;
    }

    if (cadSourceUnit) {
      let cadMechanism = null;
      let glutenFreeLift = null;
      loadCadRobotForUnit(cadSourceUnit, THREE, robot, function (model, modelScale) {
        rigCadChassis(model);
        if (unit >= 13) decodeMechanisms = rigDecodeMechanisms(model);
        if (unit >= 13 && !decodeMechanisms) return;
        if (cadSourceUnit === 8) glutenFreeLift = rig11115Lift(model, modelScale);
        if (cadSourceUnit === 8 && !glutenFreeLift) return;
        modelReady = true;
        const button = document.getElementById('sim-btn-run');
        if (button) { button.disabled = false; button.textContent = 'Init'; }
        if (unit >= 13) {
          setImportedRobotStatus("Optimized team CAD · real wheels, three-stage intake, anti-jam transfer, flywheel, and trigger driven by student code");
        }
        if (model.getObjectByName && model.getObjectByName("telemark-cad-mechanism")) {
          if (cadSourceUnit === 3) cadMechanism = rigCadTranslation(model);
          if (cadSourceUnit === 5) cadMechanism = rigCadMechanism(model, [0.46, 0.505, 0.5]);
          if (cadSourceUnit === 6) cadMechanism = rigCadMechanism(model, [0.5, 0.455, 0.356]);
        }
      }, unit);
      animation = function () {
        if (unit === 15 && autonomousPath && (motion.state.pathProgress > 0 || motion.state.followerActive)) {
          const point = autonomousPath.getPoint(motion.state.pathProgress);
          robot.position.set(point.x, 0, point.z);
        } else {
          applyDriveState();
        }
        if (unit >= 13) {
          animateDecodeMechanisms();
          if (visionCameraHead) visionCameraHead.rotation.y = motion.state.cameraAngle;
          if (limelightIndicator) {
            limelightIndicator.material.emissiveIntensity = motion.state.visionActive ? 0.52 : 0.08;
          }
          return;
        }
        if (cadSourceUnit === 8) {
          if (glutenFreeLift) animate11115Lift(glutenFreeLift);
          return;
        }
        if (!cadMechanism) return;
        if (cadSourceUnit === 3) {
          let extension = motion.state.primaryPosition;
          if (unit === 8) extension = motion.state.slidePosition - 1.25;
          if (unit === 13) extension = motion.state.armAngle;
          cadMechanism.position.x = extension * 0.62;
          return;
        }
        if (cadSourceUnit === 5) {
          let deployment = 0;
          if (unit === 5) deployment = motion.state.primaryPosition;
          if (unit === 15) deployment = motion.servoValues()[0] || 0;
          cadMechanism.rotation.z = deployment * 2.0;
          return;
        }
        if (cadSourceUnit === 6) {
          cadMechanism.rotation.x = -motion.state.armAngle;
        }
      };
    } else if (unit === 7) {
      box([0.48, 0.58, 0.48], [-0.45, 0.92, 0.12], accentMat);
      const subsystemMotor = visibleRoller(0.18, 0.42, [0.42, 0.87, 0.14], warningMat, [Math.PI / 2, 0, 0]);
      box([0.18, 0.18, 0.18], [0.66, 0.68, -0.18], warningMat);
      sphere(0.12, [0.52, 1.16, -0.12], sensorMat);
      box([0.08, 0.65, 0.08], [0.08, 0.96, 0.12], frameMat);
      const mechanismLever = new THREE.Group();
      mechanismLever.position.set(0.42, 0.88, 0.14);
      robot.add(mechanismLever);
      box([0.09, 0.78, 0.09], [0, 0.36, 0], accentMat, mechanismLever);
      sphere(0.11, [0, 0.78, 0], warningMat, mechanismLever);
      animation = function () {
        applyDriveState();
        subsystemMotor.rotation.y = motion.state.primaryAngle;
        mechanismLever.rotation.z = motion.state.primaryPosition;
      };
    } else if (unit === 8) {
      [-0.34, 0.34].forEach(function (x) {
        box([0.11, 1.55, 0.12], [x, 1.22, 0.08], frameMat);
      });
      const carriage = box([0.9, 0.22, 0.48], [0, 1.32, 0.08], accentMat);
      box([0.16, 0.12, 0.18], [0.48, 0.55, 0.08], redMat);
      box([0.16, 0.12, 0.18], [0.48, 1.9, 0.08], greenMat);
      animation = function () {
        applyDriveState();
        carriage.position.y = motion.state.slidePosition;
      };
    } else if (unit === 9) {
      const leftFinger = new THREE.Group();
      const rightFinger = new THREE.Group();
      leftFinger.position.set(-0.35, 0.76, -0.72);
      rightFinger.position.set(0.35, 0.76, -0.72);
      robot.add(leftFinger);
      robot.add(rightFinger);
      box([0.28, 0.25, 0.28], [0, 0, 0], accentMat, leftFinger);
      box([0.13, 0.64, 0.16], [0, -0.28, -0.18], frameMat, leftFinger, [0.22, 0, 0]);
      box([0.28, 0.25, 0.28], [0, 0, 0], accentMat, rightFinger);
      box([0.13, 0.64, 0.16], [0, -0.28, -0.18], frameMat, rightFinger, [0.22, 0, 0]);
      const intake = visibleRoller(0.15, 0.9, [0, 0.38, -0.82], warningMat, [0, 0, Math.PI / 2]);
      const intakeSample = sphere(0.16, [0, 0.22, -1.38], blueMat);
      animation = function (_time, dt) {
        applyDriveState();
        const positions = motion.servoValues();
        const left = positions[0] == null ? 0 : positions[0];
        const right = positions[1] == null ? left : positions[1];
        leftFinger.rotation.z = -(0.08 + left * 0.44);
        rightFinger.rotation.z = 0.08 + right * 0.44;
        intake.rotation.y = motion.state.primaryAngle;
        intakeSample.position.z = THREE.MathUtils.clamp(
          intakeSample.position.z + motion.state.primaryPower * dt * 0.95,
          -1.48,
          -0.48
        );
      };
    } else if (unit === 10) {
      wheels.forEach(function (wheel) {
        const ring = mesh(new THREE.TorusGeometry(0.205, 0.026, 8, 24), accentMat, wheel.position.toArray(), [0, Math.PI / 2, 0]);
        ring.userData.encoderRing = true;
      });
      box([0.08, 0.42, 0.08], [0, 0.74, -0.45], warningMat, null, [Math.PI / 4, 0, 0]);
      animation = applyDriveState;
    } else if (unit === 11) {
      const intake = visibleRoller(0.18, 1.25, [0, 0.35, -0.86], warningMat, [0, 0, Math.PI / 2]);
      box([0.15, 0.15, 0.15], [-0.56, 0.62, -0.64], redMat);
      box([0.15, 0.15, 0.15], [-0.2, 0.62, -0.64], greenMat);
      box([0.15, 0.15, 0.15], [0.2, 0.62, -0.64], blueMat);
      sphere(0.11, [0.56, 0.62, -0.64], sensorMat);
      cylinder(0.09, 0.38, [0.72, 0.82, 0.12], accentMat, [Math.PI / 2, 0, 0]);
      const sensedSampleMaterial = material(0xef4444, {emissive: 0x5f1111, emissiveIntensity: 0.2});
      const sensedSample = sphere(0.18, [0, 0.22, -1.52], sensedSampleMaterial);
      animation = function (_time, dt) {
        applyDriveState();
        intake.rotation.y = motion.state.primaryAngle;
        sensedSample.position.z = THREE.MathUtils.clamp(
          sensedSample.position.z + motion.state.primaryPower * dt * 0.95,
          -1.58,
          -0.5
        );
        const colorSensor = global.hardwareMap && global.hardwareMap._devices && global.hardwareMap._devices.intake_color;
        if (colorSensor && colorSensor.blue() > colorSensor.red()) sensedSampleMaterial.color.setHex(0x3b82f6);
        else sensedSampleMaterial.color.setHex(0xef4444);
      };
    } else if (unit === 12) {
      box([0.38, 0.24, 0.38], [0, 0.87, 0.1], accentMat);
      box([0.62, 0.045, 0.045], [0.31, 1.08, 0.1], redMat);
      box([0.045, 0.62, 0.045], [0, 1.08, 0.1], greenMat);
      box([0.045, 0.045, 0.62], [0, 1.08, -0.21], blueMat);
      wheels.forEach(function (wheel, index) {
        box([0.05, 0.36, 0.08], [wheel.position.x, wheel.position.y, wheel.position.z], accentMat, null, [0.65, 0, index % 2 ? 0.65 : -0.65]);
      });
      animation = applyDriveState;
    }

    const sceneContainer = document.getElementById("sim-scene-container");
    if (sceneContainer) {
      const oldLabel = document.getElementById("mastery-robot-label");
      if (oldLabel) oldLabel.remove();
      const label = document.createElement("div");
      label.id = "mastery-robot-label";
      label.className = "mastery-robot-label";
      label.textContent = profile.name;
      const detail = document.createElement("span");
      detail.className = "mastery-robot-status";
      detail.textContent = profile.detail;
      label.appendChild(detail);
      if (!cadSourceUnit) {
        motionReadout = document.createElement("span");
        motionReadout.className = "mastery-motion-readout";
        motionReadout.textContent = generatedMotionText();
        label.appendChild(motionReadout);
      }
      if (profile.sourceUrl && profile.sourceLabel) {
        const source = document.createElement("a");
        source.className = "mastery-robot-source";
        source.href = profile.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Source: " + profile.sourceLabel;
        source.setAttribute("aria-label", profile.sourceLabel + " (opens in a new tab)");
        label.appendChild(source);
      }
      sceneContainer.appendChild(label);
    }

    if (typeof global.setCameraOrbit === "function") {
      const groundView = unit === 2 || unit === 13;
      global.setCameraOrbit({
        theta: groundView ? 0.82 : 0.56,
        phi: unit === 13 ? 0.92 : (groundView ? 1.2 : 0.78),
        radius: unit === 8 ? 8.0 : (unit === 13 ? 11.0 : (unit >= 14 ? 6.8 : 5.2)),
        target: {
          x: 0,
          y: unit === 8 ? 1.5 : (groundView ? 0.42 : 0.72),
          z: unit >= 14 ? -0.35 : 0
        }
      });
    }
    if (unit === 13 && global.TelemarkDecodeGameView) {
      decodeGameView = global.TelemarkDecodeGameView.mount({
        THREE: THREE,
        visual: visual,
        robot: robot,
        motion: motion,
        hardwareMap: global.hardwareMap,
        getGamepad: function () { return global.gamepad || {}; }
      });
      visual.userData.decodeGameView = decodeGameView;
    }
    if (animation && typeof global.addAnimationCallback === "function") {
      let previousTime = Date.now() * 0.001;
      global.addAnimationCallback(function () {
        const currentTime = Date.now() * 0.001;
        const dt = currentTime - previousTime;
        previousTime = currentTime;
        if (!modelReady) return;
        motion.step(dt);
        const imu = global.hardwareMap && global.hardwareMap._devices && global.hardwareMap._devices.imu;
        // motion.heading is clockwise-positive in the Three.js field; FTC IMU
        // yaw is counterclockwise-positive. Expose it once with no joystick
        // sign conversion so student field-centric math does not get doubled.
        if (imu && typeof imu._setHeading === "function") imu._setHeading(-motion.state.heading);
        animation(currentTime, dt);
        if (decodeGameView) decodeGameView.update(dt);
        if (motionReadout) motionReadout.textContent = generatedMotionText();
      });
    }
    visual.userData.challengeMotion = motion;
    return visual;
  }

  function sourceWithoutComments(source) {
    return String(source || "")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n\r]*/g, " ");
  }

  function checksForUnit(unit) {
    const config = CONFIGS[unit];
    if (!config) return [];
    if (!config.registration) return config.checks.slice();
    const autonomous = config.registration === "autonomous";
    const className = autonomous ? "FullAutonomous" : "CompetitionTeleOp";
    const annotation = autonomous ? "Autonomous" : "TeleOp";
    const parent = autonomous ? "LinearOpMode" : "OpMode";
    const registrationCheck = Object.freeze({
      id: "unit-" + String(unit).padStart(2, "0") + "-registration",
      label: autonomous
        ? "Keep FullAutonomous registered as an FTC autonomous OpMode"
        : "Keep CompetitionTeleOp registered as an iterative FTC TeleOp",
      structural: Object.freeze({
        patterns: Object.freeze([
          new RegExp("import\\s+com\\.qualcomm\\.robotcore\\.eventloop\\.opmode\\.(?:" + parent + "|\\*)\\s*;"),
          new RegExp("import\\s+com\\.qualcomm\\.robotcore\\.eventloop\\.opmode\\.(?:" + annotation + "|\\*)\\s*;"),
        ]),
        ast: {classes: [{name: className, superClass: parent, annotations: [annotation], modifiers: ["public"]}]}
      }),
      behavioralFixtures: Object.freeze([]),
      diagnostic: className + " needs its public @" + annotation + " registration and " + parent + " inheritance."
    });
    return [registrationCheck].concat(config.checks);
  }

  function namedClassBody(code, className) {
    const classPattern = new RegExp("\\bclass\\s+" + className + "\\b");
    const classStart = code.search(classPattern);
    const openBrace = classStart >= 0 ? code.indexOf("{", classStart) : -1;
    if (openBrace < 0) return "";
    let depth = 1;
    for (let index = openBrace + 1; index < code.length; index += 1) {
      if (code[index] === "{") depth += 1;
      if (code[index] === "}") depth -= 1;
      if (depth === 0) return code.slice(openBrace + 1, index);
    }
    return "";
  }

  function hasNoRawMechanismAccess(opModeBody) {
    return Boolean(opModeBody)
      && /\bRobotHardware\b/.test(opModeBody)
      && !/hardwareMap\s*\.\s*get\s*\(\s*(?:DcMotor|DcMotorEx|CRServo|Servo|IMU)\s*\.\s*class/.test(opModeBody)
      && !/\b(?:DcMotor|DcMotorEx|CRServo|Servo|IMU)\s+\w+/.test(opModeBody);
  }

  function astMatches(ast, rule) {
    if (!rule) return true;
    function classMatches(spec) {
      const classNode = (ast.classes || []).find(function (candidate) { return candidate.name === spec.name; });
      if (!classNode) return false;
      if (spec.superClass && classNode.superClass !== spec.superClass) return false;
      if ((spec.modifiers || []).some(function (modifier) { return (classNode.modifiers || []).indexOf(modifier) < 0; })) return false;
      if ((spec.annotations || []).some(function (annotation) { return (classNode.annotations || []).indexOf(annotation) < 0; })) return false;
      if ((spec.methods || []).some(function (name) { return !(classNode.methods || []).some(function (method) { return method.name === name; }); })) return false;
      const calls = (classNode.methods || []).reduce(function (all, method) { return all.concat(method.calls || []); }, []);
      if ((spec.calls || []).some(function (name) { return !calls.some(function (call) { return call.name === name; }); })) return false;
      return (spec.fields || []).every(function (fieldSpec) {
        return (classNode.fields || []).some(function (field) {
          if (fieldSpec.type && field.type !== fieldSpec.type) return false;
          if (fieldSpec.static != null && field.static !== fieldSpec.static) return false;
          if (fieldSpec.final != null && field.final !== fieldSpec.final) return false;
          return (fieldSpec.modifiers || []).every(function (modifier) { return (field.modifiers || []).indexOf(modifier) >= 0; });
        });
      });
    }
    if (!(rule.classes || []).every(classMatches)) return false;
    if (rule.anyClass) {
      return (ast.classes || []).some(function (classNode) {
        return rule.anyClass.names.indexOf(classNode.name) >= 0
          && classNode.superClass === rule.anyClass.superClass;
      });
    }
    return true;
  }

  function createGradingRuntime() {
    const rows = [];
    const runtime = global.TelemarkJava.createRuntime({
      onTelemetryUpdate: function (data) { rows.push.apply(rows, data || []); }
    });
    runtime.__gradingRows = rows;
    return runtime;
  }

  function prepareFixture(program, runtime) {
    resetFixtureGamepad(runtime);
    if (runtime.__gradingRows) runtime.__gradingRows.length = 0;
    if (runtime.devices && typeof runtime.devices.clear === "function") runtime.devices.clear();
    if (typeof runtime.resetRuntime === "function") runtime.resetRuntime();
    if (program.methods.init) program.methods.init();
    if (program.methods.start) program.methods.start();
  }

  function resetFixtureGamepad(runtime) {
    ["left_stick_x", "left_stick_y", "right_stick_x", "right_stick_y", "left_trigger", "right_trigger"].forEach(function (key) {
      runtime.gamepad1[key] = 0;
    });
    ["a", "b", "x", "y", "left_bumper", "right_bumper", "dpad_up", "dpad_down", "dpad_left", "dpad_right"].forEach(function (key) {
      runtime.gamepad1[key] = false;
    });
    Object.keys(runtime.gamepad1 || {}).forEach(function (key) {
      runtime.gamepad1[key] = typeof runtime.gamepad1[key] === "boolean" ? false : 0;
    });
  }

  function runBehavioralFixture(id, program, runtime) {
    try {
      prepareFixture(program, runtime);
      const rows = runtime.__gradingRows || [];
      if (id === "telemetry-init") {
        runtime.updateTelemetry();
        return rows.length > 0;
      }
      if (!program.methods.loop) return false;
      resetFixtureGamepad(runtime);
      if (id === "telemetry-loop") {
        rows.length = 0;
        runtime.gamepad1.left_stick_y = 0.42;
        program.methods.loop();
        runtime.updateTelemetry();
        return rows.length > 0;
      }
      if (id === "mecanum-drive") {
        const names = ["leftFront", "rightFront", "leftBack", "rightBack"];
        const motors = names.map(function (name) { return runtime.devices.get("DcMotor:" + name); });
        if (motors.some(function (motor) { return !motor; })) return false;
        function drive(input) {
          resetFixtureGamepad(runtime);
          Object.assign(runtime.gamepad1, input);
          program.methods.loop();
          return motors.map(function (motor) { return motor.getPower(); });
        }
        const forward = drive({left_stick_y: -1});
        const strafe = drive({left_stick_x: 1});
        const turn = drive({right_stick_x: 1});
        const combined = drive({left_stick_y: -1, left_stick_x: 1, right_stick_x: 1});
        const moves = function (values) { return values.every(Number.isFinite) && values.some(function (value) { return Math.abs(value) > 0.05; }); };
        return moves(forward) && forward.every(function (value) { return value * forward[0] > 0; })
          && moves(strafe) && strafe[0] * strafe[1] < 0 && strafe[0] * strafe[2] < 0 && strafe[0] * strafe[3] > 0
          && moves(turn) && turn[0] * turn[1] < 0 && turn[0] * turn[2] > 0 && turn[1] * turn[3] > 0
          && Math.max.apply(Math, combined.map(Math.abs)) <= 1.0001;
      }
      if (id === "intake-transfer-controls") {
        runtime.gamepad1.right_bumper = true;
        program.methods.loop();
        const intake = runtime.devices.get("DcMotor:intake");
        const transfer = runtime.devices.get("DcMotor:transfer");
        const forward = intake && transfer && intake.getPower() > 0 && transfer.getPower() > 0;
        resetFixtureGamepad(runtime);
        runtime.gamepad1.left_bumper = true;
        program.methods.loop();
        const reverse = intake && transfer && intake.getPower() < 0 && transfer.getPower() < 0;
        resetFixtureGamepad(runtime);
        program.methods.loop();
        return Boolean(forward && reverse && intake.getPower() === 0 && transfer.getPower() === 0);
      }
      if (id === "launcher-trigger-edge") {
        program.methods.loop();
        const servoEntry = Array.from(runtime.devices.entries()).find(function (entry) { return entry[0].indexOf("Servo:") === 0; });
        if (!servoEntry) return false;
        const resting = servoEntry[1].getPosition();
        runtime.gamepad1.a = true;
        program.methods.loop();
        return servoEntry[1].getPosition() !== resting;
      }
      if (id === "storage-full-interlock") {
        Array.from(runtime.devices.entries()).forEach(function (entry) {
          if (entry[0].indexOf("DigitalChannel:") === 0 && entry[1]._setState) entry[1]._setState(false);
        });
        runtime.gamepad1.right_bumper = true;
        program.methods.loop();
        const motors = [runtime.devices.get("DcMotor:intake"), runtime.devices.get("DcMotor:transfer")].filter(Boolean);
        return motors.length === 2 && motors.every(function (motor) { return motor.getPower() === 0; });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function grade(unit, source, compilation, runtime) {
    const code = sourceWithoutComments(source);
    const gradingRuntime = runtime || createGradingRuntime();
    const program = compilation || global.TelemarkJava.compile(source, gradingRuntime, {loopLimit: 2000});
    const criteria = checksForUnit(unit);
    if (!program.ok) {
      const message = program.diagnostics && program.diagnostics[0] && program.diagnostics[0].message || "The complete Java project must compile.";
      return criteria.map(function (criterion) {
        return {id: criterion.id, label: criterion.label, automatic: false, evidence: message};
      });
    }
    const results = criteria.map(function (criterion) {
      const patternsPass = criterion.structural.patterns.every(function (pattern) {
        pattern.lastIndex = 0;
        return pattern.test(code);
      });
      const astPass = patternsPass && astMatches(program.ast, criterion.structural.ast);
      const failedFixtures = [];
      const behaviorPass = astPass && criterion.behavioralFixtures.every(function (fixture) {
        const passed = runBehavioralFixture(fixture, program, gradingRuntime);
        if (!passed) failedFixtures.push(fixture);
        return passed;
      });
      let evidence = "Automatic structural and behavioral checks passed.";
      if (!patternsPass || !astPass) evidence = criterion.diagnostic;
      else if (!behaviorPass) evidence = "Behavior check did not pass: " + failedFixtures.join(", ") + ". " + criterion.diagnostic;
      return {
        id: criterion.id,
        label: criterion.label,
        automatic: Boolean(patternsPass && astPass && behaviorPass),
        evidence: evidence
      };
    });
    if (unit === 7) {
      const passed = !/hardwareMap\s*\.\s*get\s*\(/.test(namedClassBody(code, "CompetitionTeleOp"));
      results[results.length - 1].automatic = passed;
      if (!passed) results[results.length - 1].evidence = "CompetitionTeleOp still maps hardware directly; delegate mapping to subsystem init(HardwareMap) methods.";
    }
    if (unit === 13) {
      const passed = hasNoRawMechanismAccess(namedClassBody(code, "CompetitionTeleOp"));
      results[results.length - 1].automatic = passed;
      if (!passed) results[results.length - 1].evidence = "CompetitionTeleOp must coordinate RobotHardware without declaring or mapping raw mechanisms.";
    }
    if (unit === 15) {
      const passed = hasNoRawMechanismAccess(namedClassBody(code, "FullAutonomous"));
      results[results.length - 1].automatic = passed;
      if (!passed) results[results.length - 1].evidence = "FullAutonomous must coordinate RobotHardware without declaring or mapping raw mechanisms.";
    }
    return results;
  }

  function evaluate(unit, source, compilation, runtime) {
    return grade(unit, source, compilation, runtime).map(function (result) { return result.automatic; });
  }

  function injectChallengeStyles() {
    if (document.getElementById("mastery-summary-styles")) return;
    const style = document.createElement("style");
    style.id = "mastery-summary-styles";
    style.textContent = ""
      + ".mastery-hardware-map{display:flex;align-items:center;gap:8px;margin:6px 10px 0;padding:6px 9px;border:1px solid color-mix(in srgb,var(--border) 78%,transparent);border-radius:7px;background:color-mix(in srgb,var(--panel) 84%,transparent);font-family:var(--font-ui);overflow-x:auto;scrollbar-width:none;white-space:nowrap}"
      + ".mastery-hardware-map::-webkit-scrollbar{display:none}"
      + ".mastery-hardware-title{display:flex;align-items:center;gap:5px;color:var(--text-secondary);font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}"
      + ".mastery-hardware-items{display:flex;align-items:center;gap:6px}"
      + ".mastery-hardware-item{display:inline-flex;align-items:center;gap:4px;color:var(--text-secondary);font-size:.69rem}"
      + ".mastery-hardware-item+ .mastery-hardware-item:before{content:'·';margin-right:2px;color:var(--border)}"
      + ".mastery-hardware-item code{padding:1px 4px;border:1px solid var(--border);border-radius:4px;background:var(--code-bg);color:var(--active);font:.68rem/1.35 var(--font-code)}"
      + ".mastery-sensor-tests{display:flex;align-items:center;gap:4px;margin-left:auto;padding-left:8px;border-left:1px solid var(--border)}"
      + ".mastery-sensor-tests button{padding:3px 7px;border:1px solid var(--border);border-radius:5px;background:var(--code-bg);color:var(--text-secondary);font:600 .65rem/1.25 var(--font-ui);cursor:pointer}"
      + ".mastery-sensor-tests button[aria-pressed='true']{border-color:var(--active);color:var(--active)}"
      + ".mastery-robot-label{position:absolute;left:12px;bottom:12px;z-index:3;max-width:calc(100% - 24px);padding:7px 10px;border:1px solid rgba(34,211,238,.35);border-radius:7px;background:rgba(5,8,13,.82);color:#effbff;font:600 .72rem/1.3 var(--font-code);letter-spacing:.03em;pointer-events:none;backdrop-filter:blur(7px)}"
      + ".mastery-robot-label span{display:block;margin-top:2px;color:rgba(221,241,249,.68);font-family:var(--font-ui);font-weight:400;letter-spacing:0}"
      + ".mastery-robot-label .mastery-motion-readout{margin-top:5px;color:#fde68a;font-family:var(--font-code);font-weight:700}"
      + ".mastery-robot-label a{display:block;margin-top:3px;color:#67e8f9;font-family:var(--font-ui);font-weight:500;letter-spacing:0;pointer-events:auto;text-decoration:none}"
      + ".mastery-robot-label a:hover,.mastery-robot-label a:focus{text-decoration:underline}"
      + ":root[data-theme='light'] .mastery-robot-label,:root[data-telemark-theme='light'] .mastery-robot-label{background:rgba(255,255,255,.86);color:#102a36}"
      + "#sim-scene-container{min-height:260px}"
      + "@media(max-width:1000px){body{flex-direction:column!important}#sim-left-panel{width:100%!important;height:58%!important;min-height:0!important;border-right:0!important;border-bottom:1px solid var(--border)!important}#sim-resizer{display:none!important}.sim-challenge-card{flex:0 0 auto!important}#sim-right-panel{flex:1 1 auto!important;width:100%!important;height:42%!important;min-width:0!important;min-height:290px!important}#sim-right-panel #sim-scene-container{flex:1 1 auto!important;width:calc(100% - 16px)!important;min-height:230px!important;margin:8px!important;aspect-ratio:auto!important}.sim-gamepad-card{width:min(310px,calc(100vw - 16px))!important;right:8px!important;bottom:8px!important}}";
    document.head.appendChild(style);
  }

  function compactEmbeddedControls() {
    if (global.innerWidth > 1000) return;
    global.setTimeout(function () {
      const challengeHeader = document.getElementById("sim-challenge-header");
      if (challengeHeader && challengeHeader.classList.contains("open")) challengeHeader.click();
      const gamepadCollapse = document.getElementById("sim-gp-collapse-btn");
      if (gamepadCollapse && gamepadCollapse.getAttribute("aria-expanded") !== "false") gamepadCollapse.click();
    }, 0);
  }

  function createHardwareMap(unit) {
    const rightPanel = document.getElementById("sim-right-panel");
    const scene = document.getElementById("sim-scene-container");
    if (!rightPanel || !scene) return;
    const old = document.getElementById("mastery-hardware-map");
    if (old) old.remove();
    const panel = document.createElement("section");
    panel.id = "mastery-hardware-map";
    panel.className = "mastery-hardware-map";
    panel.setAttribute("aria-label", "Simulator hardware configuration names");
    const hardware = HARDWARE_PROFILES[unit] || DRIVE_HARDWARE;
    panel.innerHTML = "<span class=\"mastery-hardware-title\"><i class=\"fa-solid fa-microchip\"></i> Hardware</span>"
      + "<span class=\"mastery-hardware-items\">"
      + hardware.map(function (item) {
        return "<span class=\"mastery-hardware-item\"><span>" + item.label + "</span><code>\"" + item.name + "\"</code></span>";
      }).join("")
      + "</span>";
    rightPanel.insertBefore(panel, scene);

    if (unit === 5 || unit === 11) {
      const colorName = "intake_color";
      const distanceName = unit === 5 ? "intake_distance" : "intake_range";
      const colorSensor = global.hardwareMap.get("ColorSensor", colorName);
      const distanceSensor = global.hardwareMap.get("DistanceSensor", distanceName);
      const testControls = document.createElement("span");
      testControls.className = "mastery-sensor-tests";
      testControls.setAttribute("aria-label", "Simulated sorter inputs");
      testControls.innerHTML = ""
        + "<button type=\"button\" data-sorter-sample=\"red\">Red · 7 cm</button>"
        + "<button type=\"button\" data-sorter-sample=\"blue\">Blue · 7 cm</button>"
        + "<button type=\"button\" data-sorter-sample=\"clear\">No sample</button>";
      panel.appendChild(testControls);

      function selectSample(sample) {
        if (sample === "red") {
          colorSensor._setColor(240, 25, 35, 255);
          distanceSensor._setDistance(7 / 2.54);
        } else if (sample === "blue") {
          colorSensor._setColor(25, 35, 240, 255);
          distanceSensor._setDistance(7 / 2.54);
        } else {
          colorSensor._setColor(0, 0, 0, 0);
          distanceSensor._setDistance(30 / 2.54);
        }
        testControls.querySelectorAll("[data-sorter-sample]").forEach(function (button) {
          button.setAttribute("aria-pressed", String(button.dataset.sorterSample === sample));
        });
      }

      testControls.addEventListener("click", function (event) {
        const button = event.target.closest && event.target.closest("[data-sorter-sample]");
        if (button) selectSample(button.dataset.sorterSample);
      });
      selectSample("red");

      if (unit === 11) {
        const storage = global.hardwareMap.get("DigitalChannel", "storage_full");
        const armPot = global.hardwareMap.get("AnalogInput", "arm_pot");
        storage._setState(true);
        armPot._setVoltage(1.65);
        const safetyButton = document.createElement("button");
        safetyButton.type = "button";
        safetyButton.textContent = "Safety: ready";
        safetyButton.setAttribute("aria-pressed", "true");
        safetyButton.addEventListener("click", function () {
          const ready = safetyButton.getAttribute("aria-pressed") !== "true";
          storage._setState(ready);
          armPot._setVoltage(ready ? 1.65 : 3.3);
          safetyButton.setAttribute("aria-pressed", String(ready));
          safetyButton.textContent = ready ? "Safety: ready" : "Safety: blocked";
        });
        testControls.appendChild(safetyButton);
      }
    }
  }

  function install(unit) {
    const config = CONFIGS[unit];
    if (!config) throw new Error("Unknown mastery simulator unit: " + unit);
    const checks = checksForUnit(unit);
    let challengeMotion = null;
    let cumulativeProject = null;
    const projectOptions = decodeProjectOptions(unit, config);

    global.onSimulatorReady = function () {
      if (!global.TelemarkMasteryMotion) {
        throw new Error("The coding challenge motion runtime is unavailable");
      }
      challengeMotion = global.TelemarkMasteryMotion.create(unit);
      global.TelemarkMasteryMotion.installSdkMocks(global, challengeMotion);
      challengeMotion.connectHardwareMap(global.hardwareMap);
      global.__telemarkMasteryMotion = challengeMotion;
      injectChallengeStyles();
      setTelemetryStudentOnly(true);
      const activeScaffold = projectOptions.initialFiles.find(function (file) {
        return file.name === projectOptions.preferredActiveFile;
      });
      setCode(activeScaffold ? activeScaffold.source : config.starter);
      setChallenge({
        title: config.title,
        scenario: config.scenario,
        requirements: checks.map(function (criterion) { return {id: criterion.id, label: criterion.label}; }),
        projectKey: DECODE_PROJECT_KEY,
        lessonId: projectOptions.stage.id,
        successMessage: "All challenge checks passed. Review the simulator behavior before continuing to the next unit."
      });
      setBadges([
        {iconClass: "fa-solid fa-file-code", label: "FTC SDK shell", active: true},
        {iconClass: "fa-solid fa-layer-group", label: "Whole unit", active: true},
        {iconClass: "fa-solid fa-list-check", label: checks.length + " checks", active: true},
        {iconClass: "fa-solid fa-robot", label: robotProfileForUnit(unit).name, active: true}
      ]);
      setActiveInputs(config.inputs || []);
      compactEmbeddedControls();
      createHardwareMap(unit);
      const challengeVisual = createChallengeRobot(unit, challengeMotion);

      function validate() {
        clearHints();
        const source = getCode();
        const gradingRuntime = createGradingRuntime();
        const compilation = global.TelemarkSimulatorBase.compileStudentSource(source, gradingRuntime, {loopLimit: 2000});
        const compilationMessage = compilation.ok ? "Project compiles." : String(compilation.diagnostics[0] && compilation.diagnostics[0].message || "Unable to compile Java");
        if (typeof global.setChallengeCompilation === "function") {
          global.setChallengeCompilation(compilation.ok, compilationMessage);
        }
        if (!compilation.ok) {
          const diagnostic = compilation.diagnostics[0] || {};
          const message = String(diagnostic.message || "Unable to compile Java").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          addHint("Java compile error: " + message, "error");
        }
        if (cumulativeProject) {
          cumulativeProject.prerequisiteDiagnostics().forEach(function (diagnostic) {
            addHint("<i class=\"fa-solid fa-diagram-project\"></i> " + diagnostic.message, "warn");
          });
        }
        const graded = grade(unit, source, compilation, gradingRuntime);
        const results = graded.map(function (result) { return result.automatic; });
        const forbiddenFailures = (config.forbidden || []).filter(function (rule) {
          rule[1].lastIndex = 0;
          return rule[1].test(sourceWithoutComments(source));
        });

        results.forEach(function (passed, index) {
          const evidence = forbiddenFailures.length
            ? forbiddenFailures.map(function (rule) { return rule[0]; }).join(" ")
            : graded[index].evidence;
          setRequirement(index, passed && forbiddenFailures.length === 0, evidence);
        });
        forbiddenFailures.forEach(function (rule) {
          addHint("<i class=\"fa-solid fa-triangle-exclamation\"></i> " + rule[0], "error");
        });
        if (results.every(Boolean) && forbiddenFailures.length === 0) {
          addHint("<i class=\"fa-solid fa-circle-check\"></i> Unit checks passed for the current source.", "info");
        } else if (compilation.ok) {
          addHint("Use the requirement list beside the editor as a debugging map. It describes behavior, not exact code spelling.", "info");
        }
        return results;
      }

      global.onInit = function () {
        if (challengeVisual && !challengeVisual.userData.isModelReady()) {
          addHint('Wait for the robot model to load before initializing.', 'info');
          return false;
        }
        if (challengeVisual && challengeVisual.userData.decodeGameView) {
          challengeVisual.userData.decodeGameView.initialize();
        }
        challengeMotion.setLifecyclePhase("initialized");
        return transpileAndRun(
          getCode(),
          function (initFn) {
            initFn();
            updateTelemetry();
          },
          function (loopFn) {
            global._simStartLoop(loopFn);
          }
        );
      };
      global.onStart = function () {
        challengeMotion.setLifecyclePhase("running");
        if (challengeVisual && challengeVisual.userData.decodeGameView) {
          challengeVisual.userData.decodeGameView.start();
        }
        validate();
        updateTelemetry();
      };
      global.onStop = function () {
        challengeMotion.setLifecyclePhase("stopped");
        if (challengeVisual && challengeVisual.userData.decodeGameView) {
          challengeVisual.userData.decodeGameView.stop();
        }
        updateTelemetry();
        if (global.hardwareMap && typeof global.hardwareMap.stopAll === "function") {
          global.hardwareMap.stopAll();
        }
      };
      global.onReset = function () {
        clearHints();
        if (challengeVisual && challengeVisual.userData.decodeGameView) {
          challengeVisual.userData.decodeGameView.reset();
        }
        checks.forEach(function (_check, index) { setRequirement(index, false); });
      };

      if (global.TelemarkProject) {
        const editor = document.getElementById("sim-code-editor");
        projectOptions.initialFiles = projectOptions.initialFiles.map(function (file) {
          return file.name === projectOptions.preferredActiveFile
            ? {name: file.name, source: editor.value}
            : file;
        });
        cumulativeProject = global.TelemarkProject.attach(editor, null, projectOptions);
        global.onChallengeComplete = function () {
          cumulativeProject.saveSnapshot(projectOptions.stage);
        };
      }
      clearHints();
      checks.forEach(function (_check, index) { setRequirement(index, false); });
    };
  }

  const script = document.currentScript;
  const selectedUnit = Number(script && script.dataset ? script.dataset.unit : 0);
  global.TelemarkMasteryChallenge = Object.freeze({
    configs: CONFIGS,
    decodeProjectKey: DECODE_PROJECT_KEY,
    decodeProjectFiles: DECODE_FILE_STAGES,
    decodeProjectOptions: decodeProjectOptions,
    robotProfiles: ROBOT_PROFILES,
    robotProfileForUnit: robotProfileForUnit,
    cadSourceUnitFor: cadSourceUnitFor,
    checksForUnit: checksForUnit,
    createChallengeRobot: createChallengeRobot,
    grade: grade,
    evaluate: evaluate,
    install: install
  });
  if (selectedUnit) install(selectedUnit);
})(window);
