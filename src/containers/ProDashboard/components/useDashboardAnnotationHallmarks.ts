import { useMemo } from 'react'
import type { DashboardAnnotation } from '../dashboardTypes'
import { useProDashboardAnnotations } from '../ProDashboardAPIContext'

export type ChartHallmark = [timestampSec: number, label: string]

export function annotationToHallmark(annotation: DashboardAnnotation): ChartHallmark | null {
	const timestampMs = Date.parse(`${annotation.date}T00:00:00Z`)
	if (!Number.isFinite(timestampMs)) return null
	return [Math.floor(timestampMs / 1000), annotation.label]
}

/** The dashboard's notes as chart events, drawn on the event rail of every card that plots time. */
export function useDashboardAnnotationHallmarks(): Array<ChartHallmark> | undefined {
	const { annotations } = useProDashboardAnnotations()
	return useMemo(() => {
		const hallmarks: Array<ChartHallmark> = []
		for (const annotation of annotations) {
			const hallmark = annotationToHallmark(annotation)
			if (hallmark) hallmarks.push(hallmark)
		}
		return hallmarks.length > 0 ? hallmarks : undefined
	}, [annotations])
}
