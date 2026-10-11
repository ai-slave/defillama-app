import { useMutation } from '@tanstack/react-query'
import { type ReactNode, useMemo, useState } from 'react'
import { chartColor } from '~/constants/colors'
import type { ChartConfiguration, ChartStylePatch } from '~/containers/LlamaAI/chartTypes'
import type { ChartControlsModel } from '~/containers/LlamaAI/utils/chartCapabilities'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Dialog, DialogCancelButton, DialogDiscardGuard, DialogFooter, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Select } from '~/ui/Select'
import { ErrorLine } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'

const ALL_TYPES: Array<ChartConfiguration['type']> = ['line', 'area', 'bar', 'hbar', 'combo', 'pie', 'scatter']
const SERIES_TYPES = ['line', 'bar', 'area'] as const

// A series of unknown aggregation shows neither, so the owner has to choose.
const AGGREGATION_OPTIONS = [
	{ key: 'flow', name: 'Sum per period', help: 'Adds up the values in each week or month' },
	{ key: 'stock', name: 'End-of-period value', help: 'Keeps the last value in each week or month' }
]

// Only offer type swaps the current data shape can actually render — otherwise the chart says
// "no data available" (e.g. scatter needs a numeric x; pie/hbar need categories).
function compatibleTypes(xType: string | undefined): Array<ChartConfiguration['type']> {
	return ALL_TYPES.filter((t) => {
		if (t === 'scatter') return xType === 'value'
		if (t === 'pie' || t === 'hbar') return xType === 'category'
		return true // line / area / bar / combo work on category & time
	})
}

type ViewKey = 'logScale' | 'stacked' | 'showLabels' | 'percentage'
export type ChartStyleEditorView = Record<ViewKey, boolean>
type PreviewMode = 'immediate' | 'debounced'

type EditorCaps = Pick<
	ChartControlsModel,
	'showStack' | 'showPercentage' | 'showLogScale' | 'showLabels' | 'showHallmarks' | 'showGrouping'
>

interface ChartStyleEditorProps {
	/** The applied chart's title, shown under the dialog's heading. */
	chartTitle?: string
	config: ChartConfiguration
	original: ChartConfiguration
	caps: EditorCaps
	categories?: Array<string>
	view: ChartStyleEditorView
	resetView: ChartStyleEditorView
	onPreview: (draft: ChartConfiguration, view: ChartStyleEditorView) => void
	onSave: (draft: ChartConfiguration, patch: ChartStylePatch) => Promise<void>
	/** Closes the editor without saving. */
	onCancel: () => void
	/** The live preview. Beside the fields from md; below md a Preview / Style switch shows one at a time. */
	preview?: ReactNode
}

type EditorPane = 'preview' | 'style'
const EDITOR_PANES = [
	{ value: 'preview', label: 'Preview' },
	{ value: 'style', label: 'Style' }
] as const

type EditorDraft = Omit<ChartConfiguration, 'hallmarks'> & {
	hallmarks?: Array<{ id: string; value: [number, string] }>
}

function createDraft(config: ChartConfiguration): EditorDraft {
	return {
		...structuredClone(config),
		hallmarks: config.hallmarks?.map((value) => ({
			id: crypto.randomUUID(),
			value: [value[0], value[1] ?? '']
		}))
	}
}

function draftConfig(draft: EditorDraft): ChartConfiguration {
	return { ...draft, hallmarks: draft.hallmarks?.map((hallmark) => hallmark.value) }
}

const LEGEND_TYPES = new Set<ChartConfiguration['type']>(['line', 'area', 'bar', 'combo'])

const toDateInput = (unixSeconds: number): string => {
	const d = new Date(unixSeconds * 1000)
	return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
const fromDateInput = (value: string): number => Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000)

const identityOrder = (length: number): Array<number> => Array.from({ length }, (_, i) => i)

function reorderByPositions<T>(items: ReadonlyArray<T>, positions: ReadonlyArray<number>): Array<T> | null {
	if (items.length !== positions.length) return null
	const reordered: Array<T> = []
	for (const position of positions) {
		const item = items[position]
		if (item === undefined) return null
		reordered.push(item)
	}
	return reordered
}

// Series carry no id; their data binding is the only edit-proof identity (names are editable).
const seriesKey = (s: ChartConfiguration['series'][number]): string => JSON.stringify([s.yAxisId, s.dataMapping])

// Express `target`'s series order as indices into `base`'s series (what the server currently holds).
// Falls back to identity when the two configs don't describe the same series set.
function orderRelativeTo(target: ChartConfiguration, base: ChartConfiguration): Array<number> {
	if (target.series.length !== base.series.length) return identityOrder(target.series.length)
	const pool = new Map<string, Array<number>>()
	for (const [index, s] of base.series.entries()) {
		const key = seriesKey(s)
		pool.set(key, [...(pool.get(key) ?? []), index])
	}
	const out: Array<number> = []
	for (const s of target.series) {
		const index = pool.get(seriesKey(s))?.shift()
		if (index === undefined) return identityOrder(target.series.length)
		out.push(index)
	}
	return out
}

function toPatch(c: ChartConfiguration, view: ChartStyleEditorView, order?: Array<number>): ChartStylePatch {
	const yAxes: NonNullable<ChartStylePatch['yAxes']> = []
	for (const axis of c.axes.yAxes) {
		const patchAxis: NonNullable<ChartStylePatch['yAxes']>[number] = {
			id: axis.id,
			label: axis.label,
			position: axis.position
		}
		if (axis.valueSymbol !== undefined) patchAxis.valueSymbol = axis.valueSymbol
		if (axis.min !== undefined) patchAxis.min = axis.min
		if (axis.max !== undefined) patchAxis.max = axis.max
		if (axis.interval !== undefined) patchAxis.interval = axis.interval
		yAxes.push(patchAxis)
	}

	const series: NonNullable<ChartStylePatch['series']> = []
	for (const item of c.series) {
		const patchSeries: NonNullable<ChartStylePatch['series']>[number] = { name: item.name }
		if (item.styling.color !== undefined) patchSeries.color = item.styling.color
		if (isSeriesType(item.type)) patchSeries.type = item.type
		if (item.metricClass === 'flow' || item.metricClass === 'stock') patchSeries.metricClass = item.metricClass
		series.push(patchSeries)
	}

	const patch: ChartStylePatch = {
		title: c.title,
		type: c.type,
		showLabels: view.showLabels,
		defaultStacked: view.stacked,
		defaultPercentage: view.percentage,
		defaultLogScale: view.logScale,
		xAxisLabel: c.axes.x.label,
		yAxes,
		series
	}
	if (c.valueSymbol !== undefined) patch.valueSymbol = c.valueSymbol
	if (c.seriesColors !== undefined) patch.seriesColors = c.seriesColors
	if (c.hallmarks !== undefined) {
		const hallmarks: Array<[number, string]> = []
		for (const hallmark of c.hallmarks) hallmarks.push([hallmark[0], hallmark[1] ?? ''])
		patch.hallmarks = hallmarks
	}
	if (c.legend !== undefined) patch.legend = c.legend
	if (order && order.some((originalIndex, position) => originalIndex !== position)) patch.order = order
	return patch
}

function isSeriesType(value: string): value is (typeof SERIES_TYPES)[number] {
	return value === 'line' || value === 'bar' || value === 'area'
}

function updateItemAt<T>(items: Array<T>, targetIndex: number, update: (item: T) => void): void {
	for (const [index, item] of items.entries()) {
		if (index !== targetIndex) continue
		update(item)
		return
	}
}

const section = 'flex flex-col gap-2 border-t border-subtle pt-3 first:border-t-0 first:pt-0'
const sectionLabel = 'label-xs text-tertiary uppercase'
const swatch =
	'size-8 shrink-0 cursor-pointer rounded-lg border border-medium bg-page p-1 disabled:cursor-not-allowed disabled:opacity-60'
const axisTag = 'w-3.5 shrink-0 text-center label-sm text-tertiary'
const PREVIEW_DEBOUNCE_MS = 350

// hbar (single series) & pie color per category, not per series: a picker per bar/slice replaces the series names.
const colorsPerCategory = (draft: EditorDraft) =>
	draft.type === 'pie' || (draft.type === 'hbar' && (draft.series?.length ?? 1) <= 1)

/** Each series name's problem: empty, or repeating an earlier series' name. The cartesian adapter rejects either; a
    chart colored per category shows no name fields, and the pie and hbar adapters accept any name. */
function seriesNameIssues(draft: EditorDraft): Array<'empty' | 'duplicate' | null> {
	if (colorsPerCategory(draft)) return []
	const names = new Set<string>()
	return draft.series.map((item) => {
		const name = item.name.trim()
		if (!name) return 'empty'
		if (names.has(name)) return 'duplicate'
		names.add(name)
		return null
	})
}

const EMPTY_CATEGORIES: NonNullable<ChartStyleEditorProps['categories']> = []

export function ChartStyleEditor({
	chartTitle,
	config,
	original,
	caps,
	categories = EMPTY_CATEGORIES,
	view,
	resetView,
	onPreview,
	onSave,
	onCancel,
	preview
}: ChartStyleEditorProps) {
	// The editor owns this config-only draft. Keystrokes rerender the form, never SingleChart or its dataset pipeline.
	const [draft, setDraft] = useState<EditorDraft>(() => createDraft(config))
	// Draft render order expressed as indices into `config.series` — what update-chart-style permutes.
	const [seriesOrder, setSeriesOrder] = useState<Array<number>>(() => identityOrder(config.series?.length ?? 0))
	const [draftView, setDraftView] = useState<ChartStyleEditorView>(() => ({ ...view }))
	// The draft as it opened: leaving with the style, view or series order changed asks first.
	const draftSnapshot = JSON.stringify({ config: draftConfig(draft), view: draftView, order: seriesOrder })
	const [openedSnapshot] = useState(draftSnapshot)
	// The last failure, kept while a retry runs: the mutation clears its own error when the retry starts.
	const [saveFailed, setSaveFailed] = useState(false)
	const saveMutation = useMutation({
		mutationFn: ({ config: saved, patch }: { config: ChartConfiguration; patch: ChartStylePatch }) =>
			onSave(saved, patch),
		onError: () => setSaveFailed(true),
		onSuccess: () => setSaveFailed(false)
	})
	const [pane, setPane] = useState<EditorPane>('style')
	const isCombo = draft.type === 'combo'
	const debouncedPreview = useDebouncedCallback(onPreview, PREVIEW_DEBOUNCE_MS)

	const publishPreview = (nextDraft: EditorDraft, nextView: ChartStyleEditorView, mode: PreviewMode) => {
		const previewConfig = draftConfig(nextDraft)
		if (mode === 'immediate') {
			debouncedPreview.cancel()
			onPreview(previewConfig, nextView)
			return
		}
		debouncedPreview(previewConfig, nextView)
	}

	const update = (mutate: (d: EditorDraft) => void, mode: PreviewMode = 'debounced') => {
		const next = structuredClone(draft)
		mutate(next)
		setDraft(next)
		// Invalid display identities make the adapter reject the entire chart. Keep the
		// last valid preview visible while the user finishes editing the draft.
		if (seriesNameIssues(next).some(Boolean)) {
			debouncedPreview.cancel()
			return
		}
		publishPreview(next, draftView, mode)
	}

	// `positions[i]` = current draft position of the series that lands at position i.
	const reorderSeries = (positions: Array<number>) => {
		const next = structuredClone(draft)
		const reorderedSeries = reorderByPositions(next.series, positions)
		const reorderedSeriesOrder = reorderByPositions(seriesOrder, positions)
		if (!reorderedSeries || !reorderedSeriesOrder) return
		next.series = reorderedSeries
		setSeriesOrder(reorderedSeriesOrder)
		setDraft(next)
		publishPreview(next, draftView, 'immediate')
	}

	const moveSeries = (from: number, to: number) => {
		if (from < 0 || from >= draft.series.length || to < 0 || to >= draft.series.length) return
		const positions = identityOrder(draft.series.length)
		positions[from] = to
		positions[to] = from
		reorderSeries(positions)
	}

	const sortSeries = () => {
		const positions = draft.series
			.map((series, index) => ({ index, name: series.name }))
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
			.map(({ index }) => index)
		reorderSeries(positions)
	}

	const updateView = (key: ViewKey, value: boolean) => {
		const nextView = { ...draftView, [key]: value }
		setDraftView(nextView)
		publishPreview(draft, nextView, 'immediate')
	}

	const yAxes = useMemo(() => draft.axes?.yAxes ?? [], [draft])
	const availableTypes = useMemo(() => compatibleTypes(config.axes?.x?.type), [config])
	const perCategory = colorsPerCategory(draft)
	const canReorder = !perCategory && (draft.series?.length ?? 0) > 1
	const canEditHallmarks = draft.axes?.x?.type === 'time'
	const canLegend = LEGEND_TYPES.has(draft.type) && (draft.series?.length ?? 0) > 1

	// A repeated series name shows while typing; the other errors wait for Save.
	const [submitted, setSubmitted] = useState(false)
	const titleError = draft.title.trim() ? null : 'Enter a chart title.'
	const nameIssues = seriesNameIssues(draft)
	const nameErrors = nameIssues.map((issue) =>
		issue === 'duplicate'
			? 'Enter a name no other series uses.'
			: issue === 'empty' && submitted
				? 'Enter a series name.'
				: null
	)
	const axisErrors = yAxes.map((a) =>
		typeof a.min === 'number' && typeof a.max === 'number' && a.min >= a.max ? 'Enter a max above the min.' : null
	)

	const save = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (saveMutation.isPending) return
		if (titleError || nameIssues.some(Boolean) || axisErrors.some(Boolean)) {
			// On a phone the errors sit in the Style pane, which the reader may have swapped for the preview.
			return showFieldErrors(event.currentTarget, () => {
				setSubmitted(true)
				setPane('style')
			})
		}
		const savedConfig = draftConfig(draft)
		saveMutation.mutate({ config: savedConfig, patch: toPatch(savedConfig, draftView, seriesOrder) })
	}

	const reset = () => {
		const resetDraft = createDraft(original)
		const resetOrder = orderRelativeTo(original, config)
		// Aggregation describes the data, so preserve saved choices by binding when resetting presentation.
		for (const [index, series] of resetDraft.series.entries()) {
			series.metricClass = config.series[resetOrder[index]].metricClass
		}
		const nextView = { ...resetView }
		setDraft(resetDraft)
		setSeriesOrder(resetOrder)
		setDraftView(nextView)
		publishPreview(resetDraft, nextView, 'immediate')
	}

	const toggleOptions: Array<{ enabled: boolean; key: ViewKey; label: string }> = [
		{ enabled: caps.showLabels, key: 'showLabels', label: 'Logos' },
		{ enabled: caps.showStack, key: 'stacked', label: 'Stacked' },
		{ enabled: caps.showPercentage, key: 'percentage', label: 'Percentage' },
		{ enabled: caps.showLogScale, key: 'logScale', label: 'Log scale' }
	]
	const toggles: Array<[ViewKey, string]> = []
	for (const option of toggleOptions) {
		if (option.enabled) toggles.push([option.key, option.label])
	}

	return (
		// An outside tap never drops the draft; ×, Escape and Cancel ask first once it has changed, and wait for a save.
		<Dialog
			size="xl"
			workspace
			open
			onClose={onCancel}
			hideOnInteractOutside={false}
			portal
			pending={saveMutation.isPending}
		>
			<DialogHeader title="Edit chart" subtitle={chartTitle} />
			<DialogDiscardGuard
				when={draftSnapshot !== openedSnapshot}
				title="Discard chart changes?"
				description="Your edits to this chart's style are not saved."
			/>
			{preview ? (
				<div className="md:hidden">
					<DialogToolbar>
						<SegmentedControl<EditorPane>
							label="Editor view"
							options={EDITOR_PANES}
							value={pane}
							onValueChange={setPane}
							variant="solid-responsive"
							size="md"
						/>
					</DialogToolbar>
				</div>
			) : null}
			<form noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1">
					{preview ? (
						<div
							className={`min-w-0 flex-1 items-start justify-center overflow-auto p-4 md:flex md:items-center ${pane === 'preview' ? 'flex' : 'hidden'}`}
						>
							<div className="w-full">{preview}</div>
						</div>
					) : null}
					{/* The draft is locked while it saves: the editor closes when that save lands, so a later edit would be
				    lost. Save sits outside the fieldset, so it keeps focus. */}
					<fieldset
						disabled={saveMutation.isPending}
						className={`min-h-0 w-full flex-col gap-3 overflow-y-auto p-4 text-secondary md:flex ${preview ? 'border-subtle bg-surface-elevated-1 md:w-[340px] md:shrink-0 md:border-l' : ''} ${!preview || pane === 'style' ? 'flex' : 'hidden'}`}
						onBlurCapture={debouncedPreview.flush}
					>
						<span className={sectionLabel}>Style</span>

						<div className={section}>
							<span className={sectionLabel}>Type</span>
							<div className="flex flex-wrap gap-1.5">
								{availableTypes.map((t) => (
									<Button
										key={t}
										type="button"
										size="sm"
										variant={draft.type === t ? 'primary' : 'secondary'}
										onClick={() => update((d) => (d.type = t), 'immediate')}
									>
										<span className="capitalize">{t}</span>
									</Button>
								))}
							</div>
						</div>

						<div className={section}>
							<span className={sectionLabel}>Title</span>
							<Field hideLabel label="Chart title" error={submitted ? titleError : null}>
								{(control) => (
									<Input
										{...control}
										className="w-full"
										placeholder="Chart title"
										value={draft.title}
										onChange={(e) => update((d) => (d.title = e.target.value))}
									/>
								)}
							</Field>
						</div>

						<div className={section}>
							<div className="flex items-center justify-between">
								<span className={sectionLabel}>{perCategory ? 'Colors' : 'Series'}</span>
								{canReorder ? (
									<Button type="button" size="sm" aria-label="Sort series" onClick={sortSeries}>
										Sort
									</Button>
								) : null}
							</div>
							{perCategory ? (
								<div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
									{categories.map((cat, i) => (
										<label key={cat} className="flex items-center gap-2">
											<input
												type="color"
												value={draft.seriesColors?.[cat] ?? chartColor(i)}
												onChange={(e) =>
													update((d) => {
														d.seriesColors = { ...d.seriesColors, [cat]: e.target.value }
													}, 'immediate')
												}
												className={swatch}
											/>
											<span className="truncate body-md" title={cat}>
												{cat}
											</span>
										</label>
									))}
								</div>
							) : (
								<div className="flex flex-col gap-1.5">
									{draft.series?.map((s, i) => (
										<Field key={seriesOrder[i]} hideLabel label={`Series ${i + 1} name`} error={nameErrors[i]}>
											{(control) => (
												// The pane is narrow at every width: the swatch and name take one line, the selects and arrows share the next.
												<div className="flex flex-wrap items-center gap-2">
													<input
														type="color"
														value={s.styling?.color ?? chartColor(i)}
														onChange={(e) =>
															update((d) => {
																updateItemAt(d.series, i, (item) => {
																	item.styling = { ...item.styling, color: e.target.value }
																})
															}, 'immediate')
														}
														className={swatch}
														aria-label={`Series ${i + 1} color`}
													/>
													<Input
														{...control}
														className="min-w-48 flex-1"
														placeholder="Series name"
														value={s.name}
														onChange={(e) =>
															update((d) => updateItemAt(d.series, i, (item) => (item.name = e.target.value)))
														}
													/>
													{caps.showGrouping ? (
														<Select
															heading="How this series combines into week and month buckets"
															allValues={AGGREGATION_OPTIONS}
															selectedValues={s.metricClass}
															setSelectedValues={(metricClass: string) => {
																if (metricClass !== 'flow' && metricClass !== 'stock') return
																const yField = s.dataMapping.yField
																update((d) => {
																	for (const item of d.series) {
																		if (item.dataMapping.yField === yField) item.metricClass = metricClass
																	}
																}, 'immediate')
															}}
															label={
																AGGREGATION_OPTIONS.find((option) => option.key === s.metricClass)?.name ??
																'Choose aggregation'
															}
															labelType="none"
															variant="input"
															size="md"
															className="min-w-0 flex-1 basis-36"
															triggerProps={{ 'aria-label': `Series ${i + 1} aggregation` }}
														/>
													) : null}
													{isCombo ? (
														<Select
															heading={`Series ${i + 1} type`}
															allValues={SERIES_TYPES}
															selectedValues={s.type}
															setSelectedValues={(type: string) => {
																if (!isSeriesType(type)) return
																update((d) => updateItemAt(d.series, i, (item) => (item.type = type)), 'immediate')
															}}
															label={s.type}
															labelType="none"
															variant="input"
															size="md"
															className="min-w-0 flex-1 basis-20"
															triggerProps={{ 'aria-label': `Series ${i + 1} type` }}
														/>
													) : null}
													{canReorder ? (
														<div className="flex shrink-0 gap-0.5">
															<Tooltip
																content="Move up"
																render={
																	<Button
																		type="button"
																		size="sm"
																		square
																		aria-label={`Move series ${i + 1} up`}
																		disabled={i === 0}
																		accessibleWhenDisabled
																		onClick={() => moveSeries(i, i - 1)}
																	/>
																}
															>
																<Icon name="chevron-up" className="size-4" />
															</Tooltip>
															<Tooltip
																content="Move down"
																render={
																	<Button
																		type="button"
																		size="sm"
																		square
																		aria-label={`Move series ${i + 1} down`}
																		disabled={i === draft.series.length - 1}
																		accessibleWhenDisabled
																		onClick={() => moveSeries(i, i + 1)}
																	/>
																}
															>
																<Icon name="chevron-down" className="size-4" />
															</Tooltip>
														</div>
													) : null}
												</div>
											)}
										</Field>
									))}
								</div>
							)}
						</div>

						<div className={section}>
							<span className={sectionLabel}>Axes</span>
							<div className="flex items-center gap-2">
								<span className={axisTag}>X</span>
								<Input
									className="flex-1"
									aria-label="X-axis label"
									placeholder="X-axis label"
									value={draft.axes?.x?.label ?? ''}
									onChange={(e) => update((d) => (d.axes.x.label = e.target.value))}
								/>
							</div>
							{yAxes.map((a, i) => (
								<div key={a.id} className="flex flex-col gap-1.5">
									<div className="flex items-center gap-2">
										<span className={axisTag}>Y</span>
										<Input
											className="flex-1"
											aria-label={`Y-axis ${i + 1} label`}
											placeholder="Y-axis label"
											value={a.label ?? ''}
											onChange={(e) =>
												update((d) => updateItemAt(d.axes.yAxes, i, (axis) => (axis.label = e.target.value)))
											}
										/>
										<Input
											className="w-16"
											aria-label={`Y-axis ${i + 1} unit`}
											placeholder="unit"
											value={a.valueSymbol ?? draft.valueSymbol ?? ''}
											onChange={(e) =>
												update((d) => updateItemAt(d.axes.yAxes, i, (axis) => (axis.valueSymbol = e.target.value)))
											}
										/>
									</div>
									<Field
										hideLabel
										label={`Y-axis ${i + 1} max`}
										error={submitted ? axisErrors[i] : null}
										className="pl-5.5"
									>
										{(control) => (
											<div className="flex items-center gap-2">
												<Input
													className="flex-1"
													aria-label={`Y-axis ${i + 1} min`}
													placeholder="min"
													value={a.min === undefined ? '' : String(a.min)}
													onChange={(e) =>
														update((d) => {
															const v = e.target.value.trim()
															const n = Number(v)
															updateItemAt(d.axes.yAxes, i, (axis) => {
																if (v === '') delete axis.min
																else if (v === 'dataMin') axis.min = 'dataMin'
																else if (Number.isFinite(n)) axis.min = n
																else delete axis.min
															})
														})
													}
												/>
												<Input
													{...control}
													className="flex-1"
													placeholder="max"
													value={a.max === undefined ? '' : String(a.max)}
													onChange={(e) =>
														update((d) => {
															const v = e.target.value.trim()
															const n = Number(v)
															updateItemAt(d.axes.yAxes, i, (axis) => {
																if (v === '') delete axis.max
																else if (v === 'dataMax') axis.max = 'dataMax'
																else if (Number.isFinite(n)) axis.max = n
																else delete axis.max
															})
														})
													}
												/>
												<Input
													className="flex-1"
													aria-label={`Y-axis ${i + 1} step`}
													placeholder="step"
													value={a.interval === undefined ? '' : String(a.interval)}
													onChange={(e) =>
														update((d) => {
															const v = e.target.value.trim()
															const n = Number(v)
															updateItemAt(d.axes.yAxes, i, (axis) => {
																if (v === '' || !Number.isFinite(n) || n <= 0) delete axis.interval
																else axis.interval = n
															})
														})
													}
												/>
											</div>
										)}
									</Field>
								</div>
							))}
						</div>

						{canEditHallmarks ? (
							<div className={section}>
								<span className={sectionLabel}>Annotations</span>
								<div className="flex flex-col gap-1.5">
									{(draft.hallmarks ?? []).map((h, i) => (
										<div key={h.id} className="flex items-center gap-2">
											<Input
												type="date"
												className="w-36"
												aria-label={`Annotation ${i + 1} date`}
												value={toDateInput(h.value[0])}
												onChange={(e) =>
													update((d) => {
														const hs = d.hallmarks ?? []
														const ts = fromDateInput(e.target.value)
														hs[i] = { ...hs[i], value: [Number.isFinite(ts) ? ts : hs[i].value[0], hs[i].value[1]] }
														d.hallmarks = hs
													})
												}
											/>
											<Input
												className="flex-1"
												aria-label={`Annotation ${i + 1} label`}
												placeholder="label"
												value={h.value[1]}
												onChange={(e) =>
													update((d) => {
														const hs = d.hallmarks ?? []
														hs[i] = { ...hs[i], value: [hs[i].value[0], e.target.value] }
														d.hallmarks = hs
													})
												}
											/>
											<Tooltip
												content="Remove annotation"
												render={
													<Button
														type="button"
														size="sm"
														square
														variant="destructive"
														onClick={() =>
															update((d) => {
																const hs = [...(d.hallmarks ?? [])]
																hs.splice(i, 1)
																d.hallmarks = hs
															}, 'immediate')
														}
														aria-label="Remove annotation"
													/>
												}
											>
												<Icon name="x" className="size-4" />
											</Tooltip>
										</div>
									))}
								</div>
								<Button
									type="button"
									size="sm"
									onClick={() =>
										update((d) => {
											d.hallmarks = [
												...(d.hallmarks ?? []),
												{ id: crypto.randomUUID(), value: [Math.floor(Date.now() / 1000), ''] }
											]
										}, 'immediate')
									}
									className="self-start"
								>
									+ Add annotation
								</Button>
							</div>
						) : null}

						{toggles.length > 0 || canLegend ? (
							<div className={section}>
								<div className="flex flex-wrap gap-x-5 gap-y-2">
									{toggles.map(([key, text]) => (
										<Checkbox
											key={key}
											variant="inline"
											checked={draftView[key]}
											onChange={(e) => updateView(key, e.target.checked)}
										>
											{text}
										</Checkbox>
									))}
									{canLegend ? (
										<Checkbox
											variant="inline"
											checked={draft.legend?.show ?? true}
											onChange={(e) => update((d) => (d.legend = { show: e.target.checked }), 'immediate')}
										>
											Legend
										</Checkbox>
									) : null}
								</div>
							</div>
						) : null}
					</fieldset>
				</div>
				<DialogFooter
					leading={
						saveFailed ? (
							<ErrorLine inset="none">Couldn&apos;t save the chart style. Save again to retry.</ErrorLine>
						) : (
							<Button
								type="button"
								variant="ghost"
								size="md"
								onClick={reset}
								disabled={saveMutation.isPending}
								accessibleWhenDisabled
							>
								Reset
							</Button>
						)
					}
					dismiss={<DialogCancelButton />}
				>
					<Button type="submit" variant="primary" size="md" pendingLabel="Saving…" pending={saveMutation.isPending}>
						Save
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
