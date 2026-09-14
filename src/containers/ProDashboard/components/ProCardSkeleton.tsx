import { tw } from '~/ui/tw'
import { previewSeries } from './dashboardPreview'

export type ProCardSkeletonVariant = 'chart' | 'metric' | 'table' | 'text' | 'pie'

function svgCoordinate(value: number): number {
	return Math.round(value * 100) / 100
}

const SHIMMER_OVERLAY = tw`pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-shimmer bg-[linear-gradient(99.97deg,transparent,rgba(0,0,0,0.08),transparent)] dark:bg-[linear-gradient(99.97deg,transparent,rgba(255,255,255,0.08),transparent)]`

const TABLE_KINDS = new Set(['unified-table', 'dataset-table', 'custom-data', 'sql'])

export function skeletonVariantForItemKind(kind: string | undefined): ProCardSkeletonVariant {
	if (kind === 'metric') return 'metric'
	if (kind === 'unlocks-pie') return 'pie'
	if (kind === 'text') return 'text'
	if (kind !== undefined && TABLE_KINDS.has(kind)) return 'table'
	return 'chart'
}

export function SkeletonShimmer() {
	return <div className={SHIMMER_OVERLAY} />
}

function SkeletonBlock({ className }: { className: string }) {
	return <div className={`rounded-sm bg-pro-text-tertiary/15 ${className}`} />
}

const WAVE_SEED = 20_260_914
const WAVE_POINTS = 20
const WAVE_HEIGHT = 32

function wavePath(): string {
	const series = previewSeries(WAVE_SEED, WAVE_POINTS)
	const lastIndex = Math.max(1, series.length - 1)
	const padding = WAVE_HEIGHT * 0.1
	return series
		.map((value, index) => {
			const x = svgCoordinate((index / lastIndex) * 100)
			const y = svgCoordinate(WAVE_HEIGHT - padding - value * (WAVE_HEIGHT - padding * 2))
			return `${index === 0 ? 'M' : 'L'}${x},${y}`
		})
		.join(' ')
}

const WAVE_PATH = wavePath()

const AXIS_TICKS = [0, 1, 2]
const X_AXIS_TICKS = [0, 1, 2, 3, 4]
const TABLE_ROWS = [0, 1, 2, 3, 4, 5]
const TABLE_COLUMNS = ['w-2/5', 'w-1/5', 'w-1/6', 'w-1/12']

function ChartSkeleton() {
	return (
		<div className="flex flex-1 gap-2">
			<div className="flex flex-col justify-between py-1">
				{AXIS_TICKS.map((tick) => (
					<SkeletonBlock key={tick} className="h-1 w-6" />
				))}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="min-h-16 flex-1">
					<svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full">
						<path d={`${WAVE_PATH} L100,32 L0,32 Z`} className="fill-pro-text-tertiary" fillOpacity="0.08" />
						<path d={WAVE_PATH} fill="none" strokeWidth="0.8" className="stroke-pro-text-tertiary/30" />
					</svg>
				</div>
				<div className="flex justify-between">
					{X_AXIS_TICKS.map((tick) => (
						<SkeletonBlock key={tick} className="h-1 w-6" />
					))}
				</div>
			</div>
		</div>
	)
}

function MetricSkeleton() {
	return (
		<div className="flex flex-1 flex-col justify-center gap-2">
			<SkeletonBlock className="h-8 w-2/3" />
			<SkeletonBlock className="h-3 w-1/3" />
			<SkeletonBlock className="h-6 w-full" />
		</div>
	)
}

function TableSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="flex gap-3">
				{TABLE_COLUMNS.map((width) => (
					<SkeletonBlock key={width} className={`h-3 ${width}`} />
				))}
			</div>
			{TABLE_ROWS.map((row) => (
				<div key={row} className="flex gap-3">
					{TABLE_COLUMNS.map((width) => (
						<SkeletonBlock key={width} className={`h-2 ${width}`} />
					))}
				</div>
			))}
		</div>
	)
}

function TextSkeleton() {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<SkeletonBlock className="h-3 w-full" />
			<SkeletonBlock className="h-3 w-11/12" />
			<SkeletonBlock className="h-3 w-3/4" />
		</div>
	)
}

function PieSkeleton() {
	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="size-24 rounded-full border-8 border-pro-text-tertiary/15" />
		</div>
	)
}

function skeletonBody(kind: ProCardSkeletonVariant) {
	if (kind === 'metric') return <MetricSkeleton />
	if (kind === 'table') return <TableSkeleton />
	if (kind === 'text') return <TextSkeleton />
	if (kind === 'pie') return <PieSkeleton />
	return <ChartSkeleton />
}

export function ProCardSkeleton({ kind }: { kind: ProCardSkeletonVariant }) {
	return (
		<div aria-hidden data-skeleton={kind} className="relative isolate flex flex-1 overflow-hidden">
			{skeletonBody(kind)}
			<SkeletonShimmer />
		</div>
	)
}
