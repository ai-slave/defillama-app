import { beforeEach, describe, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { filterTokenRightsRows, getStaticProps, getTokenRightsStats } from '~/pages/token-rights'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'

const dataset = vi.hoisted(() => ({ entries: [] as Array<unknown> }))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({
	fetchTokenRightsEntries: async () => dataset.entries
}))

const http = installFixtureFetch()
const metadata = installMetadataSeeder()
const HOLDERS_REVENUE_URL = `${V2_SERVER_URL}/metrics/fees`

function setup({
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
	tokensJson?: Record<string, unknown>
	tokenRightsEntries?: Array<unknown>
	protocolMetadata?: Record<string, unknown>
} = {}) {
	dataset.entries = tokenRightsEntries
	metadata.seed({
		cexs,
		chainMetadata,
		protocolMetadata,
		tokenDirectory: tokensJson
	} as unknown as Partial<MetadataCache>)
	http.serve({
		[HOLDERS_REVENUE_URL]: holdersRevenueFails ? fixtureStatus(404) : { protocols: holdersRevenueProtocols }
	})
}

beforeEach(() => {
	dataset.entries = []
})

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
		setup({
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

		const result = await getStaticProps({} as never)
		expect(result).toMatchObject({
			props: {
				protocols: [
					{
						name: 'Ethereum',
						href: '/token/ETH#token-rights-and-value-accrual',
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
						href: '/token/LDO#token-rights-and-value-accrual',
						tokens: ['LDO'],
						holdersRevenue24h: null,
						feeSwitchStatus: 'OFF'
					}
				]
			},
			revalidate: expect.any(Number)
		})
	})

	test('links rows to the token rights section of the token page', async () => {
		setup({
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao' }
			},
			tokensJson: {
				ldo: { name: 'Lido DAO', symbol: 'LDO', token_nk: 'coingecko:lido-dao', route: '/token/LDO' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		const result = await getStaticProps({} as never)
		// The token page only scrolls to and highlights a hash that matches one of its section ids.
		expect(result).toMatchObject({
			props: { protocols: [{ name: 'Lido', href: '/token/LDO#token-rights-and-value-accrual' }] }
		})
	})

	test('uses resolved metadata for deprecated rows', async () => {
		setup({
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao', deprecated: true }
			},
			tokensJson: {
				ldo: { name: 'Lido DAO', symbol: 'LDO', token_nk: 'coingecko:lido-dao', route: '/token/LDO' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Lido', deprecated: true }]
			}
		})
	})

	test('uses child protocol holders revenue for parent token-rights rows', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Uniswap', holdersRevenue24h: 1000 }]
			}
		})
	})

	test('prefers direct holders revenue over summed child protocol revenue', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Uniswap', holdersRevenue24h: 900 }]
			}
		})
	})

	test('keeps a direct measured zero instead of replacing it with child revenue', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				holdersRevenueAvailable: true,
				protocols: [{ name: 'Uniswap', holdersRevenue24h: 0 }]
			}
		})
	})

	test('skips entries without metadata and keeps metadata rows without a token route', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [
					{ name: 'Pendle V2', href: null },
					{ name: 'Ethereum', href: null }
				]
			},
			revalidate: expect.any(Number)
		})
	})

	test('keeps the directory available when holders revenue fails', async () => {
		setup({
			holdersRevenueFails: true,
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				holdersRevenueAvailable: false,
				protocols: [{ name: 'Lido', holdersRevenue24h: null }]
			}
		})
	})

	test('keeps holders revenue available for a successful empty response', async () => {
		setup({
			protocolMetadata: {
				'182': { displayName: 'Lido', gecko_id: 'lido-dao' }
			},
			tokenRightsEntries: [tokenRightsEntry({ 'Protocol Name': 'Lido DAO', 'DefiLlama ID': '182' })]
		})

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				holdersRevenueAvailable: true,
				protocols: [{ name: 'Lido', holdersRevenue24h: null }]
			}
		})
	})

	test('routes chain entries when the metadata cache key differs from the chain id', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Plume Mainnet', href: '/token/PLUME#token-rights-and-value-accrual' }]
			},
			revalidate: expect.any(Number)
		})
	})

	test('routes protocol entries from token directory ids without a gecko id', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Backpack SOL', href: '/token/BP#token-rights-and-value-accrual' }]
			},
			revalidate: expect.any(Number)
		})
	})

	test('routes cex entries when the token rights name matches a cex slug', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Backpack', href: '/token/BP#token-rights-and-value-accrual' }]
			},
			revalidate: expect.any(Number)
		})
	})

	test('renders cex entries as text when the matching token has no page route', async () => {
		setup({
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

		await expect(getStaticProps({} as never)).resolves.toMatchObject({
			props: {
				protocols: [{ name: 'Backpack', href: null }]
			},
			revalidate: expect.any(Number)
		})
	})

	test('filters rows by multiple selected filters and token search', () => {
		setup()
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

		expect(filterTokenRightsRows(rows, ['feeSwitchOn', 'hasBuybacks'], '')).toEqual([rows[0]])
		expect(filterTokenRightsRows(rows, ['hasDividends'], 'sena')).toEqual([rows[1]])
		expect(filterTokenRightsRows(rows, ['feeSwitchOn'], 'axl')).toEqual([])
	})

	test('counts stats from filtered rows', () => {
		setup()
		const stats = getTokenRightsStats([
			tokenRightsListItem({ feeSwitchStatus: 'ON', hasBuybacks: true, hasDividends: false }),
			tokenRightsListItem({ feeSwitchStatus: 'PENDING', hasBuybacks: false, hasDividends: true }),
			tokenRightsListItem({ feeSwitchStatus: 'ON', hasBuybacks: true, hasDividends: true })
		])

		expect(stats).toEqual({ feeSwitchOn: 2, buybacks: 2, dividends: 2 })
	})
})
