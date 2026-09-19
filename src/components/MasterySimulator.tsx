import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type MasteryUnit = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

type MasterySimulatorProps = {
  unit: MasteryUnit;
  project?: boolean;
};

export default function MasterySimulator({unit, project = false}: MasterySimulatorProps): React.JSX.Element {
  const simulatorTitle = `Telemark Unit ${unit} Comprehensive Coding Challenge`;
  const simulatorSrc = useBaseUrl(`/simulator/unit${unit}.mastery.html`);

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        width="100%"
        height="920px"
        iframeStyle={{border: 'none'}}
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>{project ? 'The editor opens your saved cumulative DECODE project and adds only the files introduced by this stage.' : 'The editor begins with the FTC SDK imports, correct OpMode annotation, and an empty class shell, just as it would in Android Studio.'}</div>
        <div>Use Init and Start to check every unit objective. Passing every check demonstrates full unit mastery.</div>
        <div>{project ? 'Complete the stage across its file tabs. The requirement panel checks the compiled project, and a passing stage saves a read-only snapshot.' : 'Write the complete implementation inside the class. The requirement panel identifies missing behaviors without supplying method scaffolding or a finished solution.'}</div>
      </Admonition>
    </>
  );
}
