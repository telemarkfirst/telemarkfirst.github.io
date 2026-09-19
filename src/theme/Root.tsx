import React, {type ReactNode} from 'react';
import AskLauncher from '@site/src/components/ui/AskLauncher';
import PersonalizationGate from '@site/src/components/PersonalizationGate';
import {LearnerProfileProvider} from '@site/src/telemark/useLearnerProfile';

interface RootProps {
  children: ReactNode;
}

export default function Root({children}: RootProps): React.JSX.Element {
  return (
    <LearnerProfileProvider>
      <PersonalizationGate>
        <AskLauncher />
        {children}
      </PersonalizationGate>
    </LearnerProfileProvider>
  );
}
