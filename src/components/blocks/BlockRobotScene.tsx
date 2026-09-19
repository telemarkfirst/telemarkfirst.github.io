import React from 'react';
import type {
  BlockPlaybackFrame,
  BlockScene,
} from '@site/src/telemark/blocks/blockInterpreter';
import styles from './BlockRobotScene.module.css';

interface BlockRobotSceneProps {
  scene: BlockScene;
  route: BlockScene[];
  trail: BlockScene[];
  frame: BlockPlaybackFrame | null;
  currentStep: number;
  totalSteps: number;
  playing: boolean;
}

const GRID_SIZE = 9;
const DIRECTION_NAMES = ['east', 'south', 'west', 'north'] as const;

function directionName(direction: number): string {
  return DIRECTION_NAMES[((direction % 4) + 4) % 4];
}

function actionName(frame: BlockPlaybackFrame | null): string {
  if (!frame) return 'Ready to run';
  switch (frame.kind) {
    case 'start': return 'Program started';
    case 'move': return 'Moved forward';
    case 'turn': return 'Turned right';
    case 'decision': return 'Checked a decision';
    case 'loop': return 'Started a loop';
    case 'function': return 'Called a function';
    case 'return': return 'Returned a value';
    default:
      if (frame.blockType === 'telemark_print' || frame.blockType === 'text_print') return 'Printed output';
      if (frame.blockType === 'variables_set') return 'Set a variable';
      if (frame.blockType === 'math_change') return 'Changed a variable';
      return 'Ran a command';
  }
}

export function describePlaybackFrame(
  frame: BlockPlaybackFrame,
  currentStep: number,
  totalSteps: number,
): string {
  const prefix = `Step ${currentStep} of ${totalSteps}. ${actionName(frame)}.`;
  if (frame.kind === 'move' || frame.kind === 'turn') {
    return `${prefix} Robot is facing ${directionName(frame.scene.direction)} at column ${frame.scene.x}, row ${frame.scene.y}.`;
  }
  if (frame.blockType === 'telemark_print' || frame.blockType === 'text_print') {
    const printed = frame.output[frame.output.length - 1] ?? '';
    return `${prefix} Output is ${printed || 'empty'}.`;
  }
  return prefix;
}

function axisStart(values: number[], current: number): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min + 1 <= GRID_SIZE - 2) {
    return Math.floor((min + max - GRID_SIZE + 1) / 2);
  }
  return current - Math.floor(GRID_SIZE / 2);
}

function withoutRepeatedPositions(scenes: BlockScene[]): BlockScene[] {
  return scenes.filter((scene, index) => index === 0
    || scene.x !== scenes[index - 1].x
    || scene.y !== scenes[index - 1].y);
}

export default function BlockRobotScene({
  scene,
  route,
  trail,
  frame,
  currentStep,
  totalSteps,
  playing,
}: BlockRobotSceneProps): React.JSX.Element {
  const routeScenes = route.length > 0 ? route : [scene];
  const minX = axisStart(routeScenes.map((point) => point.x), scene.x);
  const minY = axisStart(routeScenes.map((point) => point.y), scene.y);
  const left = ((scene.x - minX + 0.5) / GRID_SIZE) * 100;
  const top = ((scene.y - minY + 0.5) / GRID_SIZE) * 100;
  const originVisible = 0 >= minX && 0 < minX + GRID_SIZE
    && 0 >= minY && 0 < minY + GRID_SIZE;
  const path = withoutRepeatedPositions(trail.length > 0 ? trail : [scene]);
  const pathPoints = path
    .map((point) => `${point.x - minX + 0.5},${point.y - minY + 0.5}`)
    .join(' ');
  const status = currentStep > 0
    ? `${playing ? 'Running' : 'Showing'} step ${currentStep} of ${totalSteps}`
    : 'Ready';
  const ariaLabel = `Robot field. ${actionName(frame)}. Robot is facing ${directionName(scene.direction)} at column ${scene.x}, row ${scene.y}, after ${scene.moves} movement steps.`;

  return (
    <section className={styles.card} aria-label="Robot movement">
      <div className={styles.header}>
        <div>
          <h3>Robot field</h3>
          <p>{actionName(frame)}</p>
        </div>
        <span className={styles.stepStatus}>{status}</span>
      </div>

      <div
        className={styles.field}
        role="img"
        aria-label={ariaLabel}
        style={{'--grid-size': GRID_SIZE} as React.CSSProperties}
      >
        <svg
          className={styles.route}
          viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g stroke="var(--grid-line)" strokeWidth="0.015">
            {Array.from({length: GRID_SIZE + 1}, (_, i) => (
              <path key={i} d={`M ${i} 0 V ${GRID_SIZE} M 0 ${i} H ${GRID_SIZE}`} />
            ))}
          </g>
          {path.length > 1 && <polyline points={pathPoints} />}
          {path.map((point, index) => (
            <circle
              key={`${point.x}:${point.y}:${index}`}
              cx={point.x - minX + 0.5}
              cy={point.y - minY + 0.5}
              r={index === 0 ? 0.13 : 0.09}
            />
          ))}
        </svg>

        {originVisible && (
          <span
            className={styles.origin}
            style={{
              left: `${((0 - minX + 0.5) / GRID_SIZE) * 100}%`,
              top: `${((0 - minY + 0.5) / GRID_SIZE) * 100}%`,
            }}
            aria-hidden="true"
          >
            Start
          </span>
        )}

        <div className={styles.robotPosition} style={{left: `${left}%`, top: `${top}%`}} aria-hidden="true">
          <svg
            className={styles.robot}
            style={{transform: `rotate(${scene.direction * 90}deg)`}}
            viewBox="0 0 64 48"
          >
            <rect className={styles.wheel} x="10" y="2" width="13" height="7" rx="3" />
            <rect className={styles.wheel} x="10" y="39" width="13" height="7" rx="3" />
            <rect className={styles.wheel} x="41" y="2" width="13" height="7" rx="3" />
            <rect className={styles.wheel} x="41" y="39" width="13" height="7" rx="3" />
            <rect className={styles.body} x="8" y="7" width="48" height="34" rx="9" />
            <path className={styles.front} d="M56 14 L64 24 L56 34 Z" />
            <circle className={styles.sensor} cx="43" cy="18" r="3" />
            <circle className={styles.sensor} cx="43" cy="30" r="3" />
            <path className={styles.mark} d="M20 16 H35 V21 H30 V34 H25 V21 H20 Z" />
          </svg>
        </div>
      </div>

      <div className={styles.readout}>
        <span><strong>Facing</strong> {directionName(scene.direction)}</span>
        <span><strong>Position</strong> column {scene.x}, row {scene.y}</span>
        <span><strong>Moved</strong> {scene.moves} {scene.moves === 1 ? 'step' : 'steps'}</span>
      </div>
    </section>
  );
}
