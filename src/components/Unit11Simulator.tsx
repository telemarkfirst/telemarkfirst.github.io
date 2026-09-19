import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'touch-sensor'
  | 'potentiometer'
  | 'color-sensor'
  | 'distance-sensor'
  | 'sensor-gated-intake';

const LESSON_PATH: Record<LessonKey, string> = {
  'touch-sensor': '/simulator/unit11.1.html',
  'potentiometer': '/simulator/unit11.2.html',
  'color-sensor': '/simulator/unit11.3.html',
  'distance-sensor': '/simulator/unit11.4.html',
  'sensor-gated-intake': '/simulator/unit11.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  'touch-sensor': 'Telemark Unit 11.1 Simulator',
  'potentiometer': 'Telemark Unit 11.2 Simulator',
  'color-sensor': 'Telemark Unit 11.3 Simulator',
  'distance-sensor': 'Telemark Unit 11.4 Simulator',
  'sensor-gated-intake': 'Telemark Unit 11.5 Simulator',
};

type Unit11SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit11Simulator({lesson}: Unit11SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit11-simulator-wrapper"
        iframeClassName="telemark-simulator unit11-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark sensor challenge with incomplete starter code for students to finish.</div>
        <div>Includes live 3D mechanism feedback, telemetry checks, and sensor-state validation for each lesson concept.</div>
      </Admonition>

      <style>{`
        .unit11-simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .unit11-telemark-simulator {
          width: 100%;
          height: 900px;
          min-height: 700px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .unit11-telemark-simulator {
            height: 920px;
            max-height: 88vh;
          }
        }
        @media (max-width: 640px) {
          .unit11-telemark-simulator {
            height: 720px;
            min-height: 620px;
          }
        }
      `}</style>
    </>
  );
}
