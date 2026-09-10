import type { EChartsOption } from 'echarts'
import { ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useChartResize } from '~/hooks/useChartResize'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import { resolveUtrGradeOrLabel, utrGradeColor } from './gradeBands'
import { areMatrixIconsReady, type MatrixIconMap } from './performanceMatrixIcons'
import type { UtrGradingConfig, UtrLeaderboardRow } from './types'

echarts.use([ScatterChart, GridComponent, TooltipComponent, CanvasRenderer])

const circularIconCache = new Map<string, Promise<string | null>>()

function circularIcon(url: string): Promise<string | null> {
	let cached = circularIconCache.get(url)
	if (!cached) {
		cached = new Promise<string | null>((resolve) => {
			const image = new Image()
			image.decoding = 'sync'
			image.crossOrigin = 'anonymous'
			image.addEventListener(
				'load',
				() => {
					try {
						const size = 48
						const canvas = document.createElement('canvas')
						canvas.width = size
						canvas.height = size
						const context = canvas.getContext('2d')
						if (!context) {
							resolve(null)
							return
						}
						context.beginPath()
						context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
						context.clip()
						context.drawImage(image, 0, 0, size, size)
						const dataUrl = canvas.toDataURL()
						const decodedIcon = new Image()
						decodedIcon.decoding = 'sync'
						decodedIcon.addEventListener('load', () => resolve(dataUrl), { once: true })
						decodedIcon.addEventListener('error', () => resolve(null), { once: true })
						decodedIcon.src = dataUrl
					} catch {
						resolve(null)
					}
				},
				{ once: true }
			)
			image.addEventListener('error', () => resolve(null), { once: true })
			image.src = url
		})
		circularIconCache.set(url, cached)
	}
	return cached
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function scoreRow(label: string, value: number | null, hex: string, max: number): string {
	const pct = value == null ? 0 : Math.min(100, (value / max) * 100)
	return `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:4px;">
		<span>${label}</span>
		<span style="display:flex;align-items:center;gap:8px;font-family:var(--font-jetbrains,monospace);">
			${value == null ? 'N/A' : formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}
			<span style="display:inline-block;width:44px;height:8px;border-radius:999px;background:rgba(128,128,128,0.25);overflow:hidden;">
				<span style="display:block;height:100%;border-radius:999px;width:${pct}%;background:${hex};"></span>
			</span>
		</span>
	</div>`
}

export function buildMatrixOption(
	rows: Array<UtrLeaderboardRow>,
	axisColor?: string,
	icons: MatrixIconMap = {},
	isDark = false,
	grading?: UtrGradingConfig | null
): EChartsOption {
	return {
		animation: false,
		grid: { left: 40, right: 20, top: 12, bottom: 26 },
		tooltip: {
			trigger: 'item',
			triggerOn: 'mousemove|click|mousewheel',
			enterable: true,
			confine: true,
			backgroundColor: isDark ? '#181a1c' : '#ffffff',
			borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
			textStyle: { color: isDark ? '#e8e8ea' : '#1f2229' },
			formatter: (params: any) => {
				const row = rows[params.dataIndex]
				if (!row) return ''
				const overallHex =
					utrGradeColor(resolveUtrGradeOrLabel(row.scores.overall, grading?.overall.scale, row.grade)).hex || '#8a8a8a'
				const disclosureHex =
					utrGradeColor(resolveUtrGradeOrLabel(row.scores.disclosure, grading?.disclosure.scale, row.disclosureGrade))
						.hex || '#8a8a8a'
				const performanceHex =
					utrGradeColor(
						resolveUtrGradeOrLabel(row.scores.performance, grading?.performance.scale, row.performanceGrade)
					).hex || '#8a8a8a'
				return `<div style="width:272px;">
					<div style="font-weight:600;">${escapeHtml(row.name)}</div>
					<div style="display:flex;justify-content:space-between;gap:16px;margin-top:8px;"><span>Rank</span><span>${row.scores.rank ?? '—'}</span></div>
					${scoreRow('Overall Score', row.scores.overall, overallHex, 100)}
					${scoreRow('Disclosure Score', row.scores.disclosure, disclosureHex, 10)}
					${scoreRow('Performance Score', row.scores.performance, performanceHex, 10)}
					<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;"><span>FDV</span><span style="font-family:var(--font-jetbrains,monospace);">${row.fdvUsd == null ? 'N/A' : `$${formatNumber(row.fdvUsd)}`}</span></div>
					${
						row.claimed
							? ''
							: `<a href="/universal-token-rating/claim?token=${encodeURIComponent(row.asset)}" style="display:block;margin-top:10px;border:1px solid rgba(128,128,128,0.5);border-radius:999px;padding:4px 12px;text-align:center;color:inherit;text-decoration:none;">Claim this Token Profile</a>`
					}
					<div style="display:flex;gap:8px;margin-top:8px;">
						<a href="#utr-row-${encodeURIComponent(row.asset)}" style="flex:1;white-space:nowrap;border:1px solid rgba(128,128,128,0.5);border-radius:999px;padding:4px 12px;text-align:center;color:inherit;text-decoration:none;">Show in Table</a>
						<a href="/universal-token-rating/token/${encodeURIComponent(row.asset)}" style="flex:1;white-space:nowrap;border:1px solid rgba(128,128,128,0.5);border-radius:999px;padding:4px 12px;text-align:center;color:inherit;text-decoration:none;">Details →</a>
					</div>
				</div>`
			}
		},
		xAxis: {
			min: 0,
			max: 10,
			axisLabel: {
				color: axisColor,
				formatter: (value: number) => (value < 0 || value > 10 ? '' : String(value))
			},
			splitLine: { lineStyle: { opacity: 0.3, type: 'dashed' } }
		},
		yAxis: {
			min: 0,
			max: 10,
			axisLabel: {
				color: axisColor,
				formatter: (value: number) => (value < 0 || value > 10 ? '' : String(value))
			},
			splitLine: { lineStyle: { opacity: 0.3, type: 'dashed' } }
		},
		series: [
			{
				type: 'scatter',
				symbolSize: 22,
				data: rows.map((row) => {
					const iconUrl = icons[row.asset] ?? null
					return {
						value: [row.scores.disclosure ?? 0, row.scores.performance ?? 0],
						symbol: iconUrl ? `image://${iconUrl}` : 'circle',
						symbolKeepAspect: true,
						itemStyle: {
							color:
								utrGradeColor(resolveUtrGradeOrLabel(row.scores.overall, grading?.overall.scale, row.grade)).hex ||
								'#8a8a8a',
							borderColor: '#0b0b12',
							borderWidth: 2
						}
					}
				})
			}
		]
	}
}

function AxisArrow({ direction }: { direction: 'right' | 'up' }) {
	if (direction === 'right') {
		return (
			<span className="flex flex-1 items-center opacity-60">
				<span className="h-px flex-1 bg-current" />
				<Icon name="arrow-right" height={10} width={10} className="-ml-1 shrink-0" />
			</span>
		)
	}
	return (
		<span className="flex flex-1 flex-col items-center opacity-60">
			<Icon name="arrow-right" height={10} width={10} className="-mb-1 shrink-0 -rotate-90" />
			<span className="w-px flex-1 bg-current" />
		</span>
	)
}

function MatrixLoadingState() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="pointer-events-none absolute inset-0 flex items-center justify-center"
		>
			<LoadingIndicator label="Loading chart" />
		</div>
	)
}

export function PerformanceMatrix({
	rows,
	grading,
	className = 'h-[494px] w-full'
}: {
	rows: Array<UtrLeaderboardRow>
	grading?: UtrGradingConfig | null
	className?: string
}) {
	const [isDark] = useDarkModeManager()
	const axisColor = useChartTheme(isDark).axisLabel
	const containerRef = useRef<HTMLDivElement>(null)
	const chartRef = useRef<echarts.ECharts | null>(null)
	const cleanupChartEventsRef = useRef<(() => void) | null>(null)
	const pinnedDataIndexRef = useRef<number | null>(null)
	const [icons, setIcons] = useState<MatrixIconMap>({})
	const [chartReady, setChartReady] = useState(false)
	const iconsReady = areMatrixIconsReady(rows, icons)
	const showLoadingState = !iconsReady || !chartReady

	const applyOption = useCallback(() => {
		const instance = chartRef.current
		if (!iconsReady || !instance || instance.isDisposed()) return
		instance.setOption(buildMatrixOption(rows, axisColor, icons, isDark, grading), { notMerge: true })
		const pinnedDataIndex = pinnedDataIndexRef.current
		if (pinnedDataIndex != null && pinnedDataIndex < rows.length) {
			instance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: pinnedDataIndex })
		} else if (pinnedDataIndex != null) {
			pinnedDataIndexRef.current = null
		}
		setChartReady(true)
	}, [rows, axisColor, icons, iconsReady, isDark, grading])

	const initializeChart = useCallback(() => {
		const chartDom = containerRef.current
		if (!iconsReady || !chartDom?.isConnected) return
		if (chartRef.current && !chartRef.current.isDisposed()) return
		if (chartDom.clientWidth <= 0 || chartDom.clientHeight <= 0) return
		const instance = echarts.init(chartDom, null, { renderer: 'canvas' })
		chartRef.current = instance
		const handleChartClick = (params: { componentType?: string; dataIndex?: number }) => {
			if (params.componentType !== 'series' || typeof params.dataIndex !== 'number') return
			if (pinnedDataIndexRef.current === params.dataIndex) {
				pinnedDataIndexRef.current = null
				instance.dispatchAction({ type: 'hideTip' })
				return
			}
			pinnedDataIndexRef.current = params.dataIndex
			instance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: params.dataIndex })
		}
		const restorePinnedTooltip = () => {
			const pinnedDataIndex = pinnedDataIndexRef.current
			if (pinnedDataIndex == null) return
			window.requestAnimationFrame(() => {
				if (!instance.isDisposed()) {
					instance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: pinnedDataIndex })
				}
			})
		}
		const restorePinnedTooltipAfterExit = () => {
			const pinnedDataIndex = pinnedDataIndexRef.current
			if (pinnedDataIndex == null) return
			window.requestAnimationFrame(() => {
				if (!instance.isDisposed()) {
					instance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: pinnedDataIndex })
				}
			})
		}
		const renderer = instance.getZr()
		instance.on('click', handleChartClick)
		instance.on('mouseover', restorePinnedTooltip)
		renderer.on('globalout', restorePinnedTooltipAfterExit)
		cleanupChartEventsRef.current = () => {
			instance.off('click', handleChartClick)
			instance.off('mouseover', restorePinnedTooltip)
			renderer.off('globalout', restorePinnedTooltipAfterExit)
		}
		applyOption()
	}, [applyOption, iconsReady])

	useChartResize(chartRef, containerRef, {
		onVisibilityChange: (isVisible) => {
			if (isVisible) initializeChart()
		}
	})

	useEffect(() => {
		let cancelled = false
		const pending = rows.filter((row) => row.iconDataUrl)
		if (pending.length === 0) return
		Promise.all(pending.map(async (row) => [row.asset, await circularIcon(row.iconDataUrl!)] as const)).then(
			(entries) => {
				if (cancelled) return
				const loaded = Object.fromEntries(entries)
				setIcons((current) => ({ ...current, ...loaded }))
			}
		)
		return () => {
			cancelled = true
		}
	}, [rows])

	useEffect(() => {
		const instance = chartRef.current
		if (!instance || instance.isDisposed()) {
			initializeChart()
			return
		}
		applyOption()
	}, [applyOption, initializeChart])

	useEffect(() => {
		const closePinnedTooltip = (event: PointerEvent) => {
			if (pinnedDataIndexRef.current == null || containerRef.current?.contains(event.target as Node)) return
			pinnedDataIndexRef.current = null
			chartRef.current?.dispatchAction({ type: 'hideTip' })
		}
		const closePinnedTooltipOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || pinnedDataIndexRef.current == null) return
			pinnedDataIndexRef.current = null
			chartRef.current?.dispatchAction({ type: 'hideTip' })
		}
		document.addEventListener('pointerdown', closePinnedTooltip)
		window.addEventListener('keydown', closePinnedTooltipOnEscape)
		return () => {
			document.removeEventListener('pointerdown', closePinnedTooltip)
			window.removeEventListener('keydown', closePinnedTooltipOnEscape)
		}
	}, [])

	useEffect(() => {
		return () => {
			const instance = chartRef.current
			chartRef.current = null
			cleanupChartEventsRef.current?.()
			cleanupChartEventsRef.current = null
			if (instance && !instance.isDisposed()) instance.dispose()
		}
	}, [])

	return (
		<div className={`flex flex-col ${className}`}>
			<p className="pt-2 text-center label-sm text-secondary">Performance | Disclosures</p>
			<div className="flex min-h-0 flex-1">
				<div className="-mr-4 flex flex-col items-center gap-1 pt-3 pb-8 pl-2 label-xs text-tertiary">
					<span className="rotate-180 [writing-mode:vertical-rl]">Best</span>
					<AxisArrow direction="up" />
					<span className="rotate-180 [writing-mode:vertical-rl]">Worst</span>
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="relative min-h-[200px] w-full flex-1">
						<div ref={containerRef} className={`absolute inset-0 ${showLoadingState ? 'invisible' : ''}`} />
						{showLoadingState ? <MatrixLoadingState /> : null}
					</div>
					<div className="flex items-center gap-2 pr-5 pb-2 pl-10 label-xs text-tertiary">
						<span>Worst</span>
						<AxisArrow direction="right" />
						<span>Best</span>
					</div>
				</div>
			</div>
		</div>
	)
}
