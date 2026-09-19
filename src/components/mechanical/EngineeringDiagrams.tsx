import React from 'react';
import Figure, {visualStyles as s} from './visuals/Figure';
import {usePrefersReducedMotion} from './useAnimation';

/**
 * Static explanatory diagrams for engineering lessons that have no calculator.
 *
 * Each one exists because the concept is geometric and a paragraph describing
 * it is reliably misread. They are plain SVG with an aria-label carrying the
 * same information in prose.
 */

// ── Module 0: the design loop ───────────────────────────────────────────────

export function DesignCycleDiagram(): React.JSX.Element {
  const steps = ['Define', 'Ideate', 'Select', 'Build', 'Test', 'Refine'];
  const cx = 200;
  const cy = 108;
  const r = 76;
  // A dot traveling the loop shows that the process returns to the start.
  // SMIL is not affected by CSS animation-play-state, so the element is simply
  // not rendered when reduced motion is requested.
  const reducedMotion = usePrefersReducedMotion();
  const orbit = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;

  return (
    <Figure
      caption="The design cycle returns to the start"
      description="Six stages arranged in a circle: define, ideate, select, build, test, refine, with refine feeding back into define."
      viewBox="0 0 400 216"
      note="Refine feeds back into Define, because a real test usually shows that one of the original requirements was wrong. A process that ends after Test has nowhere to put that discovery."
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--tm-accent-a35)" strokeWidth="1.5" strokeDasharray="4 4" />
      {!reducedMotion && (
        <circle r="4.5" fill="var(--tm-warn)" opacity="0.9">
          <animateMotion dur="9s" repeatCount="indefinite" path={orbit} />
        </circle>
      )}
      {steps.map((step, i) => {
        const a = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        // Arrowhead midway to the next stage, rotated to point along the
        // circle so the direction of travel is unambiguous.
        const aNext = ((i + 0.5) / steps.length) * Math.PI * 2 - Math.PI / 2;
        const ax = cx + Math.cos(aNext) * r;
        const ay = cy + Math.sin(aNext) * r;
        const heading = (aNext * 180) / Math.PI + 90;
        return (
          <g key={step}>
            <circle cx={x} cy={y} r="26" fill="var(--tm-surface-1)" stroke="var(--tm-accent)" strokeWidth="1.6" />
            <text className={s.pointLabel} x={x} y={y + 3} textAnchor="middle">
              {step}
            </text>
            <path
              d="M -4 -4 L 0 4 L 4 -4"
              fill="none"
              stroke="var(--tm-accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${ax} ${ay}) rotate(${heading})`}
            />
          </g>
        );
      })}
      <text className={s.tickLabel} x={cx} y={cy - 4} textAnchor="middle">
        each pass
      </text>
      <text className={s.tickLabel} x={cx} y={cy + 8} textAnchor="middle">
        removes uncertainty
      </text>
    </Figure>
  );
}

// ── Modules 2 and 4: the two holes ──────────────────────────────────────────

export function ClearanceVsTappedDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="Clearance hole versus tapped hole"
      description="A screw passes freely through a clearance hole in the top part, drilled larger than the screw, and threads into a tapped hole in the bottom part, drilled smaller than the screw. Tightening clamps the parts together."
      viewBox="0 0 400 190"
      legend={[
        {color: '#60a5fa', label: 'Clearance hole (larger)'},
        {color: '#22d3ee', label: 'Tapped hole (smaller)'},
      ]}
      note="For M3 the two holes are 3.2 mm and 2.5 mm. They are 0.7 mm apart and not interchangeable. Drilling clearance where you needed tapped cannot be undone, because material cannot be added back."
    >
      {/* Top part with clearance hole */}
      <rect x="90" y="52" width="220" height="26" fill="rgba(96,165,250,0.16)" stroke="#60a5fa" strokeWidth="1.4" />
      <rect x="186" y="50" width="28" height="30" fill="#0d151e" />
      <text className={s.tickLabel} x="96" y="46">
        part the screw passes through
      </text>
      <text className={s.tickLabel} x="222" y="70" fill="#60a5fa">
        3.2 mm clearance
      </text>

      {/* Bottom part with tapped hole */}
      <rect x="90" y="86" width="220" height="40" fill="rgba(34,211,238,0.13)" stroke="#22d3ee" strokeWidth="1.4" />
      <rect x="191" y="86" width="18" height="34" fill="#0d151e" />
      {/* Thread ticks */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1="191" y1={92 + i * 7} x2="196" y2={95 + i * 7} stroke="#22d3ee" strokeWidth="1.1" />
          <line x1="209" y1={92 + i * 7} x2="204" y2={95 + i * 7} stroke="#22d3ee" strokeWidth="1.1" />
        </g>
      ))}
      <text className={s.tickLabel} x="222" y="110" fill="#22d3ee">
        2.5 mm tap drill
      </text>
      <text className={s.tickLabel} x="96" y="140">
        part the screw threads into
      </text>

      {/* The screw */}
      <rect x="190" y="18" width="20" height="10" fill="#effbff" opacity="0.85" rx="1" />
      <rect x="194" y="28" width="12" height="66" fill="rgba(239,251,255,0.55)" />
      <text className={s.axisLabel} x="150" y="26" textAnchor="end">
        M3 screw
      </text>

      {/* Clamping force arrows */}
      <path d="M 130 84 l 0 -10 m -3 4 l 3 -5 l 3 5" stroke="#4ade80" strokeWidth="1.4" fill="none" />
      <path d="M 130 92 l 0 10 m -3 -4 l 3 5 l 3 -5" stroke="#4ade80" strokeWidth="1.4" fill="none" />
      <text className={s.tickLabel} x="112" y="170" fill="#4ade80">
        friction from clamping carries the load, not the screw
      </text>
    </Figure>
  );
}

// ── Module 3: triangulation ─────────────────────────────────────────────────

export function TriangulationDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="A rectangle racks, a triangle cannot"
      description="A four bar rectangle with pinned corners deforms into a parallelogram under a side load. Adding a diagonal brace turns it into two triangles, which cannot change shape without changing the length of a side."
      viewBox="0 0 400 180"
      legend={[
        {color: '#f87171', label: 'Racks under load'},
        {color: '#4ade80', label: 'Braced'},
      ]}
      note="Look for the rectangle on your robot that can become a parallelogram. That is where the frame flexes. A diagonal, a corner gusset, or a top rail tying two side plates into a box all solve it."
    >
      {/* Unbraced, shown deformed */}
      <text className={s.axisLabel} x="20" y="26">
        pinned rectangle
      </text>
      <polygon points="30,140 120,140 148,60 58,60" fill="none" stroke="#f87171" strokeWidth="2" />
      <polygon points="30,140 120,140 120,60 30,60" fill="none" stroke="rgba(248,113,113,0.3)" strokeWidth="1.2" strokeDasharray="3 3" />
      {[[30, 140], [120, 140], [148, 60], [58, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#0d151e" stroke="#f87171" strokeWidth="1.5" />
      ))}
      <path d="M 150 50 l 22 0 m -6 -4 l 7 4 l -7 4" stroke="#f87171" strokeWidth="1.6" fill="none" />
      <text className={s.tickLabel} x="34" y="160" fill="#f87171">
        collapses into a parallelogram
      </text>

      {/* Braced */}
      <text className={s.axisLabel} x="230" y="26">
        with a diagonal
      </text>
      <polygon points="240,140 330,140 330,60 240,60" fill="none" stroke="#4ade80" strokeWidth="2" />
      <line x1="240" y1="140" x2="330" y2="60" stroke="#4ade80" strokeWidth="2" />
      {[[240, 140], [330, 140], [330, 60], [240, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#0d151e" stroke="#4ade80" strokeWidth="1.5" />
      ))}
      <path d="M 342 50 l 22 0 m -6 -4 l 7 4 l -7 4" stroke="#4ade80" strokeWidth="1.6" fill="none" />
      <text className={s.tickLabel} x="244" y="160" fill="#4ade80">
        holds its shape
      </text>
    </Figure>
  );
}

// ── Module 4: shaft support ─────────────────────────────────────────────────

export function BearingSupportDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="Shaft support and cantilever load"
      description="A shaft on a single bearing pivots about it and the wheel wobbles. Two bearings spaced apart resist tipping, and the wider the spacing the smaller the reaction force at each bearing."
      viewBox="0 0 400 190"
      legend={[
        {color: '#f87171', label: 'One support'},
        {color: '#4ade80', label: 'Two supports, spaced'},
      ]}
      note="Reaction forces at the bearings scale with the cantilever length divided by the bearing spacing. Tripling the spacing cuts them by roughly a factor of three, at no cost but layout attention."
    >
      {/* Single support */}
      <text className={s.axisLabel} x="16" y="30">
        one bearing
      </text>
      <rect x="30" y="44" width="14" height="40" fill="rgba(203,230,241,0.2)" />
      <circle cx="37" cy="64" r="8" fill="none" stroke="#f87171" strokeWidth="2" />
      <line x1="37" y1="64" x2="150" y2="74" stroke="#f87171" strokeWidth="3" />
      <ellipse cx="158" cy="75" rx="7" ry="18" fill="none" stroke="#f87171" strokeWidth="2" />
      <path d="M 168 52 q 10 22 0 44" stroke="#f87171" strokeWidth="1.3" fill="none" strokeDasharray="3 2" />
      <text className={s.tickLabel} x="176" y="78" fill="#f87171">
        wobble
      </text>
      <text className={s.tickLabel} x="30" y="104">
        the shaft pivots about the single bearing
      </text>

      {/* Two supports */}
      <text className={s.axisLabel} x="16" y="132">
        two bearings
      </text>
      <rect x="30" y="146" width="14" height="34" fill="rgba(203,230,241,0.2)" />
      <rect x="104" y="146" width="14" height="34" fill="rgba(203,230,241,0.2)" />
      <circle cx="37" cy="163" r="8" fill="none" stroke="#4ade80" strokeWidth="2" />
      <circle cx="111" cy="163" r="8" fill="none" stroke="#4ade80" strokeWidth="2" />
      <line x1="37" y1="163" x2="170" y2="163" stroke="#4ade80" strokeWidth="3" />
      <ellipse cx="178" cy="163" rx="7" ry="18" fill="none" stroke="#4ade80" strokeWidth="2" />
      <line x1="37" y1="186" x2="111" y2="186" stroke="rgba(203,230,241,0.5)" strokeWidth="1" />
      <text className={s.tickLabel} x="200" y="150" fill="#4ade80">
        spacing resists tipping
      </text>
      <text className={s.tickLabel} x="200" y="168">
        keep the cantilever short
      </text>
    </Figure>
  );
}

// ── Module 8: intake contact geometry ───────────────────────────────────────

export function IntakeGeometryDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="Where the intake touches the element"
      description="A roller contacting a round game element above its center pushes the element away. Contacting below the center rolls the element up and into the robot."
      viewBox="0 0 400 180"
      legend={[
        {color: '#f87171', label: 'Contact above center: pushes away'},
        {color: '#4ade80', label: 'Contact below center: draws in'},
      ]}
      note="This single relationship explains most intake failures. Before changing the motor or the compound, check the height of the contact point relative to the center of the element."
    >
      {/* Floor */}
      <line x1="10" y1="140" x2="390" y2="140" stroke="rgba(203,230,241,0.3)" strokeWidth="1.5" />

      {/* Wrong: contact above center */}
      <circle cx="90" cy="116" r="24" fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth="1.6" />
      <line x1="66" y1="116" x2="114" y2="116" stroke="rgba(251,191,36,0.5)" strokeWidth="1" strokeDasharray="3 2" />
      <circle cx="90" cy="116" r="2" fill="#fbbf24" />
      <circle cx="118" cy="98" r="18" fill="none" stroke="#f87171" strokeWidth="2" />
      <path d="M 100 100 l 4 -4" stroke="#f87171" strokeWidth="2" />
      <path d="M 56 116 l -22 0 m 6 -4 l -7 4 l 7 4" stroke="#f87171" strokeWidth="1.6" fill="none" />
      <text className={s.tickLabel} x="26" y="164" fill="#f87171">
        contact above center
      </text>

      {/* Right: contact below center */}
      <circle cx="280" cy="116" r="24" fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth="1.6" />
      <line x1="256" y1="116" x2="304" y2="116" stroke="rgba(251,191,36,0.5)" strokeWidth="1" strokeDasharray="3 2" />
      <circle cx="280" cy="116" r="2" fill="#fbbf24" />
      <circle cx="308" cy="130" r="18" fill="none" stroke="#4ade80" strokeWidth="2" />
      <path d="M 246 116 l -22 0 m 6 -4 l -7 4 l 7 4" stroke="#4ade80" strokeWidth="1.6" fill="none" />
      <path d="M 268 96 q 12 -12 26 -4" stroke="#4ade80" strokeWidth="1.4" fill="none" />
      <text className={s.tickLabel} x="216" y="164" fill="#4ade80">
        contact below center
      </text>

      <text className={s.axisLabel} x="10" y="24">
        roller direction shown by the arrow
      </text>
    </Figure>
  );
}

// ── Module 9: strain relief ─────────────────────────────────────────────────

export function StrainReliefDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="Strain relief and the service loop"
      description="A cable anchored only far from its connector transfers all movement into the connector, fatiguing the conductor. Anchoring within a few inches with a slack service loop means the anchor absorbs the pull instead."
      viewBox="0 0 400 176"
      legend={[
        {color: '#f87171', label: 'No strain relief'},
        {color: '#4ade80', label: 'Anchored with a service loop'},
      ]}
      note="The conductor fatigues and breaks inside intact insulation, so the wire looks fine and the circuit is intermittent. Look immediately behind every connector when diagnosing one."
    >
      {/* Bad */}
      <text className={s.axisLabel} x="14" y="26">
        cable pulls on the connector
      </text>
      <rect x="150" y="34" width="30" height="22" rx="3" fill="rgba(203,230,241,0.15)" stroke="#f87171" strokeWidth="1.4" />
      <text className={s.tickLabel} x="184" y="49">
        motor
      </text>
      <path d="M 20 66 L 150 46" stroke="#f87171" strokeWidth="2.5" fill="none" />
      <circle cx="150" cy="46" r="4" fill="#f87171" />
      <path d="M 156 30 q 8 -8 14 -2" stroke="#f87171" strokeWidth="1.2" fill="none" />
      <text className={s.tickLabel} x="196" y="34" fill="#f87171">
        all movement lands here
      </text>
      <rect x="14" y="60" width="10" height="12" fill="rgba(203,230,241,0.35)" />
      <text className={s.tickLabel} x="14" y="86">
        only anchor, far away
      </text>

      {/* Good */}
      <text className={s.axisLabel} x="14" y="120">
        anchored close, with slack
      </text>
      <rect x="150" y="128" width="30" height="22" rx="3" fill="rgba(203,230,241,0.15)" stroke="#4ade80" strokeWidth="1.4" />
      <path
        d="M 20 156 L 96 152 q 22 -2 18 -14 q -4 -12 12 -10 q 14 2 20 12"
        stroke="#4ade80"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="150" cy="140" r="4" fill="#4ade80" />
      <rect x="90" y="146" width="10" height="12" fill="rgba(203,230,241,0.35)" />
      <text className={s.tickLabel} x="76" y="172" fill="#4ade80">
        anchor within a few inches
      </text>
      <text className={s.tickLabel} x="196" y="130" fill="#4ade80">
        service loop takes the movement
      </text>
    </Figure>
  );
}

// ── Module 11: print orientation ────────────────────────────────────────────

export function PrintOrientationDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="Print orientation and layer bonds"
      description="A printed bracket loaded so the force tries to separate its layers fails at the weak layer bond. Rotating the print so the layers run along the load puts the force through solid material instead."
      viewBox="0 0 400 176"
      legend={[
        {color: '#f87171', label: 'Load separates the layers'},
        {color: '#4ade80', label: 'Load runs across the layers'},
      ]}
      note="Print orientation is a design decision, not a printer setting. Record it on the drawing or in the notebook, because the person running the print will otherwise choose it for convenience."
    >
      {/* Bad orientation */}
      <text className={s.axisLabel} x="18" y="26">
        layers perpendicular to the load
      </text>
      {Array.from({length: 8}, (_, i) => (
        <rect key={i} x="40" y={40 + i * 9} width="110" height="7" fill="rgba(248,113,113,0.2)" stroke="#f87171" strokeWidth="0.8" />
      ))}
      <path d="M 95 34 l 0 -16 m -4 5 l 4 -6 l 4 6" stroke="#f87171" strokeWidth="1.6" fill="none" />
      <path d="M 95 118 l 0 16 m -4 -5 l 4 6 l 4 -6" stroke="#f87171" strokeWidth="1.6" fill="none" />
      <text className={s.tickLabel} x="30" y="152" fill="#f87171">
        fails at the bond between layers
      </text>

      {/* Good orientation */}
      <text className={s.axisLabel} x="230" y="26">
        layers along the load
      </text>
      {Array.from({length: 12}, (_, i) => (
        <rect key={i} x={250 + i * 9} y="40" width="7" height="72" fill="rgba(74,222,128,0.16)" stroke="#4ade80" strokeWidth="0.8" />
      ))}
      <path d="M 305 34 l 0 -16 m -4 5 l 4 -6 l 4 6" stroke="#4ade80" strokeWidth="1.6" fill="none" />
      <path d="M 305 118 l 0 16 m -4 -5 l 4 6 l 4 -6" stroke="#4ade80" strokeWidth="1.6" fill="none" />
      <text className={s.tickLabel} x="242" y="152" fill="#4ade80">
        load passes through solid material
      </text>
    </Figure>
  );
}

// ── Module 6: belt wrap ─────────────────────────────────────────────────────

export function WrapAngleDiagram(): React.JSX.Element {
  return (
    <Figure
      caption="Wrap angle on the small pulley"
      description="A short center distance between pulleys of very different sizes reduces how much of the small pulley the belt contacts, putting fewer teeth in mesh and making the belt more likely to skip. Increasing the center distance or adding an idler restores the wrap."
      viewBox="0 0 400 176"
      legend={[
        {color: '#f87171', label: 'Low wrap: fewer teeth in mesh'},
        {color: '#4ade80', label: 'Good wrap: above 120 degrees'},
      ]}
      note="Keep wrap on the small pulley above roughly 120 degrees. Increase the center distance, use a larger small pulley, or add an idler on the slack side."
    >
      {/* Low wrap */}
      <circle cx="60" cy="90" r="14" fill="none" stroke="#f87171" strokeWidth="2" />
      <circle cx="130" cy="90" r="40" fill="none" stroke="rgba(248,113,113,0.5)" strokeWidth="2" />
      <path d="M 55 76 A 40 40 0 0 1 128 50" stroke="#f87171" strokeWidth="2" fill="none" />
      <path d="M 55 104 A 40 40 0 0 0 128 130" stroke="#f87171" strokeWidth="2" fill="none" />
      <text className={s.tickLabel} x="20" y="150" fill="#f87171">
        short centers, big size difference
      </text>
      <text className={s.axisLabel} x="20" y="26">
        low wrap
      </text>

      {/* Good wrap */}
      <circle cx="250" cy="90" r="14" fill="none" stroke="#4ade80" strokeWidth="2" />
      <circle cx="345" cy="90" r="26" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="2" />
      <path d="M 248 76 L 344 64" stroke="#4ade80" strokeWidth="2" fill="none" />
      <path d="M 248 104 L 344 116" stroke="#4ade80" strokeWidth="2" fill="none" />
      <path d="M 236 90 A 14 14 0 0 1 248 76" stroke="#4ade80" strokeWidth="2.5" fill="none" />
      <path d="M 236 90 A 14 14 0 0 0 248 104" stroke="#4ade80" strokeWidth="2.5" fill="none" />
      <text className={s.tickLabel} x="216" y="150" fill="#4ade80">
        longer centers, closer sizes
      </text>
      <text className={s.axisLabel} x="216" y="26">
        good wrap
      </text>
    </Figure>
  );
}
