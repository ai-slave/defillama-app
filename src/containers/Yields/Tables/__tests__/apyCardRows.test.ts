import { describe, expect, test } from 'vitest'
import { type ApyCardRowsInput, buildApyCardRows, signedPp } from '../apyCardRows'

function input(over: Partial<ApyCardRowsInput> = {}): ApyCardRowsInput {
	return {
		total: 3.03,
		base: 2.58,
		reward: 0.45,
		intrinsic: null,
		symbols: ['MORPHO'],
		intrinsicSourceSymbol: null,
		measured: 2.58,
		locked: false,
		median: undefined,
		...over
	}
}

const shape = (rows: ReturnType<typeof buildApyCardRows>) =>
	rows.map((row) => [[row.label, row.qualifier, row.provenance].filter(Boolean).join(' · '), row.value])

describe('buildApyCardRows', () => {
	test('names the measured base and totals from it, never showing the protocol’s own', () => {
		expect(shape(buildApyCardRows(input()))).toEqual([
			['Base · verified', '2.58%'],
			['Reward · MORPHO · reported', '0.45%'],
			['Total', '3.03%']
		])
	})

	// A Total over one leg would just repeat the headline; the Base row stays to name the leg measured.
	test('drops the Total row when the composition has a single leg', () => {
		const rows = buildApyCardRows(input({ total: 7.79, base: 7.79, reward: null, measured: 7.79 }))
		expect(shape(rows)).toEqual([['Base · verified', '7.79%']])
	})

	test('leaves an unmeasured pool with nothing but its own breakdown', () => {
		const rows = buildApyCardRows(input({ total: 9.8, base: 8.1, reward: 1.7, symbols: ['PENDLE'], measured: null }))
		expect(shape(rows)).toEqual([
			['Base', '8.10%'],
			['Reward · PENDLE', '1.70%'],
			['Total', '9.80%']
		])
	})

	// Nothing measured to show and no composition to break down: Total anchors the comparison.
	test('keeps Total when the median is the only extra row', () => {
		const rows = buildApyCardRows(
			input({
				total: 8.4,
				base: 8.4,
				reward: null,
				measured: null,
				median: { label: 'Ethereum', apy: 4.3 }
			})
		)
		expect(shape(rows)).toEqual([
			['Total', '8.40%'],
			['vs Ethereum median', '+4.1 pp']
		])
	})

	test('shows a fresh measured base that was deliberately not substituted into an unsplit total', () => {
		const rows = buildApyCardRows(
			input({
				total: 4.52,
				base: null,
				reward: null,
				measured: null,
				unsubstitutedMeasured: 5.68
			})
		)
		expect(shape(rows)).toEqual([['Base · verified', '5.68%']])
	})

	test('names a measured intrinsic leg for its source and shows only the measured figure', () => {
		const rows = buildApyCardRows(
			input({
				total: 2.7,
				base: 0.5,
				reward: null,
				intrinsic: 2.2,
				intrinsicSourceSymbol: 'weETH',
				measured: null,
				measuredIntrinsic: 2.2
			})
		)
		expect(shape(rows)).toEqual([
			['Base', '0.50%'],
			['Intrinsic · weETH · verified', '2.20%'],
			['Total', '2.70%']
		])
	})

	// Locked: the base stands, named "reported", so the offer's redacted "Base · verified" reads
	// against it.
	test('keeps the protocol’s base for a locked reader and never names the measurement', () => {
		const rows = buildApyCardRows(input({ total: 6.12, base: 6.12, reward: null, measured: null, locked: true }))
		expect(shape(rows)).toEqual([['Base · reported', '6.12%']])
	})

	test('ranks intrinsic under reward and qualifies it with its source', () => {
		const rows = buildApyCardRows(input({ intrinsic: 2.2, intrinsicSourceSymbol: 'wstETH', total: 5.23 }))
		expect(shape(rows).map(([label]) => label)).toEqual([
			'Base · verified',
			'Reward · MORPHO · reported',
			'Intrinsic · wstETH · reported',
			'Total'
		])
	})
})

describe('signedPp', () => {
	test('signs and spaces the unit, at the precision a bearing deserves', () => {
		expect(signedPp(3.52)).toBe('+3.5 pp')
		expect(signedPp(-1.24)).toBe('-1.2 pp')
		// Signed after rounding, so dust reads as no difference rather than a negative one.
		expect(signedPp(-0.004)).toBe('0.0 pp')
	})
})
