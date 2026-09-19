import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as En from 'blockly/msg/en';
import {registerTelemarkBlocks, toolboxForUnit} from '@site/src/telemark/blocks/blockDefinitions';
import {blockLessonConfig} from '@site/src/telemark/blocks/blockChallenges';
import {runBlockProgram, type BlockRunResult} from '@site/src/telemark/blocks/blockInterpreter';
import {getBlocksLessonsForUnit} from '@site/src/telemark/blocksCurriculum';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import {trackEvent} from '@site/src/telemark/analytics';
import BlockRobotScene, {describePlaybackFrame} from './BlockRobotScene';
import ConfirmDialog from '../ConfirmDialog';
import styles from './BlockPractice.module.css';

interface BlockPracticeProps {
  lessonId: string;
}

interface WorkspaceFile {
  format: 'telemark-block-workspace';
  version: 1;
  lessonId: string;
  workspace: Record<string, unknown>;
}

const initialized = {blocks: false};
const PLAYBACK_DELAY_MS = 650;

function storageKey(lessonId: string): string {
  return `telemark:blocks:workspace:v1:${lessonId}`;
}

function readWorkspace(lessonId: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(lessonId));
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function saveWorkspace(lessonId: string, workspace: Blockly.WorkspaceSvg): void {
  try {
    const state = Blockly.serialization.workspaces.save(workspace);
    window.localStorage.setItem(storageKey(lessonId), JSON.stringify(state));
  } catch (error) {
    console.warn('Telemark could not save this block workspace:', error);
  }
}

export default function BlockPractice({lessonId}: BlockPracticeProps): React.JSX.Element {
  const config = useMemo(() => blockLessonConfig(lessonId), [lessonId]);
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const pendingImportRef = useRef<WorkspaceFile | null>(null);
  const [result, setResult] = useState<BlockRunResult | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<'reset' | 'import' | null>(null);
  const {user} = useAuth();
  const {isComplete, markManyComplete, markSkipped} = useProgress(user);
  const recorded = isComplete(lessonId);
  const checks = config.checks.map((check) => ({
    label: check.label,
    passed: result ? check.test(result) : false,
  }));
  const allPassed = config.challenge && result !== null && result.error === null
    && checks.every((check) => check.passed);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const localeModule = En as unknown as {default?: Record<string, string>} & Record<string, string>;
    Blockly.setLocale(localeModule.default ?? localeModule);
    if (!initialized.blocks) {
      Blockly.common.defineBlocks(libraryBlocks);
      registerTelemarkBlocks();
      initialized.blocks = true;
    }
    const workspace = Blockly.inject(hostRef.current, {
      toolbox: toolboxForUnit(config.toolboxUnit),
      trashcan: true,
      sounds: false,
      zoom: {controls: true, wheel: true, startScale: 0.9, minScale: 0.55, maxScale: 1.4},
      move: {scrollbars: true, drag: true, wheel: true},
      renderer: 'zelos',
    });
    workspaceRef.current = workspace;
    Blockly.serialization.workspaces.load(readWorkspace(lessonId) ?? config.starter, workspace);
    const onChange = (event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return;
      saveWorkspace(lessonId, workspace);
      setResult(null);
      setStepIndex(-1);
      setPlaying(false);
    };
    workspace.addChangeListener(onChange);
    const resize = () => Blockly.svgResize(workspace);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      workspace.removeChangeListener(onChange);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [config, lessonId]);

  useEffect(() => {
    if (!playing || !result) return undefined;
    if (stepIndex >= result.playback.length - 1) {
      const finishTimer = window.setTimeout(() => {
        setPlaying(false);
        setMessage(result.error ?? `Program finished after ${result.operations} steps.`);
      }, PLAYBACK_DELAY_MS);
      return () => window.clearTimeout(finishTimer);
    }

    const nextIndex = stepIndex + 1;
    const frame = result.playback[nextIndex];
    const timer = window.setTimeout(() => {
      setStepIndex(nextIndex);
      workspaceRef.current?.highlightBlock(frame.blockId);
      setMessage(describePlaybackFrame(frame, nextIndex + 1, result.playback.length));
    }, nextIndex === 0 ? 260 : PLAYBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [playing, result, stepIndex]);

  function run(): BlockRunResult | null {
    const workspace = workspaceRef.current;
    if (!workspace) return null;
    workspace.highlightBlock(null);
    const next = runBlockProgram(workspace);
    setResult(next);
    setStepIndex(-1);
    setPlaying(next.playback.length > 0);
    setMessage(next.playback.length > 0
      ? `Running ${next.playback.length} visible steps.`
      : next.error ?? `Program finished after ${next.operations} steps.`);
    return next;
  }

  function toggleRun() {
    if (playing) {
      setPlaying(false);
      setMessage(stepIndex >= 0
        ? `Paused after visible step ${stepIndex + 1}.`
        : 'Paused before the first step.');
      return;
    }
    if (result && stepIndex < result.playback.length - 1) {
      setPlaying(true);
      setMessage('Continuing the program.');
      return;
    }
    run();
  }

  function step() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    setPlaying(false);
    const next = result ?? runBlockProgram(workspace);
    if (!result) setResult(next);
    if (next.playback.length === 0) {
      setMessage(next.error ?? `Program finished after ${next.operations} steps.`);
      return;
    }
    const target = result ? Math.min(stepIndex + 1, next.playback.length - 1) : 0;
    setStepIndex(target);
    workspaceRef.current?.highlightBlock(next.playback[target].blockId);
    setMessage(describePlaybackFrame(next.playback[target], target + 1, next.playback.length));
  }

  function reset() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    setConfirmation('reset');
  }

  function applyReset() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.clear();
    Blockly.serialization.workspaces.load(config.starter, workspace);
    window.localStorage.removeItem(storageKey(lessonId));
    saveWorkspace(lessonId, workspace);
    setResult(null);
    setStepIndex(-1);
    setPlaying(false);
    setMessage('Workspace reset.');
  }

  function applyImport(parsed: WorkspaceFile) {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.clear();
    Blockly.serialization.workspaces.load(parsed.workspace, workspace);
    saveWorkspace(lessonId, workspace);
    setResult(null);
    setStepIndex(-1);
    setPlaying(false);
    setMessage(parsed.lessonId === lessonId
      ? 'Workspace imported.'
      : 'Workspace imported from a different lesson. Check each block before running it.');
  }

  function download() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const payload: WorkspaceFile = {
      format: 'telemark-block-workspace',
      version: 1,
      lessonId,
      workspace: Blockly.serialization.workspaces.save(workspace),
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lessonId.replace('/', '-')}-blocks.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Workspace file downloaded.');
  }

  async function importWorkspace(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !workspaceRef.current) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<WorkspaceFile>;
      if (parsed.format !== 'telemark-block-workspace' || parsed.version !== 1 || !parsed.workspace) {
        throw new Error('That file is not a Telemark block workspace.');
      }
      const imported = parsed as WorkspaceFile;
      if (workspaceRef.current.getAllBlocks(false).length > 0) {
        pendingImportRef.current = imported;
        setConfirmation('import');
        return;
      }
      applyImport(imported);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not import that workspace.');
    }
  }

  async function recordChallenge() {
    if (!allPassed) return;
    setSaving(true);
    try {
      const lessonIds = getBlocksLessonsForUnit(lessonId.split('/')[0]).map((lesson) => lesson.id);
      await markManyComplete(lessonIds);
      trackEvent('blocks_challenge_pass', {lesson_id: lessonId, unit: config.unit});
      setMessage('Unit progress recorded.');
    } finally {
      setSaving(false);
    }
  }

  async function skipChallenge() {
    setSaving(true);
    try {
      await markSkipped(lessonId);
      trackEvent('blocks_challenge_skip', {lesson_id: lessonId, unit: config.unit});
      setMessage('Challenge marked as skipped. You can return at any time.');
    } finally {
      setSaving(false);
    }
  }

  const shown = result && stepIndex >= 0 ? result.playback[stepIndex] : null;
  const noPlayback = result !== null && result.playback.length === 0;
  const displayOutput = shown?.output ?? (noPlayback ? result?.output : []) ?? [];
  const displayVariables = shown?.variables ?? (noPlayback ? result?.variables : {}) ?? {};
  const displayScene = shown?.scene ?? (noPlayback ? result?.scene : config.initialScene) ?? config.initialScene;
  const route = result
    ? [config.initialScene, ...result.playback.map((frame) => frame.scene)]
    : [config.initialScene];
  const trail = result
    ? [config.initialScene, ...result.playback.slice(0, stepIndex + 1).map((frame) => frame.scene)]
    : [config.initialScene];

  return (
    <section className={styles.practice} aria-label="Block coding practice">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{config.challenge ? 'Checked coding challenge' : 'Guided practice'}</p>
          <h2>Build and run</h2>
          <p>{config.goal}</p>
          <ul className={styles.objectives}>
            {config.objectives.map((objective) => <li key={objective}>{objective}</li>)}
          </ul>
        </div>
        <button type="button" className={styles.utility} onClick={() => void shellRef.current?.requestFullscreen()}>Fullscreen</button>
      </div>

      <div className={styles.shell} ref={shellRef}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.run} onClick={toggleRun}>
            {playing ? 'Pause' : result && stepIndex < result.playback.length - 1 ? 'Continue' : 'Run'}
          </button>
          <button type="button" className={styles.utility} onClick={step}>Step</button>
          <button type="button" className={styles.utility} onClick={() => workspaceRef.current?.highlightBlock(null)}>Clear highlight</button>
          <button type="button" className={styles.utility} onClick={reset}>Reset</button>
          <button type="button" className={styles.utility} onClick={download}>Download</button>
          <button type="button" className={styles.utility} onClick={() => importRef.current?.click()}>Import</button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={(event) => void importWorkspace(event)} hidden />
        </div>
        <p className={styles.keyboard}>Keyboard: Tab to the workspace, arrow keys to move, T for the toolbox, and Enter or Space to edit. Step advances one visible command or robot movement.</p>
        <div className={styles.workspace} ref={hostRef} />
        <div className={styles.results}>
          <BlockRobotScene
            scene={displayScene}
            route={route}
            trail={trail}
            frame={shown}
            currentStep={shown ? stepIndex + 1 : 0}
            totalSteps={result?.playback.length ?? 0}
            playing={playing}
          />
          <div>
            <h3>Output</h3>
            <pre className={styles.output}>{displayOutput.length ? displayOutput.join('\n') : 'No output yet.'}</pre>
          </div>
          <div>
            <h3>Variables</h3>
            <pre className={styles.output}>{Object.keys(displayVariables).length ? JSON.stringify(displayVariables, null, 2) : 'No variables yet.'}</pre>
          </div>
        </div>
      </div>

      {config.challenge && (
        <div className={styles.checks}>
          <h3>Challenge checks</h3>
          {checks.map((check) => (
            <div key={check.label} className={check.passed ? styles.pass : styles.pending}>
              <span aria-hidden="true">{check.passed ? '✓' : '○'}</span> {check.label}
            </div>
          ))}
          <div className={styles.challengeActions}>
            <button type="button" className={styles.run} disabled={!allPassed || saving || recorded} onClick={() => void recordChallenge()}>
              {recorded ? 'Progress recorded' : saving ? 'Saving...' : 'Record unit complete'}
            </button>
            <button type="button" className={styles.utility} disabled={saving || recorded} onClick={() => void skipChallenge()}>Skip challenge</button>
            {recorded && (
              <Link className={styles.next} to={config.unit === 5 ? '/blocks/next-step' : `/blocks/blocks-unit-${String(config.unit + 1).padStart(2, '0')}`}>
                Continue
              </Link>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation === 'import' ? 'Replace this workspace?' : 'Restore the starter blocks?'}
        description={confirmation === 'import'
          ? 'Importing this file will replace every block currently in the workspace.'
          : 'This will replace your current blocks with the original lesson starter blocks.'}
        confirmLabel={confirmation === 'import' ? 'Replace and import' : 'Restore starter blocks'}
        danger
        onCancel={() => { pendingImportRef.current = null; setConfirmation(null); }}
        onConfirm={() => {
          const action = confirmation;
          const imported = pendingImportRef.current;
          pendingImportRef.current = null;
          setConfirmation(null);
          if (action === 'reset') applyReset();
          else if (action === 'import' && imported) applyImport(imported);
        }}
      />

      <p className={result?.error ? styles.error : styles.status} role="status" aria-live="polite">
        {message ?? 'Your workspace saves automatically in this browser.'}
      </p>
    </section>
  );
}
