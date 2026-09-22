import React from 'react';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

/** Preserve old software-track bookmarks after removing the track landing. */
export default function DocsRedirect(): React.JSX.Element {
  return <Redirect to={useBaseUrl('/docs/unit-00/classes-and-objects')} />;
}
