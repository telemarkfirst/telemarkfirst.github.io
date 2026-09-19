import React, {useEffect, useRef, useState} from 'react';
import {useColorMode} from '@docusaurus/theme-common';
import {trackEvent} from '@site/src/telemark/analytics';
import {CURRICULUM_LESSONS} from '@site/src/telemark/curriculum';
import {readLocalProgress, PROGRESS_CHANGED_EVENT, PROGRESS_STORAGE_KEY} from '@site/src/telemark/progressStore';

const SIMULATOR_THEME_STATE = 'telemark:simulator-theme-state';

type SimulatorFrameProps = {
  src: string;
  title: string;
  wrapperClassName?: string;
  iframeClassName?: string;
  width?: string;
  height?: string;
  iframeStyle?: React.CSSProperties;
  loading?: 'eager' | 'lazy';
};

export default function SimulatorFrame({
  src,
  title,
  wrapperClassName = 'simulator-wrapper',
  iframeClassName = 'telemark-simulator',
  width,
  height,
  iframeStyle,
  loading = 'lazy',
}: SimulatorFrameProps): React.JSX.Element {
  const {colorMode} = useColorMode();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const launchTrackedRef = useRef(false);

  const sendFullscreenState = (fullscreen = document.fullscreenElement === shellRef.current) => {
    iframeRef.current?.contentWindow?.postMessage(
      {type: 'telemark:simulator-fullscreen-state', fullscreen},
      window.location.origin,
    );
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreen = document.fullscreenElement === shellRef.current;
      setIsFullscreen(fullscreen);
      sendFullscreenState(fullscreen);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const sendThemeState = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {type: SIMULATOR_THEME_STATE, theme: colorMode},
      window.location.origin,
    );
    sendLessonState();
    sendFullscreenState();
  };

  const sendLessonState = () => {
    const path = window.location.pathname.replace(/\/$/, '');
    const lesson = CURRICULUM_LESSONS.find(item => path.endsWith(item.path));
    if (!lesson) return;
    const progress = readLocalProgress();
    iframeRef.current?.contentWindow?.postMessage({
      type: 'telemark:project-lesson',
      lesson: {id: lesson.id, title: `${lesson.label}: ${lesson.title}`},
      completed: progress.completedLessons.filter(id => !progress.skippedLessons.includes(id) && !progress.autoCompletedLessons.includes(id)),
    }, window.location.origin);
  };

  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === iframeRef.current?.contentWindow && event.data?.type === 'telemark:project-ready') sendLessonState();
    };
    const onProgressStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_STORAGE_KEY) sendLessonState();
    };
    window.addEventListener('message', onReady);
    window.addEventListener(PROGRESS_CHANGED_EVENT, sendLessonState);
    window.addEventListener('storage', onProgressStorage);
    return () => {
      window.removeEventListener('message', onReady);
      window.removeEventListener(PROGRESS_CHANGED_EVENT, sendLessonState);
      window.removeEventListener('storage', onProgressStorage);
    };
  }, [src]);

  useEffect(() => {
    sendThemeState();
  }, [colorMode]);

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
      return;
    }
    await shellRef.current.requestFullscreen();
    trackEvent('simulator_fullscreen', {simulator: title});
  };

  const handleLoad = () => {
    sendThemeState();
    if (launchTrackedRef.current) return;
    launchTrackedRef.current = true;
    trackEvent('simulator_launch', {simulator: title});
  };

  return (
    <div className="simulator-fullscreen-shell" ref={shellRef}>
      <div className="simulator-fullscreen-toolbar">
        <button className="simulator-fullscreen-button" type="button" onClick={toggleFullscreen}>
          {isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
        </button>
      </div>
      <div className={wrapperClassName}>
        <iframe
          ref={iframeRef}
          src={src}
          className={iframeClassName}
          width={width}
          height={height}
          style={iframeStyle}
          title={title}
          loading={loading}
          allowFullScreen
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
}
