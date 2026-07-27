import { describe, expect, it } from 'vitest'
import {
	anyHasAnchors,
	formatDepositPct,
	modeledLossCell,
	scaleToPosition,
	scenarioGroup
} from '../components/scenarioShared'
import type { ScenarioVM } from '../types'

// Minimal computed scenario — only the fields modeledLossCell/anyHasAnchors read matter.
function scn(partial: Partial<ScenarioVM>): ScenarioVM {
	return {
		scenarioId: 's',
		kind: 'macro',
		title: 't',
		oneLiner: '',
		status: 'computed',
		lossMinUsd: 0,
		lossMaxUsd: 0,
		magnitudePct: 0,
		actingWindow: { kind: 'no-escape', label: '', minSec: 0, maxSec: 0 },
		conditions: { op: 'leaf', description: '' },
		mitigations: [],
		evidence: [],
		inputs: {},
		coverage: [],
		...partial
	}
}

const CURVE = [
	{ dropPct: 10, lossUsd: 0 },
	{ dropPct: 30, lossUsd: 5000 },
	{ dropPct: 50, lossUsd: 9000 }
]

describe('anyHasAnchors', () => {
	it('is true only when a computed scenario carries the served per-drop curve', () => {
		expect(anyHasAnchors([scn({ lossByAnchor: CURVE })])).toBe(true)
		expect(anyHasAnchors([scn({})])).toBe(false)
		// a curve on a non-computed row does not enable the toggle
		expect(anyHasAnchors([scn({ status: 'data_gap', lossByAnchor: CURVE })])).toBe(false)
	})
})

describe('modeledLossCell — no stress (mechanism enumeration)', () => {
	it('shows the representative drop note from inputs.drop_pct', () => {
		const cell = modeledLossCell(scn({ inputs: { drop_pct: 30 }, lossMinUsd: 5000, lossMaxUsd: 9000 }))
		expect(cell.note).toBe('At −30% stress')
		expect(cell.sortUsd).toBe(5000)
	})

	it('reports $0 buffered when the modeled drop produces no loss', () => {
		const cell = modeledLossCell(scn({ inputs: { drop_pct: 10 }, lossMinUsd: 0, lossMaxUsd: 9000 }))
		expect(cell.amount).toBe('$0')
		expect(cell.note).toBe('Buffered at −10%')
		expect(cell.sortUsd).toBe(0)
	})
})

describe('modeledLossCell — stress selected (price-driven row)', () => {
	const row = scn({ lossByAnchor: CURVE, lossMaxUsd: 30000, inputs: { drop_pct: 30 }, lossMinUsd: 5000 })

	it('reads the served loss at the chosen anchor', () => {
		expect(modeledLossCell(row, 30).sortUsd).toBe(5000)
		expect(modeledLossCell(row, 50).sortUsd).toBe(9000)
	})

	it('buffers at an anchor whose served loss is zero (drop named in the header, not the subtext)', () => {
		const cell = modeledLossCell(row, 10)
		expect(cell.amount).toBe('$0')
		expect(cell.note).toBe('Inside liquidation buffer')
	})

	it('"worst" reads the all-to-zero ceiling (lossMaxUsd)', () => {
		expect(modeledLossCell(row, 'worst').sortUsd).toBe(30000)
	})
})

describe('modeledLossCell — stress selected (no per-drop curve)', () => {
	it('shows a fixed figure with no subtext (the Status column carries the type)', () => {
		const cell = modeledLossCell(scn({ lossMinUsd: 1000, lossMaxUsd: 1000 }), 30)
		expect(cell.sortUsd).toBe(1000)
		expect(cell.note).toBeNull()
	})

	it('leaves a worst-case-only row as "—" with no subtext', () => {
		const cell = modeledLossCell(scn({ lossMinUsd: 0, lossMaxUsd: 1000 }), 30)
		expect(cell.amount).toBe('—')
		expect(cell.note).toBeNull()
	})

	it('"worst" shows the ceiling, never the floor, on a min<max row (oracle full-drain)', () => {
		// drainable-now floor 12.7m, full-compromise ceiling 124.5m: fixed at drop anchors…
		const fullDrain = scn({ lossMinUsd: 12_700_000, lossMaxUsd: 124_500_000 })
		expect(modeledLossCell(fullDrain, 10).sortUsd).toBe(12_700_000)
		expect(modeledLossCell(fullDrain, 50).sortUsd).toBe(12_700_000)
		// …but under the "Worst-case loss" header the cell must read the ceiling
		expect(modeledLossCell(fullDrain, 'worst').sortUsd).toBe(124_500_000)
		// a worst-case-only row ("—" at anchors) also resolves to its ceiling
		expect(modeledLossCell(scn({ lossMinUsd: 0, lossMaxUsd: 1000 }), 'worst').sortUsd).toBe(1000)
		// a genuinely $0 row stays untouched
		expect(modeledLossCell(scn({ lossMinUsd: 0, lossMaxUsd: 0 }), 'worst').amount).toBe('—')
	})
})

describe('scenarioGroup', () => {
	it('buckets by kind + scenario_id + status (presentation only)', () => {
		expect(scenarioGroup(scn({ kind: 'macro' }))).toBe('price-driven')
		expect(scenarioGroup(scn({ kind: 'oracle-malfunction' }))).toBe('oracle-liquidation')
		expect(scenarioGroup(scn({ kind: 'liquidity' }))).toBe('oracle-liquidation')
		expect(scenarioGroup(scn({ kind: 'smart-contract' }))).toBe('full-deposit')
		expect(scenarioGroup(scn({ kind: 'governance' }))).toBe('full-deposit')
		// vault-scoped ids win over their kind
		expect(scenarioGroup(scn({ kind: 'liquidity', scenarioId: 'public-allocator-misuse' }))).toBe('vault-allocator')
		expect(scenarioGroup(scn({ kind: 'governance', scenarioId: 'vault-curator-fee-extraction' }))).toBe(
			'vault-allocator'
		)
		// data_gap always lands in not-quantified regardless of kind
		expect(scenarioGroup(scn({ kind: 'macro', status: 'data_gap' }))).toBe('not-quantified')
	})
})

// The depositor-facing severity readout: a loss share rendered as a % of the deposit.
describe('formatDepositPct', () => {
	it('rounds, floors sub-1% to "<1%", and reads ≥99.5% as a clean 100%', () => {
		expect(formatDepositPct(1)).toBe('100%')
		expect(formatDepositPct(0.997)).toBe('100%')
		expect(formatDepositPct(0.856)).toBe('86%')
		expect(formatDepositPct(0.5)).toBe('50%')
		expect(formatDepositPct(0.004)).toBe('<1%')
		expect(formatDepositPct(0)).toBe('0%')
	})
})

// The % is position-independent (loss socialises pro-rata); only the dollar figure scales with the
// deposit. scaleToPosition owns that: your loss = pool loss × your share, share capped at 1.
describe('scaleToPosition', () => {
	it('returns the pool figure unchanged when no deposit is set or supply is unknown', () => {
		expect(scaleToPosition(1_000_000, 5_000_000, null)).toBe(1_000_000)
		expect(scaleToPosition(1_000_000, 0, 10_000)).toBe(1_000_000)
	})

	it('scales a pool loss to the depositor pro-rata, never above their deposit', () => {
		// $10k in a $100k pool → 10% of a $1M pool loss = $100k
		expect(scaleToPosition(1_000_000, 100_000, 10_000)).toBe(100_000)
		// a deposit larger than the pool can still only lose what the pool lost
		expect(scaleToPosition(50_000, 100_000, 500_000)).toBe(50_000)
	})
})
