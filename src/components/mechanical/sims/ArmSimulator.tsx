import React, {useCallback, useEffect, useRef, useState} from 'react';
import {usePrefersReducedMotion} from '../useAnimation';
import {RangeField} from '../CalcShell';
import {G, KG_PER_LB, M_PER_IN, NM_TO_IN_LB, fmt} from '@site/src/telemark/mechanicalMath';
import styles from './ArmSimulator.module.css';

/**
 * A time stepped arm, rather than another calculator.
 *
 * The calculators answer "does this design work". This answers "what happens
 * when you run it", which is a different and more convincing thing: the arm
 * accelerates, slows as gravity rises toward horizontal, stalls outright if
 * the reduction is too low, and holds or sags at the top. The motor follows
 * the same torque-speed line the calculators use, so the two agree.
 *
 * Deliberately simple physics: a rigid arm, a linear motor model, and a
 * matched cosine counterbalance. Enough to be honest about the behaviour that
 * matters, and not pretending to be a dynamics package.
 */

const TARGET_DEG = 90;
const START_DEG = -8;
const MAX_DEG = 100;
const HOLD_REQUIRED_S = 2;
const REACH_LIMIT_S = 3;

interface Telemetry {
  angle: number;
  omega: number;
  demand: number;
  available: number;
  fraction: number;
  current: number;
  elapsed: number;
  stalled: boolean;
  holdTime: number;
  peakFraction: number;
  reachedAt: number | null;
}

const IDLE: Telemetry = {
  angle: START_DEG, omega: 0, demand: 0, available: 0, fraction: 0,
  current: 0, elapsed: 0, stalled: false, holdTime: 0, peakFraction: 0,
  reachedAt: null,
};

export default function ArmSimulator(): React.JSX.Element {
  const reduced = usePrefersReducedMotion();
  const [reduction, setReduction] = useState(150);
  const [payloadLb, setPayloadLb] = useState(1.2);
  const [assist, setAssist] = useState(0);
  const [running, setRunning] = useState(false);
  const [tel, setTel] = useState<Telemetry>(IDLE);

  const frame = useRef<number | null>(null);
  const last = useRef<number>(0);
  const state = useRef<Telemetry>(IDLE);

  // Fixed geometry, so the controls that matter are the ones the lesson
  // discusses: reduction, payload, and counterbalance.
  const ARM_LB = 2.5;
  const ARM_CG_IN = 9;
  const ARM_LEN_IN = 18;
  const PAYLOAD_IN = 17;
  const MOTOR_STALL = 0.105;
  const MOTOR_FREE_RPM = 6000;
  const MOTOR_STALL_A = 11;
  const EFFICIENCY = 0.8;

  const reset = useCallback(() => {
    setRunning(false);
    state.current = IDLE;
    setTel(IDLE);
    last.current = 0;
  }, []);

  useEffect(() => {
    reset();
  }, [reduction, payloadLb, assist, reset]);

  useEffect(() => {
    if (!running) return undefined;

    function step(now: number) {
      if (!last.current) last.current = now;
      // Clamped so a backgrounded tab does not integrate a huge step.
      const dt = Math.min((now - last.current) / 1000, 0.05);
      last.current = now;

      const s = {...state.current};
      const theta = (s.angle * Math.PI) / 180;

      const armMass = ARM_LB * KG_PER_LB;
      const payMass = payloadLb * KG_PER_LB;
      const cg = ARM_CG_IN * M_PER_IN;
      const payL = PAYLOAD_IN * M_PER_IN;
      const armL = ARM_LEN_IN * M_PER_IN;

      // Gravity, and a counterbalance matched to the same cosine shape.
      const worstCase = armMass * G * cg + payMass * G * payL;
      const gravity = worstCase * Math.cos(theta);
      const spring = worstCase * (assist / 100) * Math.cos(theta);
      const net = gravity - spring;

      // Motor torque at the output, falling linearly with arm speed.
      const stallOut = MOTOR_STALL * reduction * EFFICIENCY;
      const freeOutRad = ((MOTOR_FREE_RPM / reduction) * 2 * Math.PI) / 60;
      const speedFraction = Math.min(Math.abs(s.omega) / freeOutRad, 1);
      const available = stallOut * (1 - speedFraction);

      // Commanded like RUN_TO_POSITION: full effort until close, then hold.
      const error = TARGET_DEG - s.angle;
      const commandFraction = Math.abs(error) < 2 ? 0.35 : 1;
      const applied = Math.sign(error) * available * commandFraction;

      const inertia =
        (armMass * armL * armL) / 3 + payMass * payL * payL;
      const alpha = (applied - net) / inertia;

      s.omega += alpha * dt;
      s.angle += (s.omega * 180) / Math.PI * dt;

      if (s.angle > MAX_DEG) { s.angle = MAX_DEG; s.omega = 0; }
      if (s.angle < START_DEG) { s.angle = START_DEG; s.omega = 0; }

      s.demand = Math.abs(net);
      s.available = stallOut;
      s.fraction = stallOut > 0 ? Math.min(s.demand / stallOut, 1) : 1;
      s.peakFraction = Math.max(s.peakFraction, s.fraction);
      s.current = 0.4 + (MOTOR_STALL_A - 0.4) * s.fraction;
      s.elapsed += dt;

      // Stalled: commanded to move, effectively still, and out of torque.
      s.stalled = s.demand >= stallOut * 0.99 && Math.abs(s.omega) < 0.05;

      if (s.angle >= TARGET_DEG - 3) {
        s.holdTime += dt;
        if (s.reachedAt === null) s.reachedAt = s.elapsed;
      } else {
        s.holdTime = 0;
      }

      state.current = s;
      setTel(s);
      frame.current = requestAnimationFrame(step);
    }

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      last.current = 0;
    };
  }, [running, reduction, payloadLb, assist]);

  const reqs = [
    {
      label: `Reaches ${TARGET_DEG}° within ${REACH_LIMIT_S} s`,
      pass: tel.reachedAt !== null && tel.reachedAt <= REACH_LIMIT_S,
    },
    {
      label: 'Stays under 60% of stall torque',
      pass: tel.elapsed > 0.3 && tel.peakFraction <= 0.6,
    },
    {
      label: `Holds the top for ${HOLD_REQUIRED_S} s`,
      pass: tel.holdTime >= HOLD_REQUIRED_S,
    },
  ];
  const allPass = reqs.every((r) => r.pass);

  // Drawing geometry.
  const pivotX = 70;
  const pivotY = 190;
  const scale = 150 / PAYLOAD_IN;
  const rad = (tel.angle * Math.PI) / 180;
  const tipX = pivotX + Math.cos(rad) * PAYLOAD_IN * scale;
  const tipY = pivotY - Math.sin(rad) * PAYLOAD_IN * scale;
  const cgX = pivotX + Math.cos(rad) * ARM_CG_IN * scale;
  const cgY = pivotY - Math.sin(rad) * ARM_CG_IN * scale;

  const fractionClass =
    tel.fraction > 0.85 ? styles.gaugeBad : tel.fraction > 0.6 ? styles.gaugeWarn : '';
  const valueClass =
    tel.fraction > 0.85 ? styles.valBad : tel.fraction > 0.6 ? styles.valWarn : '';

  return (
    <section className={styles.sim}>
      <div className={styles.head}>
        <span className={styles.title}>Arm Simulator</span>
        <span className={styles.sub}>
          Run it and watch where it stalls, not just whether the number says it fits.
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.stage}>
          <svg className={styles.svg} viewBox="0 0 380 230" role="img"
            aria-label={`Arm at ${Math.round(tel.angle)} degrees, using ${Math.round(tel.fraction * 100)} percent of available torque, drawing ${fmt(tel.current, 1)} amps.`}>
            {/* Target and horizontal references */}
            <line x1={pivotX} y1={pivotY} x2={pivotX + 170} y2={pivotY}
              stroke="var(--tm-border-hair)" strokeDasharray="3 3" />
            <line x1={pivotX} y1={pivotY} x2={pivotX} y2={pivotY - 165}
              stroke="rgba(74,222,128,0.28)" strokeDasharray="4 4" />
            <text x={pivotX + 6} y={pivotY - 168} fill="var(--tm-success)"
              fontSize="9" fontFamily="var(--tm-font-label)">TARGET 90°</text>

            {/* Chassis */}
            <rect x={pivotX - 46} y={pivotY + 6} width="96" height="26" rx="3"
              fill="var(--tm-surface-4)" stroke="var(--tm-border)" />

            {/* Arm */}
            <line x1={pivotX} y1={pivotY} x2={tipX} y2={tipY}
              stroke={tel.stalled ? 'var(--tm-danger)' : 'var(--tm-accent)'}
              strokeWidth="6" strokeLinecap="round" />

            {/* Counterbalance, drawn when engaged */}
            {assist > 0 && (
              <line x1={pivotX} y1={pivotY} x2={pivotX - Math.cos(rad) * 34} y2={pivotY + Math.sin(rad) * 34}
                stroke="var(--tm-blue-soft)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
            )}

            <circle cx={cgX} cy={cgY} r="3.5" fill="none" stroke="var(--tm-text-strong)" strokeWidth="1.2" />
            <circle cx={tipX} cy={tipY} r="10" fill="rgba(251,191,36,0.22)"
              stroke="var(--tm-warn)" strokeWidth="1.8" />
            <circle cx={pivotX} cy={pivotY} r="5.5" fill="var(--tm-bg)"
              stroke="var(--tm-text-strong)" strokeWidth="2" />

            <text x={pivotX + 40} y={pivotY - 12} fill="var(--tm-text-muted)"
              fontSize="10" fontFamily="var(--tm-font-mono)">{Math.round(tel.angle)}°</text>

            {tel.stalled && (
              <text x={190} y={40} fill="var(--tm-danger)" fontSize="13"
                fontFamily="var(--tm-font-display)" fontWeight="700">STALLED</text>
            )}
          </svg>
        </div>

        <div className={styles.side}>
          <p className={styles.panelLabel}>Requirements</p>
          <div className={styles.reqs}>
            {reqs.map((r) => (
              <div key={r.label} className={`${styles.req} ${r.pass ? styles.reqPass : ''}`}>
                <span className={`${styles.check} ${r.pass ? styles.checkPass : ''}`} aria-hidden="true">✓</span>
                {r.label}
              </div>
            ))}
          </div>

          <p className={styles.panelLabel}>Telemetry</p>
          <div className={styles.telemetry}>
            <div className={styles.line}><span className={styles.key}>angle</span><span className={styles.val}>{fmt(tel.angle, 1)}°</span></div>
            <div className={styles.line}><span className={styles.key}>demand</span><span className={styles.val}>{fmt(tel.demand, 2)} N·m</span></div>
            <div className={styles.line}><span className={styles.key}>available</span><span className={styles.val}>{fmt(tel.available, 2)} N·m</span></div>
            <div className={styles.line}><span className={styles.key}>of stall</span><span className={`${styles.val} ${valueClass}`}>{Math.round(tel.fraction * 100)}%</span></div>
            <div className={styles.gauge}>
              <div className={`${styles.gaugeFill} ${fractionClass}`} style={{width: `${tel.fraction * 100}%`}} />
            </div>
            <div className={styles.line} style={{marginTop: 8}}><span className={styles.key}>current</span><span className={styles.val}>{fmt(tel.current, 1)} A</span></div>
            <div className={styles.line}><span className={styles.key}>peak load</span><span className={styles.val}>{Math.round(tel.peakFraction * 100)}%</span></div>
            <div className={styles.line}><span className={styles.key}>elapsed</span><span className={styles.val}>{fmt(tel.elapsed, 2)} s</span></div>
          </div>
        </div>
      </div>

      <div className={styles.transport}>
        <button type="button" className={`${styles.btn} ${styles.btnRun}`}
          onClick={() => setRunning(true)} disabled={running || reduced}>
          ▶ Run
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnStop}`}
          onClick={() => setRunning(false)} disabled={!running}>
          ■ Stop
        </button>
        <button type="button" className={styles.btn} onClick={reset}>↺ Reset</button>
        <span className={`${styles.status} ${
          tel.stalled ? styles.statusStalled : running ? styles.statusRunning : styles.statusIdle
        }`}>
          {reduced ? 'animation off' : tel.stalled ? 'stalled' : running ? 'running' : 'ready'}
        </span>
      </div>

      {/* The same paired slider and number control the calculators use, so a
          student meets one form vocabulary across every tool. */}
      <div className={styles.controls}>
        <RangeField
          label="Total reduction"
          value={reduction}
          onChange={setReduction}
          min={20}
          max={400}
          step={10}
          unit=":1"
        />
        <RangeField
          label="Payload"
          value={payloadLb}
          onChange={setPayloadLb}
          min={0}
          max={5}
          step={0.1}
          unit="lb"
        />
        <RangeField
          label="Counterbalance"
          value={assist}
          onChange={setAssist}
          min={0}
          max={95}
          step={5}
          unit="%"
        />
      </div>

      <p className={styles.verdict}>
        {reduced
          ? 'Animation is off because your system asks for reduced motion. The controls still change the design, and the calculator in this lesson gives the same answer without motion.'
          : allPass
            ? `All three requirements met. Worst case demand peaked at ${Math.round(tel.peakFraction * 100)}% of stall, which leaves room for a heavier game element and a tired battery.`
            : tel.stalled
              ? 'Stalled. The arm cannot lift itself at this angle, so it draws full current and produces no motion. Add reduction, lighten the payload, or add counterbalance.'
              : 'Press Run. Watch the demand climb as the arm approaches horizontal, which is where gravity torque peaks.'}
      </p>
    </section>
  );
}
