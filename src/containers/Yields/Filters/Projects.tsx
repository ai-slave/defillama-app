import { useRouter } from 'next/router'
import { useRef } from 'react'
import { readSelectionFromQuery, updateQueryFromSelected } from '~/components/Select/query'
import type { SelectOption } from '~/ui/Select'
import { describeSelection, SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'
import type { ProjectGroup } from './types'

const EMPTY_GROUPS: Array<ProjectGroup> = []
const GROUP_KEY_PREFIX = 'group:'

interface IYieldProjectsProps {
	projectList: Array<string>
	projectGroups?: Array<ProjectGroup>
	label?: string
	nestedMenu?: boolean
}

export function YieldProjects({ projectList, projectGroups = EMPTY_GROUPS, label, nestedMenu }: IYieldProjectsProps) {
	const router = useRouter()
	const selectedProjects = readSelectionFromQuery(router.query, 'protocol', 'excludeProtocol', projectList)
	const prevSelectionRef = useRef<Set<string>>(new Set(selectedProjects))

	const selectedSet = new Set(selectedProjects)
	const groupByFirstProject = new Map<string, ProjectGroup>()
	const projectToGroup = new Map<string, ProjectGroup>()
	for (const group of projectGroups) {
		groupByFirstProject.set(group.projects[0]!, group)
		for (const project of group.projects) projectToGroup.set(project, group)
	}
	const isGroupSelected = (group: ProjectGroup) => group.projects.every((project) => selectedSet.has(project))

	const options: Array<SelectOption> = []
	for (const project of projectList) {
		const group = groupByFirstProject.get(project)
		if (group) {
			options.push({
				key: `${GROUP_KEY_PREFIX}${group.name}`,
				name: group.name,
				icon: <span className="label-xs text-tertiary">Combined</span>
			})
		}
		options.push({ key: project, name: project })
	}

	const displaySelected = [...selectedProjects]
	const selectedLabels: Array<string> = []
	for (const group of projectGroups) {
		if (isGroupSelected(group)) {
			displaySelected.push(`${GROUP_KEY_PREFIX}${group.name}`)
			selectedLabels.push(group.name)
		}
	}
	for (const project of selectedProjects) {
		const group = projectToGroup.get(project)
		if (!group || !isGroupSelected(group)) selectedLabels.push(project)
	}

	// Same trigger text as other URL pickers: "None", or "All except …" when fewer are left out than kept.
	const leftOut = projectList.length - selectedProjects.length
	const summarize = selectedProjects.length === 0 || (leftOut > 0 && leftOut < selectedProjects.length)

	const handleValuesChange = (values: Array<string>) => {
		const prev = new Set(displaySelected)
		const next = new Set<string>()
		for (const value of values) {
			if (!value.startsWith(GROUP_KEY_PREFIX)) next.add(value)
		}
		const selectedAll = values.length === options.length
		const addedByGroup = new Set<string>()
		for (const group of projectGroups) {
			const key = `${GROUP_KEY_PREFIX}${group.name}`
			const wasOn = prev.has(key)
			const isOn = values.includes(key)
			// A still-checked group with none of its versions left is "Only" on that group.
			const onlyGroup = isOn && wasOn && !group.projects.some((project) => next.has(project))
			if ((isOn && !wasOn) || onlyGroup) {
				for (const project of group.projects) {
					next.add(project)
					addedByGroup.add(project)
				}
				if (!selectedAll) trackYieldsEvent(YIELDS_EVENTS.FILTER_PROJECT, { project: group.name })
			} else if (wasOn && !isOn && group.projects.every((project) => next.has(project))) {
				for (const project of group.projects) next.delete(project)
			}
		}
		const prevSet = prevSelectionRef.current
		for (const project of next) {
			if (!selectedAll && !prevSet.has(project) && !addedByGroup.has(project)) {
				trackYieldsEvent(YIELDS_EVENTS.FILTER_PROJECT, { project })
			}
		}
		prevSelectionRef.current = next
		updateQueryFromSelected(router, 'protocol', 'excludeProtocol', projectList, [...next], undefined, {
			pushQueryUpdates: (updates) => {
				void pushYieldsQuery(router, updates)
			}
		})
	}

	return (
		<SelectWithCombobox
			heading={label ?? 'Projects'}
			variant="default"
			size="sm"
			allValues={options}
			selectedValues={displaySelected}
			selectedLabels={summarize ? [describeSelection(projectList, selectedProjects)] : selectedLabels}
			setSelectedValues={handleValuesChange}
			label={label ?? 'Projects'}
			{...(nestedMenu !== undefined ? { nestedMenu } : {})}
			labelType={selectedProjects.length === projectList.length ? 'none' : 'regular'}
		/>
	)
}
