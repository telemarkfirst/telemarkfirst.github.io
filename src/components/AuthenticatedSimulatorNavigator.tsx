import React, {useEffect, useRef} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useColorMode} from '@docusaurus/theme-common';
import {trackEvent} from '@site/src/telemark/analytics';

const SIMULATOR_THEME_STATE = 'telemark:simulator-theme-state';

interface AuthenticatedSimulatorNavigatorProps {
  simulatorId: string;
  wrapperClassName: string;
  toolbarClassName: string;
  toolbarButtonClassName: string;
}

/**
 * The historical component name remains so lesson imports do not churn. The
 * navigator itself is now public; only Sharp AI requires authentication.
 */
export default function AuthenticatedSimulatorNavigator({
  simulatorId,
  wrapperClassName,
  toolbarClassName,
  toolbarButtonClassName,
}: AuthenticatedSimulatorNavigatorProps): React.JSX.Element {
  const {colorMode} = useColorMode();
  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const launchTrackedRef = useRef(false);
  const navigatorUrl = useBaseUrl('/simulator/navigator.html');

  function sendThemeState() {
    iframeRef.current?.contentWindow?.postMessage(
      {type: SIMULATOR_THEME_STATE, theme: colorMode},
      window.location.origin,
    );
  }

  useEffect(() => {
    sendThemeState();
  }, [colorMode]);

  async function openFullscreen() {
    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
      return;
    }

    await shellRef.current?.requestFullscreen();
    trackEvent('simulator_fullscreen', {simulator: simulatorId});
  }

  function handleLoad() {
    sendThemeState();
    if (launchTrackedRef.current) return;
    launchTrackedRef.current = true;
    trackEvent('simulator_launch', {simulator: simulatorId});
  }

  return (
    <>
      <div className={toolbarClassName}>
        <button type="button" className={toolbarButtonClassName} onClick={openFullscreen}>
          <i className="fa-solid fa-expand" aria-hidden="true" />
          Fullscreen Simulator
        </button>
      </div>

      <div className={wrapperClassName} ref={shellRef}>
        <iframe
          ref={iframeRef}
          src={navigatorUrl}
          allowFullScreen
          allow="fullscreen"
          title="Telemark Simulator"
          scrolling="yes"
          onLoad={handleLoad}
        />
      </div>
    </>
  );
}
