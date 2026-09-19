import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

export type Unit13BuildLesson = 'intake' | 'lift' | 'hardware' | 'teleop';

const TITLES: Record<Unit13BuildLesson, string> = {
  intake: 'Unit 13.6 Intake Project',
  lift: 'Unit 13.7 Lift Project',
  hardware: 'Unit 13.8 Robot Hardware Project',
  teleop: 'Unit 13.9 Competition TeleOp Project',
};

export default function Unit13BuildSimulator({lesson}: {lesson: Unit13BuildLesson}): React.JSX.Element {
  const title = TITLES[lesson];
  const src = useBaseUrl(`/simulator/unit13.project.html?lesson=${lesson}`);
  return (
    <>
      <SimulatorFrame src={src} width="100%" height="920px" iframeStyle={{border: 'none'}} title={title} />
      <Admonition type="info" title={title}>
        <div>Each tab is a separate Java file in the same TeamCode package. Every stage compiles as one project, and the finished TeleOp can run.</div>
        <div>Your project saves in this browser. Export it after Lesson 13.9 so you can use the same classes in the final autonomous lesson.</div>
      </Admonition>
    </>
  );
}
