import { describe, expect, it } from 'vitest';
import { calculateDropChance, getGuaranteedAt, getMercyProgress } from './calculate.js';

describe('calculateDropChance', () => {
  it('returns base chance at 0 opened', () => {
    expect(calculateDropChance('ANCIENT', 0)).toBeCloseTo(0.005);
    expect(calculateDropChance('VOID', 0)).toBeCloseTo(0.005);
    expect(calculateDropChance('PRIMAL', 0)).toBeCloseTo(0.005);
    expect(calculateDropChance('SACRED', 0)).toBeCloseTo(0.06);
    expect(calculateDropChance('REMNANT', 0)).toBeCloseTo(0.025);
  });

  it('stays at base chance up to and including the mercy threshold', () => {
    expect(calculateDropChance('ANCIENT', 199)).toBeCloseTo(0.005);
    expect(calculateDropChance('ANCIENT', 200)).toBeCloseTo(0.005);
    expect(calculateDropChance('SACRED', 11)).toBeCloseTo(0.06);
    expect(calculateDropChance('SACRED', 12)).toBeCloseTo(0.06);
    expect(calculateDropChance('REMNANT', 24)).toBeCloseTo(0.025);
  });

  it('adds bonusPerShard for every shard opened past the threshold', () => {
    expect(calculateDropChance('ANCIENT', 201)).toBeCloseTo(0.055);
    expect(calculateDropChance('VOID', 209)).toBeCloseTo(0.455);
    expect(calculateDropChance('PRIMAL', 209)).toBeCloseTo(0.905);
    expect(calculateDropChance('SACRED', 13)).toBeCloseTo(0.08);
    expect(calculateDropChance('SACRED', 30)).toBeCloseTo(0.06 + 18 * 0.02);
    expect(calculateDropChance('REMNANT', 25)).toBeCloseTo(0.035);
    expect(calculateDropChance('REMNANT', 50)).toBeCloseTo(0.025 + 26 * 0.01);
  });

  it('caps chance at 100%', () => {
    expect(calculateDropChance('ANCIENT', 220)).toBe(1.0);
    expect(calculateDropChance('ANCIENT', 100000)).toBe(1.0);
    expect(calculateDropChance('PRIMAL', 210)).toBe(1.0);
    expect(calculateDropChance('SACRED', 59)).toBe(1.0);
    expect(calculateDropChance('SACRED', 100000)).toBe(1.0);
    expect(calculateDropChance('REMNANT', 122)).toBe(1.0);
    expect(calculateDropChance('REMNANT', 100000)).toBe(1.0);
  });
});

describe('getGuaranteedAt', () => {
  it('computes the shard count at which chance first reaches 100%', () => {
    expect(getGuaranteedAt('ANCIENT')).toBe(220);
    expect(getGuaranteedAt('VOID')).toBe(220);
    expect(getGuaranteedAt('PRIMAL')).toBe(210);
    expect(getGuaranteedAt('SACRED')).toBe(59);
    expect(getGuaranteedAt('REMNANT')).toBe(122);
  });
});

describe('getMercyProgress', () => {
  it('reports pre-mercy progress before the threshold, mercy inactive', () => {
    const progress = getMercyProgress('ANCIENT', 100);
    expect(progress.mercyActive).toBe(false);
    expect(progress.preMercyProgress).toBeCloseTo(0.5);
    expect(progress.mercyProgress).toBe(0);
  });

  it('activates mercy once the threshold is reached and tracks progress to guaranteedAt', () => {
    const progress = getMercyProgress('VOID', 209);
    expect(progress.mercyActive).toBe(true);
    expect(progress.preMercyProgress).toBe(1);
    expect(progress.guaranteedAt).toBe(220);
    expect(progress.mercyProgress).toBeCloseTo(9 / 20);
  });
});

describe('multiplier option (2x event support)', () => {
  it('doubles only the base chance, leaving bonusPerShard and threshold untouched', () => {
    expect(calculateDropChance('ANCIENT', 0, { multiplier: 2 })).toBeCloseTo(0.01);
    expect(calculateDropChance('ANCIENT', 200, { multiplier: 2 })).toBeCloseTo(0.01);
    expect(calculateDropChance('ANCIENT', 201, { multiplier: 2 })).toBeCloseTo(0.06);
    expect(calculateDropChance('SACRED', 0, { multiplier: 2 })).toBeCloseTo(0.12);
    expect(calculateDropChance('SACRED', 13, { multiplier: 2 })).toBeCloseTo(0.14);
  });

  it('caps at 100% the same way as without a multiplier', () => {
    expect(calculateDropChance('ANCIENT', 220, { multiplier: 2 })).toBe(1.0);
  });

  it('defaults to multiplier 1 when the option is omitted (no behavior change)', () => {
    expect(calculateDropChance('SACRED', 13)).toBeCloseTo(0.08);
  });

  it('shifts guaranteedAt earlier when the base chance is doubled', () => {
    expect(getGuaranteedAt('SACRED')).toBe(59);
    expect(getGuaranteedAt('SACRED', { multiplier: 2 })).toBe(56);
    expect(getGuaranteedAt('ANCIENT', { multiplier: 2 })).toBe(220);
  });

  it('getMercyProgress reflects the multiplier-adjusted guaranteedAt', () => {
    const progress = getMercyProgress('SACRED', 56, { multiplier: 2 });
    expect(progress.guaranteedAt).toBe(56);
    expect(progress.mercyActive).toBe(true);
    expect(progress.mercyProgress).toBe(1);
  });
});
