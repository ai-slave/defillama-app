import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { IncomeStatement } from '~/containers/ProtocolOverview/IncomeStatement'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { readInvestorApiJson } from '../../api.types'
import { ApiTrendChart, ChainBreakdownChart } from './ChainBreakdownChart'
import {
	addNetworkFeeToIncomeStatement,
	type ApiTableData,
	type Chart,
	type Distribution,
	type Kpi as KpiT
} from './transform'
import {
	ApiTable,
	ChartCard,
	defWithNetworkFee,
	DEX,
	DonutCard,
	Kpi,
	KpiBand,
	networkFeeQuery,
	PageLoader,
	PlaceholderCard,
	SectionHeader,
	useAdapterSeries,
	useThorchainData,
	useThorchainDefs,
	withNetworkFee,
	type SeriesKpis
} from './ui'

const NAME = 'THORChain'

// Same setup as odyssey's MetronomeIncomeStatement: render the shared ProtocolOverview
// component with a Table/Sankey toggle, fed by the internal income-statement route. The
// statement only covers thorchain-dex, so the network fee is folded in client-side.
function ThorchainIncomeStatement({ title, subtitle }: { title: string; subtitle?: string }) {
	const [view, setView] = useState<'table' | 'sankey'>('table')
	const query = useQuery({
		queryKey: ['thorchain-income-statement', DEX],
		queryFn: async () => {
			const response = await fetch(`/api/public/income-statement?protocol=${DEX}&version=2`)
			return response.ok
				? readInvestorApiJson<NonNullable<IProtocolOverviewPageData['incomeStatement']>>(response)
				: null
		},
		retry: 2,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const networkFees = useQuery(networkFeeQuery())
	const data = useMemo(
		() => addNetworkFeeToIncomeStatement(query.data, networkFees.data),
		[query.data, networkFees.data]
	)
	const hasData =
		data?.data && (['monthly', 'quarterly', 'yearly'] as const).some((k) => Object.keys(data.data[k] ?? {}).length > 0)

	return (
		<ChartCard
			title={title}
			subtitle={subtitle}
			control={
				<SegmentedControl<typeof view>
					variant="default"
					size="sm"
					label={`${title} view`}
					options={[
						{ value: 'table', label: 'Table' },
						{ value: 'sankey', label: 'Sankey' }
					]}
					value={view}
					onValueChange={setView}
				/>
			}
		>
			{query.isLoading ? (
				<div className="flex h-[320px] items-center justify-center body-sm text-pro-text-tertiary">Loading…</div>
			) : hasData ? (
				<IncomeStatement
					name={NAME}
					incomeStatement={data}
					view={view}
					anchorId="thorchain-income"
					showTitles={false}
					className="border-none bg-transparent p-0"
				/>
			) : (
				<div className="flex h-[320px] items-center justify-center body-sm text-pro-text-tertiary">
					No income statement data
				</div>
			)}
		</ChartCard>
	)
}

interface FinancialsData {
	kpis: Record<string, KpiT | undefined>
	distribution: Distribution
	affiliate: {
		leaderboard: ApiTableData
		topShareDonut: Distribution
		dailyChart: Chart
		kpis: Record<string, KpiT | undefined>
	} | null
}

export default function Financials() {
	const { data } = useThorchainData<FinancialsData>('financials')
	const defs = useThorchainDefs()
	// Fees & composition KPIs from the DefiLlama thorchain-dex adapter (same cache keys as
	// the Overview), so each window matches across tabs. All windows are Lifetime / 1Y / 30D / 7D.
	const fees = useAdapterSeries('total-fees', withNetworkFee(ADAPTER_DATA_TYPES.DAILY_FEES))
	const revenue = useAdapterSeries('total-revenue', withNetworkFee(ADAPTER_DATA_TYPES.DAILY_REVENUE))
	const holdersRev = useAdapterSeries('dex-holders-revenue', () =>
		fetchAdapterProtocolChartData({
			adapterType: ADAPTER_TYPES.FEES,
			protocol: DEX,
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
		})
	)
	const supplySide = useAdapterSeries('dex-supply-side-revenue', () =>
		fetchAdapterProtocolChartData({
			adapterType: ADAPTER_TYPES.FEES,
			protocol: DEX,
			dataType: ADAPTER_DATA_TYPES.DAILY_SUPPLY_SIDE_REVENUE
		})
	)
	const protocolRev = useAdapterSeries(
		'total-protocol-revenue',
		withNetworkFee(ADAPTER_DATA_TYPES.DAILY_PROTOCOL_REVENUE)
	)
	if (!data) return <PageLoader />

	const { distribution, affiliate } = data

	// Fees, then Revenue (its protocol + holders parts), then the full decomposition of fees —
	// supply-side (the cost leg) alongside the two revenue legs, one row each in a 4-wide grid.
	const composition: Array<{ label: string; def: string | undefined; data: SeriesKpis | null | undefined }> = [
		{ label: 'Supply-Side Revenue', def: defs.supplySideRevenue, data: supplySide.data },
		{ label: 'Protocol Revenue', def: defWithNetworkFee(defs.protocolRevenue), data: protocolRev.data },
		{ label: 'Holders Revenue', def: defs.holdersRevenue, data: holdersRev.data }
	]

	return (
		<div className="flex flex-col gap-10">
			<section className="flex flex-col gap-6">
				<SectionHeader>Fees & Revenue</SectionHeader>

				<KpiBand label="Fees">
					<Kpi kpi={fees.data?.lifetime} label="Lifetime" def={defWithNetworkFee(defs.fees)} />
					<Kpi kpi={fees.data?.y1} label="1Y" />
					<Kpi kpi={fees.data?.d30} label="30D" />
					<Kpi kpi={fees.data?.d7} label="7D" />
				</KpiBand>

				<KpiBand label="Revenue (Protocol + Holders)">
					<Kpi kpi={revenue.data?.lifetime} label="Lifetime" def={defWithNetworkFee(defs.revenue)} />
					<Kpi kpi={revenue.data?.y1} label="1Y" />
					<Kpi kpi={revenue.data?.d30} label="30D" />
					<Kpi kpi={revenue.data?.d7} label="7D" />
				</KpiBand>

				<KpiBand label="Fees Composition (Revenue + Supply-Side Revenue)">
					{composition.flatMap(({ label, def, data: d }) => [
						<Kpi key={`${label}-lifetime`} kpi={d?.lifetime} label={`${label} (Lifetime)`} def={def} />,
						<Kpi key={`${label}-1y`} kpi={d?.y1} label={`${label} (1Y)`} />,
						<Kpi key={`${label}-30d`} kpi={d?.d30} label={`${label} (30D)`} />,
						<Kpi key={`${label}-7d`} kpi={d?.d7} label={`${label} (7D)`} />
					])}
				</KpiBand>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<ChainBreakdownChart
						metric="fees"
						title="Fees by Chain"
						subtitle="Native network fee included in THORChain."
					/>
					<ChainBreakdownChart
						metric="revenue"
						title="Revenue by Chain"
						subtitle="Native network fee included in THORChain."
					/>
				</div>

				<DonutCard
					dist={distribution}
					subtitle="Protocol-defined split of system income: 75% nodes & LPs, 10% TCY stakers, 5% dev fund, 5% marketing fund, 5% burn."
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Income Statement</SectionHeader>
				<ThorchainIncomeStatement
					title="THORChain Income Statement"
					subtitle="Fees & protocol revenue, including the native network fee."
				/>
			</section>

			{!affiliate && (
				<section className="flex flex-col gap-6">
					<SectionHeader>Affiliate Fees</SectionHeader>
					<PlaceholderCard
						title="Affiliate Fees"
						subtitle="Affiliate fee feed unavailable."
						note="raynalytics daily-affiliate-fees"
					/>
				</section>
			)}
			{affiliate && (
				<section className="flex flex-col gap-6">
					<SectionHeader>Affiliate Fees</SectionHeader>
					{/* "Included in total fees" lives in the (i) tooltip, not a second header. */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						<Kpi kpi={affiliate.kpis.affiliateLifetime} label="Lifetime" def={defs.affiliateFees} />
						<Kpi kpi={affiliate.kpis.affiliate1y} label="1Y" />
						<Kpi kpi={affiliate.kpis.affiliate30d} label="30D" />
						<Kpi kpi={affiliate.kpis.affiliate7d} label="7D" />
						<Kpi kpi={affiliate.kpis.topAffiliate} label="Top Affiliate" />
						<Kpi kpi={affiliate.kpis.affiliateCount} label="Affiliates" />
						<Kpi kpi={affiliate.kpis.affiliateVolumeLifetime} label="Affiliate Volume (Lifetime)" />
					</div>
					<ApiTrendChart
						chart={affiliate.dailyChart}
						subtitle="Affiliate fees paid to integrating wallets and interfaces."
					/>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
							<h3 className="mb-3 title-md text-pro-text-primary">
								{affiliate.leaderboard.title ?? 'Affiliate Leaderboard'}
							</h3>
							<ApiTable table={affiliate.leaderboard} maxHeight="360px" />
						</div>
						<DonutCard dist={affiliate.topShareDonut} subtitle="Share of lifetime affiliate fees." />
					</div>
				</section>
			)}
		</div>
	)
}
