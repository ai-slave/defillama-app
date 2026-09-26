import { useEffect } from 'react'
import { BasicLink } from '~/components/Link'
import { SmolStatCard } from '~/ui/SmolStatCard'
import { slug } from '~/utils'
import { getABGroupFromCookie, HOME_CHART_EXPERIMENT_ID } from '~/utils/abTesting'
import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { FeesGeneratedChart } from './FeesGeneratedChart'
import { SmolBarChart } from './SmolBarChart'
import { SmolLineChart } from './SmolLineChart'
import type { IChainOverviewData } from './types'
import { UpcomingUnlocksChart } from './UpcomingUnlocksChart'

const formatCompactUsd = (value: number) =>
	formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

const HOME_CHART_IMPRESSION_KEY = `ab-impression:${HOME_CHART_EXPERIMENT_ID}`

// Keep guarded browser analytics outside the component so React Compiler can compile it.
function trackHomepageImpression(hasHomepageVariantB: boolean) {
	try {
		if (!window.umami || sessionStorage.getItem(HOME_CHART_IMPRESSION_KEY)) return
		const assignedGroup = getABGroupFromCookie(document.cookie)
		if (!assignedGroup) return

		const renderedGroup = assignedGroup === 'b' && hasHomepageVariantB ? 'b' : 'a'
		sessionStorage.setItem(HOME_CHART_IMPRESSION_KEY, renderedGroup)
		trackUmamiEvent('home-chart-impression', {
			experiment: HOME_CHART_EXPERIMENT_ID,
			assignedGroup,
			renderedGroup,
			fallback: assignedGroup !== renderedGroup
		})
	} catch {
		// Analytics must never prevent the homepage from loading.
	}
}

export function SmolStats(props: IChainOverviewData) {
	const chainSlug = slug(props.metadata.name)
	const unlocks = props.unlocks
	const dexs = props.dexs
	const dexsChart = dexs.chart
	const etfs = props.etfs
	const latestEtf = etfs?.at(-1)
	const datInflows = props.datInflows
	const combinedPerpsOpenInterest = props.homepageExperimentMetrics?.combinedPerpsOpenInterest
	const totalRwaActiveMcap = props.homepageExperimentMetrics?.totalRwaActiveMcap
	const hasCombinedPerpsOpenInterest = combinedPerpsOpenInterest != null && combinedPerpsOpenInterest.chart.length > 0
	const hasTotalRwaActiveMcap = totalRwaActiveMcap != null && totalRwaActiveMcap.chart.length > 0
	const hasHomepageVariantB = hasCombinedPerpsOpenInterest && hasTotalRwaActiveMcap
	const feesChart = props.chainFees.topProtocolsChart
	const stablecoins = props.stablecoins
	const stablecoinChart = stablecoins?.mcapChartData
	const stablecoinChangeIsNonNegative = stablecoins != null && Number(stablecoins.change7d) >= 0
	const unlocksTooltip =
		unlocks !== null && unlocks.cliff14d !== null && unlocks.linear14d !== null
			? `Cliff unlocks: ${formatUsd(unlocks.cliff14d)}. Linear releases: ${formatUsd(unlocks.linear14d)}. USD values use prices captured with the unlock snapshot. Events without a known amount or valid snapshot price are excluded.`
			: 'Value of tokens unlocking over the next 14 days. Events without a known amount or valid snapshot price are excluded.'

	useEffect(() => {
		if (!props.homepageExperimentMetrics) return

		const trackImpression = () => trackHomepageImpression(hasHomepageVariantB)

		trackImpression()
		window.addEventListener(UMAMI_READY_EVENT, trackImpression)
		return () => window.removeEventListener(UMAMI_READY_EVENT, trackImpression)
	}, [hasHomepageVariantB, props.homepageExperimentMetrics])

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
							value={formatCompactUsd(unlocks.total14d)}
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
							value={formatCompactUsd(dexs.total24h)}
							qualifier="24h"
						>
							<SmolBarChart series={dexsChart} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</SmolStatCard>
					) : null}
					{etfs && etfs.length > 0 ? (
						<SmolStatCard
							layout="split"
							data-ab-variant={hasHomepageVariantB ? 'a' : undefined}
							title="ETF Inflows"
							tooltip="Daily net inflows/outflows into Bitcoin, Ethereum ETFs, showing institutional investment trends"
							link={
								<BasicLink
									href="/etfs"
									data-umami-event="home-chart-click"
									data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
									data-umami-event-variant="a"
									data-umami-event-slot="top-right"
									data-umami-event-metric="etf-inflows"
								/>
							}
							value={latestEtf ? formatCompactUsd(latestEtf[1]) : null}
							qualifier="24h"
						>
							<SmolBarChart series={etfs} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</SmolStatCard>
					) : null}
					{hasHomepageVariantB && combinedPerpsOpenInterest ? (
						<SmolStatCard
							layout="split"
							data-ab-variant="b"
							title="Combined Perps OI"
							tooltip="Total notional value of all outstanding perpetual futures positions"
							link={
								<BasicLink
									href="/perps"
									data-umami-event="home-chart-click"
									data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
									data-umami-event-variant="b"
									data-umami-event-slot="top-right"
									data-umami-event-metric="perps-oi"
								/>
							}
							value={combinedPerpsOpenInterest.total != null ? formatCompactUsd(combinedPerpsOpenInterest.total) : null}
						>
							<SmolBarChart
								series={combinedPerpsOpenInterest.chart}
								className="my-auto h-[53px] md:h-[132px] xl:h-[53px]"
							/>
						</SmolStatCard>
					) : null}
					{datInflows && datInflows.chart.length > 0 ? (
						<SmolStatCard
							className="max-h-[196px] min-h-[119px]"
							data-ab-variant={hasHomepageVariantB ? 'a' : undefined}
							title="DAT Inflows"
							tooltip="Daily net inflows/outflows into Digital Asset Treasury Companies"
							link={
								<BasicLink
									href="/digital-asset-treasuries"
									data-umami-event="home-chart-click"
									data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
									data-umami-event-variant="a"
									data-umami-event-slot="middle-left"
									data-umami-event-metric="dat-inflows"
								/>
							}
							value={formatCompactUsd(datInflows.total30d)}
							qualifier="30d"
						>
							<SmolBarChart series={datInflows.chart} className="my-auto h-[53px] md:h-[132px]" groupBy="weekly" />
						</SmolStatCard>
					) : null}
					{hasHomepageVariantB && totalRwaActiveMcap ? (
						<SmolStatCard
							className="max-h-[196px] min-h-[119px]"
							data-ab-variant="b"
							title="Total RWA Active AUM"
							tooltip="Sum across RWA assets of the onchain value currently active in their underlying markets"
							link={
								<BasicLink
									href="/rwa"
									data-umami-event="home-chart-click"
									data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
									data-umami-event-variant="b"
									data-umami-event-slot="middle-left"
									data-umami-event-metric="rwa-active-aum"
								/>
							}
							value={formatCompactUsd(totalRwaActiveMcap.total)}
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
					value={formatCompactUsd(dexs.total24h)}
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
					value={props.chainFees.feesGenerated24h != null ? formatCompactUsd(props.chainFees.feesGenerated24h) : null}
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
					value={stablecoins.mcap != null ? formatCompactUsd(stablecoins.mcap) : null}
					change={{
						text: formatPercentChange(stablecoins.change7d),
						tone: stablecoinChangeIsNonNegative ? 'text-data-up' : 'text-data-down',
						comparison: 'over 7d'
					}}
				>
					<SmolLineChart series={stablecoinChart} color={stablecoinChangeIsNonNegative ? 'green' : 'red'} />
				</SmolStatCard>
			) : null}
		</div>
	)
}
