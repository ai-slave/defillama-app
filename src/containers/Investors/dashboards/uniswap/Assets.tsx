import { formatCompactNumber } from '~/utils/numberFormat'
import type { Chart, Kpi as KpiT } from './transform'
import { chartToTrendSeries, SeriesTrendChart } from './TrendChart'
import { ChartCard, KpiGrid, MiniTable, PageLoader, SectionHeader, TimeAreaCard, useUniswapData } from './ui'

interface AuctionRow {
	token: string
	chain: string
	currency: string
	launch: string
	ended: string
	raised: string
	committed: string
	bids: number
	bidders: number
}

// All served by the ir-server: token breadth and categories from Dune dex.trades (with
// the DefiLlama DEX blacklist applied), liquidity counts from the yields API, and CCA
// figures reconstructed from the auction factory contracts.
interface AssetsData {
	kpis: Record<string, KpiT | undefined>
	tradedAssets: Chart
	newTokens: Chart
	volumeByCategory: Chart
	pctOutsideMajors: Chart
	cca: {
		kpis: Record<string, KpiT | undefined>
		raisedChart: Chart
		auctions: { title?: string; note?: string; rows: AuctionRow[] }
	}
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export default function Assets() {
	const { data } = useUniswapData<AssetsData>('assets')
	if (!data) return <PageLoader />

	// The proceeds payload ships Daily + Cumulative series; the chart's own view toggle
	// covers cumulative, so only the daily series feeds it.
	const ccaProceeds = chartToTrendSeries(data.cca.raisedChart)
		.filter((series) => series.name === 'Daily')
		.map((series) => ({ ...series, name: 'Proceeds' }))

	return (
		<div className="flex flex-col gap-10">
			{/* All KPIs up top, grouped, so every headline figure reads without scrolling. */}
			<section className="flex flex-col gap-6">
				<KpiGrid
					label="Token Breadth"
					kpis={data.kpis}
					items={[
						['tokensWithLiquidity', 'Tokens with >$10k Liquidity', undefined],
						['tradedAssets', 'Tokens Traded (Lifetime)', undefined],
						['newTokens30d', 'New Tokens (30d)', undefined],
						['longTailTokens', 'Long-Tail Tokens', undefined],
						['longTailVolume', 'Long-Tail Volume (30d)', undefined]
					]}
				/>
				<KpiGrid
					label="Continuous Clearing Auctions"
					kpis={data.cca.kpis}
					cols={3}
					items={[
						['totalRaised', 'CCA Total Raised', 'Realized proceeds of graduated auctions.'],
						['graduatedAuctions', 'Graduated Auctions', undefined]
					]}
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Volume Composition</SectionHeader>
				<SeriesTrendChart
					title="Volume by Asset Category"
					subtitle="Monthly swap volume split by asset category via the maintained token-to-category map; the uncategorized long tail counts as memecoins."
					series={chartToTrendSeries(data.volumeByCategory)}
				/>
				<TimeAreaCard
					chart={data.pctOutsideMajors}
					title="% of Volume Outside the Top-10 Majors"
					valueSymbol="%"
					subtitle={
						data.pctOutsideMajors.note ??
						'Share of swap volume not attributable to the top-10 major assets (dynamic top-10 by trailing volume).'
					}
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Token Breadth</SectionHeader>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<TimeAreaCard
						chart={data.tradedAssets}
						valueSymbol=""
						subtitle="Distinct tokens with more than $1k of volume per month, both trade legs, all chains."
					/>
					<TimeAreaCard
						chart={data.newTokens}
						title="New Tokens First-Traded on Uniswap"
						valueSymbol=""
						subtitle="Tokens whose first-ever Uniswap trade happened that month and that cleared $1k of volume (spam excluded)."
					/>
				</div>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Continuous Clearing Auctions</SectionHeader>
				{/* Monthly default: proceeds are dominated by single graduation days, so the daily
				    view is one giant spike; monthly reads the trend. */}
				<SeriesTrendChart
					title="CCA Auction Proceeds"
					subtitle="Realized proceeds of graduated auctions on the Uniswap launchpad."
					series={ccaProceeds}
					stacked={false}
				/>
				<ChartCard
					title={data.cca.auctions.title ?? 'Graduated CCA Auctions'}
					subtitle="Per graduated auction (finalized with swept proceeds and 10+ unique bidders): raised is settled proceeds, committed is total bids submitted."
				>
					<MiniTable
						grid="minmax(90px,1fr) minmax(90px,0.9fr) minmax(70px,0.6fr) minmax(95px,0.9fr) minmax(95px,0.9fr) minmax(90px,0.9fr) minmax(95px,0.9fr) minmax(70px,0.7fr) minmax(75px,0.7fr)"
						headers={[
							['Token', 'left'],
							['Chain', 'left'],
							['Currency', 'left'],
							['Launch', 'left'],
							['Ended', 'left'],
							['Raised', 'right'],
							['Committed', 'right'],
							['Bids', 'right'],
							['Bidders', 'right']
						]}
						rows={data.cca.auctions.rows.map((row) => [
							row.token,
							capitalize(row.chain),
							row.currency,
							row.launch,
							row.ended,
							row.raised,
							row.committed,
							formatCompactNumber(row.bids) ?? String(row.bids),
							formatCompactNumber(row.bidders) ?? String(row.bidders)
						])}
					/>
				</ChartCard>
			</section>
		</div>
	)
}
