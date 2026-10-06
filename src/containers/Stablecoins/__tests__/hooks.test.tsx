import { describe, expect, test } from 'vitest'
import { calcCirculating, groupBridgeData, groupChainsPegged } from '../hooks'

type GroupChainRow = Parameters<typeof groupChainsPegged>[0][number]
type GroupChainComparisonFields = Pick<
	GroupChainRow,
	'mcapPrevDay' | 'mcapPrevWeek' | 'mcapPrevMonth' | 'change_1d' | 'change_7d' | 'change_1m'
>

const groupChainRow = (
	row: Omit<GroupChainRow, keyof GroupChainComparisonFields> & Partial<GroupChainComparisonFields>
): GroupChainRow => ({
	mcapPrevDay: row.mcap,
	mcapPrevWeek: row.mcap,
	mcapPrevMonth: row.mcap,
	change_1d: null,
	change_7d: null,
	change_1m: null,
	...row
})

describe('calcCirculating', () => {
	test('adds unreleased supply before sorting and keeps delisted assets discoverable', () => {
		const result = calcCirculating(
			[
				{ name: 'Old', circulating: null, unreleased: null, mcap: null, delisted: true },
				{ name: 'Beta', circulating: 50, unreleased: 10, mcap: 200, pegType: 'peggedVAR', pegDeviation: 3 },
				{ name: 'Alpha', circulating: 100, unreleased: 25, mcap: 100, pegDeviation: null },
				{ name: 'Zero', circulating: 25, unreleased: null, mcap: 50, pegDeviation: 0 },
				{ name: 'Unknown', circulating: null, unreleased: 10, mcap: 25, pegDeviation: null }
			],
			true
		)

		expect(
			result.map(({ name, circulating, floatingPeg, depeggedTwoPercent, pegDeviation }) => ({
				name,
				circulating,
				floatingPeg,
				depeggedTwoPercent,
				pegDeviation
			}))
		).toEqual([
			{
				name: 'Beta',
				circulating: 60,
				floatingPeg: true,
				depeggedTwoPercent: true,
				pegDeviation: 3
			},
			{
				name: 'Alpha',
				circulating: 125,
				floatingPeg: false,
				depeggedTwoPercent: false,
				pegDeviation: null
			},
			{
				name: 'Zero',
				circulating: null,
				floatingPeg: false,
				depeggedTwoPercent: false,
				pegDeviation: 0
			},
			{
				name: 'Unknown',
				circulating: null,
				floatingPeg: false,
				depeggedTwoPercent: false,
				pegDeviation: null
			},
			{
				name: 'Old',
				circulating: null,
				floatingPeg: false,
				depeggedTwoPercent: false,
				pegDeviation: null
			}
		])
		expect(
			calcCirculating(
				[{ name: 'Known circulating', circulating: 25, unreleased: null, mcap: 50, pegDeviation: 0 }],
				false
			)[0]?.circulating
		).toBe(25)
	})
})

describe('groupChainsPegged', () => {
	test('groups enabled child chains into their parent without duplicating subrows', () => {
		const result = groupChainsPegged(
			[
				groupChainRow({
					name: 'Parent',
					mcap: 100,
					mcapPrevDay: 90,
					mcapPrevWeek: 80,
					mcapPrevMonth: 70,
					unreleased: 5,
					bridgedTo: 1,
					minted: 2
				}),
				groupChainRow({
					name: 'Child',
					mcap: 40,
					mcapPrevDay: 20,
					mcapPrevWeek: null,
					mcapPrevMonth: 10,
					unreleased: 3,
					bridgedTo: 4,
					minted: 5
				}),
				groupChainRow({
					name: 'Unknown Child',
					mcap: null,
					mcapPrevDay: 1000,
					mcapPrevWeek: 1000,
					mcapPrevMonth: 1000,
					unreleased: null,
					bridgedTo: null,
					minted: null
				}),
				groupChainRow({ name: 'Solo', mcap: 70, unreleased: null, bridgedTo: null, minted: null })
			],
			{
				Parent: {
					L2: ['Child', 'Child', 'Unknown Child']
				}
			},
			{ L2: true }
		)

		expect(result.map((chain) => [chain.name, chain.mcap, chain.subRows?.map((subRow) => subRow.name)])).toEqual([
			['Parent', 140, ['Parent', 'Child', 'Unknown Child']],
			['Solo', 70, undefined]
		])
		expect(result[0]).toMatchObject({
			mcapPrevDay: 110,
			mcapPrevWeek: null,
			mcapPrevMonth: 80,
			change_7d: null,
			change_1m: 75
		})
		expect(result[0]?.change_1d).toBeCloseTo(27.27)
	})

	test('keeps an all-unavailable grouped metric unavailable while retaining explicit zero', () => {
		const [unknownGroup, zeroGroup] = groupChainsPegged(
			[
				groupChainRow({ name: 'Unknown', mcap: null, unreleased: null, bridgedTo: null, minted: null }),
				groupChainRow({ name: 'Zero', mcap: 0, unreleased: 0, bridgedTo: 0, minted: 0 })
			],
			{
				'Unknown Parent': { L2: ['Unknown'] },
				'Zero Parent': { L2: ['Zero'] }
			},
			{ L2: true }
		)

		expect(unknownGroup).toMatchObject({ mcap: null, unreleased: null, bridgedTo: null, minted: null })
		expect(zeroGroup).toMatchObject({ mcap: 0, unreleased: 0, bridgedTo: 0, minted: 0 })
	})
})

describe('groupBridgeData', () => {
	const baseChain = {
		symbol: 'USD',
		circulating: 100,
		unreleased: 0,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		circulatingPrevDay: null,
		circulatingPrevWeek: null,
		circulatingPrevMonth: null
	}

	test('keeps an unavailable bridged percentage distinct from an explicit zero', () => {
		const result = groupBridgeData(
			[
				{
					...baseChain,
					name: 'Unknown',
					bridgedAmount: null,
					bridges: { bridge: [{ amount: 40, sourceChain: 'ethereum' }] }
				},
				{
					...baseChain,
					name: 'Zero',
					bridgedAmount: 0,
					bridges: { bridge: [{ amount: 0, sourceChain: 'ethereum' }] }
				}
			],
			{ bridge: { name: 'Bridge' } }
		)

		const unknown = result.find((row) => row.name === 'Unknown')
		const zero = result.find((row) => row.name === 'Zero')
		expect(unknown?.bridgedPercent).toBeNull()
		expect(unknown?.subRows?.[0]?.bridgedPercent).toBeNull()
		expect(zero?.bridgedPercent).toBe(0)
		expect(zero?.subRows?.[0]?.bridgedPercent).toBe(0)
	})

	test('does not infer a full-supply bridge when both measurements are unavailable', () => {
		const [result] = groupBridgeData(
			[
				{
					name: 'Unknown',
					symbol: 'USD',
					circulating: null,
					unreleased: null,
					bridgedAmount: null,
					change_1d: null,
					change_7d: null,
					change_1m: null,
					circulatingPrevDay: null,
					circulatingPrevWeek: null,
					circulatingPrevMonth: null,
					bridges: { bridge: [{ amount: 40, sourceChain: 'ethereum' }] }
				}
			],
			{ bridge: { name: 'Bridge' } }
		)

		expect(result?.name).toBe('Unknown')
		expect(result?.bridgedAmount).toBeNull()
		expect(result?.subRows?.[0]).toMatchObject({
			name: 'Bridged from Ethereum',
			circulating: 40,
			bridgedAmount: 40,
			bridgedPercent: null
		})
	})

	test('uses percentages for chains without breakdowns while keeping raw amounts and full precision', () => {
		const result = groupBridgeData(
			[10.1234, 0, null].map((bridgedAmount, index) => ({
				...baseChain,
				name: `chain-${index}`,
				circulating: 200,
				bridgedAmount,
				bridges: {}
			})),
			{}
		)
		expect(result.map(({ bridgedAmount }) => bridgedAmount)).toEqual([10.1234, 0, null])
		expect(result[0].bridgedPercent).toBeCloseTo(5.0617)
		expect(result[1].bridgedPercent).toBe(0)
		expect(result[2].bridgedPercent).toBeNull()
	})

	test.each([0, null])('does not divide by an unavailable or zero circulating supply (%s)', (circulating) => {
		const [row] = groupBridgeData([{ ...baseChain, name: 'Empty', circulating, bridgedAmount: 0, bridges: {} }], {})
		expect(row.bridgedPercent).toBeNull()
	})

	test.each([80, 120])(
		'preserves bridge shares and the 100 percent cap for a bridged amount of %s',
		(bridgedAmount) => {
			const [row] = groupBridgeData(
				[
					{
						...baseChain,
						name: 'Chain',
						bridgedAmount,
						bridges: {
							first: [{ amount: bridgedAmount * 0.75, sourceChain: 'ethereum' }],
							second: [{ amount: bridgedAmount * 0.25, sourceChain: 'arbitrum' }]
						}
					}
				],
				{ first: { name: 'First' }, second: { name: 'Second' } }
			)
			const percent = Math.min(100, bridgedAmount)
			expect(row.bridgedAmount).toBe(bridgedAmount)
			expect(row.bridgedPercent).toBe(percent)
			expect(row.subRows?.map(({ bridgedPercent }) => bridgedPercent)).toEqual([percent * 0.75, percent * 0.25])
			expect(row.subRows?.map((child) => child.bridgedAmount)).toEqual([bridgedAmount * 0.75, bridgedAmount * 0.25])
		}
	)

	test.each(['Natively Issued', 'Bridge'])('preserves the full-supply %s breakdown', (name) => {
		const [row] = groupBridgeData(
			[
				{
					...baseChain,
					name: 'Chain',
					bridgedAmount: 100,
					bridges: { bridge: [{ amount: 100, sourceChain: 'ethereum' }] }
				}
			],
			{ bridge: { name } }
		)
		expect(row.bridgedPercent).toBe(100)
		expect(row.subRows?.[0]).toMatchObject({
			name: name === 'Natively Issued' ? name : 'Bridged from Ethereum',
			bridgedAmount: 100,
			bridgedPercent: 100,
			bridgeInfo: { name: name === 'Natively Issued' ? '-' : name }
		})
	})
})
