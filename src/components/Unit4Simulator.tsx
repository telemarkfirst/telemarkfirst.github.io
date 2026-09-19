import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'button-toggles'
  | 'joystick-scaling'
  | 'trigger-inputs'
  | 'sensitivity-curves'
  | 'arcade-drive-challenge';

const LESSON_CONFIG: Record<
  LessonKey,
  {
    code: string;
    showMotorVisual: boolean;
  }
> = {
  'button-toggles': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Bumper_Diagnostic")
public class BumperDiag extends OpMode {

    @Override
    public void init() {
        telemetry.addData("Status", "Ready");
    }

    @Override
    public void loop() {
        // 1. DECLARE A BOOLEAN 'isPressed' AND ASSIGN IT TO gamepad1.left_bumper
        // INSERT CODE HERE

        if (isPressed) {
            // 2. USE TELEMETRY TO SHOW THE MESSAGE "Left Bumper Pressed"
            // INSERT CODE HERE
        }
    }
}
    `.trim(),
    showMotorVisual: false,
  },
  'joystick-scaling': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Rookie_Drive_Mode")
public class RookieDrive extends OpMode {

    @Override
    public void init() {}

    @Override
    public void loop() {
        // 1. CALCULATE 'safePower' BY NEGATING THE STICK Y AND DIVIDING BY 2.0
        // INSERT CODE HERE

        // 2. USE TELEMETRY TO OUTPUT THE 'safePower' VALUE
        // INSERT CODE HERE
    }
}
    `.trim(),
    showMotorVisual: false,
  },
  'trigger-inputs': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Variable_Speed_Check")
public class VariableSpeed extends OpMode {

    @Override
    public void init() {}

    @Override
    public void loop() {
        // 1. CAPTURE THE LEFT TRIGGER VALUE INTO A DOUBLE CALLED 'brakeForce'
        // INSERT CODE HERE

        // 2. OUTPUT THE 'brakeForce' VALUE TO TELEMETRY
        // INSERT CODE HERE
    }
}
    `.trim(),
    showMotorVisual: false,
  },
  'sensitivity-curves': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Cube_Scaling_Test")
public class CubeScaling extends OpMode {

    // 1. DEFINE A METHOD 'cubeInput' THAT TAKES A DOUBLE AND RETURNS A DOUBLE
    // INSERT CODE HERE

    @Override
    public void init() {}

    @Override
    public void loop() {
        // 2. CALL YOUR METHOD ON gamepad1.right_stick_x AND SHOW RESULT
        // INSERT CODE HERE
    }
}
    `.trim(),
    showMotorVisual: false,
  },
  'arcade-drive-challenge': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.util.Range;

@TeleOp(name="Arcade_Drive_Practice")
public class ArcadeDrivePractice extends OpMode {

    private DcMotor leftDrive;
    private DcMotor rightDrive;
    private boolean precisionMode = true;
    private boolean previousA = false;
    private static final double DEADZONE = 0.10;

    @Override
    public void init() {
        leftDrive = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");
    }

    double squareInputWithSign(double input) {
        return input * input * Math.signum(input);
    }

    @Override
    public void loop() {
        double forward = -gamepad1.left_stick_y;
        double turn = gamepad1.right_stick_x;

        // 1. APPLY DEADZONE TO BOTH AXES WITH Math.abs(...)
        // INSERT CODE HERE

        // 2. TOGGLE precisionMode ONLY WHEN A CHANGES FROM RELEASED TO PRESSED
        // 3. SAVE THE CURRENT A VALUE IN previousA
        // INSERT CODE HERE

        if (precisionMode) {
            forward = squareInputWithSign(forward);
            turn = squareInputWithSign(turn);
        }

        double speedLimit = 1.0 - (0.70 * gamepad1.right_trigger);

        // 4. MIX forward +/- turn AND Range.clip EACH SIDE AFTER speedLimit
        // INSERT CODE HERE

        // 5. SEND leftPower AND rightPower TO THEIR MOTORS
        // INSERT CODE HERE

        telemetry.addData("Left Power", leftPower);
        telemetry.addData("Right Power", rightPower);
    }
}
    `.trim(),
    showMotorVisual: true,
  },
};

type Unit4SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit4Simulator({lesson}: Unit4SimulatorProps): React.JSX.Element {
  const config = LESSON_CONFIG[lesson];
  const params = new URLSearchParams({
    code: config.code,
    lesson,
    showMotorVisual: String(config.showMotorVisual),
  });
  const simulatorSrc = `${useBaseUrl('/simulator/unit4.html')}?${params.toString()}`;
  const simulatorTitle = 'Telemark Unit 4 Simulator';

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="1050px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Supports buttons, joysticks, triggers, bumpers, and D-pad input.</div>
        <div>Shows live input values, basic telemetry, deadzones, and curve visualization when relevant.</div>
        <div>Lesson 4.5 also compiles mapped motors and shows the power produced by the arcade-drive mix.</div>
      </Admonition>
    </>
  );
}
