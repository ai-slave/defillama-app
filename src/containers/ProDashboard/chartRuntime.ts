import type { ChartConfig, ChartSubject } from './types'

export interface ChartRuntimeState {
	data: Array<[number, number]>
	isLoading: boolean
	hasError: boolean
	canRetry: boolean
	// The read a Try again waits on.
	isFetching: boolean
	refetch: () => void
}

export type ChartRuntimeView = ChartConfig & ChartRuntimeState

export type ChartDataPrerequisite =
	| { status: 'loading' }
	| { status: 'ready' }
	| { status: 'unavailable' }
	| { status: 'error'; retry: () => void }

interface ChartQueryResult {
	data: Array<[number, number]> | undefined
	isLoading: boolean
	isFetching: boolean
	errorUpdatedAt: number
	dataUpdatedAt: number
	refetch: () => void
}

const EMPTY_CHART_DATA: Array<[number, number]> = []
const UNAVAILABLE_CHART_DATA = { status: 'unavailable' } as const satisfies ChartDataPrerequisite

export function getChartDataPrerequisite(
	subject: ChartSubject,
	catalog: ChartDataPrerequisite,
	protocolBySlug: Pick<ReadonlyMap<string, unknown>, 'has'>
): ChartDataPrerequisite {
	if (catalog.status !== 'ready') return catalog
	return subject.subjectType === 'protocol' && !protocolBySlug.has(subject.protocol) ? UNAVAILABLE_CHART_DATA : catalog
}

export function toChartRuntimeState(
	query: ChartQueryResult,
	streamDone: boolean,
	prerequisite: ChartDataPrerequisite
): ChartRuntimeState {
	if (prerequisite.status === 'loading') {
		return {
			data: EMPTY_CHART_DATA,
			isLoading: true,
			hasError: false,
			canRetry: false,
			isFetching: false,
			refetch: query.refetch
		}
	}
	if (prerequisite.status === 'error') {
		// The catalog shows its failure only while it is not fetching; its retry loads the card again.
		return {
			data: EMPTY_CHART_DATA,
			isLoading: false,
			hasError: true,
			canRetry: true,
			isFetching: false,
			refetch: prerequisite.retry
		}
	}
	if (prerequisite.status === 'unavailable') {
		return {
			data: EMPTY_CHART_DATA,
			isLoading: false,
			hasError: false,
			canRetry: false,
			isFetching: false,
			refetch: query.refetch
		}
	}
	// Attempt times, not isError: design.md → Status states.
	const hasError = query.errorUpdatedAt > query.dataUpdatedAt && query.data === undefined
	return {
		data: query.data ?? EMPTY_CHART_DATA,
		isLoading: !hasError && (query.isLoading || (!streamDone && query.data === undefined)),
		hasError,
		canRetry: hasError,
		isFetching: query.isFetching,
		refetch: query.refetch
	}
}
