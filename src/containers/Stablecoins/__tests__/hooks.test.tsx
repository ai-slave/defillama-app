import { beforeEach, describe, expect, it } from 'vitest'
import { calcCirculating, groupBridgeData, groupChainsPegged } from '../hooks'

let chainGroupSettings: Record<string, boolean> = {}

function getGroupChainsResult(
	chains: Parameters<typeof groupChainsPegged>[0],
	groupData: Parameters<typeof groupChainsPegged>[1]
) {
	return groupChainsPegged(chains, groupData, chainGroupSettings)
}

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

beforeEach(() => {
	chainGroupSettings = {}
})

describe('useCalcCirculating', () => {
	it('adds unreleased supply before sorting and keeps delisted assets discoverable', () => {
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

describe('useGroupChainsPegged', () => {
	it('groups enabled child chains into their parent without duplicating subrows', () => {
		chainGroupSettings = { L2: true }

		const result = getGroupChainsResult(
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
					mcapPrevDay: 1_000,
					mcapPrevWeek: 1_000,
					mcapPrevMonth: 1_000,
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
			}
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

	it('keeps an all-unavailable grouped metric unavailable while retaining explicit zero', () => {
		chainGroupSettings = { L2: true }

		const [unknownGroup, zeroGroup] = getGroupChainsResult(
			[
				groupChainRow({ name: 'Unknown', mcap: null, unreleased: null, bridgedTo: null, minted: null }),
				groupChainRow({ name: 'Zero', mcap: 0, unreleased: 0, bridgedTo: 0, minted: 0 })
			],
			{
				'Unknown Parent': { L2: ['Unknown'] },
				'Zero Parent': { L2: ['Zero'] }
			}
		)

		expect(unknownGroup).toMatchObject({ mcap: null, unreleased: null, bridgedTo: null, minted: null })
		expect(zeroGroup).toMatchObject({ mcap: 0, unreleased: 0, bridgedTo: 0, minted: 0 })
	})
})

describe('useGroupBridgeData', () => {
	it('keeps an unavailable bridged percentage distinct from an explicit zero', () => {
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
		expect(unknown?.bridgedAmount).toBeNull()
		expect(unknown?.subRows?.[0]?.bridgedAmount).toBeNull()
		expect(zero?.bridgedAmount).toBe('0.00%')
		expect(zero?.subRows?.[0]?.bridgedAmount).toBe('0.00%')
	})

	it('does not infer a full-supply bridge when both measurements are unavailable', () => {
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
			bridgedAmount: null
		})
	})
})
