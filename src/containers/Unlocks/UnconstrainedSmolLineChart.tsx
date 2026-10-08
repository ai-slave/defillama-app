import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import type { EmissionEvent } from './api.types'
import { getEmissionEventAmount } from './eventAmount'

const COLOR_MAP = {
	green: { dark: '#3fb84f', light: '#008a13' },
	red: { dark: '#e24a42', light: '#e60d02' }
} as const

function smoothPath(points: Array<[number, number]>): string {
	if (points.length < 2) return ''
	if (points.length === 2) return `M${points[0]![0]},${points[0]![1]} L${points[1]![0]},${points[1]![1]}`

	let d = `M${points[0]![0]},${points[0]![1]}`
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(i - 1, 0)]!
		const p1 = points[i]!
		const p2 = points[i + 1]!
		const p3 = points[Math.min(i + 2, points.length - 1)]!

		const cp1x = p1[0] + (p2[0] - p0[0]) / 6
		const cp1y = p1[1] + (p2[1] - p0[1]) / 6
		const cp2x = p2[0] - (p3[0] - p1[0]) / 6
		const cp2y = p2[1] - (p3[1] - p1[1]) / 6

		d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
	}
	return d
}

interface ExtraData {
	lastEvent?: Array<EmissionEvent>
}

export function UnconstrainedSmolLineChart({
	series,
	color,
	className,
	extraData
}: {
	series: Array<[number, number]>
	name: string
	color: 'green' | 'red'
	className?: string
	extraData?: ExtraData
}) {
	const [isThemeDark] = useDarkModeManager()
	const containerRef = useRef<HTMLDivElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

	const unlockIndex = 7

	const onMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!containerRef.current || series.length === 0) return
			const rect = containerRef.current.getBoundingClientRect()
			const index = Math.min(Math.floor(((e.clientX - rect.left) / rect.width) * series.length), series.length - 1)
			if (index >= 0) {
				setHoveredIndex(index)
				setMousePos({ x: e.clientX, y: e.clientY })
			}
		},
		[series.length]
	)

	const onMouseLeave = useCallback(() => setHoveredIndex(null), [])

	useLayoutEffect(() => {
		const el = tooltipRef.current
		if (!el || hoveredIndex == null) return
		const flipX = mousePos.x + 12 + el.offsetWidth > window.innerWidth
		const flipY = mousePos.y - 12 + el.offsetHeight > window.innerHeight
		el.style.left = `${flipX ? mousePos.x - el.offsetWidth - 12 : mousePos.x + 12}px`
		el.style.top = `${flipY ? mousePos.y - el.offsetHeight + 12 : mousePos.y - 12}px`
	}, [mousePos, hoveredIndex])

	const { pathD, stroke, markLineX } = useMemo(() => {
		if (series.length === 0) return { pathD: '', stroke: '', markLineX: 0 }

		const values = series.map((s) => s[1])
		const min = Math.min(...values)
		const max = Math.max(...values)
		const range = max - min || 1

		const VB_W = 300
		const VB_H = 100
		const PAD = 2

		const pts: Array<[number, number]> = values.map((v, i) => {
			const x = series.length === 1 ? VB_W / 2 : (i / (series.length - 1)) * VB_W
			const y = PAD + ((max - v) / range) * (VB_H - PAD * 2)
			return [x, y]
		})

		const mlX =
			unlockIndex < series.length ? (series.length === 1 ? VB_W / 2 : (unlockIndex / (series.length - 1)) * VB_W) : 0

		const themeKey = isThemeDark ? 'dark' : 'light'
		return {
			pathD: smoothPath(pts),
			stroke: COLOR_MAP[color][themeKey],
			markLineX: mlX
		}
	}, [series, color, isThemeDark])

	if (series.length === 0 || series.length < 8) return null

	const unlockValue = series[unlockIndex]![1]
	const dayPosition = hoveredIndex != null ? hoveredIndex - unlockIndex : null
	const hoveredPoint = hoveredIndex != null ? series[hoveredIndex] : undefined
	const hoveredValue = hoveredPoint?.[1] ?? null
	const percentChange =
		dayPosition != null && dayPosition !== 0 && unlockValue && hoveredValue != null
			? ((hoveredValue - unlockValue) / unlockValue) * 100
			: null

	const lastEvent = extraData?.lastEvent

	return (
		<div className={className ?? 'my-auto h-[53px]'}>
			<div ref={containerRef} className="relative h-full" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 300 100"
					preserveAspectRatio="none"
					style={{ overflow: 'visible' }}
				>
					<path d={pathD} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
					{/* Unlock event mark line */}
					<line
						x1={markLineX}
						y1={0}
						x2={markLineX}
						y2={100}
						stroke={isThemeDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'}
						strokeWidth="1.5"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
				{hoveredIndex != null ? (
					<div
						className="pointer-events-none absolute top-0 h-full border-l border-dashed border-medium"
						style={{
							left: `${series.length === 1 ? 50 : (hoveredIndex / (series.length - 1)) * 100}%`
						}}
					/>
				) : null}
				{hoveredIndex != null && hoveredPoint
					? createPortal(
							<div
								ref={tooltipRef}
								className="pointer-events-none fixed z-[1000] rounded-md border border-medium bg-overlay px-2.5 py-1 body-sm whitespace-nowrap text-secondary shadow-overlay"
							>
								<p>{formatTooltipChartDate(hoveredPoint[0], 'daily', true)}</p>
								<p className="flex items-center gap-1">
									<span className="inline-block size-[10px] rounded-full" style={{ backgroundColor: stroke }} />
									Price: $
									{formatCompactNumber(hoveredPoint[1], {
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								</p>
								<div className="mt-1 opacity-80">
									{dayPosition === 0 ? (
										lastEvent && lastEvent.length > 0 ? (
											<UnlockEventTooltip lastEvent={lastEvent} unlockValue={unlockValue} stroke={stroke} />
										) : null
									) : (
										<span>
											Day {dayPosition != null && dayPosition > 0 ? '+' : ''}
											{dayPosition} from unlock
										</span>
									)}
								</div>
								{percentChange != null ? (
									<div
										style={{
											color:
												percentChange >= 0
													? COLOR_MAP.green[isThemeDark ? 'dark' : 'light']
													: COLOR_MAP.red[isThemeDark ? 'dark' : 'light']
										}}
										className="opacity-80"
									>
										{percentChange >= 0 ? '+' : ''}
										{formatPercent(percentChange, {
											input: 'percent',
											minimumFractionDigits: 1,
											maximumFractionDigits: 1,
											useGrouping: false
										})}{' '}
										from unlock
									</div>
								) : null}
							</div>,
							document.body
						)
					: null}
			</div>
		</div>
	)
}

function UnlockEventTooltip({
	lastEvent,
	unlockValue,
	stroke
}: {
	lastEvent: Array<EmissionEvent>
	unlockValue: number
	stroke: string
}) {
	let hasCliff = false
	let hasLinear = false
	let cliffAmount = 0
	let linearWeeklyAmount = 0
	const categories = new Set<string>()
	for (const event of lastEvent) {
		const amount = getEmissionEventAmount(event)
		if (amount === null || amount <= 0) continue
		categories.add(event.category)
		if (event.unlockType === 'linear') {
			hasLinear = true
			linearWeeklyAmount += amount
		} else {
			hasCliff = true
			cliffAmount += amount
		}
	}

	const uniqueCategories = Array.from(categories)
	const formatValue = (amount: number) =>
		formatUsd(amount * unlockValue, {
			compact: true,
			minimumCompactValue: 1_000_000,
			compactSuffix: 'lowercase'
		})

	return (
		<div className="mt-1">
			{hasCliff ? (
				<div className="flex items-center gap-1" style={{ color: stroke }}>
					Unlocked: {formatValue(cliffAmount)}
				</div>
			) : null}
			{hasLinear ? (
				<div className="flex items-center gap-1" style={{ color: stroke }}>
					Weekly unlock rate: {formatValue(linearWeeklyAmount)} / week
				</div>
			) : null}
			{uniqueCategories.length > 0 ? (
				<div className="body-xs text-tertiary">
					Categories: {uniqueCategories.map((cat) => cat.charAt(0).toUpperCase() + cat.slice(1)).join(', ')}
				</div>
			) : null}
		</div>
	)
}
