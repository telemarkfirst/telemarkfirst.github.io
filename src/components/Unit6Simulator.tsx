import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'opmode-active'
  | 'for-loops'
  | 'runtime-timing'
  | 'hardware-arrays'
  | 'nonblocking-timer';

const LESSON_CONFIG: Record<
  LessonKey,
  {
    code: string;
    mode: 'opmode' | 'linear';
  }
> = {
  'opmode-active': {
    mode: 'linear',
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@Autonomous(name="Safety_Spin")
public class SafetySpin extends LinearOpMode {

    @Override
    public void runOpMode() {
        DcMotor spinner = hardwareMap.get(DcMotor.class, "spinner");

        waitForStart();

        // USE while (opModeIsActive()) TO KEEP THE ROBOT SAFE
        // INSERT CODE HERE
        {
            spinner.setPower(0.4);
            telemetry.addData("Spinner", "Running at 40%");
            telemetry.update();
        }

        spinner.setPower(0.0);
    }
}
    `.trim(),
  },
  'for-loops': {
    mode: 'linear',
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.Servo;

@Autonomous(name="Triple_Flick")
public class TripleFlick extends LinearOpMode {

    @Override
    public void runOpMode() {
        Servo delivery = hardwareMap.get(Servo.class, "delivery");

        waitForStart();

        // CREATE A for LOOP THAT RUNS EXACTLY 3 TIMES
        // INSERT CODE HERE
        {
            delivery.setPosition(1.0);
            sleep(200);
            delivery.setPosition(0.0);
            sleep(200);
        }
    }
}
    `.trim(),
  },
  'runtime-timing': {
    mode: 'opmode',
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.util.ElapsedTime;

@TeleOp(name="Non_Blocking_Timer")
public class NonBlockingTimer extends OpMode {

    private DcMotor testMotor;
    private double endTime = 0;

    @Override
    public void init() {
        testMotor = hardwareMap.get(DcMotor.class, "test_motor");
    }

    @Override
    public void loop() {
        if (gamepad1.x) {
            // STORE THE CURRENT RUNTIME PLUS 1.5 SECONDS
            // INSERT CODE HERE
        }

        if (getRuntime() < endTime) {
            testMotor.setPower(1.0);
        } else {
            testMotor.setPower(0.0);
        }

        telemetry.addData("Motor Active", getRuntime() < endTime);
        telemetry.update();
    }
}
    `.trim(),
  },
  'hardware-arrays': {
    mode: 'opmode',
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Array_Brake_Challenge")
public class ArrayBrake extends OpMode {

    private DcMotor[] drivetrain;

    @Override
    public void init() {
        drivetrain = new DcMotor[4];

        drivetrain[0] = hardwareMap.get(DcMotor.class, "left_front");
        drivetrain[1] = hardwareMap.get(DcMotor.class, "right_front");
        drivetrain[2] = hardwareMap.get(DcMotor.class, "left_back");
        drivetrain[3] = hardwareMap.get(DcMotor.class, "right_back");

        // USE A LOOP TO SET EVERY MOTOR TO BRAKE
        // INSERT CODE HERE
        {
            // INSERT CODE HERE
        }
    }

    @Override
    public void loop() {}
}
    `.trim(),
  },
  'nonblocking-timer': {
    mode: 'opmode',
    code: `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Parallel_Action_Challenge")
public class ParallelAction extends OpMode {

    private DcMotor drive;
    private DcMotor intake;
    private final ElapsedTime intakeTimer = new ElapsedTime();
    private boolean intakeRunning = false;
    private boolean previousA = false;

    @Override
    public void init() {
        drive = hardwareMap.get(DcMotor.class, "drive");
        intake = hardwareMap.get(DcMotor.class, "intake");
    }

    @Override
    public void loop() {
        if (gamepad1.a && !previousA) {
            // RESET THE TIMER AND START THE TIMED ACTION
            // INSERT CODE HERE
        }
        previousA = gamepad1.a;

        drive.setPower(-gamepad1.left_stick_y);

        // RUN THE INTAKE ONLY WHILE TIME REMAINS
        // INSERT CODE HERE

        telemetry.addData("Intake Active", intakeRunning);
        telemetry.addData("Intake Time", intakeTimer.seconds());
        telemetry.update();
    }
}
    `.trim(),
  },
};

type Unit6SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit6Simulator({lesson}: Unit6SimulatorProps): React.JSX.Element {
  const config = LESSON_CONFIG[lesson];
  const params = new URLSearchParams({
    code: config.code,
    mode: config.mode,
  });
  const simulatorSrc = `${useBaseUrl('/simulator/unit6.html')}?${params.toString()}`;
  const simulatorTitle = 'Telemark Unit 6 Simulator';

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="1100px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Supports OpMode and LinearOpMode practice with lesson-specific starter code.</div>
        <div>Includes loop stepping, runtime tracking, lifecycle controls, and live gamepad input.</div>
        <div>Best for practicing loop structure, timers, and safe control flow patterns.</div>
      </Admonition>
    </>
  );
}
