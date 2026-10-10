import { useMemo } from 'react'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { formatDate } from '~/utils/dateFormat'
import { formatPercentChange } from '~/utils/numberFormat'
import type { RWAOverviewDisplayRow } from '../api.types'
import { RWAFlowValueShimmer, RWAFlowValueUnavailable } from '../FlowPanelParts'
import { useRWAFlowSummary } from '../flows.hooks'
import { RWAListYourAssetsButton } from '../links'
import { getRwaMovers, type RWAMover } from './movers'
import { getRwaNewListings, RWA_NEW_LISTING_WINDOW_DAYS } from './newListings'

export function RWAHighlights({
	assets,
	seriesLatestTimestamp
}: {
	assets: Array<RWAOverviewDisplayRow>
	/** The latest series point, the reference for the 30-day window. */
	seriesLatestTimestamp: number | null
}) {
	const { data: flowSummary, isLoading, isError } = useRWAFlowSummary()
	const movers = useMemo(() => getRwaMovers(assets, flowSummary), [assets, flowSummary])
	const newListings = useMemo(
		() => (seriesLatestTimestamp == null ? [] : getRwaNewListings(assets, seriesLatestTimestamp)),
		[assets, seriesLatestTimestamp]
	)

	return (
		<div className="grid gap-2 md:grid-cols-2">
			<HighlightCard title="Movers 7d" help="Largest net inflows and outflows over the last seven days.">
				{isLoading ? (
					<RWAFlowValueShimmer label="Loading movers" />
				) : isError && !flowSummary ? (
					<RWAFlowValueUnavailable />
				) : movers.inflows.length === 0 && movers.outflows.length === 0 ? (
					<EmptyLine>No measured flows in this selection.</EmptyLine>
				) : (
					<div className="grid gap-x-4 sm:grid-cols-2">
						<MoverList title="Inflows" movers={movers.inflows} />
						<MoverList title="Outflows" movers={movers.outflows} />
					</div>
				)}
			</HighlightCard>
			<HighlightCard
				title="New listings"
				help={`Assets whose first tracked data point is within the last ${RWA_NEW_LISTING_WINDOW_DAYS} days, largest first.`}
				action={<RWAListYourAssetsButton />}
			>
				{seriesLatestTimestamp == null ? (
					<EmptyLine>No series data for this selection.</EmptyLine>
				) : newListings.length === 0 ? (
					<EmptyLine>Nothing new in the last {RWA_NEW_LISTING_WINDOW_DAYS} days.</EmptyLine>
				) : (
					<ul className="flex flex-col gap-1">
						{newListings.map(({ asset, firstSeen }) => (
							<li key={asset.id} className="flex items-baseline justify-between gap-2">
								<BasicLink href={asset.detailHref} className="truncate label-md text-link hover:underline">
									{asset.assetName}
								</BasicLink>
								<span className="shrink-0 label-sm text-secondary">
									{formatDate(firstSeen, { input: 'milliseconds' }) ?? '-'}
								</span>
							</li>
						))}
					</ul>
				)}
			</HighlightCard>
		</div>
	)
}

function HighlightCard({
	title,
	help,
	action,
	children
}: {
	title: string
	help: string
	/** Top right of the card. */
	action?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<Card padding="md" className="flex flex-col gap-2">
			<div className="flex items-start justify-between gap-2">
				<div className="flex flex-col">
					<h2 className="label-md">{title}</h2>
					<span className="body-sm text-tertiary">{help}</span>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</Card>
	)
}

function MoverList({ title, movers }: { title: string; movers: Array<RWAMover> }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="label-xs tracking-wide text-tertiary uppercase">{title}</span>
			{movers.length === 0 ? (
				<EmptyLine>None</EmptyLine>
			) : (
				<ul className="flex flex-col gap-1">
					{movers.map(({ asset, flow, change7d }) => (
						<li key={asset.id} className="flex items-baseline justify-between gap-2">
							<BasicLink href={asset.detailHref} className="truncate label-md text-link hover:underline">
								{asset.assetName}
							</BasicLink>
							<span className="flex shrink-0 items-baseline gap-2">
								<span className="label-md">
									<Change value={flow} unit="usd" />
								</span>
								<span className="label-sm text-secondary">{formatPercentChange(change7d) ?? ''}</span>
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

function EmptyLine({ children }: { children: React.ReactNode }) {
	return <span className="body-sm text-tertiary">{children}</span>
}
