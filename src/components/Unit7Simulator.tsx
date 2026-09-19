import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'hardware-map-object'
  | 'dcmotor-mapping'
  | 'sensor-mapping'
  | 'name-mismatches'
  | 'mechanism-classes';

type ProjectFile = {
  name: string;
  source: string;
};

const LESSON_CODE: Record<LessonKey, string> = {
  'hardware-map-object': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Lift_Map_Challenge")
public class LiftMap extends OpMode {

    private DcMotor lift;

    @Override
    public void init() {
        // MAP THE MOTOR NAMED "lift_motor"
        // INSERT CODE HERE
        telemetry.addData("Status", "Lift motor mapped");
    }

    @Override
    public void loop() {
        lift.setPower(-gamepad1.left_stick_y);
    }
}
  `.trim(),
  'dcmotor-mapping': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorSimple;

@TeleOp(name="Tank_Map_Challenge")
public class TankMap extends OpMode {

    // DECLARE leftDrive AND rightDrive AS DcMotor FIELDS
    // INSERT CODE HERE

    @Override
    public void init() {
        // MAP "left_drive" AND "right_drive"
        // INSERT CODE HERE

        // REVERSE THE RIGHT MOTOR
        // INSERT CODE HERE
    }

    @Override
    public void loop() {
        leftDrive.setPower(-gamepad1.left_stick_y);
        rightDrive.setPower(-gamepad1.right_stick_y);
    }
}
  `.trim(),
  'sensor-mapping': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DigitalChannel;
import com.qualcomm.robotcore.hardware.AnalogInput;

@TeleOp(name="Sensor_Map_Challenge")
public class SensorMap extends OpMode {

    private DigitalChannel clawSensor;
    private AnalogInput heightPot;

    @Override
    public void init() {
        // MAP THE DIGITAL SENSOR "claw_sensor"
        // INSERT CODE HERE

        // SET THE DIGITAL SENSOR TO INPUT MODE
        // INSERT CODE HERE

        // MAP THE ANALOG SENSOR "height_pot"
        // INSERT CODE HERE
    }

    @Override
    public void loop() {
        telemetry.addData("Claw Sensor State", clawSensor.getState());
        telemetry.addData("Height Voltage", heightPot.getVoltage());
    }
}
  `.trim(),
  'name-mismatches': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name="Wrist_Fix_Challenge")
public class WristFix extends OpMode {

    private DcMotor wrist;

    @Override
    public void init() {
        // BUG: THE HUB NAME IS "wrist" IN ALL LOWERCASE
        wrist = hardwareMap.get(DcMotor.class, "Wrist_Motor");
    }

    @Override
    public void loop() {
        wrist.setPower(gamepad1.right_stick_y);
    }
}

class WristConfig {
    // CREATE A CONSTANT NAMED WRIST THAT EQUALS "wrist"
    // INSERT CODE HERE
}
  `.trim(),
  'mechanism-classes': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Slide_TeleOp_Challenge")
public class SlideTeleOp extends OpMode {

    private LinearSlide slide = new LinearSlide();

    @Override
    public void init() {
        // INITIALIZE THE SLIDE USING hardwareMap
        // INSERT CODE HERE
    }

    @Override
    public void loop() {
        // DRIVE THE SLIDE WITH gamepad1.left_stick_y
        // INSERT CODE HERE
    }
}
  `.trim(),
};

const MECHANISM_CLASS = `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class LinearSlide {

    private DcMotor slideMotor;

    public void init(HardwareMap hwMap) {
        // MAP "slide_motor" AND SET BRAKE MODE
        // INSERT CODE HERE
    }

    public void move(double speed) {
        // APPLY THE SPEED TO slideMotor
        // INSERT CODE HERE
    }
}
`.trim();

const LESSON_PROJECT: Partial<Record<LessonKey, ProjectFile[]>> = {
  'mechanism-classes': [
    {name: 'SlideTeleOp.java', source: LESSON_CODE['mechanism-classes']},
    {name: 'LinearSlide.java', source: MECHANISM_CLASS},
  ],
};

type Unit7SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit7Simulator({lesson}: Unit7SimulatorProps): React.JSX.Element {
  const project = LESSON_PROJECT[lesson];
  const params = new URLSearchParams({
    code: LESSON_CODE[lesson],
  });
  if (project) params.set('project', JSON.stringify(project));
  const simulatorSrc = `${useBaseUrl('/simulator/unit7.html')}?${params.toString()}`;
  const simulatorTitle = 'Telemark Unit 7 Simulator';

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="1080px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Supports multiple Java files: hover over the tabs and choose + to create a separate mechanism or configuration class, or to import existing code.</div>
        <div>Shows mapping errors, type mismatches, direction settings, and missing initialization hints.</div>
        <div>Best for practicing `hardwareMap.get()`, device classes, naming consistency, and mapping structure.</div>
      </Admonition>
    </>
  );
}
