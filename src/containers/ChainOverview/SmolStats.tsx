import { useEffect } from 'react'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { Watermark } from '~/ui/Watermark'
import { slug } from '~/utils'
import { getABGroupFromCookie, HOME_CHART_EXPERIMENT_ID } from '~/utils/abTesting'
import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { FeesGeneratedChart } from './FeesGeneratedChart'
import { SmolBarChart } from './SmolBarChart'
import { SmolLineChart } from './SmolLineChart'
import type { IChainOverviewData } from './types'
import { UpcomingUnlocksChart } from './UpcomingUnlocksChart'

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
						<Card
							padding="sm"
							className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1 xl:min-h-[71px] xl:flex-row xl:flex-nowrap xl:gap-2 xl:*:last:flex-1"
						>
							<div className="flex flex-col gap-1">
								<Tooltip
									render={<BasicLink href="/unlocks" />}
									className="text-sm font-semibold"
									content={unlocksTooltip}
								>
									Upcoming Unlocks
								</Tooltip>
								{unlocks.chart.length > 0 ? (
									<p className="truncate text-secondary">
										{formatUsd(unlocks.total14d, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}{' '}
										<span className="text-tertiary">over 14 days</span>
									</p>
								) : null}
							</div>
							<UpcomingUnlocksChart data={unlocks.chart} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</Card>
					) : null}
					{dexsChart && dexsChart.length > 0 ? (
						<Card
							padding="sm"
							className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1 xl:min-h-[71px] xl:flex-row xl:flex-nowrap xl:gap-2 xl:*:last:flex-1"
						>
							<div className="flex flex-col gap-1">
								<Tooltip
									render={<BasicLink href={props.metadata.name === 'All' ? '/dexs' : `/dexs/chain/${chainSlug}`} />}
									className="text-sm font-semibold"
									content="Total value of all spot trades executed on decentralized exchanges"
								>
									DEXs Volume
								</Tooltip>
								{dexsChart.length > 0 ? (
									<p className="truncate text-secondary">
										{formatUsd(dexs.total24h, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}{' '}
										<span className="text-tertiary">24h</span>
									</p>
								) : null}
							</div>
							<SmolBarChart series={dexsChart} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</Card>
					) : null}
					{etfs && etfs.length > 0 ? (
						<Card
							padding="sm"
							className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1 xl:min-h-[71px] xl:flex-row xl:flex-nowrap xl:gap-2 xl:*:last:flex-1"
							data-ab-variant={hasHomepageVariantB ? 'a' : undefined}
						>
							<div className="flex flex-col gap-1">
								<Tooltip
									render={
										<BasicLink
											href="/etfs"
											data-umami-event="home-chart-click"
											data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
											data-umami-event-variant="a"
											data-umami-event-slot="top-right"
											data-umami-event-metric="etf-inflows"
										/>
									}
									className="text-sm font-semibold"
									content="Daily net inflows/outflows into Bitcoin, Ethereum ETFs, showing institutional investment trends"
								>
									ETF Inflows
								</Tooltip>
								{latestEtf ? (
									<p className="truncate text-secondary">
										{formatUsd(latestEtf[1], {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}{' '}
										<span className="text-tertiary">24h</span>
									</p>
								) : null}
							</div>
							<SmolBarChart series={etfs} className="my-auto h-[53px] md:h-[132px] xl:h-[53px]" />
						</Card>
					) : null}
					{hasHomepageVariantB && combinedPerpsOpenInterest ? (
						<Card
							padding="sm"
							className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1 xl:min-h-[71px] xl:flex-row xl:flex-nowrap xl:gap-2 xl:*:last:flex-1"
							data-ab-variant="b"
						>
							<div className="flex flex-col gap-1">
								<Tooltip
									render={
										<BasicLink
											href="/perps"
											data-umami-event="home-chart-click"
											data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
											data-umami-event-variant="b"
											data-umami-event-slot="top-right"
											data-umami-event-metric="perps-oi"
										/>
									}
									className="text-sm font-semibold"
									content="Total notional value of all outstanding perpetual futures positions"
								>
									Combined Perps OI
								</Tooltip>
								{combinedPerpsOpenInterest.total != null ? (
									<p className="truncate text-secondary">
										{formatUsd(combinedPerpsOpenInterest.total, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
									</p>
								) : null}
							</div>
							<SmolBarChart
								series={combinedPerpsOpenInterest.chart}
								className="my-auto h-[53px] md:h-[132px] xl:h-[53px]"
							/>
						</Card>
					) : null}
					{datInflows && datInflows.chart.length > 0 ? (
						<Card
							padding="sm"
							className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1"
							data-ab-variant={hasHomepageVariantB ? 'a' : undefined}
						>
							<div className="flex items-center justify-between gap-2">
								<Tooltip
									render={
										<BasicLink
											href="/digital-asset-treasuries"
											data-umami-event="home-chart-click"
											data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
											data-umami-event-variant="a"
											data-umami-event-slot="middle-left"
											data-umami-event-metric="dat-inflows"
										/>
									}
									className="text-sm font-semibold"
									content="Daily net inflows/outflows into Digital Asset Treasury Companies"
								>
									DAT Inflows
								</Tooltip>
								<Watermark className="shrink-0" />
							</div>
							<p className="truncate text-secondary">
								{formatUsd(datInflows.total30d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}{' '}
								<span className="text-tertiary">30d</span>
							</p>
							<SmolBarChart series={datInflows.chart} className="my-auto h-[53px] md:h-[132px]" groupBy="weekly" />
						</Card>
					) : null}
					{hasHomepageVariantB && totalRwaActiveMcap ? (
						<Card
							padding="sm"
							className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1"
							data-ab-variant="b"
						>
							<div className="flex items-center justify-between gap-2">
								<Tooltip
									render={
										<BasicLink
											href="/rwa"
											data-umami-event="home-chart-click"
											data-umami-event-experiment={HOME_CHART_EXPERIMENT_ID}
											data-umami-event-variant="b"
											data-umami-event-slot="middle-left"
											data-umami-event-metric="rwa-active-aum"
										/>
									}
									className="text-sm font-semibold"
									content="Sum across RWA assets of the onchain value currently active in their underlying markets"
								>
									Total RWA Active AUM
								</Tooltip>
								<Watermark className="shrink-0" />
							</div>
							<p className="truncate text-secondary">
								{formatUsd(totalRwaActiveMcap.total, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</p>
							<SmolLineChart series={totalRwaActiveMcap.chart} color="blue" className="my-auto h-[53px] md:h-[132px]" />
						</Card>
					) : null}
				</>
			) : dexsChart && dexsChart.length > 0 ? (
				<Card padding="sm" className="col-span-1 flex h-[196px] flex-col gap-1">
					<div className="flex items-center justify-between gap-2">
						<Tooltip
							render={<BasicLink href={props.metadata.name === 'All' ? '/dexs' : `/dexs/chain/${chainSlug}`} />}
							className="text-sm font-semibold"
							content={`Total value of all spot trades executed on decentralized exchanges${
								props.metadata.name === 'All' ? '' : ` deployed on ${props.metadata.name}`
							}`}
						>
							DEXs Volume
						</Tooltip>
						<Watermark className="shrink-0" />
					</div>
					{dexsChart.length > 0 ? (
						<p className="truncate text-secondary">
							{formatUsd(dexs.total24h, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}{' '}
							<span className="text-tertiary">24h</span>
						</p>
					) : null}
					<SmolBarChart series={dexsChart} />
				</Card>
			) : null}
			{feesChart && feesChart.length > 0 ? (
				<Card padding="sm" className="col-span-1 flex h-[196px] flex-col gap-1">
					<div className="flex items-center justify-between gap-2">
						<Tooltip
							render={<BasicLink href={props.metadata.name === 'All' ? '/fees' : `/fees/chain/${chainSlug}`} />}
							className="text-sm font-semibold"
							content={`Total fees paid by protocols on ${
								props.metadata.name === 'All' ? 'all chains' : props.metadata.name
							}`}
						>
							Fees Paid
						</Tooltip>
						<Watermark className="shrink-0" />
					</div>
					{props.chainFees.feesGenerated24h != null ? (
						<p className="text-secondary">
							{formatUsd(props.chainFees.feesGenerated24h, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}{' '}
							<span className="text-tertiary">24h</span>
						</p>
					) : null}
					<FeesGeneratedChart series={feesChart} />
				</Card>
			) : null}
			{stablecoins && stablecoinChart && stablecoinChart.length > 0 ? (
				<Card padding="sm" className="col-span-1 flex h-[196px] flex-col gap-1">
					<div className="flex items-center justify-between gap-2">
						<Tooltip
							placement="top-start"
							render={<BasicLink href={props.metadata.name === 'All' ? '/stablecoins' : `/stablecoins/${chainSlug}`} />}
							className="text-sm font-semibold"
							content={`Total market cap of all stablecoins issued on ${
								props.metadata.name === 'All' ? 'all chains' : props.metadata.name
							}`}
						>
							Stablecoins Market Cap
						</Tooltip>
						<Watermark className="shrink-0" />
					</div>
					{stablecoins.mcap != null ? (
						<>
							<p className="truncate text-secondary">
								{formatUsd(stablecoins.mcap, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</p>
							<p className="flex items-center gap-1 text-xs">
								<span className={`truncate ${stablecoinChangeIsNonNegative ? 'text-data-up' : 'text-data-down'}`}>
									{formatPercentChange(stablecoins.change7d)}
								</span>
								<span className="text-tertiary">7d</span>
							</p>
						</>
					) : null}
					<SmolLineChart series={stablecoinChart} color={stablecoinChangeIsNonNegative ? 'green' : 'red'} />
				</Card>
			) : null}
		</div>
	)
}
