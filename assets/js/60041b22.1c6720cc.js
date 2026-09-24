"use strict";(globalThis.webpackChunkcake_recipes=globalThis.webpackChunkcake_recipes||[]).push([[1388],{19918(e,o,t){t.r(o),t.d(o,{assets:()=>p,contentTitle:()=>l,default:()=>m,frontMatter:()=>a,metadata:()=>i,toc:()=>d});const i=JSON.parse('{"id":"unit-13/competition-teleop","title":"Lesson 13.9: Complete CompetitionTeleOp.java","description":"The OpMode should coordinate decisions. It should not repeat motor names, encoder modes, or power constants.","source":"@site/docs/unit-13/13.9-competition-teleop.mdx","sourceDirName":"unit-13","slug":"/unit-13/competition-teleop","permalink":"/docs/unit-13/competition-teleop","draft":false,"unlisted":false,"editUrl":"https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/docs/unit-13/13.9-competition-teleop.mdx","tags":[],"version":"current","sidebarPosition":9,"frontMatter":{"id":"competition-teleop","title":"Lesson 13.9: Complete CompetitionTeleOp.java","sidebar_label":"13.9 \xb7 Complete TeleOp","sidebar_position":9},"sidebar":"tutorialSidebar","previous":{"title":"13.8 \xb7 Build RobotHardware","permalink":"/docs/unit-13/build-robot-hardware"},"next":{"title":"Unit 13 \xb7 Coding Challenge","permalink":"/docs/unit-13/mastery-coding-challenge"}}');var r=t(74848),n=t(28453),s=t(47664);const a={id:"competition-teleop",title:"Lesson 13.9: Complete CompetitionTeleOp.java",sidebar_label:"13.9 \xb7 Complete TeleOp",sidebar_position:9},l="Lesson 13.9: Complete CompetitionTeleOp.java",p={},d=[{value:"Use the Public Subsystem Methods",id:"use-the-public-subsystem-methods",level:2},{value:"Save the Project for Autonomous",id:"save-the-project-for-autonomous",level:2},{value:"Project Practice",id:"project-practice",level:2}];function c(e){const o={code:"code",h1:"h1",h2:"h2",header:"header",p:"p",strong:"strong",...(0,n.R)(),...e.components},{AnnotatedCode:t,Unit13BuildSimulator:i}=o;return t||h("AnnotatedCode",!0),i||h("Unit13BuildSimulator",!0),(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(o.header,{children:(0,r.jsxs)(o.h1,{id:"lesson-139-complete-competitionteleopjava",children:["Lesson 13.9: Complete ",(0,r.jsx)(o.code,{children:"CompetitionTeleOp.java"})]})}),"\n",(0,r.jsx)(o.p,{children:"The OpMode should coordinate decisions. It should not repeat motor names, encoder modes, or power constants."}),"\n",(0,r.jsx)(o.h2,{id:"use-the-public-subsystem-methods",children:"Use the Public Subsystem Methods"}),"\n",(0,r.jsx)(t,{title:"CompetitionTeleOp.java",java:String.raw`package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name="Competition TeleOp")
public class CompetitionTeleOp extends OpMode {
  private final RobotHardware robot = new RobotHardware();

  @Override
  public void init() {
      robot.init(hardwareMap);
  }

  @Override
  public void loop() {
      robot.update();

      if (gamepad1.right_bumper) {
          robot.intake.collect();
      } else if (gamepad1.left_bumper) {
          robot.intake.eject();
      } else {
          robot.intake.stop();
      }

      if (gamepad1.a) {
          robot.lift.moveToScore();
      }
  }

  @Override
  public void stop() {
      robot.stopAll();
  }
}`,python:String.raw`class CompetitionTeleOp:
  def __init__(self):
      self.robot = RobotHardware()

  def initialize(self, hardware):
      self.robot.initialize(hardware)

  def loop(self, gamepad):
      self.robot.update()
      if gamepad.right_bumper:
          self.robot.intake.collect()
      elif gamepad.left_bumper:
          self.robot.intake.eject()
      else:
          self.robot.intake.stop()
      if gamepad.a:
          self.robot.lift.move_to_score()

  def stop(self):
      self.robot.stop_all()`}),"\n",(0,r.jsxs)(o.p,{children:["Notice what is absent. ",(0,r.jsx)(o.code,{children:"CompetitionTeleOp"})," does not import ",(0,r.jsx)(o.code,{children:"DcMotor"})," or ",(0,r.jsx)(o.code,{children:"CRServo"}),". It does not know hardware configuration names. Those details already have owners."]}),"\n",(0,r.jsx)(o.h2,{id:"save-the-project-for-autonomous",children:"Save the Project for Autonomous"}),"\n",(0,r.jsxs)(o.p,{children:["Complete the project, then press ",(0,r.jsx)(o.strong,{children:"Export"}),". Lesson 15.5 can also read files from this completed lesson when you use the same browser."]}),"\n",(0,r.jsx)(o.p,{children:"If you move to another computer, import the exported Telemark project there. The export contains every Java file and the selected OpMode entry point."}),"\n",(0,r.jsx)(o.h2,{id:"project-practice",children:"Project Practice"}),"\n",(0,r.jsx)(o.p,{children:"Complete the driver controls and cleanup path. Run the checks before exporting."}),"\n",(0,r.jsx)(i,{lesson:"teleop"}),"\n",(0,r.jsx)(s.A,{lessonId:"unit-13/competition-teleop",nextUnit:"/docs/unit-13/mastery-coding-challenge",nextUnitName:"Unit 13 Comprehensive Coding Challenge"})]})}function m(e={}){const{wrapper:o}={...(0,n.R)(),...e.components};return o?(0,r.jsx)(o,{...e,children:(0,r.jsx)(c,{...e})}):c(e)}function h(e,o){throw new Error("Expected "+(o?"component":"object")+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}}}]);