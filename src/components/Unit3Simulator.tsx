import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'string-literals'
  | 'double-precision'
  | 'boolean-flags'
  | 'int-datatypes'
  | 'dynamic-power-challenge';

const LESSON_CONFIG: Record<
  LessonKey,
  {
    code: string;
    showMotorVisual: boolean;
  }
> = {
  'string-literals': {
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name="Variable_Map_Challenge")
public class VariableMap extends OpMode {

    // DECLARE A STRING VARIABLE NAMED 'configName' AND ASSIGN IT "claw_servo"
    // INSERT CODE HERE

    Servo claw;

    @Override
    public void init() {
        // USE THE configName VARIABLE TO MAP THE SERVO
        // INSERT CODE HERE
        telemetry.addData("Status", "Claw Map Successful");
    }

    @Override
    public void loop() {}
}
    `.trim(),
    showMotorVisual: false,
  },
  'double-precision': {
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Double_Speed_Challenge")
public class DoubleSpeed extends OpMode {

    DcMotor motor;

    @Override
    public void init() {
        motor = hardwareMap.get(DcMotor.class, "motor");
    }

    @Override
    public void loop() {
        // DECLARE A DOUBLE VARIABLE 'autonSpeed' AND ASSIGN IT 0.45
        // INSERT CODE HERE

        motor.setPower(autonSpeed);
    }
}
    `.trim(),
    showMotorVisual: true,
  },
  'boolean-flags': {
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Button_Capture_Challenge")
public class ButtonCapture extends OpMode {

    @Override
    public void init() {
        telemetry.addData("Status", "Init Ready");
    }

    @Override
    public void loop() {
        // DECLARE A BOOLEAN 'buttonState' AND ASSIGN IT THE VALUE OF gamepad1.a
        // INSERT CODE HERE

        // USE TELEMETRY TO DISPLAY THE VALUE OF buttonState
        // INSERT CODE HERE
    }
}
    `.trim(),
    showMotorVisual: false,
  },
  'int-datatypes': {
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Lap_Counter_Challenge")
public class LapCounter extends OpMode {

    // DECLARE AN INT VARIABLE 'laps' AT THE CLASS LEVEL
    // INSERT CODE HERE

    @Override
    public void init() {
        // INITIALIZE laps TO ZERO
        // INSERT CODE HERE
    }

    @Override
    public void loop() {
        if (gamepad1.b) {
            // INCREMENT THE laps VARIABLE
            // INSERT CODE HERE
        }
        telemetry.addData("Laps completed", laps);
    }
}
    `.trim(),
    showMotorVisual: false,
  },
  'dynamic-power-challenge': {
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Precision_Mode_Challenge")
public class PrecisionMode extends OpMode {

    DcMotor motor;
    double scaleFactor = 0.5;

    @Override
    public void init() {
        motor = hardwareMap.get(DcMotor.class, "motor");
    }

    @Override
    public void loop() {
        // 1. CAPTURE JOYSTICK Y-AXIS INTO A DOUBLE VARIABLE 'input'
        // INSERT CODE HERE

        double finalPower;

        if (gamepad1.left_bumper) {
            // 2. CALCULATE finalPower BY MULTIPLYING input BY scaleFactor
            // INSERT CODE HERE
        } else {
            finalPower = input;
        }

        motor.setPower(finalPower);
    }
}
    `.trim(),
    showMotorVisual: true,
  },
};

type Unit3SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit3Simulator({lesson}: Unit3SimulatorProps): React.JSX.Element {
  const config = LESSON_CONFIG[lesson];
  const params = new URLSearchParams({
    code: config.code,
    lesson,
    showMotorVisual: String(config.showMotorVisual),
  });
  const simulatorSrc = `${useBaseUrl('/simulator/unit3.html')}?${params.toString()}`;
  const simulatorTitle = 'Telemark Unit 3 Simulator';

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="900px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Tracks `String`, `double`, `boolean`, and `int` variables as you edit.</div>
        <div>Supports telemetry, `gamepad1`, simple `if` blocks, and basic `setPower()` math.</div>
        <div>Does not simulate full hardware behavior or complex Java control flow.</div>
      </Admonition>
    </>
  );
}
