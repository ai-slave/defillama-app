import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdapterMetricPeriods } from '~/containers/AdapterMetrics/api.types'
import type { ParentProtocolLite, ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'

const {
	fetchCoinPricesMock,
	fetchAdapterChainMetricsMock,
	getAdapterChainOverviewMock,
	getProtocolEmissionsLookupFromAggregatedMock,
	fetchProtocolsMock
} = vi.hoisted(() => ({
	fetchCoinPricesMock: vi.fn(),
	fetchAdapterChainMetricsMock: vi.fn(),
	getAdapterChainOverviewMock: vi.fn(),
	getProtocolEmissionsLookupFromAggregatedMock: vi.fn(),
	fetchProtocolsMock: vi.fn()
}))

vi.mock('~/api/pricing', () => ({
	fetchCoinPrices: fetchCoinPricesMock
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainMetrics: fetchAdapterChainMetricsMock
}))

vi.mock('~/containers/AdapterMetrics/queries', () => ({
	getAdapterChainOverview: getAdapterChainOverviewMock
}))

vi.mock('~/containers/Incentives/queries', () => ({
	getProtocolEmissionsLookupFromAggregated: getProtocolEmissionsLookupFromAggregatedMock
}))

vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: fetchProtocolsMock
}))

import { getProtocolsByChain } from '../queries.server'
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

const chainMetadata = {
	ethereum: { id: 'ethereum', name: 'Ethereum', fees: true, dexs: true },
	'op-mainnet': { id: 'op-mainnet', name: 'OP Mainnet', fees: true, dexs: true }
} satisfies Record<string, IChainMetadata>

const chainFilteredProtocolMetadata = {
	...protocolMetadata,
	'child-alpha-two': { displayName: 'Alpha Two', chains: ['Optimism'] }
} satisfies Record<string, IProtocolMetadata>

const tvlEntry = (
	tvl: number | null,
	tvlPrevDay: number | null,
	tvlPrevWeek: number | null,
	tvlPrevMonth: number | null
) => ({
	tvl,
	tvlPrevDay,
	tvlPrevWeek,
	tvlPrevMonth
})

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
): ParentProtocolLite => ({
	chains: ['Ethereum'],
	gecko_id: null,
	logo: '',
	mcap: null,
	...overrides
})

const protocolsResponse = ({
	protocols,
	parentProtocols = [],
	chains = []
}: {
	protocols: ProtocolLite[]
	parentProtocols?: ParentProtocolLite[]
	chains?: string[]
}): ProtocolsResponse => ({ protocols, parentProtocols, chains, protocolCategories: ['Dexes', 'Lending'] })

const metricRow = (defillamaId: string, totals: AdapterMetricPeriods & { monthlyAverage1y?: number | null }) => ({
	defillamaId,
	total24h: totals.total24h ?? null,
	total7d: totals.total7d ?? null,
	total30d: totals.total30d ?? null,
	total1y: totals.total1y ?? null,
	annualized1y: totals.annualized1y ?? null,
	monthlyAverage1y: totals.monthlyAverage1y ?? null,
	totalAllTime: totals.totalAllTime ?? null,
	change_7dover7d: totals.change_7dover7d ?? null
})

describe('getProtocolsByChain parent aggregation', () => {
	beforeEach(() => {
		fetchCoinPricesMock.mockReset()
		fetchAdapterChainMetricsMock.mockReset()
		getAdapterChainOverviewMock.mockReset()
		getProtocolEmissionsLookupFromAggregatedMock.mockReset()
		fetchProtocolsMock.mockReset()

		fetchCoinPricesMock.mockResolvedValue({})
		getProtocolEmissionsLookupFromAggregatedMock.mockResolvedValue({})
		getAdapterChainOverviewMock.mockResolvedValue({
			protocols: [
				metricRow('child-alpha-one', { total24h: 100, total7d: 700, totalAllTime: 10_000 }),
				metricRow('child-alpha-two', { total24h: 50, total7d: 350, totalAllTime: 5_000 })
			]
		})
		fetchAdapterChainMetricsMock.mockImplementation(({ dataType }: { dataType?: string }) => {
			if (dataType === 'dailyRevenue') {
				return Promise.resolve({
					protocols: [
						metricRow('child-alpha-one', {
							total24h: 10,
							total7d: 70,
							total30d: 300,
							annualized1y: 2700,
							totalAllTime: 3000
						}),
						metricRow('child-alpha-two', {
							total24h: 5,
							total7d: 35,
							total30d: 150,
							annualized1y: null,
							totalAllTime: 1500
						})
					]
				})
			}

			if (dataType === 'dailyHoldersRevenue') {
				return Promise.resolve({
					protocols: [metricRow('child-alpha-one', { total24h: 4, total7d: 28, total30d: 120 })]
				})
			}

			return Promise.resolve({
				protocols: [
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
				]
			})
		})
	})

	it('groups multiple eligible children under the parent and preserves current TVL, extras, and null prev values', async () => {
		getProtocolEmissionsLookupFromAggregatedMock.mockResolvedValue({
			'Alpha Parent': {
				emissions24h: 3,
				emissions7d: 21,
				emissions30d: 90,
				emissions1y: 1080,
				emissionsMonthlyAverage1y: 90,
				emissionsAllTime: 1200,
				name: 'Alpha Parent'
			}
		})
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum', 'Optimism'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum', 'Optimism'], mcap: 540 }),
					parentProtocol({ id: 'parent#empty', name: 'Empty Parent', chains: ['Ethereum'], mcap: 100 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
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
						name: 'Alpha Two Raw',
						category: 'Lending',
						chains: ['Optimism', 'Ethereum'],
						parentProtocol: 'parent#alpha',
						mcap: 500,
						tvl: 200,
						tvlPrevDay: null,
						tvlPrevWeek: 180,
						tvlPrevMonth: 100,
						chainTvls: {
							Ethereum: tvlEntry(200, null, 180, 100),
							staking: tvlEntry(20, 19, null, 17)
						}
					}),
					liteProtocol({
						defillamaId: 'solo-protocol',
						name: 'Solo Raw',
						category: 'Dexes',
						chains: ['Ethereum'],
						tvl: 50,
						tvlPrevDay: 40,
						tvlPrevWeek: 30,
						tvlPrevMonth: 20,
						chainTvls: {
							Ethereum: tvlEntry(50, 40, 30, 20)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})

		const protocolNames = data?.protocols.map((protocol) => protocol.name) ?? []
		expect(protocolNames).toEqual(expect.arrayContaining(['Alpha Parent', 'Solo Protocol']))
		expect(protocolNames).not.toContain('Empty Parent')

		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')
		expect(parent?.chains).toEqual(expect.arrayContaining(['Ethereum', 'Arbitrum', 'Optimism']))
		expect(parent?.chains).toHaveLength(3)
		expect(parent).toMatchObject({
			name: 'Alpha Parent',
			category: null,
			strikeTvl: true,
			tvl: {
				default: { tvl: 270, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: 147 },
				staking: { tvl: 30, tvlPrevDay: 28, tvlPrevWeek: null, tvlPrevMonth: 24 },
				doublecounted: { tvl: 1, tvlPrevDay: 1, tvlPrevWeek: 1, tvlPrevMonth: 1 },
				excludeParent: { tvl: 30, tvlPrevDay: 5, tvlPrevWeek: 4, tvlPrevMonth: 3 }
			},
			tvlChange: { change1d: null, change7d: null, change1m: expect.any(Number) },
			fees: { total24h: 28, total7d: 196, total30d: 840, annualized1y: 5400, totalAllTime: 8400, pf: 0.1 },
			revenue: { total24h: 15, total7d: 105, total30d: 450, annualized1y: null, totalAllTime: 4500, ps: null },
			holdersRevenue: { total24h: 4, total7d: 28, total30d: 120 },
			dexs: { total24h: 150, total7d: 1050, change_7dover7d: null, totalAllTime: 15_000 }
		})
		expect(parent?.emissions).toEqual({
			total24h: 3,
			total7d: 21,
			total30d: 90,
			total1y: 1080,
			monthlyAverage1y: 90,
			totalAllTime: 1200
		})
		expect(data?.protocols.find((protocol) => protocol.name === 'Solo Protocol')?.emissions).toEqual({
			total24h: 0,
			total7d: 0,
			total30d: 0,
			total1y: 0,
			monthlyAverage1y: 0,
			totalAllTime: 0
		})
		expect(data?.emissionsData).not.toBeNull()
		const childProtocolsByName = new Map(parent?.childProtocols?.map((protocol) => [protocol.name, protocol]))
		expect(Array.from(childProtocolsByName.keys())).toEqual(expect.arrayContaining(['Alpha One', 'Alpha Two']))
		expect(childProtocolsByName.get('Alpha One')?.fees?.pf).toBeCloseTo(1 / 3)
		expect(childProtocolsByName.get('Alpha Two')?.fees?.pf).toBeCloseTo(5 / 24)
		expect(childProtocolsByName.get('Alpha One')?.revenue?.ps).toBeCloseTo(10 / 27)
		expect(childProtocolsByName.get('Alpha Two')?.revenue?.ps).toBeNull()
		expect(childProtocolsByName.get('Alpha Two')?.holdersRevenue).toEqual({
			total24h: 0,
			total7d: 0,
			total30d: 0,
			total1y: 0,
			monthlyAverage1y: 0,
			totalAllTime: 0
		})

		const withStakingAndMin = applyProtocolTvlSettings({
			protocols: data?.protocols ?? [],
			extraTvlsEnabled: { staking: true },
			minTvl: 280,
			maxTvl: null
		})
		expect(withStakingAndMin.map((protocol) => protocol.name)).toEqual(['Alpha Parent'])
		expect(withStakingAndMin.at(0)?.tvl?.default.tvl).toBe(300)

		getProtocolEmissionsLookupFromAggregatedMock.mockResolvedValue(null)
		const withoutEmissionsSource = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})
		expect(withoutEmissionsSource?.emissionsData).toBeNull()
		expect(withoutEmissionsSource?.protocols.every((protocol) => protocol.emissions === undefined)).toBe(true)
		expect(
			withoutEmissionsSource?.protocols.every(
				(protocol) => protocol.childProtocols?.every((child) => child.emissions === undefined) ?? true
			)
		).toBe(true)
	})

	it('keeps a parent emissions period unavailable when a matched child period is null', async () => {
		getProtocolEmissionsLookupFromAggregatedMock.mockResolvedValue({
			'child-alpha-one': {
				emissions24h: 3,
				emissions7d: 21,
				emissions30d: 90,
				emissions1y: 1080,
				emissionsMonthlyAverage1y: 90,
				emissionsAllTime: 1200,
				name: 'Alpha One'
			},
			'child-alpha-two': {
				emissions24h: null,
				emissions7d: 7,
				emissions30d: 30,
				emissions1y: 360,
				emissionsMonthlyAverage1y: null,
				emissionsAllTime: 400,
				name: 'Alpha Two'
			}
		})
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				parentProtocols: [parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', mcap: 540 })],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						parentProtocol: 'parent#alpha',
						tvl: 100,
						chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) }
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						parentProtocol: 'parent#alpha',
						tvl: 200,
						chainTvls: { Ethereum: tvlEntry(200, 190, 180, 170) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')

		expect(parent?.emissions).toEqual({
			total24h: null,
			total7d: 28,
			total30d: 120,
			total1y: 1440,
			monthlyAverage1y: null,
			totalAllTime: 1600
		})
		expect(getProtocolEarningsValue(parent?.revenue?.total24h, parent?.emissions?.total24h)).toBeNull()
		expect(getProtocolEarningsValue(parent?.revenue?.total7d, parent?.emissions?.total7d)).toBe(77)
	})

	it('computes parent spot volume change from child 7d volume instead of summing percentages', async () => {
		fetchAdapterChainMetricsMock.mockResolvedValue({ protocols: [] })
		getAdapterChainOverviewMock.mockResolvedValue({
			protocols: [
				metricRow('child-alpha-one', {
					total24h: null,
					total7d: 110,
					change_7dover7d: 10,
					totalAllTime: 1000
				}),
				metricRow('child-alpha-two', {
					total24h: null,
					total7d: 120,
					change_7dover7d: 20,
					totalAllTime: 2000
				})
			]
		})
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum'], mcap: 300 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: {
							Ethereum: tvlEntry(100, 90, 80, 70)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 200,
						tvlPrevDay: 190,
						tvlPrevWeek: 180,
						tvlPrevMonth: 170,
						chainTvls: {
							Ethereum: tvlEntry(200, 190, 180, 170)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})

		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')
		expect(parent?.dexs).toMatchObject({
			total24h: 0,
			total7d: 230,
			change_7dover7d: 15,
			totalAllTime: 3000
		})
	})

	it('keeps explicit deprecated zero-TVL history in exact parent comparisons', async () => {
		fetchAdapterChainMetricsMock.mockResolvedValue({ protocols: [] })
		getAdapterChainOverviewMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum'], mcap: 300 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						chainTvls: {
							Ethereum: tvlEntry(100, 100, 100, 100)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 0,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						deprecated: true,
						chainTvls: {
							Ethereum: tvlEntry(0, 100, 100, 100)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})

		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')
		expect(parent?.tvl).toMatchObject({
			default: { tvl: 100, tvlPrevDay: 200, tvlPrevWeek: 200, tvlPrevMonth: 200 }
		})
		expect(parent?.tvlChange).toEqual({ change1d: -50, change7d: -50, change1m: -50 })
		expect(parent?.childProtocols?.find((protocol) => protocol.name === 'Alpha Two')?.tvlChange).toEqual({
			change1d: -100,
			change7d: -100,
			change1m: -100
		})
	})

	it('keeps non-deprecated zero-TVL children in parent TVL change calculations', async () => {
		fetchAdapterChainMetricsMock.mockResolvedValue({ protocols: [] })
		getAdapterChainOverviewMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum'], mcap: 300 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						chainTvls: {
							Ethereum: tvlEntry(100, 100, 100, 100)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 0,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						chainTvls: {
							Ethereum: tvlEntry(0, 100, 100, 100)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})

		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')
		expect(parent?.tvl).toMatchObject({
			default: { tvl: 100, tvlPrevDay: 200, tvlPrevWeek: 200, tvlPrevMonth: 200 }
		})
		expect(parent?.tvlChange).toEqual({ change1d: -50, change7d: -50, change1m: -50 })
		expect(parent?.childProtocols?.find((protocol) => protocol.name === 'Alpha Two')?.tvlChange).toEqual({
			change1d: -100,
			change7d: -100,
			change1m: -100
		})
	})

	it('excludes Bridge display-only TVL from a mixed parent without treating it as unknown', async () => {
		fetchAdapterChainMetricsMock.mockResolvedValue({ protocols: [] })
		getAdapterChainOverviewMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [parentProtocol({ id: 'parent#mixed', name: 'Mixed Parent', mcap: 300 })],
				protocols: [
					liteProtocol({
						defillamaId: 'mixed-base',
						name: 'Mixed Base Raw',
						parentProtocol: 'parent#mixed',
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) }
					}),
					liteProtocol({
						defillamaId: 'mixed-zero',
						name: 'Mixed Zero Raw',
						parentProtocol: 'parent#mixed',
						tvl: 0,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						chainTvls: { Ethereum: tvlEntry(0, 100, 100, 100) }
					}),
					liteProtocol({
						defillamaId: 'mixed-bridge',
						name: 'Mixed Bridge Raw',
						category: 'Bridge',
						parentProtocol: 'parent#mixed',
						tvl: 1_000,
						tvlPrevDay: 900,
						tvlPrevWeek: 800,
						tvlPrevMonth: 700,
						chainTvls: { Ethereum: tvlEntry(1_000, 900, 800, 700) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const parent = data?.protocols.find((protocol) => protocol.name === 'Mixed Parent')

		expect(parent?.tvl?.default).toEqual(tvlEntry(100, 190, 180, 170))
		expect(parent?.childProtocols?.find((protocol) => protocol.name === 'Mixed Zero')?.tvl?.default.tvl).toBe(0)
		expect(parent?.childProtocols?.find((protocol) => protocol.name === 'Mixed Bridge')?.tvl).toBeNull()
	})

	it('keeps a parent chain TVL known when a sibling only reports non-default TVL on that chain', async () => {
		fetchAdapterChainMetricsMock.mockResolvedValue({ protocols: [] })
		getAdapterChainOverviewMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['OP Mainnet'],
				parentProtocols: [parentProtocol({ id: 'parent#mixed', name: 'Mixed Parent' })],
				protocols: [
					liteProtocol({
						defillamaId: 'mixed-base',
						name: 'Mixed Base Raw',
						chains: ['OP Mainnet'],
						parentProtocol: 'parent#mixed',
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: { 'OP Mainnet': tvlEntry(100, 90, 80, 70) }
					}),
					// staking-only on this chain: no plain `OP Mainnet` section to add
					liteProtocol({
						defillamaId: 'mixed-zero',
						name: 'Mixed Staking Only Raw',
						chains: ['OP Mainnet'],
						parentProtocol: 'parent#mixed',
						tvl: 1_000,
						tvlPrevDay: 900,
						tvlPrevWeek: 800,
						tvlPrevMonth: 700,
						chainTvls: { 'OP Mainnet-staking': tvlEntry(500, 400, null, null) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'OP Mainnet', chainMetadata, protocolMetadata })
		const parent = data?.protocols.find((protocol) => protocol.name === 'Mixed Parent')

		expect(parent?.tvl?.default).toEqual(tvlEntry(100, 90, 80, 70))
		expect(parent?.tvl?.staking).toEqual(tvlEntry(500, 400, null, null))
		expect(parent?.tvlChange?.change1d).toBeCloseTo(11.11, 1)
	})

	it('keeps parent extra TVL history unknown when a present zero-current entry has unknown comparisons', async () => {
		fetchAdapterChainMetricsMock.mockResolvedValue({ protocols: [] })
		getAdapterChainOverviewMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum'], mcap: 300 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 100,
						tvlPrevWeek: 100,
						tvlPrevMonth: 100,
						chainTvls: {
							Ethereum: tvlEntry(100, 100, 100, 100),
							borrowed: tvlEntry(50, 40, 25, 10)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 200,
						tvlPrevDay: 200,
						tvlPrevWeek: 200,
						tvlPrevMonth: 200,
						chainTvls: {
							Ethereum: tvlEntry(200, 200, 200, 200),
							borrowed: tvlEntry(0, null, null, null)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})

		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')
		expect(parent?.tvl?.borrowed).toEqual(tvlEntry(50, null, null, null))

		const [withBorrowed] = applyProtocolTvlSettings({
			protocols: parent ? [parent] : [],
			extraTvlsEnabled: { borrowed: true },
			minTvl: null,
			maxTvl: null
		})
		expect(withBorrowed?.tvl?.default).toEqual(tvlEntry(350, null, null, null))
		expect(withBorrowed?.tvlChange?.change1d).toBeNull()
	})

	it('keeps parent P/F null when a child fee row has only current fees and no annualized denominator', async () => {
		fetchAdapterChainMetricsMock.mockImplementation(({ dataType }: { dataType?: string }) => {
			if (dataType === 'dailyRevenue' || dataType === 'dailyHoldersRevenue') {
				return Promise.resolve({ protocols: [] })
			}

			// Rows without total24h do not reach parent aggregation; this pins the reachable strict-null case.
			return Promise.resolve({
				protocols: [
					metricRow('child-alpha-one', {
						total24h: 20,
						annualized1y: 3000
					}),
					metricRow('child-alpha-two', {
						total24h: 8,
						annualized1y: null
					})
				]
			})
		})
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum'], mcap: 300 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						category: 'Dexes',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						mcap: 200,
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: {
							Ethereum: tvlEntry(100, 90, 80, 70)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						category: 'Lending',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						mcap: 100,
						tvl: 200,
						tvlPrevDay: 190,
						tvlPrevWeek: 180,
						tvlPrevMonth: 170,
						chainTvls: {
							Ethereum: tvlEntry(200, 190, 180, 170)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata
		})

		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')
		expect(parent?.fees).toMatchObject({
			total24h: 28,
			annualized1y: null,
			pf: null
		})
	})

	it('keeps a single eligible child ungrouped when the chain filter leaves only one child under a parent', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum', 'Optimism'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum', 'Optimism'], mcap: 540 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						name: 'Alpha One Raw',
						category: 'Dexes',
						chains: ['Ethereum'],
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: {
							Ethereum: tvlEntry(100, 90, 80, 70)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						name: 'Alpha Two Raw',
						category: 'Lending',
						chains: ['Optimism'],
						parentProtocol: 'parent#alpha',
						tvl: 200,
						tvlPrevDay: 190,
						tvlPrevWeek: 180,
						tvlPrevMonth: 170,
						chainTvls: {
							Optimism: tvlEntry(200, 190, 180, 170)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({
			chain: 'Ethereum',
			chainMetadata,
			protocolMetadata: chainFilteredProtocolMetadata
		})

		expect(data?.protocols).toHaveLength(1)
		expect(data?.protocols[0]).toMatchObject({
			name: 'Alpha One',
			tvl: {
				default: { tvl: 100, tvlPrevDay: 90, tvlPrevWeek: 80, tvlPrevMonth: 70 }
			}
		})
		expect(data?.protocols[0]).not.toHaveProperty('childProtocols')
		expect(data?.protocols[0]).not.toHaveProperty('defillamaId')
		expect(data?.emissionsData).toBeNull()
		expect(data?.protocols[0]?.emissions).toBeUndefined()
		expect(getProtocolEarningsValue(data?.protocols[0]?.revenue?.total24h ?? null, null)).toBeNull()
		expect(getProtocolEmissionsLookupFromAggregatedMock).not.toHaveBeenCalled()
	})

	it('parses full hyphenated chain prefixes and only adds recognized protocol-list sections', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['OP Mainnet', 'Ethereum'],
				parentProtocols: [],
				protocols: [
					liteProtocol({
						defillamaId: 'solo-protocol',
						name: 'Solo Raw',
						chains: ['OP Mainnet'],
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: {
							'OP Mainnet': tvlEntry(100, 90, 80, 70),
							'OP Mainnet-staking': tvlEntry(20, 18, 16, 14),
							'OP Mainnet-liquid-staking': tvlEntry(500, 500, 500, 500)
						}
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'OP Mainnet', chainMetadata, protocolMetadata })

		expect(data?.chains).toEqual(['OP Mainnet', 'Ethereum'])
		expect(data?.protocols[0]?.tvl).toEqual({
			default: tvlEntry(100, 90, 80, 70),
			staking: tvlEntry(20, 18, 16, 14)
		})
	})

	it('preserves explicit zero and null while leaving a missing selected-chain base unavailable', async () => {
		const makeResponse = (chainTvls: ProtocolLite['chainTvls']) =>
			protocolsResponse({
				chains: ['OP Mainnet'],
				protocols: [
					liteProtocol({
						defillamaId: 'solo-protocol',
						name: 'Solo Raw',
						chains: ['OP Mainnet'],
						tvl: 100,
						chainTvls
					})
				]
			})

		fetchProtocolsMock.mockResolvedValueOnce(makeResponse({ 'OP Mainnet-staking': tvlEntry(20, 18, 16, 14) }))
		fetchProtocolsMock.mockResolvedValueOnce(makeResponse({ 'OP Mainnet': tvlEntry(null, null, null, null) }))
		fetchProtocolsMock.mockResolvedValueOnce(makeResponse({ 'OP Mainnet': tvlEntry(0, 0, 0, 0) }))

		const missing = await getProtocolsByChain({ chain: 'OP Mainnet', chainMetadata, protocolMetadata })
		const presentNull = await getProtocolsByChain({ chain: 'OP Mainnet', chainMetadata, protocolMetadata })
		const explicitZero = await getProtocolsByChain({ chain: 'OP Mainnet', chainMetadata, protocolMetadata })

		expect(missing?.protocols[0]?.tvl?.default).toEqual(tvlEntry(null, null, null, null))
		expect(presentNull?.protocols[0]?.tvl?.default).toEqual(tvlEntry(null, null, null, null))
		expect(explicitZero?.protocols[0]?.tvl?.default).toEqual(tvlEntry(0, 0, 0, 0))
	})

	it('returns only finite ranking market-cap ratios with a positive TVL denominator', async () => {
		const makeResponse = (tvl: number, mcap: number) =>
			protocolsResponse({
				protocols: [
					liteProtocol({
						defillamaId: 'solo-protocol',
						name: 'Solo Raw',
						tvl,
						tvlPrevDay: tvl,
						tvlPrevWeek: tvl,
						tvlPrevMonth: tvl,
						mcap
					})
				]
			})
		fetchProtocolsMock.mockResolvedValueOnce(makeResponse(100, 0)).mockResolvedValueOnce(makeResponse(-1, 100))

		const zeroMcap = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const negativeTvl = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })

		expect(zeroMcap?.protocols[0]?.mcaptvl).toBe(0)
		expect(negativeTvl?.protocols[0]?.mcaptvl).toBeNull()
	})

	it('keeps parent comparison TVL unknown when excludeParent comparison data is unknown', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({ id: 'parent#alpha', name: 'Alpha Parent', chains: ['Ethereum'], mcap: 300 })
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: {
							Ethereum: tvlEntry(100, 90, 80, 70),
							excludeParent: tvlEntry(10, null, 8, 7)
						}
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						parentProtocol: 'parent#alpha',
						tvl: 200,
						tvlPrevDay: 190,
						tvlPrevWeek: 180,
						tvlPrevMonth: 170,
						chainTvls: { Ethereum: tvlEntry(200, 190, 180, 170) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')

		expect(parent?.tvl?.default).toEqual(tvlEntry(290, null, 252, 233))
		expect(parent?.tvlChange?.change1d).toBeNull()
	})

	it('keeps children visible when their referenced parent is absent from the canonical parent list', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						parentProtocol: 'parent#empty',
						tvl: 100,
						chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) }
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						parentProtocol: 'parent#empty',
						tvl: 200,
						chainTvls: { Ethereum: tvlEntry(200, 190, 180, 170) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })

		expect(data?.protocols.map((protocol) => protocol.name).sort()).toEqual(['Alpha One', 'Alpha Two'])
		expect(data?.protocols.every((protocol) => protocol.childProtocols === undefined)).toBe(true)
	})

	it('keeps children visible when parent metadata is unavailable', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({
						id: 'parent#missing-metadata',
						name: 'Missing Metadata Parent',
						symbol: '-',
						chains: ['Ethereum'],
						gecko_id: null
					})
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						parentProtocol: 'parent#missing-metadata',
						tvl: 100,
						chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) }
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						parentProtocol: 'parent#missing-metadata',
						tvl: 200,
						chainTvls: { Ethereum: tvlEntry(200, 190, 180, 170) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })

		expect(data?.protocols.map((protocol) => protocol.name).sort()).toEqual(['Alpha One', 'Alpha Two'])
		expect(data?.protocols.every((protocol) => protocol.childProtocols === undefined)).toBe(true)
	})

	it('keeps a no-TVL deprecated child visible without erasing measured parent TVL', async () => {
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				parentProtocols: [
					parentProtocol({
						id: 'parent#alpha',
						name: 'Alpha Parent',
						symbol: '-',
						chains: ['Ethereum'],
						gecko_id: null
					})
				],
				protocols: [
					liteProtocol({
						defillamaId: 'child-alpha-one',
						parentProtocol: 'parent#alpha',
						tvl: 100,
						tvlPrevDay: 90,
						tvlPrevWeek: 80,
						tvlPrevMonth: 70,
						chainTvls: { Ethereum: tvlEntry(100, 90, 80, 70) }
					}),
					liteProtocol({
						defillamaId: 'child-alpha-two',
						parentProtocol: 'parent#alpha',
						deprecated: true,
						tvl: null,
						tvlPrevDay: null,
						tvlPrevWeek: null,
						tvlPrevMonth: null,
						chainTvls: {}
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const parent = data?.protocols.find((protocol) => protocol.name === 'Alpha Parent')

		expect(parent?.tvl?.default).toEqual(tvlEntry(100, 90, 80, 70))
		expect(parent?.tvlChange?.change1d).toBeCloseTo(11.11)
		expect(parent?.tvlChange?.change7d).toBe(25)
		expect(parent?.tvlChange?.change1m).toBeCloseTo(42.86)
		expect(parent?.childProtocols?.find((protocol) => protocol.name === 'Alpha Two')?.deprecated).toBe(true)
	})

	it('keeps independently successful adapter sources when sibling metric requests fail', async () => {
		fetchAdapterChainMetricsMock.mockImplementation(({ dataType }: { dataType?: string }) => {
			if (dataType === 'dailyRevenue') return Promise.reject(new Error('revenue unavailable'))
			if (dataType === 'dailyHoldersRevenue') {
				return Promise.resolve({ protocols: [metricRow('solo-protocol', { total24h: 2 })] })
			}
			return Promise.resolve({ protocols: [metricRow('solo-protocol', { total24h: 5 })] })
		})
		getAdapterChainOverviewMock.mockRejectedValue(new Error('dex unavailable'))
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				chains: ['Ethereum'],
				protocols: [
					liteProtocol({
						defillamaId: 'solo-protocol',
						name: 'Solo Raw',
						tvl: 10,
						chainTvls: { Ethereum: tvlEntry(10, 9, 8, 7) }
					})
				]
			})
		)

		const data = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		const protocol = data?.protocols[0]

		expect(protocol?.fees?.total24h).toBe(5)
		expect(protocol?.holdersRevenue?.total24h).toBe(2)
		expect(protocol?.revenue).toBeUndefined()
		expect(protocol?.dexs).toBeUndefined()
		expect(data?.fees).not.toBeNull()
		expect(data?.dexs).toBeNull()
	})

	it('loads extended activity metrics only when requested', async () => {
		fetchAdapterChainMetricsMock.mockImplementation(
			({ adapterType, dataType }: { adapterType: string; dataType?: string }) => {
				if (adapterType === 'fees') return Promise.resolve({ protocols: [] })
				const valueByRequest: Record<string, number> = {
					derivatives: 20,
					'normalized-volume': 30,
					'normalized-volume:dailyActiveLiquidity': 40,
					'open-interest:openInterestAtEnd': 50,
					'options:dailyPremiumVolume': 60,
					'options:dailyNotionalVolume': 70,
					aggregators: 80,
					'aggregator-derivatives': 90,
					'bridge-aggregators': 100
				}
				const total24h = valueByRequest[`${adapterType}${dataType ? `:${dataType}` : ''}`]
				return Promise.resolve({
					protocols: total24h ? [metricRow('solo-protocol', { total24h })] : []
				})
			}
		)
		getAdapterChainOverviewMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsMock.mockResolvedValue(
			protocolsResponse({
				protocols: [
					liteProtocol({
						defillamaId: 'solo-protocol',
						name: 'Solo Raw',
						tvl: 10,
						chainTvls: { Ethereum: tvlEntry(10, 9, 8, 7) }
					})
				]
			})
		)

		const withoutExtended = await getProtocolsByChain({ chain: 'All', chainMetadata, protocolMetadata })
		expect(withoutExtended?.protocols[0]?.perps).toBeUndefined()

		const withExtended = await getProtocolsByChain({
			chain: 'All',
			chainMetadata,
			protocolMetadata,
			includeExtendedMetrics: true
		})

		expect(withExtended?.protocols[0]).toMatchObject({
			perps: { total24h: 20 },
			normalizedVolume: { total24h: 20 },
			activeLiquidity: { total24h: 40 },
			openInterest: { total24h: 50 },
			optionsPremiumVolume: { total24h: 60 },
			optionsNotionalVolume: { total24h: 70 },
			dexAggregators: { total24h: 80 },
			perpsAggregators: { total24h: 90 },
			bridgeAggregators: { total24h: 100 }
		})
		expect(fetchAdapterChainMetricsMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ adapterType: 'dexs', dataType: 'dailyNotionalVolume' })
		)
	})
})
