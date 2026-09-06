import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TokenDirectory } from '~/utils/tokenDirectory'

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

function setupPageModule({
	cexs = [],
	chainMetadata = {},
	holdersRevenueFails = false,
	holdersRevenueProtocols = [],
	tokensJson = {},
	tokenRightsEntries = [],
	protocolMetadata = {}
}: {
	cexs?: Array<Record<string, unknown>>
	chainMetadata?: Record<string, unknown>
	holdersRevenueFails?: boolean
	holdersRevenueProtocols?: Array<Record<string, unknown>>
	tokensJson?: TokenDirectory
	tokenRightsEntries?: Array<unknown>
	protocolMetadata?: Record<string, unknown>
} = {}) {
	vi.doMock('next/link', () => ({
		default: () => null
	}))
	vi.doMock('~/containers/TokenRights/server/dataset.server', () => ({
		fetchTokenRightsEntries: vi.fn().mockResolvedValue(tokenRightsEntries)
	}))
	vi.doMock('~/containers/AdapterMetrics/api', () => ({
		fetchAdapterChainMetrics: vi
			.fn()
			.mockImplementation(() =>
				holdersRevenueFails
					? Promise.reject(new Error('holders revenue failed'))
					: { protocols: holdersRevenueProtocols }
			)
	}))
	vi.doMock('~/layout', () => ({
		default: () => null
	}))
	vi.doMock('~/utils', () => ({
		formatUsd: (value: number) => `$${value}`,
		slug: (value: string) =>
			value
				.toLowerCase()
				.replaceAll(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
	}))
	vi.doMock('~/utils/telemetry', () => ({
		flushTelemetry: vi.fn().mockResolvedValue(undefined),
		recordDomainEvent: vi.fn()
	}))
	vi.doMock('~/utils/icons', () => ({
		tokenIconUrl: (value: string) => `icon:${value}`
	}))
	vi.doMock('~/utils/maxAgeForNext', () => ({
		maxAgeForNext: () => 123
	}))
	vi.doMock('~/utils/perf', () => ({
		withPerformanceLogging: (_label: string, fn: any) => fn
	}))
	vi.doMock('~/utils/metadata', () => ({
		__esModule: true,
		default: {
			chainMetadata,
			cexs,
			protocolMetadata,
			tokenDirectory: tokensJson
		},
		refreshMetadataIfStale: vi.fn().mockResolvedValue(undefined)
	}))

	return import('~/pages/token-rights')
}

function tokenRightsEntry(overrides: Record<string, unknown>) {
	return {
		'Protocol Name': 'Protocol',
		Token: ['TOKEN'],
		'Governance Decisions': ['N/A'],
		'Treasury Decisions': ['N/A'],
		'Revenue Decisions': ['N/A'],
		'Fee Switch Status': 'OFF',
		Buybacks: ['N/A'],
		Dividends: ['N/A'],
		Burns: 'N/A',
		'Value Accrual': 'N/A',
		'Equity Revenue Capture': 'Unknown',
		'Last Updated': '2026-04-15',
		'DefiLlama ID': '1',
		...overrides
	}
}

function tokenRightsListItem(overrides: Record<string, unknown>) {
	return {
		name: 'Protocol',
		logo: 'icon:Protocol',
		href: '/protocol/protocol',
		tokens: ['TOKEN'],
		holdersRevenue24h: null,
		governanceRights: [false, false, false] as [boolean, boolean, boolean],
		economicRights: [false, false, false] as [boolean, boolean, boolean],
		feeSwitchStatus: 'OFF' as const,
		feeSwitchDetails: null,
		valueAccrual: null,
		valueAccrualDetails: null,
		equityRevenueCapture: null,
		equityRevenueCaptureDetails: null,
		lastUpdated: null,
		hasBuybacks: false,
		hasDividends: false,
		hasBurns: false,
		hasEquityCapture: false,
		hasNoEquityCapture: false,
		...overrides
	}
}

describe('token rights page', () => {
	test('builds table rows with rights, pending fee switch, and holders revenue', async () => {
		const page = await setupPageModule({
			chainMetadata: {
				ethereum: { name: 'Ethereum', id: 'ethereum', gecko_id: 'ethereum' }
			},
			tokensJson: {
				ldo: { name: 'Lido DAO', symbol: 'LDO', token_nk: 'coingecko:lido-dao', route: '/token/LDO' },
				eth: { name: 'Ethereum', symbol: 'ETH', token_nk: 'coingecko:ethereum', route: '/token/ETH' }
			},
			tokenRightsEntries: [
				tokenRightsEntry({
					'Protocol Name': 'Ethereum',
					Token: ['ETH'],
					'DefiLlama ID': 'ethereum',
					'Governance Decisions': ['ETH'],
					'Treasury Decisions': ['N/A'],
					'Revenue Decisions': ['ETH'],
					Buybacks: ['N/A'],
					Dividends: ['N/A'],
					Burns: 'Active',
					'Fee Switch Status': 'PENDING',
					'Value Accrual': 'Deflationary supply reduction',
					'Equity Revenue Capture': 'No',
					'Last Updated': '2026-03-01'
				}),
				tokenRightsEntry({ 'Protocol Name': 'Lido DAO', Token: ['LDO'], 'DefiLlama ID': '182' })
			],
			holdersRevenueProtocols: [{ defillamaId: 'ethereum', total24h: 1200 }],
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao' }
			}
		})

		const result = await page.getStaticProps({} as never)
		expect(result).toMatchObject({
			props: {
				protocols: [
					{
						name: 'Ethereum',
						logo: 'icon:Ethereum',
						href: '/token/ETH',
						tokens: ['ETH'],
						holdersRevenue24h: 1200,
						governanceRights: [true, false, true],
						economicRights: [false, false, true],
						feeSwitchStatus: 'PENDING',
						valueAccrual: 'Deflationary supply reduction',
						equityRevenueCapture: 'No',
						hasNoEquityCapture: true
					},
					{
						name: 'Lido',
						logo: 'icon:Lido',
						href: '/token/LDO',
						tokens: ['LDO'],
						holdersRevenue24h: null,
						feeSwitchStatus: 'OFF'
					}
				]
			},
			revalidate: 123
		})
	}, 30_000)

	test('uses resolved metadata for deprecated rows', async () => {
		const page = await setupPageModule({
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao', deprecated: true }
			},
			tokensJson: {
				ldo: { name: 'Lido DAO', symbol: 'LDO', token_nk: 'coingecko:lido-dao', route: '/token/LDO' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Lido', deprecated: true }]
			}
		})
	})

	test('uses child protocol holders revenue for parent token-rights rows', async () => {
		const page = await setupPageModule({
			tokenRightsEntries: [
				tokenRightsEntry({
					'Protocol Name': 'Uniswap',
					Token: ['UNI'],
					'DefiLlama ID': 'parent#uniswap'
				})
			],
			holdersRevenueProtocols: [
				{ defillamaId: '2198', parentProtocol: 'parent#uniswap', total24h: 700 },
				{ defillamaId: '339', parentProtocol: 'parent#uniswap', total24h: 300 }
			],
			protocolMetadata: {
				'parent#uniswap': { displayName: 'Uniswap', gecko_id: 'uniswap' }
			}
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Uniswap', holdersRevenue24h: 1000 }]
			}
		})
	})

	test('prefers direct holders revenue over summed child protocol revenue', async () => {
		const page = await setupPageModule({
			tokenRightsEntries: [
				tokenRightsEntry({
					'Protocol Name': 'Uniswap',
					Token: ['UNI'],
					'DefiLlama ID': 'parent#uniswap'
				})
			],
			holdersRevenueProtocols: [
				{ defillamaId: 'parent#uniswap', total24h: 900 },
				{ defillamaId: '2198', parentProtocol: 'parent#uniswap', total24h: 700 }
			],
			protocolMetadata: {
				'parent#uniswap': { displayName: 'Uniswap', gecko_id: 'uniswap' }
			}
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Uniswap', holdersRevenue24h: 900 }]
			}
		})
	})

	test('keeps a direct measured zero instead of replacing it with child revenue', async () => {
		const page = await setupPageModule({
			tokenRightsEntries: [
				tokenRightsEntry({
					'Protocol Name': 'Uniswap',
					Token: ['UNI'],
					'DefiLlama ID': 'parent#uniswap'
				})
			],
			holdersRevenueProtocols: [
				{ defillamaId: 'parent#uniswap', total24h: 0 },
				{ defillamaId: '2198', parentProtocol: 'parent#uniswap', total24h: 700 }
			],
			protocolMetadata: {
				'parent#uniswap': { displayName: 'Uniswap', gecko_id: 'uniswap' }
			}
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				holdersRevenueAvailable: true,
				protocols: [{ name: 'Uniswap', holdersRevenue24h: 0 }]
			}
		})
	})

	test('skips entries without metadata and keeps metadata rows without a token route', async () => {
		const page = await setupPageModule({
			chainMetadata: {
				ethereum: { name: 'Ethereum', id: 'ethereum', gecko_id: 'ethereum' }
			},
			protocolMetadata: {
				'382': { displayName: 'Pendle V2' }
			},
			tokenRightsEntries: [
				tokenRightsEntry({ 'Protocol Name': 'Missing ID', 'DefiLlama ID': '' }),
				tokenRightsEntry({ 'Protocol Name': 'Unknown Protocol', 'DefiLlama ID': '999' }),
				tokenRightsEntry({ 'Protocol Name': 'Pendle', 'DefiLlama ID': '382' }),
				tokenRightsEntry({ 'Protocol Name': 'Ethereum', 'DefiLlama ID': 'ethereum' })
			]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [
					{ name: 'Pendle V2', href: null },
					{ name: 'Ethereum', href: null }
				]
			},
			revalidate: 123
		})
	})

	test('keeps the directory available when holders revenue fails', async () => {
		const page = await setupPageModule({
			holdersRevenueFails: true,
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				holdersRevenueAvailable: false,
				protocols: [{ name: 'Lido', holdersRevenue24h: null }]
			}
		})
	})

	test('keeps holders revenue available for a successful empty response', async () => {
		const page = await setupPageModule({
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				holdersRevenueAvailable: true,
				protocols: [{ name: 'Lido', holdersRevenue24h: null }]
			}
		})
	})

	test('routes chain entries when the metadata cache key differs from the chain id', async () => {
		const page = await setupPageModule({
			chainMetadata: {
				'plume-mainnet': { name: 'Plume Mainnet', id: 'plume_mainnet' }
			},
			tokensJson: {
				plume: {
					name: 'Plume',
					symbol: 'PLUME',
					chainId: 'plume_mainnet',
					route: '/token/PLUME'
				}
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Plume', 'DefiLlama ID': 'plume_mainnet' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Plume Mainnet', logo: 'icon:Plume Mainnet', href: '/token/PLUME' }]
			},
			revalidate: 123
		})
	})

	test('routes protocol entries from token directory ids without a gecko id', async () => {
		const page = await setupPageModule({
			protocolMetadata: {
				'7161': { displayName: 'Backpack SOL' }
			},
			tokensJson: {
				bp: {
					name: 'Backpack',
					symbol: 'BP',
					protocolId: '7161',
					route: '/token/BP'
				}
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Backpack', 'DefiLlama ID': '7161' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Backpack SOL', logo: 'icon:Backpack SOL', href: '/token/BP' }]
			},
			revalidate: 123
		})
	})

	test('routes cex entries when the token rights name matches a cex slug', async () => {
		const page = await setupPageModule({
			cexs: [{ name: 'Backpack', slug: 'backpack' }],
			tokensJson: {
				bp: {
					name: 'Backpack',
					symbol: 'BP',
					token_nk: 'coingecko:backpack',
					route: '/token/BP'
				}
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Backpack', 'DefiLlama ID': '4266' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Backpack', logo: 'icon:Backpack', href: '/token/BP' }]
			},
			revalidate: 123
		})
		const { flushTelemetry, recordDomainEvent } = await import('~/utils/telemetry')
		expect(recordDomainEvent).not.toHaveBeenCalled()
		expect(flushTelemetry).not.toHaveBeenCalled()
	})

	test('renders cex entries as text when the matching token has no page route', async () => {
		const page = await setupPageModule({
			cexs: [{ name: 'Backpack', slug: 'backpack' }],
			tokensJson: {
				bp: {
					name: 'Backpack',
					symbol: 'BP',
					token_nk: 'coingecko:backpack'
				}
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Backpack', 'DefiLlama ID': '4266' })]
		})

		await expect(page.getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Backpack', href: null }]
			},
			revalidate: 123
		})
		const { flushTelemetry, recordDomainEvent } = await import('~/utils/telemetry')
		expect(recordDomainEvent).not.toHaveBeenCalled()
		expect(flushTelemetry).not.toHaveBeenCalled()
	})

	test('filters rows by multiple selected filters and token search', async () => {
		const page = await setupPageModule()
		const rows = [
			tokenRightsListItem({
				name: 'Aave',
				tokens: ['AAVE', 'stkAAVE'],
				feeSwitchStatus: 'ON',
				hasBuybacks: true,
				hasDividends: false,
				hasBurns: false,
				hasEquityCapture: false,
				hasNoEquityCapture: true
			}),
			tokenRightsListItem({
				name: 'Ethena',
				tokens: ['ENA', 'sENA'],
				feeSwitchStatus: 'PENDING',
				hasBuybacks: false,
				hasDividends: true,
				hasBurns: false,
				hasEquityCapture: false,
				hasNoEquityCapture: true
			}),
			tokenRightsListItem({
				name: 'Axelar',
				tokens: ['AXL'],
				feeSwitchStatus: 'OFF',
				hasBuybacks: false,
				hasDividends: false,
				hasBurns: false,
				hasEquityCapture: true,
				hasNoEquityCapture: false
			})
		]

		expect(page.filterTokenRightsRows(rows, ['feeSwitchOn', 'hasBuybacks'], '')).toEqual([rows[0]])
		expect(page.filterTokenRightsRows(rows, ['hasDividends'], 'sena')).toEqual([rows[1]])
		expect(page.filterTokenRightsRows(rows, ['feeSwitchOn'], 'axl')).toEqual([])
	})

	test('counts stats from filtered rows', async () => {
		const page = await setupPageModule()
		const stats = page.getTokenRightsStats([
			tokenRightsListItem({ feeSwitchStatus: 'ON', hasBuybacks: true, hasDividends: false }),
			tokenRightsListItem({ feeSwitchStatus: 'PENDING', hasBuybacks: false, hasDividends: true }),
			tokenRightsListItem({ feeSwitchStatus: 'ON', hasBuybacks: true, hasDividends: true })
		])

		expect(stats).toEqual({ feeSwitchOn: 2, buybacks: 2, dividends: 2 })
	})
})
