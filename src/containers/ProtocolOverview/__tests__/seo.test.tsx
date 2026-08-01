import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IProtocolOverviewPageData, IProtocolPageMetrics } from '../types'

const canonicalProtocolAaveRegex =
	/<link\b(?=[^>]*\brel="canonical")(?=[^>]*\bhref="https:\/\/defillama\.com\/protocol\/aave")[^>]*\/?>/
const canonicalProtocolActiveLoansAaveRegex =
	/<link\b(?=[^>]*\brel="canonical")(?=[^>]*\bhref="https:\/\/defillama\.com\/protocol\/active-loans\/aave")[^>]*\/?>/
const canonicalProtocolDefiSwapRegex =
	/<link\b(?=[^>]*\brel="canonical")(?=[^>]*\bhref="https:\/\/defillama\.com\/protocol\/defi-swap")[^>]*\/?>/
const robotsNoindexRegex = /<meta\b(?=[^>]*\bname="robots")(?=[^>]*\bcontent="noindex")[^>]*\/?>/

const metrics: IProtocolPageMetrics = {
	tvl: true,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	dexAggregators: false,
	perpsAggregators: false,
	bridgeAggregators: false,
	stablecoins: false,
	bridge: false,
	treasury: false,
	unlocks: false,
	incentives: false,
	yields: false,
	fees: false,
	revenue: false,
	forks: false,
	governance: false,
	nfts: false,
	dev: false,
	inflows: false,
	liquidity: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false
}

const createOverviewProps = (): IProtocolOverviewPageData => ({
	initialMultiSeriesChartData: {},
	id: 'aave',
	name: 'Aave',
	token: {
		symbol: 'AAVE',
		gecko_id: null,
		gecko_url: null,
		explorer_url: null
	},
	category: 'Lending',
	chains: null,
	currentTvlByChain: null,
	isOracleProtocol: false,
	oracleTvs: null,
	metrics,
	fees: null,
	revenue: null,
	holdersRevenue: null,
	dexVolume: null,
	dexNotionalVolume: null,
	dexAggregatorVolume: null,
	perpVolume: null,
	openInterest: null,
	perpAggregatorVolume: null,
	bridgeAggregatorVolume: null,
	optionsPremiumVolume: null,
	optionsNotionalVolume: null,
	liquidationVolume: null,
	collateralLiquidated: null,
	bridgeVolume: null,
	treasury: null,
	unlocks: null,
	yields: null,
	governance: null,
	articles: null,
	raises: null,
	expenses: null,
	tokenLiquidity: null,
	outstandingFDV: null,
	audits: null,
	isCEX: false,
	hasKeyMetrics: false,
	hacks: [],
	chartDenominations: [],
	chartColors: {},
	availableCharts: [],
	hallmarks: [],
	rangeHallmarks: [],
	geckoId: null,
	governanceApis: null,
	incomeStatement: null,
	seoTitle: 'Aave',
	seoDescription: 'Aave protocol overview',
	defaultToggledCharts: []
})

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

describe('ProtocolOverview final page SEO', () => {
	it('renders the final protocol page without a noindex tag and with a canonical URL', async () => {
		vi.doMock('next/head', () => ({
			default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
		}))
		vi.doMock('next/router', () => ({
			useRouter: () => ({ query: {} })
		}))
		vi.doMock('~/api/client', () => ({
			useGetTokenPrice: () => ({ data: null, isLoading: false })
		}))
		vi.doMock('../helpers', () => ({
			useFinalTVL: () => ({
				tvl: 0,
				tvlByChain: [],
				oracleTvs: 0,
				oracleTvsByChain: [],
				toggleOptions: undefined
			}),
			getPrimaryValueLabelType: () => ({
				title: 'Total Value Locked',
				byChainTitle: 'TVL by chain'
			})
		}))
		vi.doMock('~/hooks/useIsClient', () => ({
			useIsClient: () => false
		}))
		vi.doMock('~/components/Nav', () => ({
			Nav: () => null
		}))
		vi.doMock('~/components/Metrics', () => ({
			MetricsAndTools: () => null
		}))
		vi.doMock('~/components/Search', () => ({
			DesktopSearch: () => null
		}))
		vi.doMock('@ariakit/react', () => ({
			MenuProvider: ({ children }: { children: React.ReactNode }) =>
				React.createElement(React.Fragment, null, children),
			MenuButton: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
			MenuButtonArrow: () => null,
			Menu: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
			PopoverDismiss: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
			MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children)
		}))
		vi.doMock('~/components/Bookmark', () => ({
			Bookmark: () => null
		}))
		vi.doMock('~/components/EntityQuestionsStrip', () => ({
			EntityQuestionsStrip: () => null
		}))
		vi.doMock('~/ui/Icon', () => ({
			Icon: () => null
		}))
		vi.doMock('~/components/Link', () => ({
			BasicLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
				React.createElement('a', { href }, children),
			ButtonLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
				React.createElement('a', { href }, children)
		}))
		vi.doMock('~/components/SEO', async () => {
			const actual = await vi.importActual<typeof import('~/components/SEO')>('~/components/SEO')

			return {
				...actual,
				LinkPreviewCard: () => null
			}
		})
		vi.doMock('~/components/TokenLogo', () => ({
			TokenLogo: () => null
		}))
		vi.doMock('~/ui/Tooltip', () => ({
			Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
		}))
		vi.doMock('~/auth', () => ({
			useAuthContext: () => ({ user: null })
		}))
		vi.doMock('../AdditionalInfo', () => ({
			AdditionalInfo: () => null
		}))
		vi.doMock('../KeyMetrics', () => ({
			KeyMetrics: () => null
		}))
		vi.doMock('../ProtocolChartPanel', () => ({
			ProtocolChartPanel: () => null
		}))

		const { ProtocolOverview } = await import('../index')
		const props = createOverviewProps()

		const markup = renderToStaticMarkup(React.createElement(ProtocolOverview, props))

		expect(markup).toMatch(canonicalProtocolAaveRegex)
		expect(markup).not.toMatch(robotsNoindexRegex)
	})
})

function setupLayoutMocks() {
	vi.doMock('next/head', () => ({
		default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
	}))
	vi.doMock('@ariakit/react', () => ({
		MenuProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
		MenuButton: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
		MenuButtonArrow: () => null,
		Menu: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
		PopoverDismiss: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
		MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children)
	}))
	vi.doMock('~/components/EntityQuestionsStrip', () => ({
		EntityQuestionsStrip: () => null
	}))
	vi.doMock('~/ui/Icon', () => ({
		Icon: () => null
	}))
	vi.doMock('~/components/Link', () => ({
		BasicLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
			React.createElement('a', { href }, children),
		ButtonLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
			React.createElement('a', { href }, children)
	}))
	vi.doMock('~/components/TokenLogo', () => ({
		TokenLogo: () => null
	}))
	vi.doMock('~/auth', () => ({
		useAuthContext: () => ({ user: null })
	}))
	vi.doMock('~/layout', async () => {
		const { SEO } = await vi.importActual<typeof import('~/components/SEO')>('~/components/SEO')

		return {
			default: ({
				title,
				description,
				canonicalUrl,
				noIndex,
				pageName,
				children
			}: {
				title: string
				description: string | null | undefined
				canonicalUrl: string | null | undefined
				noIndex?: boolean
				pageName?: string[]
				children?: React.ReactNode
			}) =>
				React.createElement(
					'div',
					{ 'data-page-name': pageName?.join('/') },
					React.createElement(SEO, {
						title,
						description,
						canonicalUrl,
						...(noIndex !== undefined ? { noIndex } : {})
					}),
					children
				)
		}
	})
}

describe('ProtocolOverviewLayout SEO', () => {
	it('falls back when SEO producers pass empty strings', async () => {
		setupLayoutMocks()

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			<ProtocolOverviewLayout
				name="Aave"
				category="Lending"
				metrics={metrics}
				tab="information"
				seoTitle=""
				seoDescription=""
			>
				{null}
			</ProtocolOverviewLayout>
		)

		expect(markup).toContain('Aave Protocol Overview - DefiLlama')
		expect(markup).toContain('Track Aave metrics on DefiLlama')
	})

	it('keeps the information tab indexable with a canonical URL', async () => {
		setupLayoutMocks()

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			<ProtocolOverviewLayout name="Aave" category="Lending" metrics={metrics} tab="information">
				{null}
			</ProtocolOverviewLayout>
		)

		expect(markup).toMatch(canonicalProtocolAaveRegex)
		expect(markup).not.toMatch(robotsNoindexRegex)
	})

	it('marks configured protocol overview pages as noindex while keeping the canonical URL', async () => {
		setupLayoutMocks()

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			<ProtocolOverviewLayout name="Defi Swap" category="DEX" metrics={metrics} tab="information">
				{null}
			</ProtocolOverviewLayout>
		)

		expect(markup).toMatch(canonicalProtocolDefiSwapRegex)
		expect(markup).toMatch(robotsNoindexRegex)
	})

	it('marks a non-standalone tab as noindex without a canonical URL', async () => {
		setupLayoutMocks()

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			<ProtocolOverviewLayout name="Aave" category="Lending" metrics={metrics} tab="tvl">
				{null}
			</ProtocolOverviewLayout>
		)

		expect(markup).toMatch(robotsNoindexRegex)
		expect(markup).not.toMatch(canonicalProtocolAaveRegex)
	})

	it('keeps the active loans tab indexable with the new canonical URL', async () => {
		setupLayoutMocks()

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			<ProtocolOverviewLayout name="Aave" category="Lending" metrics={{ ...metrics, borrowed: true }} tab="borrowed">
				{null}
			</ProtocolOverviewLayout>
		)

		expect(markup).toMatch(canonicalProtocolActiveLoansAaveRegex)
		expect(markup).not.toMatch(robotsNoindexRegex)
	})

	it('does not show TVL toggle instructions on the page-owned active loans tab', async () => {
		setupLayoutMocks()

		const { ProtocolOverviewLayout } = await import('../Layout')
		const borrowedMarkup = renderToStaticMarkup(
			<ProtocolOverviewLayout
				name="Aave"
				category="Uncollateralized Lending"
				metrics={{ ...metrics, borrowed: true }}
				tab="borrowed"
			>
				{null}
			</ProtocolOverviewLayout>
		)
		const overviewMarkup = renderToStaticMarkup(
			<ProtocolOverviewLayout name="Aave" category="Uncollateralized Lending" metrics={metrics} tab="information">
				{null}
			</ProtocolOverviewLayout>
		)

		expect(borrowedMarkup).not.toContain('toggle Active Loans')
		expect(overviewMarkup).toContain('toggle Active Loans')
	})

	it.each(['Vesper', 'Odyssey Finance', 'Metronome', 'Metronome Synth'])(
		'shows the Odyssey enterprise dashboard announcement for %s',
		async (name) => {
			setupLayoutMocks()

			const { ProtocolOverviewLayout } = await import('../Layout')
			const markup = renderToStaticMarkup(
				<ProtocolOverviewLayout name={name} category="Lending" metrics={metrics} tab="information">
					{null}
				</ProtocolOverviewLayout>
			)

			expect(markup).toContain('href="https://enterprise.defillama.com/odyssey-ecosystem"')
			expect(markup).toContain('Enterprise Dashboard')
			expect(markup).toContain('Odyssey Enterprise')
			expect(markup).not.toContain('investor relations dashboard')
		}
	)
})

describe('ProtocolOverview SEO contract', () => {
	it('canonicalizes a lower-case denomination for overview summary formatting', async () => {
		let formattedSummaryValue: string | number | null | undefined

		vi.doMock('next/router', () => ({
			useRouter: () => ({ query: { denomination: 'eth' } })
		}))
		vi.doMock('~/api/client', () => ({
			useGetTokenPrice: () => ({ data: { price: 2, symbol: 'ETH' }, isLoading: false })
		}))
		vi.doMock('../helpers', () => ({
			useFinalTVL: () => ({
				tvl: 100,
				tvlByChain: [],
				oracleTvs: 0,
				oracleTvsByChain: [],
				toggleOptions: []
			}),
			getPrimaryValueLabelType: () => ({
				title: 'Total Value Locked',
				byChainTitle: 'TVL by chain'
			})
		}))
		vi.doMock('~/components/Bookmark', () => ({ Bookmark: () => null }))
		vi.doMock('~/ui/Icon', () => ({ Icon: () => null }))
		vi.doMock('~/components/SEO', () => ({ LinkPreviewCard: () => null }))
		vi.doMock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
		vi.doMock('../AdditionalInfo', () => ({ AdditionalInfo: () => null }))
		vi.doMock('../ProtocolChartPanel', () => ({ ProtocolChartPanel: () => null }))
		vi.doMock('../KeyMetrics', () => ({
			KeyMetrics: ({ formatPrice }: { formatPrice: (value: number) => string | number | null }) => {
				formattedSummaryValue = formatPrice(100)
				return null
			}
		}))
		vi.doMock('../Layout', () => ({
			ProtocolOverviewLayout: ({ children }: { children?: React.ReactNode }) =>
				React.createElement(React.Fragment, null, children)
		}))

		const { ProtocolOverview } = await import('../index')
		const props = {
			...createOverviewProps(),
			chartDenominations: [{ symbol: 'USD' }, { symbol: 'ETH', geckoId: 'ethereum' }]
		}

		renderToStaticMarkup(React.createElement(ProtocolOverview, props))

		expect(formattedSummaryValue).toBe('50 ETH')
	})

	it('passes the information tab to ProtocolOverviewLayout', async () => {
		let capturedTab: string | undefined

		vi.doMock('next/router', () => ({
			useRouter: () => ({ query: {} })
		}))
		vi.doMock('~/api/client', () => ({
			useGetTokenPrice: () => ({ data: null, isLoading: false })
		}))
		vi.doMock('../helpers', () => ({
			useFinalTVL: () => ({
				tvl: 0,
				tvlByChain: [],
				oracleTvs: 0,
				oracleTvsByChain: [],
				toggleOptions: undefined
			}),
			getPrimaryValueLabelType: () => ({
				title: 'Total Value Locked',
				byChainTitle: 'TVL by chain'
			})
		}))
		vi.doMock('~/components/Bookmark', () => ({
			Bookmark: () => null
		}))
		vi.doMock('~/ui/Icon', () => ({
			Icon: () => null
		}))
		vi.doMock('~/components/SEO', () => ({
			LinkPreviewCard: () => null
		}))
		vi.doMock('~/components/TokenLogo', () => ({
			TokenLogo: () => null
		}))
		vi.doMock('~/ui/Tooltip', () => ({
			Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
		}))
		vi.doMock('../AdditionalInfo', () => ({
			AdditionalInfo: () => null
		}))
		vi.doMock('../KeyMetrics', () => ({
			KeyMetrics: () => null
		}))
		vi.doMock('../ProtocolChartPanel', () => ({
			ProtocolChartPanel: () => null
		}))
		vi.doMock('../Layout', () => ({
			ProtocolOverviewLayout: ({ tab }: { tab?: string }) => {
				capturedTab = tab
				return null
			}
		}))

		const { ProtocolOverview } = await import('../index')
		const props = createOverviewProps()

		renderToStaticMarkup(React.createElement(ProtocolOverview, props))

		expect(capturedTab).toBe('information')
	})

	it('renders a protocol website link in the header', async () => {
		vi.doMock('next/router', () => ({
			useRouter: () => ({ query: {} })
		}))
		vi.doMock('~/api/client', () => ({
			useGetTokenPrice: () => ({ data: null, isLoading: false })
		}))
		vi.doMock('../helpers', () => ({
			useFinalTVL: () => ({
				tvl: 0,
				tvlByChain: [],
				oracleTvs: 0,
				oracleTvsByChain: [],
				toggleOptions: undefined
			}),
			getPrimaryValueLabelType: () => ({
				title: 'Total Value Locked',
				byChainTitle: 'TVL by chain'
			})
		}))
		vi.doMock('~/components/Bookmark', () => ({
			Bookmark: () => null
		}))
		vi.doMock('~/ui/Icon', () => ({
			Icon: () => null
		}))
		vi.doMock('~/components/SEO', () => ({
			LinkPreviewCard: () => null
		}))
		vi.doMock('~/components/TokenLogo', () => ({
			TokenLogo: () => null
		}))
		vi.doMock('~/ui/Tooltip', () => ({
			Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
		}))
		vi.doMock('../AdditionalInfo', () => ({
			AdditionalInfo: () => null
		}))
		vi.doMock('../KeyMetrics', () => ({
			KeyMetrics: () => null
		}))
		vi.doMock('../ProtocolChartPanel', () => ({
			ProtocolChartPanel: () => null
		}))
		vi.doMock('../Layout', () => ({
			ProtocolOverviewLayout: ({ children }: { children?: React.ReactNode }) =>
				React.createElement(React.Fragment, null, children)
		}))

		const { ProtocolOverview } = await import('../index')
		const props = { ...createOverviewProps(), website: 'https://aave.com' }

		const markup = renderToStaticMarkup(React.createElement(ProtocolOverview, props))

		expect(markup).toContain('href="https://aave.com"')
		expect(markup).toContain('aria-label="Open Aave website"')
	})
})

describe('ProtocolInfo category links', () => {
	it('renders a category CTA linking back to the category page', async () => {
		vi.doMock('~/ui/Icon', () => ({
			Icon: () => null
		}))
		vi.doMock('~/components/Link', () => ({
			BasicLink: ({
				children,
				href,
				...props
			}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
				children: React.ReactNode
				href: string
			}) => React.createElement('a', { href, ...props }, children),
			ButtonLink: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children)
		}))
		vi.doMock('~/components/Menu', () => ({
			Menu: () => null
		}))
		vi.doMock('~/ui/MetricPrimitives', () => ({
			MetricRow: () => null
		}))
		vi.doMock('~/ui/QuestionHelper', () => ({
			QuestionHelper: () => null
		}))
		vi.doMock('~/ui/Tooltip', () => ({
			Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
		}))
		vi.doMock('~/auth', () => ({
			useAuthContext: () => ({ activePlan: null })
		}))
		vi.doMock('~/auth/signupSource', () => ({
			setSignupSource: () => undefined
		}))

		const { ProtocolInfo } = await vi.importActual<typeof import('../AdditionalInfo')>('../AdditionalInfo')
		const markup = renderToStaticMarkup(
			React.createElement(ProtocolInfo, {
				...createOverviewProps(),
				id: 'polymarket',
				name: 'Polymarket',
				description: 'Prediction markets protocol.',
				category: 'Prediction Market',
				tags: null,
				audits: null,
				website: null,
				github: null,
				twitter: null,
				safeHarbor: false,
				isCEX: false
			})
		)

		expect(markup).toContain('href="/protocols/prediction-market"')
		expect(markup).toContain('Prediction Market')
		expect(markup).toContain('Category:')
	})
})
