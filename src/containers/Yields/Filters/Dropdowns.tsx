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

const EMPTY_CHAINS: Array<string> = []
const EMPTY_PROJECTS: Array<string> = []
const EMPTY_CATEGORIES: Array<string> = []
const TVL_MIN_PRESETS = [100_000, 500_000, 1_000_000, 10_000_000]

export function YieldFilterDropdowns({
	pathname,
	chainList,
	selectedChains,
	evmChains,
	projectList,
	projectGroups,
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
	showColumns,
	defaultColumns
}: IDropdownMenusProps) {
	const router = useRouter()

	const effectivePathname = pathname || router.pathname
	return (
		<>
			{chainList && chainList.length > 0 ? (
				<FilterByChain
					chainList={chainList}
					selectedChains={selectedChains ?? EMPTY_CHAINS}
					{...(evmChains ? { evmChains } : {})}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
				/>
			) : null}

			{projectList && projectList.length > 0 ? (
				<YieldProjects
					projectList={projectList}
					{...(projectGroups ? { projectGroups } : {})}
					selectedProjects={selectedProjects ?? EMPTY_PROJECTS}
					label={projectsLabel ?? 'Projects'}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
					includeQueryKey="protocol"
					excludeQueryKey="excludeProtocol"
				/>
			) : null}

			{categoryList && categoryList.length > 0 ? (
				<FiltersByCategory
					categoryList={categoryList}
					selectedCategories={selectedCategories ?? EMPTY_CATEGORIES}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
					{...(categoriesLabel ? { label: categoriesLabel } : {})}
				/>
			) : null}

			{attributeIds ? (
				<YieldAttributesSelect attributeIds={attributeIds} {...(nestedMenu !== undefined ? { nestedMenu } : {})} />
			) : null}

			{tvlRange ? (
				<TVLRange
					{...(tvlRangeLabel ? { label: tvlRangeLabel } : {})}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
					variant="secondary"
					placement="bottom-start"
					minPresets={TVL_MIN_PRESETS}
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

			{apyRange ? <APYRange {...(nestedMenu !== undefined ? { nestedMenu } : {})} placement="bottom-start" /> : null}

			{showColumns ? (
				<ColumnsSelect
					{...(defaultColumns ? { defaultColumns } : {})}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
				/>
			) : null}

			{availableRange ? (
				<AvailableRange
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
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
					nestedMenu={nestedMenu ?? false}
					{...(resetFiltersLabel ? { label: resetFiltersLabel } : {})}
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
