import { type DashboardPreviewTile, previewSeries } from './dashboardPreview'

function svgCoordinate(value: number): number {
	return Math.round(value * 100) / 100
}

const SPAN_CLASS: Record<DashboardPreviewTile['span'], string> = {
	1: 'col-span-1',
	2: 'col-span-2'
}

const ACCENT = 'var(--pro-accent)'
const ACCENT_ALT = 'var(--color-pro-ai-300)'

function linePath(series: Array<number>, height = 32): string {
	const lastIndex = Math.max(1, series.length - 1)
	const padding = height * 0.1
	return series
		.map((value, index) => {
			const x = svgCoordinate((index / lastIndex) * 100)
			const y = svgCoordinate(height - padding - value * (height - padding * 2))
			return `${index === 0 ? 'M' : 'L'}${x},${y}`
		})
		.join(' ')
}

function AreaShape({ seed }: { seed: number }) {
	const path = linePath(previewSeries(seed, 20))
	return (
		<svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
			<path
				d={`${path} L100,32 L0,32 Z`}
				fill={ACCENT}
				fillOpacity="0.18"
				className="transition-[fill-opacity] duration-260 ease-out-quart group-hover/dashboard-card:[fill-opacity:.28]"
			/>
			<path
				d={path}
				fill="none"
				stroke={ACCENT}
				strokeWidth="0.8"
				pathLength={1}
				className="[stroke-dasharray:1] motion-safe:group-hover/dashboard-card:animate-pro-redraw"
			/>
		</svg>
	)
}

function LineShape({ seed }: { seed: number }) {
	const first = linePath(previewSeries(seed, 20))
	const second = linePath(previewSeries(seed + 7919, 20))
	return (
		<svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
			<path
				d={first}
				fill="none"
				stroke={ACCENT}
				strokeWidth="0.8"
				pathLength={1}
				className="[stroke-dasharray:1] motion-safe:group-hover/dashboard-card:animate-pro-redraw"
			/>
			<path
				d={second}
				fill="none"
				stroke={ACCENT_ALT}
				strokeOpacity="0.7"
				strokeWidth="0.8"
				pathLength={1}
				className="[stroke-dasharray:1] motion-safe:group-hover/dashboard-card:animate-pro-redraw"
			/>
		</svg>
	)
}

function previewBars(seed: number, stacked: boolean) {
	const series = previewSeries(seed, 12)
	const upper = previewSeries(seed + 4093, 12)
	const width = 100 / series.length
	return series.map((value, index) => {
		const height = 4 + value * 24
		return {
			key: `bar-${seed}-${index}`,
			x: index * width + width * 0.2,
			width: width * 0.6,
			height,
			secondHeight: stacked ? Math.max(0, Math.min(28 - height, upper[index]! * 10)) : 0
		}
	})
}

function BarsShape({ seed, stacked = false }: { seed: number; stacked?: boolean }) {
	return (
		<svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
			{previewBars(seed, stacked).map((bar, index) => (
				<g
					key={bar.key}
					className={
						index < 4
							? 'origin-bottom [transform-box:fill-box] motion-safe:group-hover/dashboard-card:animate-pro-bar-rise'
							: undefined
					}
				>
					<rect x={bar.x} y={32 - bar.height} width={bar.width} height={bar.height} fill={ACCENT} fillOpacity="0.75" />
					{bar.secondHeight > 0 ? (
						<rect
							x={bar.x}
							y={32 - bar.height - bar.secondHeight}
							width={bar.width}
							height={bar.secondHeight}
							fill={ACCENT_ALT}
							fillOpacity="0.6"
						/>
					) : null}
				</g>
			))}
		</svg>
	)
}

function PieShape({ seed }: { seed: number }) {
	const circumference = 2 * Math.PI * 11
	const slice = 0.25 + (seed % 50) / 100
	return (
		<svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
			<circle cx="16" cy="16" r="11" fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="8" />
			<circle
				cx="16"
				cy="16"
				r="11"
				fill="none"
				stroke={ACCENT}
				strokeWidth="8"
				strokeDasharray={`${svgCoordinate(circumference * slice)} ${svgCoordinate(circumference)}`}
				transform="rotate(-90 16 16)"
			/>
		</svg>
	)
}

function NumberShape({ seed }: { seed: number }) {
	return (
		<div className="flex h-full flex-col justify-center gap-1">
			<span className="block h-3 w-2/3 rounded-sm bg-pro-text-primary/70" />
			<svg viewBox="0 0 100 12" preserveAspectRatio="none" className="h-2 w-full" aria-hidden="true">
				<path
					d={linePath(previewSeries(seed, 14), 12)}
					fill="none"
					stroke={ACCENT}
					strokeWidth="0.8"
					pathLength={1}
					className="[stroke-dasharray:1] motion-safe:group-hover/dashboard-card:animate-pro-redraw"
				/>
			</svg>
		</div>
	)
}

function previewRows(seed: number, rows: number) {
	return previewSeries(seed, rows).map((value, index) => ({
		key: `row-${seed}-${index}`,
		width: `${Math.round(45 + value * 50)}%`
	}))
}

function RowsShape({ seed, rows }: { seed: number; rows: number }) {
	return (
		<div className="flex h-full flex-col justify-center gap-1">
			{previewRows(seed, rows).map((row) => (
				<span key={row.key} className="block h-1 rounded-sm bg-pro-text-tertiary/40" style={{ width: row.width }} />
			))}
		</div>
	)
}

function TileShape({ tile }: { tile: DashboardPreviewTile }) {
	switch (tile.shape) {
		case 'area':
			return <AreaShape seed={tile.seed} />
		case 'line':
			return <LineShape seed={tile.seed} />
		case 'bars':
			return <BarsShape seed={tile.seed} />
		case 'stacked':
			return <BarsShape seed={tile.seed} stacked />
		case 'pie':
			return <PieShape seed={tile.seed} />
		case 'number':
			return <NumberShape seed={tile.seed} />
		case 'table':
			return <RowsShape seed={tile.seed} rows={3} />
		case 'text':
			return <RowsShape seed={tile.seed} rows={2} />
	}
}

export function DashboardPreview({
	tiles,
	className
}: {
	tiles: Array<DashboardPreviewTile>
	className?: string | undefined
}) {
	return (
		<div
			data-testid="dashboard-preview"
			className={`relative aspect-[2/1] w-full overflow-hidden border-b border-pro-cards-border bg-pro-app-bg p-2 ${className ?? ''}`.trim()}
		>
			{tiles.length === 0 ? (
				<p className="flex h-full items-center justify-center text-xs text-pro-text-tertiary">No cards yet</p>
			) : (
				<div className="grid h-full grid-flow-dense grid-cols-4 grid-rows-3 gap-1">
					{tiles.map((tile) => (
						<div
							key={tile.id}
							data-testid="dashboard-preview-tile"
							className={`${SPAN_CLASS[tile.span]} flex min-h-0 flex-col gap-1 overflow-hidden rounded-sm border border-pro-cards-border/60 bg-pro-cards-bg p-1.5`}
						>
							<span className="truncate text-xs leading-none text-pro-text-tertiary">{tile.label}</span>
							<span className="min-h-0 flex-1">
								<TileShape tile={tile} />
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
