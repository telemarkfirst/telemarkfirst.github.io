import React from 'react';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

/** Preserve old mechanical-track bookmarks after removing the track landing. */
export default function MechanicalRedirect(): React.JSX.Element {
  return <Redirect to={useBaseUrl('/mechanical/module-00/design-cycle')} />;
}
