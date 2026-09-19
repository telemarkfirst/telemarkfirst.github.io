import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as En from 'blockly/msg/en';
import {registerTelemarkBlocks} from '@site/src/telemark/blocks/blockDefinitions';
import {fllToolboxForUnit, registerFllBlocks} from '@site/src/telemark/blocks/fllBlockDefinitions';
import {fllLessonConfig} from '@site/src/telemark/blocks/fllChallenges';
import {runFllProgram, type FllRunResult} from '@site/src/telemark/blocks/fllInterpreter';
import {getFllLessonsForUnit} from '@site/src/telemark/fllCurriculum';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import {trackEvent} from '@site/src/telemark/analytics';
import FllRobotScene3D from './FllRobotScene3D';
import ConfirmDialog from '../ConfirmDialog';
import styles from './BlockPractice.module.css';

interface Props {lessonId: string}
interface WorkspaceFile {format: 'telemark-fll-block-workspace'; version: 1; lessonId: string; workspace: Record<string, unknown>}
const initialized = {blocks: false};
const storageKey = (lessonId: string) => `telemark:fll:workspace:v1:${lessonId}`;

function readWorkspace(lessonId: string): Record<string, unknown> | null {
  try { const value = window.localStorage.getItem(storageKey(lessonId)); return value ? JSON.parse(value) : null; } catch { return null; }
}
function saveWorkspace(lessonId: string, workspace: Blockly.WorkspaceSvg): void {
  try { window.localStorage.setItem(storageKey(lessonId), JSON.stringify(Blockly.serialization.workspaces.save(workspace))); } catch (error) { console.warn('Telemark could not save this FLL workspace:', error); }
}

export default function FllPractice({lessonId}: Props): React.JSX.Element {
  const config = useMemo(() => fllLessonConfig(lessonId), [lessonId]);
  const hostRef = useRef<HTMLDivElement>(null); const shellRef = useRef<HTMLDivElement>(null); const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null); const importRef = useRef<HTMLInputElement>(null); const pendingImportRef = useRef<WorkspaceFile | null>(null);
  const [result, setResult] = useState<FllRunResult | null>(null); const [stepIndex, setStepIndex] = useState(-1); const [playing, setPlaying] = useState(false); const [message, setMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [confirmation, setConfirmation] = useState<'reset' | 'import' | null>(null);
  const {user} = useAuth(); const {isComplete, markManyComplete, markSkipped} = useProgress(user); const recorded = isComplete(lessonId);
  const checks = config.checks.map((check) => ({label: check.label, passed: result ? check.test(result) : false}));
  const allPassed = config.challenge && result !== null && result.error === null && checks.every((check) => check.passed);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const locale = En as unknown as {default?: Record<string, string>} & Record<string, string>; Blockly.setLocale(locale.default ?? locale);
    if (!initialized.blocks) { Blockly.common.defineBlocks(libraryBlocks); registerTelemarkBlocks(); registerFllBlocks(); initialized.blocks = true; }
    const workspace = Blockly.inject(hostRef.current, {toolbox: fllToolboxForUnit(config.unit), trashcan: true, sounds: false, renderer: 'zelos', zoom: {controls: true, wheel: true, startScale: .86, minScale: .5, maxScale: 1.35}, move: {scrollbars: true, drag: true, wheel: true}});
    workspaceRef.current = workspace; Blockly.serialization.workspaces.load(readWorkspace(lessonId) ?? config.starter, workspace);
    const change = (event: Blockly.Events.Abstract) => { if (event.isUiEvent) return; saveWorkspace(lessonId, workspace); setResult(null); setStepIndex(-1); setPlaying(false); };
    workspace.addChangeListener(change); const resize = () => Blockly.svgResize(workspace); window.addEventListener('resize', resize);
    trackEvent('fll_simulator_launch', {lesson_id: lessonId});
    return () => { window.removeEventListener('resize', resize); workspace.removeChangeListener(change); workspace.dispose(); workspaceRef.current = null; };
  }, [config, lessonId]);

  useEffect(() => {
    if (!playing || !result) return undefined;
    if (stepIndex >= result.playback.length - 1) { const end = window.setTimeout(() => { setPlaying(false); setMessage(result.error ?? `Mission finished in ${result.scene.elapsedSeconds.toFixed(1)} simulated seconds.`); }, 320); return () => window.clearTimeout(end); }
    const next = stepIndex + 1; const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : next === 0 ? 180 : 420;
    const timer = window.setTimeout(() => { setStepIndex(next); workspaceRef.current?.highlightBlock(result.playback[next].blockId); setMessage(`Step ${next + 1} of ${result.playback.length}: ${result.playback[next].kind}.`); }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, result, stepIndex]);

  const run = () => { if (!workspaceRef.current) return null; const next = runFllProgram(workspaceRef.current); setResult(next); setStepIndex(-1); setPlaying(next.playback.length > 0); setMessage(next.error ?? `Running ${next.playback.length} visible steps.`); return next; };
  const toggle = () => { if (playing) { setPlaying(false); setMessage('Mission paused.'); } else if (result && stepIndex < result.playback.length - 1) setPlaying(true); else run(); };
  const step = () => { setPlaying(false); const next = result ?? run(); if (!next || !next.playback.length) return; const target = result ? Math.min(stepIndex + 1, next.playback.length - 1) : 0; setStepIndex(target); workspaceRef.current?.highlightBlock(next.playback[target].blockId); setMessage(`Step ${target + 1} of ${next.playback.length}: ${next.playback[target].kind}.`); };
  const reset = () => { if (workspaceRef.current) setConfirmation('reset'); };
  const applyReset = () => { if (!workspaceRef.current) return; workspaceRef.current.clear(); Blockly.serialization.workspaces.load(config.starter, workspaceRef.current); window.localStorage.removeItem(storageKey(lessonId)); saveWorkspace(lessonId, workspaceRef.current); setResult(null); setStepIndex(-1); setPlaying(false); setMessage('Workspace reset.'); };
  const applyImport = (parsed: WorkspaceFile) => { if (!workspaceRef.current) return; workspaceRef.current.clear(); Blockly.serialization.workspaces.load(parsed.workspace, workspaceRef.current); saveWorkspace(lessonId, workspaceRef.current); setResult(null); setStepIndex(-1); setPlaying(false); setMessage(parsed.lessonId === lessonId ? 'Workspace imported.' : 'Workspace imported from another FLL lesson.'); };
  const download = () => { if (!workspaceRef.current) return; const payload: WorkspaceFile = {format: 'telemark-fll-block-workspace', version: 1, lessonId, workspace: Blockly.serialization.workspaces.save(workspaceRef.current)}; const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], {type: 'application/json'})); const link = document.createElement('a'); link.href = url; link.download = `${lessonId.replace('/', '-')}-fll-blocks.json`; link.click(); URL.revokeObjectURL(url); setMessage('FLL workspace downloaded.'); };
  const importWorkspace = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !workspaceRef.current) return; try { const parsed = JSON.parse(await file.text()) as Partial<WorkspaceFile>; if (parsed.format !== 'telemark-fll-block-workspace' || parsed.version !== 1 || !parsed.workspace) throw new Error('That file is not a Telemark FLL workspace.'); const imported = parsed as WorkspaceFile; if (workspaceRef.current.getAllBlocks(false).length) { pendingImportRef.current = imported; setConfirmation('import'); return; } applyImport(imported); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not import that workspace.'); } };
  const record = async () => { if (!allPassed) return; setSaving(true); try { await markManyComplete(getFllLessonsForUnit(lessonId.split('/')[0]).map((lesson) => lesson.id)); trackEvent('fll_challenge_pass', {lesson_id: lessonId, unit: config.unit}); setMessage('FLL unit progress recorded.'); } finally { setSaving(false); } };
  const skip = async () => { setSaving(true); try { await markSkipped(lessonId); setMessage('Challenge marked as skipped.'); } finally { setSaving(false); } };

  const shown = result && stepIndex >= 0 ? result.playback[stepIndex] : null; const display = shown?.scene ?? result?.scene ?? config.initialScene;
  const trail = result ? [config.initialScene, ...result.playback.slice(0, stepIndex + 1).map((item) => item.scene)] : [config.initialScene];
  return <section className={styles.practice} aria-label="FLL block coding practice">
    <div className={styles.header}><div><p className={styles.eyebrow}>{config.challenge ? 'Checked FLL coding challenge' : 'FLL guided practice'}</p><h2>Build, run, and inspect</h2><p>{config.goal}</p><ul className={styles.objectives}>{config.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></div><button type="button" className={styles.utility} onClick={() => void shellRef.current?.requestFullscreen()}>Fullscreen</button></div>
    <div className={styles.shell} ref={shellRef}><div className={styles.toolbar}><button type="button" className={styles.run} onClick={toggle}>{playing ? 'Pause' : result && stepIndex < result.playback.length - 1 ? 'Continue' : 'Run'}</button><button type="button" className={styles.utility} onClick={step}>Step</button><button type="button" className={styles.utility} onClick={reset}>Reset</button><button type="button" className={styles.utility} onClick={download}>Download</button><button type="button" className={styles.utility} onClick={() => importRef.current?.click()}>Import</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importWorkspace(event)} /></div>
      <p className={styles.keyboard}>The editor uses SPIKE-style concepts but does not create official SPIKE project files. Use the official SPIKE App to download a program to a Hub.</p>
      <div className={styles.workspace} ref={hostRef} />
      <div className={styles.results}><FllRobotScene3D scene={display} trail={trail} frame={shown} currentStep={shown ? stepIndex + 1 : 0} totalSteps={result?.playback.length ?? 0} playing={playing} /><div><h3>Mission telemetry</h3><pre className={styles.output}>{result ? JSON.stringify({score: display.score, timeSeconds: Number(display.elapsedSeconds.toFixed(1)), heading: Number(display.headingDeg.toFixed(1)), distance: Number(display.distanceCm.toFixed(1)), reflection: display.reflection, repeatabilityPasses: result.repeatabilityPasses}, null, 2) : 'No mission run yet.'}</pre></div></div>
    </div>
    {config.challenge && <div className={styles.checks}><h3>Challenge checks</h3>{checks.map((check) => <div key={check.label} className={check.passed ? styles.pass : styles.pending}><span aria-hidden="true">{check.passed ? '✓' : '○'}</span> {check.label}</div>)}<div className={styles.challengeActions}><button type="button" className={styles.run} disabled={!allPassed || saving || recorded} onClick={() => void record()}>{recorded ? 'Progress recorded' : saving ? 'Saving...' : 'Record unit complete'}</button><button type="button" className={styles.utility} disabled={saving || recorded} onClick={() => void skip()}>Skip challenge</button>{recorded && <Link className={styles.next} to={config.unit === 2 ? '/blocks/fll' : `/blocks/fll/unit-${String(config.unit + 1).padStart(2, '0')}`}>Continue</Link>}</div></div>}
    <ConfirmDialog open={confirmation !== null} title={confirmation === 'import' ? 'Replace this FLL workspace?' : 'Restore the starter blocks?'} description={confirmation === 'import' ? 'Importing this file will replace every block currently in the FLL workspace.' : 'This will replace your current blocks with the original lesson starter blocks.'} confirmLabel={confirmation === 'import' ? 'Replace and import' : 'Restore starter blocks'} danger onCancel={() => { pendingImportRef.current = null; setConfirmation(null); }} onConfirm={() => { const action = confirmation; const imported = pendingImportRef.current; pendingImportRef.current = null; setConfirmation(null); if (action === 'reset') applyReset(); else if (action === 'import' && imported) applyImport(imported); }} />
    <p className={result?.error ? styles.error : styles.status} role="status" aria-live="polite">{message ?? 'Your FLL workspace saves automatically in this browser.'}</p>
  </section>;
}
