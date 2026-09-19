/**
 * Motor reference data used by the engineering calculators.
 *
 * These are published bare-motor values. Always confirm against the vendor's
 * spec page for the exact part number you are ordering: manufacturers revise
 * gearboxes and ratings between production runs, and a geared version's rating
 * already includes gearbox efficiency.
 */
export interface MotorSpec {
  id: string;
  name: string;
  /** Free speed of the bare motor in RPM at 12 V. */
  freeSpeedRpm: number;
  /** Stall torque of the bare motor in newton meters at 12 V. */
  stallTorqueNm: number;
  /** Stall current in amps at 12 V. */
  stallCurrentA: number;
  /** No-load current draw in amps. */
  freeCurrentA: number;
  note: string;
}

export const MOTORS: MotorSpec[] = [
  {
    id: 'rev-hd-hex',
    name: 'REV HD Hex (bare motor)',
    freeSpeedRpm: 6000,
    stallTorqueNm: 0.105,
    stallCurrentA: 11,
    freeCurrentA: 0.4,
    note: 'Pair with a REV UltraPlanetary cartridge stack to get the output ratio.',
  },
  {
    id: 'rev-core-hex',
    name: 'REV Core Hex (geared output)',
    freeSpeedRpm: 125,
    stallTorqueNm: 3.2,
    stallCurrentA: 4.4,
    freeCurrentA: 0.2,
    note: 'Gearbox is built in, so leave the external reduction at 1:1 unless you add one.',
  },
  {
    id: 'generic-6000',
    name: 'Generic 6000 RPM core',
    freeSpeedRpm: 6000,
    stallTorqueNm: 0.12,
    stallCurrentA: 9.2,
    freeCurrentA: 0.35,
    note: 'Starting point only. Replace with the numbers printed on your motor spec page.',
  },
];

// Unit conversions live in src/telemark/mechanicalMath.ts so the calculator
// components and the math tests share one definition.
