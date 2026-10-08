import { formatPercent } from '~/utils/numberFormat'
import type { RWAPerpsContractOverlayRow } from '../../api.types'
import { formatRwaMultiple } from '../../kpi/format'
import { perpsDefinitions } from '../../Perps/definitions'
import type { RWAGroupRow, RWATableRow } from '../rows'
import { asCsvOnly, columnHelper, formatTableUsd, numberColumnMeta, textColumnMeta } from './shared'

const d = perpsDefinitions

const GROUP_RATE_NOTE = 'On a venue or group row the value is the open-interest weighted average of its contracts.'

export function getPerpsMarket(row: RWATableRow): RWAPerpsContractOverlayRow | null {
	return row.kind === 'leaf' && row.asset.kind === 'perps' ? row.asset : null
}

/** DEX or CEX belongs to the venue: beside a venue group's name and in the Venue cell, never on a market's name. */
export function VenueTypeTag({ type }: { type: string }) {
	return <span className="shrink-0 rounded-sm border border-medium px-1 label-xs text-secondary">{type}</span>
}

export const venueTypeColumn = columnHelper.accessor(
	(row) => (row.kind === 'group' ? row.distinct.venueType.join(', ') : (getPerpsMarket(row)?.venueType ?? undefined)),
	{
		id: 'venueType',
		header: 'Venue Type',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const types = row.original.kind === 'group' ? row.original.distinct.venueType : getValue() ? [getValue()] : []
			return (
				<span className="flex justify-end gap-1">
					{types.map((type) => (
						<VenueTypeTag key={type} type={type} />
					))}
				</span>
			)
		},
		meta: textColumnMeta('w-[120px]', 'Whether the contract trades on a decentralised or a centralised venue.')
	}
)

type PerpsUsdMetric =
	| 'openInterest'
	| 'volume24h'
	| 'volume7d'
	| 'volume30d'
	| 'volumeAllTime'
	| 'protocolFees24h'
	| 'protocolFees7d'
	| 'protocolFees30d'
	| 'protocolFeesAllTime'
	| 'oraclePrice'
	| 'midPrice'
	| 'previousDayPrice'

/** A USD column; the header may be short ("24h") under its group, so the export takes the definition's label. */
export function createPerpsUsdColumn(
	id: PerpsUsdMetric,
	header: string,
	definition: { label: string; description: string }
) {
	return columnHelper.accessor((row) => row.metrics[id] ?? undefined, {
		id,
		header,
		cell: ({ getValue }) => formatTableUsd(getValue()),
		meta: numberColumnMeta('w-[120px]', definition.description, definition.label)
	})
}

export const maxLeverageColumn = columnHelper.accessor((row) => row.metrics.maxLeverage ?? undefined, {
	id: 'maxLeverage',
	header: 'Max Leverage',
	cell: ({ getValue }) => formatRwaMultiple(getValue(), 2),
	meta: numberColumnMeta('w-[130px]', `${d.maxLeverage.description} A group row leaves it empty.`, d.maxLeverage.label)
})

/** Fee rates sit in hundredths of a percent, so four decimals below one percent. */
function formatFeeRate(value: number | null | undefined): string | null {
	if (value == null || !Number.isFinite(value)) return null
	const digits = Math.abs(value * 100) >= 1 ? 2 : 4
	return formatPercent(value, { input: 'fraction', minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function createPerpsFeeRateColumn(
	id: 'makerFeeRate' | 'takerFeeRate',
	header: string,
	definition: { label: string; description: string }
) {
	return columnHelper.accessor((row) => row.metrics[id] ?? undefined, {
		id,
		header,
		cell: ({ getValue }) => formatFeeRate(getValue()),
		meta: numberColumnMeta('w-[110px]', `${definition.description} ${GROUP_RATE_NOTE}`, definition.label)
	})
}

/** Read from the long side: a positive rate costs a long, so it is red. */
export function longCostTone(value: number | null | undefined): string {
	if (value == null || value === 0) return 'text-primary'
	return value > 0 ? 'text-data-down' : 'text-data-up'
}

function createPerpsCsvColumn(id: string, header: string, pick: (market: RWAPerpsContractOverlayRow) => unknown) {
	return asCsvOnly(
		columnHelper.accessor(
			(row) => {
				const market = getPerpsMarket(row)
				const value = market ? pick(market) : undefined
				return value == null ? undefined : (value as string | number)
			},
			{ id, header }
		)
	)
}

/** A venue group's types (one in practice); empty for any other group, whose rows span venues. */
export function getVenueGroupTypes(group: RWAGroupRow): Array<string> {
	return group.id.startsWith('platform:') && group.children[0]?.asset.kind === 'perps' ? group.distinct.venueType : []
}

/** In every perps export, out of the table: one-value or empty fields, and the row's identity. */
export const perpsCsvColumns = [
	createPerpsCsvColumn('rwaClassification', d.rwaClassification.label, (market) => market.rwaClassification),
	createPerpsCsvColumn('parentPlatform', d.parentPlatform.label, (market) => market.parentPlatform),
	createPerpsCsvColumn('settlementAsset', d.settlementAsset.label, (market) => market.settlementAsset),
	createPerpsCsvColumn('oracleProvider', d.oracleProvider.label, (market) => market.oracleProvider),
	createPerpsCsvColumn('issuer', d.issuer.label, (market) => market.issuer),
	createPerpsCsvColumn('website', d.website.label, (market) => market.website?.join(', ')),
	createPerpsCsvColumn('id', 'ID', (market) => market.id),
	createPerpsCsvColumn('timestamp', 'Timestamp', (market) => market.timestamp)
]
