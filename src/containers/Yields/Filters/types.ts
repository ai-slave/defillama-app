import type { ReactNode } from 'react'
import type { AttributeId } from './attributeOptions'

type YieldCsvPayload = {
	filename: string
	rows: Array<Array<string | number | boolean | null | undefined>>
}
type PrepareYieldCsv = () => YieldCsvPayload | Promise<YieldCsvPayload>

export interface IDropdownMenusProps {
	pathname?: string
	chainList?: Array<string>
	selectedChains?: Array<string>
	evmChains?: Array<string>
	projectList?: Array<string>
	selectedProjects?: Array<string>
	// Opt-in label override for the Projects dropdown (/yields uses "Protocols").
	// Defaults to "Projects" — every other page keeps the shared label.
	projectsLabel?: string
	// Opt-in label override for the Categories dropdown (/yields uses "Categories").
	// Defaults to "Category" — every other page keeps the shared label.
	categoriesLabel?: string
	categoryList?: Array<string>
	selectedCategories?: Array<string>
	attributeIds?: AttributeId[]
	tvlRange?: boolean
	// Opt-in (/yields): trigger label override for the TVL range (defaults to 'TVL Range').
	tvlRangeLabel?: string
	// Opt-in (/yields pages): label override for the reset button (defaults to 'Reset all filters').
	resetFiltersLabel?: string
	apyRange?: boolean
	availableRange?: boolean
	resetFilters?: boolean
	nestedMenu?: boolean
	prepareCsv?: PrepareYieldCsv
	showColumns?: boolean
}

export interface IYieldFiltersProps extends IDropdownMenusProps {
	saveView?: boolean
	showSearchOnMobile?: boolean
	prepareCsv?: PrepareYieldCsv
	tokenSearch?: ReactNode
	apyControls?: ReactNode
	curatedViews?: ReactNode
	watchlist?: boolean
}
