import { RadarChart as ERadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts/types/dist/shared'
import { useEffect, useId, useRef } from 'react'
import { useChartResize } from '~/hooks/useChartResize'

echarts.use([ERadarChart, RadarComponent, TooltipComponent, CanvasRenderer])

export type RadarScores = {
	composite: number | null
	tradingKpis: number | null
	trustIntegration: number | null
	coverageCapabilities: number | null
	uptime: number | null
	integrationLevel: number | null
}

const SCORE_KEYS: (keyof RadarScores)[] = [
	'composite',
	'tradingKpis',
	'trustIntegration',
	'coverageCapabilities',
	'uptime',
	'integrationLevel'
]

const INDICATORS = [
	'Composite Score',
	'Trading KPIs',
	'Trust & Integration',
	'Coverage & Capabilities',
	'Uptime',
	'Integration Level'
] as const

function toValues(scores: RadarScores): number[] {
	return SCORE_KEYS.map((key) => scores[key] ?? 0)
}

export function buildRadarOption(scores: RadarScores, axisColor?: string): EChartsOption {
	const values = toValues(scores)
	return {
		tooltip: {
			trigger: 'item',
			formatter: () => INDICATORS.map((name, i) => `${name}: ${(values[i] ?? 0).toFixed(2)}`).join('<br/>')
		},
		radar: {
			indicator: INDICATORS.map((name) => ({ name, max: 10 })),
			radius: '65%',
			axisName: axisColor ? { color: axisColor } : undefined
		},
		series: [
			{
				type: 'radar',
				data: [{ value: values, areaStyle: { opacity: 0.2 } }]
			}
		]
	}
}

export function RadarChart({ scores }: { scores: RadarScores }) {
	const id = useId()
	const chartRef = useRef<echarts.ECharts | null>(null)

	useChartResize(chartRef)

	useEffect(() => {
		const chartDom = document.getElementById(id)
		if (!chartDom) return

		let instance = echarts.getInstanceByDom(chartDom)
		if (!instance) {
			instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		}
		chartRef.current = instance

		const axisColor = getComputedStyle(chartDom).getPropertyValue('--text-tertiary').trim() || undefined
		instance.setOption(buildRadarOption(scores, axisColor))

		return () => {
			instance?.dispose()
			chartRef.current = null
		}
	}, [id, scores])

	return <div id={id} className="h-[280px] w-full" />
}
