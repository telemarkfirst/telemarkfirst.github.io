const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const java = require('../static/simulator/telemark-java.js');

const context = {window: {TelemarkJava: java}, document: {currentScript: null}};
vm.runInNewContext(fs.readFileSync('static/simulator/mastery_challenge.js', 'utf8'), context);
const mastery = context.window.TelemarkMasteryChallenge;

const teleOp = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
@TeleOp(name="DECODE Competition TeleOp")
public class CompetitionTeleOp extends OpMode {
  private final RobotHardware robot = new RobotHardware();
  public void init() { robot.init(hardwareMap); }
  public void loop() { robot.update(getRuntime()); }
  public void stop() { robot.stopAll(); }
}`;

const vision = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.qualcomm.robotcore.hardware.WebcamName;
import org.firstinspires.ftc.vision.VisionPortal;
import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;
import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;
import org.opencv.core.Rect;
public class Vision {
  private AprilTagProcessor tags;
  private VisionPortal portal;
  private enum Zone { LEFT, CENTER, RIGHT }
  private Zone selected = Zone.CENTER;
  public void init(HardwareMap hardwareMap) {
    WebcamName camera = hardwareMap.get(WebcamName.class, "Webcam 1");
    tags = AprilTagProcessor.easyCreate();
    portal = new VisionPortal.Builder().setCamera(camera).addProcessor(tags).build();
    Rect left = new Rect(0, 0, 100, 100);
    Rect center = new Rect(100, 0, 100, 100);
    Rect right = new Rect(200, 0, 100, 100);
  }
  public void update() {
    for (AprilTagDetection candidate : tags.getDetections()) {
      if (candidate.metadata != null && candidate.ftcPose != null) {
        double measuredX = candidate.ftcPose.x;
      }
    }
  }
  public void close() { portal.close(); }
}`;

const robotHardware = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.hardware.HardwareMap;
public class RobotHardware {
  public final Intake intake = new Intake();
  public final Transfer transfer = new Transfer();
  public final Launcher launcher = new Launcher();
  public final Vision vision = new Vision();
  public void init(HardwareMap hardwareMap) { vision.init(hardwareMap); }
  public void update(double now) { vision.update(); }
  public void stopAll() { intake.stop(); transfer.stop(); launcher.stop(); vision.close(); }
}`;

const mechanisms = `package org.firstinspires.ftc.teamcode;
class Intake { void collect() {} void stop() {} }
class Transfer { void forward() {} void stop() {} }
class Launcher { void launch(double now) {} void stop() {} }`;

const unit14Files = [
  {name: 'CompetitionTeleOp.java', source: teleOp},
  {name: 'Vision.java', source: vision},
  {name: 'RobotHardware.java', source: robotHardware},
  {name: 'Mechanisms.java', source: mechanisms},
];
const unit14Source = java.serializeProject(unit14Files, 'org.firstinspires.ftc.teamcode.CompetitionTeleOp');
const unit14Compilation = java.compile(unit14Source);
assert.equal(unit14Compilation.ok, true, unit14Compilation.diagnostics?.[0]?.message);
assert.ok(mastery.evaluate(14, unit14Source, unit14Compilation).every(Boolean), 'a delegated Vision subsystem must pass Unit 14');
assert.equal(
  mastery.evaluate(14, unit14Source.replace('"Webcam 1"', '"sideCamera"'))[0],
  false,
  'the configured Webcam 1 name remains an intentional lesson requirement',
);
assert.equal(
  mastery.evaluate(14, unit14Source.replace('candidate.metadata != null', 'true'))[2],
  false,
  'unsafe AprilTag metadata access must fail',
);
assert.equal(
  mastery.evaluate(14, unit14Source.replace('portal.close();', ''))[5],
  false,
  'Vision must release its portal',
);
assert.ok(!mastery.evaluate(14, `/* ${unit14Source} */`).every(Boolean), 'comments cannot satisfy Unit 14');

const fullAutonomous = `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.hardware.limelightvision.Limelight3A;
import com.qualcomm.hardware.limelightvision.LLResult;
import com.pedropathing.api.PoseFactory;
import com.pedropathing.follower.Follower;
import com.pedropathing.ivy.Command;
import com.pedropathing.ivy.Scheduler;
import com.pedropathing.math.Pose;
import com.pedropathing.paths.Path;
@Autonomous(name="DECODE Full Autonomous")
public class FullAutonomous extends LinearOpMode {
  private final RobotHardware robot = new RobotHardware();
  private final Vision vision = new Vision();
  private Limelight3A limelight;
  private Follower follower;
  private Path route;
  private Command autoRoutine() {
    return sequential(
      follow(follower, route),
      waitMs(200)
    );
  }
  public void runOpMode() {
    Scheduler.reset();
    robot.init(hardwareMap);
    vision.init(hardwareMap);
    limelight = hardwareMap.get(Limelight3A.class, "limelight");
    limelight.pipelineSwitch(0);
    limelight.start();
    follower = Constants.create(hardwareMap);
    PoseFactory poses = PoseFactory.degrees();
    Pose start = poses.of(12, 12, 0);
    Pose middle = poses.of(48, 24, 20);
    Pose control = poses.of(60, 36, 45);
    Pose finish = poses.of(72, 72, 90);
    follower.setPose(start);
    route = path(line(start, middle), curve(middle, control, finish));
    waitForStart();
    schedule(autoRoutine());
    while (opModeIsActive()) {
      follower.update();
      robot.update(getRuntime());
      Scheduler.execute();
      robot.intake.collect();
      robot.transfer.forward();
      robot.launcher.launch(getRuntime());
      LLResult result = limelight.getLatestResult();
      if (result != null && result.isValid()) {
        Pose measured = result.getBotpose();
        if (measured != null) follower.setPose(measured);
      }
      telemetry.addData("Mode", follower.mode());
    }
    robot.stopAll();
    vision.close();
    limelight.stop();
  }
}`;

const unit15Files = unit14Files.concat({name: 'FullAutonomous.java', source: fullAutonomous});
const unit15Source = java.serializeProject(unit15Files, 'org.firstinspires.ftc.teamcode.FullAutonomous');
const unit15Compilation = java.compile(unit15Source);
assert.equal(unit15Compilation.ok, true, unit15Compilation.diagnostics?.[0]?.message);
assert.ok(mastery.evaluate(15, unit15Source, unit15Compilation).every(Boolean), 'an alternative non-blocking autonomous must pass Unit 15');
assert.equal(mastery.evaluate(15, unit15Source.replace('"limelight"', '"camera"'))[1], false, 'the Limelight configuration name must stay exact');
assert.equal(mastery.evaluate(15, unit15Source.replace(/result\s*\.\s*isValid\s*\(\s*\)/, 'true'))[6], false, 'unvalidated Limelight data must fail');
assert.equal(mastery.evaluate(15, unit15Source.replace(/follower\s*\.\s*setPose\s*\(\s*measured\s*\)\s*;/, ''))[7], false, 'vision must correct the Follower pose');
assert.ok(!mastery.evaluate(15, unit15Source.replace('follower.update();', 'sleep(100);')).every(Boolean), 'blocking autonomous code must fail');
assert.equal(
  mastery.evaluate(15, unit15Source.replace('private Follower follower;', 'private Follower follower; private DcMotor rawMotor;')).at(-1),
  false,
  'raw mechanism hardware must stay out of FullAutonomous',
);
assert.ok(!mastery.evaluate(15, unit15Source.replace('route = path(', 'route = ; path(')).every(Boolean), 'invalid Java cannot complete Unit 15');

console.log('Advanced Unit 14 and Unit 15 integration checks passed.');
