"use strict";(globalThis.webpackChunkcake_recipes=globalThis.webpackChunkcake_recipes||[]).push([[5524],{62005(e,t,i){i.r(t),i.d(t,{assets:()=>l,contentTitle:()=>d,default:()=>u,frontMatter:()=>s,metadata:()=>o,toc:()=>c});const o=JSON.parse('{"id":"unit-13/build-robot-hardware","title":"Lesson 13.8: Build RobotHardware.java","description":"RobotHardware gives every OpMode one entry point to the robot. It owns the subsystem objects, initializes them, updates ongoing work, and stops powered hardware.","source":"@site/docs/unit-13/13.8-build-robot-hardware.mdx","sourceDirName":"unit-13","slug":"/unit-13/build-robot-hardware","permalink":"/docs/unit-13/build-robot-hardware","draft":false,"unlisted":false,"editUrl":"https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/docs/unit-13/13.8-build-robot-hardware.mdx","tags":[],"version":"current","sidebarPosition":8,"frontMatter":{"id":"build-robot-hardware","title":"Lesson 13.8: Build RobotHardware.java","sidebar_label":"13.8 \xb7 Build RobotHardware","sidebar_position":8},"sidebar":"tutorialSidebar","previous":{"title":"13.7 \xb7 Build Lift","permalink":"/docs/unit-13/build-lift"},"next":{"title":"13.9 \xb7 Complete TeleOp","permalink":"/docs/unit-13/competition-teleop"}}');var a=i(74848),r=i(28453),n=i(15432);const s={id:"build-robot-hardware",title:"Lesson 13.8: Build RobotHardware.java",sidebar_label:"13.8 \xb7 Build RobotHardware",sidebar_position:8},d="Lesson 13.8: Build RobotHardware.java",l={},c=[{value:"The Composition Root",id:"the-composition-root",level:2},{value:"Project Practice",id:"project-practice",level:2}];function p(e){const t={code:"code",h1:"h1",h2:"h2",header:"header",p:"p",...(0,r.R)(),...e.components},{AnnotatedCode:i,Unit13BuildSimulator:o}=t;return i||h("AnnotatedCode",!0),o||h("Unit13BuildSimulator",!0),(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(t.header,{children:(0,a.jsxs)(t.h1,{id:"lesson-138-build-robothardwarejava",children:["Lesson 13.8: Build ",(0,a.jsx)(t.code,{children:"RobotHardware.java"})]})}),"\n",(0,a.jsxs)(t.p,{children:[(0,a.jsx)(t.code,{children:"RobotHardware"})," gives every OpMode one entry point to the robot. It owns the subsystem objects, initializes them, updates ongoing work, and stops powered hardware."]}),"\n",(0,a.jsx)(t.h2,{id:"the-composition-root",children:"The Composition Root"}),"\n",(0,a.jsx)(i,{title:"RobotHardware.java",java:String.raw`package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.hardware.HardwareMap;

public class RobotHardware {
  public final Intake intake = new Intake();
  public final Lift lift = new Lift();

  public void init(HardwareMap hardwareMap) {
      intake.init(hardwareMap);
      lift.init(hardwareMap);
  }

  public void update() {
      lift.update();
  }

  public void stopAll() {
      intake.stop();
      lift.stop();
  }
}`,python:String.raw`class RobotHardware:
  def __init__(self):
      self.intake = Intake()
      self.lift = Lift()

  def initialize(self, hardware):
      self.intake.initialize(hardware)
      self.lift.initialize(hardware)

  def update(self):
      self.lift.update()

  def stop_all(self):
      self.intake.stop()
      self.lift.stop()`}),"\n",(0,a.jsx)(t.p,{children:"This class does not replace the subsystems. It connects them. The intake still owns intake behavior, and the lift still owns lift behavior."}),"\n",(0,a.jsxs)(t.p,{children:["Keep ",(0,a.jsx)(t.code,{children:"update()"})," short and non-blocking. An OpMode will call it every cycle, including while an autonomous path is running."]}),"\n",(0,a.jsx)(t.h2,{id:"project-practice",children:"Project Practice"}),"\n",(0,a.jsx)(t.p,{children:"Initialize both subsystems, delegate periodic updates, and provide one cleanup path."}),"\n",(0,a.jsx)(o,{lesson:"hardware"}),"\n",(0,a.jsx)(n.A,{lessonId:"unit-13/build-robot-hardware",nextUnit:"/docs/unit-13/competition-teleop",nextUnitName:"Lesson 13.9: Complete CompetitionTeleOp.java"})]})}function u(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,a.jsx)(t,{...e,children:(0,a.jsx)(p,{...e})}):p(e)}function h(e,t){throw new Error("Expected "+(t?"component":"object")+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}}}]);