import { chartColors, OTHERS_COLOR } from '~/constants/colors'
import { Hovercard } from '~/ui/Hovercard'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { formatRwaKpiUsd, formatRwaMultiple } from '../../kpi/format'
import { PanelCard, Pill } from '../../PlatformPage/panels/PanelParts'
import type { RwaVenueMarketsSummary, RwaVenueOracleProviders } from '../venueData'

/** The group bars in the series colors by rank, largest first; groups past these are Others gray. */
const GROUP_BAR_COLORS = chartColors(5)
const ROW_CLASS =
	'flex min-h-6 flex-wrap items-center justify-start gap-x-2 gap-y-1 border-b border-dashed border-subtle py-1 last:border-none'
const SHARE_ROW_CLASS = ROW_CLASS.replace('flex-wrap', 'flex-nowrap')

/** One label and value line; figures are bold mono. */
function MarketsRow({ label, mono = false, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
	return (
		<div className={ROW_CLASS}>
			<span className="body-md text-secondary">{label}</span>
			<span className={`ml-auto text-right ${mono ? 'mono-md-bold' : 'label-md'}`}>{children}</span>
		</div>
	)
}

/** An asset group with its share of the venue's open interest as a colored bar between the name and the value. */
function ShareRow({ label, share, value, color }: { label: string; share: number; value: number; color?: string }) {
	return (
		<div className={SHARE_ROW_CLASS}>
			{/* One line per group: a long name truncates and keeps the bar beside it. */}
			<Tooltip content={label} render={<span className="min-w-0 truncate body-md text-secondary" />}>
				{label}
			</Tooltip>
			<span className="ml-auto flex shrink-0 items-center gap-3">
				<span className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-elevated-1">
					<span
						className="block h-full rounded-full"
						style={{ width: `${share}%`, backgroundColor: color ?? OTHERS_COLOR }}
					/>
				</span>
				<span className="min-w-20 text-right mono-md-bold">{formatRwaKpiUsd(value)}</span>
			</span>
		</div>
	)
}

/** One chip per value; the panel's lists are never a joined run. */
function Chips({ values }: { values: ReadonlyArray<string> }) {
	return (
		<span className="flex flex-wrap items-center gap-1">
			{values.map((value) => (
				<Tag key={value}>{value}</Tag>
			))}
		</span>
	)
}

/** The two most used providers and "+N more"; when the names shorten anything, every methodology opens on hover. */
function OracleProviders({ providers }: { providers: RwaVenueOracleProviders }) {
	const names = (
		<span className="flex flex-wrap items-center gap-1">
			<Chips values={providers.shown} />
			{providers.more > 0 ? <span className="text-tertiary">{`+${providers.more} more`}</span> : null}
		</span>
	)
	if (
		providers.full.length === providers.shown.length &&
		providers.full.every((name, i) => name === providers.shown[i])
	) {
		return names
	}
	return (
		<Hovercard
			className="cursor-help"
			content={
				<ul className="flex max-w-80 flex-col gap-1 body-sm">
					{providers.full.map((methodology) => (
						<li key={methodology}>{methodology}</li>
					))}
				</ul>
			}
		>
			{names}
		</Hovercard>
	)
}

/** What the venue lists, in the Compliance panel's place: where its open interest sits, the asset classes and the
    contract terms its markets share. Always rendered: a venue page exists only with markets. */
export function VenueMarketsPanel({ summary }: { summary: RwaVenueMarketsSummary }) {
	const { openInterestByAssetGroup, assetClasses, maxLeverage } = summary
	const lowestLeverage = maxLeverage ? formatRwaMultiple(maxLeverage.min, 2) : null
	const highestLeverage = maxLeverage ? formatRwaMultiple(maxLeverage.max, 2) : null
	return (
		<PanelCard title="Markets">
			<div className="flex flex-col">
				<h3 className="mb-1 label-md text-secondary">Open Interest by asset group</h3>
				{openInterestByAssetGroup.shown.map((entry, index) => (
					<ShareRow
						key={entry.name}
						label={entry.name}
						share={entry.share}
						value={entry.value}
						color={GROUP_BAR_COLORS[index]}
					/>
				))}
				{openInterestByAssetGroup.others ? (
					<ShareRow
						label={`Others (${openInterestByAssetGroup.others.count})`}
						share={openInterestByAssetGroup.others.share}
						value={openInterestByAssetGroup.others.value}
					/>
				) : null}
			</div>
			{assetClasses.length > 0 ? (
				<div className="flex flex-col gap-1.5">
					<h3 className="label-md text-secondary">Asset classes</h3>
					<div className="flex flex-wrap gap-1.5">
						{assetClasses.map((entry) => (
							<Pill key={entry.name}>{`${entry.name} ${entry.count}`}</Pill>
						))}
					</div>
				</div>
			) : null}
			<div className="flex flex-col">
				{summary.marginAssets.length > 0 ? (
					<MarketsRow label="Margin Assets">
						<Chips values={summary.marginAssets} />
					</MarketsRow>
				) : null}
				{summary.oracleProviders.shown.length > 0 ? (
					<MarketsRow label="Oracle Providers">
						<OracleProviders providers={summary.oracleProviders} />
					</MarketsRow>
				) : null}
				{highestLeverage ? (
					<MarketsRow label="Max Leverage" mono>
						{lowestLeverage === highestLeverage ? highestLeverage : `${lowestLeverage} to ${highestLeverage}`}
					</MarketsRow>
				) : null}
				{summary.fundingIntervalHours.length > 0 ? (
					<MarketsRow label="Funding Interval">
						<Chips values={summary.fundingIntervalHours.map((hours) => `${hours}h`)} />
					</MarketsRow>
				) : null}
				{summary.accessModels.length > 0 ? (
					<MarketsRow label="Access Model">
						<Chips values={summary.accessModels} />
					</MarketsRow>
				) : null}
			</div>
		</PanelCard>
	)
}
