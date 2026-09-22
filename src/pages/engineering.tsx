import React from 'react';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * Legacy alias for the mechanical track.
 *
 * The track was renamed from Engineering to Mechanical and now starts at Module 0.
 */
export default function EngineeringRedirect(): React.JSX.Element {
  return <Redirect to={useBaseUrl('/mechanical/module-00/design-cycle')} />;
}
