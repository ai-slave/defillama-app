import type { QueryObserverResult } from '@tanstack/react-query'
import { queryReadFailed } from '~/utils/query'
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
	// `retrying` while the read its retry started runs; the failure stays until it succeeds.
	| { status: 'error'; retry: () => void; retrying: boolean }

interface ChartQueryResult {
	data: Array<[number, number]> | undefined
	isLoading: boolean
	isFetching: boolean
	isPlaceholderData: boolean
	errorUpdatedAt: number
	dataUpdatedAt: number
	refetch: () => void
}

const EMPTY_CHART_DATA: Array<[number, number]> = []
const UNAVAILABLE_CHART_DATA = { status: 'unavailable' } as const satisfies ChartDataPrerequisite

const READY_CHART_DATA = { status: 'ready' } as const satisfies ChartDataPrerequisite
const LOADING_CHART_DATA = { status: 'loading' } as const satisfies ChartDataPrerequisite

/** The protocol catalog that protocol cards wait on. Its failure stays through a retry, like a card's own read. */
export function getProtocolCatalogPrerequisite(
	needed: boolean,
	query: Pick<
		QueryObserverResult<unknown>,
		'data' | 'isPlaceholderData' | 'errorUpdatedAt' | 'dataUpdatedAt' | 'isFetching' | 'refetch'
	>
): ChartDataPrerequisite {
	if (!needed || query.data !== undefined) return READY_CHART_DATA
	if (queryReadFailed(query)) return { status: 'error', retry: () => void query.refetch(), retrying: query.isFetching }
	return LOADING_CHART_DATA
}

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
		// The catalog's failure stays through its retry, which loads the card again.
		return {
			data: EMPTY_CHART_DATA,
			isLoading: false,
			hasError: true,
			canRetry: true,
			isFetching: prerequisite.retrying,
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
	const hasError = queryReadFailed(query)
	return {
		data: query.data ?? EMPTY_CHART_DATA,
		isLoading: !hasError && (query.isLoading || (!streamDone && query.data === undefined)),
		hasError,
		canRetry: hasError,
		isFetching: query.isFetching,
		refetch: query.refetch
	}
}
