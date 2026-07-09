import {
	type ColumnDef,
	type ColumnFiltersState,
	createColumnHelper,
	functionalUpdate,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	type VisibilityState,
	useReactTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PaginatedTable, usePaginatedTableDisplayRowNumber } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import defs from '~/public/equities-definitions.json'
import { buttonStyles } from '~/ui/Button'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { abbreviateNumber } from '~/utils'
import { equityCountryFlagUrl } from '~/utils/icons'
import { readSingleQueryValue, pushShallowQuery } from '~/utils/routerQuery'
import { EquitiesFiltersDialog, EquityActiveFilterPills } from './EquityFiltersDialog'
import {
	EQUITY_FILTERS_QUERY_KEY,
	filterEquityCompanies,
	parseEquityFiltersQuery,
	serializeEquityFiltersQuery,
	type EquityActiveFilter
} from './filters'
import {
	applyEquityFilterColumnVisibility,
	getEquityFilterDefaultSorting,
	shouldUpdateEquityFilterDefaultSorting
} from './tableVisibility'
import type { IEquitiesListCompanyRow, IEquitiesListPageProps } from './types'
import { formatEquitiesDateTime } from './utils'

type EquitiesTableCompanyRow = IEquitiesListCompanyRow & { searchPriority?: number }

const columnHelper = createColumnHelper<EquitiesTableCompanyRow>()
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 50

function formatNumber(value: unknown, symbol?: string): string {
	return abbreviateNumber(value, 2, symbol) ?? '-'
}

function ChangePercent({ value }: { value: number | null }) {
	return (
		<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
			{formatNumber(value, '%')}
		</span>
	)
}

function ChangeValue({ value, symbol }: { value: number | null; symbol?: string }) {
	return (
		<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
			{formatNumber(value, symbol)}
		</span>
	)
}

function EquityTickerCell({ row }: { row: { id: string; original: EquitiesTableCompanyRow } }) {
	const rowIndex = usePaginatedTableDisplayRowNumber(row.id)

	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className="inline-block min-w-4 shrink-0 text-left text-secondary tabular-nums" aria-hidden="true">
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

const columns: ColumnDef<EquitiesTableCompanyRow>[] = [
	columnHelper.accessor((row) => row.searchPriority ?? 0, {
		id: 'searchPriority',
		header: 'Search Priority',
		meta: {
			hidden: true,
			headerClassName: 'w-[0px] min-w-[0px]'
		}
	}),
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
					className="hidden h-6 w-6 rounded-full object-contain lg:block"
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
	columnHelper.accessor('marketCap', {
		header: defs.marketCap.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
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
	columnHelper.accessor('currentPrice', {
		header: defs.currentPrice.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[96px] min-w-[96px]',
			align: 'end',
			headerHelperText: defs.currentPrice.description
		}
	}),
	columnHelper.accessor('fiftyTwoWeekHigh', {
		header: defs.fiftyTwoWeekHigh.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'end',
			headerHelperText: defs.fiftyTwoWeekHigh.description
		}
	}),
	columnHelper.accessor('fiftyTwoWeekLow', {
		header: defs.fiftyTwoWeekLow.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'end',
			headerHelperText: defs.fiftyTwoWeekLow.description
		}
	}),
	columnHelper.accessor('priceChangePercentage1d', {
		header: defs.priceChangePercentage1d.label,
		cell: ({ getValue }) => <ChangePercent value={getValue()} />,
		meta: {
			headerClassName: 'w-[153px] min-w-[153px]',
			align: 'end',
			headerHelperText: defs.priceChangePercentage1d.description
		}
	}),
	columnHelper.accessor('priceChangePercentage7d', {
		header: defs.priceChangePercentage7d.label,
		cell: ({ getValue }) => <ChangePercent value={getValue()} />,
		meta: {
			headerClassName: 'w-[156px] min-w-[156px]',
			align: 'end',
			headerHelperText: defs.priceChangePercentage7d.description
		}
	}),
	columnHelper.accessor('priceChangePercentage1m', {
		header: defs.priceChangePercentage1m.label,
		cell: ({ getValue }) => <ChangePercent value={getValue()} />,
		meta: {
			headerClassName: 'w-[156px] min-w-[156px]',
			align: 'end',
			headerHelperText: defs.priceChangePercentage1m.description
		}
	}),
	columnHelper.accessor('volume', {
		header: defs.volume.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[95px] min-w-[95px]',
			align: 'end',
			headerHelperText: defs.volume.description
		}
	}),
	columnHelper.accessor('marketCapChange1d', {
		header: defs.marketCapChange1d.label,
		cell: ({ getValue }) => <ChangeValue value={getValue()} symbol="$" />,
		meta: {
			headerClassName: 'w-[196px] min-w-[196px]',
			align: 'end',
			headerHelperText: defs.marketCapChange1d.description
		}
	}),
	columnHelper.accessor('circulatingMarketCap', {
		header: defs.circulatingMarketCap.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[156px] min-w-[156px]',
			align: 'end',
			headerHelperText: defs.circulatingMarketCap.description
		}
	}),
	columnHelper.accessor('enterpriseValue', {
		header: defs.enterpriseValue.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[153px] min-w-[153px]',
			align: 'end',
			headerHelperText: defs.enterpriseValue.description
		}
	}),
	columnHelper.accessor('trailingPE', {
		header: defs.trailingPE.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[87px] min-w-[87px]',
			align: 'end',
			headerHelperText: defs.trailingPE.description
		}
	}),
	columnHelper.accessor('priceToRevenue', {
		header: defs.priceToRevenue.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[87px] min-w-[87px]',
			align: 'end',
			headerHelperText: defs.priceToRevenue.description
		}
	}),
	columnHelper.accessor('dividendYield', {
		header: defs.dividendYield.label,
		cell: ({ getValue }) => formatNumber(getValue(), '%'),
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
			align: 'end',
			headerHelperText: defs.dividendYield.description
		}
	}),
	columnHelper.accessor('holdersYield', {
		header: defs.holdersYield.label,
		cell: ({ getValue }) => formatNumber(getValue(), '%'),
		meta: {
			headerClassName: 'w-[133px] min-w-[133px]',
			align: 'end',
			headerHelperText: defs.holdersYield.description
		}
	}),
	columnHelper.accessor('priceToBook', {
		header: defs.priceToBook.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[87px] min-w-[87px]',
			align: 'end',
			headerHelperText: defs.priceToBook.description
		}
	}),
	columnHelper.accessor('enterpriseValueToEbitda', {
		header: defs.enterpriseValueToEbitda.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[118px] min-w-[118px]',
			align: 'end',
			headerHelperText: defs.enterpriseValueToEbitda.description
		}
	}),
	columnHelper.accessor('operatingProfitMarginTTM', {
		header: defs.operatingProfitMarginTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '%'),
		meta: {
			headerClassName: 'w-[163px] min-w-[163px]',
			align: 'end',
			headerHelperText: defs.operatingProfitMarginTTM.description
		}
	}),
	columnHelper.accessor('revenueTTM', {
		header: defs.revenueTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[147px] min-w-[147px]',
			align: 'end',
			headerHelperText: defs.revenueTTM.description
		}
	}),
	columnHelper.accessor('grossProfitTTM', {
		header: defs.grossProfitTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[168px] min-w-[168px]',
			align: 'end',
			headerHelperText: defs.grossProfitTTM.description
		}
	}),
	columnHelper.accessor('earningsTTM', {
		header: defs.earningsTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[147px] min-w-[147px]',
			align: 'end',
			headerHelperText: defs.earningsTTM.description
		}
	}),
	columnHelper.accessor('ebitdaTTM', {
		header: defs.ebitdaTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[140px] min-w-[140px]',
			align: 'end',
			headerHelperText: defs.ebitdaTTM.description
		}
	}),
	columnHelper.accessor('holdersRevenueTTM', {
		header: defs.holdersRevenueTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[203px] min-w-[203px]',
			align: 'end',
			headerHelperText: defs.holdersRevenueTTM.description
		}
	}),
	columnHelper.accessor('holderEarningsTTM', {
		header: defs.holderEarningsTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[195px] min-w-[195px]',
			align: 'end',
			headerHelperText: defs.holderEarningsTTM.description
		}
	}),
	columnHelper.accessor('dividendsTTM', {
		header: defs.dividendsTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[155px] min-w-[155px]',
			align: 'end',
			headerHelperText: defs.dividendsTTM.description
		}
	}),
	columnHelper.accessor('stockRepurchaseTTM', {
		header: defs.stockRepurchaseTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[154px] min-w-[154px]',
			align: 'end',
			headerHelperText: defs.stockRepurchaseTTM.description
		}
	}),
	columnHelper.accessor('stockIssuanceTTM', {
		header: defs.stockIssuanceTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[190px] min-w-[190px]',
			align: 'end',
			headerHelperText: defs.stockIssuanceTTM.description
		}
	}),
	columnHelper.accessor('stockBasedCompensationTTM', {
		header: defs.stockBasedCompensationTTM.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[174px] min-w-[174px]',
			align: 'end',
			headerHelperText: defs.stockBasedCompensationTTM.description
		}
	}),
	columnHelper.accessor('cashAndCashEquivalents', {
		header: defs.cashAndCashEquivalents.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[136px] min-w-[136px]',
			align: 'end',
			headerHelperText: defs.cashAndCashEquivalents.description
		}
	}),
	columnHelper.accessor('totalAssets', {
		header: defs.totalAssets.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[126px] min-w-[126px]',
			align: 'end',
			headerHelperText: defs.totalAssets.description
		}
	}),
	columnHelper.accessor('totalLiabilities', {
		header: defs.totalLiabilities.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[143px] min-w-[143px]',
			align: 'end',
			headerHelperText: defs.totalLiabilities.description
		}
	}),
	columnHelper.accessor('totalShareholdersEquity', {
		header: defs.totalShareholdersEquity.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[116px] min-w-[116px]',
			align: 'end',
			headerHelperText: defs.totalShareholdersEquity.description
		}
	}),
	columnHelper.accessor('totalDebt', {
		header: defs.totalDebt.label,
		cell: ({ getValue }) => formatNumber(getValue(), '$'),
		meta: {
			headerClassName: 'w-[113px] min-w-[113px]',
			align: 'end',
			headerHelperText: defs.totalDebt.description
		}
	}),
	columnHelper.accessor('circulatingSupply', {
		header: defs.circulatingSupply.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[125px] min-w-[125px]',
			align: 'end',
			headerHelperText: defs.circulatingSupply.description
		}
	}),
	columnHelper.accessor('totalSupply', {
		header: defs.totalSupply.label,
		cell: ({ getValue }) => formatNumber(getValue()),
		meta: {
			headerClassName: 'w-[128px] min-w-[128px]',
			align: 'end',
			headerHelperText: defs.totalSupply.description
		}
	}),
	columnHelper.accessor('employeeCount', {
		header: defs.employeeCount.label,
		cell: ({ getValue }) => formatNumber(getValue()),
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

const PRESET_VISIBLE_COLUMNS: Record<EquitiesPreset, readonly string[]> = {
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
	const visibility: VisibilityState = { name: false, searchPriority: false }
	for (const id of DATA_COLUMN_IDS) {
		visibility[id] = visible.has(id)
	}
	return visibility
}

type EquitiesTableState = {
	columnFilters: ColumnFiltersState
	sorting: SortingState
	columnVisibility: VisibilityState
	pagination: PaginationState
	searchValue: string
}

function buildInitialTableState(preset: EquitiesPreset): EquitiesTableState {
	return {
		columnFilters: [],
		sorting: PRESET_SORTING[preset],
		columnVisibility: buildPresetVisibility(preset),
		pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
		searchValue: ''
	}
}

function EquitiesRankingsTable({
	preset,
	companies,
	filters,
	onFiltersChange
}: {
	preset: EquitiesPreset
	companies: IEquitiesListCompanyRow[]
	filters: EquityActiveFilter[]
	onFiltersChange: (filters: EquityActiveFilter[]) => void
}) {
	const [tableState, setTableState] = useState(() => buildInitialTableState(preset))
	const filtersQuery = useMemo(() => serializeEquityFiltersQuery(filters) ?? '', [filters])
	const handledFiltersRef = useRef({ filters, filtersQuery })
	const { columnFilters, sorting, columnVisibility, pagination, searchValue } = tableState
	const deferredSearchValue = useDeferredValue(searchValue)
	const searchQuery = deferredSearchValue.trim()

	const filteredCompanies = useMemo(() => {
		const companiesForFilters = filterEquityCompanies(companies, filters)
		const normalizedSearchQuery = searchQuery.toLowerCase()
		if (normalizedSearchQuery) {
			const tickerMatches: EquitiesTableCompanyRow[] = []
			const companyMatches: EquitiesTableCompanyRow[] = []

			for (const company of companiesForFilters) {
				if (company.ticker.toLowerCase().includes(normalizedSearchQuery)) {
					tickerMatches.push({ ...company, searchPriority: 0 })
				} else if (company.name.toLowerCase().includes(normalizedSearchQuery)) {
					companyMatches.push({ ...company, searchPriority: 1 })
				}
			}

			return tickerMatches.concat(companyMatches)
		}

		return companiesForFilters
	}, [companies, filters, searchQuery])
	const tableSorting = searchQuery
		? [{ id: 'searchPriority', desc: false }, ...sorting.filter((sort) => sort.id !== 'searchPriority')]
		: sorting
	const tableColumnVisibility = useMemo(
		() => applyEquityFilterColumnVisibility({ columnVisibility, filters }),
		[columnVisibility, filters]
	)

	const table = useReactTable({
		data: filteredCompanies,
		columns,
		state: {
			sorting: tableSorting,
			columnFilters,
			columnVisibility: tableColumnVisibility,
			pagination
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) =>
			startTransition(() =>
				setTableState((state) => ({ ...state, sorting: functionalUpdate(updater, state.sorting) }))
			),
		onColumnFiltersChange: (updater) =>
			startTransition(() =>
				setTableState((state) => ({
					...state,
					columnFilters: functionalUpdate(updater, state.columnFilters)
				}))
			),
		onColumnVisibilityChange: (updater) =>
			startTransition(() =>
				setTableState((state) => ({
					...state,
					columnVisibility: functionalUpdate(updater, state.columnVisibility)
				}))
			),
		onPaginationChange: (updater) =>
			startTransition(() =>
				setTableState((state) => ({ ...state, pagination: functionalUpdate(updater, state.pagination) }))
			),
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	const columnOptions = useMemo(() => {
		const filterColumnIds = new Set<string>()
		for (const filter of filters) {
			filterColumnIds.add(filter.id)
		}

		const options: Array<{ key: string; name: string; help?: string }> = []
		for (const column of columns) {
			if (column.meta?.hidden) continue
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
			options.push({ key, name, help })
		}
		return options
	}, [filters])

	// The Columns picker reflects and edits the user's persisted intent, not the effective
	// (filter-forced) visibility — so toggles here always persist and a filtered column shows
	// unchecked even while it is force-shown in the table.
	const selectedColumns: string[] = []
	for (const column of table.getAllLeafColumns()) {
		if (column.id === 'searchPriority') continue
		if (columnVisibility[column.id] !== false) selectedColumns.push(column.id)
	}

	const setColumnOptions = (newOptions: string[] | ((prev: string[]) => string[])) => {
		const resolvedOptions = typeof newOptions === 'function' ? newOptions(selectedColumns) : newOptions
		startTransition(() =>
			setTableState((state) => {
				const nextVisibility: VisibilityState = {}
				for (const column of table.getAllLeafColumns()) {
					nextVisibility[column.id] = resolvedOptions.includes(column.id)
				}
				return { ...state, columnVisibility: nextVisibility }
			})
		)
	}

	const setSearchValue = (value: string) => {
		setTableState((state) => ({ ...state, searchValue: value }))
	}

	const updateTableStateForFilters = useCallback(
		(previousFilters: EquityActiveFilter[], nextFilters: EquityActiveFilter[]) => {
			setTableState((state) => {
				const fallbackSorting = PRESET_SORTING[preset]
				const shouldUpdateSorting = shouldUpdateEquityFilterDefaultSorting({
					currentSorting: state.sorting,
					previousFilters,
					fallbackSorting
				})
				return {
					...state,
					sorting: shouldUpdateSorting
						? getEquityFilterDefaultSorting({ filters: nextFilters, fallbackSorting })
						: state.sorting,
					pagination: { ...state.pagination, pageIndex: 0 }
				}
			})
		},
		[preset]
	)

	useEffect(() => {
		const handledFilters = handledFiltersRef.current
		if (handledFilters.filtersQuery === filtersQuery) return

		handledFiltersRef.current = { filters, filtersQuery }
		updateTableStateForFilters(handledFilters.filters, filters)
	}, [filters, filtersQuery, updateTableStateForFilters])

	const applyFilters = (nextFilters: EquityActiveFilter[]) => {
		const nextFiltersQuery = serializeEquityFiltersQuery(nextFilters) ?? ''
		updateTableStateForFilters(filters, nextFilters)
		handledFiltersRef.current = { filters: nextFilters, filtersQuery: nextFiltersQuery }
		onFiltersChange(nextFilters)
	}

	return (
		<Panel padding="none">
			<TableToolbar className="justify-between">
				<h2 className="label-md">Company Rankings</h2>
				<TableToolbarControlGroup className="ml-auto justify-end">
					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search companies or tickers</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							onInput={(event) => setSearchValue(event.currentTarget.value)}
							placeholder="Search companies or tickers"
							className={searchFieldInputStyles}
						/>
					</label>
					<EquitiesFiltersDialog companies={companies} filters={filters} onFiltersChange={applyFilters} />
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
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance: table, filename: 'equities-rankings' })}
						smol
						size="md"
					/>
				</TableToolbarControlGroup>
			</TableToolbar>
			{filters.length > 0 ? (
				<div className="px-2 pb-2">
					<EquityActiveFilterPills
						filters={filters}
						onRemove={(id) => applyFilters(filters.filter((f) => f.id !== id))}
					/>
				</div>
			) : null}
			<PaginatedTable table={table} pageSizeOptions={PAGE_SIZE_OPTIONS} tableClassName="min-w-max!" shell="none" />
		</Panel>
	)
}

export function EquitiesOverview({ companies, updatedAt }: IEquitiesListPageProps) {
	const router = useRouter()
	const filtersQueryParam = router.query[EQUITY_FILTERS_QUERY_KEY]
	const selectedPreset = useMemo(
		() => getPresetFromQuery(readSingleQueryValue(router.query.rankBy)),
		[router.query.rankBy]
	)
	const filters = useMemo(() => parseEquityFiltersQuery(filtersQueryParam), [filtersQueryParam])
	const [isMorePresetsManuallyOpen, setIsMorePresetsManuallyOpen] = useState(false)

	const selectPreset = useCallback(
		(preset: EquitiesPreset) => {
			if (preset === selectedPreset) return
			void pushShallowQuery(router, { rankBy: PRESET_QUERY_SLUGS[preset] })
		},
		[router, selectedPreset]
	)

	const setFilters = useCallback(
		(nextFilters: EquityActiveFilter[]) => {
			void pushShallowQuery(router, {
				[EQUITY_FILTERS_QUERY_KEY]: serializeEquityFiltersQuery(nextFilters)
			})
		},
		[router]
	)

	const isMorePresetActive = EQUITIES_MORE_PRESETS.some((preset) => preset === selectedPreset)
	const showMorePresets = isMorePresetActive || isMorePresetsManuallyOpen

	const presetButtonClassName = buttonStyles({ variant: 'filter', size: 'sm' })

	const renderPreset = (preset: EquitiesPreset) => (
		<button
			key={preset}
			type="button"
			aria-current={preset === selectedPreset ? 'page' : undefined}
			data-active={preset === selectedPreset}
			data-umami-event="equities-preset-click"
			data-umami-event-preset={PRESET_QUERY_SLUGS[preset] ?? 'market-cap'}
			className={presetButtonClassName}
			onClick={() => selectPreset(preset)}
		>
			{preset}
		</button>
	)

	return (
		<div className="flex flex-col gap-2">
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
			<div className="hidden flex-wrap items-center justify-center gap-2 sm:flex">
				<span className="text-sm font-medium text-secondary">Rank by</span>
				{EQUITIES_PRIMARY_PRESETS.map(renderPreset)}
				{showMorePresets ? (
					<>
						{EQUITIES_MORE_PRESETS.map(renderPreset)}
						{isMorePresetsManuallyOpen && !isMorePresetActive ? (
							<button
								type="button"
								aria-expanded={true}
								onClick={() => setIsMorePresetsManuallyOpen(false)}
								className={presetButtonClassName}
							>
								<Icon name="minus" height={12} width={12} />
								Less
							</button>
						) : null}
					</>
				) : (
					<button
						type="button"
						aria-expanded={false}
						data-active={isMorePresetActive}
						onClick={() => setIsMorePresetsManuallyOpen(true)}
						className={presetButtonClassName}
					>
						+ More
					</button>
				)}
			</div>

			<EquitiesRankingsTable
				key={selectedPreset}
				preset={selectedPreset}
				companies={companies}
				filters={filters}
				onFiltersChange={setFilters}
			/>

			<p className="px-1 body-sm text-tertiary">
				Market and statements data provided by{' '}
				<a href="https://twelvedata.com" target="_blank" rel="noopener noreferrer" className="underline">
					Twelve Data
				</a>
				. Filings data from SEC EDGAR.
				{updatedAt ? <span suppressHydrationWarning> Updated {formatEquitiesDateTime(updatedAt)}.</span> : null}
			</p>
		</div>
	)
}
