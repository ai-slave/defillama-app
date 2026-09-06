import {
	type ColumnDef,
	createColumnHelper,
	functionalUpdate,
	getCoreRowModel,
	type SortingState,
	type VisibilityState,
	useReactTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PaginatedTable, usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { TokenLogo } from '~/components/TokenLogo'
import { ViewTabs, viewTabIds, type ViewTab } from '~/components/ViewTabs'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import defs from '~/public/equities-definitions.json'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatDateTime } from '~/utils/dateFormat'
import { equityCountryFlagUrl } from '~/utils/icons'
import { readSingleQueryValue, pushShallowQuery } from '~/utils/routerQuery'
import { prepareEquitiesCsv, type EquitiesCsvColumn } from './csv'
import { EquitiesFiltersDialog, EquityActiveFilterPills } from './EquityFiltersDialog'
import {
	EQUITY_FILTERS_QUERY_KEY,
	parseEquityFiltersQuery,
	serializeEquityFiltersQuery,
	type EquityActiveFilter
} from './filters'
import { formatEquitiesCompactValue } from './financialsFormatting'
import { isSortingEqual } from './tableQuery'
import {
	applyEquityFilterColumnVisibility,
	getEquityFilterDefaultSorting,
	shouldUpdateEquityFilterDefaultSorting
} from './tableVisibility'
import { EquitiesTreemapSection } from './TreemapSection'
import { getEquitiesTreemapQueryValue, parseEquitiesTreemapState, type EquitiesPageView } from './treemapState'
import type { IEquitiesListCompanyRow, IEquitiesListPageProps } from './types'
import { useEquitiesServerTable } from './useEquitiesServerTable'

const columnHelper = createColumnHelper<IEquitiesListCompanyRow>()
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

function ChangePercent({ value }: { value: number | null }) {
	return (
		<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
			{formatEquitiesCompactValue(value, '%') ?? '-'}
		</span>
	)
}

function ChangeValue({ value, symbol }: { value: number | null; symbol?: string }) {
	return (
		<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
			{formatEquitiesCompactValue(value, symbol) ?? '-'}
		</span>
	)
}

function EquityTickerCell({ row }: { row: { id: string; original: IEquitiesListCompanyRow } }) {
	const rowIndex = usePaginatedTableDisplayRowNumber(row.id)

	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="inline-block min-w-4 shrink-0 text-left text-secondary" aria-hidden="true">
				{rowIndex}
			</span>
			<TokenLogo
				kind="equities"
				name={row.original.ticker}
				country={row.original.country}
				data-lgonly
				alt={`Logo of ${row.original.ticker}`}
			/>
			<BasicLink href={row.original.href} className="font-medium text-link">
				{row.original.ticker}
			</BasicLink>
		</span>
	)
}

const columns: Array<ColumnDef<IEquitiesListCompanyRow>> = [
	columnHelper.accessor('ticker', {
		header: 'Ticker',
		enableSorting: false,
		cell: ({ row }) => <EquityTickerCell row={row} />,
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'start'
		}
	}),
	columnHelper.accessor('country', {
		header: 'Country',
		enableSorting: false,
		cell: ({ getValue }) => (
			<span className="flex items-center gap-2">
				<img
					src={equityCountryFlagUrl(getValue())}
					alt={`${getValue()} flag`}
					className="hidden size-6 rounded-full object-contain lg:block"
					height={24}
					width={24}
				/>
				<span>{getValue()}</span>
			</span>
		),
		meta: {
			headerClassName: 'w-[76px] min-w-[76px] lg:w-[88px] lg:min-w-[88px] ',
			align: 'start'
		}
	}),
	columnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: defs.marketCap.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[121px] min-w-[121px]',
			align: 'end',
			headerHelperText: defs.marketCap.description
		}
	}),
	columnHelper.accessor('name', {
		header: 'Company',
		enableSorting: false,
		cell: ({ getValue, row }) => (
			<BasicLink href={row.original.href} className="text-link">
				{getValue()}
			</BasicLink>
		),
		meta: {
			headerClassName: 'w-[180px] min-w-[180px]',
			cellClassName: 'truncate',
			align: 'start'
		}
	}),
	columnHelper.accessor('sector', {
		header: 'Sector',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[170px] min-w-[170px]',
			cellClassName: 'truncate',
			align: 'start'
		}
	}),
	columnHelper.accessor('industry', {
		header: 'Industry',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[170px] min-w-[170px]',
			cellClassName: 'truncate',
			align: 'start'
		}
	}),
	columnHelper.accessor((row) => row.currentPrice ?? undefined, {
		id: 'currentPrice',
		header: defs.currentPrice.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[96px] min-w-[96px]',
			align: 'end',
			headerHelperText: defs.currentPrice.description
		}
	}),
	columnHelper.accessor((row) => row.fiftyTwoWeekHigh ?? undefined, {
		id: 'fiftyTwoWeekHigh',
		header: defs.fiftyTwoWeekHigh.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'end',
			headerHelperText: defs.fiftyTwoWeekHigh.description
		}
	}),
	columnHelper.accessor((row) => row.fiftyTwoWeekLow ?? undefined, {
		id: 'fiftyTwoWeekLow',
		header: defs.fiftyTwoWeekLow.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'end',
			headerHelperText: defs.fiftyTwoWeekLow.description
		}
	}),
	columnHelper.accessor((row) => row.priceChangePercentage1d ?? undefined, {
		id: 'priceChangePercentage1d',
		header: defs.priceChangePercentage1d.label,
		cell: ({ getValue }) => <ChangePercent value={getValue() ?? null} />,
		meta: {
			headerClassName: 'w-[153px] min-w-[153px]',
			align: 'end',
			headerHelperText: defs.priceChangePercentage1d.description
		}
	}),
	columnHelper.accessor((row) => row.priceChangePercentage7d ?? undefined, {
		id: 'priceChangePercentage7d',
		header: defs.priceChangePercentage7d.label,
		cell: ({ getValue }) => <ChangePercent value={getValue() ?? null} />,
		meta: {
			headerClassName: 'w-[156px] min-w-[156px]',
			align: 'end',
			headerHelperText: defs.priceChangePercentage7d.description
		}
	}),
	columnHelper.accessor((row) => row.priceChangePercentage1m ?? undefined, {
		id: 'priceChangePercentage1m',
		header: defs.priceChangePercentage1m.label,
		cell: ({ getValue }) => <ChangePercent value={getValue() ?? null} />,
		meta: {
			headerClassName: 'w-[156px] min-w-[156px]',
			align: 'end',
			headerHelperText: defs.priceChangePercentage1m.description
		}
	}),
	columnHelper.accessor((row) => row.volume ?? undefined, {
		id: 'volume',
		header: defs.volume.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[95px] min-w-[95px]',
			align: 'end',
			headerHelperText: defs.volume.description
		}
	}),
	columnHelper.accessor((row) => row.marketCapChange1d ?? undefined, {
		id: 'marketCapChange1d',
		header: defs.marketCapChange1d.label,
		cell: ({ getValue }) => <ChangeValue value={getValue() ?? null} symbol="$" />,
		meta: {
			headerClassName: 'w-[196px] min-w-[196px]',
			align: 'end',
			headerHelperText: defs.marketCapChange1d.description
		}
	}),
	columnHelper.accessor((row) => row.circulatingMarketCap ?? undefined, {
		id: 'circulatingMarketCap',
		header: defs.circulatingMarketCap.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[156px] min-w-[156px]',
			align: 'end',
			headerHelperText: defs.circulatingMarketCap.description
		}
	}),
	columnHelper.accessor((row) => row.enterpriseValue ?? undefined, {
		id: 'enterpriseValue',
		header: defs.enterpriseValue.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[153px] min-w-[153px]',
			align: 'end',
			headerHelperText: defs.enterpriseValue.description
		}
	}),
	columnHelper.accessor((row) => row.trailingPE ?? undefined, {
		id: 'trailingPE',
		header: defs.trailingPE.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[87px] min-w-[87px]',
			align: 'end',
			headerHelperText: defs.trailingPE.description
		}
	}),
	columnHelper.accessor((row) => row.priceToRevenue ?? undefined, {
		id: 'priceToRevenue',
		header: defs.priceToRevenue.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[87px] min-w-[87px]',
			align: 'end',
			headerHelperText: defs.priceToRevenue.description
		}
	}),
	columnHelper.accessor((row) => row.dividendYield ?? undefined, {
		id: 'dividendYield',
		header: defs.dividendYield.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '%') ?? '-',
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
			align: 'end',
			headerHelperText: defs.dividendYield.description
		}
	}),
	columnHelper.accessor((row) => row.holdersYield ?? undefined, {
		id: 'holdersYield',
		header: defs.holdersYield.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '%') ?? '-',
		meta: {
			headerClassName: 'w-[133px] min-w-[133px]',
			align: 'end',
			headerHelperText: defs.holdersYield.description
		}
	}),
	columnHelper.accessor((row) => row.priceToBook ?? undefined, {
		id: 'priceToBook',
		header: defs.priceToBook.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[87px] min-w-[87px]',
			align: 'end',
			headerHelperText: defs.priceToBook.description
		}
	}),
	columnHelper.accessor((row) => row.enterpriseValueToEbitda ?? undefined, {
		id: 'enterpriseValueToEbitda',
		header: defs.enterpriseValueToEbitda.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[118px] min-w-[118px]',
			align: 'end',
			headerHelperText: defs.enterpriseValueToEbitda.description
		}
	}),
	columnHelper.accessor((row) => row.operatingProfitMarginTTM ?? undefined, {
		id: 'operatingProfitMarginTTM',
		header: defs.operatingProfitMarginTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '%') ?? '-',
		meta: {
			headerClassName: 'w-[163px] min-w-[163px]',
			align: 'end',
			headerHelperText: defs.operatingProfitMarginTTM.description
		}
	}),
	columnHelper.accessor((row) => row.revenueTTM ?? undefined, {
		id: 'revenueTTM',
		header: defs.revenueTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[147px] min-w-[147px]',
			align: 'end',
			headerHelperText: defs.revenueTTM.description
		}
	}),
	columnHelper.accessor((row) => row.grossProfitTTM ?? undefined, {
		id: 'grossProfitTTM',
		header: defs.grossProfitTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[168px] min-w-[168px]',
			align: 'end',
			headerHelperText: defs.grossProfitTTM.description
		}
	}),
	columnHelper.accessor((row) => row.earningsTTM ?? undefined, {
		id: 'earningsTTM',
		header: defs.earningsTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[147px] min-w-[147px]',
			align: 'end',
			headerHelperText: defs.earningsTTM.description
		}
	}),
	columnHelper.accessor((row) => row.ebitdaTTM ?? undefined, {
		id: 'ebitdaTTM',
		header: defs.ebitdaTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
			align: 'end',
			headerHelperText: defs.ebitdaTTM.description
		}
	}),
	columnHelper.accessor((row) => row.holdersRevenueTTM ?? undefined, {
		id: 'holdersRevenueTTM',
		header: defs.holdersRevenueTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[203px] min-w-[203px]',
			align: 'end',
			headerHelperText: defs.holdersRevenueTTM.description
		}
	}),
	columnHelper.accessor((row) => row.holderEarningsTTM ?? undefined, {
		id: 'holderEarningsTTM',
		header: defs.holderEarningsTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[195px] min-w-[195px]',
			align: 'end',
			headerHelperText: defs.holderEarningsTTM.description
		}
	}),
	columnHelper.accessor((row) => row.dividendsTTM ?? undefined, {
		id: 'dividendsTTM',
		header: defs.dividendsTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[155px] min-w-[155px]',
			align: 'end',
			headerHelperText: defs.dividendsTTM.description
		}
	}),
	columnHelper.accessor((row) => row.stockRepurchaseTTM ?? undefined, {
		id: 'stockRepurchaseTTM',
		header: defs.stockRepurchaseTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[154px] min-w-[154px]',
			align: 'end',
			headerHelperText: defs.stockRepurchaseTTM.description
		}
	}),
	columnHelper.accessor((row) => row.stockIssuanceTTM ?? undefined, {
		id: 'stockIssuanceTTM',
		header: defs.stockIssuanceTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[190px] min-w-[190px]',
			align: 'end',
			headerHelperText: defs.stockIssuanceTTM.description
		}
	}),
	columnHelper.accessor((row) => row.stockBasedCompensationTTM ?? undefined, {
		id: 'stockBasedCompensationTTM',
		header: defs.stockBasedCompensationTTM.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[174px] min-w-[174px]',
			align: 'end',
			headerHelperText: defs.stockBasedCompensationTTM.description
		}
	}),
	columnHelper.accessor((row) => row.cashAndCashEquivalents ?? undefined, {
		id: 'cashAndCashEquivalents',
		header: defs.cashAndCashEquivalents.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[136px] min-w-[136px]',
			align: 'end',
			headerHelperText: defs.cashAndCashEquivalents.description
		}
	}),
	columnHelper.accessor((row) => row.totalAssets ?? undefined, {
		id: 'totalAssets',
		header: defs.totalAssets.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[126px] min-w-[126px]',
			align: 'end',
			headerHelperText: defs.totalAssets.description
		}
	}),
	columnHelper.accessor((row) => row.totalLiabilities ?? undefined, {
		id: 'totalLiabilities',
		header: defs.totalLiabilities.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[143px] min-w-[143px]',
			align: 'end',
			headerHelperText: defs.totalLiabilities.description
		}
	}),
	columnHelper.accessor((row) => row.totalShareholdersEquity ?? undefined, {
		id: 'totalShareholdersEquity',
		header: defs.totalShareholdersEquity.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[116px] min-w-[116px]',
			align: 'end',
			headerHelperText: defs.totalShareholdersEquity.description
		}
	}),
	columnHelper.accessor((row) => row.totalDebt ?? undefined, {
		id: 'totalDebt',
		header: defs.totalDebt.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[113px] min-w-[113px]',
			align: 'end',
			headerHelperText: defs.totalDebt.description
		}
	}),
	columnHelper.accessor((row) => row.circulatingSupply ?? undefined, {
		id: 'circulatingSupply',
		header: defs.circulatingSupply.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[125px] min-w-[125px]',
			align: 'end',
			headerHelperText: defs.circulatingSupply.description
		}
	}),
	columnHelper.accessor((row) => row.totalSupply ?? undefined, {
		id: 'totalSupply',
		header: defs.totalSupply.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'end',
			headerHelperText: defs.totalSupply.description
		}
	}),
	columnHelper.accessor((row) => row.employeeCount ?? undefined, {
		id: 'employeeCount',
		header: defs.employeeCount.label,
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue()) ?? '-',
		meta: {
			headerClassName: 'w-[117px] min-w-[117px]',
			align: 'end',
			headerHelperText: defs.employeeCount.description
		}
	})
]

const EQUITIES_PRIMARY_PRESETS = [
	'Market Cap',
	'Earnings',
	'Revenue',
	'Employees',
	'P/E ratio',
	'Dividend %',
	'Market Cap gain',
	'Market Cap loss',
	'Operating Margin'
] as const

const EQUITIES_MORE_PRESETS = [
	'Holder Yield',
	'Enterprise Value',
	'Total assets',
	'Total liabilities',
	'Net Assets',
	'Total debt',
	'Cash on hand',
	'Price to Book'
] as const

const EQUITIES_PRESETS = [...EQUITIES_PRIMARY_PRESETS, ...EQUITIES_MORE_PRESETS] as const

type EquitiesPreset = (typeof EQUITIES_PRESETS)[number]

const PRESET_QUERY_SLUGS: Record<EquitiesPreset, string | undefined> = {
	'Market Cap': undefined,
	Earnings: 'earnings',
	Revenue: 'revenue',
	Employees: 'employees',
	'P/E ratio': 'pe-ratio',
	'Dividend %': 'dividend',
	'Market Cap gain': 'market-cap-gain',
	'Market Cap loss': 'market-cap-loss',
	'Operating Margin': 'operating-margin',
	'Holder Yield': 'holder-yield',
	'Enterprise Value': 'enterprise-value',
	'Total assets': 'total-assets',
	'Total liabilities': 'total-liabilities',
	'Net Assets': 'net-assets',
	'Total debt': 'total-debt',
	'Cash on hand': 'cash-on-hand',
	'Price to Book': 'price-to-book'
}

const DATA_COLUMN_IDS = [
	'country',
	'sector',
	'industry',
	'currentPrice',
	'fiftyTwoWeekHigh',
	'fiftyTwoWeekLow',
	'priceChangePercentage1d',
	'priceChangePercentage7d',
	'priceChangePercentage1m',
	'volume',
	'marketCap',
	'marketCapChange1d',
	'circulatingMarketCap',
	'enterpriseValue',
	'trailingPE',
	'priceToRevenue',
	'dividendYield',
	'holdersYield',
	'priceToBook',
	'enterpriseValueToEbitda',
	'operatingProfitMarginTTM',
	'revenueTTM',
	'grossProfitTTM',
	'earningsTTM',
	'ebitdaTTM',
	'holdersRevenueTTM',
	'holderEarningsTTM',
	'dividendsTTM',
	'stockRepurchaseTTM',
	'stockIssuanceTTM',
	'stockBasedCompensationTTM',
	'cashAndCashEquivalents',
	'totalAssets',
	'totalLiabilities',
	'totalShareholdersEquity',
	'totalDebt',
	'circulatingSupply',
	'totalSupply',
	'employeeCount'
] as const

const PRESET_VISIBLE_COLUMNS: Record<EquitiesPreset, ReadonlyArray<string>> = {
	'Market Cap': [
		'country',
		'marketCap',
		'currentPrice',
		'priceChangePercentage1d',
		'priceChangePercentage7d',
		'priceChangePercentage1m',
		'volume'
	],
	Employees: ['country', 'employeeCount', 'marketCap', 'revenueTTM', 'currentPrice'],
	Earnings: [
		'country',
		'earningsTTM',
		'ebitdaTTM',
		'holderEarningsTTM',
		'trailingPE',
		'enterpriseValueToEbitda',
		'marketCap'
	],
	Revenue: [
		'country',
		'revenueTTM',
		'grossProfitTTM',
		'holdersRevenueTTM',
		'priceToRevenue',
		'operatingProfitMarginTTM',
		'marketCap'
	],
	'P/E ratio': ['country', 'trailingPE', 'currentPrice', 'earningsTTM', 'marketCap', 'priceToBook'],
	'Dividend %': ['country', 'dividendYield', 'currentPrice', 'marketCap', 'trailingPE'],
	'Market Cap gain': ['country', 'marketCapChange1d', 'marketCap', 'priceChangePercentage1d', 'currentPrice', 'volume'],
	'Market Cap loss': ['country', 'marketCapChange1d', 'marketCap', 'priceChangePercentage1d', 'currentPrice', 'volume'],
	'Holder Yield': ['country', 'holdersYield', 'dividendsTTM', 'stockRepurchaseTTM', 'stockIssuanceTTM', 'marketCap'],
	'Operating Margin': [
		'country',
		'operatingProfitMarginTTM',
		'revenueTTM',
		'grossProfitTTM',
		'earningsTTM',
		'marketCap'
	],
	'Enterprise Value': [
		'country',
		'enterpriseValue',
		'enterpriseValueToEbitda',
		'ebitdaTTM',
		'totalDebt',
		'cashAndCashEquivalents',
		'marketCap'
	],
	'Total assets': ['country', 'totalAssets', 'totalLiabilities', 'totalDebt', 'marketCap', 'currentPrice'],
	'Total liabilities': [
		'country',
		'totalLiabilities',
		'totalAssets',
		'totalShareholdersEquity',
		'totalDebt',
		'marketCap',
		'currentPrice'
	],
	'Net Assets': ['country', 'totalShareholdersEquity', 'totalAssets', 'totalLiabilities', 'totalDebt', 'marketCap'],
	'Total debt': ['country', 'totalDebt', 'totalLiabilities', 'totalAssets', 'cashAndCashEquivalents', 'marketCap'],
	'Cash on hand': ['country', 'cashAndCashEquivalents', 'totalDebt', 'totalLiabilities', 'totalAssets', 'marketCap'],
	'Price to Book': ['country', 'priceToBook', 'currentPrice', 'marketCap', 'totalAssets']
}

const PRESET_SORTING: Record<EquitiesPreset, SortingState> = {
	'Market Cap': [{ id: 'marketCap', desc: true }],
	Earnings: [{ id: 'earningsTTM', desc: true }],
	Revenue: [{ id: 'revenueTTM', desc: true }],
	Employees: [{ id: 'employeeCount', desc: true }],
	'P/E ratio': [{ id: 'trailingPE', desc: true }],
	'Dividend %': [{ id: 'dividendYield', desc: true }],
	'Market Cap gain': [{ id: 'marketCapChange1d', desc: true }],
	'Market Cap loss': [{ id: 'marketCapChange1d', desc: false }],
	'Holder Yield': [{ id: 'holdersYield', desc: true }],
	'Operating Margin': [{ id: 'operatingProfitMarginTTM', desc: true }],
	'Enterprise Value': [{ id: 'enterpriseValue', desc: true }],
	'Total assets': [{ id: 'totalAssets', desc: true }],
	'Total liabilities': [{ id: 'totalLiabilities', desc: true }],
	'Net Assets': [{ id: 'totalShareholdersEquity', desc: true }],
	'Total debt': [{ id: 'totalDebt', desc: true }],
	'Cash on hand': [{ id: 'cashAndCashEquivalents', desc: true }],
	'Price to Book': [{ id: 'priceToBook', desc: true }]
}

function getPresetFromQuery(value?: string): EquitiesPreset {
	if (!value) return 'Market Cap'
	const match = EQUITIES_PRESETS.find((p) => PRESET_QUERY_SLUGS[p] === value)
	return match ?? 'Market Cap'
}

function buildPresetVisibility(preset: EquitiesPreset): VisibilityState {
	const visible = new Set(PRESET_VISIBLE_COLUMNS[preset])
	const visibility: VisibilityState = { name: false }
	for (const id of DATA_COLUMN_IDS) {
		visibility[id] = visible.has(id)
	}
	return visibility
}

type EquitiesServerTable = ReturnType<typeof useEquitiesServerTable>

function EquitiesRankingsTable({
	preset,
	serverTable,
	filters,
	sharedControls,
	filterPills,
	presetsRow
}: {
	preset: EquitiesPreset
	serverTable: EquitiesServerTable
	filters: Array<EquityActiveFilter>
	sharedControls: ReactNode
	filterPills: ReactNode
	presetsRow: ReactNode
}) {
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => buildPresetVisibility(preset))
	const tableColumnVisibility = useMemo(
		() => applyEquityFilterColumnVisibility({ columnVisibility, filters }),
		[columnVisibility, filters]
	)

	const table = useReactTable({
		data: serverTable.rows,
		columns,
		state: {
			sorting: serverTable.sorting,
			columnVisibility: tableColumnVisibility,
			pagination: serverTable.pagination
		},
		enableSortingRemoval: false,
		manualPagination: true,
		manualSorting: true,
		rowCount: serverTable.total,
		onSortingChange: serverTable.onSortingChange,
		onPaginationChange: serverTable.onPaginationChange,
		onColumnVisibilityChange: (updater) =>
			startTransition(() => setColumnVisibility((old) => functionalUpdate(updater, old))),
		getCoreRowModel: getCoreRowModel()
	})

	const columnOptions = useMemo(() => {
		const filterColumnIds = new Set<string>()
		for (const filter of filters) {
			filterColumnIds.add(filter.id)
		}

		const options: Array<{ key: string; name: string; help?: string }> = []
		for (const column of columns) {
			const key = column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')
			if (!key) continue
			const name = typeof column.header === 'function' ? key : column.header != null ? String(column.header) : key
			const help =
				[
					column.meta?.headerHelperText,
					filterColumnIds.has(key) ? 'Visible while this column has an active filter.' : undefined
				]
					.filter(Boolean)
					.join(' ') || undefined
			options.push({ key, name, ...(help === undefined ? {} : { help }) })
		}
		return options
	}, [filters])

	// The Columns picker reflects and edits the user's persisted intent, not the effective
	// (filter-forced) visibility — so toggles here always persist and a filtered column shows
	// unchecked even while it is force-shown in the table.
	const selectedColumns: Array<string> = []
	for (const column of table.getAllLeafColumns()) {
		if (columnVisibility[column.id] !== false) selectedColumns.push(column.id)
	}

	const setColumnOptions = (newOptions: Array<string> | ((prev: Array<string>) => Array<string>)) => {
		const resolvedOptions = typeof newOptions === 'function' ? newOptions(selectedColumns) : newOptions
		startTransition(() =>
			setColumnVisibility(() => {
				const nextVisibility: VisibilityState = {}
				for (const column of table.getAllLeafColumns()) {
					nextVisibility[column.id] = resolvedOptions.includes(column.id)
				}
				return nextVisibility
			})
		)
	}

	const prepareCsv = () => {
		const csvColumns: Array<EquitiesCsvColumn> = table.getVisibleLeafColumns().map((column) => ({
			id: column.id as keyof IEquitiesListCompanyRow,
			header: typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id
		}))
		return prepareEquitiesCsv({ query: serverTable.query, sorting: serverTable.sorting, columns: csvColumns })
	}

	return (
		<>
			<TableToolbar>
				{sharedControls}
				<TableToolbarControlGroup className="ml-auto justify-end">
					<SelectWithCombobox
						allValues={columnOptions}
						selectedValues={selectedColumns}
						setSelectedValues={setColumnOptions}
						nestedMenu={false}
						label="Columns"
						labelType="smol"
						variant="filter-responsive"
						size="md"
					/>
					<CSVDownloadButton prepareCsv={prepareCsv} smol size="md" />
				</TableToolbarControlGroup>
			</TableToolbar>
			{filterPills}
			{presetsRow}
			<PaginatedTable
				table={table}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				tableClassName="min-w-max!"
				shell="none"
				interactionDisabled={serverTable.rowsQuery.isFetching}
			/>
		</>
	)
}

/** Uncontrolled so typing stays instant; the URL (and the fetch) update after a debounce. */
function EquitiesSearchInput({ search, updateSearch }: { search: string; updateSearch: (search: string) => void }) {
	const inputRef = useRef<HTMLInputElement>(null)
	const debouncedUpdateSearch = useDebouncedCallback(updateSearch, 300)

	useEffect(() => {
		const input = inputRef.current
		// Sync only on external URL changes (back navigation, a removed pill); the URL holds the trimmed
		// value, so comparing the raw field would rewrite it and eat a trailing space mid-phrase.
		if (input && input.value.trim() !== search) input.value = search
	}, [search])

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				debouncedUpdateSearch.cancel()
				updateSearch(inputRef.current?.value.trim() ?? '')
			}}
			className={searchFieldInlineWrapperStyles}
		>
			<label className="relative block min-w-0">
				<span className="sr-only">Search companies or tickers</span>
				<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
				<input
					ref={inputRef}
					name="search"
					defaultValue={search}
					onInput={(event) => debouncedUpdateSearch(event.currentTarget.value.trim())}
					placeholder="Search companies or tickers"
					className={searchFieldInputStyles}
				/>
			</label>
		</form>
	)
}

const VIEW_TABS: ReadonlyArray<ViewTab<EquitiesPageView>> = [
	{ id: 'table', label: 'Table' },
	{ id: 'map', label: 'Market Map' }
]
const VIEW_TABS_ID_PREFIX = 'equities-view'

export function EquitiesOverview({ initialData, initialDataGeneratedAt }: IEquitiesListPageProps) {
	const router = useRouter()
	const filtersQueryParam = router.query[EQUITY_FILTERS_QUERY_KEY]
	const selectedPreset = getPresetFromQuery(readSingleQueryValue(router.query.rankBy))
	const presetSorting = PRESET_SORTING[selectedPreset]
	const { view } = parseEquitiesTreemapState(router.query)
	const serverTable = useEquitiesServerTable({
		initialData,
		initialDataGeneratedAt,
		presetSorting,
		enabled: view === 'table'
	})
	const filters = useMemo(() => parseEquityFiltersQuery(filtersQueryParam), [filtersQueryParam])
	const [isMorePresetsManuallyOpen, setIsMorePresetsManuallyOpen] = useState(false)

	// A preset change resets any hand-picked sort back to the preset's own, as the remount did before.
	const selectPreset = useCallback(
		(preset: EquitiesPreset) => {
			if (preset === selectedPreset) return
			void pushShallowQuery(router, {
				rankBy: PRESET_QUERY_SLUGS[preset],
				sortBy: undefined,
				sortDesc: undefined,
				page: undefined
			})
		},
		[router, selectedPreset]
	)

	const currentSorting = serverTable.sorting
	const setFilters = useCallback(
		(nextFilters: Array<EquityActiveFilter>) => {
			const update: Record<string, string | undefined> = {
				[EQUITY_FILTERS_QUERY_KEY]: serializeEquityFiltersQuery(nextFilters),
				page: undefined
			}
			if (
				shouldUpdateEquityFilterDefaultSorting({
					currentSorting,
					previousFilters: filters,
					fallbackSorting: presetSorting
				})
			) {
				const nextSorting = getEquityFilterDefaultSorting({ filters: nextFilters, fallbackSorting: presetSorting })
				const isPresetSort = isSortingEqual(nextSorting, presetSorting)
				update.sortBy = isPresetSort ? undefined : nextSorting[0].id
				update.sortDesc = isPresetSort || nextSorting[0].desc ? undefined : 'false'
			}
			void pushShallowQuery(router, update)
		},
		[currentSorting, filters, presetSorting, router]
	)

	const setView = useCallback(
		(next: EquitiesPageView) => {
			void pushShallowQuery(router, { view: getEquitiesTreemapQueryValue('view', next) })
		},
		[router]
	)

	const isMorePresetActive = EQUITIES_MORE_PRESETS.some((preset) => preset === selectedPreset)
	const showMorePresets = isMorePresetActive || isMorePresetsManuallyOpen

	const renderPreset = (preset: EquitiesPreset) => (
		<Button
			key={preset}
			type="button"
			aria-current={preset === selectedPreset ? 'page' : undefined}
			data-active={preset === selectedPreset}
			data-umami-event="equities-preset-click"
			data-umami-event-preset={PRESET_QUERY_SLUGS[preset] ?? 'market-cap'}
			variant="toggle"
			size="sm"
			onClick={() => selectPreset(preset)}
		>
			{preset}
		</Button>
	)

	const sharedControls = (
		<TableToolbarControlGroup>
			<EquitiesSearchInput search={serverTable.search} updateSearch={serverTable.updateSearch} />
			<EquitiesFiltersDialog categoricalOptions={serverTable.options} filters={filters} onFiltersChange={setFilters} />
		</TableToolbarControlGroup>
	)
	const filterPills =
		filters.length > 0 ? (
			<div className="px-2 pb-2">
				<EquityActiveFilterPills filters={filters} onRemove={(id) => setFilters(filters.filter((f) => f.id !== id))} />
			</div>
		) : null
	const presetsRow = (
		<div className="px-2 pb-2">
			{/* Mobile: collapsible drawer toggled purely by the native <details> element */}
			<details className="group rounded-xl border border-subtle bg-surface sm:hidden">
				<summary className="flex items-center gap-2 px-3 py-2.5">
					<span className="text-sm font-medium text-secondary">Rank by</span>
					<span className="ml-auto text-sm font-medium text-primary">{selectedPreset}</span>
					<Icon
						name="chevron-down"
						height={16}
						width={16}
						className="shrink-0 text-tertiary transition-transform duration-200 group-open:rotate-180"
					/>
				</summary>
				<div className="flex flex-wrap gap-2 border-t border-subtle p-3">{EQUITIES_PRESETS.map(renderPreset)}</div>
			</details>

			{/* Desktop: inline chips with a +More toggle */}
			<div className="hidden flex-wrap items-center gap-2 sm:flex">
				<span className="text-sm font-medium text-secondary">Rank by</span>
				{EQUITIES_PRIMARY_PRESETS.map(renderPreset)}
				{showMorePresets ? (
					<>
						{EQUITIES_MORE_PRESETS.map(renderPreset)}
						{isMorePresetsManuallyOpen && !isMorePresetActive ? (
							<Button
								type="button"
								aria-expanded
								onClick={() => setIsMorePresetsManuallyOpen(false)}
								variant="secondary"
								size="sm"
							>
								<Icon name="minus" height={12} width={12} />
								Less
							</Button>
						) : null}
					</>
				) : (
					<Button
						type="button"
						aria-expanded={false}
						data-active={isMorePresetActive}
						onClick={() => setIsMorePresetsManuallyOpen(true)}
						variant="secondary"
						size="sm"
					>
						+ More
					</Button>
				)}
			</div>
		</div>
	)
	const { tabId, panelId } = viewTabIds(VIEW_TABS_ID_PREFIX, view)
	const updatedAt = serverTable.updatedAt

	return (
		<div className="flex flex-col gap-2">
			<Panel padding="none">
				<ViewTabs
					tabs={VIEW_TABS}
					activeTab={view}
					onChange={setView}
					idPrefix={VIEW_TABS_ID_PREFIX}
					label="Equities view"
				/>
				<div role="tabpanel" id={panelId} aria-labelledby={tabId}>
					{view === 'table' ? (
						<EquitiesRankingsTable
							key={selectedPreset}
							preset={selectedPreset}
							serverTable={serverTable}
							filters={filters}
							sharedControls={sharedControls}
							filterPills={filterPills}
							presetsRow={presetsRow}
						/>
					) : (
						<EquitiesTreemapSection sharedControls={sharedControls} filterPills={filterPills} />
					)}
				</div>
			</Panel>

			<p className="px-1 body-sm text-tertiary">
				Market and statements data provided by{' '}
				<a href="https://twelvedata.com" target="_blank" rel="noopener noreferrer" className="underline">
					Twelve Data
				</a>
				. Filings data from SEC EDGAR.
				{updatedAt ? (
					<span suppressHydrationWarning>
						{' '}
						Updated {formatDateTime(updatedAt, { timeZone: 'local', timeZoneName: 'short' }) ?? '-'}.
					</span>
				) : null}
			</p>
		</div>
	)
}
