import React, {useEffect} from 'react';
import {HtmlClassNameProvider} from '@docusaurus/theme-common';
import {DocProvider} from '@docusaurus/plugin-content-docs/client';
import type {Props} from '@theme/DocItem';
import DocItemMetadata from '@theme/DocItem/Metadata';
import DocItemLayout from '@theme/DocItem/Layout';
import AskPrompt from '@site/src/components/ui/AskPrompt';
import {getUnitSlug} from '@site/src/telemark/accessPolicy';
import {trackForUnitSlug} from '@site/src/telemark/tracks';
import {trackEvent} from '@site/src/telemark/analytics';

export default function DocItem(props: Props): React.JSX.Element {
  const docHtmlClassName = `docs-doc-id-${props.content.metadata.id}`;
  const MDXComponent = props.content;
  const docPath = props.content.metadata.permalink ?? props.content.metadata.id;
  const unitSlug = getUnitSlug(docPath);

  useEffect(() => {
    if (!unitSlug) return;
    const track = trackForUnitSlug(unitSlug);
    const storageKey = `telemark:curriculum-start:${track}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Analytics still works when session storage is blocked; it may simply
      // receive more than one start event from this tab.
    }
    trackEvent('curriculum_start', {track});
  }, [unitSlug]);

  return (
    <DocProvider content={props.content}>
      <HtmlClassNameProvider className={docHtmlClassName}>
        <DocItemMetadata />
        <DocItemLayout>
          <MDXComponent />
          {/* Opens the chat in the corner rather than being a second one:
              two panels on a page meant two separate conversations. */}
          <AskPrompt />
        </DocItemLayout>
      </HtmlClassNameProvider>
    </DocProvider>
  );
}
