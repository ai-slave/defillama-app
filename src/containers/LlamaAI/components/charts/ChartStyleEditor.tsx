import { useMemo, useState } from 'react'
import type { ChartConfiguration, ChartStylePatch } from '~/containers/LlamaAI/types'
import type { ChartControlsModel } from '~/containers/LlamaAI/utils/chartCapabilities'
import { getNDistinctColors } from '~/utils'

const ALL_TYPES: ChartConfiguration['type'][] = ['line', 'area', 'bar', 'hbar', 'combo', 'pie', 'scatter']
const SERIES_TYPES = ['line', 'bar', 'area'] as const

// Only offer type swaps the current data shape can actually render — otherwise the chart says
// "no data available" (e.g. scatter needs a numeric x; pie/hbar need categories).
function compatibleTypes(xType: string | undefined): ChartConfiguration['type'][] {
	return ALL_TYPES.filter((t) => {
		if (t === 'scatter') return xType === 'value'
		if (t === 'pie' || t === 'hbar') return xType === 'category'
		return true // line / area / bar / combo work on category & time
	})
}

type ViewKey = 'logScale' | 'stacked' | 'showLabels' | 'percentage'

type EditorCaps = Pick<
	ChartControlsModel,
	'showStack' | 'showPercentage' | 'showLogScale' | 'showLabels' | 'showHallmarks'
>

interface ChartStyleEditorProps {
	config: ChartConfiguration
	original: ChartConfiguration
	caps: EditorCaps
	categories?: string[]
	view: Record<ViewKey, boolean>
	onView: (key: ViewKey, value: boolean) => void
	onPreview: (config: ChartConfiguration) => void
	onReset: () => void
	onSave: (patch: ChartStylePatch) => Promise<void>
	onClose: () => void
}

const clone = (c: ChartConfiguration): ChartConfiguration => JSON.parse(JSON.stringify(c))

const LEGEND_TYPES: ChartConfiguration['type'][] = ['line', 'area', 'bar', 'combo']

const toDateInput = (unixSeconds: number): string => {
	const d = new Date(unixSeconds * 1000)
	return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
const fromDateInput = (value: string): number => Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000)

function toPatch(c: ChartConfiguration, view: Record<ViewKey, boolean>): ChartStylePatch {
	return {
		title: c.title,
		type: c.type,
		valueSymbol: c.valueSymbol,
		seriesColors: c.seriesColors,
		showLabels: view.showLabels,
		defaultStacked: view.stacked,
		defaultPercentage: view.percentage,
		defaultLogScale: view.logScale,
		hallmarkStyle: c.hallmarkStyle,
		hallmarks: c.hallmarks?.map((h) => [h[0], h[1] ?? ''] as [number, string]),
		legend: c.legend,
		xAxisLabel: c.axes?.x?.label,
		yAxes: c.axes?.yAxes?.map((a) => ({
			id: a.id,
			label: a.label,
			position: a.position,
			valueSymbol: a.valueSymbol,
			min: a.min,
			max: a.max,
			interval: a.interval
		})),
		series: c.series?.map((s) => ({ name: s.name, color: s.styling?.color, type: s.type as any }))
	}
}

const section = 'flex flex-col gap-2 border-t border-ai-line pt-3 first:border-t-0 first:pt-0'
const label = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ai-muted'
const input =
	'rounded-md border border-medium bg-transparent px-2.5 py-1.5 text-sm text-secondary outline-hidden transition-colors focus:border-brand'
const swatch =
	'size-7 shrink-0 cursor-pointer rounded-md border border-medium bg-transparent p-0.75 transition-transform hover:scale-105'
const axisTag = 'w-3.5 shrink-0 text-center text-[11px] font-medium text-ai-muted'

export function ChartStyleEditor({
	config,
	original,
	caps,
	categories = [],
	view,
	onView,
	onPreview,
	onReset,
	onSave,
	onClose
}: ChartStyleEditorProps) {
	const [draft, setDraft] = useState<ChartConfiguration>(() => clone(config))
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const isCombo = draft.type === 'combo'

	const update = (mutate: (d: ChartConfiguration) => void) => {
		setDraft((prev) => {
			const next = clone(prev)
			mutate(next)
			onPreview(next)
			return next
		})
	}

	const yAxes = useMemo(() => draft.axes?.yAxes ?? [], [draft])
	const availableTypes = useMemo(() => compatibleTypes(config.axes?.x?.type), [config])
	// hbar (single series) & pie color per category, not per series — offer a picker per bar/slice.
	const perCategory = draft.type === 'pie' || (draft.type === 'hbar' && (draft.series?.length ?? 1) <= 1)
	const categoryPalette = useMemo(() => getNDistinctColors(categories.length), [categories.length])
	const hasHallmarks = caps.showHallmarks && (draft.hallmarks?.length ?? 0) > 0
	const canEditHallmarks = draft.axes?.x?.type === 'time'
	const canLegend = LEGEND_TYPES.includes(draft.type) && (draft.series?.length ?? 0) > 1

	const problems = useMemo(() => {
		const out: string[] = []
		if (!draft.title.trim()) out.push('Title cannot be empty')
		for (const a of yAxes) {
			const lo = typeof a.min === 'number' ? a.min : undefined
			const hi = typeof a.max === 'number' ? a.max : undefined
			if (lo !== undefined && hi !== undefined && lo >= hi) {
				out.push(`${a.label || 'Y-axis'}: min must be less than max`)
			}
		}
		return out
	}, [draft.title, yAxes])

	const save = async () => {
		if (problems.length > 0) {
			setError(problems[0])
			return
		}
		setSaving(true)
		setError(null)
		try {
			await onSave(toPatch(draft, view))
			onClose()
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Save failed')
		} finally {
			setSaving(false)
		}
	}

	const reset = () => {
		setDraft(clone(original))
		setError(null)
		onReset()
	}

	const toggles = (
		[
			[caps.showLabels, 'showLabels', 'Logos'],
			[caps.showStack, 'stacked', 'Stacked'],
			[caps.showPercentage, 'percentage', 'Percentage'],
			[caps.showLogScale, 'logScale', 'Log scale']
		] as Array<[boolean, ViewKey, string]>
	)
		.filter(([enabled]) => enabled)
		.map(([, key, text]) => [key, text] as [ViewKey, string])

	return (
		<div className="flex min-h-full flex-col gap-3 p-4 text-secondary">
			<span className="text-[10.5px] font-semibold tracking-[0.07em] text-ai-muted uppercase">Style</span>

			<div className={section}>
				<span className={label}>Type</span>
				<div className="flex flex-wrap gap-1.5">
					{availableTypes.map((t) => (
						<button
							key={t}
							data-active={draft.type === t}
							onClick={() => update((d) => (d.type = t))}
							className="rounded-md border border-medium px-2.5 py-1 text-xs capitalize transition-colors hover:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand data-[active=true]:font-medium data-[active=true]:text-ai-white"
						>
							{t}
						</button>
					))}
				</div>
			</div>

			<div className={section}>
				<span className={label}>Title</span>
				<input
					className={`${input} w-full`}
					value={draft.title}
					onChange={(e) => update((d) => (d.title = e.target.value))}
				/>
			</div>

			<div className={section}>
				<span className={label}>{perCategory ? 'Colors' : 'Series'}</span>
				{perCategory ? (
					<div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
						{categories.map((cat, i) => (
							<label key={cat} className="flex items-center gap-2">
								<input
									type="color"
									value={draft.seriesColors?.[cat] ?? categoryPalette[i] ?? '#2563eb'}
									onChange={(e) =>
										update((d) => {
											d.seriesColors = { ...(d.seriesColors ?? {}), [cat]: e.target.value }
										})
									}
									className={swatch}
								/>
								<span className="truncate text-sm" title={cat}>
									{cat}
								</span>
							</label>
						))}
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						{draft.series?.map((s, i) => (
							<div key={i} className="flex items-center gap-2">
								<input
									type="color"
									value={s.styling?.color ?? '#2563eb'}
									onChange={(e) =>
										update((d) => {
											d.series[i].styling = { ...(d.series[i].styling ?? {}), color: e.target.value }
										})
									}
									className={swatch}
								/>
								<input
									className={`${input} flex-1`}
									value={s.name}
									onChange={(e) => update((d) => (d.series[i].name = e.target.value))}
								/>
								{isCombo ? (
									<select
										className={`${input} w-24`}
										value={s.type}
										onChange={(e) => update((d) => (d.series[i].type = e.target.value as any))}
									>
										{SERIES_TYPES.map((t) => (
											<option key={t} value={t}>
												{t}
											</option>
										))}
									</select>
								) : null}
							</div>
						))}
					</div>
				)}
			</div>

			<div className={section}>
				<span className={label}>Axes</span>
				<div className="flex items-center gap-2">
					<span className={axisTag}>X</span>
					<input
						className={`${input} flex-1`}
						placeholder="X-axis label"
						value={draft.axes?.x?.label ?? ''}
						onChange={(e) => update((d) => (d.axes.x.label = e.target.value))}
					/>
				</div>
				{yAxes.map((a, i) => (
					<div key={a.id} className="flex flex-col gap-1.5">
						<div className="flex items-center gap-2">
							<span className={axisTag}>Y</span>
							<input
								className={`${input} flex-1`}
								placeholder="Y-axis label"
								value={a.label ?? ''}
								onChange={(e) => update((d) => (d.axes.yAxes[i].label = e.target.value))}
							/>
							<input
								className={`${input} w-16`}
								placeholder="unit"
								value={a.valueSymbol ?? draft.valueSymbol ?? ''}
								onChange={(e) => update((d) => (d.axes.yAxes[i].valueSymbol = e.target.value))}
							/>
						</div>
						<div className="flex items-center gap-2 pl-5.5">
							<input
								className={`${input} flex-1`}
								placeholder="min"
								value={a.min === undefined ? '' : String(a.min)}
								onChange={(e) =>
									update((d) => {
										const v = e.target.value.trim()
										const n = Number(v)
										d.axes.yAxes[i].min =
											v === '' ? undefined : v === 'dataMin' ? 'dataMin' : Number.isFinite(n) ? n : undefined
									})
								}
							/>
							<input
								className={`${input} flex-1`}
								placeholder="max"
								value={a.max === undefined ? '' : String(a.max)}
								onChange={(e) =>
									update((d) => {
										const v = e.target.value.trim()
										const n = Number(v)
										d.axes.yAxes[i].max =
											v === '' ? undefined : v === 'dataMax' ? 'dataMax' : Number.isFinite(n) ? n : undefined
									})
								}
							/>
							<input
								className={`${input} flex-1`}
								placeholder="step"
								value={a.interval === undefined ? '' : String(a.interval)}
								onChange={(e) =>
									update((d) => {
										const v = e.target.value.trim()
										const n = Number(v)
										d.axes.yAxes[i].interval = v === '' || !Number.isFinite(n) || n <= 0 ? undefined : n
									})
								}
							/>
						</div>
					</div>
				))}
			</div>

			{canEditHallmarks ? (
				<div className={section}>
					<span className={label}>Annotations</span>
					<div className="flex flex-col gap-1.5">
						{(draft.hallmarks ?? []).map((h, i) => (
							<div key={i} className="flex items-center gap-2">
								<input
									type="date"
									className={`${input} w-[140px]`}
									value={toDateInput(h[0])}
									onChange={(e) =>
										update((d) => {
											const hs = d.hallmarks ?? []
											const ts = fromDateInput(e.target.value)
											hs[i] = [Number.isFinite(ts) ? ts : (hs[i]?.[0] ?? 0), hs[i]?.[1] ?? '']
											d.hallmarks = hs
										})
									}
								/>
								<input
									className={`${input} flex-1`}
									placeholder="label"
									value={h[1] ?? ''}
									onChange={(e) =>
										update((d) => {
											const hs = d.hallmarks ?? []
											hs[i] = [hs[i]?.[0] ?? 0, e.target.value]
											d.hallmarks = hs
										})
									}
								/>
								<button
									onClick={() =>
										update((d) => {
											const hs = [...(d.hallmarks ?? [])]
											hs.splice(i, 1)
											d.hallmarks = hs
										})
									}
									aria-label="Remove annotation"
									className="shrink-0 rounded-md border border-medium px-2 py-1 text-sm text-ai-muted transition-colors hover:border-ai-error-vivid hover:text-ai-error-vivid"
								>
									×
								</button>
							</div>
						))}
					</div>
					<button
						onClick={() =>
							update((d) => {
								d.hallmarks = [...(d.hallmarks ?? []), [Math.floor(Date.now() / 1000), '']]
							})
						}
						className="self-start rounded-md border border-medium px-2.5 py-1 text-xs text-secondary transition-colors hover:border-brand"
					>
						+ Add annotation
					</button>
				</div>
			) : null}

			{hasHallmarks ? (
				<div className={section}>
					<span className={label}>Event markers</span>
					<div className="flex flex-wrap gap-1.5">
						{(['mark-line', 'event-rail'] as const).map((s) => (
							<button
								key={s}
								data-active={(draft.hallmarkStyle ?? 'mark-line') === s}
								onClick={() => update((d) => (d.hallmarkStyle = s))}
								className="rounded-md border border-medium px-2.5 py-1 text-xs transition-colors hover:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand data-[active=true]:font-medium data-[active=true]:text-ai-white"
							>
								{s === 'mark-line' ? 'Lines' : 'Event rail'}
							</button>
						))}
					</div>
				</div>
			) : null}

			{toggles.length > 0 || canLegend ? (
				<div className={section}>
					<div className="flex flex-wrap gap-x-5 gap-y-2">
						{toggles.map(([key, text]) => (
							<label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs">
								<input
									type="checkbox"
									className="size-3.5 accent-brand"
									checked={view[key]}
									onChange={(e) => onView(key, e.target.checked)}
								/>
								{text}
							</label>
						))}
						{canLegend ? (
							<label className="flex cursor-pointer items-center gap-1.5 text-xs">
								<input
									type="checkbox"
									className="size-3.5 accent-brand"
									checked={draft.legend?.show ?? true}
									onChange={(e) => update((d) => (d.legend = { show: e.target.checked }))}
								/>
								Legend
							</label>
						) : null}
					</div>
				</div>
			) : null}

			<div className="sticky bottom-0 -mx-4 mt-auto -mb-4 flex items-center justify-end gap-2 border-t border-ai-line bg-ai-surface px-4 py-3">
				{error ? (
					<span className="mr-auto text-xs text-ai-error-vivid">{error}</span>
				) : (
					<button
						onClick={reset}
						className="mr-auto rounded-md px-2 py-1.5 text-xs font-medium text-ai-muted transition-colors hover:text-ai-primary"
					>
						Reset
					</button>
				)}
				<button
					onClick={onClose}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-ai-tertiary transition-colors hover:text-ai-primary"
				>
					Cancel
				</button>
				<button
					onClick={save}
					disabled={saving || problems.length > 0}
					title={problems.length > 0 ? problems[0] : undefined}
					className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-ai-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	)
}
