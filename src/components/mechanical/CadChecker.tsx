import React, {useCallback, useRef, useState} from 'react';
import {CalcShell, SelectField, NumberField, calcStyles} from './CalcShell';
import styles from './CadChecker.module.css';
import {
  CAD_RUBRICS,
  MATERIAL_DENSITIES,
  checkFile,
  rubricById,
  worstSeverity,
  type CadReport,
} from '../../telemark/cad';
import {trackEvent} from '../../telemark/analytics';

const MATERIALS = Object.keys(MATERIAL_DENSITIES);

const SEVERITY_LABEL: Record<string, string> = {
  pass: 'Pass',
  warn: 'Check',
  fail: 'Fix',
  info: 'Note',
};

/**
 * Checks an exported CAD file against the numbers an exercise asked for.
 *
 * The file is read in the browser and never uploaded. That is partly privacy
 * and mostly honesty: there is no server grading this, and a student should
 * know that what they are getting is arithmetic on their own geometry rather
 * than a judgement from somewhere else.
 *
 * What it can prove is narrow and stated plainly in the report: sizes, hole
 * diameters against the standards in Module 12, whether a solid closes, and
 * roughly what it weighs. What it cannot do is tell anyone the design is good,
 * so the wording never says "correct", only which numbers matched.
 */
export default function CadChecker(): React.JSX.Element {
  const [rubricId, setRubricId] = useState('general');
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [budget, setBudget] = useState(0);
  const [report, setReport] = useState<CadReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const buffer = await file.arrayBuffer();
        const result = checkFile(buffer, {
          fileName: file.name,
          rubric: rubricById(rubricId),
          material,
          massBudgetGrams: budget > 0 ? budget : null,
        });
        setReport(result);
        trackEvent('cad_checked', {
          kind: result.kind,
          rubric: rubricId,
          outcome: worstSeverity(result.findings),
        });
      } catch (e) {
        setReport(null);
        setError(e instanceof Error ? e.message : 'That file could not be read.');
      }
    },
    [rubricId, material, budget],
  );

  const rubric = rubricById(rubricId);

  return (
    <CalcShell
      title="CAD File Check"
      subtitle="Export a part, drop it here, and see which numbers match what the exercise asked for."
      footnote="Send STEP when you want hole sizes checked exactly, and STL when you want volume, mass, and whether the solid closes. Onshape, Fusion, and SolidWorks all export both. Nothing leaves your browser."
    >
      <div className={calcStyles.inputs}>
        <SelectField
          label="Check against"
          value={rubricId}
          onChange={setRubricId}
          options={CAD_RUBRICS.map((r) => ({
            value: r.id,
            label: r.id === 'general' ? 'No exercise, just report' : `Exercise ${r.exercise}: ${r.title}`,
          }))}
          hint="Picking an exercise adds its stated sizes and holes as pass or fail checks."
        />
        <SelectField
          label="Material"
          value={material}
          onChange={setMaterial}
          options={MATERIALS.map((m) => ({value: m, label: m}))}
          hint="Used for the mass estimate on STL files."
        />
        <NumberField
          label="Mass budget (g)"
          value={budget}
          onChange={setBudget}
          step={5}
          min={0}
          hint="Optional. Zero means no budget to compare against."
        />
      </div>

      <div
        className={`${styles.drop} ${dragging ? styles.dropActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void run(file);
        }}
      >
        <p className={styles.dropText}>Drop a .step, .stp, or .stl file here</p>
        <button
          type="button"
          className={calcStyles.button}
          onClick={() => inputRef.current?.click()}
        >
          Choose a file
        </button>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          type="file"
          accept=".stl,.step,.stp"
          aria-label="CAD file to check"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void run(file);
            // Clearing lets the same file be re-checked after an edit and
            // re-export, which is the normal way this gets used.
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p className={`${calcStyles.verdict} ${calcStyles.verdictWarn}`}>{error}</p>
      )}

      {report && <Report report={report} />}

      {!report && rubric.notes.length > 0 && (
        <ul className={styles.notes}>
          {rubric.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </CalcShell>
  );
}

function Report({report}: {report: CadReport}): React.JSX.Element {
  const failed = report.findings.filter((f) => f.severity === 'fail').length;
  const overall = worstSeverity(report.findings);

  return (
    <div className={styles.report}>
      <p className={styles.reportHead}>
        <span className={styles.fileName}>{report.fileName}</span>
        <span className={styles.kind}>
          {report.kind === 'stl' ? 'Mesh export' : 'Exact geometry'}
        </span>
      </p>

      <ul className={styles.findings}>
        {report.findings.map((finding) => (
          <li key={finding.id} className={styles.finding}>
            <span className={`${styles.badge} ${styles[finding.severity]}`}>
              {SEVERITY_LABEL[finding.severity]}
            </span>
            <span className={styles.findingBody}>
              <span className={styles.findingLabel}>{finding.label}</span>
              <span className={styles.findingDetail}>{finding.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {report.holes.length > 0 && (
        <>
          <p className={calcStyles.presetLabel}>Circular features by size</p>
          <div className={styles.holeList}>
            {report.holes.map((hole) => (
              <p key={hole.diameter} className={styles.hole}>
                <span className={styles.holeSize}>{hole.diameter.toFixed(2)} mm</span>
                <span className={styles.holeCount}>x{hole.count}</span>
                <span className={styles.holeNote}>{hole.standard}</span>
              </p>
            ))}
          </div>
        </>
      )}

      <p
        className={`${calcStyles.verdict} ${
          overall === 'fail' ? calcStyles.verdictWarn : calcStyles.verdictGood
        }`}
      >
        {failed === 0
          ? 'Every number this file can answer for matched. That is not the same as the design being right, which is still a judgement a person makes.'
          : `${failed} check${failed === 1 ? '' : 's'} did not match. Fix ${failed === 1 ? 'it' : 'those'}, re-export, and drop the file again.`}
      </p>

      <p className={styles.limitsLabel}>What this check cannot tell you</p>
      <ul className={styles.notes}>
        {report.limits.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>

      {report.rubric.notes.length > 0 && (
        <ul className={styles.notes}>
          {report.rubric.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
