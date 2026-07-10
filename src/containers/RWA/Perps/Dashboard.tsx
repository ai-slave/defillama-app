import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, type VisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ButtonStyled/ChartRestoreButton'
import { ChartGroupingSelector, DWM_GROUPING_OPTIONS_LOWERCASE } from '~/components/ECharts/ChartGroupingSelector'
import type {
	IHBarChartProps,
	IMultiSeriesChart2Props,
	IPieChartProps,
	ITreemapChartProps,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'
import { groupMultiSeriesBarChartDataset, preparePieChartData } from '~/components/ECharts/utils'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { LoadingDots } from '~/components/Loaders'
import { PercentChange } from '~/components/PercentChange'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SegmentedControl } from '~/components/SegmentedControl'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { type ExcludeQueryKey } from '~/components/Select/types'
import { selectTriggerStyles } from '~/components/Select/types'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { Tooltip } from '~/components/Tooltip'
import { CHART_COLORS } from '~/constants/colors'
import { limitRwaHorizontalBarData, type RWAChartDataset, type RWAChartRow } from '~/containers/RWA/chartDataset'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Checkbox } from '~/ui/Checkbox'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { formattedNum } from '~/utils'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import {
	isTrueQueryParam,
	parseArrayParam,
	parseExcludeParam,
	pushShallowQuery,
	toNonEmptyArrayParam
} from '~/utils/routerQuery'
import type { IRWAPerpsMarket } from './api.types'
import {
	getRWAPerpsAssetGroupBreakdownLabel,
	getRWAPerpsBaseAssetBreakdownLabel,
	getRWAPerpsOverviewBreakdownLabel,
	getRWAPerpsVenueBreakdownLabel
} from './breakdownLabels'
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
import { perpsDefinitions as d } from './definitions'
import {
	buildRWAPerpsAssetGroupSnapshotBreakdownTotals,
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
	RWAPerpsAssetGroupBreakdown,
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	RWAPerpsOverviewBreakdown,
	IRWAPerpsOverviewBreakdownRequest,
	IRWAPerpsOverviewPageData,
	IRWAPerpsVenuePageData,
	RWAPerpsVenueBreakdown,
	RWAPerpsAssetGroupSnapshotBreakdown,
	RWAPerpsAssetGroupTimeSeriesBreakdown,
	RWAPerpsAssetGroupTreemapBreakdown,
	RWAPerpsChartMode,
	RWAPerpsOverviewTimeSeriesBreakdown,
	RWAPerpsOverviewSnapshotBreakdown,
	RWAPerpsOverviewTreemapBreakdown,
	RWAPerpsVenueSnapshotBreakdown,
	RWAPerpsVenueTimeSeriesBreakdown,
	RWAPerpsVenueTreemapBreakdown
} from './types'

const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<ITreemapChartProps>

const EMPTY_DATASET: RWAChartDataset = { source: [], dimensions: ['timestamp'] }
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
	getValues: (market: IRWAPerpsMarket) => string[]
	hideWhenHardScoped?: boolean
}

type RWAPerpsMarketFilterState = RWAPerpsMarketFilterDefinition & {
	options: string[]
	selectedValues: string[]
	selectedValuesSet: ReadonlySet<string>
	active: boolean
	enabled: boolean
}

const PERPS_MARKET_FILTER_DEFINITIONS: RWAPerpsMarketFilterDefinition[] = [
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
	activeIds: string[]
	selectValues: Record<string, string[]>
}

type RWAPerpsActiveFilterPill = {
	id: string
	label: string
	onRemove: () => void
}

type RWAPerpsTimeSeriesBreakdownForMode =
	| RWAPerpsOverviewBreakdown
	| RWAPerpsVenueBreakdown
	| RWAPerpsAssetGroupBreakdown

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
					className="overflow-hidden label-md text-ellipsis whitespace-nowrap text-link hover:underline"
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
	overviewColumnHelper.accessor((row) => row.venue, {
		id: 'venue',
		header: d.venue.label,
		cell: (info) => (
			<BasicLink
				href={`/rwa/perps/venue/${rwaSlug(info.getValue())}`}
				className="overflow-hidden label-md text-ellipsis whitespace-nowrap text-link hover:underline"
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
					className="overflow-hidden label-md text-ellipsis whitespace-nowrap text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[136px]',
			headerHelperText: d.assetGroup.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.referenceAsset ?? '', {
		id: 'baseAsset',
		header: d.baseAsset.label,
		enableSorting: false,
		meta: {
			headerClassName: 'w-[140px]',
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
		cell: (info) => formattedNum(info.getValue(), true),
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
		cell: (info) => formattedNum(info.getValue(), true),
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
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[88px]',
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
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: d.fundingRate.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.premium == null ? undefined : row.premium * 100), {
		id: 'premium',
		header: d.premium.label,
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[108px]',
			align: 'end',
			headerHelperText: d.premium.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.maxLeverage ?? undefined, {
		id: 'maxLeverage',
		header: d.maxLeverage.label,
		cell: (info) => `${formattedNum(info.getValue(), false)}x`,
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
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.makerFeeRate.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.takerFeeRate == null ? undefined : row.takerFeeRate * 100), {
		id: 'takerFeeRate',
		header: d.takerFeeRate.label,
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.takerFeeRate.description
		}
	}),
	overviewColumnHelper.accessor((row) => (row.deployerFeeShare == null ? undefined : row.deployerFeeShare * 100), {
		id: 'deployerFeeShare',
		header: d.deployerFeeShare.label,
		cell: (info) => (info.getValue() == null ? '-' : `${formattedNum(info.getValue(), false)}%`),
		meta: {
			headerClassName: 'w-[154px]',
			align: 'end',
			headerHelperText: d.deployerFeeShare.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.cumulativeFunding ?? undefined, {
		id: 'cumulativeFunding',
		header: d.cumulativeFunding.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end',
			headerHelperText: d.cumulativeFunding.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.oraclePx ?? undefined, {
		id: 'oraclePx',
		header: d.oraclePx.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[92px]',
			align: 'end',
			headerHelperText: d.oraclePx.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.midPx ?? undefined, {
		id: 'midPx',
		header: d.midPx.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[88px]',
			align: 'end',
			headerHelperText: d.midPx.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.prevDayPx ?? undefined, {
		id: 'prevDayPx',
		header: d.prevDayPx.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[116px]',
			align: 'end',
			headerHelperText: d.prevDayPx.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volume7d ?? undefined, {
		id: 'volume7d',
		header: d.volume7d.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[118px]',
			align: 'end',
			headerHelperText: d.volume7d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volume30d ?? undefined, {
		id: 'volume30d',
		header: d.volume30d.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[126px]',
			align: 'end',
			headerHelperText: d.volume30d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.volumeAllTime ?? undefined, {
		id: 'volumeAllTime',
		header: d.volumeAllTime.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[146px]',
			align: 'end',
			headerHelperText: d.volumeAllTime.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFees24h ?? undefined, {
		id: 'estimatedProtocolFees24h',
		header: d.estimatedProtocolFees24h.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees24h.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFees7d ?? undefined, {
		id: 'estimatedProtocolFees7d',
		header: d.estimatedProtocolFees7d.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees7d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFees30d ?? undefined, {
		id: 'estimatedProtocolFees30d',
		header: d.estimatedProtocolFees30d.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[min(188px,40vw)]',
			align: 'end',
			headerHelperText: d.estimatedProtocolFees30d.description
		}
	}),
	overviewColumnHelper.accessor((row) => row.estimatedProtocolFeesAllTime ?? undefined, {
		id: 'estimatedProtocolFeesAllTime',
		header: d.estimatedProtocolFeesAllTime.label,
		cell: (info) => formattedNum(info.getValue(), true),
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
					className="overflow-hidden label-md text-ellipsis whitespace-nowrap text-link hover:underline"
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
		meta: {
			headerClassName: 'w-[140px]',
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
					className="overflow-hidden label-md text-ellipsis whitespace-nowrap text-link hover:underline"
				>
					{info.getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[136px]',
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
		cell: (info) => formattedNum(info.getValue(), true),
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
		cell: (info) => formattedNum(info.getValue(), true),
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
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[88px]',
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
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: d.fundingRate.description
		}
	}),
	venueColumnHelper.accessor((row) => (row.premium == null ? undefined : row.premium * 100), {
		id: 'premium',
		header: d.premium.label,
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[108px]',
			align: 'end',
			headerHelperText: d.premium.description
		}
	}),
	venueColumnHelper.accessor((row) => row.maxLeverage ?? undefined, {
		id: 'maxLeverage',
		header: d.maxLeverage.label,
		cell: (info) => `${formattedNum(info.getValue(), false)}x`,
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
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.makerFeeRate.description
		}
	}),
	venueColumnHelper.accessor((row) => (row.takerFeeRate == null ? undefined : row.takerFeeRate * 100), {
		id: 'takerFeeRate',
		header: d.takerFeeRate.label,
		cell: (info) => `${formattedNum(info.getValue(), false)}%`,
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end',
			headerHelperText: d.takerFeeRate.description
		}
	}),
	venueColumnHelper.accessor((row) => row.cumulativeFunding ?? undefined, {
		id: 'cumulativeFunding',
		header: d.cumulativeFunding.label,
		cell: (info) => formattedNum(info.getValue(), true),
		meta: {
			headerClassName: 'w-[168px]',
			align: 'end',
			headerHelperText: d.cumulativeFunding.description
		}
	}),
	venueColumnHelper.accessor((row) => row.estimatedProtocolFees24h ?? undefined, {
		id: 'estimatedProtocolFees24h',
		header: d.estimatedProtocolFees24h.label,
		cell: (info) => formattedNum(info.getValue(), true),
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

function getLegendSeriesNames(seriesNames: string[]) {
	if (!seriesNames.includes('Total')) return seriesNames
	return ['Total', ...seriesNames.filter((name) => name !== 'Total')]
}

function getRWAPerpsFilterOptions(markets: IRWAPerpsMarket[], getValues: (market: IRWAPerpsMarket) => string[]) {
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
	allValues: string[]
	includeQuery: string | string[] | undefined
	excludeQuery: string | string[] | undefined
}) {
	const validSet = new Set(allValues)
	const excluded = parseExcludeParam(excludeQuery)
	const baseSelection = parseArrayParam(includeQuery, allValues, validSet)

	return excluded.size > 0 ? baseSelection.filter((value) => !excluded.has(value)) : baseSelection
}

function isRWAPerpsFilterActive(selectedValues: string[], selectedValuesSet: ReadonlySet<string>, allValues: string[]) {
	if (selectedValues.length !== allValues.length) return true

	return allValues.some((value) => !selectedValuesSet.has(value))
}

function getRWAPerpsMarketFilterStates({
	markets,
	query,
	hideAssetClass
}: {
	markets: IRWAPerpsMarket[]
	query: Record<string, string | string[] | undefined>
	hideAssetClass: boolean
}): RWAPerpsMarketFilterState[] {
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

function formatPerpsActiveFilterValues(values: readonly string[]) {
	if (values.length === 0) return 'None'
	if (values.length <= 2) return values.join(', ')
	return `${values[0]}, ${values[1]} + ${values.length - 2}`
}

function clearRWAPerpsFilterQueryKeys(router: ReturnType<typeof useRouter>, keys: readonly string[]) {
	const resetUpdates: Record<string, undefined> = {}
	for (const key of keys) {
		resetUpdates[key] = undefined
	}
	void pushShallowQuery(router, resetUpdates)
}

function isAllPerpsFilterSelection(filter: RWAPerpsMarketFilterState, values: string[]): boolean {
	const validSet = new Set(filter.options)
	const selected = values.filter((value) => validSet.has(value))
	const selectedSet = new Set(selected)
	return selected.length === filter.options.length && filter.options.every((value) => selectedSet.has(value))
}

function createRWAPerpsFilterDraft(filters: RWAPerpsMarketFilterState[]): RWAPerpsFilterDraft {
	const activeIds: string[] = []
	const selectValues: Record<string, string[]> = {}

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
	return { ...draft, activeIds: draft.activeIds.filter((activeId) => activeId !== id) }
}

function getRWAPerpsSelectDraftQueryUpdates(
	filter: RWAPerpsMarketFilterState,
	values: string[]
): Record<string, string | string[] | undefined> {
	return getQueryUpdatesFromSelected(
		filter.includeQueryKey,
		filter.excludeQueryKey,
		filter.options,
		values,
		filter.options
	)
}

function serializeRWAPerpsFilterDraft(
	filters: RWAPerpsMarketFilterState[],
	draft: RWAPerpsFilterDraft
): Record<string, string | string[] | undefined> {
	const updates: Record<string, string | string[] | undefined> = {}
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

function getRWAPerpsActiveFilterPills(filters: RWAPerpsMarketFilterState[], router: ReturnType<typeof useRouter>) {
	const activeFilters: RWAPerpsActiveFilterPill[] = []

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

function RWAPerpsActiveFilterPills({ pills }: { pills: RWAPerpsActiveFilterPill[] }) {
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
	onToggleIncludeForex
}: {
	filters: RWAPerpsMarketFilterState[]
	showForexToggle: boolean
	includeForex: boolean
	onToggleIncludeForex: () => void
}) {
	const router = useRouter()

	if (filters.length === 0 && !showForexToggle) return null

	const activeFilterPills = getRWAPerpsActiveFilterPills(filters, router)
	const selectedFilterCount = createRWAPerpsFilterDraft(filters).activeIds.length
	const hasActiveFilters = hasResettableRWAPerpsFilterQueryParam(router.query, showForexToggle && includeForex)

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
				<Button
					type="button"
					size="md"
					onClick={() => clearRWAPerpsFilterQueryKeys(router, [...PERPS_MARKET_FILTER_QUERY_KEYS, 'includeForex'])}
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
	filters: RWAPerpsMarketFilterState[]
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
						<span className="label-sm text-tertiary tabular-nums">{draftSelectedCount} selected</span>
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
	filters: RWAPerpsMarketFilterState[]
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
	filters: RWAPerpsMarketFilterState[]
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

function getTimeSeriesBreakdownLabel({
	mode,
	row,
	breakdown
}: {
	mode: RWAPerpsChartMode
	row: IRWAPerpsMarket
	breakdown: RWAPerpsTimeSeriesBreakdownForMode
}) {
	if (mode === 'venue') {
		return getRWAPerpsVenueBreakdownLabel(row, breakdown as RWAPerpsVenueBreakdown)
	}

	return getRWAPerpsOverviewBreakdownLabel(row, breakdown as RWAPerpsOverviewBreakdown)
}

function getRWAPerpsTimeSeriesDatasetDimensions(source: RWAChartDataset['source']) {
	const latestValueBySeries = new Map<string, number>()

	for (let rowIndex = source.length - 1; rowIndex >= 0; rowIndex--) {
		const row = source[rowIndex]

		for (const series in row) {
			if (series === 'timestamp' || latestValueBySeries.has(series)) continue
			latestValueBySeries.set(series, row[series] ?? 0)
		}
	}

	return [
		'timestamp',
		...[...latestValueBySeries.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([series]) => series)
	]
}

export function buildRWAPerpsTimeSeriesDatasetForRows({
	dataset,
	rows,
	mode,
	breakdown,
	seriesKey = 'contract'
}: {
	dataset: RWAChartDataset
	rows: IRWAPerpsMarket[]
	mode: RWAPerpsChartMode
	breakdown: RWAPerpsTimeSeriesBreakdownForMode
	seriesKey?: 'contract' | 'id'
}): RWAChartDataset {
	if (dataset.source.length === 0 || rows.length === 0) return EMPTY_DATASET

	const labelBySeries = new Map<string, string>()

	for (const row of rows) {
		labelBySeries.set(
			seriesKey === 'id' ? row.id : row.contract,
			getTimeSeriesBreakdownLabel({
				mode,
				row,
				breakdown
			})
		)
	}

	if (labelBySeries.size === 0) return EMPTY_DATASET

	const source = dataset.source.map((row) => {
		const nextRow: RWAChartRow = { timestamp: row.timestamp }

		for (const [series, label] of labelBySeries) {
			const value = row[series]
			if (value == null) continue

			nextRow[label] = (nextRow[label] ?? 0) + value
		}

		return nextRow
	})
	const dimensions = getRWAPerpsTimeSeriesDatasetDimensions(source)

	return dimensions.length > 1 ? { source, dimensions } : EMPTY_DATASET
}

export function buildRWAPerpsTimeSeriesCharts({
	metric,
	dimensions,
	timeSeriesMode
}: {
	metric: 'openInterest' | 'volume24h' | 'markets'
	dimensions: string[]
	timeSeriesMode: 'grouped' | 'breakdown'
}): Array<MultiSeriesChart2SeriesConfig> {
	const seriesType: MultiSeriesChart2SeriesConfig['type'] = metric === 'volume24h' ? 'bar' : 'line'
	const seriesKeys = dimensions.filter((dimension) => dimension !== 'timestamp')
	const hasTotalOverlay = timeSeriesMode === 'breakdown' && metric !== 'volume24h' && seriesKeys.includes('Total')
	const breakdownSeries = seriesKeys.filter((seriesName) => !(hasTotalOverlay && seriesName === 'Total'))

	return [
		...breakdownSeries.map((seriesName, index) => ({
			name: seriesName,
			type: seriesType,
			...(metric === 'volume24h' ? { stack: 'A', large: false } : {}),
			encode: { x: 'timestamp', y: seriesName },
			color: CHART_COLORS[(index + (hasTotalOverlay ? 1 : 0)) % CHART_COLORS.length]
		})),
		...(hasTotalOverlay
			? [
					{
						name: 'Total',
						type: 'line' as const,
						encode: { x: 'timestamp', y: 'Total' },
						color: CHART_COLORS[0],
						hideAreaStyle: true,
						excludeFromTooltipTotal: true
					}
				]
			: [])
	]
}

const StatCard = ({
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
}) => {
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

function fetchOverviewTimeSeriesDataset(
	request: IRWAPerpsOverviewBreakdownRequest & { venue?: string; assetGroup?: string }
): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key
	})
	if (request.venue) searchParams.set('venue', request.venue)
	if (request.assetGroup) searchParams.set('assetGroup', request.assetGroup)
	if (request.assetClass) searchParams.set('assetClass', request.assetClass)
	if (request.excludeAssetClass) searchParams.set('excludeAssetClass', request.excludeAssetClass)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/overview-breakdown?${searchParams.toString()}`)
}

function fetchContractTimeSeriesDataset(request: IRWAPerpsContractBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		key: request.key
	})
	if (request.venue) searchParams.set('venue', request.venue)
	if (request.assetGroup) searchParams.set('assetGroup', request.assetGroup)
	if (request.assetClass) searchParams.set('assetClass', request.assetClass)
	if (request.excludeAssetClass) searchParams.set('excludeAssetClass', request.excludeAssetClass)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/contract-breakdown?${searchParams.toString()}`)
}

function fetchMarketTimeSeriesDataset(request: IRWAPerpsMarketBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		key: request.key
	})
	if (request.assetClass) searchParams.set('assetClass', request.assetClass)
	if (request.excludeAssetClass) searchParams.set('excludeAssetClass', request.excludeAssetClass)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/market-breakdown?${searchParams.toString()}`)
}

export function RWAPerpsDashboard(props: RWAPerpsDashboardProps) {
	const router = useRouter()
	const chartDefaults = { timeSeriesBreakdown: props.defaultTimeSeriesBreakdown }
	const chartState = parseRWAPerpsChartState(router.query, props.mode, chartDefaults)
	const volumeGroupBy = parseRWAPerpsVolumeGroupBy(router.query.groupBy)
	const chartMetricLabel = getRWAPerpsChartMetricLabel(chartState.metric, d)
	const chartMetricOptions = getRWAPerpsChartMetricOptions(d)
	const chartViewOptions = getRWAPerpsChartViewOptions()
	const chartBreakdownOptions = getRWAPerpsChartBreakdownOptions({ ...chartState, labels: d })
	const timeSeriesBreakdownOptions =
		chartState.view === 'timeSeries'
			? ([{ key: 'total', name: 'Total' }, ...chartBreakdownOptions] as const)
			: chartBreakdownOptions
	const showBreakdownSelect = chartBreakdownOptions.length > 1
	const treemapBreakdown = chartState.breakdown as
		| RWAPerpsOverviewTreemapBreakdown
		| RWAPerpsVenueTreemapBreakdown
		| RWAPerpsAssetGroupTreemapBreakdown
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
	const assetClassFilter = props.assetClassFilter
	const showForexToggle = isOverviewMode && assetClassFilter == null
	const includeForex = showForexToggle ? isTrueQueryParam(router.query.includeForex) : true
	const rowsBeforeUserFilters = useMemo(() => {
		if (assetClassFilter != null) {
			return props.data.markets.filter((market) => market.assetClass?.[0] === assetClassFilter)
		}
		if (showForexToggle && !includeForex) {
			return props.data.markets.filter((market) => market.assetClass?.[0] !== FOREX_ASSET_CLASS)
		}
		return props.data.markets
	}, [assetClassFilter, includeForex, props.data.markets, showForexToggle])
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
	const isRowsFiltered = currentRows !== props.data.markets
	const computedTotals = useMemo(
		() =>
			isRowsFiltered
				? {
						openInterest: sumMarketMetric(currentRows, 'openInterest'),
						openInterestChange24h: getAggregateOpenInterestChange24h(currentRows),
						volume24h: sumMarketMetric(currentRows, 'volume24h'),
						volume24hChange24h: getAggregateVolume24hChange24h(currentRows),
						markets: currentRows.length,
						protocolFees24h: sumProtocolFees24h(currentRows)
					}
				: null,
		[currentRows, isRowsFiltered]
	)
	const displayTotals = computedTotals ?? props.data.totals
	const timeSeriesAssetClass = assetClassFilter
	const timeSeriesExcludeAssetClass = showForexToggle && !includeForex ? FOREX_ASSET_CLASS : undefined
	const onToggleIncludeForex = () => {
		void pushShallowQuery(router, { includeForex: includeForex ? undefined : 'true' })
	}
	const initialChartDataset = props.data.initialChartDataset
	const venueLabel = isVenueMode ? props.data.venue : undefined
	const targetQueryValue = isVenueMode ? props.data.venue : isAssetGroupMode ? props.data.assetGroup : 'all'
	const timeSeriesSource = hasActiveMarketFilters
		? 'market-breakdown'
		: chartState.breakdown === 'contract'
			? 'contract-breakdown'
			: 'overview-breakdown'
	const timeSeriesClassParams = {
		...(timeSeriesAssetClass ? { assetClass: timeSeriesAssetClass } : {}),
		...(timeSeriesExcludeAssetClass ? { excludeAssetClass: timeSeriesExcludeAssetClass } : {})
	}
	const timeSeriesTargetParams = {
		...(isVenueMode ? { venue: props.data.venue } : {}),
		...(isAssetGroupMode ? { assetGroup: props.data.assetGroup } : {})
	}
	const isDefaultTimeSeriesState =
		chartState.view === 'timeSeries' &&
		chartState.metric === 'openInterest' &&
		chartState.breakdown === getDefaultRWAPerpsChartBreakdown(props.mode, 'timeSeries', chartDefaults)
	const hasPreloadedTimeSeriesDataset =
		initialChartDataset.source.length > 0 ||
		initialChartDataset.dimensions.some((dimension) => dimension !== 'timestamp')
	const canUseInitialTimeSeriesDataset = !hasActiveMarketFilters && (!showForexToggle || !includeForex)
	const shouldUseInitialTimeSeriesDataset =
		isDefaultTimeSeriesState && hasPreloadedTimeSeriesDataset && canUseInitialTimeSeriesDataset

	const timeSeriesQuery = useQuery({
		queryKey: [
			'rwa-perps-chart',
			props.mode,
			chartState.metric,
			chartState.breakdown,
			targetQueryValue,
			timeSeriesAssetClass,
			timeSeriesExcludeAssetClass,
			timeSeriesSource
		],
		queryFn: () => {
			switch (timeSeriesSource) {
				case 'market-breakdown':
					return fetchMarketTimeSeriesDataset({
						key: chartState.metric,
						...timeSeriesClassParams
					})
				case 'contract-breakdown':
					return fetchContractTimeSeriesDataset({
						key: chartState.metric,
						...timeSeriesTargetParams,
						...timeSeriesClassParams
					})
				case 'overview-breakdown':
					return fetchOverviewTimeSeriesDataset({
						breakdown: chartState.breakdown as IRWAPerpsOverviewBreakdownRequest['breakdown'],
						key: chartState.metric,
						...timeSeriesTargetParams,
						...timeSeriesClassParams
					})
			}
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: chartState.view === 'timeSeries' && !shouldUseInitialTimeSeriesDataset && currentRows.length > 0
	})

	const fetchedTimeSeriesDataset =
		chartState.view === 'timeSeries' && shouldUseInitialTimeSeriesDataset
			? initialChartDataset
			: (timeSeriesQuery.data ?? EMPTY_DATASET)
	const rawTimeSeriesDataset = hasActiveMarketFilters
		? buildRWAPerpsTimeSeriesDatasetForRows({
				dataset: fetchedTimeSeriesDataset,
				rows: currentRows,
				mode: props.mode,
				breakdown: chartState.breakdown as RWAPerpsTimeSeriesBreakdownForMode,
				seriesKey: 'id'
			})
		: fetchedTimeSeriesDataset
	const shouldShowTotalOverlay = chartState.timeSeriesMode === 'breakdown' && chartState.metric !== 'volume24h'
	const ungroupedTimeSeriesDataset =
		chartState.timeSeriesMode === 'grouped'
			? groupRWAPerpsTimeSeriesDataset(rawTimeSeriesDataset)
			: shouldShowTotalOverlay
				? appendRWAPerpsTimeSeriesDatasetTotal(rawTimeSeriesDataset)
				: rawTimeSeriesDataset
	const selectedTimeSeriesDataset = useMemo(
		() =>
			chartState.metric === 'volume24h'
				? groupMultiSeriesBarChartDataset({ dataset: ungroupedTimeSeriesDataset, groupBy: volumeGroupBy })
				: ungroupedTimeSeriesDataset,
		[chartState.metric, ungroupedTimeSeriesDataset, volumeGroupBy]
	)

	const timeSeriesCharts = buildRWAPerpsTimeSeriesCharts({
		metric: chartState.metric,
		dimensions: selectedTimeSeriesDataset.dimensions,
		timeSeriesMode: chartState.timeSeriesMode
	})
	const timeSeriesLegendNames = useMemo(
		() => getLegendSeriesNames(timeSeriesCharts.map((series) => series.name)),
		[timeSeriesCharts]
	)

	const snapshotBreakdownRows = useMemo(
		() =>
			props.mode === 'overview'
				? buildRWAPerpsOverviewSnapshotBreakdownTotals({
						rows: currentRows,
						breakdown: chartState.breakdown as RWAPerpsOverviewSnapshotBreakdown,
						key: chartState.metric
					})
				: props.mode === 'venue'
					? buildRWAPerpsVenueSnapshotBreakdownTotals({
							rows: currentRows,
							breakdown: chartState.breakdown as RWAPerpsVenueSnapshotBreakdown,
							key: chartState.metric
						})
					: buildRWAPerpsAssetGroupSnapshotBreakdownTotals({
							rows: currentRows,
							breakdown: chartState.breakdown as RWAPerpsAssetGroupSnapshotBreakdown,
							key: chartState.metric
						}),
		[chartState.breakdown, chartState.metric, currentRows, props.mode]
	)

	const pieChartData = useMemo(
		() => preparePieChartData({ data: snapshotBreakdownRows, limit: 10 }),
		[snapshotBreakdownRows]
	)
	const deferredPieChartData = useDeferredValue(pieChartData)
	const deferredTimeSeriesDataset = useDeferredValue(selectedTimeSeriesDataset)
	const hasTimeSeriesHistory = useMemo(() => hasEnoughTimeSeriesHistory(rawTimeSeriesDataset), [rawTimeSeriesDataset])
	const pieChartColors = useMemo(() => {
		const colorMap: Record<string, string> = {}
		for (const [index, item] of deferredPieChartData.entries()) {
			colorMap[item.name] = CHART_COLORS[index % CHART_COLORS.length]
		}
		return colorMap
	}, [deferredPieChartData])

	const barChartData = useMemo(() => limitRwaHorizontalBarData(deferredPieChartData), [deferredPieChartData])

	const treemapTreeData = useMemo(
		() =>
			buildRWAPerpsTreemapTreeData({
				mode: props.mode,
				markets: currentRows,
				metric: chartState.metric,
				parentGrouping: treemapBreakdown,
				nestedBy: chartState.treemapNestedBy,
				venueLabel
			}),
		[chartState.metric, chartState.treemapNestedBy, currentRows, props.mode, treemapBreakdown, venueLabel]
	)
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
			: `${props.data.assetGroup} RWA Perps`
	const filenameBase = isOverviewMode
		? 'rwa-perps-overview'
		: isVenueMode
			? `rwa-perps-venue-${props.data.venue}`
			: `rwa-perps-asset-group-${props.data.assetGroup}`
	const timeSeriesFilename = `${filenameBase}-time-series-${chartState.metric}-${chartState.breakdown}-${chartState.timeSeriesMode}`
	const nonTimeSeriesFilename = `${filenameBase}-${chartState.view}-${chartState.metric}-${chartState.breakdown}`

	const onSelectView = (value: string | string[]) => {
		const selectedView = (Array.isArray(value) ? value[0] : value) as typeof chartState.view
		const nextState = setRWAPerpsChartView(chartState, selectedView)
		void pushShallowQuery(router, {
			chartView: getRWAPerpsChartViewQueryValueForMode(props.mode, nextState.view),
			timeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults) : undefined,
			nonTimeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? undefined : getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults)
		})
	}

	const onSelectBreakdown = (value: string | string[]) => {
		const selectedBreakdown = Array.isArray(value) ? value[0] : value
		if (chartState.view === 'timeSeries') {
			if (selectedBreakdown === 'total') {
				const nextState = setRWAPerpsTimeSeriesMode(chartState, 'grouped')
				void pushShallowQuery(router, {
					timeSeriesChartBreakdown: getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults),
					timeSeriesMode: getRWAPerpsTimeSeriesModeQueryValue(nextState.timeSeriesMode)
				})
				return
			}

			const nextState = setRWAPerpsTimeSeriesMode(
				setRWAPerpsChartBreakdown(chartState, selectedBreakdown as typeof chartState.breakdown),
				'breakdown'
			)
			void pushShallowQuery(router, {
				timeSeriesChartBreakdown: getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults),
				timeSeriesMode: getRWAPerpsTimeSeriesModeQueryValue(nextState.timeSeriesMode)
			})
			return
		}

		const nextState = setRWAPerpsChartBreakdown(chartState, selectedBreakdown as typeof chartState.breakdown)
		void pushShallowQuery(router, {
			timeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults) : undefined,
			nonTimeSeriesChartBreakdown:
				nextState.view === 'timeSeries' ? undefined : getRWAPerpsChartBreakdownQueryValue(nextState, chartDefaults)
		})
	}

	const onSelectTreemapNestedBy = (value: string | string[]) => {
		const selectedNestedBy = (Array.isArray(value) ? value[0] : value) as typeof chartState.treemapNestedBy
		const nextState = setRWAPerpsTreemapNestedBy(chartState, selectedNestedBy)
		void pushShallowQuery(router, {
			treemapNestedBy: getRWAPerpsTreemapNestedByQueryValue(nextState)
		})
	}

	const timeSeriesMetricSwitch = (
		<SegmentedControl
			value={chartState.metric}
			onValueChange={(key) => void pushShallowQuery(router, { chartType: getRWAPerpsChartMetricQueryValue(key) })}
			options={chartMetricOptions.map(({ key, name }) => ({ value: key, label: name }))}
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
					value: formattedNum(displayTotals.openInterest, true),
					change: displayTotals.openInterestChange24h,
					changeTooltip: d.openInterestChange24h.description
				},
				{
					label: d.totalVolume24h.label,
					tooltip: d.totalVolume24h.description,
					value: formattedNum(displayTotals.volume24h, true),
					change: displayTotals.volume24hChange24h,
					changeTooltip: d.volume24hChange24h.description
				},
				{
					label: d.totalMarkets.label,
					tooltip: d.totalMarkets.description,
					value: formattedNum(displayTotals.markets, false)
				},
				{
					label: d.estimatedProtocolFees24h.label,
					tooltip: d.estimatedProtocolFees24h.description,
					value: formattedNum(displayTotals.protocolFees24h, true)
				}
			]
		: [
				{
					label: d.openInterest.label,
					tooltip: d.openInterest.description,
					value: formattedNum(displayTotals.openInterest, true),
					change: displayTotals.openInterestChange24h,
					changeTooltip: d.openInterestChange24h.description
				},
				{
					label: d.volume24h.label,
					tooltip: d.volume24h.description,
					value: formattedNum(displayTotals.volume24h, true),
					change: displayTotals.volume24hChange24h,
					changeTooltip: d.volume24hChange24h.description
				},
				{
					label: d.markets.label,
					tooltip: d.markets.description,
					value: formattedNum(displayTotals.markets, false)
				},
				{
					label: d.estimatedProtocolFees24h.label,
					tooltip: d.estimatedProtocolFees24h.description,
					value: formattedNum(displayTotals.protocolFees24h, true)
				}
			]

	return (
		<div className="flex flex-col gap-2">
			{isVenueMode ? (
				<RowLinksWithDropdown links={props.data.venueLinks} activeLink={props.data.venue} />
			) : isAssetGroupMode ? (
				<RowLinksWithDropdown links={props.data.assetGroupLinks} activeLink={props.data.assetGroup} />
			) : null}
			{showForexToggle ? (
				<>
					<Card padding="sm" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						<p className="body-sm text-tertiary">
							The RWA Perpetuals Dashboard only covers real world assets such as stocks, RWA tokens, forex, and other
							significant financial indices on decentralized exchanges. This excludes digital assets such as BTC or ETH
							perpetual contracts and all RWA perpetual contracts on centralized exchanges.
						</p>
					</Card>
				</>
			) : null}
			<RWAPerpsMarketFilters
				filters={visibleMarketFilters}
				showForexToggle={showForexToggle}
				includeForex={includeForex}
				onToggleIncludeForex={onToggleIncludeForex}
			/>
			<div className="flex flex-col gap-2 md:flex-row md:items-center">
				{statCards.map((card) => (
					<StatCard
						key={card.label}
						label={card.label}
						tooltip={card.tooltip}
						value={card.value}
						change={card.change}
						changeTooltip={card.changeTooltip}
					/>
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
							label={
								chartViewOptions.find((option) => option.key === chartState.view)?.name ?? chartViewOptions[0].name
							}
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
									void pushShallowQuery(router, { groupBy: getRWAPerpsVolumeGroupByQueryValue(nextGroupBy) })
								}}
							/>
						) : null}
						<ChartExportButtons
							chartInstance={timeSeriesChartInstance}
							filename={timeSeriesFilename}
							title={`${pageLabel} ${chartMetricLabel}`}
							smol
						/>
					</ChartPanelToolbar>
					{timeSeriesQuery.error ? (
						<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
							{getErrorMessage(timeSeriesQuery.error)}
						</ChartPanelBodyFallback>
					) : timeSeriesQuery.isLoading && !shouldUseInitialTimeSeriesDataset ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
							Loading
							<LoadingDots />
						</ChartPanelBodyFallback>
					) : !hasTimeSeriesHistory ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
							Only a single snapshot is available; time-series history is not available for this selection yet.
						</ChartPanelBodyFallback>
					) : (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart2
								dataset={deferredTimeSeriesDataset}
								charts={timeSeriesCharts}
								chartOptions={{ legend: { data: timeSeriesLegendNames } }}
								hideDefaultLegend={false}
								showTotalInTooltip={!deferredTimeSeriesDataset.dimensions.includes('Total')}
								groupBy={chartState.metric === 'volume24h' ? volumeGroupBy : undefined}
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
							label={
								chartViewOptions.find((option) => option.key === chartState.view)?.name ?? chartViewOptions[0].name
							}
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
						/>
					</ChartPanelToolbar>
					{snapshotBreakdownRows.length === 0 ? (
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
				columns={isOverviewMode ? overviewColumns : isVenueMode ? venueColumns : assetGroupColumns}
				placeholder={
					isOverviewMode
						? 'Search markets or assets...'
						: isVenueMode
							? 'Search venue markets...'
							: 'Search asset-group markets...'
				}
				columnToSearch="contract"
				header={
					isOverviewMode ? 'Markets Rankings' : `${isVenueMode ? props.data.venue : props.data.assetGroup} Markets`
				}
				headingAs="h1"
				sortingState={[{ id: 'openInterest', desc: true }]}
				columnVisibility={
					isOverviewMode ? overviewColumnVisibility : isVenueMode ? venueColumnVisibility : assetGroupColumnVisibility
				}
				rowSize={56}
				compact
				showColumnSelect
				csvFileName={
					isOverviewMode
						? 'rwa-perps-overview-markets'
						: isVenueMode
							? `rwa-perps-${props.data.venue}-markets`
							: `rwa-perps-${props.data.assetGroup}-markets`
				}
			/>
		</div>
	)
}
