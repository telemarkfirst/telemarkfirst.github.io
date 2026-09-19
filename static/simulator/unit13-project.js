(function (global) {
  'use strict';

  const packageLine = 'package org.firstinspires.ftc.teamcode;\n\n';
  const robotConfig = packageLine + `public final class RobotConfig {
    public static final String INTAKE_NAME = "intake";
    public static final String LIFT_NAME = "lift";
    public static final double INTAKE_POWER = 0.8;
    public static final int LIFT_SCORE_TICKS = 1200;
    public static final double LIFT_POWER = 0.75;

    private RobotConfig() {}
}
`;
  const intake = packageLine + `import com.qualcomm.robotcore.hardware.CRServo;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Intake {
    private CRServo motor;

    public void init(HardwareMap hardwareMap) {
        motor = hardwareMap.get(CRServo.class, RobotConfig.INTAKE_NAME);
        stop();
    }

    public void collect() { motor.setPower(RobotConfig.INTAKE_POWER); }
    public void eject() { motor.setPower(-RobotConfig.INTAKE_POWER); }
    public void stop() { motor.setPower(0.0); }
}
`;
  const motorMechanism = packageLine + `import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class MotorMechanism {
    protected DcMotor motor;

    public void init(HardwareMap hardwareMap, String name) {
        motor = hardwareMap.get(DcMotor.class, name);
        motor.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        stop();
    }

    public void stop() { motor.setPower(0.0); }
}
`;
  const lift = packageLine + `import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Lift extends MotorMechanism {
    public void init(HardwareMap hardwareMap) {
        super.init(hardwareMap, RobotConfig.LIFT_NAME);
        motor.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
        motor.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
    }

    public void moveToScore() {
        motor.setTargetPosition(RobotConfig.LIFT_SCORE_TICKS);
        motor.setMode(DcMotor.RunMode.RUN_TO_POSITION);
        motor.setPower(RobotConfig.LIFT_POWER);
    }

    public boolean isAtTarget() { return !motor.isBusy(); }
    public void update() { if (isAtTarget()) stop(); }

    @Override
    public void stop() { motor.setPower(0.0); }
}
`;
  const robotHardware = packageLine + `import com.qualcomm.robotcore.hardware.HardwareMap;

public class RobotHardware {
    public final Intake intake = new Intake();
    public final Lift lift = new Lift();

    public void init(HardwareMap hardwareMap) {
        intake.init(hardwareMap);
        lift.init(hardwareMap);
    }

    public void update() { lift.update(); }
    public void stopAll() { intake.stop(); lift.stop(); }
}
`;
  const competitionTeleOp = packageLine + `import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Competition TeleOp")
public class CompetitionTeleOp extends OpMode {
    private final RobotHardware robot = new RobotHardware();

    @Override
    public void init() { robot.init(hardwareMap); }

    @Override
    public void loop() {
        robot.update();
        if (gamepad1.right_bumper) robot.intake.collect();
        else if (gamepad1.left_bumper) robot.intake.eject();
        else robot.intake.stop();
        if (gamepad1.a) robot.lift.moveToScore();
    }

    @Override
    public void stop() { robot.stopAll(); }
}
`;

  const configs = {
    intake: {
      title: 'Build RobotConfig.java and Intake.java',
      scenario: 'Finish a reusable intake with private hardware, shared configuration, and collect, eject, and stop methods.',
      inputs: ['right_bumper', 'left_bumper'],
      files: [
        {name: 'RobotConfig.java', source: robotConfig},
        {name: 'Intake.java', source: intake.replace('public void collect() { motor.setPower(RobotConfig.INTAKE_POWER); }', 'public void collect() {\n        // Set collect power.\n    }').replace('public void eject() { motor.setPower(-RobotConfig.INTAKE_POWER); }', 'public void eject() {\n        // Set reverse power.\n    }')},
      ],
      checks: [
        ['Store intake configuration as static final values', /static\s+final[\s\S]*INTAKE_NAME/, /static\s+final[\s\S]*INTAKE_POWER/],
        ['Keep the CRServo field private', /class\s+Intake[\s\S]*private\s+CRServo/],
        ['Map the configured intake', /hardwareMap\.get\s*\(\s*CRServo\.class\s*,\s*RobotConfig\.INTAKE_NAME/],
        ['Provide collect, eject, and stop commands', /void\s+collect\s*\([^)]*\)\s*\{[^}]*setPower\s*\(\s*RobotConfig\.INTAKE_POWER\s*\)/, /void\s+eject\s*\([^)]*\)\s*\{[^}]*setPower\s*\(\s*-\s*RobotConfig\.INTAKE_POWER\s*\)/, /void\s+stop\s*\([^)]*\)\s*\{[^}]*setPower\s*\(\s*0(?:\.0+)?\s*\)/],
      ],
    },
    lift: {
      title: 'Build MotorMechanism.java and Lift.java',
      scenario: 'Complete a lift that inherits shared motor setup and exposes non-blocking target, status, update, and stop behavior.',
      inputs: ['a'],
      files: [
        {name: 'RobotConfig.java', source: robotConfig},
        {name: 'Intake.java', source: intake},
        {name: 'MotorMechanism.java', source: motorMechanism},
        {name: 'Lift.java', source: lift.replace('public void moveToScore() {', 'public void moveToScore() {\n        // Configure the target, run mode, and power below.').replace('motor.setTargetPosition(RobotConfig.LIFT_SCORE_TICKS);', '')},
      ],
      checks: [
        ['Extend MotorMechanism', /class\s+Lift\s+extends\s+MotorMechanism/],
        ['Reset and enable the encoder', /STOP_AND_RESET_ENCODER/, /RUN_USING_ENCODER/],
        ['Start a non-blocking RUN_TO_POSITION move', /setTargetPosition\s*\(/, /RUN_TO_POSITION/, /setPower\s*\(/],
        ['Expose target status and update methods', /boolean\s+isAtTarget\s*\(/, /void\s+update\s*\(/],
        ['Override stop', /@Override[\s\S]*void\s+stop\s*\(/],
      ],
    },
    hardware: {
      title: 'Build RobotHardware.java',
      scenario: 'Compose the intake and lift, initialize them once, update them every cycle, and stop them through one cleanup method.',
      inputs: [],
      files: [
        {name: 'RobotConfig.java', source: robotConfig},
        {name: 'Intake.java', source: intake},
        {name: 'MotorMechanism.java', source: motorMechanism},
        {name: 'Lift.java', source: lift},
        {name: 'RobotHardware.java', source: robotHardware.replace('intake.init(hardwareMap);', '// Initialize both subsystems here.').replace('lift.init(hardwareMap);', '')},
      ],
      checks: [
        ['Create Intake and Lift objects', /new\s+Intake\s*\(/, /new\s+Lift\s*\(/],
        ['Initialize both subsystems', /intake\.init\s*\(\s*hardwareMap\s*\)/, /lift\.init\s*\(\s*hardwareMap\s*\)/],
        ['Update the lift without blocking', /void\s+update\s*\([\s\S]*lift\.update\s*\(/],
        ['Stop both subsystems', /void\s+stopAll\s*\([\s\S]*intake\.stop\s*\([\s\S]*lift\.stop\s*\(/],
      ],
    },
    teleop: {
      title: 'Complete CompetitionTeleOp.java',
      scenario: 'Finish a TeleOp that coordinates RobotHardware through public subsystem methods and exports cleanly for autonomous reuse.',
      inputs: ['a', 'right_bumper', 'left_bumper'],
      files: [
        {name: 'RobotConfig.java', source: robotConfig},
        {name: 'Intake.java', source: intake},
        {name: 'MotorMechanism.java', source: motorMechanism},
        {name: 'Lift.java', source: lift},
        {name: 'RobotHardware.java', source: robotHardware},
        {name: 'CompetitionTeleOp.java', source: competitionTeleOp.replace('robot.update();', '// Update the robot and add driver commands below.').replace('if (gamepad1.right_bumper)', 'if (false && gamepad1.right_bumper)')},
      ],
      checks: [
        ['Create and initialize one RobotHardware object', /new\s+RobotHardware\s*\(/, /robot\.init\s*\(\s*hardwareMap\s*\)/],
        ['Update the robot every loop', /void\s+loop\s*\([\s\S]*robot\.update\s*\(/],
        ['Delegate intake controls', /if\s*\(\s*gamepad1\.right_bumper\s*\)[\s\S]*robot\.intake\.collect\s*\(/, /robot\.intake\.eject\s*\(/, /robot\.intake\.stop\s*\(/],
        ['Delegate the lift command', /gamepad1\.a[\s\S]*robot\.lift\.moveToScore\s*\(/],
        ['Stop all hardware in stop()', /void\s+stop\s*\([\s\S]*robot\.stopAll\s*\(/],
      ],
    },
  };

  const lesson = new URLSearchParams(global.location.search).get('lesson') || 'intake';
  const config = configs[lesson] || configs.intake;
  const stageDetails = {
    intake: {
      heading: 'RobotConfig → Intake → CRServo',
      hint: 'Start, then hold RB to collect or LB to eject.',
      flow: ['RobotConfig', 'Intake method', 'CRServo'],
    },
    lift: {
      heading: 'MotorMechanism → Lift → DcMotor',
      hint: 'Start, then press A to begin the non-blocking lift move.',
      flow: ['MotorMechanism', 'Lift override', 'DcMotor'],
    },
    hardware: {
      heading: 'RobotHardware coordinates both subsystems',
      hint: 'Start to preview init(), update(), and stopAll() coordination.',
      flow: ['RobotHardware', 'Intake + Lift', 'update()'],
    },
    teleop: {
      heading: 'CompetitionTeleOp delegates to RobotHardware',
      hint: 'Start, then use RB/LB for intake and A for the lift.',
      flow: ['gamepad1', 'CompetitionTeleOp', 'RobotHardware', 'subsystems'],
    },
  };
  const detail = stageDetails[lesson] || stageDetails.intake;
  const visual = {
    valid: false,
    intakePower: 0,
    liftHeight: 0,
    liftTarget: 0,
    sceneRoot: null,
    roller: null,
    rollerMaterial: null,
    carriage: null,
    carriageMaterial: null,
    gamePiece: null,
    animationId: null,
  };

  function withBuildHarness(source) {
    if (lesson === 'teleop' || !source.startsWith('// @telemark-project ')) return source;
    const lines = source.split('\n');
    const metadata = JSON.parse(lines.shift().slice('// @telemark-project '.length));
    let offset = 0;
    const files = metadata.files.map(file => {
      const projectFile = {name: file.name, source: lines.slice(offset, offset + file.lines).join('\n')};
      offset += file.lines;
      return projectFile;
    });
    files.push({
      name: 'BuildCheck.java',
      source: packageLine + 'import com.qualcomm.robotcore.eventloop.opmode.OpMode;\n'
        + 'import com.qualcomm.robotcore.eventloop.opmode.TeleOp;\n\n'
        + '@TeleOp(name="Build Check")\npublic class BuildCheck extends OpMode {}\n',
    });
    return global.TelemarkJava.serializeProject(files, 'org.firstinspires.ftc.teamcode.BuildCheck');
  }

  function validate() {
    clearHints();
    const source = getCode();
    const compilation = global.TelemarkSimulatorBase.compileStudentSource(withBuildHarness(source));
    if (!compilation.ok) addHint('Java compile error: ' + (compilation.diagnostics[0]?.message || 'Unable to compile project'), 'error');
    const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const results = config.checks.map(rule => compilation.ok && rule.slice(1).every(pattern => pattern.test(clean)));
    visual.valid = results.every(Boolean);
    results.forEach((passed, index) => setRequirement(index, passed));
    addHint(results.every(Boolean) ? 'This project stage passes every check. Export after Lesson 13.9.' : 'Use the file tabs and requirement list to find the next missing part.', 'info');
    return results;
  }

  function addBox(parent, size, position, color, options) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options?.roughness ?? 0.58,
      metalness: options?.metalness ?? 0.2,
      emissive: options?.emissive ?? 0x000000,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function setupStageScene() {
    if (!global.THREE || !global.scene) return;
    if (visual.sceneRoot) global.scene.remove(visual.sceneRoot);

    const root = new THREE.Group();
    root.name = 'unit13_project_robot';
    visual.sceneRoot = root;
    global.scene.add(root);
    if (typeof setFieldVisible === 'function') setFieldVisible(false);
    if (typeof setCameraOrbit === 'function') {
      setCameraOrbit({theta: 0.42, phi: 0.92, radius: 7.2, target: {x: 0, y: 1.15, z: 0}});
    }

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 8),
      new THREE.MeshStandardMaterial({color: 0x14212a, roughness: 0.9, metalness: 0.02}),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    const robot = new THREE.Group();
    robot.position.z = 0.25;
    root.add(robot);
    addBox(robot, [3.4, 0.58, 3.0], [0, 0.62, 0], 0x33414a);
    addBox(robot, [3.05, 0.14, 2.65], [0, 0.98, 0], 0x73838d, {metalness: 0.5});

    const wheelMaterial = new THREE.MeshStandardMaterial({color: 0x111318, roughness: 0.82});
    [[-1.7, -1], [1.7, -1], [-1.7, 1], [1.7, 1]].forEach(function (point) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 24), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(point[0], 0.42, point[1]);
      robot.add(wheel);
    });

    const intakeFocused = lesson === 'intake' || lesson === 'hardware' || lesson === 'teleop';
    visual.rollerMaterial = new THREE.MeshStandardMaterial({
      color: intakeFocused ? 0xff8a34 : 0x42515a,
      roughness: 0.48,
      metalness: 0.12,
      emissive: 0x000000,
    });
    const rollerMount = new THREE.Group();
    rollerMount.rotation.z = Math.PI / 2;
    rollerMount.position.set(0, 0.54, -1.72);
    robot.add(rollerMount);
    visual.roller = new THREE.Group();
    rollerMount.add(visual.roller);
    const rollerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 3.0, 28), visual.rollerMaterial);
    visual.roller.add(rollerCore);
    const vaneMaterial = new THREE.MeshStandardMaterial({color: 0x17191d, roughness: 0.72});
    for (let vane = 0; vane < 4; vane += 1) {
      const angle = vane * Math.PI / 2;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.08, 0.12), vaneMaterial);
      strip.position.set(Math.cos(angle) * 0.27, 0, Math.sin(angle) * 0.27);
      strip.rotation.y = -angle;
      visual.roller.add(strip);
    }
    addBox(robot, [3.25, 0.12, 0.42], [0, 0.3, -1.64], intakeFocused ? 0xbd5c23 : 0x34414a);

    const ballMaterial = new THREE.MeshStandardMaterial({color: 0x8b5cf6, roughness: 0.4});
    visual.gamePiece = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), ballMaterial);
    visual.gamePiece.position.set(0, 0.31, -2.75);
    root.add(visual.gamePiece);

    const liftFocused = lesson === 'lift' || lesson === 'hardware' || lesson === 'teleop';
    const railColor = liftFocused ? 0x38bdf8 : 0x42515a;
    addBox(robot, [0.17, 3.25, 0.17], [-0.66, 2.18, 0.72], railColor, {metalness: 0.5});
    addBox(robot, [0.17, 3.25, 0.17], [0.66, 2.18, 0.72], railColor, {metalness: 0.5});
    visual.carriage = addBox(robot, [1.62, 0.34, 0.7], [0, 0.92, 0.72], liftFocused ? 0xe7b84c : 0x4a555c, {metalness: 0.3});
    visual.carriageMaterial = visual.carriage.material;

    const configMarker = addBox(robot, [0.72, 0.36, 0.58], [-1.03, 1.24, 0.45], lesson === 'intake' ? 0x22d3ee : 0x315b69);
    configMarker.name = 'RobotConfig';
    createStageOverlay();
    updateStageVisual();
  }

  function createStageOverlay() {
    const container = document.getElementById('sim-scene-container');
    if (!container) return;
    container.querySelectorAll('.u13-project-stage, .u13-project-flow').forEach(node => node.remove());

    const stage = document.createElement('div');
    stage.className = 'u13-project-stage';
    stage.innerHTML = detail.heading + '<small id="u13-project-status">' + detail.hint + '</small>';
    container.appendChild(stage);

    const flow = document.createElement('div');
    flow.className = 'u13-project-flow';
    detail.flow.forEach(function (label, index) {
      const node = document.createElement('span');
      node.textContent = label;
      flow.appendChild(node);
      if (index < detail.flow.length - 1) {
        const arrow = document.createElement('b');
        arrow.textContent = '→';
        flow.appendChild(arrow);
      }
    });
    container.appendChild(flow);
  }

  function updateStageVisual() {
    if (visual.roller) visual.roller.rotation.y += visual.intakePower * 0.18;
    if (visual.rollerMaterial) {
      const glow = visual.intakePower > 0.02 ? 0x173a22 : visual.intakePower < -0.02 ? 0x421616 : 0x000000;
      visual.rollerMaterial.emissive.setHex(glow);
    }
    visual.liftHeight += (visual.liftTarget - visual.liftHeight) * 0.055;
    if (visual.carriage) visual.carriage.position.y = 0.92 + visual.liftHeight * 2.32;
    if (visual.carriageMaterial) visual.carriageMaterial.emissive.setHex(visual.liftTarget > 0.05 ? 0x332407 : 0x000000);
    if (visual.gamePiece) {
      if (visual.intakePower > 0.02) visual.gamePiece.position.z += Math.min(0.035, Math.max(0, -1.86 - visual.gamePiece.position.z) * 0.08);
      else if (visual.intakePower < -0.02) visual.gamePiece.position.z -= 0.035;
      visual.gamePiece.position.z = Math.max(-3.2, Math.min(-1.86, visual.gamePiece.position.z));
    }

    const running = typeof global._simIsRunning === 'function' && global._simIsRunning();
    const status = document.getElementById('u13-project-status');
    if (status) {
      if (!running) status.textContent = detail.hint;
      else if (!visual.valid) status.textContent = 'The model is paused until every requirement passes.';
      else if (visual.intakePower > 0.02) status.textContent = 'collect() → intake power ' + visual.intakePower.toFixed(1);
      else if (visual.intakePower < -0.02) status.textContent = 'eject() → intake power ' + visual.intakePower.toFixed(1);
      else if (visual.liftTarget > 0.05 && visual.liftHeight < 0.98) status.textContent = 'update() → lift moving without blocking loop()';
      else status.textContent = lesson === 'hardware' ? 'RobotHardware.update() coordinates the active mechanisms.' : 'Subsystems are initialized and waiting for a command.';
    }
  }

  function tickStageScene() {
    const running = typeof global._simIsRunning === 'function' && global._simIsRunning();
    if (!running || !visual.valid) {
      visual.intakePower = 0;
      updateStageVisual();
      return;
    }

    const gamepad = global.gamepad || {};
    if (lesson === 'intake' || lesson === 'teleop') {
      visual.intakePower = gamepad.right_bumper ? RobotConfigValue('INTAKE_POWER', 0.8) : gamepad.left_bumper ? -RobotConfigValue('INTAKE_POWER', 0.8) : 0;
    } else if (lesson === 'hardware') {
      const phase = global.getRuntime() % 6;
      visual.intakePower = phase < 1.6 ? 0.8 : 0;
    } else {
      visual.intakePower = 0;
    }

    if ((lesson === 'lift' || lesson === 'teleop') && gamepad.a) visual.liftTarget = 1;
    if (lesson === 'hardware') visual.liftTarget = global.getRuntime() % 6 > 2 ? 1 : 0;

    const nodes = document.querySelectorAll('.u13-project-flow span');
    const active = Math.floor(global.getRuntime() * 2) % Math.max(1, nodes.length);
    nodes.forEach((node, index) => node.classList.toggle('active', index === active));
    updateStageVisual();
  }

  function RobotConfigValue(name, fallback) {
    const source = typeof getCode === 'function' ? getCode() : '';
    const match = new RegExp(name + '\\s*=\\s*([-+]?\\d+(?:\\.\\d+)?)').exec(source);
    return match ? Math.abs(Number(match[1])) : fallback;
  }

  function resetStageVisual() {
    visual.intakePower = 0;
    visual.liftHeight = 0;
    visual.liftTarget = 0;
    if (visual.gamePiece) visual.gamePiece.position.set(0, 0.31, -2.75);
    document.querySelectorAll('.u13-project-flow span').forEach(node => node.classList.remove('active'));
    updateStageVisual();
  }

  global.onSimulatorReady = function () {
    setCode(config.files[0].source);
    const editor = document.getElementById('sim-code-editor');
    const restoredMain = getCode();
    const initialFiles = config.files.map((file, index) => index === 0 ? {...file, source: restoredMain} : file);
    global.TelemarkProject.attach(editor, null, {
      initialFiles,
      key: 'telemark:unit13-cumulative-project:v1',
      addMissingInitialFiles: true,
    });
    global.prepareSimulatorValidationSource = withBuildHarness;
    setChallenge({title: config.title, scenario: config.scenario, requirements: config.checks.map(rule => rule[0]), successMessage: 'This build stage is complete.'});
    setBadges([{iconClass: 'fa-solid fa-folder-tree', label: config.files.length + ' Java files', active: true}, {iconClass: 'fa-solid fa-robot', label: 'Reusable architecture', active: true}]);
    setActiveInputs(config.inputs);
    setupStageScene();
    if (global.innerWidth <= 1100) {
      global.setTimeout(function () {
        const challengeHeader = document.getElementById('sim-challenge-header');
        if (challengeHeader && challengeHeader.classList.contains('open')) challengeHeader.click();
        const collapse = document.getElementById('sim-gp-collapse-btn');
        if (collapse && collapse.getAttribute('aria-expanded') !== 'false') collapse.click();
      }, 0);
    }
    global.onInit = function () { validate(); };
    global.onStart = function () {
      const results = validate();
      if (results.every(Boolean)) addHint(detail.hint, 'info');
    };
    global.onStop = function () { visual.intakePower = 0; updateStageVisual(); };
    global.onReset = function () {
      clearHints();
      resetStageVisual();
      config.checks.forEach((_rule, index) => setRequirement(index, false));
    };
    if (typeof addAnimationCallback === 'function' && visual.animationId == null) {
      visual.animationId = addAnimationCallback(tickStageScene);
    }
    config.checks.forEach((_rule, index) => setRequirement(index, false));
  };
})(window);
