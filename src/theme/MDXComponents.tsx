import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import BrowserOnly from '@docusaurus/BrowserOnly';
import SimulatorRunGuide from '@site/src/components/SimulatorRunGuide';
import BlocksNextStep, {BlocksJavaContinue} from '@site/src/components/blocks/BlocksNextStep';
import FllExtensionOverview from '@site/src/components/blocks/FllExtensionOverview';
import AnnotatedCode from '@site/src/components/AnnotatedCode';
import Unit13BuildSimulator from '@site/src/components/Unit13BuildSimulator';

function BlockPractice({lessonId}: {lessonId: string}): React.JSX.Element {
  return (
    <BrowserOnly fallback={<p>Loading the block workspace...</p>}>
      {() => {
        const Client = require('@site/src/components/blocks/BlockPractice').default;
        return <Client lessonId={lessonId} />;
      }}
    </BrowserOnly>
  );
}

function FllPractice({lessonId}: {lessonId: string}): React.JSX.Element {
  return (
    <BrowserOnly fallback={<p>Loading the FLL block workspace...</p>}>
      {() => {
        const Client = require('@site/src/components/blocks/FllPractice').default;
        return <Client lessonId={lessonId} />;
      }}
    </BrowserOnly>
  );
}

export default {
  ...MDXComponents,
  SimulatorRunGuide,
  BlockPractice,
  FllPractice,
  FllExtensionOverview,
  BlocksNextStep,
  BlocksJavaContinue,
  AnnotatedCode,
  Unit13BuildSimulator,
};
