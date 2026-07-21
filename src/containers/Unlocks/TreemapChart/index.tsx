import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'
import { TreemapChart as EChartTreemap } from 'echarts/charts'
import { TitleComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'
import type { UnlocksData } from '~/containers/Unlocks/calendarTypes'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { TagGroup } from '~/ui/SegmentedControl'
import { formattedNum } from '~/utils'
import { buildUnlocksTreemapTreeData, UNLOCKS_TREEMAP_TIME_VIEWS, type UnlocksTreemapTimeView } from './buildTreeData'

echarts.use([TitleComponent, TooltipComponent, ToolboxComponent, EChartTreemap, CanvasRenderer])

interface UnlocksTreemapProps {
	unlocksData: UnlocksData
	height?: string
	filterYear?: number
}

const TREEMAP_CHART_INSET_PX = 8

interface UnlocksTreemapTooltipParams {
	data?: { iconUrl?: string; name?: string; value?: number }
	treePathInfo?: Array<{ name?: string }>
}

export default function UnlocksTreemapChart({ unlocksData, height = '600px', filterYear }: UnlocksTreemapProps) {
	const [isDark] = useDarkModeManager()
	const [timeView, setTimeView] = useState<UnlocksTreemapTimeView>('Current Year')
	const [selectedDate, setSelectedDate] = useState(() => dayjs())
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)

	// Stable resize listener - never re-attaches when dependencies change
	useChartResize(chartRef, containerRef)

	const currentYear = filterYear ?? dayjs().year()

	const chartDataTree = useMemo(() => {
		return buildUnlocksTreemapTreeData({
			unlocksData,
			timeView,
			currentYear,
			selectedYear: selectedDate.format('YYYY'),
			selectedMonth: selectedDate.format('MM'),
			isDark
		})
	}, [unlocksData, currentYear, timeView, isDark, selectedDate])

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const instance = echarts.init(el, null, { renderer: 'canvas' })
		chartRef.current = instance

		return () => {
			chartRef.current = null
			instance.dispose()
		}
	}, [])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance) return

		const option: EChartsOption = {
			title: {
				textStyle: {
					fontFamily: 'sans-serif',
					fontWeight: 600,
					color: getChartTheme(isDark).text
				}
			},
			tooltip: {
				formatter: (rawInfo: unknown) => {
					const info = rawInfo && typeof rawInfo === 'object' ? (rawInfo as UnlocksTreemapTooltipParams) : {}
					const { name = '', value = 0, iconUrl } = info.data ?? {}
					const pathNames = (info.treePathInfo ?? []).flatMap((item) => (item.name ? [item.name] : [])).slice(0, -1)

					let pathDisplay = pathNames.join(' > ')
					if (timeView === 'Month' && !pathNames.length) {
						pathDisplay = ''
					} else if (pathDisplay) {
						pathDisplay += ' > '
					}

					let content = `<div style="font-size: 12px; line-height: 1.5; padding: 4px;">`
					if (iconUrl) {
						content += `<img src="${iconUrl}" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; border-radius: 50%;" /> `
					}
					content += `<strong style="font-weight: 600;">${pathDisplay}${name}</strong><br/>`
					content += `<span style="opacity: 0.85;">Value:</span> <strong style="font-weight: 600;">${formattedNum(value, true)}</strong>`
					content += `</div>`
					return content
				},
				className: 'defillama-echarts-tooltip',
				backgroundColor: 'transparent',
				borderWidth: 0
			},
			toolbox: {
				feature: {
					restore: {
						title: 'Reset'
					}
				},
				iconStyle: {
					borderColor: getChartTheme(isDark).ink(0.6)
				},
				emphasis: {
					iconStyle: {
						borderColor: getChartTheme(isDark).ink(1)
					}
				},
				right: 8,
				top: 8
			},
			series: [
				{
					name: 'Token Unlocks',
					type: 'treemap',
					visibleMin: 300,
					data: chartDataTree,
					leafDepth: 2,
					roam: true,
					left: 0,
					top: 0,
					right: 0,
					bottom: 0,
					label: {
						show: true,
						rich: {}
					},
					upperLabel: {
						show: true,
						height: 28,
						color: getChartTheme(isDark).ink(1),
						fontSize: 13,
						fontWeight: 600,
						textShadowBlur: 2,
						textShadowColor: getChartTheme(isDark).inkInverted(0.8)
					},
					itemStyle: {
						borderColor: isDark ? '#555555' : '#d0d0d0',
						borderWidth: 2,
						gapWidth: 2
					},
					levels: [
						{
							itemStyle: {
								borderColor: isDark ? '#777777' : '#999999',
								borderWidth: 0,
								gapWidth: 2
							},
							upperLabel: {
								show: false
							}
						},
						{
							itemStyle: {
								borderWidth: 2,
								gapWidth: 2,
								borderColorSaturation: 0.6
							},
							upperLabel: {
								show: true,
								height: 26,
								color: getChartTheme(isDark).ink(1),
								fontSize: 12,
								fontWeight: 600
							},
							emphasis: {
								itemStyle: {
									borderColor: getChartTheme(isDark).ink(1),
									borderWidth: 3
								}
							}
						},
						{
							colorSaturation: [0.4, 0.75],
							itemStyle: {
								borderWidth: 2,
								gapWidth: 1,
								borderColorSaturation: 0.65
							},
							emphasis: {
								itemStyle: {
									borderWidth: 3,
									shadowBlur: 8,
									shadowColor: getChartTheme(isDark).ink(0.3)
								}
							}
						}
					],
					breadcrumb: {
						itemStyle: {
							color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)',
							borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
							borderWidth: 1,
							textStyle: {
								fontFamily: 'sans-serif',
								fontWeight: 500,
								color: getChartTheme(isDark).ink(0.95)
							}
						},
						emphasis: {
							itemStyle: {
								color: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
								borderColor: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
								textStyle: {
									color: getChartTheme(isDark).ink(1)
								}
							}
						}
					}
				}
			]
		}

		instance.setOption(option, { notMerge: true })
	}, [chartDataTree, isDark, timeView, selectedDate])

	const goToPrevMonth = () => setSelectedDate((d) => d.subtract(1, 'month'))
	const goToNextMonth = () => setSelectedDate((d) => d.add(1, 'month'))

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-end gap-3">
				{timeView === 'Month' ? (
					<div className="order-1 flex items-center gap-2 md:order-0">
						<button
							onClick={goToPrevMonth}
							className="rounded-md p-1.5 text-secondary hover:bg-hover-row focus-visible:bg-hover-row"
							aria-label="Previous Month"
						>
							←
						</button>
						<span className="w-28 text-center label-md">{selectedDate.format('MMMM YYYY')}</span>
						<button
							onClick={goToNextMonth}
							className="rounded-md p-1.5 text-secondary hover:bg-hover-row focus-visible:bg-hover-row"
							aria-label="Next Month"
						>
							→
						</button>
					</div>
				) : null}

				<TagGroup
					variant="default"
					size="md"
					selectedValue={timeView}
					setValue={(period) => startTransition(() => setTimeView(period))}
					values={UNLOCKS_TREEMAP_TIME_VIEWS}
				/>
			</div>

			<div className="w-full overflow-hidden" style={{ height, padding: TREEMAP_CHART_INSET_PX }}>
				<div ref={containerRef} className="h-full w-full" />
			</div>
		</div>
	)
}
