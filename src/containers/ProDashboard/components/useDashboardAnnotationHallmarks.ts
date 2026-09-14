import { useMemo } from 'react'
import type { DashboardAnnotation } from '../dashboardTypes'
import { useProDashboardAnnotations } from '../ProDashboardAPIContext'

export type ChartHallmark = [number, string]

export function annotationToHallmark(annotation: DashboardAnnotation, inMs = false): ChartHallmark | null {
	const timestampMs = Date.parse(`${annotation.date}T00:00:00Z`)
	if (!Number.isFinite(timestampMs)) return null
	return [inMs ? timestampMs : Math.floor(timestampMs / 1000), annotation.label]
}

export function mergeHallmarks(
	cardHallmarks: Array<ChartHallmark> | undefined,
	annotationHallmarks: Array<ChartHallmark>
): Array<ChartHallmark> | undefined {
	if (annotationHallmarks.length === 0) return cardHallmarks && cardHallmarks.length > 0 ? cardHallmarks : undefined
	const sortedAnnotations = annotationHallmarks.toSorted((a, b) => a[0] - b[0])
	return cardHallmarks && cardHallmarks.length > 0 ? [...cardHallmarks, ...sortedAnnotations] : sortedAnnotations
}

export function useDashboardAnnotationHallmarks(
	cardHallmarks?: Array<ChartHallmark>,
	{ inMs = false }: { inMs?: boolean } = {}
): Array<ChartHallmark> | undefined {
	const { annotations } = useProDashboardAnnotations()
	return useMemo(() => {
		const annotationHallmarks: Array<ChartHallmark> = []
		for (const annotation of annotations) {
			const hallmark = annotationToHallmark(annotation, inMs)
			if (hallmark) annotationHallmarks.push(hallmark)
		}
		return mergeHallmarks(cardHallmarks, annotationHallmarks)
	}, [annotations, cardHallmarks, inMs])
}
