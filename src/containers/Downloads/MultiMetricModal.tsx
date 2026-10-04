import * as Ariakit from '@ariakit/react'
import { useQueries } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { setSignupSource } from '~/auth/signupSource'
import {
	VirtualizedMultiSelect,
	VirtualizedSelect,
	type VirtualizedSelectOption
} from '~/components/Select/VirtualizedSelect'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { useRecentDownloads, useSavedDownloads } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { keepFocus } from '~/ui/focus'
import { Icon, type IIcon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tag } from '~/ui/Tag'
import { slug as toSlug } from '~/utils'
import { downloadTabular, type DownloadFormat } from '~/utils/download'
import { formatNumber } from '~/utils/numberFormat'
import { ActionFeedbackStatus, useActionFeedback } from './ActionFeedback'
import { chartDatasets, chartDatasetsBySlug, type ChartDatasetDefinition, type ChartOptionsMap } from './chart-datasets'
import { combineCsvsWide, type CsvItem } from './combineCsvsWide'
import { filterCsvByDateRange, filterParsedRowsByDateRange } from './csvDateFilter'
import { parseCsv, type ParsedCsvRow } from './csvParse'
import { DateRangePicker } from './DateRangePicker'
import { fetchDownloadCsv } from './fetchDownloadCsv'
import { SavePresetDialog } from './PresetDialogs'
import { PreviewHeaderActions } from './PreviewHeaderActions'
import { PreviewPaywall } from './PreviewPaywall'
import {
	type AppliedMultiMetricConfig,
	applyMultiMetricConfig,
	type DateRangeConfig,
	defaultPresetName,
	extractMultiMetricConfig,
	generatePresetId,
	missingMultiMetricNotices,
	type MultiMetricSavedConfig,
	type SavedDownloadInput
} from './savedDownloads'
import { SavedPresetNotice } from './SavedPresetNotice'
import { type CsvQueryStatus, SelectedListSidebar } from './SelectedListSidebar'
import { buildShareUrl } from './urlState'

const MAX_METRICS = 25
const PREVIEW_ROWS = 200
const SUGGESTED_COUNT = 8

export interface ParamOption {
	label: string
	value: string
	category?: string
	isChild?: boolean
}

const EMPTY_PARAM_OPTIONS: Array<ParamOption> = []

export type ParamType = 'protocol' | 'chain'

const PARAM_LABELS: Record<ParamType, { singular: string; title: string; verb: string }> = {
	protocol: { singular: 'protocol', title: 'Protocol', verb: 'Pick a protocol' },
	chain: { singular: 'chain', title: 'Chain', verb: 'Pick a chain' }
}

interface MultiMetricModalProps {
	chartOptionsMap: ChartOptionsMap
	authorizedFetch: (url: string, options?: RequestInit) => Promise<Response>
	onClose: () => void
	isPreview: boolean
	initialConfig?: MultiMetricSavedConfig
}

function resolveDatasetValue(
	paramValue: string,
	paramType: ParamType,
	datasetOptions: Array<ParamOption>
): string | null {
	if (paramType === 'protocol') {
		// All protocol datasets share the toSlug(p.name) convention.
		return datasetOptions.find((o) => o.value === paramValue)?.value ?? null
	}
	// Chains: values are inconsistent across datasets — some raw (e.g. "Ethereum"),
	// some slugged (e.g. "ethereum"). Match on either form.
	const lower = paramValue.toLowerCase()
	const slugged = toSlug(paramValue)
	for (const opt of datasetOptions) {
		if (opt.value === paramValue) return opt.value
		if (opt.value.toLowerCase() === lower) return opt.value
		if (opt.value === slugged) return opt.value
		if (toSlug(opt.label) === slugged) return opt.value
	}
	return null
}

function paramSlugForFilename(value: string): string {
	const s = toSlug(value)
	return s || 'combined'
}

const METRIC_CATEGORY_ORDER: Record<string, number> = {
	TVL: 0,
	'Fees & Revenue': 1,
	RWA: 9
}

function metricSortWeight(slug: string): number {
	const dataset = chartDatasetsBySlug.get(slug)
	if (!dataset) return 2
	return METRIC_CATEGORY_ORDER[dataset.category] ?? 2
}

function shortMetricName(dataset: ChartDatasetDefinition): string {
	return dataset.name
		.replace(/^(Protocol|Chain)\s+/i, '')
		.replace(/\s+Chart$/i, '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
}

function metricDisplayName(dataset: ChartDatasetDefinition): string {
	return dataset.name.replace(/^Protocol\s+/i, '')
}

/** Drop selected metrics that the current param no longer offers, keeping the array identity when nothing changes. */
export function pruneUnavailableMetrics(selected: Array<string>, available: Array<{ slug: string }>): Array<string> {
	const availableSlugs = new Set(available.map((metric) => metric.slug))
	const next = selected.filter((slug) => availableSlugs.has(slug))
	return next.length === selected.length ? selected : next
}

/** Keep the highlighted metric while it is still selected, else highlight the first selected one. */
export function resolveActiveMetric(current: string | null, selected: Array<string>): string | null {
	if (selected.length === 0) return null
	if (current && selected.includes(current)) return current
	return selected[0]
}

export function MultiMetricModal({
	chartOptionsMap,
	authorizedFetch,
	onClose,
	isPreview,
	initialConfig
}: MultiMetricModalProps) {
	const subscribeModalStore = Ariakit.useDialogStore()
	const { savedDownloads, saveDownload } = useSavedDownloads()
	const { recordRecent } = useRecentDownloads()
	const [paramType, setParamType] = useState<ParamType>(initialConfig?.paramType ?? 'protocol')
	const [param, setParam] = useState<ParamOption | null>(null)
	const [selectedMetrics, setSelectedMetrics] = useState<Array<string>>([])
	// The metric the user chose to preview. Removing it forgets it, so re-selecting it later does not silently
	// bring it back.
	const [preferredMetric, setPreferredMetric] = useState<string | null>(null)
	const dateRangeTriggerRef = useRef<HTMLButtonElement>(null)
	const [dateRange, setDateRange] = useState<DateRangeConfig | null>(initialConfig?.dateRange ?? null)
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	// Phones show the table or the selected list, one at a time; from sm both sit side by side.
	const [showSelected, setShowSelected] = useState(false)
	const selectedToggleRef = useRef<HTMLButtonElement>(null)
	const { outcome, report, confirmed } = useActionFeedback()
	// Takes focus when the control that had it leaves with the last selected metric.
	const metricPickerRef = useRef<HTMLButtonElement>(null)
	const [appliedInitial, setAppliedInitial] = useState<AppliedMultiMetricConfig | null>(null)

	const protocolOptions = chartOptionsMap['protocol-tvl-chart'] ?? EMPTY_PARAM_OPTIONS
	const chainOptions = chartOptionsMap['chain-tvl-chart'] ?? EMPTY_PARAM_OPTIONS
	const paramOptions = paramType === 'protocol' ? protocolOptions : chainOptions

	// Seed the saved param and metrics once the option list for the saved param type has loaded.
	const initialOptions = initialConfig?.paramType === 'protocol' ? protocolOptions : chainOptions
	if (initialConfig && appliedInitial === null && initialOptions.length > 0) {
		const applied = applyMultiMetricConfig(initialConfig, initialOptions, new Set(chartDatasets.map((d) => d.slug)))
		setAppliedInitial(applied)
		if (!applied.missingParam) {
			setParam(applied.param)
			setSelectedMetrics(applied.metrics)
		}
	}
	const savedPresetNotices =
		initialConfig && appliedInitial ? missingMultiMetricNotices(initialConfig, appliedInitial) : []

	const availableMetrics = useMemo(() => {
		if (!param) return []
		return chartDatasets.filter((d) => {
			if (d.paramType !== paramType) return false
			const opts = chartOptionsMap[d.slug] ?? []
			return resolveDatasetValue(param.value, paramType, opts) !== null
		})
	}, [param, paramType, chartOptionsMap])

	// Reconciling in render reads the current lists, so the stale-closure hazard the effect version had is
	// gone: it could observe the pre-apply `availableMetrics` on the same pass that the saved config was
	// applied and wipe the metrics back to []. Pruning still waits for a param, which is what selects them.
	const [syncedAvailableMetrics, setSyncedAvailableMetrics] = useState(availableMetrics)
	if (availableMetrics !== syncedAvailableMetrics) {
		setSyncedAvailableMetrics(availableMetrics)
		if (param) setSelectedMetrics((prev) => pruneUnavailableMetrics(prev, availableMetrics))
	}

	const activeMetric = resolveActiveMetric(preferredMetric, selectedMetrics)

	const csvQueries = useQueries({
		queries: selectedMetrics.map((slug) => {
			const datasetOpts = chartOptionsMap[slug] ?? []
			const datasetValue = param ? resolveDatasetValue(param.value, paramType, datasetOpts) : null
			return {
				queryKey: ['multi-metric', slug, paramType, datasetValue, isPreview] as const,
				queryFn: async () => {
					if (!datasetValue) throw new Error(`Not available for this ${PARAM_LABELS[paramType].singular}`)
					return fetchDownloadCsv(`/api/private/downloads/chart/${slug}?param=${encodeURIComponent(datasetValue)}`, {
						isPreview,
						authorizedFetch
					})
				},
				enabled: !!param && !!datasetValue,
				staleTime: 5 * 60 * 1000,
				refetchOnWindowFocus: false,
				retry: 1
			}
		})
	})

	const activeQueryIndex = useMemo(
		() => selectedMetrics.findIndex((s) => s === activeMetric),
		[selectedMetrics, activeMetric]
	)
	const activeQuery = activeQueryIndex >= 0 ? csvQueries[activeQueryIndex] : null
	const activeCsvText = (activeQuery?.data as string | undefined) ?? undefined
	const activeLoading = !!activeQuery?.isLoading
	const activeError = activeQuery?.error
	const activeDataset = activeMetric ? (chartDatasetsBySlug.get(activeMetric) ?? null) : null

	const parsedActive = useMemo(() => (activeCsvText ? parseCsv(activeCsvText) : null), [activeCsvText])

	const activeDateColIndex = useMemo(() => parsedActive?.headers.indexOf('date') ?? -1, [parsedActive])

	const dateBounds = useMemo(() => {
		if (!parsedActive || activeDateColIndex < 0) return { min: undefined, max: undefined } as const
		let min: string | undefined
		let max: string | undefined
		for (const row of parsedActive.rows) {
			const d = row.values[activeDateColIndex]
			if (!d) continue
			if (min === undefined || d < min) min = d
			if (max === undefined || d > max) max = d
		}
		return { min, max } as const
	}, [parsedActive, activeDateColIndex])

	const parsedActiveFiltered = useMemo(() => {
		if (!parsedActive) return null
		const filtered = filterParsedRowsByDateRange(parsedActive.rows, activeDateColIndex, dateRange)
		return { headers: parsedActive.headers, rows: filtered }
	}, [parsedActive, activeDateColIndex, dateRange])

	const readyCount = csvQueries.filter((q) => typeof q.data === 'string').length
	const loadingCount = csvQueries.filter((q) => q.isLoading).length

	// The picker keeps the order of existing picks and adds new ones at the end. A metric it adds or removes stops
	// being the preferred one: unpicked it is gone, and picked again it was dropped meanwhile.
	const handleMetricsChange = (values: Array<string>) => {
		setPreferredMetric((preferred) =>
			preferred !== null && selectedMetrics.includes(preferred) && values.includes(preferred) ? preferred : null
		)
		setSelectedMetrics(values)
	}

	const handleClearMetrics = useCallback(() => {
		setSelectedMetrics([])
		setPreferredMetric(null)
	}, [])

	const handleSelectAll = useCallback(() => {
		setSelectedMetrics(availableMetrics.slice(0, MAX_METRICS).map((m) => m.slug))
		// Select all reorders the list; the metric on screen stays while it is still in it.
		setPreferredMetric(activeMetric)
	}, [availableMetrics, activeMetric])

	const handleRemoveMetric = useCallback((slug: string) => {
		setSelectedMetrics((prev) => prev.filter((s) => s !== slug))
		setPreferredMetric((preferred) => (preferred === slug ? null : preferred))
	}, [])

	const handleSetActive = useCallback((slug: string) => setPreferredMetric(slug), [])

	const handleChangeParam = useCallback((next: ParamOption) => {
		setParam(next)
	}, [])

	const handleChangeParamType = useCallback(
		(next: ParamType) => {
			if (next === paramType) return
			setParamType(next)
			setParam(null)
			setSelectedMetrics([])
			setPreferredMetric(null)
		},
		[paramType]
	)

	const handleDownloadCombined = useCallback(
		(format: DownloadFormat, action: string) => {
			if (!param) return
			const readyWithSlug: Array<CsvItem & { slug: string }> = []
			const failed: Array<{ slug: string; name: string }> = []
			for (const [i, query] of csvQueries.entries()) {
				const slug = selectedMetrics[i]
				if (!slug) continue
				const dataset = chartDatasetsBySlug.get(slug)
				if (!dataset) continue
				const data = query.data as unknown
				if (typeof data === 'string') {
					readyWithSlug.push({ label: dataset.name, value: shortMetricName(dataset), csvText: data, slug })
					continue
				}
				const err = (query as { error?: unknown }).error
				if (err) failed.push({ slug, name: dataset.name })
			}
			if (readyWithSlug.length === 0) {
				report(action, false, 'No data ready to download')
				return
			}
			readyWithSlug.sort((a, b) => metricSortWeight(a.slug) - metricSortWeight(b.slug))
			const ready: Array<CsvItem> = readyWithSlug
			const merged = combineCsvsWide(ready, dateRange)
			if (merged.length <= 1) {
				report(action, false, 'No rows to download')
				return
			}
			const filename = `${paramSlugForFilename(param.value)}_metrics.${format}`
			downloadTabular(format, filename, merged, { addTimestamp: true })
			if (failed.length > 0) {
				report(
					action,
					true,
					`Downloaded ${filename} — skipped ${failed.length} (${failed.map((f) => f.name).join(', ')})`
				)
			} else {
				report(action, true, `Downloaded ${filename}`)
			}

			const configBase = extractMultiMetricConfig({
				paramType,
				param: param.value,
				paramLabel: param.label,
				metrics: selectedMetrics,
				dateRange
			})
			recordRecent({
				...configBase,
				id: generatePresetId(),
				name: defaultPresetName(configBase),
				createdAt: Date.now()
			})
		},
		[csvQueries, selectedMetrics, param, paramType, dateRange, recordRecent, report]
	)

	const handleDownloadSingle = useCallback(
		(slug: string, format: DownloadFormat, action: string) => {
			if (!param) return
			const idx = selectedMetrics.findIndex((s) => s === slug)
			if (idx < 0) return
			const query = csvQueries[idx]
			const data = query?.data as unknown
			if (typeof data !== 'string' || !data) {
				report(action, false, 'Not ready yet')
				return
			}
			const dataset = chartDatasetsBySlug.get(slug)
			if (!dataset) return
			const filename = `${paramSlugForFilename(param.value)}_${shortMetricName(dataset)}.${format}`
			const payload = filterCsvByDateRange(data, dateRange)
			// Format toggle needs 2D array; parse the filtered CSV string once.
			const parsed = parseCsv(payload)
			const rows2D: Array<Array<string>> = [parsed.headers, ...parsed.rows.map((r) => r.values)]
			downloadTabular(format, filename, rows2D, { addTimestamp: true })
			report(action, true, `Downloaded ${filename}`)

			const configBase = extractMultiMetricConfig({
				paramType,
				param: param.value,
				paramLabel: param.label,
				metrics: [slug],
				dateRange
			})
			recordRecent({
				...configBase,
				id: generatePresetId(),
				name: defaultPresetName(configBase),
				createdAt: Date.now()
			})
		},
		[csvQueries, selectedMetrics, param, paramType, dateRange, recordRecent, report]
	)

	const handleSubscribeClick = useCallback(() => {
		setSignupSource('downloads')
		subscribeModalStore.show()
	}, [subscribeModalStore])

	const handleSavePreset = useCallback(
		(name: string) => {
			if (!param) return
			const configBase = extractMultiMetricConfig({
				paramType,
				param: param.value,
				paramLabel: param.label,
				metrics: selectedMetrics,
				dateRange
			})
			saveDownload({
				...configBase,
				id: generatePresetId(),
				name,
				createdAt: Date.now()
			})
			setShowSaveDialog(false)
			report('save-preset', true, `Saved preset "${name}"`)
		},
		[param, paramType, selectedMetrics, dateRange, saveDownload, report]
	)

	const currentConfig = useMemo<SavedDownloadInput | null>(() => {
		if (!param) return null
		return extractMultiMetricConfig({
			paramType,
			param: param.value,
			paramLabel: param.label,
			metrics: selectedMetrics,
			dateRange
		})
	}, [param, paramType, selectedMetrics, dateRange])

	const handleCopyLink = useCallback(async () => {
		if (!currentConfig) {
			report('copy-link', false, 'Nothing to share yet')
			return
		}
		if (typeof window === 'undefined' || !navigator.clipboard) {
			report('copy-link', false, 'Clipboard not available')
			return
		}
		try {
			const url = buildShareUrl(window.location.origin, '/downloads', currentConfig)
			if (url.length > 2000) {
				report('copy-link', false, 'Config too large to share — save as preset instead')
				return
			}
			await navigator.clipboard.writeText(url)
			report('copy-link', true, 'Link copied')
		} catch {
			report('copy-link', false, 'Failed to copy link')
		}
	}, [currentConfig, report])

	const suggestedPresetName = useMemo(() => {
		if (!currentConfig) return ''
		return defaultPresetName(currentConfig)
	}, [currentConfig])

	const existingPresetNames = useMemo(() => savedDownloads.map((s) => s.name), [savedDownloads])

	const handleTopBarDownload = useCallback(
		(format: DownloadFormat = 'csv') => {
			if (isPreview) {
				handleSubscribeClick()
				return
			}
			if (selectedMetrics.length === 1) {
				handleDownloadSingle(selectedMetrics[0], format, 'download')
			} else {
				handleDownloadCombined(format, 'download')
			}
		},
		[isPreview, selectedMetrics, handleSubscribeClick, handleDownloadSingle, handleDownloadCombined]
	)

	const isBulk = selectedMetrics.length > 1
	const hasSelection = selectedMetrics.length > 0
	// The list exists only for two or more metrics (the trigger names a single one), so dropping to one brings the
	// table back, and a later second pick opens on the table too.
	if (showSelected && !(param && isBulk)) setShowSelected(false)
	const downloadLabel = isBulk ? 'Download combined' : 'Download CSV'
	const topBarDownloadDisabled =
		!isPreview &&
		(!param ||
			!hasSelection ||
			(isBulk ? loadingCount === selectedMetrics.length || readyCount === 0 : activeLoading || !activeCsvText))

	const activeTotalRows = parsedActive?.rows.length ?? 0
	const activeFilteredRows = parsedActiveFiltered?.rows.length ?? 0
	const filterActive = !!dateRange

	const headerSubtitle = (() => {
		if (!param) return `${PARAM_LABELS[paramType].verb} to begin`
		if (!hasSelection) {
			return `${availableMetrics.length} metrics available — pick any to combine`
		}
		if (loadingCount > 0) {
			return `Loading ${readyCount}/${selectedMetrics.length}`
		}
		if (isBulk) {
			return `${selectedMetrics.length} metrics ready · previewing ${
				activeDataset ? metricDisplayName(activeDataset) : ''
			}`
		}
		if (activeError) return 'Error loading metric'
		if (parsedActive) {
			const rowsLabel = filterActive
				? `${formatNumber(activeFilteredRows)} of ${formatNumber(activeTotalRows)} rows`
				: `${formatNumber(activeTotalRows)} rows`
			return `${rowsLabel} · ${parsedActive.headers.length} cols`
		}
		return ''
	})()

	const suggestions = useMemo(() => paramOptions.slice(0, SUGGESTED_COUNT), [paramOptions])
	// Grouped by category, in the order categories first appear, so each category's heading shows once.
	const metricOptions = useMemo(() => {
		const groups = new Map<string, Array<VirtualizedSelectOption>>()
		for (const metric of availableMetrics) {
			const group = groups.get(metric.category) ?? []
			group.push({ value: metric.slug, label: metricDisplayName(metric), group: metric.category })
			groups.set(metric.category, group)
		}
		return [...groups.values()].flat()
	}, [availableMetrics])

	return (
		<>
			{/* Opens on the metric picker; before a protocol or chain is picked, the empty state's picker takes focus. */}
			<Dialog size="xl" workspace open onClose={onClose} initialFocus={param ? metricPickerRef : undefined}>
				<DialogHeader
					title={
						<>
							{param ? (
								<>
									{param.label} <Tag className="align-middle">Combined</Tag>
								</>
							) : (
								'Combined report'
							)}
						</>
					}
					subtitle={headerSubtitle}
					actions={
						param && hasSelection ? (
							isPreview ? (
								<PreviewHeaderActions
									mode="preview"
									downloadLabel={downloadLabel}
									copy={false}
									onSubscribe={handleSubscribeClick}
								/>
							) : (
								<PreviewHeaderActions
									mode="full"
									confirmed={confirmed}
									downloadLabel={downloadLabel}
									copy={null}
									savePreset={{ run: () => setShowSaveDialog(true), disabled: false }}
									copyLink={{ run: () => void handleCopyLink(), disabled: !currentConfig }}
									onDownload={handleTopBarDownload}
									downloadDisabled={topBarDownloadDisabled}
								/>
							)
						) : null
					}
				/>

				{/* Until a protocol or chain is picked, the empty state below is the picker. */}
				{param ? (
					<DialogToolbar>
						<div className="flex flex-wrap items-center gap-2">
							<VirtualizedSelect
								variant="chip"
								label={PARAM_LABELS[paramType].title}
								options={paramOptions}
								selectedValue={param.value}
								onChange={handleChangeParam}
								placeholder={PARAM_LABELS[paramType].verb}
								headerRow={
									<div className="px-3 pb-2">
										<SegmentedControl<ParamType>
											label="Pick by"
											value={paramType}
											onValueChange={handleChangeParamType}
											options={PARAM_TYPE_OPTIONS}
											variant="default"
											size="sm"
										/>
									</div>
								}
							/>

							<VirtualizedMultiSelect
								variant="chip"
								label="Metrics"
								triggerRef={metricPickerRef}
								options={metricOptions}
								selectedValues={selectedMetrics}
								onChange={handleMetricsChange}
								placeholder="None"
								maxSelections={MAX_METRICS}
							/>

							{hasSelection && !isPreview ? (
								<DateRangePicker
									triggerRef={dateRangeTriggerRef}
									value={dateRange}
									onChange={setDateRange}
									minDate={dateBounds.min}
									maxDate={dateBounds.max}
								/>
							) : null}

							{isBulk ? (
								<Button
									variant="filter"
									size="md"
									data-active={showSelected}
									aria-pressed={showSelected}
									className="sm:hidden"
									onClick={() => setShowSelected((shown) => !shown)}
									ref={selectedToggleRef}
								>
									Selected ({selectedMetrics.length})
								</Button>
							) : null}

							{isPreview ? <p className="ml-auto text-[11px] text-pro-text-tertiary">Preview — last 10 rows</p> : null}
						</div>
					</DialogToolbar>
				) : null}
				{/* Each band draws the line under itself, as the toolbar above does. */}
				<SavedPresetNotice notices={savedPresetNotices} />
				<ActionFeedbackStatus outcome={outcome} />

				<DialogBody kind="flush">
					<div className="flex h-full min-h-0">
						<div className={`min-h-0 min-w-0 flex-1 flex-col ${showSelected ? 'hidden sm:flex' : 'flex'}`}>
							{!param ? (
								<ParamPickerEmpty
									paramType={paramType}
									onChangeParamType={handleChangeParamType}
									options={paramOptions}
									suggestions={suggestions}
									onSelect={handleChangeParam}
								/>
							) : !hasSelection ? (
								<EmptyState
									paramType={paramType}
									availableCount={availableMetrics.length}
									onSelectAll={
										availableMetrics.length > 0
											? () => keepFocus(handleSelectAll, () => metricPickerRef.current)
											: undefined
									}
								/>
							) : !activeMetric ? (
								<CenteredHint icon="search" text="Pick a metric to preview" />
							) : activeLoading ? (
								<CenteredLoader />
							) : activeError ? (
								<CenteredError error={activeError} />
							) : !parsedActive || parsedActive.rows.length === 0 ? (
								<CenteredHint icon="eye-off" text="No data" />
							) : !parsedActiveFiltered || parsedActiveFiltered.rows.length === 0 ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center">
										<Icon name="search" className="size-6 text-pro-text-tertiary" />
										<p className="text-sm text-pro-text-secondary">No rows in selected date range</p>
										<button
											type="button"
											// Clearing removes this button; focus returns to the range picker it cleared.
											onClick={() =>
												keepFocus(
													() => setDateRange(null),
													() => dateRangeTriggerRef.current
												)
											}
											className="mt-1 rounded-md border border-subtle px-3 py-1 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
										>
											Clear date range
										</button>
									</div>
								</div>
							) : (
								<PreviewTable parsed={parsedActiveFiltered} isPreview={isPreview} />
							)}
						</div>

						{param && isBulk ? (
							<SelectedListSidebar
								noun="metric"
								items={selectedMetrics.map((slug) => ({
									value: slug,
									label: metricDisplayName(chartDatasetsBySlug.get(slug)!)
								}))}
								queries={csvQueries as ReadonlyArray<CsvQueryStatus>}
								activeValue={activeMetric}
								onPreview={(slug) =>
									// On a phone, previewing a metric switches to the table; the toggle keeps focus there.
									keepFocus(
										() => {
											handleSetActive(slug)
											setShowSelected(false)
										},
										() => selectedToggleRef.current
									)
								}
								showOnPhone={showSelected}
								onRemove={handleRemoveMetric}
								onClearAll={handleClearMetrics}
								onDownload={(metric) => handleDownloadSingle(metric.value, 'csv', `download:${metric.value}`)}
								confirmed={confirmed}
								pickerTrigger={() => metricPickerRef.current}
								isPreview={isPreview}
								readyCount={readyCount}
								loadingCount={loadingCount}
							/>
						) : null}
					</div>
				</DialogBody>
			</Dialog>

			{isPreview ? <LazySubscribeProModal dialogStore={subscribeModalStore} /> : null}
			{showSaveDialog ? (
				<SavePresetDialog
					suggestedName={suggestedPresetName}
					existingNames={existingPresetNames}
					onSave={handleSavePreset}
					onClose={() => setShowSaveDialog(false)}
				/>
			) : null}
		</>
	)
}

const PARAM_TYPE_OPTIONS: Array<{ value: ParamType; label: string }> = [
	{ value: 'protocol', label: 'Protocol' },
	{ value: 'chain', label: 'Chain' }
]

function ParamPickerEmpty({
	paramType,
	onChangeParamType,
	options,
	suggestions,
	onSelect
}: {
	paramType: ParamType
	onChangeParamType: (next: ParamType) => void
	options: Array<ParamOption>
	suggestions: Array<ParamOption>
	onSelect: (opt: ParamOption) => void
}) {
	const labels = PARAM_LABELS[paramType]

	return (
		<div className="flex flex-1 items-center justify-center px-6 py-8">
			<div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
				<div className="flex size-11 items-center justify-center rounded-full bg-brand/10">
					<Icon name="layers" className="size-5 text-brand" />
				</div>
				<div className="flex flex-col gap-1">
					<p className="text-base font-medium text-pro-text-primary">Choose a {labels.singular} to begin</p>
					<p className="text-xs text-pro-text-tertiary">
						Pick a {labels.singular} — we&rsquo;ll show its available metrics so you can combine them.
					</p>
				</div>

				<SegmentedControl<ParamType>
					label="Pick by"
					value={paramType}
					onValueChange={onChangeParamType}
					options={PARAM_TYPE_OPTIONS}
					variant="default"
					size="md"
				/>

				<VirtualizedSelect
					variant="field"
					label={labels.title}
					options={options}
					selectedValue={null}
					onChange={onSelect}
					placeholder={labels.verb}
					autoFocus
					className="w-full text-left"
				/>

				{suggestions.length > 0 ? (
					<div className="flex flex-col items-center gap-2">
						<p className="text-[10px] font-semibold tracking-[0.08em] text-pro-text-tertiary uppercase">
							Or start with
						</p>
						<div className="flex flex-wrap justify-center gap-1.5">
							{suggestions.map((opt) => (
								<Button key={opt.value} type="button" variant="secondary" size="sm" onClick={() => onSelect(opt)}>
									{opt.label}
								</Button>
							))}
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
}

function EmptyState({
	paramType,
	availableCount,
	onSelectAll
}: {
	paramType: ParamType
	availableCount: number
	onSelectAll?: () => void
}) {
	return (
		<div className="flex flex-1 items-center justify-center px-6">
			<div className="flex max-w-sm flex-col items-center gap-3 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-brand/10">
					<Icon name="layers" className="size-5 text-brand" />
				</div>
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium text-pro-text-primary">Select metrics to combine</p>
					<p className="text-xs text-pro-text-tertiary">
						{availableCount > 0
							? `Pick any of ${availableCount} time-series metrics from the toolbar above. They'll merge into one CSV with date columns aligned.`
							: `No time-series metrics available for this ${PARAM_LABELS[paramType].singular}.`}
					</p>
				</div>
				{onSelectAll ? (
					<button
						type="button"
						onClick={onSelectAll}
						className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
					>
						<Icon name="check" className="size-3.5" />
						Select all {availableCount}
					</button>
				) : null}
			</div>
		</div>
	)
}

function CenteredLoader() {
	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="flex flex-col items-center gap-3">
				<LoadingSpinner size={28} />
				<p className="text-sm text-pro-text-secondary">Fetching data...</p>
			</div>
		</div>
	)
}

function CenteredError({ error }: { error: unknown }) {
	const msg = error instanceof Error ? error.message : 'Failed to fetch data'
	return (
		<div className="flex flex-1 items-center justify-center px-6">
			<div className="flex max-w-md flex-col items-center gap-2 text-center">
				<Icon name="alert-triangle" className="size-6 text-error" />
				<p className="text-sm text-error">{msg}</p>
			</div>
		</div>
	)
}

function CenteredHint({ icon, text }: { icon: IIcon['name']; text: string }) {
	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="flex flex-col items-center gap-2 text-center">
				<Icon name={icon} className="size-6 text-pro-text-tertiary" />
				<p className="text-sm text-pro-text-secondary">{text}</p>
			</div>
		</div>
	)
}

function PreviewTable({
	parsed,
	isPreview
}: {
	parsed: { headers: Array<string>; rows: Array<ParsedCsvRow> }
	isPreview: boolean
}) {
	const { headers, rows } = parsed
	const display = rows.slice(0, PREVIEW_ROWS)
	const filler = isPreview && display.length > 0 ? [...display, ...display] : []
	return (
		<div className={`relative min-h-0 flex-1 ${isPreview ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}>
			<table className="w-full text-xs">
				<thead className="sticky top-0 z-10 bg-overlay">
					<tr>
						{headers.map((h, columnIndex) => (
							<th
								// oxlint-disable-next-line react/no-array-index-key -- CSV headings may repeat; the fixed schema ordinal identifies each column.
								key={columnIndex}
								className="border-b border-subtle px-3 py-2 text-left font-medium whitespace-nowrap text-pro-text-tertiary"
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{display.map((row, rowIdx) => (
						<tr key={row.id} className={`border-b border-subtle last:border-b-0 ${rowIdx % 2 === 1 ? '' : ''}`}>
							{headers.map((_, i) => (
								<td
									// oxlint-disable-next-line react/no-array-index-key -- CSV cells identify schema positions; column labels can repeat.
									key={i}
									className={`px-3 py-1.5 whitespace-nowrap text-pro-text-primary ${i === 0 ? '' : 'tabular-nums'}`}
								>
									{row.values[i] ?? ''}
								</td>
							))}
						</tr>
					))}
					{filler.map((row, rowIdx) => (
						<tr
							// oxlint-disable-next-line react/no-array-index-key -- Filler intentionally repeats source rows, so source IDs would collide.
							key={`filler-${rowIdx}`}
							className={`border-b border-subtle last:border-b-0 ${(display.length + rowIdx) % 2 === 1 ? '' : ''}`}
						>
							{headers.map((_, i) => (
								<td
									// oxlint-disable-next-line react/no-array-index-key -- CSV cells identify schema positions; column labels can repeat.
									key={i}
									className={`px-3 py-1.5 whitespace-nowrap text-pro-text-primary ${i === 0 ? '' : 'tabular-nums'}`}
								>
									{row.values[i] ?? ''}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{!isPreview && rows.length > PREVIEW_ROWS ? (
				<div className="border-t border-subtle bg-overlay px-3 py-2 text-[11px] text-pro-text-tertiary">
					<p>
						Showing first {formatNumber(PREVIEW_ROWS)} of {formatNumber(rows.length)} rows · download for full data
					</p>
				</div>
			) : null}
			{isPreview ? <PreviewPaywall /> : null}
		</div>
	)
}
