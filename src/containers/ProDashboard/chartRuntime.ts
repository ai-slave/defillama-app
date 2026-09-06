import type { ChartConfig, ChartSubject } from './types'

export interface ChartRuntimeState {
	data: Array<[number, number]>
	isLoading: boolean
	hasError: boolean
	canRetry: boolean
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
	isError: boolean
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
		return { data: EMPTY_CHART_DATA, isLoading: true, hasError: false, canRetry: false, refetch: query.refetch }
	}
	if (prerequisite.status === 'error') {
		return {
			data: EMPTY_CHART_DATA,
			isLoading: false,
			hasError: true,
			canRetry: true,
			refetch: prerequisite.retry
		}
	}
	if (prerequisite.status === 'unavailable') {
		return { data: EMPTY_CHART_DATA, isLoading: false, hasError: false, canRetry: false, refetch: query.refetch }
	}
	const hasError = query.isError && query.data === undefined
	return {
		data: query.data ?? EMPTY_CHART_DATA,
		isLoading: query.isLoading || (!streamDone && query.data === undefined),
		hasError,
		canRetry: hasError,
		refetch: query.refetch
	}
}
