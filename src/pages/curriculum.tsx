import React from 'react';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * Legacy alias for the software track landing.
 *
 * The landing moved to /docs so that both tracks open the same way: a docs
 * index carrying its own sidebar. This keeps existing links and bookmarks
 * working rather than breaking them.
 */
export default function CurriculumRedirect(): React.JSX.Element {
  return <Redirect to={useBaseUrl('/docs')} />;
}
