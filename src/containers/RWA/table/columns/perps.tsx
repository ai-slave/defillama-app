import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatPercentChange } from '~/utils/numberFormat'
import { perpsDefinitions } from '../../Perps/definitions'
import { percentChange } from '../change'
import type { RWATableMetrics, RWATableRow } from '../rows'
import { ChangeCell, columnHelper, formatTableUsd, numberColumnMeta, textColumnMeta } from './shared'

const VENUE_TYPE_TONE: Record<string, string> = { DEX: 'text-data-up', CEX: 'text-data-down' }

function VenueTypeCell({ types }: { types: Array<string> }) {
	if (types.length === 0) return null
	return (
		<span className="truncate">
			{types.map((type, index) => (
				<span key={type} className={VENUE_TYPE_TONE[type] ?? ''}>
					{index > 0 ? ', ' : ''}
					{type}
				</span>
			))}
		</span>
	)
}

/** DEX or CEX; shown only while CEX venues are in the view. */
export const venueColumn = columnHelper.accessor(
	(row) =>
		row.kind === 'group'
			? row.distinct.venueType.join(', ')
			: row.asset.kind === 'perps'
				? row.asset.venueType
				: undefined,
	{
		id: 'venue',
		header: 'Venue Type',
		enableSorting: false,
		cell: ({ row }) => (
			<VenueTypeCell
				types={
					row.original.kind === 'group'
						? row.original.distinct.venueType
						: row.original.asset.kind === 'perps'
							? [row.original.asset.venueType]
							: []
				}
			/>
		),
		meta: textColumnMeta('w-[110px]', 'Whether the contract trades on a decentralised or a centralised venue.')
	}
)

type PerpsUsdMetric = 'openInterest' | 'volume24h' | 'volume7d' | 'volume30d' | 'protocolFees24h'

function createPerpsUsdColumn(id: PerpsUsdMetric, header: string, help: string, csvHeader: string) {
	return columnHelper.accessor((row) => row.metrics[id] ?? undefined, {
		id,
		header,
		cell: ({ getValue }) => formatTableUsd(getValue()),
		meta: numberColumnMeta('w-[140px]', help, csvHeader)
	})
}

const GROUP_RATE_NOTE = 'On a venue or group row the value is the open-interest weighted average of its contracts.'

/** Read from the long side: a positive rate costs a long, so it is red. */
function longCostTone(value: number | null | undefined): string {
	if (value == null || value === 0) return 'text-primary'
	return value > 0 ? 'text-data-down' : 'text-data-up'
}

const openInterestChangeColumn = columnHelper.accessor(
	(row) =>
		percentChange(row.metrics.openInterestChange24h.current, row.metrics.openInterestChange24h.prior) ?? undefined,
	{
		id: 'openInterestChange24h',
		header: 'OI 24h',
		cell: ({ getValue }) => <ChangeCell value={getValue()} />,
		meta: numberColumnMeta(
			'w-[110px]',
			`${perpsDefinitions.openInterestChange24h.description} Groups compare like for like: contracts without a prior leave both sides.`,
			perpsDefinitions.openInterestChange24h.label
		)
	}
)

function formatRatePercent(value: number | null | undefined): string | null {
	return formatPercentChange(value)
}

/** Premiums sit in hundredths of a percent, so three decimals. */
function formatPremium(value: number | null | undefined): string | null {
	if (value == null || !Number.isFinite(value)) return null
	const formatted = formatPercent(value, { input: 'percent', maximumFractionDigits: 3 })
	return value > 0 ? `+${formatted}` : formatted
}

function FundingCell({ metrics }: { metrics: RWATableMetrics }) {
	const formatted = formatRatePercent(metrics.fundingApr)
	if (formatted == null) return null
	const detail =
		metrics.fundingRate != null && metrics.fundingIntervalHours != null
			? `${formatRatePercent(metrics.fundingRate * 100)} per ${metrics.fundingIntervalHours}h, annualised.`
			: GROUP_RATE_NOTE
	return (
		<Tooltip content={detail} className={`justify-end underline decoration-dotted ${longCostTone(metrics.fundingApr)}`}>
			{formatted}
		</Tooltip>
	)
}

const fundingColumn = columnHelper.accessor((row) => row.metrics.fundingApr ?? undefined, {
	id: 'fundingApr',
	header: 'Funding',
	cell: ({ row }) => <FundingCell metrics={row.original.metrics} />,
	meta: numberColumnMeta(
		'w-[120px]',
		`${perpsDefinitions.fundingRate.description} Shown annualised from the venue's funding interval so 1h and 8h venues compare; the raw rate per interval is in the cell tooltip. ${GROUP_RATE_NOTE}`,
		'Funding rate (annualised %)'
	)
})

function PremiumCell({ row }: { row: RWATableRow }) {
	const formatted = formatPremium(row.metrics.premium)
	if (formatted == null) return null
	const detail = row.kind === 'group' ? GROUP_RATE_NOTE : perpsDefinitions.premium.description
	return (
		<Tooltip
			content={detail}
			className={`justify-end underline decoration-dotted ${longCostTone(row.metrics.premium)}`}
		>
			{formatted}
		</Tooltip>
	)
}

const premiumColumn = columnHelper.accessor((row) => row.metrics.premium ?? undefined, {
	id: 'premium',
	header: 'Premium',
	cell: ({ row }) => <PremiumCell row={row.original} />,
	meta: numberColumnMeta(
		'w-[110px]',
		`${perpsDefinitions.premium.description} Positive means the perp trades above the underlying. ${GROUP_RATE_NOTE}`,
		'Premium (%)'
	)
})

const maxLeverageColumn = columnHelper.accessor((row) => row.metrics.maxLeverage ?? undefined, {
	id: 'maxLeverage',
	header: 'Max Leverage',
	cell: ({ getValue }) => (getValue() == null ? null : `${getValue()}x`),
	meta: numberColumnMeta(
		'w-[130px]',
		`${perpsDefinitions.maxLeverage.description} A group shows the highest of its contracts.`,
		perpsDefinitions.maxLeverage.label
	)
})

export const perpsDefaultColumns = [
	createPerpsUsdColumn(
		'openInterest',
		'Open Interest',
		perpsDefinitions.openInterest.description,
		perpsDefinitions.openInterest.label
	),
	createPerpsUsdColumn(
		'volume24h',
		'24h Volume',
		perpsDefinitions.volume24h.description,
		perpsDefinitions.volume24h.label
	),
	createPerpsUsdColumn(
		'volume30d',
		'30d Volume',
		perpsDefinitions.volume30d.description,
		perpsDefinitions.volume30d.label
	),
	fundingColumn,
	premiumColumn
]

export const perpsExtraColumns = [
	openInterestChangeColumn,
	createPerpsUsdColumn('volume7d', '7d Volume', perpsDefinitions.volume7d.description, perpsDefinitions.volume7d.label),
	maxLeverageColumn,
	createPerpsUsdColumn(
		'protocolFees24h',
		'Fees 24h',
		perpsDefinitions.estimatedProtocolFees24h.description,
		perpsDefinitions.estimatedProtocolFees24h.label
	)
]
