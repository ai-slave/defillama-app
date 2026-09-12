import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { Watermark } from '~/ui/Watermark'
import { slug } from '~/utils'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'
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
	const datInflows = props.datInflows
	const feesChart = props.chainFees.topProtocolsChart
	const stablecoins = props.stablecoins
	const stablecoinChart = stablecoins?.mcapChartData
	const stablecoinChangeIsNonNegative = stablecoins != null && Number(stablecoins.change7d) >= 0
	const unlocksTooltip =
		unlocks !== null && unlocks.cliff14d !== null && unlocks.linear14d !== null
			? `Cliff unlocks: ${formatUsd(unlocks.cliff14d)}. Linear releases: ${formatUsd(unlocks.linear14d)}. USD values use prices captured with the unlock snapshot. Events without a known amount or valid snapshot price are excluded.`
			: 'Value of tokens unlocking over the next 14 days. Events without a known amount or valid snapshot price are excluded.'

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
						>
							<div className="flex flex-col gap-1">
								<Tooltip
									render={<BasicLink href="/etfs" />}
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
					{datInflows && datInflows.chart.length > 0 ? (
						<Card padding="sm" className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1">
							<div className="flex items-center justify-between gap-2">
								<Tooltip
									render={<BasicLink href="/digital-asset-treasuries" />}
									className="text-sm font-semibold"
									content="Daily net inflows/outflows into Digital Asset Treasury Companies"
								>
									DAT Inflows
								</Tooltip>
								<Watermark className="shrink-0" />
							</div>
							{datInflows.chart.length > 0 ? (
								<p className="truncate text-secondary">
									{formatUsd(datInflows.total30d, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}{' '}
									<span className="text-tertiary">30d</span>
								</p>
							) : null}
							<SmolBarChart series={datInflows.chart} className="my-auto h-[53px] md:h-[132px]" groupBy="weekly" />
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
