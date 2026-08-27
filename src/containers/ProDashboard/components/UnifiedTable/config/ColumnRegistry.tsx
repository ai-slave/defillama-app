import { type CellContext, type ColumnDef } from '@tanstack/react-table'
import { type ReactNode } from 'react'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { Icon } from '~/ui/Icon'
import { PercentChange } from '~/ui/PercentChange'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import type { MetricGroup } from '../../../unifiedTable/config/columnDictionary'
import { COLUMN_DICTIONARY_BY_ID } from '../../../unifiedTable/config/columnDictionary'
import { FILTERED_SHARE_METRIC_KEYS, getFilteredShareColumnId } from '../../../unifiedTable/config/filteredShareColumns'
import type { CustomColumnDefinition } from '../../../unifiedTable/config/types'
import type { ProtocolTableMetrics } from '../../../unifiedTable/contracts'
import type { ProtocolTableRow } from '../types'
import { createCustomColumnDef, validateCustomColumnOnLoad } from '../utils/customColumns'

const renderDash = () => <span className="text-pro-text-tertiary">-</span>

const renderUsd = (value: number | null | undefined) => {
	if (value == null) {
		return renderDash()
	}
	return (
		<span className="text-pro-text-secondary">
			{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		</span>
	)
}

const renderPercent = (value: number | null | undefined) => {
	if (value == null) {
		return renderDash()
	}
	return (
		<span className="text-pro-text-secondary">
			<PercentChange percent={value} noSign />
		</span>
	)
}

const renderPercentChangeCell = (value: number | null | undefined) => {
	if (value == null) {
		return renderDash()
	}
	return (
		<span className="text-pro-text-secondary">
			<PercentChange percent={value} />
		</span>
	)
}

const renderRatio = (value: number | null | undefined) => {
	if (value == null) {
		return renderDash()
	}
	return <span className="text-pro-text-secondary">{`${formatRatio(value)}x`}</span>
}

type MetricKey = keyof ProtocolTableMetrics
const renderMetricCell = (
	ctx: CellContext<ProtocolTableRow, unknown>,
	key: MetricKey,
	renderer: (value: number | null | undefined) => ReactNode
) => renderer(ctx.row.original.metrics[key])

const metricAccessor =
	(key: MetricKey) =>
	(row: ProtocolTableRow): number | undefined =>
		row.metrics[key] ?? undefined

const buildUsdMetricColumn = (key: MetricKey, header: string): ColumnDef<ProtocolTableRow> => ({
	id: key,
	header,
	accessorFn: metricAccessor(key),
	meta: { align: 'end' },
	cell: (ctx) => renderMetricCell(ctx, key, renderUsd)
})

const buildPercentMetricColumn = (key: MetricKey, header: string): ColumnDef<ProtocolTableRow> => ({
	id: key,
	header,
	accessorFn: metricAccessor(key),
	meta: { align: 'end' },
	cell: (ctx) => renderMetricCell(ctx, key, renderPercent)
})

const buildPercentChangeColumn = (key: MetricKey, header: string): ColumnDef<ProtocolTableRow> => ({
	id: key,
	header,
	accessorFn: metricAccessor(key),
	meta: { align: 'end' },
	cell: (ctx) => renderMetricCell(ctx, key, renderPercentChangeCell)
})

const buildRatioMetricColumn = (key: MetricKey, header: string): ColumnDef<ProtocolTableRow> => ({
	id: key,
	header,
	accessorFn: metricAccessor(key),
	meta: { align: 'end' },
	cell: (ctx) => renderMetricCell(ctx, key, renderRatio)
})

export const getUnifiedTableColumns = ({
	customColumns,
	columnIds,
	earningsAreEstimated
}: {
	customColumns: CustomColumnDefinition[] | undefined
	columnIds: readonly string[]
	earningsAreEstimated: boolean
}): ColumnDef<ProtocolTableRow>[] => {
	const requestedColumnIds = new Set(columnIds)
	requestedColumnIds.add('name')
	const columns: ColumnDef<ProtocolTableRow>[] = [
		{
			id: 'name',
			header: 'Name',
			accessorFn: (row) => row.displayName,
			size: 280,
			meta: {
				align: 'start'
			},
			cell: ({ row }) => {
				const display = row.original
				const depth = row.depth
				const canExpand = row.getCanExpand()
				const isExpanded = row.getIsExpanded()
				const header = display.nodeType === 'group' ? display.header : null
				const groupKind = display.nodeType === 'group' ? display.groupKind : 'protocol'
				const shouldShowChainIcon = header === 'chain'
				const shouldShowProtocolLogo =
					!shouldShowChainIcon &&
					header !== 'category' &&
					(groupKind === 'parent' || header === 'protocol' || header === 'parent-protocol' || header === null)

				return (
					<div
						className="flex items-center gap-2"
						style={{
							paddingLeft: `${depth * 16}px`
						}}
					>
						{canExpand ? (
							<button
								type="button"
								onClick={row.getToggleExpandedHandler()}
								className="rounded-md p-1 transition-colors hover:bg-surface-elevated-2"
							>
								<Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} height={12} width={12} />
							</button>
						) : (
							<span className="w-4" />
						)}
						{header !== 'category' ? (
							shouldShowProtocolLogo || shouldShowChainIcon ? (
								shouldShowChainIcon ? (
									<TokenLogo name={display.displayName} kind="chain" alt={`Logo of ${display.displayName}`} size={24} />
								) : (
									<TokenLogo src={display.logo ?? undefined} alt={`Logo of ${display.displayName}`} size={24} />
								)
							) : (
								<span className="inline-block size-6 shrink-0" />
							)
						) : null}
						<span className="font-medium text-pro-text-primary">{display.displayName}</span>
					</div>
				)
			}
		},
		{
			id: 'category',
			header: 'Category',
			accessorFn: (row) => row.category ?? null,
			enableSorting: false,
			size: 160,
			meta: {
				align: 'start'
			},
			cell: ({ row }) => {
				const category = row.original.category
				if (!category) {
					return renderDash()
				}
				return (
					<BasicLink href={getCategoryRoute(slug(category))} className="text-sm font-medium text-link hover:underline">
						{category}
					</BasicLink>
				)
			}
		},
		{
			id: 'chains',
			header: 'Chains',
			accessorFn: (row) => row.chains,
			enableSorting: false,
			size: 200,
			meta: {
				align: 'end'
			},
			cell: ({ row }) => {
				const chains = row.original.chains
				if (!chains.length) {
					return renderDash()
				}
				return <IconsRow items={toChainIconItems(chains, (chain) => chainHref('/chain', chain))} />
			}
		},
		{
			id: 'oracles',
			header: 'Oracles',
			accessorFn: (row) => row.oracles,
			enableSorting: false,
			size: 200,
			meta: {
				align: 'end'
			},
			cell: ({ row }) => {
				const oracles = row.original.oracles
				if (!oracles.length) {
					return renderDash()
				}
				const visible = oracles.slice(0, 3)
				const extra = oracles.length - visible.length
				return (
					<span className="flex flex-wrap items-center justify-end gap-1">
						{visible.map((oracle) => (
							<BasicLink
								key={oracle}
								href={`/oracles/${slug(oracle)}`}
								className="text-sm font-medium text-link hover:underline"
							>
								{oracle}
							</BasicLink>
						))}
						{extra > 0 ? <Tooltip content={oracles.slice(3).join(', ')}>+{extra}</Tooltip> : null}
					</span>
				)
			}
		},
		buildUsdMetricColumn('tvl', 'TVL'),
		buildPercentChangeColumn('change1d', '1d Change'),
		buildPercentChangeColumn('change7d', '7d Change'),
		buildPercentChangeColumn('change1m', '30d Change'),
		buildPercentChangeColumn('change90d', '90d Change'),
		buildPercentChangeColumn('change180d', '180d Change'),
		buildPercentChangeColumn('change1y', '1y Change'),
		buildPercentChangeColumn('changeYtd', 'YTD Change'),
		buildUsdMetricColumn('stakingTvl', 'Staking TVL'),
		buildUsdMetricColumn('borrowedTvl', 'Borrowed TVL'),
		buildUsdMetricColumn('pool2Tvl', 'Pool2 TVL'),
		buildUsdMetricColumn('treasuryTvl', 'Treasury TVL'),
		buildUsdMetricColumn('vestingTvl', 'Vesting TVL'),
		buildUsdMetricColumn('bridgedTvl', 'Bridged TVL'),
		buildUsdMetricColumn('stablesMcap', 'Stables'),
		buildPercentMetricColumn('tvlShare', 'TVL Share'),
		buildPercentMetricColumn('stablesShare', 'Stables Share'),
		buildUsdMetricColumn('fees24h', '24h Fees'),
		buildUsdMetricColumn('revenue24h', '24h Revenue'),
		buildUsdMetricColumn('volume24h', '24h Volume'),
		buildUsdMetricColumn('perpsVolume24h', '24h Perps Volume'),
		buildUsdMetricColumn('openInterest', 'Open Interest'),
		buildUsdMetricColumn('mcap', 'Market Cap'),
		buildUsdMetricColumn('fdv', 'FDV')
	]

	const volumeColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('volume_7d', '7d Volume'),
		buildUsdMetricColumn('volume_30d', '30d Volume'),
		buildUsdMetricColumn('volume_90d', '90d Volume'),
		buildUsdMetricColumn('volume_1y', '1y Volume'),
		buildUsdMetricColumn('cumulativeVolume', 'Cumulative Volume'),
		buildPercentChangeColumn('volumeChange_1d', '1d Volume Change'),
		buildPercentChangeColumn('volume24hChange7dAgo', '24h Volume vs 7d Ago'),
		buildPercentChangeColumn('volume24hChange30dAgo', '24h Volume vs 30d Ago'),
		buildPercentChangeColumn('volumeChange7dOver7d', '7d over 7d Volume Change'),
		buildPercentChangeColumn('volumeChange30dOver30d', '30d over 30d Volume Change'),
		buildPercentMetricColumn('volumeDominance_24h', '24h Volume Share'),
		buildPercentMetricColumn('volumeMarketShare7d', '7d Volume Share'),
		buildPercentMetricColumn('volume24hShare', '24h Chain Volume Share')
	]

	const feesColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('fees_7d', '7d Fees'),
		buildUsdMetricColumn('fees_30d', '30d Fees'),
		buildUsdMetricColumn('fees_90d', '90d Fees'),
		buildUsdMetricColumn('fees_180d', '180d Fees'),
		buildUsdMetricColumn('fees_1y', '1y Fees'),
		buildUsdMetricColumn('fees_ytd', 'YTD Fees'),
		buildUsdMetricColumn('average_1y', '1y Monthly Avg Fees'),
		buildUsdMetricColumn('cumulativeFees', 'Cumulative Fees'),
		buildUsdMetricColumn('holderRevenue_24h', '24h Holder Revenue'),
		buildUsdMetricColumn('holderRevenue_7d', '7d Holder Revenue'),
		buildUsdMetricColumn('holdersRevenue30d', '30d Holder Revenue'),
		buildUsdMetricColumn('holderRevenue_90d', '90d Holder Revenue'),
		buildUsdMetricColumn('holderRevenue_180d', '180d Holder Revenue'),
		buildUsdMetricColumn('holderRevenue_1y', '1y Holder Revenue'),
		buildUsdMetricColumn('holderRevenue_ytd', 'YTD Holder Revenue'),
		buildUsdMetricColumn('cumulativeHolderRevenue', 'Cumulative Holder Revenue'),
		buildUsdMetricColumn('holderRevenueAnnualized1y', 'Annualized Holder Revenue'),
		buildPercentChangeColumn('holderRevenueChange_1d', '1d Holder Revenue Change'),
		buildPercentChangeColumn('holderRevenueChange7dOver7d', '7d over 7d Holder Revenue Change'),
		buildPercentChangeColumn('holderRevenueChange30dOver30d', '30d over 30d Holder Revenue Change'),
		buildPercentChangeColumn('holderRevenueChange90dOver90d', '90d over 90d Holder Revenue Change'),
		buildPercentChangeColumn('holderRevenueChange180dOver180d', '180d over 180d Holder Revenue Change'),
		buildPercentChangeColumn('holderRevenueChange1yOver1y', '1y over 1y Holder Revenue Change'),
		buildPercentChangeColumn('holderRevenueChangeYtd', 'YTD Holder Revenue Change'),
		buildPercentChangeColumn('feesChange_1d', '1d Fees Change'),
		buildPercentChangeColumn('fees24hChange7dAgo', '24h Fees vs 7d Ago'),
		buildPercentChangeColumn('fees24hChange30dAgo', '24h Fees vs 30d Ago'),
		buildPercentChangeColumn('feesChange7dOver7d', '7d over 7d Fees Change'),
		buildPercentChangeColumn('feesChange30dOver30d', '30d over 30d Fees Change'),
		buildPercentChangeColumn('feesChange90dOver90d', '90d over 90d Fees Change'),
		buildPercentChangeColumn('feesChange180dOver180d', '180d over 180d Fees Change'),
		buildPercentChangeColumn('feesChange1yOver1y', '1y over 1y Fees Change'),
		buildPercentChangeColumn('feesChangeYtd', 'YTD Fees Change')
	]

	const revenueColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('revenue_7d', '7d Revenue'),
		buildUsdMetricColumn('revenue_30d', '30d Revenue'),
		buildUsdMetricColumn('revenue_90d', '90d Revenue'),
		buildUsdMetricColumn('revenue_180d', '180d Revenue'),
		buildUsdMetricColumn('revenue_1y', '1y Revenue'),
		buildUsdMetricColumn('revenue_ytd', 'YTD Revenue'),
		buildUsdMetricColumn('average_revenue_1y', '1y Monthly Avg Revenue'),
		buildUsdMetricColumn('cumulativeRevenue', 'Cumulative Revenue'),
		buildPercentChangeColumn('revenueChange_1d', '1d Revenue Change'),
		buildPercentChangeColumn('revenue24hChange7dAgo', '24h Revenue vs 7d Ago'),
		buildPercentChangeColumn('revenue24hChange30dAgo', '24h Revenue vs 30d Ago'),
		buildPercentChangeColumn('revenueChange7dOver7d', '7d over 7d Revenue Change'),
		buildPercentChangeColumn('revenueChange30dOver30d', '30d over 30d Revenue Change'),
		buildPercentChangeColumn('revenueChange90dOver90d', '90d over 90d Revenue Change'),
		buildPercentChangeColumn('revenueChange180dOver180d', '180d over 180d Revenue Change'),
		buildPercentChangeColumn('revenueChange1yOver1y', '1y over 1y Revenue Change'),
		buildPercentChangeColumn('revenueChangeYtd', 'YTD Revenue Change')
	]

	const earningsColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('earnings24h', earningsAreEstimated ? 'Est. 24h Earnings' : '24h Earnings'),
		buildUsdMetricColumn('earnings7d', earningsAreEstimated ? 'Est. 7d Earnings' : '7d Earnings'),
		buildUsdMetricColumn('earnings30d', earningsAreEstimated ? 'Est. 30d Earnings' : '30d Earnings'),
		buildUsdMetricColumn('earnings1y', earningsAreEstimated ? 'Est. 1y Earnings' : '1y Earnings'),
		buildUsdMetricColumn('emissions24h', '24h Emissions'),
		buildUsdMetricColumn('emissions7d', '7d Emissions'),
		buildUsdMetricColumn('emissions30d', '30d Emissions'),
		buildUsdMetricColumn('emissions90d', '90d Emissions'),
		buildUsdMetricColumn('emissions180d', '180d Emissions'),
		buildUsdMetricColumn('emissions1y', '1y Emissions'),
		buildUsdMetricColumn('emissionsYtd', 'YTD Emissions'),
		buildUsdMetricColumn('cumulativeEmissions', 'Cumulative Emissions'),
		buildUsdMetricColumn('emissionsAnnualized1y', 'Annualized Emissions'),
		buildPercentChangeColumn('emissionsChange1d', '1d Emissions Change'),
		buildPercentChangeColumn('emissionsChange7dOver7d', '7d over 7d Emissions Change'),
		buildPercentChangeColumn('emissionsChange30dOver30d', '30d over 30d Emissions Change')
	]

	const perpsColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('perps_volume_7d', '7d Perps Volume'),
		buildUsdMetricColumn('perps_volume_30d', '30d Perps Volume'),
		buildUsdMetricColumn('perps_volume_90d', '90d Perps Volume'),
		buildUsdMetricColumn('perps_volume_1y', '1y Perps Volume'),
		buildUsdMetricColumn('cumulativePerpsVolume', 'Cumulative Perps Volume'),
		buildPercentChangeColumn('perps_volume_change_1d', '1d Perps Volume Change'),
		buildPercentChangeColumn('perpsVolume24hChange7dAgo', '24h Perps Volume vs 7d Ago'),
		buildPercentChangeColumn('perpsVolume24hChange30dAgo', '24h Perps Volume vs 30d Ago'),
		buildPercentChangeColumn('perpsVolumeChange7dOver7d', '7d over 7d Perps Volume Change'),
		buildPercentChangeColumn('perpsVolumeChange30dOver30d', '30d over 30d Perps Volume Change'),
		buildPercentMetricColumn('perps_volume_dominance_24h', '24h Perps Volume Share')
	]

	const dexAggregatorColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('aggregators_volume_24h', '24h Aggregator Volume'),
		buildUsdMetricColumn('aggregators_volume_7d', '7d Aggregator Volume'),
		buildUsdMetricColumn('aggregators_volume_30d', '30d Aggregator Volume'),
		buildUsdMetricColumn('aggregators_volume_90d', '90d Aggregator Volume'),
		buildUsdMetricColumn('aggregators_volume_1y', '1y Aggregator Volume'),
		buildUsdMetricColumn('cumulativeAggregatorVolume', 'Cumulative Aggregator Volume'),
		buildPercentChangeColumn('aggregators_volume_change_1d', '1d Aggregator Volume Change'),
		buildPercentChangeColumn('aggregatorVolume24hChange7dAgo', '24h Aggregator Volume vs 7d Ago'),
		buildPercentChangeColumn('aggregatorVolume24hChange30dAgo', '24h Aggregator Volume vs 30d Ago'),
		buildPercentChangeColumn('aggregatorVolumeChange7dOver7d', '7d over 7d Aggregator Volume Change'),
		buildPercentChangeColumn('aggregatorVolumeChange30dOver30d', '30d over 30d Aggregator Volume Change'),
		buildPercentMetricColumn('aggregators_volume_dominance_24h', '24h Aggregator Volume Share'),
		buildPercentMetricColumn('aggregators_volume_marketShare7d', '7d Aggregator Volume Share')
	]

	const derivativesAggregatorColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('derivatives_aggregators_volume_24h', '24h Derivatives Aggregator Volume'),
		buildUsdMetricColumn('derivatives_aggregators_volume_7d', '7d Derivatives Aggregator Volume'),
		buildUsdMetricColumn('derivatives_aggregators_volume_30d', '30d Derivatives Aggregator Volume'),
		buildPercentChangeColumn('derivatives_aggregators_volume_change_1d', '1d Derivatives Aggregator Change'),
		buildPercentChangeColumn(
			'derivativesAggregatorVolume24hChange7dAgo',
			'24h Derivatives Aggregator Volume vs 7d Ago'
		),
		buildPercentChangeColumn(
			'derivativesAggregatorVolume24hChange30dAgo',
			'24h Derivatives Aggregator Volume vs 30d Ago'
		),
		buildPercentChangeColumn('derivativesAggregatorVolumeChange7dOver7d', '7d over 7d Derivatives Aggregator Change'),
		buildPercentChangeColumn(
			'derivativesAggregatorVolumeChange30dOver30d',
			'30d over 30d Derivatives Aggregator Change'
		)
	]

	const bridgeAggregatorColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('bridgeAggregatorVolume24h', '24h Bridge Aggregator Volume'),
		buildUsdMetricColumn('bridgeAggregatorVolume7d', '7d Bridge Aggregator Volume'),
		buildUsdMetricColumn('bridgeAggregatorVolume30d', '30d Bridge Aggregator Volume'),
		buildPercentChangeColumn('bridgeAggregatorVolumeChange1d', '1d Bridge Aggregator Volume Change'),
		buildPercentChangeColumn('bridgeAggregatorVolume24hChange7dAgo', '24h Bridge Aggregator Volume vs 7d Ago'),
		buildPercentMetricColumn('bridgeAggregatorVolumeDominance24h', '24h Bridge Aggregator Volume Share')
	]

	const optionsColumns: ColumnDef<ProtocolTableRow>[] = [
		buildUsdMetricColumn('options_volume_24h', '24h Options Volume'),
		buildUsdMetricColumn('options_volume_7d', '7d Options Volume'),
		buildUsdMetricColumn('options_volume_30d', '30d Options Volume'),
		buildUsdMetricColumn('options_volume_90d', '90d Options Volume'),
		buildUsdMetricColumn('options_volume_1y', '1y Options Volume'),
		buildUsdMetricColumn('cumulativeOptionsVolume', 'Cumulative Options Volume'),
		buildUsdMetricColumn('optionsNotionalVolume24h', '24h Options Notional Volume'),
		buildUsdMetricColumn('optionsNotionalVolume7d', '7d Options Notional Volume'),
		buildUsdMetricColumn('optionsNotionalVolume30d', '30d Options Notional Volume'),
		buildPercentChangeColumn('options_volume_change_1d', '1d Options Volume Change'),
		buildPercentChangeColumn('optionsVolume24hChange7dAgo', '24h Options Volume vs 7d Ago'),
		buildPercentChangeColumn('optionsVolume24hChange30dAgo', '24h Options Volume vs 30d Ago'),
		buildPercentChangeColumn('optionsVolumeChange7dOver7d', '7d over 7d Options Volume Change'),
		buildPercentChangeColumn('optionsVolumeChange30dOver30d', '30d over 30d Options Volume Change'),
		buildPercentMetricColumn('options_volume_dominance_24h', '24h Options Volume Share')
	]

	const ratioColumns: ColumnDef<ProtocolTableRow>[] = [
		buildRatioMetricColumn('mcaptvl', 'Mcap / TVL'),
		buildRatioMetricColumn('pf', 'P/F'),
		buildRatioMetricColumn('ps', 'P/S')
	]
	const filteredShareColumns: ColumnDef<ProtocolTableRow>[] = FILTERED_SHARE_METRIC_KEYS.map((metric) => {
		const id = getFilteredShareColumnId(metric)
		return {
			id,
			header: COLUMN_DICTIONARY_BY_ID.get(id)?.header ?? id,
			accessorFn: (row) => row.filteredShares[metric] ?? undefined,
			meta: { align: 'end' },
			cell: ({ row }) => renderPercent(row.original.filteredShares[metric])
		}
	})

	const allMetricColumns = [
		...volumeColumns,
		...feesColumns,
		...revenueColumns,
		...earningsColumns,
		...perpsColumns,
		...dexAggregatorColumns,
		...bridgeAggregatorColumns,
		...derivativesAggregatorColumns,
		...optionsColumns,
		...ratioColumns,
		...filteredShareColumns
	]

	const allColumns = [...columns, ...allMetricColumns]

	const groupLabelMap: Record<MetricGroup, string> = {
		tvl: 'TVL',
		volume: 'Volume',
		fees: 'Fees',
		revenue: 'Revenue',
		earnings: 'Earnings',
		perps: 'Perps',
		aggregators: 'Aggregators',
		'bridge-aggregators': 'Bridge Aggregators',
		'derivatives-aggregators': 'Derivatives Aggregators',
		options: 'Options',
		ratios: 'Ratios'
	}

	const nameColumn = allColumns.find((col) => col.id === 'name')
	const metaColumns = allColumns.filter((col) => {
		const columnId = String(col.id)
		const dictEntry = COLUMN_DICTIONARY_BY_ID.get(columnId)
		return dictEntry?.group === 'meta'
	})

	const columnsByGroup = new Map<MetricGroup, ColumnDef<ProtocolTableRow>[]>()

	for (const col of allColumns) {
		const columnId = String(col.id)
		const dictEntry = COLUMN_DICTIONARY_BY_ID.get(columnId)
		if (!dictEntry || dictEntry.group === 'meta') continue

		const group = dictEntry.group
		const groupColumns = columnsByGroup.get(group)
		if (groupColumns) {
			groupColumns.push(col)
		} else {
			columnsByGroup.set(group, [col])
		}
	}

	const groupedColumns: ColumnDef<ProtocolTableRow>[] = []

	if (nameColumn) {
		groupedColumns.push(nameColumn)
	}

	groupedColumns.push(...metaColumns.filter((column) => requestedColumnIds.has(String(column.id))))

	const groupOrder: MetricGroup[] = [
		'tvl',
		'volume',
		'fees',
		'revenue',
		'earnings',
		'perps',
		'aggregators',
		'bridge-aggregators',
		'derivatives-aggregators',
		'options',
		'ratios'
	]

	for (const groupKey of groupOrder) {
		const groupColumns = columnsByGroup.get(groupKey)
		if (!groupColumns || groupColumns.length === 0) continue

		const supportedColumns = groupColumns.filter((column) => requestedColumnIds.has(String(column.id)))
		if (supportedColumns.length === 0) continue

		groupedColumns.push({
			id: `group_${groupKey}`,
			header: groupLabelMap[groupKey],
			columns: supportedColumns,
			meta: { align: 'center' }
		})
	}

	const validCustomColumns: ColumnDef<ProtocolTableRow>[] = []
	for (const definition of customColumns ?? []) {
		if (!requestedColumnIds.has(definition.id) || !validateCustomColumnOnLoad(definition).isValid) continue
		validCustomColumns.push(createCustomColumnDef({ definition }))
	}

	if (validCustomColumns.length > 0) {
		groupedColumns.push({
			id: 'group_custom',
			header: 'Custom',
			columns: validCustomColumns,
			meta: { align: 'center' }
		})
	}

	return groupedColumns
}
