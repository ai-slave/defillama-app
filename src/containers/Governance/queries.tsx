import {
	GOVERNANCE_COMPOUND_API,
	GOVERNANCE_SNAPSHOT_API,
	GOVERNANCE_TALLY_API,
	governanceIdsToApis
} from '~/containers/Governance/api'
import { fetchAndFormatGovernanceData } from '~/containers/Governance/queries.client'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import type { GovernanceDataEntry, GovernanceOverviewItem, GovernanceType } from './types'

type GovernanceOverviewProject = { name: string; id: string }

type GovernanceDetailsPageData =
	| { notFound: true }
	| {
			projectName: string
			governanceData: Array<GovernanceDataEntry>
			governanceTypes: Array<GovernanceType>
	  }

type GovernanceDetailsPageDataWithProps = Exclude<GovernanceDetailsPageData, { notFound: true }>

async function fetchGovernanceDataForApis(governanceApis: Array<string>) {
	const sources = await fetchAndFormatGovernanceData(governanceApis)
	const governanceData = sources.map((source) => source.data)
	const governanceTypes = sources.map((source) => source.type)
	return { governanceData, governanceTypes }
}

type RawGovernanceOverviewMonth = {
	total: number
	successful: number
	proposals?: string[]
	states: Record<string, number>
}

type RawGovernanceOverviewItem = {
	name?: string
	proposalsCount?: number
	followersCount?: number
	strategyCount?: number
	successfulProposals?: number
	states?: Record<string, number>
	months?: Record<string, RawGovernanceOverviewMonth>
	proposalsInLast30Days?: number
	propsalsInLast30Days?: number
	successfulProposalsInLast30Days?: number
	successfulPropsalsInLast30Days?: number
}
type RawGovernanceOverview = Record<string, RawGovernanceOverviewItem>

function normalizeGovernanceOverviewItem(raw: RawGovernanceOverviewItem): GovernanceOverviewItem {
	const states = raw.states ?? {}

	const months: GovernanceOverviewItem['months'] = {}
	for (const month in raw.months) {
		const monthData = raw.months[month]
		if (monthData === undefined) continue
		const active = monthData.states.active
		const closed = monthData.states.closed
		months[month] = {
			proposals: monthData.proposals ?? [],
			states: {
				...(active !== undefined ? { active } : {}),
				...(closed !== undefined ? { closed } : {})
			}
		}
	}

	const proposalsInLast30Days = raw.proposalsInLast30Days ?? raw.propsalsInLast30Days ?? 0
	const successfulProposalsInLast30Days = raw.successfulProposalsInLast30Days ?? raw.successfulPropsalsInLast30Days ?? 0

	return {
		name: raw.name ?? '',
		proposalsCount: raw.proposalsCount ?? 0,
		followersCount: raw.followersCount ?? 0,
		strategyCount: raw.strategyCount ?? 0,
		...(raw.successfulProposals !== undefined ? { successfulProposals: raw.successfulProposals } : {}),
		states,
		months,
		proposalsInLast30Days,
		successfulProposalsInLast30Days,
		subRowData: states
	}
}

const mergeNumberRecord = (base: Record<string, number>, incoming: Record<string, number>): Record<string, number> => {
	const merged: Record<string, number> = { ...base }

	for (const key in incoming) {
		const value = incoming[key]
		if (value === undefined) continue
		merged[key] = (merged[key] ?? 0) + value
	}

	return merged
}

const mergeMonths = (
	base: GovernanceOverviewItem['months'],
	incoming: GovernanceOverviewItem['months']
): GovernanceOverviewItem['months'] => {
	const merged: GovernanceOverviewItem['months'] = { ...base }

	for (const month in incoming) {
		const monthData = incoming[month]
		if (monthData === undefined) continue
		const existingMonthData = merged[month]

		if (!existingMonthData) {
			merged[month] = monthData
			continue
		}

		const active = (existingMonthData.states.active ?? 0) + (monthData.states.active ?? 0)
		const closed = (existingMonthData.states.closed ?? 0) + (monthData.states.closed ?? 0)

		merged[month] = {
			proposals: Array.from(new Set([...existingMonthData.proposals, ...monthData.proposals])),
			states: {
				...(existingMonthData.states.active != null || monthData.states.active != null ? { active } : {}),
				...(existingMonthData.states.closed != null || monthData.states.closed != null ? { closed } : {})
			}
		}
	}

	return merged
}

const mergeGovernanceOverviewItems = (
	base: GovernanceOverviewItem,
	incoming: GovernanceOverviewItem
): GovernanceOverviewItem => {
	const proposalsCount = base.proposalsCount + incoming.proposalsCount
	const followersCount = base.followersCount + incoming.followersCount
	const strategyCount = base.strategyCount + incoming.strategyCount
	const successfulProposals = (base.successfulProposals ?? 0) + (incoming.successfulProposals ?? 0)
	const hasSuccessfulProposals = base.successfulProposals != null || incoming.successfulProposals != null

	const states = mergeNumberRecord(base.states, incoming.states)

	return {
		name: base.name || incoming.name,
		proposalsCount,
		followersCount,
		strategyCount,
		...(hasSuccessfulProposals ? { successfulProposals } : {}),
		states,
		months: mergeMonths(base.months, incoming.months),
		proposalsInLast30Days: base.proposalsInLast30Days + incoming.proposalsInLast30Days,
		successfulProposalsInLast30Days: base.successfulProposalsInLast30Days + incoming.successfulProposalsInLast30Days,
		subRowData: states
	}
}

const buildGovernanceOverviewData = (datasets: RawGovernanceOverview[]): GovernanceOverviewItem[] => {
	const mergedByProject = new Map<string, GovernanceOverviewItem>()

	for (const dataset of datasets) {
		for (const rawKey in dataset) {
			const item = dataset[rawKey]
			if (item === undefined) continue
			const normalizedItem = normalizeGovernanceOverviewItem(item)
			const projectKey = slug(normalizedItem.name || rawKey) || rawKey
			const existingItem = mergedByProject.get(projectKey)

			mergedByProject.set(
				projectKey,
				existingItem ? mergeGovernanceOverviewItems(existingItem, normalizedItem) : normalizedItem
			)
		}
	}

	return Array.from(mergedByProject.values())
}

export async function getGovernancePageData(): Promise<{ data: GovernanceOverviewItem[] }> {
	const [snapshot, compound, tally] = await Promise.all([
		fetchJson<RawGovernanceOverview>(GOVERNANCE_SNAPSHOT_API),
		fetchJson<RawGovernanceOverview>(GOVERNANCE_COMPOUND_API),
		fetchJson<RawGovernanceOverview>(GOVERNANCE_TALLY_API)
	])

	const data = buildGovernanceOverviewData([snapshot, compound, tally])

	return {
		data
	}
}

export async function getGovernanceDetailsPageData(input: {
	governanceIDs: Array<string>
	projectName: string
}): Promise<GovernanceDetailsPageDataWithProps>
export async function getGovernanceDetailsPageData(input: { project: string }): Promise<GovernanceDetailsPageData>
export async function getGovernanceDetailsPageData(
	input: { project: string } | { governanceIDs: Array<string>; projectName: string }
): Promise<GovernanceDetailsPageData> {
	// Case 1: We already know the governance IDs (protocol route).
	if ('governanceIDs' in input) {
		const governanceApis = governanceIdsToApis(input.governanceIDs ?? [])
		const { governanceData, governanceTypes } = await fetchGovernanceDataForApis(governanceApis)
		return {
			projectName: input.projectName,
			governanceData,
			governanceTypes
		}
	}

	// Case 2: We only have a project slug (governance route) and must discover IDs via overview indexes.
	const project = input.project
	const [snapshot, compound, tally] = await Promise.all([
		fetchJson<Record<string, GovernanceOverviewProject>>(GOVERNANCE_SNAPSHOT_API),
		fetchJson<Record<string, GovernanceOverviewProject>>(GOVERNANCE_COMPOUND_API),
		fetchJson<Record<string, GovernanceOverviewProject>>(GOVERNANCE_TALLY_API)
	])

	const normalizedProject = slug(project)

	const findProject = (projects: Record<string, GovernanceOverviewProject>) =>
		Object.values(projects).find((candidate) => slug(candidate.name) === normalizedProject)
	const snapshotProject = findProject(snapshot)
	const compoundProject = findProject(compound)
	const tallyProject = findProject(tally)

	if (!snapshotProject && !compoundProject && !tallyProject) {
		return { notFound: true }
	}

	// Build a list of governanceIDs, then fetch/format in parallel.
	const governanceIDs: string[] = []
	if (snapshotProject) {
		governanceIDs.push(
			snapshotProject.id.startsWith('snapshot:') ? snapshotProject.id : `snapshot:${snapshotProject.id}`
		)
	}
	if (compoundProject) {
		governanceIDs.push(
			compoundProject.id.startsWith('compound:') ? compoundProject.id : `compound:${compoundProject.id}`
		)
	}
	if (tallyProject) {
		governanceIDs.push(tallyProject.id.startsWith('tally:') ? tallyProject.id : `tally:${tallyProject.id}`)
	}

	const governanceApis = governanceIdsToApis(governanceIDs)
	const { governanceData, governanceTypes } = await fetchGovernanceDataForApis(governanceApis)

	if (!governanceData || governanceData.length === 0) return { notFound: true }

	return {
		projectName: snapshotProject?.name ?? tallyProject?.name ?? compoundProject?.name ?? project,
		governanceData,
		governanceTypes
	}
}
