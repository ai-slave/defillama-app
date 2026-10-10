import type { ReactNode } from 'react'
import type { AttributeId } from './attributeOptions'

type YieldCsvPayload = {
	filename: string
	rows: Array<Array<string | number | boolean | null | undefined>>
}
type PrepareYieldCsv = () => YieldCsvPayload | Promise<YieldCsvPayload>

/** A parent protocol and the `projectList` entries under it, e.g. Uniswap → V2, V3, V4. */
export type ProjectGroup = { name: string; projects: Array<string> }

export interface IDropdownMenusProps {
	pathname?: string
	chainList?: Array<string>
	evmChains?: Array<string>
	projectList?: Array<string>
	projectGroups?: Array<ProjectGroup>
	// Opt-in label override for the Projects dropdown (/yields uses "Protocols").
	// Defaults to "Projects" — every other page keeps the shared label.
	projectsLabel?: string
	// Opt-in label override for the Categories dropdown (/yields uses "Categories").
	// Defaults to "Category" — every other page keeps the shared label.
	categoriesLabel?: string
	categoryList?: Array<string>
	attributeIds?: Array<AttributeId>
	// Each range filter shows when its min chips are given; the server counts them per query (`rangeQuickPicks`).
	tvlRange?: ReadonlyArray<number>
	// Opt-in (/yields): trigger label override for the TVL range (defaults to 'TVL Range').
	tvlRangeLabel?: string
	// Optional label override (defaults to 'Clear filters').
	resetFiltersLabel?: string
	apyRange?: ReadonlyArray<number>
	availableRange?: ReadonlyArray<number>
	resetFilters?: boolean
	nestedMenu?: boolean
	prepareCsv?: PrepareYieldCsv
	showColumns?: boolean
	/** Optional columns shown when the URL does not specify a column selection. */
	defaultColumns?: ReadonlyArray<string>
}

export interface IYieldFiltersProps extends IDropdownMenusProps {
	saveView?: boolean
	showSearchOnMobile?: boolean
	prepareCsv?: PrepareYieldCsv
	tokenSearch?: ReactNode
	apyControls?: ReactNode
	curatedViews?: ReactNode
	menuHeader?: ReactNode
	mobileActions?: ReactNode
	watchlist?: boolean
}
