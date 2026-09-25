import { describe, expect, test } from 'vitest'
import type { PriceObject } from '~/api/types'
import type {
	AdapterChainProtocol,
	AdapterMetricPeriods,
	IAdapterChainMetrics
} from '~/containers/AdapterMetrics/api.types'
import type { ProtocolEmissionsLookupEntry } from '~/containers/Incentives/types'
import type { ParentProtocolLite, ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { buildProtocolRankings, type ProtocolRankingInput, selectRankingProtocols } from '../queries.server'
import { getProtocolEarningsValue } from '../readModel'

const protocolMetadata = {
	'parent#alpha': { displayName: 'Alpha Parent', chains: ['Ethereum', 'Optimism'] },
	'parent#empty': { displayName: 'Empty Parent', chains: ['Ethereum'] },
	'parent#mixed': { displayName: 'Mixed Parent', chains: ['Ethereum'] },
	'child-alpha-one': { displayName: 'Alpha One', chains: ['Ethereum', 'Arbitrum'] },
	'child-alpha-two': { displayName: 'Alpha Two', chains: ['Optimism', 'Ethereum'] },
	'mixed-base': { displayName: 'Mixed Base', chains: ['Ethereum'] },
	'mixed-zero': { displayName: 'Mixed Zero', chains: ['Ethereum'] },
	'mixed-bridge': { displayName: 'Mixed Bridge', chains: ['Ethereum'] },
	'solo-protocol': { displayName: 'Solo Protocol', chains: ['Ethereum'] }
} satisfies Record<string, IProtocolMetadata>

const tvlEntry = (
	tvl: number | null,
	tvlPrevDay: number | null,
	tvlPrevWeek: number | null,
	tvlPrevMonth: number | null
) => ({ tvl, tvlPrevDay, tvlPrevWeek, tvlPrevMonth })

const liteProtocol = (overrides: Partial<ProtocolLite>): ProtocolLite => ({
	category: 'Dexes',
	chains: ['Ethereum'],
	mcap: null,
	name: 'Protocol',
	symbol: 'PROTOCOL',
	logo: '',
	url: '',
	tvl: 0,
	tvlPrevDay: 0,
	tvlPrevWeek: 0,
	tvlPrevMonth: 0,
	chainTvls: {},
	defillamaId: 'protocol',
	geckoId: null,
	...overrides
})

const parentProtocol = (
	overrides: Pick<ParentProtocolLite, 'id' | 'name'> & Partial<Omit<ParentProtocolLite, 'id' | 'name'>>
): ParentProtocolLite => ({ chains: ['Ethereum'], gecko_id: null, logo: '', mcap: null, ...overrides })

const protocolsResponse = (
	protocols: Array<ProtocolLite>,
	parentProtocols: Array<ParentProtocolLite> = []
): ProtocolsResponse => ({ protocols, parentProtocols, chains: [], protocolCategories: [] })

const metricRow = (
	defillamaId: string,
	totals: AdapterMetricPeriods & { monthlyAverage1y?: number | null }
): AdapterChainProtocol => ({
	defillamaId,
	name: defillamaId,
	displayName: defillamaId,
	module: null,
	category: null,
	logo: '',
	chains: [],
	protocolType: '',
	methodologyURL: null,
	methodology: null,
	slug: defillamaId,
	id: defillamaId,
	breakdown24h: null,
	breakdown30d: null,
	total24h: totals.total24h ?? null,
	total7d: totals.total7d ?? null,
	total30d: totals.total30d ?? null,
	total1y: totals.total1y ?? null,
	annualized1y: totals.annualized1y ?? null,
	monthlyAverage1y: totals.monthlyAverage1y ?? null,
	totalAllTime: totals.totalAllTime ?? null,
	change_7dover7d: totals.change_7dover7d ?? null
})

const metrics = (protocols: Array<AdapterChainProtocol>): IAdapterChainMetrics => ({ allChains: [], protocols })

const emissionsEntry = (name: string, values: Partial<ProtocolEmissionsLookupEntry>): ProtocolEmissionsLookupEntry => ({
	emissions24h: null,
	emissions7d: null,
	emissions30d: null,
	emissions1y: null,
	emissionsMonthlyAverage1y: null,
	emissionsAllTime: null,
	name,
	...values
})

const price = (value: number): PriceObject => ({ price: value, confidence: 1, symbol: 'TKN', timestamp: 0 })

const zeroTotals = { total24h: 0, total7d: 0, total30d: 0, total1y: 0, monthlyAverage1y: 0, totalAllTime: 0 }

function rankingInput(protocols: ProtocolsResponse, sources: Partial<ProtocolRankingInput> = {}): ProtocolRankingInput {
	return {
		chainName: 'All',
		normalizedFork: null,
		protocolMetadata,
		protocols,
		fees: null,
		revenue: null,
		holdersRevenue: null,
		emissions: null,
		activity: {},
		...sources
	}
}

// Same composition as getProtocolsByChain: select, fetch prices for the selection, build.
function rank(input: ProtocolRankingInput, prices: Record<string, PriceObject> = {}) {
	return buildProtocolRankings(input, selectRankingProtocols(input), prices)
}

function findRow<T extends { name: string }>(rows: Array<T> | undefined, name: string): T {
	const row = rows?.find((candidate) => candidate.name === name)
	if (!row) throw new Error(`Missing row ${name}`)
	return row
}

const alphaChildren = (
	one: Partial<ProtocolLite>,
	two: Partial<ProtocolLite>,
	parent: Partial<ParentProtocolLite> = {}
) =>
	protocolsResponse(
		[
			liteProtocol({ defillamaId: 'child-alpha-one', parentProtocol: 'parent#alpha', ...one }),
			liteProtocol({ defillamaId: 'child-alpha-two', parentProtocol: 'parent#alpha', ...two })
		],
		[parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', ...parent })]
	)

describe('protocol ranking parent groups', () => {
	const grouped = protocolsResponse(
		[
			liteProtocol({
				defillamaId: 'child-alpha-one',
				category: 'Dexes',
				chains: ['Ethereum', 'Arbitrum'],
				parentProtocol: 'parent#alpha',
				mcap: 1000,
				tvl: 100,
				tvlPrevDay: 90,
				tvlPrevWeek: null,
				tvlPrevMonth: 50,
				chainTvls: {
					Ethereum: tvlEntry(100, 90, null, 50),
					staking: tvlEntry(10, 9, 8, 7),
					doublecounted: tvlEntry(1, 1, 1, 1),
					excludeParent: tvlEntry(30, 5, 4, 3)
				}
			}),
			liteProtocol({
				defillamaId: 'child-alpha-two',
				category: 'Lending',
				chains: ['Optimism', 'Ethereum'],
				parentProtocol: 'parent#alpha',
				mcap: 500,
				tvl: 200,
				tvlPrevDay: null,
				tvlPrevWeek: 180,
				tvlPrevMonth: 100,
				chainTvls: { Ethereum: tvlEntry(200, null, 180, 100), staking: tvlEntry(20, 19, null, 17) }
			}),
			liteProtocol({
				defillamaId: 'solo-protocol',
				tvl: 50,
				tvlPrevDay: 40,
				tvlPrevWeek: 30,
				tvlPrevMonth: 20
			})
		],
		[
			parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', mcap: 540 }),
			parentProtocol({ id: 'parent#empty', name: 'Empty Parent', mcap: 100 })
		]
	)

	test('groups a parent with several eligible children and sums TVL with its extras minus excludeParent', () => {
		const rows = rank(rankingInput(grouped))

		expect(rows.map((row) => row.name)).toEqual(['Alpha Parent', 'Solo Protocol'])
		const parent = findRow(rows, 'Alpha Parent')
		expect(parent.chains.toSorted()).toEqual(['Arbitrum', 'Ethereum', 'Optimism'])
		expect(parent.category).toBeNull()
		expect(parent.strikeTvl).toBe(true)
		expect(parent.tvl).toEqual({
			default: tvlEntry(270, null, null, 147),
			staking: tvlEntry(30, 28, null, 24),
			doublecounted: tvlEntry(1, 1, 1, 1),
			excludeParent: tvlEntry(30, 5, 4, 3)
		})
		expect(parent.tvlChange?.change1d).toBeNull()
		expect(parent.tvlChange?.change7d).toBeNull()
		expect(parent.tvlChange?.change1m).toBeCloseTo(83.67, 2)
		expect(parent.childProtocols?.map((child) => child.name)).toEqual(['Alpha One', 'Alpha Two'])
	})

	test('applies enabled extra TVL and min TVL settings to the parent total', () => {
		const rows = applyProtocolTvlSettings({
			protocols: rank(rankingInput(grouped)),
			extraTvlsEnabled: { staking: true },
			minTvl: 280,
			maxTvl: null
		})

		expect(rows.map((row) => [row.name, row.tvl?.default.tvl])).toEqual([['Alpha Parent', 300]])
	})

	test('sums child fees, revenue, holders revenue and DEX volume, with P/F and P/S from each market cap', () => {
		const rows = rank(
			rankingInput(grouped, {
				fees: metrics([
					metricRow('child-alpha-one', {
						total24h: 20,
						total7d: 140,
						total30d: 600,
						annualized1y: 3000,
						totalAllTime: 6000
					}),
					metricRow('child-alpha-two', {
						total24h: 8,
						total7d: 56,
						total30d: 240,
						annualized1y: 2400,
						totalAllTime: 2400
					})
				]),
				revenue: metrics([
					metricRow('child-alpha-one', {
						total24h: 10,
						total7d: 70,
						total30d: 300,
						annualized1y: 2700,
						totalAllTime: 3000
					}),
					metricRow('child-alpha-two', { total24h: 5, total7d: 35, total30d: 150, totalAllTime: 1500 })
				]),
				holdersRevenue: metrics([metricRow('child-alpha-one', { total24h: 4, total7d: 28, total30d: 120 })]),
				activity: {
					dexs: metrics([
						metricRow('child-alpha-one', { total24h: 100, total7d: 700, totalAllTime: 10_000 }),
						metricRow('child-alpha-two', { total24h: 50, total7d: 350, totalAllTime: 5000 })
					])
				}
			})
		)

		const parent = findRow(rows, 'Alpha Parent')
		expect(parent.fees).toEqual({
			total24h: 28,
			total7d: 196,
			total30d: 840,
			total1y: 0,
			annualized1y: 5400,
			monthlyAverage1y: 0,
			totalAllTime: 8400,
			pf: 0.1
		})
		expect(parent.revenue).toEqual({
			total24h: 15,
			total7d: 105,
			total30d: 450,
			total1y: 0,
			annualized1y: null,
			monthlyAverage1y: 0,
			totalAllTime: 4500,
			ps: null
		})
		expect(parent.holdersRevenue).toEqual({
			total24h: 4,
			total7d: 28,
			total30d: 120,
			total1y: 0,
			monthlyAverage1y: 0,
			totalAllTime: 0
		})
		expect(parent.dexs).toEqual({
			total24h: 150,
			total7d: 1050,
			total30d: 0,
			totalAllTime: 15_000,
			change_7dover7d: null
		})

		const alphaOne = findRow(parent.childProtocols, 'Alpha One')
		const alphaTwo = findRow(parent.childProtocols, 'Alpha Two')
		expect(alphaOne.fees?.pf).toBeCloseTo(1 / 3)
		expect(alphaTwo.fees?.pf).toBeCloseTo(5 / 24)
		expect(alphaOne.revenue?.ps).toBeCloseTo(10 / 27)
		expect(alphaTwo.revenue?.ps).toBeNull()
		// A loaded holders-revenue source reports zero for a child it does not list.
		expect(alphaTwo.holdersRevenue).toEqual(zeroTotals)
		// Solo is absent from the DEX listing but still shows zero volume.
		expect(findRow(rows, 'Solo Protocol').dexs).toEqual({
			total24h: 0,
			total7d: 0,
			total30d: 0,
			totalAllTime: 0,
			change_7dover7d: null
		})
	})

	test('falls back to parent-name emissions and shows zero emissions for unmatched rows', () => {
		const rows = rank(
			rankingInput(grouped, {
				emissions: {
					'Alpha Parent': emissionsEntry('Alpha Parent', {
						emissions24h: 3,
						emissions7d: 21,
						emissions30d: 90,
						emissions1y: 1080,
						emissionsMonthlyAverage1y: 90,
						emissionsAllTime: 1200
					})
				}
			})
		)

		expect(findRow(rows, 'Alpha Parent').emissions).toEqual({
			total24h: 3,
			total7d: 21,
			total30d: 90,
			total1y: 1080,
			monthlyAverage1y: 90,
			totalAllTime: 1200
		})
		expect(findRow(rows, 'Solo Protocol').emissions).toEqual(zeroTotals)
	})

	test('matches a protocol to emissions listed under its display name', () => {
		const rows = rank(
			rankingInput(protocolsResponse([liteProtocol({ defillamaId: 'solo-protocol', tvl: 10 })]), {
				emissions: { 'Solo Protocol': emissionsEntry('Solo Protocol', { emissions24h: 2, emissions7d: 14 }) }
			})
		)

		expect(rows[0]?.emissions).toEqual({
			total24h: 2,
			total7d: 14,
			total30d: null,
			total1y: null,
			monthlyAverage1y: null,
			totalAllTime: null
		})
	})

	test('leaves emissions off every row when the emissions source is unavailable', () => {
		const rows = rank(rankingInput(grouped, { emissions: null }))

		expect(rows.map((row) => row.name)).toEqual(['Alpha Parent', 'Solo Protocol'])
		const withEmissions = rows
			.flatMap((row) => [row, ...(row.childProtocols ?? [])])
			.filter((row) => row.emissions !== undefined)
			.map((row) => row.name)
		expect(withEmissions).toEqual([])
	})

	test('keeps a parent emissions period unavailable when a matched child period is null', () => {
		const rows = rank(
			rankingInput(
				alphaChildren(
					{ tvl: 100, chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) } },
					{ tvl: 200, chainTvls: { Ethereum: tvlEntry(200, 190, 180, 170) } }
				),
				{
					revenue: metrics([
						metricRow('child-alpha-one', { total24h: 10, total7d: 70 }),
						metricRow('child-alpha-two', { total24h: 5, total7d: 35 })
					]),
					emissions: {
						'child-alpha-one': emissionsEntry('Alpha One', {
							emissions24h: 3,
							emissions7d: 21,
							emissions30d: 90,
							emissions1y: 1080,
							emissionsMonthlyAverage1y: 90,
							emissionsAllTime: 1200
						}),
						'child-alpha-two': emissionsEntry('Alpha Two', {
							emissions7d: 7,
							emissions30d: 30,
							emissions1y: 360,
							emissionsAllTime: 400
						})
					}
				}
			)
		)
		const parent = findRow(rows, 'Alpha Parent')

		expect(parent.emissions).toEqual({
			total24h: null,
			total7d: 28,
			total30d: 120,
			total1y: 1440,
			monthlyAverage1y: null,
			totalAllTime: 1600
		})
		expect(getProtocolEarningsValue(parent.revenue?.total24h, parent.emissions?.total24h)).toBeNull()
		expect(getProtocolEarningsValue(parent.revenue?.total7d, parent.emissions?.total7d)).toBe(77)
	})

	test('computes parent volume change from child 7d volumes instead of summing percentages', () => {
		const rows = rank(
			rankingInput(alphaChildren({ tvl: 100 }, { tvl: 200 }), {
				activity: {
					dexs: metrics([
						metricRow('child-alpha-one', { total7d: 110, change_7dover7d: 10, totalAllTime: 1000 }),
						metricRow('child-alpha-two', { total7d: 120, change_7dover7d: 20, totalAllTime: 2000 })
					])
				}
			})
		)

		expect(findRow(rows, 'Alpha Parent').dexs).toEqual({
			total24h: 0,
			total7d: 230,
			total30d: 0,
			totalAllTime: 3000,
			change_7dover7d: 15
		})
	})

	test('keeps zero-TVL children, deprecated or not, in parent TVL history', () => {
		for (const deprecated of [undefined, true] as const) {
			const rows = rank(
				rankingInput(
					alphaChildren(
						{ tvl: 100, tvlPrevDay: 100, tvlPrevWeek: 100, tvlPrevMonth: 100 },
						{ tvl: 0, tvlPrevDay: 100, tvlPrevWeek: 100, tvlPrevMonth: 100, deprecated }
					)
				)
			)
			const parent = findRow(rows, 'Alpha Parent')

			expect(parent.tvl?.default).toEqual(tvlEntry(100, 200, 200, 200))
			expect(parent.tvlChange).toEqual({ change1d: -50, change7d: -50, change1m: -50 })
			expect(findRow(parent.childProtocols, 'Alpha Two').tvlChange).toEqual({
				change1d: -100,
				change7d: -100,
				change1m: -100
			})
		}
	})

	test('keeps a deprecated child without TVL visible without erasing measured parent TVL', () => {
		const rows = rank(
			rankingInput(
				alphaChildren(
					{ tvl: 100, tvlPrevDay: 90, tvlPrevWeek: 80, tvlPrevMonth: 70 },
					{ deprecated: true, tvl: null, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null }
				)
			)
		)
		const parent = findRow(rows, 'Alpha Parent')

		expect(parent.tvl?.default).toEqual(tvlEntry(100, 90, 80, 70))
		expect(parent.tvlChange?.change1d).toBeCloseTo(11.11)
		expect(parent.tvlChange?.change7d).toBe(25)
		expect(parent.tvlChange?.change1m).toBeCloseTo(42.86)
		const alphaTwo = findRow(parent.childProtocols, 'Alpha Two')
		expect(alphaTwo.deprecated).toBe(true)
		expect(alphaTwo.tvl).toBeNull()
	})

	test('excludes Bridge TVL from a mixed parent and shows no TVL on the Bridge child', () => {
		const rows = rank(
			rankingInput(
				protocolsResponse(
					[
						liteProtocol({
							defillamaId: 'mixed-base',
							parentProtocol: 'parent#mixed',
							tvl: 100,
							tvlPrevDay: 90,
							tvlPrevWeek: 80,
							tvlPrevMonth: 70
						}),
						liteProtocol({
							defillamaId: 'mixed-zero',
							parentProtocol: 'parent#mixed',
							tvl: 0,
							tvlPrevDay: 100,
							tvlPrevWeek: 100,
							tvlPrevMonth: 100
						}),
						liteProtocol({
							defillamaId: 'mixed-bridge',
							category: 'Bridge',
							parentProtocol: 'parent#mixed',
							tvl: 1000,
							tvlPrevDay: 900,
							tvlPrevWeek: 800,
							tvlPrevMonth: 700
						})
					],
					[parentProtocol({ id: 'parent#mixed', name: 'Mixed Parent', mcap: 300 })]
				)
			)
		)
		const parent = findRow(rows, 'Mixed Parent')

		expect(parent.tvl?.default).toEqual(tvlEntry(100, 190, 180, 170))
		expect(findRow(parent.childProtocols, 'Mixed Zero').tvl?.default.tvl).toBe(0)
		expect(findRow(parent.childProtocols, 'Mixed Bridge').tvl).toBeNull()
	})

	test('keeps parent extra TVL history unknown when a zero-current entry has unknown comparisons', () => {
		const rows = rank(
			rankingInput(
				alphaChildren(
					{
						tvl: 100,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						chainTvls: { borrowed: tvlEntry(50, 40, 25, 10) }
					},
					{
						tvl: 200,
						tvlPrevDay: 200,
						tvlPrevWeek: 200,
						tvlPrevMonth: 200,
						chainTvls: { borrowed: tvlEntry(0, null, null, null) }
					}
				)
			)
		)
		const parent = findRow(rows, 'Alpha Parent')
		expect(parent.tvl?.borrowed).toEqual(tvlEntry(50, null, null, null))

		const [withBorrowed] = applyProtocolTvlSettings({
			protocols: [parent],
			extraTvlsEnabled: { borrowed: true },
			minTvl: null,
			maxTvl: null
		})
		expect(withBorrowed?.tvl?.default).toEqual(tvlEntry(350, null, null, null))
		expect(withBorrowed?.tvlChange?.change1d).toBeNull()
	})

	test('keeps parent comparison TVL unknown when excludeParent comparison data is unknown', () => {
		const rows = rank(
			rankingInput(
				alphaChildren(
					{
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: { excludeParent: tvlEntry(10, null, 8, 7) }
					},
					{ tvl: 200, tvlPrevDay: 190, tvlPrevWeek: 180, tvlPrevMonth: 170 }
				)
			)
		)
		const parent = findRow(rows, 'Alpha Parent')

		expect(parent.tvl?.default).toEqual(tvlEntry(290, null, 252, 233))
		expect(parent.tvlChange?.change1d).toBeNull()
	})

	test('keeps parent P/F unavailable when a child has current fees but no annualized fees', () => {
		const rows = rank(
			rankingInput(alphaChildren({ mcap: 200, tvl: 100 }, { mcap: 100, tvl: 200 }, { mcap: 300 }), {
				fees: metrics([
					metricRow('child-alpha-one', { total24h: 20, annualized1y: 3000 }),
					metricRow('child-alpha-two', { total24h: 8, annualized1y: null })
				])
			})
		)

		const parent = findRow(rows, 'Alpha Parent')
		expect([parent.fees?.total24h, parent.fees?.annualized1y, parent.fees?.pf]).toEqual([28, null, null])
	})

	test('keeps children as ordinary rows when their parent is unknown or has no metadata display name', () => {
		const children = (parentId: string) => [
			liteProtocol({ defillamaId: 'child-alpha-one', parentProtocol: parentId, tvl: 100 }),
			liteProtocol({ defillamaId: 'child-alpha-two', parentProtocol: parentId, tvl: 200 })
		]
		const absentParent = rank(rankingInput(protocolsResponse(children('parent#empty'))))
		const parentWithoutMetadata = rank(
			rankingInput(
				protocolsResponse(children('parent#missing-metadata'), [
					parentProtocol({ id: 'parent#missing-metadata', name: 'Missing Metadata Parent' })
				])
			)
		)
		const parentWithoutDisplayName = rank(
			rankingInput(
				protocolsResponse(children('parent#unnamed'), [parentProtocol({ id: 'parent#unnamed', name: 'Unnamed' })]),
				{ protocolMetadata: { ...protocolMetadata, 'parent#unnamed': { chains: ['Ethereum'] } } }
			)
		)

		for (const rows of [absentParent, parentWithoutMetadata, parentWithoutDisplayName]) {
			expect(rows.map((row) => [row.name, row.childProtocols])).toEqual([
				['Alpha Two', undefined],
				['Alpha One', undefined]
			])
		}
	})
})

describe('protocol ranking chain and fork filters', () => {
	test('keeps a single remaining child ungrouped when the chain filter drops its sibling', () => {
		const rows = rank(
			rankingInput(
				alphaChildren(
					{ chains: ['Ethereum'], tvl: 100, chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) } },
					{ chains: ['Optimism'], tvl: 200, chainTvls: { Optimism: tvlEntry(200, 190, 180, 170) } }
				),
				{
					chainName: 'Ethereum',
					protocolMetadata: {
						...protocolMetadata,
						'child-alpha-two': { displayName: 'Alpha Two', chains: ['Optimism'] }
					}
				}
			)
		)

		expect(rows.map((row) => [row.name, row.childProtocols, row.tvl?.default])).toEqual([
			['Alpha One', undefined, tvlEntry(100, 90, 80, 70)]
		])
	})

	test('reads selected-chain TVL from full hyphenated chain prefixes and keeps only known sections', () => {
		const rows = rank(
			rankingInput(
				protocolsResponse([
					liteProtocol({
						defillamaId: 'solo-protocol',
						chains: ['OP Mainnet'],
						tvl: 100,
						chainTvls: {
							'OP Mainnet': tvlEntry(100, 90, 80, 70),
							'OP Mainnet-staking': tvlEntry(20, 18, 16, 14),
							'OP Mainnet-liquid-staking': tvlEntry(500, 500, 500, 500)
						}
					})
				]),
				{ chainName: 'OP Mainnet' }
			)
		)

		expect(rows[0]?.tvl).toEqual({ default: tvlEntry(100, 90, 80, 70), staking: tvlEntry(20, 18, 16, 14) })
	})

	test('keeps a parent chain TVL known when a sibling only reports extra TVL on that chain', () => {
		const rows = rank(
			rankingInput(
				protocolsResponse(
					[
						liteProtocol({
							defillamaId: 'mixed-base',
							chains: ['OP Mainnet'],
							parentProtocol: 'parent#mixed',
							tvl: 100,
							chainTvls: { 'OP Mainnet': tvlEntry(100, 90, 80, 70) }
						}),
						liteProtocol({
							defillamaId: 'mixed-zero',
							chains: ['OP Mainnet'],
							parentProtocol: 'parent#mixed',
							tvl: 1000,
							chainTvls: { 'OP Mainnet-staking': tvlEntry(500, 400, null, null) }
						})
					],
					[parentProtocol({ id: 'parent#mixed', name: 'Mixed Parent' })]
				),
				{ chainName: 'OP Mainnet' }
			)
		)
		const parent = findRow(rows, 'Mixed Parent')

		expect(parent.tvl).toEqual({ default: tvlEntry(100, 90, 80, 70), staking: tvlEntry(500, 400, null, null) })
		expect(parent.tvlChange?.change1d).toBeCloseTo(11.11, 1)
	})

	test('shows unknown selected-chain TVL when the chain section is missing or null, and keeps explicit zero', () => {
		const selectedChainTvl = (chainTvls: ProtocolLite['chainTvls'], tvl: number | null = 100) =>
			rank(
				rankingInput(
					protocolsResponse([liteProtocol({ defillamaId: 'solo-protocol', chains: ['OP Mainnet'], tvl, chainTvls })]),
					{ chainName: 'OP Mainnet' }
				)
			)[0]?.tvl?.default

		expect(selectedChainTvl({ 'OP Mainnet-staking': tvlEntry(20, 18, 16, 14) })).toEqual(
			tvlEntry(null, null, null, null)
		)
		expect(selectedChainTvl({ 'OP Mainnet': tvlEntry(null, null, null, null) })).toEqual(
			tvlEntry(null, null, null, null)
		)
		expect(selectedChainTvl({ 'OP Mainnet': tvlEntry(0, 0, 0, 0) })).toEqual(tvlEntry(0, 0, 0, 0))
		// All-chain TVL being unknown does not hide the selected chain's TVL.
		expect(selectedChainTvl({ 'OP Mainnet': tvlEntry(40, 30, 20, 10) }, null)).toEqual(tvlEntry(40, 30, 20, 10))
	})

	test('groups only fork members and shows zero default TVL for a member with only extra TVL', () => {
		const forkProtocols = protocolsResponse(
			[
				liteProtocol({
					defillamaId: 'child-alpha-one',
					parentProtocol: 'parent#alpha',
					forkedFrom: ['Aave V3'],
					tvl: 10,
					tvlPrevDay: 9,
					tvlPrevWeek: 8,
					tvlPrevMonth: 7,
					chainTvls: { staking: tvlEntry(1, 1, 1, 1), excludeParent: tvlEntry(4, 3, 2, 1) }
				}),
				liteProtocol({
					defillamaId: 'child-alpha-two',
					parentProtocol: 'parent#alpha',
					forkedFrom: ['Aave V3'],
					tvl: null,
					tvlPrevDay: null,
					tvlPrevWeek: null,
					tvlPrevMonth: null,
					chainTvls: { staking: tvlEntry(5, 4, 3, 2) }
				}),
				liteProtocol({
					defillamaId: 'solo-protocol',
					parentProtocol: 'parent#alpha',
					forkedFrom: ['Curve'],
					tvl: 100
				})
			],
			[parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent' })]
		)

		const rows = rank(rankingInput(forkProtocols, { normalizedFork: 'aave-v3' }))
		expect(rows.map((row) => row.name)).toEqual(['Alpha Parent'])
		expect(rows[0]?.tvl).toEqual({
			default: tvlEntry(10, 9, 8, 7),
			staking: tvlEntry(6, 5, 4, 3),
			excludeParent: tvlEntry(4, 3, 2, 1)
		})
		expect(
			rows[0]?.childProtocols?.map((child) => [child.name, child.tvl?.default.tvl, child.tvl?.staking?.tvl])
		).toEqual([
			['Alpha One', 10, 1],
			['Alpha Two', 0, 5]
		])

		// With no member reporting default TVL, the parent shows zero and drops excludeParent.
		const extraOnly = protocolsResponse(
			forkProtocols.protocols.map((protocol) => ({
				...protocol,
				tvl: protocol.defillamaId === 'solo-protocol' ? protocol.tvl : null,
				tvlPrevDay: null,
				tvlPrevWeek: null,
				tvlPrevMonth: null
			})),
			forkProtocols.parentProtocols
		)
		expect(rank(rankingInput(extraOnly, { normalizedFork: 'aave-v3' }))[0]?.tvl).toEqual({
			default: tvlEntry(0, null, null, null),
			staking: tvlEntry(6, 5, 4, 3)
		})
	})
})

describe('protocol ranking row values', () => {
	test('leaves chain entries out of the protocol rows', () => {
		const rows = rank(
			rankingInput(
				protocolsResponse([
					liteProtocol({ defillamaId: 'chain#ethereum', tvl: 1000 }),
					liteProtocol({ defillamaId: 'solo-protocol', tvl: 10 })
				]),
				{
					protocolMetadata: { ...protocolMetadata, 'chain#ethereum': { displayName: 'Ethereum', chains: ['Ethereum'] } }
				}
			)
		)

		expect(rows.map((row) => row.name)).toEqual(['Solo Protocol'])
	})

	test('reports market cap to TVL only for a positive TVL', () => {
		const mcapTvl = (tvl: number, mcap: number) =>
			rank(
				rankingInput(
					protocolsResponse([
						liteProtocol({
							defillamaId: 'solo-protocol',
							tvl,
							tvlPrevDay: tvl,
							tvlPrevWeek: tvl,
							tvlPrevMonth: tvl,
							mcap
						})
					])
				)
			)[0]?.mcaptvl

		expect(mcapTvl(100, 0)).toBe(0)
		expect(mcapTvl(200, 100)).toBe(0.5)
		expect(mcapTvl(-1, 100)).toBeNull()
	})

	test('requests prices for eligible protocols and their parents and shows them as token prices', () => {
		const input = rankingInput(alphaChildren({ geckoId: 'alpha-one', tvl: 100 }, { tvl: 200 }, { gecko_id: 'alpha' }))

		expect(selectRankingProtocols(input).priceIds).toEqual(['coingecko:alpha-one', 'coingecko:alpha'])
		const [parent] = rank(input, { 'coingecko:alpha-one': price(2), 'coingecko:alpha': price(5) })
		expect(parent?.tokenPrice).toBe(5)
		expect(parent?.childProtocols?.map((child) => [child.name, child.tokenPrice])).toEqual([
			['Alpha One', 2],
			['Alpha Two', null]
		])
	})

	test('shows each loaded activity metric on the row it lists', () => {
		const rows = rank(
			rankingInput(protocolsResponse([liteProtocol({ defillamaId: 'solo-protocol', tvl: 10 })]), {
				activity: {
					perps: metrics([metricRow('solo-protocol', { total24h: 20 })]),
					openInterest: metrics([metricRow('solo-protocol', { total24h: 50 })])
				}
			})
		)

		expect(rows[0]?.perps).toEqual({
			total24h: 20,
			total7d: null,
			total30d: null,
			totalAllTime: null,
			change_7dover7d: null
		})
		expect(rows[0]?.openInterest?.total24h).toBe(50)
		expect(rows[0]?.optionsPremiumVolume).toBeUndefined()
	})
})
