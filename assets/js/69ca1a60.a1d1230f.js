"use strict";(globalThis.webpackChunkcake_recipes=globalThis.webpackChunkcake_recipes||[]).push([[2536],{28508(e,t,o){o.r(t),o.d(t,{assets:()=>c,contentTitle:()=>l,default:()=>u,frontMatter:()=>r,metadata:()=>i,toc:()=>d});const i=JSON.parse('{"id":"unit-13/build-intake","title":"Lesson 13.6: Build RobotConfig.java and Intake.java","description":"The first five lessons gave you the design rules. You will now use them to build a project that survives beyond one OpMode.","source":"@site/docs/unit-13/13.6-build-intake.mdx","sourceDirName":"unit-13","slug":"/unit-13/build-intake","permalink":"/docs/unit-13/build-intake","draft":false,"unlisted":false,"editUrl":"https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/docs/unit-13/13.6-build-intake.mdx","tags":[],"version":"current","sidebarPosition":6,"frontMatter":{"id":"build-intake","title":"Lesson 13.6: Build RobotConfig.java and Intake.java","sidebar_label":"13.6 \xb7 Build Intake","sidebar_position":6},"sidebar":"tutorialSidebar","previous":{"title":"13.5 \xb7 Robot Class","permalink":"/docs/unit-13/robot-class"},"next":{"title":"13.7 \xb7 Build Lift","permalink":"/docs/unit-13/build-lift"}}');var a=o(74848),n=o(28453),s=o(15432);const r={id:"build-intake",title:"Lesson 13.6: Build RobotConfig.java and Intake.java",sidebar_label:"13.6 \xb7 Build Intake",sidebar_position:6},l="Lesson 13.6: Build RobotConfig.java and Intake.java",c={},d=[{value:"<code>RobotConfig.java</code>",id:"robotconfigjava",level:2},{value:"<code>Intake.java</code>",id:"intakejava",level:2},{value:"A Competition Team Uses the Same Boundary",id:"a-competition-team-uses-the-same-boundary",level:2},{value:"Project Practice",id:"project-practice",level:2}];function h(e){const t={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",...(0,n.R)(),...e.components},{AnnotatedCode:o,Unit13BuildSimulator:i}=t;return o||p("AnnotatedCode",!0),i||p("Unit13BuildSimulator",!0),(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(t.header,{children:(0,a.jsxs)(t.h1,{id:"lesson-136-build-robotconfigjava-and-intakejava",children:["Lesson 13.6: Build ",(0,a.jsx)(t.code,{children:"RobotConfig.java"})," and ",(0,a.jsx)(t.code,{children:"Intake.java"})]})}),"\n",(0,a.jsx)(t.p,{children:"The first five lessons gave you the design rules. You will now use them to build a project that survives beyond one OpMode."}),"\n",(0,a.jsxs)(t.p,{children:["Start with two files. ",(0,a.jsx)(t.code,{children:"RobotConfig.java"})," owns shared configuration. ",(0,a.jsx)(t.code,{children:"Intake.java"})," owns the intake hardware and behavior."]}),"\n",(0,a.jsx)(t.h2,{id:"robotconfigjava",children:(0,a.jsx)(t.code,{children:"RobotConfig.java"})}),"\n",(0,a.jsx)(o,{title:"RobotConfig.java",java:String.raw`package org.firstinspires.ftc.teamcode;

public final class RobotConfig {
  public static final String INTAKE_NAME = "intake";
  public static final String LIFT_NAME = "lift";
  public static final double INTAKE_POWER = 0.8;
  public static final int LIFT_SCORE_TICKS = 1200;
  public static final double LIFT_POWER = 0.75;

  private RobotConfig() {}
}`,python:String.raw`class RobotConfig:
  INTAKE_NAME = "intake"
  LIFT_NAME = "lift"
  INTAKE_POWER = 0.8
  LIFT_SCORE_TICKS = 1200
  LIFT_POWER = 0.75`}),"\n",(0,a.jsxs)(t.p,{children:["The private constructor prevents accidental ",(0,a.jsx)(t.code,{children:"new RobotConfig()"})," calls. The program reads these values through the class name."]}),"\n",(0,a.jsx)(t.h2,{id:"intakejava",children:(0,a.jsx)(t.code,{children:"Intake.java"})}),"\n",(0,a.jsx)(o,{title:"Intake.java",java:String.raw`package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.hardware.CRServo;
import com.qualcomm.robotcore.hardware.HardwareMap;

public class Intake {
  private CRServo motor;

  public void init(HardwareMap hardwareMap) {
      motor = hardwareMap.get(
          CRServo.class, RobotConfig.INTAKE_NAME);
      stop();
  }

  public void collect() {
      motor.setPower(RobotConfig.INTAKE_POWER);
  }

  public void eject() {
      motor.setPower(-RobotConfig.INTAKE_POWER);
  }

  public void stop() {
      motor.setPower(0.0);
  }
}`,python:String.raw`class Intake:
  def __init__(self):
      self.motor = None

  def initialize(self, hardware):
      self.motor = hardware[RobotConfig.INTAKE_NAME]
      self.stop()

  def collect(self):
      self.motor.set_power(RobotConfig.INTAKE_POWER)

  def eject(self):
      self.motor.set_power(-RobotConfig.INTAKE_POWER)

  def stop(self):
      self.motor.set_power(0.0)`}),"\n",(0,a.jsx)(t.p,{children:"The Python view shows the class structure only. FTC does not provide this Python hardware API."}),"\n",(0,a.jsxs)(t.p,{children:["The OpMode will not touch the ",(0,a.jsx)(t.code,{children:"CRServo"})," field. It will state intent by calling ",(0,a.jsx)(t.code,{children:"collect()"}),", ",(0,a.jsx)(t.code,{children:"eject()"}),", or ",(0,a.jsx)(t.code,{children:"stop()"}),"."]}),"\n",(0,a.jsx)(t.h2,{id:"a-competition-team-uses-the-same-boundary",children:"A Competition Team Uses the Same Boundary"}),"\n",(0,a.jsxs)(t.p,{children:["Titan Robotics Club's subsystem guide constructs a slide in its own class, stores configuration in ",(0,a.jsx)(t.code,{children:"RobotParams"}),", and exposes the finished motor to the robot layer. This lesson uses the same boundary with direct FTC SDK types:"]}),"\n",(0,a.jsx)(t.pre,{children:(0,a.jsx)(t.code,{className:"language-java",children:"public class Lift {\n    private final TrcMotor liftMotor;\n\n    public Lift() {\n        liftMotor = new FtcMotorActuator(\n            RobotParams.HWNAME_LIFT,\n            liftParameters\n        ).getActuator();\n    }\n}\n"})}),"\n",(0,a.jsxs)(t.p,{children:["The names and omitted setup were shortened to match this lesson. The ownership pattern is unchanged: the mechanism class creates its hardware from centralized configuration. Adapted from ",(0,a.jsx)(t.a,{href:"https://github.com/trc492/FtcTemplate/blob/0680f02e5a8281264c16558c9a953aa15f0cd362/README.md",children:"Team 3543 Titan Robotics Club's subsystem guide at a pinned commit"})," under the ",(0,a.jsx)(t.a,{href:"https://github.com/trc492/FtcTemplate/blob/0680f02e5a8281264c16558c9a953aa15f0cd362/LICENSE",children:"MIT License"}),"."]}),"\n",(0,a.jsx)(t.h2,{id:"project-practice",children:"Project Practice"}),"\n",(0,a.jsx)(t.p,{children:"Complete the intake methods in the project below. Every tab is a separate file in the same TeamCode package."}),"\n",(0,a.jsx)(i,{lesson:"intake"}),"\n",(0,a.jsx)(s.A,{lessonId:"unit-13/build-intake",nextUnit:"/docs/unit-13/build-lift",nextUnitName:"Lesson 13.7: Build MotorMechanism.java and Lift.java"})]})}function u(e={}){const{wrapper:t}={...(0,n.R)(),...e.components};return t?(0,a.jsx)(t,{...e,children:(0,a.jsx)(h,{...e})}):h(e)}function p(e,t){throw new Error("Expected "+(t?"component":"object")+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}}}]);