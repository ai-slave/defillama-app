import * as Ariakit from '@ariakit/react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { createColumnHelper, type VisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { buildTreemapCsvDataset } from '~/components/ECharts/TreemapChart/csv'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { selectTriggerStyles } from '~/components/Select/types'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { CHART_COLORS } from '~/constants/colors'
import {
	limitRwaHorizontalBarData,
	toRwaMultiSeriesChartDataset,
	type RWAChartDataset
} from '~/containers/RWA/chartDataset'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { RWASuspiciousWarning } from '~/containers/RWA/SuspiciousWarning'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Checkbox } from '~/ui/Checkbox'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingDots } from '~/ui/Loaders'
import { PercentChange } from '~/ui/PercentChange'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import {
	isTrueQueryParam,
	parseArrayParam,
	parseExcludeParam,
	pushShallowQuery,
	toNonEmptyArrayParam
} from '~/utils/routerQuery'
import { setRWAPerpsChartScope } from './api'
import type { IRWAPerpsMarket } from './api.types'
import { getRWAPerpsAssetGroupBreakdownLabel, getRWAPerpsBaseAssetBreakdownLabel } from './breakdownLabels'
import {
	getDefaultRWAPerpsChartBreakdown,
	getRWAPerpsBreakdownLabel,
	getRWAPerpsChartBreakdownOptions,
	getRWAPerpsChartBreakdownQueryValue,
	getRWAPerpsChartMetricLabel,
	getRWAPerpsChartMetricOptions,
	getRWAPerpsTimeSeriesModeQueryValue,
	getRWAPerpsChartMetricQueryValue,
	getRWAPerpsVolumeGroupByQueryValue,
	getRWAPerpsTreemapNestedByLabel,
	getRWAPerpsTreemapNestedByOptions,
	getRWAPerpsTreemapNestedByQueryValue,
	getRWAPerpsChartViewOptions,
	getRWAPerpsChartViewQueryValueForMode,
	parseRWAPerpsChartState,
	parseRWAPerpsVolumeGroupBy,
	setRWAPerpsChartBreakdown,
	setRWAPerpsTimeSeriesMode,
	setRWAPerpsTreemapNestedBy,
	setRWAPerpsChartView
} from './chartState'
import type { RWAPerpsChartDefaults } from './chartState'
import {
	buildRWAPerpsTimeSeriesCharts,
	buildRWAPerpsTimeSeriesDatasetForRows,
	getRWAPerpsIncludedRows
} from './dashboardData'
import { perpsDefinitions as d } from './definitions'
import {
	buildRWAPerpsAssetGroupSnapshotBreakdownTotals,
	buildRWAPerpsAssetSnapshotBreakdownTotals,
	buildRWAPerpsOverviewSnapshotBreakdownTotals,
	buildRWAPerpsVenueSnapshotBreakdownTotals,
	appendRWAPerpsTimeSeriesDatasetTotal,
	getAggregateOpenInterestChange24h,
	getAggregateVolume24hChange24h,
	groupRWAPerpsTimeSeriesDataset,
	hasEnoughTimeSeriesHistory,
	sumMarketMetric,
	sumProtocolFees24h
} from './queries'
import { buildRWAPerpsTreemapTreeData } from './treemap'
import type {
	IRWAPerpsAssetGroupPageData,
	IRWAPerpsAssetPageData,
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	IRWAPerpsOverviewBreakdownRequest,
	IRWAPerpsOverviewPageData,
	IRWAPerpsVenuePageData,
	RWAPerpsAssetGroupTimeSeriesBreakdown,
	RWAPerpsAssetTimeSeriesBreakdown,
	RWAPerpsMarketBreakdownTarget,
	RWAPerpsOverviewTimeSeriesBreakdown,
	RWAPerpsVenueTimeSeriesBreakdown
} from './types'

const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const EMPTY_DATASET: RWAChartDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_SNAPSHOT_BREAKDOWN_ROWS: Array<{ name: string; value: number }> = []
const PIE_CHART_RADIUS = ['50%', '70%'] as [string, string]
const FOREX_ASSET_CLASS = 'Forex Perps'
const UNKNOWN_FILTER_VALUE = 'Unknown'

type RWAPerpsMarketFilterKey =
	| 'venue'
	| 'baseAsset'
	| 'assetGroup'
	| 'assetClass'
	| 'category'
	| 'oracleProvider'
	| 'accessModel'
	| 'issuer'
	| 'rwaClassification'

type RWAPerpsMarketFilterDefinition = {
	id: RWAPerpsMarketFilterKey
	label: string
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
	getValues: (market: IRWAPerpsMarket) => Array<string>
	hideWhenHardScoped?: boolean
}

type RWAPerpsMarketFilterState = RWAPerpsMarketFilterDefinition & {
	options: Array<string>
	selectedValues: Array<string>
	selectedValuesSet: ReadonlySet<string>
	active: boolean
	enabled: boolean
}

type RWAPerpsTimeSeriesRequest =
	| ({ source: 'market-breakdown' } & IRWAPerpsMarketBreakdownRequest)
	| ({ source: 'contract-breakdown' } & IRWAPerpsContractBreakdownRequest)
	| ({ source: 'overview-breakdown' } & IRWAPerpsOverviewBreakdownRequest)

const PERPS_MARKET_FILTER_DEFINITIONS: Array<RWAPerpsMarketFilterDefinition> = [
	{
		id: 'venue',
		label: d.venue.label,
		includeQueryKey: 'venues',
		excludeQueryKey: 'excludeVenues',
		getValues: (market) => [market.venue || UNKNOWN_FILTER_VALUE]
	},
	{
		id: 'baseAsset',
		label: d.baseAsset.label,
		includeQueryKey: 'baseAssets',
		excludeQueryKey: 'excludeBaseAssets',
		getValues: (market) => [getRWAPerpsBaseAssetBreakdownLabel(market)]
	},
	{
		id: 'assetGroup',
		label: d.assetGroup.label,
		includeQueryKey: 'assetGroups',
		excludeQueryKey: 'excludeAssetGroups',
		getValues: (market) => [getRWAPerpsAssetGroupBreakdownLabel(market)]
	},
	{
		id: 'assetClass',
		label: d.assetClass.label,
		includeQueryKey: 'assetClasses',
		excludeQueryKey: 'excludeAssetClasses',
		getValues: (market) => (market.assetClass?.length ? market.assetClass : [UNKNOWN_FILTER_VALUE]),
		hideWhenHardScoped: true
	},
	{
		id: 'category',
		label: d.category.label,
		includeQueryKey: 'categories',
		excludeQueryKey: 'excludeCategories',
		getValues: (market) => (market.category?.length ? market.category : [UNKNOWN_FILTER_VALUE])
	},
	{
		id: 'oracleProvider',
		label: d.oracleProvider.label,
		includeQueryKey: 'oracleProviders',
		excludeQueryKey: 'excludeOracleProviders',
		getValues: (market) => [market.oracleProvider || UNKNOWN_FILTER_VALUE]
	},
	{
		id: 'accessModel',
		label: d.accessModel.label,
		includeQueryKey: 'accessModels',
		excludeQueryKey: 'excludeAccessModels',
		getValues: (market) => [market.accessModel || UNKNOWN_FILTER_VALUE]
	},
	{
		id: 'issuer',
		label: d.issuer.label,
		includeQueryKey: 'issuers',
		excludeQueryKey: 'excludeIssuers',
		getValues: (market) => [market.issuer || UNKNOWN_FILTER_VALUE]
	},
	{
		id: 'rwaClassification',
		label: d.rwaClassification.label,
		includeQueryKey: 'rwaClassifications',
		excludeQueryKey: 'excludeRwaClassifications',
		getValues: (market) => [market.rwaClassification || UNKNOWN_FILTER_VALUE]
	}
]

const PERPS_MARKET_FILTER_QUERY_KEYS = PERPS_MARKET_FILTER_DEFINITIONS.flatMap((definition) => [
	definition.includeQueryKey,
	definition.excludeQueryKey
])

type RWAPerpsFilterDraft = {
	activeIds: Array<string>
	selectValues: Record<string, Array<string>>
}

type RWAPerpsActiveFilterPill = {
	id: string
	label: string
	onRemove: () => void
}

type RWAPerpsDashboardProps = (
	| {
			mode: 'overview'
			data: IRWAPerpsOverviewPageData
			defaultTimeSeriesBreakdown?: RWAPerpsOverviewTimeSeriesBreakdown
	  }
	| {
			mode: 'venue'
			data: IRWAPerpsVenuePageData
			defaultTimeSeriesBreakdown?: RWAPerpsVenueTimeSeriesBreakdown
	  }
	| {
			mode: 'assetGroup'
			data: IRWAPerpsAssetGroupPageData
			defaultTimeSeriesBreakdown?: RWAPerpsAssetGroupTimeSeriesBreakdown
	  }
	| {
			mode: 'asset'
			data: IRWAPerpsAssetPageData
			defaultTimeSeriesBreakdown?: RWAPerpsAssetTimeSeriesBreakdown
	  }
) & {
	/** When set, restricts rendered markets/totals to the matching `assetClass[0]`. Used by the dedicated Forex page. */
	assetClassFilter?: string
}

const overviewColumnHelper = createColumnHelper<IRWAPerpsOverviewPageData['markets'][number]>()
const venueColumnHelper = createColumnHelper<IRWAPerpsVenuePageData['markets'][number]>()

const overviewColumns = [
	overviewColumnHelper.accessor((row) => row.contract, {
		id: 'contract',
		header: d.contract.label,
		enableSorting: false,
		cell: (info) => (
			<span className="flex items-center gap-2">
				<span className="vf-row-index shrink-0" aria-hidden="true" />
				<BasicLink
					href={`/rwa/perps/contract/${encodeURIComponent(info.row.original.contract)}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.row.original.contract}
				</BasicLink>
				{info.row.original.suspicious ? <RWASuspiciousWarning entity="market" /> : null}
			</span>
		),
		meta: {
			headerClassName: 'w-[min(220px,40vw)]',
			headerHelperText: d.contract.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.venue, {
		id: 'venue',
		header: d.venue.label,
		cell: (info) => (
			<BasicLink
				href={`/rwa/perps/venue/${rwaSlug(info.getValue())}`}
				className="truncate label-md text-link hover:underline"
			>
				{info.getValue()}
			</BasicLink>
		),
		meta: {
			headerClassName: 'w-[168px]',
			headerHelperText: d.venue.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.assetClass?.[0] ?? '', {
		id: 'assetClass',
		header: d.assetClass.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[176px]',
			headerHelperText: d.assetClass.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.referenceAssetGroup ?? '', {
		id: 'baseAssetGroup',
		header: d.assetGroup.label,
		enableSorting: false,
		cell: (info) =>
			info.getValue() ? (
				<BasicLink
					href={`/rwa/perps/asset-group/${rwaSlug(info.getValue())}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[168px] min-w-[168px]',
			headerHelperText: d.assetGroup.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.referenceAsset ?? '', {
		id: 'baseAsset',
		header: d.baseAsset.label,
		enableSorting: false,
		cell: (info) =>
			info.getValue() ? (
				<BasicLink
					href={`/rwa/perps/asset/${rwaSlug(info.getValue())}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			headerHelperText: d.baseAsset.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.category?.join(', ') ?? '', {
		id: 'category',
		header: d.category.label,
		enableSorting: false,
		cell: (info) => {
			const value = info.getValue()
			if (!value) return null
			return (
				<Tooltip content={value} className="max-w-full">
					{value}
				</Tooltip>
			)
		},
		meta: {
			headerClassName: 'w-[132px]',
			headerHelperText: d.category.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.openInterest ?? undefined, {
		id: 'openInterest',
		header: d.openInterest.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[136px]',
			align: 'end',
			headerHelperText: d.openInterest.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.openInterestChange24h ?? undefined, {
		id: 'openInterestChange24h',
		header: d.openInterestChange24h.label,
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[148px]',
			align: 'end',
			headerHelperText: d.openInterestChange24h.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volume24h ?? undefined, {
		id: 'volume24h',
		header: d.volume24h.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[126px]',
			align: 'end',
			headerHelperText: d.volume24h.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volume24hChange24h ?? undefined, {
		id: 'volume24hChange24h',
		header: d.volume24hChange24h.label,
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[172px]',
			align: 'end',
			headerHelperText: d.volume24hChange24h.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: d.price.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: d.price.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.priceChange24h ?? undefined, {
		id: 'priceChange24h',
		header: d.priceChange24h.label,
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[156px]',
			align: 'end',
			headerHelperText: d.priceChange24h.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.fundingRate == null ? undefined : row.fundingRate * 100), {
		id: 'fundingRate',
		header: d.fundingRate.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: d.fundingRate.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.premium == null ? undefined : row.premium * 100), {
		id: 'premium',
		header: d.premium.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[108px]',
			align: 'end',
			headerHelperText: d.premium.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.maxLeverage ?? undefined, {
		id: 'maxLeverage',
		header: d.maxLeverage.label,
		cell: (info) =>
			`${formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}x`,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: d.maxLeverage.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.parentPlatform, {
		id: 'parentPlatform',
		header: d.parentPlatform.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[156px]',
			headerHelperText: d.parentPlatform.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.marginAsset, {
		id: 'marginAsset',
		header: d.marginAsset.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[132px]',
			headerHelperText: d.marginAsset.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.settlementAsset, {
		id: 'settlementAsset',
		header: d.settlementAsset.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[156px]',
			headerHelperText: d.settlementAsset.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.issuer ?? '', {
		id: 'issuer',
		header: d.issuer.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[96px]',
			headerHelperText: d.issuer.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.oracleProvider ?? '', {
		id: 'oracleProvider',
		header: d.oracleProvider.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[164px]',
			headerHelperText: d.oracleProvider.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.rwaClassification ?? '', {
		id: 'rwaClassification',
		header: d.rwaClassification.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[170px]',
			headerHelperText: d.rwaClassification.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.makerFeeRate == null ? undefined : row.makerFeeRate * 100), {
		id: 'makerFeeRate',
		header: d.makerFeeRate.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.makerFeeRate.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.takerFeeRate == null ? undefined : row.takerFeeRate * 100), {
		id: 'takerFeeRate',
		header: d.takerFeeRate.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.takerFeeRate.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.deployerFeeShare == null ? undefined : row.deployerFeeShare * 100), {
		id: 'deployerFeeShare',
		header: d.deployerFeeShare.label,
		cell: (info) =>
			info.getValue() == null
				? '-'
				: `${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[154px]',
			align: 'end',
			headerHelperText: d.deployerFeeShare.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.cumulativeFunding ?? undefined, {
		id: 'cumulativeFunding',
		header: d.cumulativeFunding.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end',
			headerHelperText: d.cumulativeFunding.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.oraclePx ?? undefined, {
		id: 'oraclePx',
		header: d.oraclePx.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[92px]',
			align: 'end',
			headerHelperText: d.oraclePx.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.midPx ?? undefined, {
		id: 'midPx',
		header: d.midPx.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[88px]',
			align: 'end',
			headerHelperText: d.midPx.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.prevDayPx ?? undefined, {
		id: 'prevDayPx',
		header: d.prevDayPx.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[116px]',
			align: 'end',
			headerHelperText: d.prevDayPx.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volume7d ?? undefined, {
		id: 'volume7d',
		header: d.volume7d.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[118px]',
			align: 'end',
			headerHelperText: d.volume7d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volume30d ?? undefined, {
		id: 'volume30d',
		header: d.volume30d.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[126px]',
			align: 'end',
			headerHelperText: d.volume30d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volumeAllTime ?? undefined, {
		id: 'volumeAllTime',
		header: d.volumeAllTime.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[146px]',
			align: 'end',
			headerHelperText: d.volumeAllTime.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFees24h ?? undefined, {
		id: 'estimatedProtocolFees24h',
		header: d.estimatedProtocolFees24h.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees24h.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFees7d ?? undefined, {
		id: 'estimatedProtocolFees7d',
		header: d.estimatedProtocolFees7d.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees7d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFees30d ?? undefined, {
		id: 'estimatedProtocolFees30d',
		header: d.estimatedProtocolFees30d.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees30d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFeesAllTime ?? undefined, {
		id: 'estimatedProtocolFeesAllTime',
		header: d.estimatedProtocolFeesAllTime.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[min(210px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFeesAllTime.description
		}
	})
]

const venueColumns = [
	venueColumnHelper.accessor((row) => row.contract, {
		id: 'contract',
		header: d.contract.label,
		enableSorting: false,
		cell: (info) => (
			<span className="flex items-center gap-2">
				<span className="vf-row-index shrink-0" aria-hidden="true" />
				<BasicLink
					href={`/rwa/perps/contract/${encodeURIComponent(info.row.original.contract)}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.row.original.contract}
				</BasicLink>
			</span>
		),
		meta: {
			headerClassName: 'w-[min(220px,40vw)]',
			headerHelperText: d.contract.description
		}
	}),
	venueColumnHelper.accessor((row) => row.referenceAsset ?? '', {
		id: 'baseAsset',
		header: d.baseAsset.label,
		enableSorting: false,
		cell: (info) =>
			info.getValue() ? (
				<BasicLink
					href={`/rwa/perps/asset/${rwaSlug(info.getValue())}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			headerHelperText: d.baseAsset.description
		}
	}),
	venueColumnHelper.accessor((row) => row.referenceAssetGroup ?? '', {
		id: 'baseAssetGroup',
		header: d.assetGroup.label,
		enableSorting: false,
		cell: (info) =>
			info.getValue() ? (
				<BasicLink
					href={`/rwa/perps/asset-group/${rwaSlug(info.getValue())}`}
					className="truncate label-md text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[168px] min-w-[168px]',
			headerHelperText: d.assetGroup.description
		}
	}),
	venueColumnHelper.accessor((row) => row.assetClass?.[0] ?? '', {
		id: 'assetClass',
		header: d.assetClass.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[176px]',
			headerHelperText: d.assetClass.description
		}
	}),
	venueColumnHelper.accessor((row) => row.category?.join(', ') ?? '', {
		id: 'category',
		header: d.category.label,
		enableSorting: false,
		cell: (info) => {
			const value = info.getValue()
			if (!value) return null
			return (
				<Tooltip content={value} className="max-w-full">
					{value}
				</Tooltip>
			)
		},
		meta: {
			headerClassName: 'w-[132px]',
			headerHelperText: d.category.description
		}
	}),
	venueColumnHelper.accessor((row) => row.issuer ?? '', {
		id: 'issuer',
		header: d.issuer.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[96px]',
			headerHelperText: d.issuer.description
		}
	}),
	venueColumnHelper.accessor((row) => row.marginAsset, {
		id: 'marginAsset',
		header: d.marginAsset.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[132px]',
			headerHelperText: d.marginAsset.description
		}
	}),
	venueColumnHelper.accessor((row) => row.settlementAsset, {
		id: 'settlementAsset',
		header: d.settlementAsset.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[156px]',
			headerHelperText: d.settlementAsset.description
		}
	}),
	venueColumnHelper.accessor((row) => row.openInterest ?? undefined, {
		id: 'openInterest',
		header: d.openInterest.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[136px]',
			align: 'end',
			headerHelperText: d.openInterest.description
		}
	}),
	venueColumnHelper.accessor((row) => row.openInterestChange24h ?? undefined, {
		id: 'openInterestChange24h',
		header: d.openInterestChange24h.label,
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[148px]',
			align: 'end',
			headerHelperText: d.openInterestChange24h.description
		}
	}),
	venueColumnHelper.accessor((row) => row.volume24h ?? undefined, {
		id: 'volume24h',
		header: d.volume24h.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[126px]',
			align: 'end',
			headerHelperText: d.volume24h.description
		}
	}),
	venueColumnHelper.accessor((row) => row.volume24hChange24h ?? undefined, {
		id: 'volume24hChange24h',
		header: d.volume24hChange24h.label,
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[172px]',
			align: 'end',
			headerHelperText: d.volume24hChange24h.description
		}
	}),
	venueColumnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: d.price.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: d.price.description
		}
	}),
	venueColumnHelper.accessor((row) => row.priceChange24h ?? undefined, {
		id: 'priceChange24h',
		header: d.priceChange24h.label,
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[156px]',
			align: 'end',
			headerHelperText: d.priceChange24h.description
		}
	}),
	venueColumnHelper.accessor((row) => (row.fundingRate == null ? undefined : row.fundingRate * 100), {
		id: 'fundingRate',
		header: d.fundingRate.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: d.fundingRate.description
		}
	}),
	venueColumnHelper.accessor((row) => (row.premium == null ? undefined : row.premium * 100), {
		id: 'premium',
		header: d.premium.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[108px]',
			align: 'end',
			headerHelperText: d.premium.description
		}
	}),
	venueColumnHelper.accessor((row) => row.maxLeverage ?? undefined, {
		id: 'maxLeverage',
		header: d.maxLeverage.label,
		cell: (info) =>
			`${formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}x`,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: d.maxLeverage.description
		}
	}),
	venueColumnHelper.accessor((row) => row.rwaClassification ?? '', {
		id: 'rwaClassification',
		header: d.rwaClassification.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[170px]',
			headerHelperText: d.rwaClassification.description
		}
	}),
	venueColumnHelper.accessor((row) => row.oracleProvider ?? '', {
		id: 'oracleProvider',
		header: d.oracleProvider.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[164px]',
			headerHelperText: d.oracleProvider.description
		}
	}),
	venueColumnHelper.accessor((row) => (row.makerFeeRate == null ? undefined : row.makerFeeRate * 100), {
		id: 'makerFeeRate',
		header: d.makerFeeRate.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.makerFeeRate.description
		}
	}),
	venueColumnHelper.accessor((row) => (row.takerFeeRate == null ? undefined : row.takerFeeRate * 100), {
		id: 'takerFeeRate',
		header: d.takerFeeRate.label,
		cell: (info) =>
			`${formatPercent(info.getValue(), { input: 'percent', compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.takerFeeRate.description
		}
	}),
	venueColumnHelper.accessor((row) => row.cumulativeFunding ?? undefined, {
		id: 'cumulativeFunding',
		header: d.cumulativeFunding.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end',
			headerHelperText: d.cumulativeFunding.description
		}
	}),
	venueColumnHelper.accessor((row) => row.estimatedProtocolFees24h ?? undefined, {
		id: 'estimatedProtocolFees24h',
		header: d.estimatedProtocolFees24h.label,
		cell: (info) =>
			formatUsd(info.getValue(), {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees24h.description
		}
	})
]

const assetGroupPriorityColumns = ['contract', 'venue', 'baseAsset', 'assetClass'] as const

const assetGroupColumns = [
	...assetGroupPriorityColumns.flatMap((columnId) => overviewColumns.filter((column) => column.id === columnId)),
	...overviewColumns.filter(
		(column) =>
			column.id !== 'baseAssetGroup' &&
			!assetGroupPriorityColumns.includes(column.id as (typeof assetGroupPriorityColumns)[number])
	)
]

const assetPriorityColumns = ['contract', 'venue'] as const

const assetColumns = [
	...assetPriorityColumns.flatMap((columnId) => overviewColumns.filter((column) => column.id === columnId)),
	...overviewColumns.filter(
		(column) =>
			column.id !== 'baseAsset' &&
			column.id !== 'baseAssetGroup' &&
			column.id !== 'assetClass' &&
			!assetPriorityColumns.includes(column.id as (typeof assetPriorityColumns)[number])
	)
]

const overviewColumnVisibility: VisibilityState = {
	category: false,
	parentPlatform: false,
	marginAsset: false,
	settlementAsset: false,
	oracleProvider: false,
	rwaClassification: false,
	makerFeeRate: false,
	takerFeeRate: false,
	deployerFeeShare: false,
	cumulativeFunding: false,
	oraclePx: false,
	midPx: false,
	prevDayPx: false,
	volume7d: false,
	volumeAllTime: false,
	estimatedProtocolFees7d: false,
	estimatedProtocolFees30d: false,
	estimatedProtocolFeesAllTime: false
}

const venueColumnVisibility: VisibilityState = {
	category: false,
	rwaClassification: false,
	oracleProvider: false,
	marginAsset: false,
	settlementAsset: false,
	cumulativeFunding: false,
	issuer: false
}

const assetGroupColumnVisibility: VisibilityState = {
	...overviewColumnVisibility,
	baseAssetGroup: false
}

const assetColumnVisibility: VisibilityState = {
	...overviewColumnVisibility,
	baseAsset: false,
	baseAssetGroup: false
}

function getLegendSeriesNames(seriesNames: Array<string>) {
	if (!seriesNames.includes('Total')) return seriesNames
	return ['Total', ...seriesNames.filter((name) => name !== 'Total')]
}

function getRWAPerpsFilterOptions(
	markets: Array<IRWAPerpsMarket>,
	getValues: (market: IRWAPerpsMarket) => Array<string>
) {
	const openInterestByValue = new Map<string, number>()

	for (const market of markets) {
		for (const value of getValues(market)) {
			openInterestByValue.set(value, (openInterestByValue.get(value) ?? 0) + market.openInterest)
		}
	}

	return [...openInterestByValue.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([label]) => label)
}

function getSelectedRWAPerpsFilterValues({
	allValues,
	includeQuery,
	excludeQuery
}: {
	allValues: Array<string>
	includeQuery: string | Array<string> | undefined
	excludeQuery: string | Array<string> | undefined
}) {
	const validSet = new Set(allValues)
	const excluded = parseExcludeParam(excludeQuery)
	const baseSelection = parseArrayParam(includeQuery, allValues, validSet)

	return excluded.size > 0 ? baseSelection.filter((value) => !excluded.has(value)) : baseSelection
}

function isRWAPerpsFilterActive(
	selectedValues: Array<string>,
	selectedValuesSet: ReadonlySet<string>,
	allValues: Array<string>
) {
	if (selectedValues.length !== allValues.length) return true

	return allValues.some((value) => !selectedValuesSet.has(value))
}

function getRWAPerpsMarketFilterStates({
	markets,
	query,
	hideAssetClass
}: {
	markets: Array<IRWAPerpsMarket>
	query: Record<string, string | Array<string> | undefined>
	hideAssetClass: boolean
}): Array<RWAPerpsMarketFilterState> {
	return PERPS_MARKET_FILTER_DEFINITIONS.map((definition) => {
		const options = getRWAPerpsFilterOptions(markets, definition.getValues)
		const selectedValues = getSelectedRWAPerpsFilterValues({
			allValues: options,
			includeQuery: query[definition.includeQueryKey],
			excludeQuery: query[definition.excludeQueryKey]
		})
		const selectedValuesSet = new Set(selectedValues)
		const active = isRWAPerpsFilterActive(selectedValues, selectedValuesSet, options)
		return {
			...definition,
			options,
			selectedValues,
			selectedValuesSet,
			active,
			enabled: (!hideAssetClass || !definition.hideWhenHardScoped) && (options.length > 1 || active)
		}
	})
}

function matchesRWAPerpsMarketFilter(market: IRWAPerpsMarket, filter: RWAPerpsMarketFilterState) {
	for (const value of filter.getValues(market)) {
		if (filter.selectedValuesSet.has(value)) return true
	}
	return false
}

function formatPerpsActiveFilterValues(values: ReadonlyArray<string>) {
	if (values.length === 0) return 'None'
	if (values.length <= 2) return values.join(', ')
	return `${values[0]}, ${values[1]} + ${values.length - 2}`
}

function clearRWAPerpsFilterQueryKeys(router: ReturnType<typeof useRouter>, keys: ReadonlyArray<string>) {
	const resetUpdates: Record<string, undefined> = {}
	for (const key of keys) {
		resetUpdates[key] = undefined
	}
	void pushShallowQuery(router, resetUpdates)
}

function isAllPerpsFilterSelection(filter: RWAPerpsMarketFilterState, values: Array<string>): boolean {
	const validSet = new Set(filter.options)
	const selected = values.filter((value) => validSet.has(value))
	const selectedSet = new Set(selected)
	return selected.length === filter.options.length && filter.options.every((value) => selectedSet.has(value))
}

function createRWAPerpsFilterDraft(filters: Array<RWAPerpsMarketFilterState>): RWAPerpsFilterDraft {
	const activeIds: Array<string> = []
	const selectValues: Record<string, Array<string>> = {}

	for (const filter of filters) {
		selectValues[filter.id] = filter.selectedValues.slice()
		if (filter.active) activeIds.push(filter.id)
	}

	return { activeIds, selectValues }
}

function addRWAPerpsDraftFilter(draft: RWAPerpsFilterDraft, filter: RWAPerpsMarketFilterState): RWAPerpsFilterDraft {
	if (draft.activeIds.includes(filter.id)) return draft

	return {
		activeIds: draft.activeIds.concat(filter.id),
		selectValues: {
			...draft.selectValues,
			[filter.id]: draft.selectValues[filter.id] ?? filter.selectedValues.slice()
		}
	}
}

function removeRWAPerpsDraftFilter(draft: RWAPerpsFilterDraft, id: string): RWAPerpsFilterDraft {
	return {
		...draft,
		activeIds: draft.activeIds.filter((activeId) => activeId !== id)
	}
}

function getRWAPerpsSelectDraftQueryUpdates(
	filter: RWAPerpsMarketFilterState,
	values: Array<string>
): Record<string, string | Array<string> | undefined> {
	return getQueryUpdatesFromSelected(
		filter.includeQueryKey,
		filter.excludeQueryKey,
		filter.options,
		values,
		filter.options
	)
}

function serializeRWAPerpsFilterDraft(
	filters: Array<RWAPerpsMarketFilterState>,
	draft: RWAPerpsFilterDraft
): Record<string, string | Array<string> | undefined> {
	const updates: Record<string, string | Array<string> | undefined> = {}
	for (const key of PERPS_MARKET_FILTER_QUERY_KEYS) {
		updates[key] = undefined
	}

	const activeIds = new Set(draft.activeIds)
	for (const filter of filters) {
		if (!activeIds.has(filter.id)) continue
		Object.assign(updates, getRWAPerpsSelectDraftQueryUpdates(filter, draft.selectValues[filter.id] ?? []))
	}

	return updates
}

function getRWAPerpsActiveFilterPill(
	filter: RWAPerpsMarketFilterState,
	query: ReturnType<typeof useRouter>['query'],
	onRemove: () => void
): RWAPerpsActiveFilterPill | null {
	const includeQuery = query[filter.includeQueryKey]
	const excludeQuery = query[filter.excludeQueryKey]
	if (includeQuery == null && excludeQuery == null) return null

	if (excludeQuery != null) {
		const validValues = new Set(filter.options)
		const excludedValues = toNonEmptyArrayParam(excludeQuery).filter((value) => validValues.has(value))
		if (excludedValues.length === 0 || isAllPerpsFilterSelection(filter, filter.selectedValues)) return null
		return {
			id: filter.excludeQueryKey,
			label: `${filter.label} excludes ${formatPerpsActiveFilterValues(excludedValues)}`,
			onRemove
		}
	}

	if (isAllPerpsFilterSelection(filter, filter.selectedValues)) return null

	return {
		id: filter.includeQueryKey,
		label: `${filter.label}: ${formatPerpsActiveFilterValues(filter.selectedValues)}`,
		onRemove
	}
}

function getRWAPerpsActiveFilterPills(filters: Array<RWAPerpsMarketFilterState>, router: ReturnType<typeof useRouter>) {
	const activeFilters: Array<RWAPerpsActiveFilterPill> = []

	for (const filter of filters) {
		const pill = getRWAPerpsActiveFilterPill(filter, router.query, () =>
			clearRWAPerpsFilterQueryKeys(router, [filter.includeQueryKey, filter.excludeQueryKey])
		)
		if (pill) activeFilters.push(pill)
	}

	return activeFilters
}

function hasResettableRWAPerpsFilterQueryParam(query: ReturnType<typeof useRouter>['query'], includeForex: boolean) {
	for (const key of PERPS_MARKET_FILTER_QUERY_KEYS) {
		if (query[key] != null) return true
	}
	return includeForex
}

function RWAPerpsActiveFilterPills({ pills }: { pills: Array<RWAPerpsActiveFilterPill> }) {
	if (pills.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1">
			{pills.map((pill) => (
				<button
					key={pill.id}
					type="button"
					onClick={pill.onRemove}
					className="hover-wash group flex items-center gap-1 rounded-full border border-brand bg-brand-muted px-2 py-0.5 label-sm text-primary"
				>
					<span>{pill.label}</span>
					<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
				</button>
			))}
		</div>
	)
}

function DialogPanelSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="label-xs tracking-wide text-tertiary uppercase">{title}</h3>
			{children}
		</section>
	)
}

function RWAPerpsMarketFilters({
	filters,
	showForexToggle,
	includeForex,
	includeCex,
	onToggleIncludeCex,
	onToggleIncludeForex
}: {
	filters: Array<RWAPerpsMarketFilterState>
	showForexToggle: boolean
	includeForex: boolean
	includeCex: boolean
	onToggleIncludeCex: () => void
	onToggleIncludeForex: () => void
}) {
	const router = useRouter()

	const activeFilterPills = getRWAPerpsActiveFilterPills(filters, router)
	const selectedFilterCount = createRWAPerpsFilterDraft(filters).activeIds.length
	const hasActiveFilters = hasResettableRWAPerpsFilterQueryParam(
		router.query,
		(showForexToggle && includeForex) || includeCex
	)

	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
				{filters.length > 0 ? (
					<>
						<RWAPerpsActiveFilterPills pills={activeFilterPills} />
						<RWAPerpsFiltersDialog
							filters={filters}
							selectedFilterCount={selectedFilterCount}
							hasActiveFilterPills={activeFilterPills.length > 0}
						/>
					</>
				) : null}
				{showForexToggle ? (
					<Checkbox variant="filter" value="includeForex" checked={includeForex} onChange={onToggleIncludeForex}>
						<span className="whitespace-nowrap">Forex Perps</span>
					</Checkbox>
				) : null}
				<Checkbox variant="filter" value="includeCex" checked={includeCex} onChange={onToggleIncludeCex}>
					<span className="whitespace-nowrap">CEX Venues</span>
				</Checkbox>
				<Button
					type="button"
					size="md"
					onClick={() =>
						clearRWAPerpsFilterQueryKeys(router, [...PERPS_MARKET_FILTER_QUERY_KEYS, 'includeForex', 'includeCex'])
					}
					disabled={!hasActiveFilters}
				>
					Reset filters
				</Button>
			</div>
		</Card>
	)
}

function RWAPerpsFiltersDialog({
	filters,
	selectedFilterCount,
	hasActiveFilterPills
}: {
	filters: Array<RWAPerpsMarketFilterState>
	selectedFilterCount: number
	hasActiveFilterPills: boolean
}) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState<RWAPerpsFilterDraft>(() => createRWAPerpsFilterDraft(filters))
	const draftSelectedCount = draft.activeIds.length

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraft(createRWAPerpsFilterDraft(filters))
		}
		setOpen(nextOpen)
	}

	const saveDraft = () => {
		void pushShallowQuery(router, serializeRWAPerpsFilterDraft(filters, draft))
		setOpen(false)
	}

	return (
		<Ariakit.DialogProvider open={open} setOpen={handleOpenChange}>
			<Ariakit.DialogDisclosure render={<Button type="button" size="md" />}>
				<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs">
					{selectedFilterCount}
				</span>
				<span>{hasActiveFilterPills ? 'Edit' : 'Filters'}</span>
				<Icon name="pencil" className="size-3 text-tertiary" />
			</Ariakit.DialogDisclosure>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:900px] sm:max-h-[min(760px,calc(100%-32px))]`}
				unmountOnHide
				portal
			>
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<div className="flex items-baseline gap-2.5">
						<DialogHeading>Filters</DialogHeading>
						<span className="label-sm text-tertiary">{draftSelectedCount} selected</span>
					</div>
					<DialogCloseButton className="-mr-1" />
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] sm:overflow-hidden">
					<RWAPerpsFilterBrowser filters={filters} draft={draft} onDraftChange={setDraft} />
					<RWAPerpsActiveDraftFilters filters={filters} draft={draft} onDraftChange={setDraft} />
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-subtle bg-overlay px-4 py-3">
					{draft.activeIds.length > 0 ? (
						<Button
							type="button"
							variant="ghost"
							size="md"
							onClick={() => setDraft((current) => ({ ...current, activeIds: [] }))}
							className="mr-auto"
						>
							Clear all
						</Button>
					) : (
						<span className="mr-auto label-sm text-tertiary">No filters selected</span>
					)}
					<Ariakit.DialogDismiss render={<Button size="md" />}>Cancel</Ariakit.DialogDismiss>
					<Button type="button" variant="primary" size="md" onClick={saveDraft}>
						Save filters
					</Button>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function RWAPerpsFilterBrowser({
	filters,
	draft,
	onDraftChange
}: {
	filters: Array<RWAPerpsMarketFilterState>
	draft: RWAPerpsFilterDraft
	onDraftChange: (draft: RWAPerpsFilterDraft | ((current: RWAPerpsFilterDraft) => RWAPerpsFilterDraft)) => void
}) {
	const activeIds = new Set(draft.activeIds)
	const availableFilters = filters.filter((filter) => !activeIds.has(filter.id))

	return (
		<section className="order-2 flex min-h-0 flex-col border-t border-subtle max-sm:shrink-0 sm:order-1 sm:border-t-0 sm:border-r">
			<div className="border-b border-subtle px-4 py-2">
				<h3 className="label-sm text-secondary">Browse filters</h3>
			</div>
			<div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 max-sm:overflow-visible">
				{availableFilters.length > 0 ? (
					<DialogPanelSection title="Market Fields">
						<div className="flex flex-wrap gap-1">
							{availableFilters.map((filter) => (
								<button
									key={filter.id}
									type="button"
									onClick={() => {
										onDraftChange((current) => addRWAPerpsDraftFilter(current, filter))
									}}
									className="group flex items-center gap-1.5 rounded-full border border-subtle bg-transparent px-2.5 py-1 label-sm text-primary transition-[background-color,border-color,color] duration-150 ease-out hover:border-brand hover:bg-hover-row focus-visible:border-brand focus-visible:bg-hover-row"
								>
									<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" />
									<span>{filter.label}</span>
								</button>
							))}
						</div>
					</DialogPanelSection>
				) : (
					<div className="rounded-md border border-dashed border-subtle bg-page p-4 body-sm text-tertiary">
						All filters are active.
					</div>
				)}
			</div>
		</section>
	)
}

function RWAPerpsActiveDraftFilters({
	filters,
	draft,
	onDraftChange
}: {
	filters: Array<RWAPerpsMarketFilterState>
	draft: RWAPerpsFilterDraft
	onDraftChange: (draft: RWAPerpsFilterDraft | ((current: RWAPerpsFilterDraft) => RWAPerpsFilterDraft)) => void
}) {
	const activeFilters = draft.activeIds
		.map((id) => filters.find((filter) => filter.id === id))
		.filter((filter): filter is RWAPerpsMarketFilterState => Boolean(filter))

	return (
		<section className="order-1 flex min-h-0 flex-col max-sm:shrink-0 sm:order-2">
			<div className="border-b border-subtle px-4 py-2">
				<h3 className="label-sm text-secondary">Active filters</h3>
			</div>
			<div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4 max-sm:overflow-visible">
				{activeFilters.length > 0 ? (
					activeFilters.map((filter) => (
						<RWAPerpsDraftFilterEditor key={filter.id} filter={filter} draft={draft} onDraftChange={onDraftChange} />
					))
				) : (
					<div className="rounded-md border border-dashed border-subtle bg-page p-4 body-sm text-tertiary">
						Add filters from the list to narrow the table.
					</div>
				)}
			</div>
		</section>
	)
}

function RWAPerpsDraftFilterEditor({
	filter,
	draft,
	onDraftChange
}: {
	filter: RWAPerpsMarketFilterState
	draft: RWAPerpsFilterDraft
	onDraftChange: (draft: RWAPerpsFilterDraft | ((current: RWAPerpsFilterDraft) => RWAPerpsFilterDraft)) => void
}) {
	const selectedValues = draft.selectValues[filter.id] ?? []

	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate label-sm text-primary">{filter.label}</span>
					<span className="rounded-full bg-surface-elevated-2 px-1.5 py-0.5 label-sm text-secondary uppercase">
						Market Field
					</span>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					square
					onClick={() => onDraftChange((current) => removeRWAPerpsDraftFilter(current, filter.id))}
				>
					<Icon name="x" className="size-3.5" />
					<span className="sr-only">Remove {filter.label} filter</span>
				</Button>
			</div>
			<SelectWithCombobox
				allValues={filter.options}
				selectedValues={selectedValues}
				setSelectedValues={(values) =>
					onDraftChange((current) => ({
						...current,
						selectValues: { ...current.selectValues, [filter.id]: values }
					}))
				}
				label="Values"
				labelType="smol"
				variant="filter-responsive"
				size="sm"
				visibleOptionLimit={null}
				selectAllScope="matches"
				searchPlaceholder={`Search ${filter.label.toLowerCase()}...`}
				emptyLabel="No matches found"
				popoverClassName="z-100 max-sm:h-[88dvh]! max-sm:max-h-[88dvh] max-sm:w-full sm:min-w-[260px] sm:max-h-[min(360px,60dvh)]! lg:max-h-[min(360px,60dvh)]!"
				triggerProps={{
					'aria-label': `${filter.label} values`,
					className: selectTriggerStyles('input', 'md')
				}}
			/>
		</Card>
	)
}

function StatCard({
	label,
	tooltip,
	value,
	change,
	changeTooltip
}: {
	label: string
	tooltip?: string
	value: React.ReactNode
	change?: number | null
	changeTooltip?: string
}) {
	const changeDecorationClass =
		change == null ? '' : change > 0 ? 'text-data-up' : change < 0 ? 'text-data-down' : 'text-secondary'

	return (
		<Card padding="md" className="flex flex-1 flex-col gap-1">
			{tooltip ? (
				<Tooltip content={tooltip} className="text-secondary underline decoration-dotted">
					{label}
				</Tooltip>
			) : (
				<span className="text-secondary">{label}</span>
			)}
			<span className="flex items-end justify-between gap-2 font-jetbrains">
				<span className="font-jetbrains text-2xl font-semibold">{value}</span>
				{change != null ? (
					changeTooltip ? (
						<Tooltip
							content={changeTooltip}
							className={`text-base underline decoration-current decoration-dotted ${changeDecorationClass}`}
						>
							<span>
								<PercentChange percent={change} fontWeight={500} />
							</span>
						</Tooltip>
					) : (
						<span className="text-base">
							<PercentChange percent={change} fontWeight={500} />
						</span>
					)
				) : null}
			</span>
		</Card>
	)
}

function fetchOverviewTimeSeriesDataset(request: IRWAPerpsOverviewBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key
	})
	setRWAPerpsChartScope(searchParams, request)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/overview-breakdown?${searchParams.toString()}`)
}

function fetchContractTimeSeriesDataset(request: IRWAPerpsContractBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		key: request.key
	})
	setRWAPerpsChartScope(searchParams, request)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/contract-breakdown?${searchParams.toString()}`)
}

function fetchMarketTimeSeriesDataset(request: IRWAPerpsMarketBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		key: request.key
	})
	setRWAPerpsChartScope(searchParams, request)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/market-breakdown?${searchParams.toString()}`)
}

export function RWAPerpsDashboard(props: RWAPerpsDashboardProps) {
	const router = useRouter()
	const {
		chartType,
		chartView,
		nonTimeSeriesChartBreakdown,
		timeSeriesChartBreakdown,
		timeSeriesMode,
		treemapNestedBy
	} = router.query
	const chartDefaults = useMemo<RWAPerpsChartDefaults>(
		() => (props.defaultTimeSeriesBreakdown ? { timeSeriesBreakdown: props.defaultTimeSeriesBreakdown } : {}),
		[props.defaultTimeSeriesBreakdown]
	)
	const chartState = useMemo(
		() =>
			parseRWAPerpsChartState(
				{
					chartType,
					chartView,
					nonTimeSeriesChartBreakdown,
					timeSeriesChartBreakdown,
					timeSeriesMode,
					treemapNestedBy
				},
				props.mode,
				chartDefaults
			),
		[
			chartType,
			chartView,
			chartDefaults,
			nonTimeSeriesChartBreakdown,
			props.mode,
			timeSeriesChartBreakdown,
			timeSeriesMode,
			treemapNestedBy
		]
	)
	const volumeGroupBy = parseRWAPerpsVolumeGroupBy(router.query.groupBy)
	const chartMetricLabel = getRWAPerpsChartMetricLabel(chartState.metric, d)
	const chartMetricOptions = getRWAPerpsChartMetricOptions(d)
	const chartViewOptions = getRWAPerpsChartViewOptions()
	const isTimeSeriesView = chartState.view === 'timeSeries'
	const isPieView = chartState.view === 'pie'
	const isHBarView = chartState.view === 'hbar'
	const isTreemapView = chartState.view === 'treemap'
	const chartBreakdownOptions = getRWAPerpsChartBreakdownOptions({
		...chartState,
		labels: d
	})
	const timeSeriesBreakdownOptions =
		chartState.view === 'timeSeries'
			? ([{ key: 'total', name: 'Total' }, ...chartBreakdownOptions] as const)
			: chartBreakdownOptions
	const showBreakdownSelect = chartBreakdownOptions.length > 1
	const treemapBreakdown =
		chartState.view === 'treemap' ? chartState.breakdown : getDefaultRWAPerpsChartBreakdown(chartState.mode, 'treemap')
	const treemapNestedByOptions = getRWAPerpsTreemapNestedByOptions(props.mode, treemapBreakdown, d)
	const showTreemapNestedBySelect = chartState.view === 'treemap' && treemapNestedByOptions.length > 1
	const treemapNestedByLabel = getRWAPerpsTreemapNestedByLabel(chartState.treemapNestedBy, d)
	const breakdownLabel =
		chartState.view === 'timeSeries' && chartState.timeSeriesMode === 'grouped'
			? 'Total'
			: getRWAPerpsBreakdownLabel(chartState.breakdown, d)
	const isOverviewMode = props.mode === 'overview'
	const isVenueMode = props.mode === 'venue'
	const isAssetGroupMode = props.mode === 'assetGroup'
	const isAssetMode = props.mode === 'asset'
	const assetClassFilter = props.assetClassFilter
	const showForexToggle = isOverviewMode && assetClassFilter == null
	const includeForex = showForexToggle ? isTrueQueryParam(router.query.includeForex) : true
	const includeCexByDefault =
		(props.mode === 'venue' || props.mode === 'asset') &&
		props.data.markets.every((market) => market.venueType === 'CEX')
	const includeCex = router.query.includeCex == null ? includeCexByDefault : isTrueQueryParam(router.query.includeCex)
	const rowsBeforeUserFilters = useMemo(() => {
		const markets = includeCex ? props.data.markets : props.data.markets.filter((market) => market.venueType !== 'CEX')
		if (assetClassFilter != null) {
			return markets.filter((market) => market.assetClass?.[0] === assetClassFilter)
		}
		if (showForexToggle && !includeForex) {
			return markets.filter((market) => market.assetClass?.[0] !== FOREX_ASSET_CLASS)
		}
		return markets
	}, [assetClassFilter, includeCex, includeForex, props.data.markets, showForexToggle])
	const venuesQuery = router.query.venues
	const excludeVenuesQuery = router.query.excludeVenues
	const baseAssetsQuery = router.query.baseAssets
	const excludeBaseAssetsQuery = router.query.excludeBaseAssets
	const assetGroupsQuery = router.query.assetGroups
	const excludeAssetGroupsQuery = router.query.excludeAssetGroups
	const assetClassesQuery = router.query.assetClasses
	const excludeAssetClassesQuery = router.query.excludeAssetClasses
	const categoriesQuery = router.query.categories
	const excludeCategoriesQuery = router.query.excludeCategories
	const oracleProvidersQuery = router.query.oracleProviders
	const excludeOracleProvidersQuery = router.query.excludeOracleProviders
	const accessModelsQuery = router.query.accessModels
	const excludeAccessModelsQuery = router.query.excludeAccessModels
	const issuersQuery = router.query.issuers
	const excludeIssuersQuery = router.query.excludeIssuers
	const rwaClassificationsQuery = router.query.rwaClassifications
	const excludeRwaClassificationsQuery = router.query.excludeRwaClassifications
	const marketFilterQuery = useMemo(
		() => ({
			venues: venuesQuery,
			excludeVenues: excludeVenuesQuery,
			baseAssets: baseAssetsQuery,
			excludeBaseAssets: excludeBaseAssetsQuery,
			assetGroups: assetGroupsQuery,
			excludeAssetGroups: excludeAssetGroupsQuery,
			assetClasses: assetClassesQuery,
			excludeAssetClasses: excludeAssetClassesQuery,
			categories: categoriesQuery,
			excludeCategories: excludeCategoriesQuery,
			oracleProviders: oracleProvidersQuery,
			excludeOracleProviders: excludeOracleProvidersQuery,
			accessModels: accessModelsQuery,
			excludeAccessModels: excludeAccessModelsQuery,
			issuers: issuersQuery,
			excludeIssuers: excludeIssuersQuery,
			rwaClassifications: rwaClassificationsQuery,
			excludeRwaClassifications: excludeRwaClassificationsQuery
		}),
		[
			venuesQuery,
			excludeVenuesQuery,
			baseAssetsQuery,
			excludeBaseAssetsQuery,
			assetGroupsQuery,
			excludeAssetGroupsQuery,
			assetClassesQuery,
			excludeAssetClassesQuery,
			categoriesQuery,
			excludeCategoriesQuery,
			oracleProvidersQuery,
			excludeOracleProvidersQuery,
			accessModelsQuery,
			excludeAccessModelsQuery,
			issuersQuery,
			excludeIssuersQuery,
			rwaClassificationsQuery,
			excludeRwaClassificationsQuery
		]
	)
	const marketFilters = useMemo(
		() =>
			getRWAPerpsMarketFilterStates({
				markets: rowsBeforeUserFilters,
				query: marketFilterQuery,
				hideAssetClass: assetClassFilter != null
			}),
		[assetClassFilter, rowsBeforeUserFilters, marketFilterQuery]
	)
	const activeMarketFilters = useMemo(
		() => marketFilters.filter((filter) => filter.enabled && filter.active),
		[marketFilters]
	)
	const visibleMarketFilters = useMemo(() => marketFilters.filter((filter) => filter.enabled), [marketFilters])
	const hasActiveMarketFilters = activeMarketFilters.length > 0
	const currentRows = useMemo(() => {
		if (!hasActiveMarketFilters) return rowsBeforeUserFilters

		return rowsBeforeUserFilters.filter((market) => {
			for (const filter of activeMarketFilters) {
				if (!matchesRWAPerpsMarketFilter(market, filter)) return false
			}
			return true
		})
	}, [activeMarketFilters, hasActiveMarketFilters, rowsBeforeUserFilters])
	const includedRows = getRWAPerpsIncludedRows(currentRows, props.mode)
	const isTotalsPopulationFiltered = includedRows !== props.data.markets
	const computedTotals = useMemo(
		() =>
			isTotalsPopulationFiltered
				? {
						openInterest: sumMarketMetric(includedRows, 'openInterest'),
						openInterestChange24h: getAggregateOpenInterestChange24h(includedRows),
						volume24h: sumMarketMetric(includedRows, 'volume24h'),
						volume24hChange24h: getAggregateVolume24hChange24h(includedRows),
						markets: includedRows.length,
						protocolFees24h: sumProtocolFees24h(includedRows)
					}
				: null,
		[includedRows, isTotalsPopulationFiltered]
	)
	const displayTotals = computedTotals ?? props.data.totals
	const onToggleIncludeForex = () => {
		void pushShallowQuery(router, {
			includeForex: includeForex ? undefined : 'true'
		})
	}
	const onToggleIncludeCex = () => {
		const nextIncludeCex = !includeCex
		void pushShallowQuery(router, {
			includeCex: nextIncludeCex === includeCexByDefault ? undefined : nextIncludeCex ? 'true' : 'false'
		})
	}
	const initialChartDataset = props.data.initialChartDataset
	const venueLabel = props.mode === 'venue' ? props.data.venue : null
	const assetGroupLabel = props.mode === 'assetGroup' ? props.data.assetGroup : null
	const assetLabel = props.mode === 'asset' ? props.data.asset : null
	const treemapScope = useMemo(() => {
		if (venueLabel !== null) return { mode: 'venue', scopeLabel: venueLabel } as const
		if (assetGroupLabel !== null) return { mode: 'assetGroup', scopeLabel: assetGroupLabel } as const
		if (assetLabel !== null) return { mode: 'asset', scopeLabel: assetLabel } as const
		return { mode: 'overview' } as const
	}, [assetGroupLabel, assetLabel, venueLabel])
	const timeSeriesClassTarget: RWAPerpsMarketBreakdownTarget | null = assetClassFilter
		? { kind: 'assetClass', slug: assetClassFilter }
		: showForexToggle && !includeForex
			? { kind: 'excludeAssetClass', slug: FOREX_ASSET_CLASS }
			: null
	const pageTarget: RWAPerpsMarketBreakdownTarget = isVenueMode
		? { kind: 'venue', slug: props.data.venue }
		: isAssetGroupMode
			? { kind: 'assetGroup', slug: props.data.assetGroup }
			: isAssetMode
				? { kind: 'baseAsset', slug: props.data.asset }
				: { kind: 'all' }
	const aggregatePageTarget = isVenueMode
		? ({ kind: 'venue', slug: props.data.venue } as const)
		: isAssetGroupMode
			? ({ kind: 'assetGroup', slug: props.data.assetGroup } as const)
			: ({ kind: 'all' } as const)
	const shouldProjectMarketBreakdown = hasActiveMarketFilters
	const timeSeriesRequest: RWAPerpsTimeSeriesRequest = (() => {
		if (isAssetMode || shouldProjectMarketBreakdown) {
			const target = timeSeriesClassTarget ?? pageTarget
			return { source: 'market-breakdown', key: chartState.metric, target, includeCex }
		}

		const target = timeSeriesClassTarget ?? aggregatePageTarget
		return chartState.breakdown === 'contract'
			? { source: 'contract-breakdown', key: chartState.metric, target, includeCex }
			: { source: 'overview-breakdown', key: chartState.metric, breakdown: chartState.breakdown, target, includeCex }
	})()
	const isDefaultTimeSeriesState =
		chartState.view === 'timeSeries' &&
		chartState.metric === 'openInterest' &&
		chartState.breakdown === getDefaultRWAPerpsChartBreakdown(props.mode, 'timeSeries', chartDefaults)
	const hasPreloadedTimeSeriesDataset =
		initialChartDataset.source.length > 0 ||
		initialChartDataset.dimensions.some((dimension) => dimension !== 'timestamp')
	const canUseInitialTimeSeriesDataset =
		(timeSeriesRequest.source !== 'market-breakdown' || isAssetMode) &&
		(!showForexToggle || !includeForex) &&
		includeCex === includeCexByDefault
	const shouldUseInitialTimeSeriesDataset =
		isDefaultTimeSeriesState && hasPreloadedTimeSeriesDataset && canUseInitialTimeSeriesDataset
	const timeSeriesQueryFn =
		chartState.view === 'timeSeries'
			? () => {
					switch (timeSeriesRequest.source) {
						case 'market-breakdown':
							return fetchMarketTimeSeriesDataset({
								key: timeSeriesRequest.key,
								target: timeSeriesRequest.target,
								includeCex: timeSeriesRequest.includeCex
							})
						case 'contract-breakdown':
							return fetchContractTimeSeriesDataset({
								key: timeSeriesRequest.key,
								target: timeSeriesRequest.target,
								includeCex: timeSeriesRequest.includeCex
							})
						case 'overview-breakdown':
							return fetchOverviewTimeSeriesDataset({
								breakdown: timeSeriesRequest.breakdown,
								key: timeSeriesRequest.key,
								target: timeSeriesRequest.target,
								includeCex: timeSeriesRequest.includeCex
							})
					}
				}
			: skipToken
	const isTimeSeriesQueryEnabled =
		chartState.view === 'timeSeries' && !shouldUseInitialTimeSeriesDataset && includedRows.length > 0

	const timeSeriesQuery = useQuery({
		queryKey: ['rwa-perps-chart', timeSeriesRequest],
		queryFn: timeSeriesQueryFn,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: isTimeSeriesQueryEnabled
	})

	const fetchedTimeSeriesDataset =
		chartState.view === 'timeSeries' && shouldUseInitialTimeSeriesDataset
			? initialChartDataset
			: (timeSeriesQuery.data ?? EMPTY_DATASET)
	const rawTimeSeriesDataset = useMemo(() => {
		if (chartState.view !== 'timeSeries') return EMPTY_DATASET
		return timeSeriesRequest.source === 'market-breakdown'
			? buildRWAPerpsTimeSeriesDatasetForRows({
					dataset: fetchedTimeSeriesDataset,
					rows: includedRows,
					breakdown: chartState.breakdown,
					seriesKey: 'id'
				})
			: fetchedTimeSeriesDataset
	}, [chartState, includedRows, fetchedTimeSeriesDataset, timeSeriesRequest.source])
	const shouldShowTotalOverlay = chartState.timeSeriesMode === 'breakdown' && chartState.metric !== 'volume24h'
	const ungroupedTimeSeriesDataset = useMemo(() => {
		if (!isTimeSeriesView) return EMPTY_DATASET
		return chartState.timeSeriesMode === 'grouped'
			? groupRWAPerpsTimeSeriesDataset(rawTimeSeriesDataset)
			: shouldShowTotalOverlay
				? appendRWAPerpsTimeSeriesDatasetTotal(rawTimeSeriesDataset)
				: rawTimeSeriesDataset
	}, [chartState.timeSeriesMode, isTimeSeriesView, rawTimeSeriesDataset, shouldShowTotalOverlay])
	const selectedTimeSeriesDataset = useMemo(() => {
		const dataset = toRwaMultiSeriesChartDataset(isTimeSeriesView ? ungroupedTimeSeriesDataset : EMPTY_DATASET)
		return chartState.metric === 'volume24h'
			? groupMultiSeriesBarChartDataset({ dataset, groupBy: volumeGroupBy })
			: dataset
	}, [chartState.metric, isTimeSeriesView, ungroupedTimeSeriesDataset, volumeGroupBy])

	const timeSeriesCharts = useMemo(
		() =>
			isTimeSeriesView
				? buildRWAPerpsTimeSeriesCharts({
						metric: chartState.metric,
						dimensions: selectedTimeSeriesDataset.dimensions,
						timeSeriesMode: chartState.timeSeriesMode
					})
				: [],
		[chartState.metric, chartState.timeSeriesMode, isTimeSeriesView, selectedTimeSeriesDataset.dimensions]
	)
	const timeSeriesLegendNames = useMemo(
		() => getLegendSeriesNames(timeSeriesCharts.map((series) => series.name)),
		[timeSeriesCharts]
	)
	const timeSeriesChartOptions = useMemo(() => ({ legend: { data: timeSeriesLegendNames } }), [timeSeriesLegendNames])

	const snapshotBreakdownRows = useMemo(() => {
		if (chartState.view !== 'pie' && chartState.view !== 'hbar') return EMPTY_SNAPSHOT_BREAKDOWN_ROWS
		switch (chartState.mode) {
			case 'overview':
				return buildRWAPerpsOverviewSnapshotBreakdownTotals({
					rows: includedRows,
					breakdown: chartState.breakdown,
					key: chartState.metric
				})
			case 'venue':
				return buildRWAPerpsVenueSnapshotBreakdownTotals({
					rows: includedRows,
					breakdown: chartState.breakdown,
					key: chartState.metric
				})
			case 'assetGroup':
				return buildRWAPerpsAssetGroupSnapshotBreakdownTotals({
					rows: includedRows,
					breakdown: chartState.breakdown,
					key: chartState.metric
				})
			case 'asset':
				return buildRWAPerpsAssetSnapshotBreakdownTotals({
					rows: includedRows,
					breakdown: chartState.breakdown,
					key: chartState.metric
				})
		}
	}, [includedRows, chartState])

	const pieChartData = useMemo(
		() => (isPieView || isHBarView ? preparePieChartData({ data: snapshotBreakdownRows, limit: 10 }) : []),
		[isHBarView, isPieView, snapshotBreakdownRows]
	)
	const deferredPieChartData = useDeferredValue(pieChartData)
	const deferredTimeSeriesDataset = useDeferredValue(selectedTimeSeriesDataset)
	const hasTimeSeriesHistory = useMemo(
		() => hasEnoughTimeSeriesHistory(ungroupedTimeSeriesDataset),
		[ungroupedTimeSeriesDataset]
	)
	const pieChartColors = useMemo(() => {
		if (!isPieView && !isHBarView) return {}
		const colorMap: Record<string, string> = {}
		for (const [index, item] of deferredPieChartData.entries()) {
			colorMap[item.name] = CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]
		}
		return colorMap
	}, [deferredPieChartData, isHBarView, isPieView])

	const barChartData = useMemo(
		() => (isHBarView ? limitRwaHorizontalBarData(deferredPieChartData) : []),
		[deferredPieChartData, isHBarView]
	)

	const treemapTreeData = useMemo(
		() =>
			isTreemapView
				? buildRWAPerpsTreemapTreeData({
						...treemapScope,
						markets: includedRows,
						metric: chartState.metric,
						parentGrouping: treemapBreakdown,
						nestedBy: chartState.treemapNestedBy
					})
				: [],
		[chartState.metric, chartState.treemapNestedBy, includedRows, isTreemapView, treemapBreakdown, treemapScope]
	)
	const hasNonTimeSeriesData = isTreemapView ? treemapTreeData.length > 0 : snapshotBreakdownRows.length > 0
	const { chartInstance: timeSeriesChartInstance, handleChartReady: handleTimeSeriesChartReady } = useGetChartInstance()
	const { chartInstance: pieChartInstance, handleChartReady: handlePieChartReady } = useGetChartInstance()
	const { chartInstance: barChartInstance, handleChartReady: handleBarChartReady } = useGetChartInstance()
	const { chartInstance: treemapChartInstance, handleChartReady: handleTreemapChartReady } = useGetChartInstance()

	const nonTimeSeriesChartInstance =
		chartState.view === 'treemap'
			? treemapChartInstance
			: chartState.view === 'hbar'
				? barChartInstance
				: pieChartInstance
	const treemapValueLabel = chartState.metric === 'volume24h' ? 'Daily Volume' : chartMetricLabel
	const valueSymbol = chartState.metric === 'markets' ? '' : '$'
	const pageLabel = isOverviewMode
		? 'RWA Perps'
		: isVenueMode
			? `${props.data.venue} RWA Perps`
			: isAssetGroupMode
				? `${props.data.assetGroup} RWA Perps`
				: `${props.data.asset} RWA Perps`
	const filenameBase = isOverviewMode
		? 'rwa-perps-overview'
		: isVenueMode
			? `rwa-perps-venue-${props.data.venue}`
			: isAssetGroupMode
				? `rwa-perps-asset-group-${props.data.assetGroup}`
				: `rwa-perps-asset-${props.data.asset}`
	const timeSeriesFilename = `${filenameBase}-time-series-${chartState.metric}-${chartState.breakdown}-${chartState.timeSeriesMode}`
	const nonTimeSeriesFilename = `${filenameBase}-${chartState.view}-${chartState.metric}-${chartState.breakdown}`

	const onSelectView = (value: string | Array<string>) => {
		const selectedView = Array.isArray(value) ? value[0] : value
		if (!selectedView) return
		const nextState = setRWAPerpsChartView(chartState, selectedView)
		void pushShallowQuery(router, {
			chartView: getRWAPerpsChartViewQueryValueForMode(props.mode, nextState.view),
			timeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults) : undefined,
			nonTimeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? undefined : getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults)
		})
	}

	const onSelectBreakdown = (value: string | Array<string>) => {
		const selectedBreakdown = Array.isArray(value) ? value[0] : value
		if (!selectedBreakdown) return
		if (chartState.view === 'timeSeries') {
			if (selectedBreakdown === 'total') {
				const nextState = setRWAPerpsTimeSeriesMode(chartState, 'grouped')
				void pushShallowQuery(router, {
					timeSeriesChartBreakdown: getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults),
					timeSeriesMode: getRWAPerpsTimeSeriesModeQueryValue(nextState.timeSeriesMode)
				})
				return
			}

			const nextState = setRWAPerpsTimeSeriesMode(setRWAPerpsChartBreakdown(chartState, selectedBreakdown), 'breakdown')
			void pushShallowQuery(router, {
				timeSeriesChartBreakdown: getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults),
				timeSeriesMode: getRWAPerpsTimeSeriesModeQueryValue(nextState.timeSeriesMode)
			})
			return
		}

		const nextState = setRWAPerpsChartBreakdown(chartState, selectedBreakdown)
		void pushShallowQuery(router, {
			timeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults) : undefined,
			nonTimeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? undefined : getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults)
		})
	}

	const onSelectTreemapNestedBy = (value: string | Array<string>) => {
		const selectedNestedBy = Array.isArray(value) ? value[0] : value
		if (!selectedNestedBy) return
		const nextState = setRWAPerpsTreemapNestedBy(chartState, selectedNestedBy)
		void pushShallowQuery(router, {
			treemapNestedBy: getRWAPerpsTreemapNestedByQueryValue(nextState)
		})
	}

	const timeSeriesMetricSwitch = (
		<SegmentedControl
			value={chartState.metric}
			onValueChange={(key) =>
				void pushShallowQuery(router, {
					chartType: getRWAPerpsChartMetricQueryValue(key)
				})
			}
			options={chartMetricOptions.map(({ key, name }) => ({
				value: key,
				label: name
			}))}
			label="Chart metric"
			variant="default"
			size="md"
			className="mr-auto"
		/>
	)

	const statCards = isOverviewMode
		? [
				{
					label: d.totalOpenInterest.label,
					tooltip: d.totalOpenInterest.description,
					value: formatUsd(displayTotals.openInterest, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
					change: displayTotals.openInterestChange24h,
					changeTooltip: d.openInterestChange24h.description
				},
				{
					label: d.totalVolume24h.label,
					tooltip: d.totalVolume24h.description,
					value: formatUsd(displayTotals.volume24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
					change: displayTotals.volume24hChange24h,
					changeTooltip: d.volume24hChange24h.description
				},
				{
					label: d.totalMarkets.label,
					tooltip: d.totalMarkets.description,
					value: formatCompactNumber(displayTotals.markets, {
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				},
				{
					label: d.estimatedProtocolFees24h.label,
					tooltip: d.estimatedProtocolFees24h.description,
					value: formatUsd(displayTotals.protocolFees24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				}
			]
		: [
				{
					label: d.openInterest.label,
					tooltip: d.openInterest.description,
					value: formatUsd(displayTotals.openInterest, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
					change: displayTotals.openInterestChange24h,
					changeTooltip: d.openInterestChange24h.description
				},
				{
					label: d.volume24h.label,
					tooltip: d.volume24h.description,
					value: formatUsd(displayTotals.volume24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}),
					change: displayTotals.volume24hChange24h,
					changeTooltip: d.volume24hChange24h.description
				},
				{
					label: d.markets.label,
					tooltip: d.markets.description,
					value: formatCompactNumber(displayTotals.markets, {
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				},
				{
					label: d.estimatedProtocolFees24h.label,
					tooltip: d.estimatedProtocolFees24h.description,
					value: formatUsd(displayTotals.protocolFees24h, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				}
			]

	return (
		<div className="flex flex-col gap-2">
			{isVenueMode ? (
				<RowLinksWithDropdown links={props.data.venueLinks} activeLink={props.data.venue} />
			) : isAssetGroupMode ? (
				<RowLinksWithDropdown links={props.data.assetGroupLinks} activeLink={props.data.assetGroup} />
			) : isAssetMode ? (
				<RowLinksWithDropdown links={props.data.assetLinks} activeLink={props.data.asset} />
			) : null}
			{showForexToggle ? (
				<Card padding="sm" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<p className="body-sm text-tertiary">
						The RWA Perpetuals Dashboard only covers real world assets such as stocks, RWA tokens, forex, and other
						significant financial indices. This excludes digital assets such as BTC or ETH perpetual contracts. RWA
						perpetual contracts on centralized exchanges are excluded by default and can be included with the CEX Venues
						filter.
					</p>
				</Card>
			) : null}
			<RWAPerpsMarketFilters
				filters={visibleMarketFilters}
				showForexToggle={showForexToggle}
				includeForex={includeForex}
				onToggleIncludeForex={onToggleIncludeForex}
				includeCex={includeCex}
				onToggleIncludeCex={onToggleIncludeCex}
			/>
			<div className="flex flex-col gap-2 md:flex-row md:items-center">
				{statCards.map((card) => (
					<StatCard key={card.label} {...card} />
				))}
			</div>
			{chartState.view === 'timeSeries' ? (
				<ChartPanel>
					<ChartPanelToolbar className="justify-end">
						{timeSeriesMetricSwitch}
						<Select
							allValues={chartViewOptions}
							selectedValues={chartState.view}
							setSelectedValues={onSelectView}
							label={chartViewOptions.find((option) => option.key === chartState.view)?.name ?? 'Time Series Chart'}
							labelType="none"
							variant="filter"
							size="md"
						/>
						{showBreakdownSelect ? (
							<Select
								allValues={timeSeriesBreakdownOptions}
								selectedValues={chartState.timeSeriesMode === 'grouped' ? 'total' : chartState.breakdown}
								setSelectedValues={onSelectBreakdown}
								label={breakdownLabel}
								labelType="none"
								variant="filter"
								size="md"
							/>
						) : null}
						{chartState.metric === 'volume24h' ? (
							<ChartGroupingSelector
								value={volumeGroupBy}
								options={DWM_GROUPING_OPTIONS_LOWERCASE}
								onValueChange={(nextGroupBy) => {
									void pushShallowQuery(router, {
										groupBy: getRWAPerpsVolumeGroupByQueryValue(nextGroupBy)
									})
								}}
							/>
						) : null}
						<ChartExportButtons
							chartInstance={timeSeriesChartInstance}
							filename={timeSeriesFilename}
							title={`${pageLabel} ${chartMetricLabel}`}
							smol
							csvSource={{ type: 'dataset', prepare: () => selectedTimeSeriesDataset }}
						/>
					</ChartPanelToolbar>
					{isTimeSeriesQueryEnabled && timeSeriesQuery.error ? (
						<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
							{getErrorMessage(timeSeriesQuery.error)}
						</ChartPanelBodyFallback>
					) : isTimeSeriesQueryEnabled && timeSeriesQuery.isLoading ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
							Loading
							<LoadingDots />
						</ChartPanelBodyFallback>
					) : !hasTimeSeriesHistory ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
							There is not enough time-series history for this selection yet.
						</ChartPanelBodyFallback>
					) : (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={deferredTimeSeriesDataset}
								charts={timeSeriesCharts}
								chartOptions={timeSeriesChartOptions}
								hideDefaultLegend={false}
								showTotalInTooltip={!deferredTimeSeriesDataset.dimensions.includes('Total')}
								{...(chartState.metric === 'volume24h' ? { groupBy: volumeGroupBy } : {})}
								valueSymbol={valueSymbol}
								onReady={handleTimeSeriesChartReady}
							/>
						</Suspense>
					)}
				</ChartPanel>
			) : (
				<ChartPanel className={chartState.view === 'treemap' ? undefined : 'min-h-[420px]'}>
					<ChartPanelToolbar className="justify-end">
						{timeSeriesMetricSwitch}
						<Select
							allValues={chartViewOptions}
							selectedValues={chartState.view}
							setSelectedValues={onSelectView}
							label={chartViewOptions.find((option) => option.key === chartState.view)?.name ?? 'Time Series Chart'}
							labelType="none"
							variant="filter"
							size="md"
						/>
						{showBreakdownSelect ? (
							<Select
								allValues={chartBreakdownOptions}
								selectedValues={chartState.breakdown}
								setSelectedValues={onSelectBreakdown}
								label={breakdownLabel}
								labelType="none"
								variant="filter"
								size="md"
							/>
						) : null}
						{showTreemapNestedBySelect ? (
							<Select
								allValues={treemapNestedByOptions}
								selectedValues={chartState.treemapNestedBy}
								setSelectedValues={onSelectTreemapNestedBy}
								label={`Nested by: ${treemapNestedByLabel}`}
								labelType="none"
								variant="filter"
								size="md"
							/>
						) : null}
						{chartState.view === 'treemap' ? <ChartRestoreButton chartInstance={treemapChartInstance} /> : null}
						<ChartExportButtons
							chartInstance={nonTimeSeriesChartInstance}
							filename={nonTimeSeriesFilename}
							title={`${pageLabel} ${chartMetricLabel}`}
							smol
							csvSource={
								chartState.view === 'treemap'
									? { type: 'dataset', prepare: () => buildTreemapCsvDataset(treemapTreeData) }
									: {
											type: 'dataset',
											prepare: () => ({
												dimensions: ['Name', 'Value'],
												source: snapshotBreakdownRows.map(({ name, value }) => [name, value])
											})
										}
							}
						/>
					</ChartPanelToolbar>
					{!hasNonTimeSeriesData ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
							No chart data available.
						</ChartPanelBodyFallback>
					) : (
						<Suspense
							fallback={chartState.view === 'treemap' ? <div className="min-h-[600px]" /> : <ChartPanelBodyFallback />}
						>
							{chartState.view === 'pie' ? (
								<PieChart
									chartData={deferredPieChartData}
									stackColors={pieChartColors}
									radius={PIE_CHART_RADIUS}
									onReady={handlePieChartReady}
									valueSymbol={valueSymbol}
								/>
							) : chartState.view === 'hbar' ? (
								<HBarChart
									categories={barChartData.map((item) => item.name)}
									values={barChartData.map((item) => item.value)}
									colors={barChartData.map((item) => pieChartColors[item.name] ?? CHART_COLORS[0])}
									valueSymbol={valueSymbol}
									onReady={handleBarChartReady}
								/>
							) : (
								<TreemapChart
									treeData={treemapTreeData}
									variant="rwa"
									height="600px"
									onReady={handleTreemapChartReady}
									valueLabel={treemapValueLabel}
									valueSymbol={valueSymbol}
								/>
							)}
						</Suspense>
					)}
				</ChartPanel>
			)}
			<TableWithSearch
				data={currentRows}
				columns={
					isOverviewMode
						? overviewColumns
						: isVenueMode
							? venueColumns
							: isAssetGroupMode
								? assetGroupColumns
								: assetColumns
				}
				placeholder={
					isOverviewMode
						? 'Search markets or assets...'
						: isVenueMode
							? 'Search venue markets...'
							: isAssetGroupMode
								? 'Search asset-group markets...'
								: 'Search asset markets...'
				}
				columnToSearch="contract"
				header={
					isOverviewMode
						? 'Markets Rankings'
						: `${isVenueMode ? props.data.venue : isAssetGroupMode ? props.data.assetGroup : props.data.asset} Markets`
				}
				headingAs="h1"
				sortingState={[{ id: 'openInterest', desc: true }]}
				columnVisibility={
					isOverviewMode
						? overviewColumnVisibility
						: isVenueMode
							? venueColumnVisibility
							: isAssetGroupMode
								? assetGroupColumnVisibility
								: assetColumnVisibility
				}
				rowSize={56}
				compact
				showColumnSelect
				csvFileName={
					isOverviewMode
						? 'rwa-perps-overview-markets'
						: isVenueMode
							? `rwa-perps-${props.data.venue}-markets`
							: isAssetGroupMode
								? `rwa-perps-${props.data.assetGroup}-markets`
								: `rwa-perps-${props.data.asset}-markets`
				}
			/>
		</div>
	)
}
