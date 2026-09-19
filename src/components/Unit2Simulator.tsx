import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'registering-programs'
  | 'init-method'
  | 'loop-lifecycle'
  | 'start-and-stop'
  | 'health-check-challenge';

const LESSON_STARTER_CODE: Record<LessonKey, string> = {
  'registering-programs': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;

// ANNOTATE THIS CLASS AS AN AUTONOMOUS PROGRAM NAMED "Intake_Test"
// INSERT CODE HERE
public class IntakeDiagnostic extends OpMode {

    @Override
    public void init() {
        telemetry.addData("System", "Intake Logic Loaded");
    }

    @Override
    public void loop() {
        // Logic for motor testing
    }
}
  `.trim(),
  'init-method': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name="Claw_Init")
public class ClawInit extends OpMode {

    // DECLARE A SERVO VARIABLE NAMED 'claw'
    // INSERT CODE HERE

    @Override
    public void init() {
        // MAP THE 'claw' VARIABLE TO THE HARDWARE CONFIGURATION "claw_servo"
        // INSERT CODE HERE
        telemetry.addData("Status", "Claw Initialized");
    }

    @Override
    public void loop() {
        // Claw control logic
    }
}
  `.trim(),
  'loop-lifecycle': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Input_Monitor")
public class InputMonitor extends OpMode {

    @Override
    public void init() {
        telemetry.addData("Diagnostic", "Press Start to monitor input");
    }

    @Override
    public void loop() {
        // USE TELEMETRY TO SHOW THE BOOLEAN STATE OF gamepad1.a
        // INSERT CODE HERE
    }
}
  `.trim(),
  'start-and-stop': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.Autonomous;

@Autonomous(name="Lifecycle_Challenge")
public class LifecycleChallenge extends OpMode {

    @Override
    public void init() {
        telemetry.addData("Status", "Init Pressed");
    }

    // IMPLEMENT THE START METHOD TO RESET THE RUNTIME
    // INSERT CODE HERE

    @Override
    public void loop() {
        telemetry.addData("Elapsed", getRuntime());
    }

    // IMPLEMENT THE STOP METHOD TO PRINT "Robot Shutdown"
    // INSERT CODE HERE
}
  `.trim(),
  'health-check-challenge': `
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Final_Unit2_Challenge")
public class HealthMaster extends OpMode {

    @Override
    public void init() {
        telemetry.addData("System", "Booting...");
    }

    // USE init_loop() TO REPEATEDLY SHOW THE RUNTIME BEFORE THE MATCH STARTS
    // INSERT CODE HERE

    @Override
    public void loop() {
        telemetry.addData("Match", "In Progress");
    }

    // USE stop() TO PRINT "Robot Powering Down"
    // INSERT CODE HERE
}
  `.trim(),
};

type Unit2SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit2Simulator({lesson}: Unit2SimulatorProps): React.JSX.Element {
  const params = new URLSearchParams({
    code: LESSON_STARTER_CODE[lesson],
  });
  const simulatorSrc = `${useBaseUrl('/simulator/unit2.html')}?${params.toString()}`;
  const simulatorTitle = 'Telemark Unit 2 Simulator';

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="700px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Supports `init()`, `init_loop()`, `start()`, `loop()`, and `stop()`.</div>
        <div>Reads `@TeleOp`, `@Autonomous`, `@Disabled`, telemetry, and `gamepad1`.</div>
        <div>Handles local variables, simple math, `resetRuntime()`, and `getRuntime()`.</div>
        <div>Does not execute hardware, `gamepad2`, `else` blocks, or loop structures.</div>
      </Admonition>
    </>
  );
}
