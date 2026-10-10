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

export function YieldFilterDropdowns({
	pathname,
	chainList,
	evmChains,
	projectList,
	projectGroups,
	projectsLabel,
	categoriesLabel,
	categoryList,
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
					{...(evmChains ? { evmChains } : {})}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
				/>
			) : null}

			{projectList && projectList.length > 0 ? (
				<YieldProjects
					projectList={projectList}
					{...(projectGroups ? { projectGroups } : {})}
					label={projectsLabel ?? 'Projects'}
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
				/>
			) : null}

			{categoryList && categoryList.length > 0 ? (
				<FiltersByCategory
					categoryList={categoryList}
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
					quickPicks={tvlRange}
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

			{apyRange ? (
				<APYRange
					{...(nestedMenu !== undefined ? { nestedMenu } : {})}
					placement="bottom-start"
					quickPicks={apyRange}
				/>
			) : null}

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
					quickPicks={availableRange}
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
