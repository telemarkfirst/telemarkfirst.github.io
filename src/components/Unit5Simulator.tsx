import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'if-statements'
  | 'else-if-chaining'
  | 'comparison-operators'
  | 'logical-operators'
  | 'intake-logic-challenge';

const LESSON_CONFIG: Record<
  LessonKey,
  {
    code: string;
    showMotorVisual: boolean;
    showDistanceSensor: boolean;
    showColorSensor: boolean;
  }
> = {
  'if-statements': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Safety_Switch_Challenge")
public class SafetySwitch extends OpMode {

    private DcMotor flywheel;

    @Override
    public void init() {
        flywheel = hardwareMap.get(DcMotor.class, "flywheel");
    }

    @Override
    public void loop() {
        // EVALUATE IF THE RIGHT BUMPER IS PRESSED
        // INSERT CODE HERE
        {
            // ACTIVATE THE FLYWHEEL AT 100% POWER
            // INSERT CODE HERE
        }
    }
}
    `.trim(),
    showMotorVisual: true,
    showDistanceSensor: false,
    showColorSensor: false,
  },
  'else-if-chaining': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name="Grabber_Control")
public class GrabberControl extends OpMode {

    private Servo grabber;

    @Override
    public void init() {
        grabber = hardwareMap.get(Servo.class, "grabber");
    }

    @Override
    public void loop() {
        // 1. IF GAMEPAD1.A IS PRESSED, SET SERVO TO 1.0
        // INSERT CODE HERE
        {
            grabber.setPosition(1.0);
        }
        // 2. ELSE IF GAMEPAD1.B IS PRESSED, SET SERVO TO 0.0
        // INSERT CODE HERE
        {
            grabber.setPosition(0.0);
        }
        // 3. ELSE, SET SERVO TO 0.5
        // INSERT CODE HERE
        {
            grabber.setPosition(0.5);
        }
    }
}
    `.trim(),
    showMotorVisual: false,
    showDistanceSensor: false,
    showColorSensor: false,
  },
  'comparison-operators': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DistanceSensor;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;

@TeleOp(name="Wall_Safety_Challenge")
public class WallSafety extends OpMode {

    private DcMotor driveMotor;
    private DistanceSensor distanceSensor;

    @Override
    public void init() {
        driveMotor     = hardwareMap.get(DcMotor.class, "drive");
        distanceSensor = hardwareMap.get(DistanceSensor.class, "front_sensor");
    }

    @Override
    public void loop() {
        double dist = distanceSensor.getDistance(DistanceUnit.CM);

        // IF THE DISTANCE IS LESS THAN 10.0 cm
        // INSERT CODE HERE
        {
            // COMMAND THE DRIVE MOTOR TO STOP
            // INSERT CODE HERE
        }
        else {
            driveMotor.setPower(-1 * gamepad1.left_stick_y);
        }
    }
}
    `.trim(),
    showMotorVisual: true,
    showDistanceSensor: true,
    showColorSensor: false,
  },
  'logical-operators': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Trigger_Safety_Challenge")
public class TriggerSafety extends OpMode {

    private DcMotor drive;

    @Override
    public void init() {
        drive = hardwareMap.get(DcMotor.class, "drive");
    }

    @Override
    public void loop() {
        // IF (NOT gamepad1.start) AND (gamepad1.left_trigger > 0.5)
        // INSERT CODE HERE
        {
            telemetry.addLine("Drive System Active");
            drive.setPower(-1 * gamepad1.left_stick_y);
        }
        else {
            drive.setPower(0.0);
        }
    }
}
    `.trim(),
    showMotorVisual: true,
    showDistanceSensor: false,
    showColorSensor: false,
  },
  'intake-logic-challenge': {
    code: `
package org.firstinspires.ftc.teamcode.opmodes;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.ColorSensor;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DistanceSensor;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;

@TeleOp(name="Safe_Intake_Practice")
public class SafeIntakePractice extends OpMode {

    private DcMotor intake;
    private ColorSensor color;
    private DistanceSensor distance;

    @Override
    public void init() {
        intake = hardwareMap.get(DcMotor.class, "intake");
        color = hardwareMap.get(ColorSensor.class, "intake_color");
        distance = hardwareMap.get(DistanceSensor.class, "intake_distance");
    }

    @Override
    public void loop() {
        double dist = distance.getDistance(DistanceUnit.CM);
        int redValue = color.red();
        int blueValue = color.blue();
        boolean collect = gamepad1.a || gamepad1.right_trigger > 0.10;

        // 1. IF dist < 5.0, STOP THE INTAKE
        // 2. ELSE IF RED IS > 200 AND > BLUE, EJECT AT -1.0
        // 3. ELSE IF collect, USE right_trigger AS POWER
        // 4. ELSE, STOP EXPLICITLY AT 0.0
        // INSERT THE COMPLETE IF / ELSE-IF / ELSE CHAIN

        telemetry.addData("Distance", dist);
        telemetry.addData("Red", redValue);
        telemetry.addData("Blue", blueValue);
    }
}
    `.trim(),
    showMotorVisual: true,
    showDistanceSensor: true,
    showColorSensor: true,
  },
};

type Unit5SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit5Simulator({lesson}: Unit5SimulatorProps): React.JSX.Element {
  const config = LESSON_CONFIG[lesson];
  const params = new URLSearchParams({
    code: config.code,
    lesson,
    showMotorVisual: String(config.showMotorVisual),
    showDistanceSensor: String(config.showDistanceSensor),
    showColorSensor: String(config.showColorSensor),
  });
  const simulatorSrc = `${useBaseUrl('/simulator/unit5.html')}?${params.toString()}`;
  const simulatorTitle = 'Telemark Unit 5 Simulator';

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="1180px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Supports gamepad-driven `if`, `else if`, and `else` logic with live branch visualization.</div>
        <div>Includes truth-table and condition-inspector views, plus mock distance and color sensor inputs when needed.</div>
        <div>Best for practicing decision logic, thresholds, and simple actuator commands.</div>
      </Admonition>
    </>
  );
}
