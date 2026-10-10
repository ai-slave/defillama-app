import { BasicLink } from '~/components/Link'
import { SmolStatCard } from '~/ui/SmolStatCard'
import { slug } from '~/utils'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { FeesGeneratedChart } from './FeesGeneratedChart'
import { SmolBarChart } from './SmolBarChart'
import { SmolLineChart } from './SmolLineChart'
import type { IChainOverviewData } from './types'
import { UpcomingUnlocksChart } from './UpcomingUnlocksChart'

export function SmolStats(props: IChainOverviewData) {
	const chainSlug = slug(props.metadata.name)
	const unlocks = props.unlocks
	const dexs = props.dexs
	const dexsChart = dexs.chart
	const etfs = props.etfs
	const latestEtf = etfs?.at(-1)
	const totalRwaActiveMcap = props.totalRwaActiveMcap
	const feesChart = props.chainFees.topProtocolsChart
	const stablecoins = props.stablecoins
	const stablecoinChart = stablecoins?.mcapChartData
	const stablecoinChangeIsNonNegative = stablecoins != null && (stablecoins.change7d ?? 0) >= 0
	const unlocksTooltip =
		unlocks !== null && unlocks.cliff14d !== null && unlocks.linear14d !== null
			? `Cliff unlocks: ${formatUsd(unlocks.cliff14d)}. Linear releases: ${formatUsd(unlocks.linear14d)}. USD values use prices captured with the unlock snapshot. Events without a known amount or valid snapshot price are excluded.`
			: 'Value of tokens unlocking over the next 14 days. Events without a known amount or valid snapshot price are excluded.'

	return (
		<div className="isolate grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
			{props.chain === 'All' ? (
				<>
					{unlocks && unlocks.chart.length > 0 ? (
						<SmolStatCard
							layout="split"
							title="Upcoming Unlocks"
							tooltip={unlocksTooltip}
							link={<BasicLink href="/unlocks" />}
							value={formatUsd(unlocks.total14d, USD_LOWERCASE_MILLIONS_OPTIONS)}
							qualifier="next 14 days"
						>
							<UpcomingUnlocksChart data={unlocks.chart} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</SmolStatCard>
					) : null}
					{dexsChart && dexsChart.length > 0 ? (
						<SmolStatCard
							layout="split"
							title="DEXs Volume"
							tooltip="Total value of all spot trades executed on decentralized exchanges"
							link={<BasicLink href="/dexs" />}
							value={formatUsd(dexs.total24h, USD_LOWERCASE_MILLIONS_OPTIONS)}
							qualifier="24h"
						>
							<SmolBarChart series={dexsChart} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</SmolStatCard>
					) : null}
					{etfs && etfs.length > 0 ? (
						<SmolStatCard
							layout="split"
							title="ETF Inflows"
							tooltip="Daily net inflows/outflows into Bitcoin, Ethereum ETFs, showing institutional investment trends"
							link={
								<BasicLink
									href="/etfs"
									data-umami-event="home-chart-click"
									data-umami-event-slot="top-right"
									data-umami-event-metric="etf-inflows"
								/>
							}
							value={latestEtf ? formatUsd(latestEtf[1], USD_LOWERCASE_MILLIONS_OPTIONS) : null}
							qualifier="24h"
						>
							<SmolBarChart series={etfs} signed className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</SmolStatCard>
					) : null}
					{totalRwaActiveMcap && totalRwaActiveMcap.chart.length > 0 ? (
						<SmolStatCard
							className="max-h-[196px] min-h-[119px]"
							title="Total RWA Active AUM"
							tooltip="Sum across RWA assets of the onchain value currently active in their underlying markets"
							link={
								<BasicLink
									href="/rwa"
									data-umami-event="home-chart-click"
									data-umami-event-slot="middle-left"
									data-umami-event-metric="rwa-active-aum"
								/>
							}
							value={formatUsd(totalRwaActiveMcap.total, USD_LOWERCASE_MILLIONS_OPTIONS)}
						>
							<SmolLineChart series={totalRwaActiveMcap.chart} color="blue" className="my-auto h-[53px] md:h-[132px]" />
						</SmolStatCard>
					) : null}
				</>
			) : dexsChart && dexsChart.length > 0 ? (
				<SmolStatCard
					className="h-[196px]"
					title="DEXs Volume"
					tooltip={`Total value of all spot trades executed on decentralized exchanges${
						props.metadata.name === 'All' ? '' : ` deployed on ${props.metadata.name}`
					}`}
					link={<BasicLink href={props.metadata.name === 'All' ? '/dexs' : `/dexs/chain/${chainSlug}`} />}
					value={formatUsd(dexs.total24h, USD_LOWERCASE_MILLIONS_OPTIONS)}
					qualifier="24h"
				>
					<SmolBarChart series={dexsChart} />
				</SmolStatCard>
			) : null}
			{feesChart && feesChart.length > 0 ? (
				<SmolStatCard
					className="h-[196px]"
					title="Fees Paid"
					tooltip={`Total fees paid by protocols on ${props.metadata.name === 'All' ? 'all chains' : props.metadata.name}`}
					link={<BasicLink href={props.metadata.name === 'All' ? '/fees' : `/fees/chain/${chainSlug}`} />}
					value={
						props.chainFees.feesGenerated24h != null
							? formatUsd(props.chainFees.feesGenerated24h, USD_LOWERCASE_MILLIONS_OPTIONS)
							: null
					}
					qualifier="24h"
				>
					<FeesGeneratedChart series={feesChart} />
				</SmolStatCard>
			) : null}
			{stablecoins && stablecoinChart && stablecoinChart.length > 0 ? (
				<SmolStatCard
					className="h-[196px]"
					title="Stablecoins Market Cap"
					tooltip={`Total market cap of all stablecoins issued on ${
						props.metadata.name === 'All' ? 'all chains' : props.metadata.name
					}`}
					link={<BasicLink href={props.metadata.name === 'All' ? '/stablecoins' : `/stablecoins/${chainSlug}`} />}
					value={stablecoins.mcap != null ? formatUsd(stablecoins.mcap, USD_LOWERCASE_MILLIONS_OPTIONS) : null}
					change={stablecoins.change7d != null ? { value: stablecoins.change7d, comparison: 'over 7d' } : undefined}
				>
					<SmolLineChart series={stablecoinChart} color={stablecoinChangeIsNonNegative ? 'green' : 'red'} />
				</SmolStatCard>
			) : null}
		</div>
	)
}
