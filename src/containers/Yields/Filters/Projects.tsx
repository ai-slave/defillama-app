import { useRouter } from 'next/router'
import { useRef } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'

interface IYieldProjectsProps {
	projectList: Array<string>
	selectedProjects: Array<string>
	label?: string
	nestedMenu?: boolean
	includeQueryKey: string
	excludeQueryKey: ExcludeQueryKey
}

export function YieldProjects({
	projectList,
	selectedProjects,
	label,
	nestedMenu,
	includeQueryKey,
	excludeQueryKey
}: IYieldProjectsProps) {
	const router = useRouter()
	// Read the badge state off whichever key this dropdown emits (v2 `protocol`, others `project`).
	const selectedQueryValue = router.query[includeQueryKey]
	const prevSelectionRef = useRef<Set<string>>(new Set(selectedProjects))

	return (
		<SelectWithCombobox
			variant="default"
			size="sm"
			allValues={projectList}
			selectedValues={selectedProjects}
			label={label}
			nestedMenu={nestedMenu}
			labelType={!selectedQueryValue || selectedQueryValue === 'All' ? 'none' : 'regular'}
			includeQueryKey={includeQueryKey}
			excludeQueryKey={excludeQueryKey}
			pushQueryUpdates={(updates) => {
				void pushYieldsQuery(router, updates)
			}}
			onValuesChange={(values) => {
				const prevSet = prevSelectionRef.current
				for (const projectName of values) {
					if (!prevSet.has(projectName)) {
						trackYieldsEvent(YIELDS_EVENTS.FILTER_PROJECT, { project: projectName })
					}
				}
				prevSelectionRef.current = new Set(values)
			}}
		/>
	)
}
