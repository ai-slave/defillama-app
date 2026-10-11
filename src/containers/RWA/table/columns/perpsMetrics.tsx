import { BasicLink } from '~/components/Link'
import { Change } from '~/ui/Change'
import { Definition } from '~/ui/Tooltip'
import { formatPercent, formatPercentChange } from '~/utils/numberFormat'
import { formatRwaMultiple } from '../../kpi/format'
import { getRwaPerpsTurnover } from '../../kpi/perpsKpi'
import { perpsDefinitions } from '../../Perps/definitions'
import { getRwaPerpsAssetHref } from '../classificationHrefs'
import { formatFundingInterval } from '../grouping'
import type { RWAPerpsChange, RWATableMetrics, RWATableRow } from '../rows'
import { assetTypeColumn, createAccessModelColumn } from './details'
import { createNameColumn } from './name'
import {
	createPerpsFeeRateColumn,
	createPerpsUsdColumn,
	getPerpsMarket,
	maxLeverageColumn,
	venueTypeColumn
} from './perps'
import { venueColumn } from './platform'
import { columnHelper, createDistinctTextColumn, formatTableUsd, numberColumnMeta, textColumnMeta } from './shared'

const d = perpsDefinitions

/** The reference asset; a market's own name is its contract. */
const assetColumn = createDistinctTextColumn({
	id: 'asset',
	header: 'Asset',
	pick: (asset) => (asset.kind === 'perps' ? asset.assetName : null),
	href: getRwaPerpsAssetHref,
	render: (asset) => (
		<BasicLink href={getRwaPerpsAssetHref(asset)} className="truncate text-link hover:underline">
			{asset}
		</BasicLink>
	),
	meta: textColumnMeta('w-[140px]', d.baseAsset.description, d.baseAsset.label)
})

const assetClassColumn = createDistinctTextColumn({
	id: 'assetClass',
	header: 'Asset Class',
	pick: (asset) => (asset.assetClass ?? []).join(', '),
	meta: textColumnMeta('w-[150px]', d.assetClass.description, d.assetClass.label)
})

/** A group's change marks the markets it leaves out; a market shows its own percent. */
function ChangeWithDropsCell({ change, group }: { change: RWAPerpsChange; group: boolean }) {
	if (!group || change.dropped === 0 || change.percent == null) return <Change value={change.percent} />
	const markets = change.dropped === 1 ? '1 market' : `${change.dropped} markets`
	return (
		<Definition
			content={`Leaves out ${markets} that fell to zero in 24h: the value a day before cannot be rebuilt from zero.`}
			className="justify-end"
		>
			<Change value={change.percent} />*
		</Definition>
	)
}

function createChangeColumn(
	id: string,
	header: string,
	pick: (metrics: RWATableMetrics) => RWAPerpsChange,
	definition: { label: string; description: string }
) {
	return columnHelper.accessor((row) => pick(row.metrics).percent ?? undefined, {
		id,
		header,
		cell: ({ row }) => (
			<ChangeWithDropsCell change={pick(row.original.metrics)} group={row.original.kind === 'group'} />
		),
		meta: numberColumnMeta(
			'w-[100px]',
			`${definition.description} Groups compare like for like: contracts without a prior leave both sides, and a group marks the markets that fell to zero.`,
			definition.label
		)
	})
}

/** Volume over open interest: how many times the open book turned over in 30 days. */
const turnoverColumn = columnHelper.accessor(
	(row) => getRwaPerpsTurnover(row.metrics.volume30d, row.metrics.openInterest) ?? undefined,
	{
		id: 'turnover30d',
		header: 'Turnover 30d',
		cell: ({ getValue }) => formatRwaMultiple(getValue(), 1),
		meta: numberColumnMeta(
			'w-[120px]',
			'30 day volume divided by open interest: how many times the open positions turned over.',
			'Turnover 30d (x)'
		)
	}
)

const markPriceColumn = columnHelper.accessor((row) => row.metrics.price ?? undefined, {
	id: 'price',
	header: 'Mark',
	cell: ({ getValue }) => formatTableUsd(getValue()),
	meta: numberColumnMeta('w-[110px]', d.price.description, d.price.label)
})

const priceChange24hColumn = columnHelper.accessor((row) => row.metrics.priceChange24h ?? undefined, {
	id: 'priceChange24h',
	header: '24h',
	cell: ({ getValue }) => <Change value={getValue()} />,
	meta: numberColumnMeta('w-[100px]', d.priceChange24h.description, d.priceChange24h.label)
})

/** Premiums sit in hundredths of a percent, so three decimals. */
function formatPremium(value: number | null): string | null {
	if (value == null) return null
	const formatted = formatPercent(value, { input: 'percent', maximumFractionDigits: 3 })
	return value > 0 ? `+${formatted}` : formatted
}

function PremiumCell({ row }: { row: RWATableRow }) {
	const formatted = formatPremium(row.metrics.premium)
	if (formatted == null) return null
	const detail = d.premium.description
	return (
		<Definition content={detail} className="justify-end">
			{formatted}
		</Definition>
	)
}

const premiumColumn = columnHelper.accessor((row) => row.metrics.premium ?? undefined, {
	id: 'premium',
	header: 'Premium',
	cell: ({ row }) => <PremiumCell row={row.original} />,
	meta: numberColumnMeta(
		'w-[110px]',
		`${d.premium.description} Positive means the perp trades above the underlying. A group row leaves it empty.`,
		'Premium (%)'
	)
})

/** The raw rate per interval: most rates sit far below a hundredth of a percent, so three significant digits. */
export function formatFundingRateDetail(rate: number, intervalHours: number): string {
	const percent = formatPercent(rate, { input: 'fraction', maximumSignificantDigits: 3, signDisplay: 'exceptZero' })
	return `${percent} per ${intervalHours}h, annualized.`
}

function FundingCell({ metrics }: { metrics: RWATableMetrics }) {
	const formatted = formatPercentChange(metrics.fundingApr)
	if (formatted == null || metrics.fundingRate == null || metrics.fundingIntervalHours == null) return null
	const payer = metrics.fundingRate > 0 ? ' Longs pay shorts.' : metrics.fundingRate < 0 ? ' Shorts pay longs.' : ''
	const detail = formatFundingRateDetail(metrics.fundingRate, metrics.fundingIntervalHours) + payer
	return (
		<Definition content={detail} className="justify-end">
			{formatted}
		</Definition>
	)
}

const fundingAprColumn = columnHelper.accessor((row) => row.metrics.fundingApr ?? undefined, {
	id: 'fundingApr',
	header: 'APR',
	cell: ({ row }) => <FundingCell metrics={row.original.metrics} />,
	meta: numberColumnMeta(
		'w-[110px]',
		`${d.fundingRate.description} Shown annualized from the venue's funding interval so 1h and 8h venues compare; the raw rate per interval is in the cell tooltip. A group row leaves it empty.`,
		'Funding rate (annualized %)'
	)
})

const sizeDecimalsColumn = columnHelper.accessor((row) => getPerpsMarket(row)?.sizeDecimals ?? undefined, {
	id: 'sizeDecimals',
	header: 'Size Decimals',
	meta: numberColumnMeta('w-[120px]', d.sizeDecimals.description, d.sizeDecimals.label)
})

const fundingIntervalColumn = createDistinctTextColumn({
	id: 'fundingInterval',
	header: 'Interval',
	pick: (asset) => (asset.kind === 'perps' ? formatFundingInterval(asset.fundingIntervalHours) : null),
	fold: 'single',
	meta: textColumnMeta('w-[100px]', 'How often funding is paid between longs and shorts.', 'Funding Interval')
})

/**
 * The one perps set: the numbers that move daily and, in the picker, how each market is set up. Pair, the price,
 * funding columns show while a group is open (RWA_EXPANDED_COLUMN_IDS). They sit after the groups that fill the first
 * screen, so opening a group never moves a column the reader is looking at: the table only grows to the right.
 */
export const createPerpsColumns = ({ assetLine }: { assetLine: boolean }) => [
	columnHelper.group({
		id: 'market',
		header: 'Market',
		columns: [
			createNameColumn({ assetLine }),
			venueColumn,
			assetColumn,
			// The assets table's Asset Type: asset groups on a group row, the class on a market with its group on hover.
			assetTypeColumn,
			assetClassColumn,
			createDistinctTextColumn({
				id: 'marginAsset',
				header: 'Margin Asset',
				pick: (asset) => (asset.kind === 'perps' ? asset.marginAsset : null),
				meta: textColumnMeta('w-[140px]', d.marginAsset.description, d.marginAsset.label)
			}),
			venueTypeColumn,
			createAccessModelColumn('single')
		]
	}),
	columnHelper.group({
		id: 'openInterestGroup',
		header: 'Open Interest',
		columns: [
			createPerpsUsdColumn('openInterest', 'OI', d.openInterest),
			createChangeColumn('openInterestChange24h', '24h', (m) => m.openInterestChange24h, d.openInterestChange24h)
		]
	}),
	columnHelper.group({
		id: 'volume',
		header: 'Volume',
		columns: [
			createPerpsUsdColumn('volume24h', '24h', d.volume24h),
			createChangeColumn('volume24hChange24h', '24h', (m) => m.volume24hChange24h, d.volume24hChange24h),
			createPerpsUsdColumn('volume7d', '7d', d.volume7d),
			createPerpsUsdColumn('volume30d', '30d', d.volume30d),
			createPerpsUsdColumn('volumeAllTime', 'All-time', d.volumeAllTime),
			turnoverColumn
		]
	}),
	columnHelper.group({
		id: 'pricing',
		header: 'Price',
		columns: [
			createDistinctTextColumn({
				id: 'pair',
				header: 'Pair',
				pick: (asset) => (asset.kind === 'perps' ? asset.pair : null),
				meta: textColumnMeta('w-[140px]', d.pair.description, d.pair.label)
			}),
			markPriceColumn,
			priceChange24hColumn,
			premiumColumn,
			createPerpsUsdColumn('oraclePrice', 'Oracle', d.oraclePrice),
			createPerpsUsdColumn('midPrice', 'Mid', d.midPrice),
			createPerpsUsdColumn('previousDayPrice', 'Previous day', d.previousDayPrice)
		]
	}),
	columnHelper.group({
		id: 'funding',
		header: 'Funding',
		columns: [fundingAprColumn, fundingIntervalColumn, maxLeverageColumn]
	}),
	columnHelper.group({
		id: 'estimatedFees',
		header: 'Est. Fees',
		columns: [
			createPerpsUsdColumn('protocolFees24h', '24h', d.estimatedProtocolFees24h),
			createPerpsUsdColumn('protocolFees30d', '30d', d.estimatedProtocolFees30d),
			createPerpsUsdColumn('protocolFees7d', '7d', d.estimatedProtocolFees7d),
			createPerpsUsdColumn('protocolFeesAllTime', 'All-time', d.estimatedProtocolFeesAllTime)
		]
	}),
	columnHelper.group({
		id: 'contract',
		header: 'Contract',
		columns: [
			createPerpsFeeRateColumn('makerFeeRate', 'Maker Fee', d.makerFeeRate),
			createPerpsFeeRateColumn('takerFeeRate', 'Taker Fee', d.takerFeeRate),
			sizeDecimalsColumn
		]
	})
]
