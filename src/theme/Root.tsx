import React, {type ReactNode} from 'react';
import AskLauncher from '@site/src/components/ui/AskLauncher';

interface RootProps {
  children: ReactNode;
}

export default function Root({children}: RootProps): React.JSX.Element {
  return (
    <>
      <AskLauncher />
      {children}
    </>
  );
}
