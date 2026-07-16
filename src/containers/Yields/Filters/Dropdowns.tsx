import { useRouter } from 'next/router'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { AvailableRange } from '~/components/Filters/AvailableRange'
import { TVLRange } from '~/components/Filters/TVLRange'
import { nestedMenuActionStyles } from '~/ui/Popover'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'
import { APYRange } from './APYRange'
import { YieldAttributesSelect } from './AttributesSelect'
import { FiltersByCategory } from './Categories'
import { FilterByChain } from './Chains'
import { ColumnsSelect } from './ColumnsSelect'
import { YieldProjects } from './Projects'
import { ResetAllYieldFilters } from './ResetAll'
import type { IDropdownMenusProps } from './types'

const EMPTY_CHAINS: string[] = []
const EMPTY_PROJECTS: string[] = []
const EMPTY_CATEGORIES: string[] = []

export function YieldFilterDropdowns({
	pathname,
	chainList,
	selectedChains,
	evmChains,
	projectList,
	selectedProjects,
	projectsLabel,
	categoriesLabel,
	categoryList,
	selectedCategories,
	attributeIds,
	tvlRange,
	tvlRangeLabel,
	apyRange,
	resetFilters,
	availableRange,
	nestedMenu,
	prepareCsv,
	resetFiltersLabel,
	showColumns
}: IDropdownMenusProps) {
	const router = useRouter()

	const effectivePathname = pathname || router.pathname
	return (
		<>
			{chainList && chainList.length > 0 ? (
				<FilterByChain
					chainList={chainList}
					selectedChains={selectedChains ?? EMPTY_CHAINS}
					evmChains={evmChains}
					nestedMenu={nestedMenu}
				/>
			) : null}

			{projectList && projectList.length > 0 ? (
				<YieldProjects
					projectList={projectList}
					selectedProjects={selectedProjects ?? EMPTY_PROJECTS}
					label={projectsLabel ?? 'Projects'}
					nestedMenu={nestedMenu}
					includeQueryKey="protocol"
					excludeQueryKey="excludeProtocol"
				/>
			) : null}

			{categoryList && categoryList.length > 0 ? (
				<FiltersByCategory
					categoryList={categoryList}
					selectedCategories={selectedCategories ?? EMPTY_CATEGORIES}
					nestedMenu={nestedMenu}
					label={categoriesLabel}
				/>
			) : null}

			{attributeIds ? <YieldAttributesSelect nestedMenu={nestedMenu} attributeIds={attributeIds} /> : null}

			{tvlRange ? (
				<TVLRange
					label={tvlRangeLabel}
					nestedMenu={nestedMenu}
					variant="secondary"
					placement="bottom-start"
					pushQueryUpdates={(updates) => {
						void pushYieldsQuery(router, updates, {
							pathname: effectivePathname
						})
					}}
					onValueChange={(min, max) => {
						const eventData: Record<string, number> = {}
						if (min != null) eventData.min = min
						if (max != null) eventData.max = max
						let hasEventData = false
						for (const _key in eventData) {
							hasEventData = true
							break
						}
						if (hasEventData) {
							trackYieldsEvent(YIELDS_EVENTS.FILTER_TVL_RANGE, eventData)
						}
					}}
				/>
			) : null}

			{apyRange ? <APYRange nestedMenu={nestedMenu} placement="bottom-start" /> : null}

			{showColumns ? <ColumnsSelect nestedMenu={nestedMenu} /> : null}

			{availableRange ? (
				<AvailableRange
					nestedMenu={nestedMenu}
					placement="bottom-start"
					pushQueryUpdates={(updates) => {
						void pushYieldsQuery(router, updates, {
							pathname: effectivePathname
						})
					}}
				/>
			) : null}

			{resetFilters ? (
				<ResetAllYieldFilters
					pathname={pathname || router.pathname}
					nestedMenu={nestedMenu}
					label={resetFiltersLabel}
				/>
			) : null}

			{prepareCsv && nestedMenu ? (
				<CSVDownloadButton replaceClassName className={nestedMenuActionStyles} prepareCsv={prepareCsv} />
			) : prepareCsv ? (
				<CSVDownloadButton size="md" prepareCsv={prepareCsv} />
			) : null}
		</>
	)
}
