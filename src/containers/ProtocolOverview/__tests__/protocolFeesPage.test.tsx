import type { ComponentProps, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ProtocolFeesPage from '~/pages/protocol/fees/[protocol]'
import type { IProtocolPageMetrics } from '../types'

vi.mock('~/components/ChartExport/ChartExportButtons', () => ({ ChartExportButtons: () => null }))
vi.mock('~/components/DeprecatedProtocolMarker', () => ({ DeprecatedProtocolMarker: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/shared/ChartGroupingSelector', () => ({
	ChartGroupingSelector: () => null,
	DWMC_GROUPING_OPTIONS_LOWERCASE: []
}))
vi.mock('~/components/Select/Select', () => ({ Select: () => null }))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
vi.mock('~/containers/AdapterMetrics/ProtocolChart', () => ({
	DimensionProtocolChartByType: ({ title }: { title: string }) => <div>{title}</div>
}))
vi.mock('~/containers/ProtocolOverview/KeyMetrics', () => ({ KeyMetrics: () => null }))
vi.mock('~/containers/ProtocolOverview/Layout', () => ({
	ProtocolOverviewLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>
}))
vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({ chartInstance: null, handleChartReady: () => undefined })
}))
vi.mock('~/ui/ChartPanel', () => ({
	ChartPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
	ChartPanelToolbar: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	ChartPanelBodyFallback: () => null
}))
vi.mock('~/ui/FailedDataPopover', () => ({ FailedDataPopover: () => null }))
vi.mock('~/ui/Panel', () => ({ Panel: ({ children }: { children: ReactNode }) => <section>{children}</section> }))

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
	fees: true,
	revenue: true,
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

type ProtocolFeesPageProps = ComponentProps<typeof ProtocolFeesPage>

const fees: ProtocolFeesPageProps['fees'] = {
	total24h: 10,
	total7d: 70,
	total30d: 300,
	total1y: 3_600,
	annualized1y: 3_650,
	totalAllTime: 1_000,
	methodology: null,
	methodologyURL: null,
	defaultChartView: 'daily',
	chainBreakdown: null
}

describe('protocol fees page breakdown panels', () => {
	it('renders a multi-chain revenue breakdown without requiring multiple revenue versions', () => {
		const props: ProtocolFeesPageProps = {
			name: 'Test Protocol',
			deprecated: false,
			otherProtocols: [],
			category: 'Lending',
			metrics,
			fees,
			revenue: fees,
			holdersRevenue: null,
			hasKeyMetrics: true,
			openSmolStatsSummaryByDefault: true,
			charts: {
				fees: [[1_700_000_000, 10]],
				revenue: [[1_700_000_000, 5]],
				holdersRevenue: []
			},
			defaultCharts: ['Fees', 'Revenue'],
			protocolChains: ['Ethereum'],
			protocolRevenueChains: ['Arbitrum', 'Base'],
			protocolFeesVersions: [],
			protocolRevenueVersions: ['Standalone'],
			warningBanners: [],
			defaultChartView: 'daily',
			hallmarks: null,
			seoTitle: 'Test Protocol Fees',
			seoDescription: 'Test protocol fees and revenue',
			failedMetrics: []
		}

		const html = renderToStaticMarkup(<ProtocolFeesPage {...props} />)

		expect(html).toContain('Revenue by chain')
		expect(html).not.toContain('Revenue by protocol version')
	})
})
