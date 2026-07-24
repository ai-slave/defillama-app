import * as Ariakit from '@ariakit/react'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { tooltipSurfaceStyles } from '~/ui/Popover'
import { formatUsd } from '~/utils/numberFormat'
import { exchangeDefinitions } from './definitions'
import type { ExchangeDirectorySummaryModel, ExchangeVolumeSplit } from './models'

const money = (value: number | null | undefined) =>
	value == null ? '–' : formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })

function VolumeKindSection({ label, tooltip, split }: { label: string; tooltip: string; split: ExchangeVolumeSplit }) {
	const definitions = exchangeDefinitions.summary
	return (
		<MetricSection label={label} tooltip={tooltip} value={money(split.total)}>
			<SubMetricRow label={definitions.spot.label} tooltip={definitions.spot.description} value={money(split.spot)} />
			<SubMetricRow
				label={definitions.linearPerp.label}
				tooltip={definitions.linearPerp.description}
				value={money(split.linearPerp)}
			/>
			<SubMetricRow
				label={definitions.inversePerp.label}
				tooltip={definitions.inversePerp.description}
				value={money(split.inversePerp)}
			/>
		</MetricSection>
	)
}

export function DirectoryHeader({ summary }: { summary: ExchangeDirectorySummaryModel }) {
	const definitions = exchangeDefinitions.summary

	return (
		<Card
			as="section"
			aria-label="Exchange market summary"
			padding="sm"
			className="col-span-1 flex flex-col gap-4 xl:min-h-[360px]"
		>
			<details className="group">
				<Ariakit.TooltipProvider placement="top-start">
					<Ariakit.TooltipAnchor render={<summary className="flex flex-col" />}>
						<span className="text-secondary underline decoration-dotted">{definitions.totalVolume24h.label}</span>
						<span className="flex items-center gap-2">
							<span className="min-h-8 font-jetbrains text-2xl font-semibold">{money(summary.totalVolume24h)}</span>
							<Icon
								name="chevron-down"
								height={16}
								width={16}
								className="relative top-0.5 text-tertiary transition-transform duration-100 group-open:rotate-180"
							/>
						</span>
					</Ariakit.TooltipAnchor>
					<Ariakit.Tooltip className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap`} unmountOnHide portal>
						<div className="p-2">{definitions.totalVolume24h.description}</div>
					</Ariakit.Tooltip>
				</Ariakit.TooltipProvider>
				<div className="my-2 flex flex-col">
					<VolumeKindSection
						label={definitions.cex.label}
						tooltip={definitions.cex.description}
						split={summary.volumeByKind.cex}
					/>
					<VolumeKindSection
						label={definitions.dex.label}
						tooltip={definitions.dex.description}
						split={summary.volumeByKind.dex}
					/>
				</div>
			</details>

			<div className="flex flex-col">
				<MetricRow
					label={definitions.spotVolume24h.label}
					tooltip={definitions.spotVolume24h.description}
					value={money(summary.spotVolume24h)}
				/>
				<MetricRow
					label={definitions.linearPerpVolume24h.label}
					tooltip={definitions.linearPerpVolume24h.description}
					value={money(summary.linearPerpVolume24h)}
				/>
				<MetricRow
					label={definitions.inversePerpVolume24h.label}
					tooltip={definitions.inversePerpVolume24h.description}
					value={money(summary.inversePerpVolume24h)}
				/>
				<MetricRow
					label={definitions.linearPerpOpenInterest.label}
					tooltip={definitions.linearPerpOpenInterest.description}
					value={money(summary.linearPerpOpenInterestUsd)}
				/>
				<MetricRow
					label={definitions.inversePerpOpenInterest.label}
					tooltip={definitions.inversePerpOpenInterest.description}
					value={money(summary.inversePerpOpenInterestUsd)}
				/>
				<MetricRow
					label={definitions.reserves.label}
					tooltip={definitions.reserves.description}
					value={money(summary.reservesUsd)}
				/>
				<MetricRow
					label={definitions.venues.label}
					tooltip={definitions.venues.description}
					value={`${summary.trackedVenueCount} tracked · ${summary.venueCount} listed`}
				/>
			</div>
		</Card>
	)
}
