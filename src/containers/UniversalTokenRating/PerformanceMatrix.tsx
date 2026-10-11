import { useQueries, type QueryObserverResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import ScatterChart from '~/components/ECharts/ScatterChart'
import type { ScatterChartPoint, ScatterTooltipParams } from '~/components/ECharts/ScatterChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { Icon } from '~/ui/Icon'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { formatNumber } from '~/utils/numberFormat'
import { resolveUtrGradeOrLabel, type UtrGradeLabel, utrGradeColor } from './gradeBands'
import { areMatrixIconsReady, type MatrixIconMap } from './performanceMatrixIcons'
import type { UtrGradingConfig, UtrLeaderboardRow } from './types'

/** A logo cropped to a circle, or null when it cannot load or be drawn. It never rejects. */
function circularIcon(url: string): Promise<string | null> {
	return new Promise<string | null>((resolve) => {
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
}

// Each token's logo is loaded and cropped once per session and shared by every row set that shows it, so a filter change
// that keeps the same logos draws at once. Pending logos stay undefined; a failed one is null.
const readIconResults = (results: Array<QueryObserverResult<string | null>>) => results.map((result) => result.data)

function scoreRow(label: string, value: number | null, hex: string, max: number): string {
	const pct = value == null ? 0 : Math.min(100, (value / max) * 100)
	return `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:4px;">
		<span>${label}</span>
		<span style="display:flex;align-items:center;gap:8px;">
			${value == null ? 'N/A' : formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}
			<span style="display:inline-block;width:44px;height:8px;border-radius:999px;background:rgba(128,128,128,0.25);overflow:hidden;">
				<span style="display:block;height:100%;border-radius:999px;width:${pct}%;background:${hex};"></span>
			</span>
		</span>
	</div>`
}

function gradeHex(grade: UtrGradeLabel | null): string {
	return utrGradeColor(grade).hex || '#8a8a8a'
}

export function formatMatrixTooltip(row: UtrLeaderboardRow, grading: UtrGradingConfig | null | undefined): string {
	const overallHex = gradeHex(resolveUtrGradeOrLabel(row.scores.overall, grading?.overall.scale, row.grade))
	const disclosureHex = gradeHex(
		resolveUtrGradeOrLabel(row.scores.disclosure, grading?.disclosure.scale, row.disclosureGrade)
	)
	const performanceHex = gradeHex(
		resolveUtrGradeOrLabel(row.scores.performance, grading?.performance.scale, row.performanceGrade)
	)
	return `<div style="width:272px;">
		<div style="font-weight:600;">${escapeHtml(row.name)}</div>
		<div style="display:flex;justify-content:space-between;gap:16px;margin-top:8px;"><span>Rank</span><span>${row.scores.rank ?? '—'}</span></div>
		${scoreRow('Overall Score', row.scores.overall, overallHex, 100)}
		${scoreRow('Disclosure Score', row.scores.disclosure, disclosureHex, 10)}
		${scoreRow('Performance Score', row.scores.performance, performanceHex, 10)}
		<div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;"><span>FDV</span><span>${row.fdvUsd == null ? 'N/A' : `$${formatNumber(row.fdvUsd)}`}</span></div>
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

/** One point per row, at its disclosure and performance scores, in its overall grade color and drawn as its logo. */
export function buildMatrixPoints(
	rows: Array<UtrLeaderboardRow>,
	icons: MatrixIconMap,
	grading: UtrGradingConfig | null | undefined
): Array<ScatterChartPoint> {
	return rows.map((row) => {
		const iconUrl = icons[row.asset] ?? null
		return {
			value: [row.scores.disclosure ?? 0, row.scores.performance ?? 0],
			symbol: iconUrl ? `image://${iconUrl}` : 'circle',
			symbolSize: 22,
			itemStyle: { color: gradeHex(resolveUtrGradeOrLabel(row.scores.overall, grading?.overall.scale, row.grade)) }
		}
	})
}

const MATRIX_DOMAIN: [number, number] = [0, 10]

function AxisArrow({ direction }: { direction: 'right' | 'up' }) {
	if (direction === 'right') {
		return (
			<span className="flex flex-1 items-center opacity-60">
				<span className="h-px flex-1 bg-current" />
				<Icon name="arrow-right" className="-ml-1 size-3 shrink-0" />
			</span>
		)
	}
	return (
		<span className="flex flex-1 flex-col items-center opacity-60">
			<Icon name="arrow-right" className="-mb-1 size-3 shrink-0 -rotate-90" />
			<span className="w-px flex-1 bg-current" />
		</span>
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
	const iconRows = useMemo(() => rows.filter((row) => row.iconDataUrl), [rows])
	const iconData = useQueries({
		queries: iconRows.map((row) => ({
			// Keyed by the token: the data URL is the logo's whole image, too large to hash on every render.
			queryKey: ['utr-matrix-icon', row.asset],
			queryFn: () => circularIcon(row.iconDataUrl!),
			staleTime: Infinity,
			gcTime: Infinity
		})),
		combine: readIconResults
	})
	const icons = useMemo(() => {
		const loaded: MatrixIconMap = {}
		for (const [index, row] of iconRows.entries()) {
			if (iconData[index] !== undefined) loaded[row.asset] = iconData[index]
		}
		return loaded
	}, [iconRows, iconData])
	// The chart waits for every logo, so points never swap from dots to logos under the reader.
	const iconsReady = areMatrixIconsReady(rows, icons)
	const points = useMemo(() => buildMatrixPoints(rows, icons, grading), [rows, icons, grading])
	const tooltipFormatter = useCallback(
		(params: ScatterTooltipParams) => {
			const row = rows[params.dataIndex!]
			return row ? formatMatrixTooltip(row, grading) : ''
		},
		[rows, grading]
	)

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
						{iconsReady ? (
							<div className="absolute inset-0">
								<ScatterChart
									chartData={points}
									domain={MATRIX_DOMAIN}
									pinnableTooltip
									tooltipFormatter={tooltipFormatter}
									height="100%"
								/>
							</div>
						) : (
							<SurfaceBodyLoadingStatus label="Loading chart" className="absolute inset-0 min-h-0" />
						)}
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
