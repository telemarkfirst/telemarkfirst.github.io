import React from 'react';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * Legacy alias for the mechanical track.
 *
 * The track was renamed from Engineering to Mechanical, which moved its root.
 * This keeps existing links and bookmarks working rather than breaking them.
 */
export default function EngineeringRedirect(): React.JSX.Element {
  return <Redirect to={useBaseUrl('/mechanical')} />;
}
