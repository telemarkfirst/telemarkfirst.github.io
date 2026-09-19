import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useColorMode} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import styles from './index.module.css';

/** Keep the theme-matched product reel moving without interrupting the page. */
function HeroVideo(): React.JSX.Element {
  const darkSrc = useBaseUrl('/video/telemark-hero.mp4');
  const lightSrc = useBaseUrl('/video/telemark-hero-light.mp4');
  const darkPoster = useBaseUrl('/video/telemark-hero-poster.jpg');
  const lightPoster = useBaseUrl('/video/telemark-hero-light-poster.jpg');
  const {colorMode} = useColorMode();
  const src = colorMode === 'light' ? lightSrc : darkSrc;
  const poster = colorMode === 'light' ? lightPoster : darkPoster;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const initialSrcRef = React.useRef(src);
  const activeSrcRef = React.useRef(src);
  const playbackTimeRef = React.useRef(0);
  const switchingRef = React.useRef(false);
  const shouldPlayRef = React.useRef(true);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || activeSrcRef.current === src) return undefined;

    const currentPosition = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    if (currentPosition > 0.05) playbackTimeRef.current = currentPosition;
    if (!switchingRef.current) {
      shouldPlayRef.current = (!video.paused && !video.ended) || video.autoplay;
    }
    const snapshot = {
      time: playbackTimeRef.current,
      wasPlaying: shouldPlayRef.current,
    };
    switchingRef.current = true;
    activeSrcRef.current = src;

    const restorePlayback = (): void => {
      const lastPlayableTime = Number.isFinite(video.duration)
        ? Math.max(0, video.duration - 0.05)
        : snapshot.time;
      const target = Math.min(snapshot.time, lastPlayableTime);
      const finishSwitch = (): void => {
        playbackTimeRef.current = target;
        switchingRef.current = false;

        if (snapshot.wasPlaying) {
          void video.play().catch(() => {
            // Autoplay policy may pause playback; the theme and position are
            // still restored correctly.
          });
        } else {
          video.pause();
        }
      };

      if (Math.abs(video.currentTime - target) < 0.05) {
        finishSwitch();
      } else {
        video.addEventListener('seeked', finishSwitch, {once: true});
        video.currentTime = target;
      }
    };

    video.addEventListener('canplay', restorePlayback, {once: true});
    video.src = src;
    video.load();

    return () => video.removeEventListener('canplay', restorePlayback);
  }, [src]);

  return (
    <div className={styles.heroVideoFrame}>
      <video
        ref={videoRef}
        className={styles.heroVideo}
        src={initialSrcRef.current}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={poster}
        onTimeUpdate={(event) => {
          if (!switchingRef.current) {
            playbackTimeRef.current = event.currentTarget.currentTime;
          }
        }}
        aria-label="Telemark curriculum and robot simulator preview"
      >
      </video>
    </div>
  );
}

function HeroSection(): React.JSX.Element {
  return (
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <h1 className={styles.heroTitle}>
          <span className={styles.titleLine1}>Learn FTC</span>
          <span className={styles.titleLine2}>Robotics</span>
        </h1>

        <p className={styles.heroSub}>
          Learn through experience with integrated lessons featuring software and mechanical simulators.
        </p>

        <div className={styles.heroActions}>
          <Link to="/docs/unit-00/classes-and-objects" className={styles.btnPrimary}>
            Begin Software
          </Link>
          <Link to="/mechanical/module-00/design-cycle" className={styles.btnTrackAlt}>
            Begin Mechanical
          </Link>
        </div>
      </div>

      <HeroVideo />
    </section>
  );
}

export default function Home(): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const buildCommit = String(siteConfig.customFields?.buildCommit ?? 'unknown');

  return (
    <Layout
      title={siteConfig.title}
      description="Learn FTC robotics through integrated software and mechanical lessons with browser-based simulators."
      wrapperClassName={styles.homeWrapper}
    >
      <Head>
        <meta name="telemark-build-commit" content={buildCommit} />
      </Head>

      <main className={styles.lp}>
        <HeroSection />
      </main>
    </Layout>
  );
}
