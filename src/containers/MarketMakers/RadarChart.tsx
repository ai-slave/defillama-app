import type { EChartsOption } from 'echarts'
import { RadarChart as ERadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { useDarkModeManager } from '~/contexts/LocalStorage'
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
	'Trust',
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
	const [isDark] = useDarkModeManager()
	const axisColor = useChartTheme(isDark).axisLabel
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)

	useChartResize(chartRef, containerRef)

	useEffect(() => {
		const chartDom = containerRef.current
		if (!chartDom) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return
		instance.setOption(buildRadarOption(scores, axisColor), { notMerge: true })
	}, [scores, axisColor])

	return <div ref={containerRef} className="h-[280px] w-full" />
}
