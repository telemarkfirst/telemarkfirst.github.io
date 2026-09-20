"use strict";(globalThis.webpackChunkcake_recipes=globalThis.webpackChunkcake_recipes||[]).push([[1297],{87121(e,t,o){o.r(t),o.d(t,{assets:()=>c,contentTitle:()=>d,default:()=>u,frontMatter:()=>n,metadata:()=>i,toc:()=>l});const i=JSON.parse('{"id":"unit-13/build-lift","title":"Lesson 13.7: Build MotorMechanism.java and Lift.java","description":"The lift shares basic motor setup with other powered mechanisms. Put that shared behavior in MotorMechanism, then let Lift add encoder targets and lift-specific stopping.","source":"@site/docs/unit-13/13.7-build-lift.mdx","sourceDirName":"unit-13","slug":"/unit-13/build-lift","permalink":"/docs/unit-13/build-lift","draft":false,"unlisted":false,"editUrl":"https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/docs/unit-13/13.7-build-lift.mdx","tags":[],"version":"current","sidebarPosition":7,"frontMatter":{"id":"build-lift","title":"Lesson 13.7: Build MotorMechanism.java and Lift.java","sidebar_label":"13.7 \xb7 Build Lift","sidebar_position":7},"sidebar":"tutorialSidebar","previous":{"title":"13.6 \xb7 Build Intake","permalink":"/docs/unit-13/build-intake"},"next":{"title":"13.8 \xb7 Build RobotHardware","permalink":"/docs/unit-13/build-robot-hardware"}}');var r=o(74848),a=o(28453),s=o(15432);const n={id:"build-lift",title:"Lesson 13.7: Build MotorMechanism.java and Lift.java",sidebar_label:"13.7 \xb7 Build Lift",sidebar_position:7},d="Lesson 13.7: Build MotorMechanism.java and Lift.java",c={},l=[{value:"The Parent Class",id:"the-parent-class",level:2},{value:"The Lift Class",id:"the-lift-class",level:2},{value:"Project Practice",id:"project-practice",level:2}];function h(e){const t={code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",...(0,a.R)(),...e.components},{AnnotatedCode:o,Unit13BuildSimulator:i}=t;return o||p("AnnotatedCode",!0),i||p("Unit13BuildSimulator",!0),(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.header,{children:(0,r.jsxs)(t.h1,{id:"lesson-137-build-motormechanismjava-and-liftjava",children:["Lesson 13.7: Build ",(0,r.jsx)(t.code,{children:"MotorMechanism.java"})," and ",(0,r.jsx)(t.code,{children:"Lift.java"})]})}),"\n",(0,r.jsxs)(t.p,{children:["The lift shares basic motor setup with other powered mechanisms. Put that shared behavior in ",(0,r.jsx)(t.code,{children:"MotorMechanism"}),", then let ",(0,r.jsx)(t.code,{children:"Lift"})," add encoder targets and lift-specific stopping."]}),"\n",(0,r.jsx)(t.h2,{id:"the-parent-class",children:"The Parent Class"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-java",metastring:'title="MotorMechanism.java"',children:"package org.firstinspires.ftc.teamcode;\n\nimport com.qualcomm.robotcore.hardware.DcMotor;\nimport com.qualcomm.robotcore.hardware.HardwareMap;\n\npublic class MotorMechanism {\n    protected DcMotor motor;\n\n    public void init(HardwareMap hardwareMap, String name) {\n        motor = hardwareMap.get(DcMotor.class, name);\n        motor.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);\n        stop();\n    }\n\n    public void stop() {\n        motor.setPower(0.0);\n    }\n}\n"})}),"\n",(0,r.jsxs)(t.p,{children:[(0,r.jsx)(t.code,{children:"protected"})," allows ",(0,r.jsx)(t.code,{children:"Lift"})," to use the motor while keeping unrelated OpMode code out."]}),"\n",(0,r.jsx)(t.h2,{id:"the-lift-class",children:"The Lift Class"}),"\n",(0,r.jsx)(o,{title:"Lift.java",java:String.raw`package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.hardware.DcMotor;
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

  public boolean isAtTarget() {
      return !motor.isBusy();
  }

  public void update() {
      if (isAtTarget()) stop();
  }

  @Override
  public void stop() {
      motor.setPower(0.0);
  }
}`,python:String.raw`class Lift(MotorMechanism):
  def initialize(self, hardware):
      super().initialize(hardware, RobotConfig.LIFT_NAME)
      self.motor.reset_encoder()

  def move_to_score(self):
      self.motor.set_target(RobotConfig.LIFT_SCORE_TICKS)
      self.motor.start_move(RobotConfig.LIFT_POWER)

  def is_at_target(self):
      return not self.motor.is_busy()

  def update(self):
      if self.is_at_target():
          self.stop()`}),"\n",(0,r.jsxs)(t.p,{children:[(0,r.jsx)(t.code,{children:"moveToScore()"})," starts motion and returns. It does not wait in a loop. The OpMode can continue updating its drivetrain, vision, and intake while the lift moves."]}),"\n",(0,r.jsxs)(t.p,{children:[(0,r.jsx)(t.code,{children:"update()"})," checks progress during each OpMode cycle. This same non-blocking contract will matter in the final autonomous state machine."]}),"\n",(0,r.jsx)(t.h2,{id:"project-practice",children:"Project Practice"}),"\n",(0,r.jsx)(t.p,{children:"Complete the lift target command and verify the inheritance, override, and status methods."}),"\n",(0,r.jsx)(i,{lesson:"lift"}),"\n",(0,r.jsx)(s.A,{lessonId:"unit-13/build-lift",nextUnit:"/docs/unit-13/build-robot-hardware",nextUnitName:"Lesson 13.8: Build RobotHardware.java"})]})}function u(e={}){const{wrapper:t}={...(0,a.R)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(h,{...e})}):h(e)}function p(e,t){throw new Error("Expected "+(t?"component":"object")+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}}}]);