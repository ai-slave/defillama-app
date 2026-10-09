import * as Ariakit from '@ariakit/react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { type CSSProperties, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { setSignupSource } from '~/auth/signupSource'
import { VirtualizedMultiSelect, VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { SortIcon } from '~/components/Table/SortIcon'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { useRecentDownloads, useSavedDownloads } from '~/contexts/LocalStorage'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { SearchField } from '~/ui/SearchField'
import { InlineStatus } from '~/ui/Status'
import { slug as toSlug } from '~/utils'
import { formatIsoDate } from '~/utils/dateFormat'
import { downloadTabular, type DownloadFormat } from '~/utils/download'
import { formatNumber } from '~/utils/numberFormat'
import { ActionFeedbackStatus, useActionFeedback } from './ActionFeedback'
import type { ChartDatasetDefinition } from './chart-datasets'
import { combineCsvsWide } from './combineCsvsWide'
import { filterParsedRowsByDateRange } from './csvDateFilter'
import { parseCsv, type ParsedCsvRow } from './csvParse'
import { DateRangePicker } from './DateRangePicker'
import { fetchDownloadCsv } from './fetchDownloadCsv'
import { SavePresetDialog } from './PresetDialogs'
import {
	type ColumnKind,
	type ColumnMeta,
	downloadPreviewHasTime,
	parseDownloadPreviewDate,
	parseNumericValue,
	formatCellValue,
	getCellTone
} from './previewFormatting'
import { PreviewHeaderActions } from './PreviewHeaderActions'
import { PlaceholderRows, PREVIEW_ROW_HEIGHT, PreviewPaywall } from './PreviewPaywall'
import { createPreviewSearchIndex, filterPreviewRows } from './previewSearch'
import {
	applyChartColumnsAndSort,
	applyChartParams,
	type ChartSavedConfig,
	type DateRangeConfig,
	defaultPresetName,
	extractChartConfig,
	generatePresetId,
	missingColumnNotices,
	missingSavedItemsNotice,
	type SavedDownloadInput
} from './savedDownloads'
import { SavedPresetNotice } from './SavedPresetNotice'
import { type CsvQueryStatus, SelectedListSidebar } from './SelectedListSidebar'
import { sumCsvColumnsToTotal } from './sumCsvColumns'
import { buildShareUrl } from './urlState'
import { usePreviewTableScroller } from './usePreviewTableScroller'

const COLUMN_DETECTION_SAMPLE_SIZE = 200
const COLUMN_WIDTH_SAMPLE_SIZE = 40
const EMPTY_SELECTION = new Set<number>()
const MAX_PARAMS = 25
const DATE_HEADER_PATTERN = /(date|time|timestamp|day)/i
const PERCENT_HEADER_PATTERN = /(apy|pct|percent|change|rate|fee)/i
const CURRENCY_HEADER_PATTERN =
	/(usd|tvl|mcap|market.?cap|price|amount|volume|fees?|revenue|supply|borrow|depositusd|withdrawusd|value|flow)/i

type SortDirection = 'asc' | 'desc'

interface SortState {
	index: number
	direction: SortDirection
}

interface ParamOption {
	label: string
	value: string
	category?: string
	isChild?: boolean
}

function detectColumnKind(header: string, values: Array<string>): ColumnKind {
	const sample = values.filter((v) => v.trim()).slice(0, COLUMN_DETECTION_SAMPLE_SIZE)
	if (sample.length === 0) return 'text'
	const numericMatches = sample.filter((v) => parseNumericValue(v) !== null).length
	const dateMatches = sample.filter((value) => parseDownloadPreviewDate(value, header) !== null).length
	const numericRatio = numericMatches / sample.length
	const dateRatio = dateMatches / sample.length
	if ((DATE_HEADER_PATTERN.test(header) && dateRatio >= 0.5) || dateRatio >= 0.9) return 'date'
	if (numericRatio >= 0.85) {
		if (PERCENT_HEADER_PATTERN.test(header)) return 'percent'
		if (CURRENCY_HEADER_PATTERN.test(header)) return 'currency'
		return 'number'
	}
	return 'text'
}

function getColumnWidth(header: string, kind: ColumnKind, values: Array<string>, isFirst: boolean): number {
	let sampleMaxLength = header.length
	for (const v of values.slice(0, COLUMN_WIDTH_SAMPLE_SIZE)) sampleMaxLength = Math.max(sampleMaxLength, v.length)
	if (kind === 'date') return downloadPreviewHasTime(header, values) ? (isFirst ? 240 : 220) : isFirst ? 200 : 160
	if (kind === 'currency' || kind === 'number' || kind === 'percent') return isFirst ? 200 : 140
	const estimated = Math.max(140, Math.min(300, sampleMaxLength * 8 + 24))
	return isFirst ? Math.max(200, estimated) : estimated
}

function getInitialSortDirection(kind: ColumnKind): SortDirection {
	return kind === 'text' ? 'asc' : 'desc'
}

function buildSelectedCsvRows(
	columns: Array<ColumnMeta>,
	selected: Set<number>,
	rows: Array<ParsedCsvRow>
): Array<Array<string>> {
	const active = columns.filter((c) => selected.has(c.index))
	if (active.length === 0) return []
	return [active.map((c) => c.header), ...rows.map((row) => active.map((c) => row.values[c.index] ?? ''))]
}

function buildTsvString(columns: Array<ColumnMeta>, selected: Set<number>, rows: Array<ParsedCsvRow>): string {
	const active = columns.filter((c) => selected.has(c.index))
	if (active.length === 0) return ''
	const header = active.map((c) => c.header).join('\t')
	const body = rows.map((row) => active.map((c) => row.values[c.index] ?? '').join('\t')).join('\n')
	return `${header}\n${body}`
}

interface Props {
	dataset: ChartDatasetDefinition
	options: Array<ParamOption>
	authorizedFetch: (url: string, options?: any) => Promise<Response | null>
	onClose: () => void
	isTrial?: boolean
	isPreview?: boolean
	initialConfig?: ChartSavedConfig
}

export function ChartDatasetModal({
	dataset,
	options,
	authorizedFetch,
	onClose,
	isTrial,
	isPreview,
	initialConfig
}: Props) {
	const queryClient = useQueryClient()
	const subscribeModalStore = Ariakit.useDialogStore()
	const { savedDownloads, saveDownload } = useSavedDownloads()
	const { recordRecent } = useRecentDownloads()
	const [selectedParams, setSelectedParams] = useState<Array<ParamOption>>([])
	const [preferredPreviewValue, setActivePreviewValue] = useState<string | null>(null)
	const [selectedColumns, setSelectedColumns] = useState<Set<number> | null>(null)
	const [search, setSearch] = useState('')
	const [sortState, setSortState] = useState<SortState | null>(null)
	const dateRangeTriggerRef = useRef<HTMLButtonElement>(null)
	const [dateRange, setDateRange] = useState<DateRangeConfig | null>(initialConfig?.dateRange ?? null)
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	// Phones show the table or the selected list, one at a time; from sm both sit side by side.
	const [showSelected, setShowSelected] = useState(false)
	const selectedToggleRef = useRef<HTMLButtonElement>(null)
	const { outcome, report, confirmed } = useActionFeedback()
	// Where focus goes when the control that had it leaves with the last selected item.
	const paramPickerRef = useRef<HTMLButtonElement>(null)
	const categoryPickerRef = useRef<HTMLButtonElement>(null)
	const pickerTrigger = () => paramPickerRef.current ?? categoryPickerRef.current
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
	const [sumMode, setSumMode] = useState(false)
	const [appliedInitialParams, setAppliedInitialParams] = useState<ReturnType<typeof applyChartParams> | null>(null)
	const [appliedInitialColumns, setAppliedInitialColumns] = useState<ReturnType<
		typeof applyChartColumnsAndSort
	> | null>(null)
	const [categoryDraft, setCategoryDraft] = useState({ category: selectedCategory, options, aligned: false })
	const { scrollerRef, setScroller, canScrollLeft, canScrollRight } = usePreviewTableScroller()
	const deferredSearch = useDeferredValue(search.trim().toLowerCase())

	const supportsBreakdown = dataset.paramType === 'protocol' && !!dataset.categoryBreakdown
	const isCategoryMode = supportsBreakdown && selectedCategory !== null
	const activePreviewValue = isCategoryMode
		? null
		: (selectedParams.find((param) => param.value === preferredPreviewValue)?.value ?? selectedParams[0]?.value ?? null)

	// Seed the editable selection once asynchronous options can resolve the saved values.
	if (initialConfig && appliedInitialParams === null && options.length > 0) {
		const applied = applyChartParams(initialConfig, options)
		setAppliedInitialParams(applied)
		if (initialConfig.categoryBreakdown && supportsBreakdown) {
			setSelectedCategory(initialConfig.categoryBreakdown.category)
		} else {
			setSelectedParams(applied.params)
		}
	}

	const protocolCategories = useMemo(() => {
		if (!supportsBreakdown) return []
		const cats = new Map<string, number>()
		for (const opt of options) {
			if (opt.category) cats.set(opt.category, (cats.get(opt.category) ?? 0) + 1)
		}
		return Array.from(cats.entries()).toSorted((a, b) => b[1] - a[1])
	}, [options, supportsBreakdown])

	const filteredOptions = useMemo(() => {
		if (!selectedCategory) return options
		return options.filter((o) => o.category === selectedCategory)
	}, [options, selectedCategory])

	const selectedParam = useMemo(
		() => selectedParams.find((p) => p.value === activePreviewValue) ?? null,
		[selectedParams, activePreviewValue]
	)

	if (
		supportsBreakdown &&
		(categoryDraft.category !== selectedCategory || (selectedCategory !== null && categoryDraft.options !== options))
	) {
		setCategoryDraft({ category: selectedCategory, options, aligned: false })
		setSelectedParams(selectedCategory === null ? [] : filteredOptions)
		setActivePreviewValue(null)
		setSelectedColumns(null)
		setSortState(null)
		if (selectedCategory === null) setSearch('')
	}

	const perProtocolQueries = useQueries({
		queries:
			isCategoryMode || selectedParams.length > MAX_PARAMS
				? []
				: selectedParams.map((param) => ({
						queryKey: ['chart-preview', dataset.slug, param.value, isPreview] as const,
						queryFn: async () => {
							const text = await fetchDownloadCsv(
								`/api/private/downloads/chart/${dataset.slug}?param=${encodeURIComponent(param.value)}`,
								{ isPreview: !!isPreview, authorizedFetch }
							)
							if (isTrial) {
								void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
							}
							return text
						},
						staleTime: 5 * 60 * 1000,
						refetchOnWindowFocus: false,
						retry: 1
					}))
	})

	const breakdownQuery = useQuery({
		queryKey: ['chart-breakdown', dataset.slug, selectedCategory, isPreview] as const,
		queryFn: async () => {
			const cat = selectedCategory
			if (!cat) throw new Error('No category selected')
			const text = await fetchDownloadCsv(
				`/api/private/downloads/chart-breakdown/${dataset.slug}?category=${encodeURIComponent(cat)}`,
				{ isPreview: !!isPreview, authorizedFetch }
			)
			if (isTrial) {
				void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
			}
			return text
		},
		enabled: isCategoryMode,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1
	})

	const activeQueryIndex = useMemo(
		() => (isCategoryMode ? -1 : selectedParams.findIndex((p) => p.value === activePreviewValue)),
		[isCategoryMode, selectedParams, activePreviewValue]
	)

	const activeQuery = activeQueryIndex >= 0 ? perProtocolQueries[activeQueryIndex] : null

	const rawCsvText = isCategoryMode
		? ((breakdownQuery.data as string | undefined) ?? undefined)
		: ((activeQuery?.data as string | undefined) ?? undefined)
	const dataLoading = isCategoryMode ? breakdownQuery.isLoading : (activeQuery?.isLoading ?? false)
	const dataError = isCategoryMode ? breakdownQuery.error : (activeQuery?.error ?? null)

	const sumModeActive = sumMode && !!dataset.sumMode && !isCategoryMode
	const sumColumnLabel = dataset.sumMode?.columnLabel ?? 'total'

	const csvText = useMemo(() => {
		if (!sumModeActive || !rawCsvText) return rawCsvText
		return sumCsvColumnsToTotal(rawCsvText, sumColumnLabel)
	}, [sumModeActive, rawCsvText, sumColumnLabel])

	const categorySyntheticQueries = useMemo<ReadonlyArray<CsvQueryStatus>>(() => {
		if (!isCategoryMode) return []
		const ready = !!breakdownQuery.data
		const loading = breakdownQuery.isLoading
		const err = breakdownQuery.error
		return selectedParams.map((p) => ({
			data: ready ? p.value : undefined,
			isLoading: loading,
			error: err
		}))
	}, [isCategoryMode, selectedParams, breakdownQuery.data, breakdownQuery.isLoading, breakdownQuery.error])

	const rawCsvQueries = isCategoryMode ? categorySyntheticQueries : perProtocolQueries

	const csvQueries = useMemo<ReadonlyArray<CsvQueryStatus>>(() => {
		if (!sumModeActive) return rawCsvQueries
		return rawCsvQueries.map((q) => {
			if (typeof q.data !== 'string') return q
			return { ...q, data: sumCsvColumnsToTotal(q.data, sumColumnLabel) }
		})
	}, [sumModeActive, rawCsvQueries, sumColumnLabel])

	const { headers, rows } = useMemo(() => {
		if (!csvText) return { headers: [] as Array<string>, rows: [] as Array<ParsedCsvRow> }
		return parseCsv(csvText)
	}, [csvText])

	// Category CSV headers are authoritative, including protocols missing from the catalog.
	if (
		isCategoryMode &&
		csvText &&
		headers.length > 0 &&
		!categoryDraft.aligned &&
		categoryDraft.category === selectedCategory
	) {
		const optionBySlug = new Map<string, ParamOption>()
		for (const opt of options) optionBySlug.set(opt.value, opt)
		const chipsFromCsv: Array<ParamOption> = []
		for (const header of headers) {
			if (header === 'date') continue
			const value = toSlug(header)
			chipsFromCsv.push(optionBySlug.get(value) ?? { label: header, value, category: selectedCategory ?? undefined })
		}
		setSelectedParams(chipsFromCsv)
		setCategoryDraft({ ...categoryDraft, aligned: true })
	}

	if (headers.length > 0 && selectedColumns === null) {
		const dateIndex = headers.indexOf('date')
		const defaultSort: SortState | null = dateIndex === -1 ? null : { index: dateIndex, direction: 'desc' }
		if (initialConfig && appliedInitialColumns === null) {
			const applied = applyChartColumnsAndSort(initialConfig, headers)
			setSelectedColumns(applied.selectedColumns ?? new Set(headers.map((_, index) => index)))
			setSortState(applied.sort ?? sortState ?? defaultSort)
			setAppliedInitialColumns(applied)
		} else {
			setSelectedColumns(new Set(headers.map((_, index) => index)))
			if (sortState === null) setSortState(defaultSort)
		}
	}

	// A preset opened in category mode takes its protocols from the category CSV, so none of its saved ones went missing.
	const missingParamCount =
		initialConfig?.categoryBreakdown && supportsBreakdown ? 0 : (appliedInitialParams?.missingParams.length ?? 0)
	const savedPresetNotices =
		missingParamCount > 0
			? [
					missingSavedItemsNotice(missingParamCount, dataset.paramLabel.toLowerCase()),
					...missingColumnNotices(appliedInitialColumns)
				]
			: missingColumnNotices(appliedInitialColumns)

	const cols = selectedColumns ?? EMPTY_SELECTION

	const columnMeta = useMemo(() => {
		return headers.map<ColumnMeta>((header, index) => {
			const values = rows.map((row) => row.values[index] ?? '')
			let kind = detectColumnKind(header, values)
			if (isCategoryMode && header !== 'date') {
				kind = 'currency'
			}
			return {
				index,
				header,
				kind,
				align: kind === 'text' || kind === 'date' ? 'start' : 'end',
				width: getColumnWidth(header, kind, values, index === 0)
			}
		})
	}, [headers, rows, isCategoryMode])

	const selectedCount = useMemo(() => columnMeta.filter((c) => cols.has(c.index)).length, [columnMeta, cols])

	const dateColIndex = useMemo(() => headers.indexOf('date'), [headers])

	const dateBounds = useMemo(() => {
		if (dateColIndex < 0 || rows.length === 0) return { min: undefined, max: undefined } as const
		let min: string | undefined
		let max: string | undefined
		for (const row of rows) {
			const d = formatIsoDate(row.values[dateColIndex] ?? '')
			if (!d) continue
			if (min === undefined || d < min) min = d
			if (max === undefined || d > max) max = d
		}
		return { min, max } as const
	}, [rows, dateColIndex])

	const dateFilteredRows = useMemo(
		() => filterParsedRowsByDateRange(rows, dateColIndex, dateRange),
		[rows, dateColIndex, dateRange]
	)
	const searchIndex = useMemo(() => createPreviewSearchIndex(rows, columnMeta.length), [rows, columnMeta.length])

	const filteredRows = useMemo(() => {
		return filterPreviewRows(dateFilteredRows, searchIndex, deferredSearch)
	}, [dateFilteredRows, searchIndex, deferredSearch])

	const sortedRows = useMemo(() => {
		if (!sortState) return filteredRows
		const activeColumn = columnMeta.find((c) => c.index === sortState.index)
		if (!activeColumn) return filteredRows
		const dir = sortState.direction === 'asc' ? 1 : -1

		return filteredRows.toSorted((a, b) => {
			const av = a.values[activeColumn.index] ?? ''
			const bv = b.values[activeColumn.index] ?? ''
			const aBlank = !av.trim()
			const bBlank = !bv.trim()
			if (aBlank && bBlank) return a.id - b.id
			if (aBlank) return 1
			if (bBlank) return -1

			if (activeColumn.kind === 'date') {
				const ad = parseDownloadPreviewDate(av, activeColumn.header)?.timestamp ?? null
				const bd = parseDownloadPreviewDate(bv, activeColumn.header)?.timestamp ?? null
				if (ad === null && bd === null) return a.id - b.id
				if (ad === null) return 1
				if (bd === null) return -1
				const cmp = ad - bd
				return cmp === 0 ? a.id - b.id : cmp * dir
			}

			if (activeColumn.kind === 'number' || activeColumn.kind === 'currency' || activeColumn.kind === 'percent') {
				const an = parseNumericValue(av)
				const bn = parseNumericValue(bv)
				if (an === null && bn === null) return a.id - b.id
				if (an === null) return 1
				if (bn === null) return -1
				const cmp = an - bn
				return cmp === 0 ? a.id - b.id : cmp * dir
			}

			const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
			return cmp === 0 ? a.id - b.id : cmp * dir
		})
	}, [columnMeta, filteredRows, sortState])

	const tableWidth = useMemo(() => columnMeta.reduce((t, c) => t + c.width, 0), [columnMeta])
	const gridTemplate = useMemo(() => columnMeta.map((c) => `minmax(${c.width}px, 1fr)`).join(' '), [columnMeta])

	const hasPreviewTarget = isCategoryMode ? true : !!selectedParam
	const hasData = !dataLoading && !dataError && headers.length > 0 && hasPreviewTarget
	const hasSelection = isCategoryMode || selectedParams.length > 0
	const isBulk = !isCategoryMode && selectedParams.length > 1
	// The list exists only for two or more picks (the trigger names a single one), so dropping to one brings the
	// table back, and a later second pick opens on the table too.
	if (showSelected && !isBulk) setShowSelected(false)

	const readyCount = useMemo(() => csvQueries.filter((q) => !!q.data).length, [csvQueries])
	const loadingCount = useMemo(() => csvQueries.filter((q) => q.isLoading).length, [csvQueries])

	const rowVirtualizer = useVirtualItems({
		count: sortedRows.length,
		getScrollElement: () => scrollerRef.current,
		estimateSize: () => PREVIEW_ROW_HEIGHT,
		overscan: 10
	})

	const toggleColumn = useCallback((index: number) => {
		setSelectedColumns((prev) => {
			const next = new Set(prev ?? [])
			if (next.has(index)) next.delete(index)
			else next.add(index)
			return next
		})
	}, [])

	const columnOptions = useMemo(
		() => columnMeta.map((column) => ({ value: String(column.index), label: column.header })),
		[columnMeta]
	)
	const selectedColumnValues = useMemo(() => [...cols].map(String), [cols])
	const handleColumnsChange = (values: Array<string>) => {
		if (values.length === 0) setSortState(null)
		setSelectedColumns(new Set(values.map(Number)))
	}

	const handleSort = useCallback((column: ColumnMeta) => {
		setSortState((prev) => {
			if (!prev || prev.index !== column.index) {
				return { index: column.index, direction: getInitialSortDirection(column.kind) }
			}
			return { index: column.index, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
		})
	}, [])

	const handleSetActive = useCallback(
		(value: string | null) => {
			if (value === activePreviewValue) return
			setActivePreviewValue(value)
			setSelectedColumns(null)
			setSortState(null)
			setSearch('')
		},
		[activePreviewValue]
	)

	// Only the picker and the selected list edit the picks by hand, and neither shows in category mode.
	const handleRemoveParam = useCallback(
		(value: string) => {
			setSelectedParams((prev) => prev.filter((p) => p.value !== value))
			if (activePreviewValue === value) handleSetActive(null)
		},
		[activePreviewValue, handleSetActive]
	)

	const handleClearParams = useCallback(() => {
		setSelectedParams([])
		setActivePreviewValue(null)
		setSelectedColumns(null)
		setSortState(null)
		setSearch('')
	}, [])

	const handleAddMultipleParams = useCallback((opts: Array<ParamOption>) => {
		setSelectedParams((prev) => {
			const existing = new Set(prev.map((p) => p.value))
			const toAdd = opts.filter((o) => !existing.has(o.value))
			const combined = [...prev, ...toAdd]
			// The picker offers Add all only while everything in view fits under the cap.
			if (combined.length > MAX_PARAMS) return [...prev, ...toAdd.slice(0, MAX_PARAMS - prev.length)]
			return combined
		})
	}, [])

	const selectedParamValues = useMemo(() => selectedParams.map((param) => param.value), [selectedParams])
	// One handler for the picker's whole selection: picks it drops are removed one by one, so a removed
	// preview hands off as a row removal does, and its additions arrive together, as Select all sends them.
	const handleParamValuesChange = (values: Array<string>) => {
		if (values.length === 0) return handleClearParams()
		const next = new Set(values)
		for (const param of selectedParams) {
			if (!next.has(param.value)) handleRemoveParam(param.value)
		}
		const current = new Set(selectedParamValues)
		const added = filteredOptions.filter((option) => next.has(option.value) && !current.has(option.value))
		if (added.length > 0) handleAddMultipleParams(added)
	}

	const categoryOptions = useMemo(
		() => [
			{ value: '', label: 'All' },
			...protocolCategories.map(([category, count]) => ({
				value: category,
				label: category,
				description: `${count} ${dataset.paramLabel.toLowerCase()}${count === 1 ? '' : 's'}`
			}))
		],
		[protocolCategories, dataset.paramLabel]
	)

	const handleSelectCategory = useCallback(
		(cat: string | null) => {
			if (cat === null && isCategoryMode) {
				setSelectedParams([])
				setSelectedColumns(null)
				setSortState(null)
			}
			setSelectedCategory(cat)
		},
		[isCategoryMode]
	)

	const handleDownloadCombined = useCallback(
		(format: DownloadFormat, action: string) => {
			if (isCategoryMode) {
				if (selectedCount === 0) {
					report(action, false, 'Select at least one column')
					return
				}
				const csvRows = buildSelectedCsvRows(columnMeta, cols, sortedRows)
				if (csvRows.length <= 1) {
					report(action, false, 'No rows to download')
					return
				}
				const filename = `${dataset.slug}_${toSlug(selectedCategory!)}.${format}`
				downloadTabular(format, filename, csvRows, { addTimestamp: false })
				report(action, true, `Downloaded ${filename}`)

				const configBase = extractChartConfig({
					slug: dataset.slug,
					headers,
					selectedParams,
					selectedColumns: cols,
					sort: sortState,
					dateRange,
					categoryBreakdown: { category: selectedCategory! }
				})
				recordRecent({
					...configBase,
					id: generatePresetId(),
					name: defaultPresetName(configBase, dataset.name),
					createdAt: Date.now()
				})
				return
			}

			const ready: Array<{ label: string; value: string; csvText: string }> = []
			const failed: Array<ParamOption> = []
			for (const [i, query] of csvQueries.entries()) {
				const p = selectedParams[i]
				if (!p) continue
				const data = query.data as unknown
				if (typeof data === 'string') {
					ready.push({ label: p.label, value: p.value, csvText: data })
					continue
				}
				const err = (query as { error?: unknown }).error
				if (err) failed.push(p)
			}
			if (ready.length === 0) {
				report(action, false, 'No data available to download')
				return
			}
			const merged = combineCsvsWide(ready, dateRange)
			if (merged.length <= 1) {
				report(action, false, 'No rows to download')
				return
			}
			const filename = `${dataset.slug}_combined.${format}`
			downloadTabular(format, filename, merged, { addTimestamp: true })
			if (failed.length > 0) {
				report(
					action,
					true,
					`Downloaded ${filename} — skipped ${failed.length} failed (${failed.map((f) => f.label).join(', ')})`
				)
			} else {
				report(action, true, `Downloaded ${filename}`)
			}

			const configBase = extractChartConfig({
				slug: dataset.slug,
				headers,
				selectedParams,
				selectedColumns: cols,
				sort: sortState,
				dateRange
			})
			recordRecent({
				...configBase,
				id: generatePresetId(),
				name: defaultPresetName(configBase, dataset.name),
				createdAt: Date.now()
			})
		},
		[
			isCategoryMode,
			selectedCategory,
			selectedCount,
			columnMeta,
			sortedRows,
			csvQueries,
			selectedParams,
			dataset.slug,
			dataset.name,
			headers,
			cols,
			sortState,
			dateRange,
			recordRecent,
			report
		]
	)

	// Only the selected list downloads one pick, and it shows outside category mode.
	const handleDownloadSingle = useCallback(
		(param: ParamOption, format: DownloadFormat, action: string) => {
			const idx = selectedParams.findIndex((p) => p.value === param.value)
			if (idx < 0) return
			const query = csvQueries[idx]
			if (!query || typeof query.data !== 'string') {
				report(action, false, 'Data not loaded yet')
				return
			}
			const filename = `${dataset.slug}_${param.value}.${format}`

			let downloadedHeaders: Array<string> | null = null
			let downloadedCols: Set<number> | null = null
			let downloadedSort: SortState | null = null

			if (param.value === activePreviewValue && selectedCount > 0 && deferredSearch.length === 0) {
				const csvRows = buildSelectedCsvRows(columnMeta, cols, sortedRows)
				if (csvRows.length > 1) {
					downloadTabular(format, filename, csvRows, { addTimestamp: false })
					report(action, true, `Downloaded ${filename}`)
					downloadedHeaders = headers
					downloadedCols = cols
					downloadedSort = sortState
				}
			}
			if (downloadedHeaders === null) {
				const parsed = parseCsv(query.data)
				const parsedDateIdx = parsed.headers.indexOf('date')
				const rowsForDownload = filterParsedRowsByDateRange(parsed.rows, parsedDateIdx, dateRange)
				if (rowsForDownload.length === 0) {
					report(action, false, 'No rows to download')
					return
				}
				const allRows: Array<Array<string>> = [
					parsed.headers,
					...rowsForDownload.map((r) => parsed.headers.map((_, i) => r.values[i] ?? ''))
				]
				downloadTabular(format, filename, allRows, { addTimestamp: false })
				report(action, true, `Downloaded ${filename}`)
				downloadedHeaders = parsed.headers
			}

			const configBase = extractChartConfig({
				slug: dataset.slug,
				headers: downloadedHeaders,
				selectedParams: [param],
				selectedColumns: downloadedCols,
				sort: downloadedSort,
				dateRange
			})
			recordRecent({
				...configBase,
				id: generatePresetId(),
				name: defaultPresetName(configBase, dataset.name),
				createdAt: Date.now()
			})
		},
		[
			csvQueries,
			selectedParams,
			activePreviewValue,
			selectedCount,
			deferredSearch,
			columnMeta,
			cols,
			sortedRows,
			headers,
			sortState,
			dateRange,
			dataset.slug,
			dataset.name,
			recordRecent,
			report
		]
	)

	const handleDownload = useCallback(
		(format: DownloadFormat = 'csv') => {
			if (isCategoryMode) {
				handleDownloadCombined(format, 'download')
				return
			}
			if (selectedParams.length === 0) return
			if (selectedParams.length === 1) {
				if (!selectedParam) return
				if (selectedCount === 0) {
					report('download', false, 'Select at least one column')
					return
				}
				const csvRows = buildSelectedCsvRows(columnMeta, cols, sortedRows)
				if (csvRows.length <= 1) {
					report('download', false, 'No rows to download')
					return
				}
				const filename = `${dataset.slug}_${selectedParam.value}.${format}`
				downloadTabular(format, filename, csvRows, { addTimestamp: false })
				report('download', true, `Downloaded ${filename}`)

				const configBase = extractChartConfig({
					slug: dataset.slug,
					headers,
					selectedParams,
					selectedColumns: cols,
					sort: sortState,
					dateRange
				})
				recordRecent({
					...configBase,
					id: generatePresetId(),
					name: defaultPresetName(configBase, dataset.name),
					createdAt: Date.now()
				})
				return
			}
			handleDownloadCombined(format, 'download')
		},
		[
			isCategoryMode,
			selectedParams,
			selectedParam,
			selectedCount,
			columnMeta,
			cols,
			sortedRows,
			dataset.slug,
			dataset.name,
			headers,
			sortState,
			dateRange,
			recordRecent,
			handleDownloadCombined,
			report
		]
	)

	const handleSavePreset = useCallback(
		(name: string) => {
			const configBase = extractChartConfig({
				slug: dataset.slug,
				headers,
				selectedParams,
				selectedColumns: cols,
				sort: sortState,
				dateRange,
				categoryBreakdown: isCategoryMode && selectedCategory ? { category: selectedCategory } : null
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
		[
			dataset.slug,
			headers,
			selectedParams,
			cols,
			sortState,
			dateRange,
			isCategoryMode,
			selectedCategory,
			saveDownload,
			report
		]
	)

	const currentConfig = useMemo<SavedDownloadInput | null>(() => {
		if (!isCategoryMode && selectedParams.length === 0) return null
		return extractChartConfig({
			slug: dataset.slug,
			headers,
			selectedParams,
			selectedColumns: cols,
			sort: sortState,
			dateRange,
			categoryBreakdown: isCategoryMode && selectedCategory ? { category: selectedCategory } : null
		})
	}, [dataset.slug, headers, selectedParams, cols, sortState, dateRange, isCategoryMode, selectedCategory])

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
		return defaultPresetName(currentConfig, dataset.name)
	}, [currentConfig, dataset.name])

	const existingPresetNames = useMemo(() => savedDownloads.map((s) => s.name), [savedDownloads])

	const handleCopy = useCallback(async () => {
		if (selectedCount === 0) {
			report('copy', false, 'Select at least one column')
			return
		}
		const tsv = buildTsvString(columnMeta, cols, sortedRows)
		if (!tsv) {
			report('copy', false, 'No data to copy')
			return
		}
		try {
			await navigator.clipboard.writeText(tsv)
			report('copy', true, 'Copied to clipboard (paste into spreadsheets)')
		} catch {
			report('copy', false, 'Failed to copy')
		}
	}, [columnMeta, cols, sortedRows, selectedCount, report])

	const activeSortDirection = sortState ? sortState.direction : false

	const hasActiveFilter = !!dateRange || deferredSearch.length > 0
	const rowsCountLabel = hasActiveFilter
		? `${formatNumber(sortedRows.length)} of ${formatNumber(rows.length)} rows`
		: `${formatNumber(sortedRows.length)} rows`

	const headerSubtitle = (() => {
		if (isCategoryMode) {
			if (dataLoading) return `Loading ${selectedCategory} breakdown…`
			if (dataError) return 'Error'
			if (headers.length > 0) {
				const protocolCols = Math.max(0, headers.length - 1)
				const selectedProtocolCols = Math.max(0, selectedCount - (headers.includes('date') ? 1 : 0))
				return `${rowsCountLabel} · ${selectedProtocolCols}/${protocolCols} protocols · ${selectedCategory}`
			}
			return `${selectedParams.length} protocols in ${selectedCategory}`
		}
		if (!hasSelection) {
			return `Select ${dataset.paramLabel.toLowerCase()}(s) to preview`
		}
		if (isBulk) {
			if (loadingCount > 0) return `Loading ${readyCount}/${selectedParams.length}...`
			if (selectedParam && headers.length > 0) {
				return `${rowsCountLabel} · previewing ${selectedParam.label}`
			}
			return `${selectedParams.length} selected`
		}
		if (dataLoading) return 'Loading…'
		if (dataError) return 'Error'
		if (headers.length > 0) {
			return `${rowsCountLabel} · ${selectedCount}/${headers.length} cols selected`
		}
		return ''
	})()

	const downloadLabel = isCategoryMode ? 'Download' : isBulk ? 'Download combined' : 'Download'
	const topBarDownloadDisabled = (() => {
		if (isPreview) return false
		if (!hasSelection) return true
		if (isCategoryMode) {
			return dataLoading || !csvText || selectedCount === 0
		}
		if (isBulk) {
			return loadingCount === selectedParams.length || readyCount === 0
		}
		return selectedCount === 0
	})()

	const showTopBarActions = hasSelection && (isBulk || hasData)

	const handleSubscribeClick = () => {
		setSignupSource('downloads')
		subscribeModalStore.show()
	}

	return (
		<>
			{/* Opens on the first picker, the field the preview waits on. */}
			<Dialog
				size="xl"
				workspace
				open
				onClose={onClose}
				initialFocus={protocolCategories.length > 0 ? categoryPickerRef : paramPickerRef}
			>
				<DialogHeader
					title={dataset.name}
					subtitle={headerSubtitle}
					actions={
						showTopBarActions ? (
							isPreview ? (
								<PreviewHeaderActions
									mode="preview"
									downloadLabel={downloadLabel}
									copy={!isBulk && hasData}
									onSubscribe={handleSubscribeClick}
								/>
							) : (
								<PreviewHeaderActions
									mode="full"
									confirmed={confirmed}
									downloadLabel={downloadLabel}
									copy={!isBulk && hasData ? { run: () => void handleCopy(), disabled: selectedCount === 0 } : null}
									savePreset={{ run: () => setShowSaveDialog(true), disabled: !hasSelection }}
									copyLink={{ run: () => void handleCopyLink(), disabled: !currentConfig }}
									onDownload={handleDownload}
									downloadDisabled={topBarDownloadDisabled}
								/>
							)
						) : null
					}
				/>

				<DialogToolbar>
					<div className="flex flex-wrap items-center gap-2">
						{protocolCategories.length > 0 ? (
							<VirtualizedSelect
								variant="chip"
								label="Category"
								triggerRef={categoryPickerRef}
								options={categoryOptions}
								selectedValue={selectedCategory ?? ''}
								onChange={(option) => handleSelectCategory(option.value || null)}
								placeholder="All"
							/>
						) : null}
						{!isCategoryMode ? (
							<VirtualizedMultiSelect
								variant="chip"
								label={dataset.paramLabel}
								triggerRef={paramPickerRef}
								options={filteredOptions}
								selectedValues={selectedParamValues}
								onChange={handleParamValuesChange}
								placeholder="None"
								maxSelections={MAX_PARAMS}
							/>
						) : (
							<span className="flex items-center gap-1.5 rounded-md border border-subtle bg-hover-row px-2.5 py-1.5 label-sm text-secondary">
								<Icon name="layers" className="size-3.5" />
								{selectedParams.length} protocols
							</span>
						)}

						{dataset.sumMode && !isCategoryMode ? (
							<Button
								type="button"
								variant="toggle"
								size="md"
								data-active={sumModeActive}
								aria-pressed={sumModeActive}
								onClick={() => {
									setSumMode((s) => !s)
									setSelectedColumns(null)
									setSortState(null)
								}}
							>
								<Icon name="plus" className="size-3.5" />
								<span>Sum all</span>
							</Button>
						) : null}

						{hasSelection && !isPreview ? (
							<DateRangePicker
								triggerRef={dateRangeTriggerRef}
								value={dateRange}
								onChange={setDateRange}
								minDate={dateBounds.min}
								maxDate={dateBounds.max}
							/>
						) : null}

						{hasData && !isPreview ? (
							<>
								<SearchField
									label="Filter rows"
									value={search}
									onChange={setSearch}
									placeholder="Filter rows…"
									className="min-w-32 flex-1 sm:max-w-56 sm:min-w-48"
								/>

								<VirtualizedMultiSelect
									variant="chip"
									label="Columns"
									options={columnOptions}
									selectedValues={selectedColumnValues}
									onChange={handleColumnsChange}
									placeholder="None"
								/>
							</>
						) : hasData && isPreview ? (
							<p className="body-sm text-tertiary">Preview — showing first {sortedRows.length} rows</p>
						) : null}
						{isBulk ? (
							<Button
								variant="toggle"
								size="md"
								data-active={showSelected}
								aria-pressed={showSelected}
								className="sm:hidden"
								onClick={() => setShowSelected((shown) => !shown)}
								ref={selectedToggleRef}
							>
								Selected ({selectedParams.length})
							</Button>
						) : null}
					</div>
				</DialogToolbar>
				{/* Each band draws the line under itself, as the toolbar above does. */}
				<SavedPresetNotice notices={savedPresetNotices} />
				<ActionFeedbackStatus outcome={outcome} />

				<DialogBody kind="flush">
					<div className="flex h-full min-h-0">
						<div className={`relative min-w-0 flex-1 flex-col ${showSelected ? 'hidden sm:flex' : 'flex'}`}>
							{!hasPreviewTarget ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center">
										<Icon name="search" className="size-6 text-tertiary" />
										<p className="body-md text-secondary">
											Select a {dataset.paramLabel.toLowerCase()} above to load chart data
										</p>
									</div>
								</div>
							) : dataLoading ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-3">
										<LoadingSpinner size={28} />
										<p className="body-md text-secondary">Fetching chart data…</p>
									</div>
								</div>
							) : dataError ? (
								<div className="flex flex-1 items-center justify-center p-4">
									<InlineStatus
										variant="error"
										action={
											<Button
												size="sm"
												pendingLabel={(isCategoryMode ? breakdownQuery : activeQuery!).isFetching ? 'Retrying…' : null}
												onClick={() => void (isCategoryMode ? breakdownQuery : activeQuery!).refetch()}
											>
												Try again
											</Button>
										}
									>
										{dataError instanceof Error ? dataError.message : 'Failed to fetch data'}
									</InlineStatus>
								</div>
							) : columnMeta.length === 0 ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center">
										<Icon name="eye-off" className="size-6 text-tertiary" />
										<p className="body-md text-secondary">No data</p>
									</div>
								</div>
							) : sortedRows.length === 0 ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center body-md">
										<Icon name="search" className="size-6 text-tertiary" />
										<p className="text-secondary">
											{dateRange && rows.length > 0
												? 'No rows in selected date range'
												: deferredSearch.length > 0
													? 'No rows match your search'
													: 'No matching rows'}
										</p>
										{dateRange && rows.length > 0 ? (
											<Button
												variant="secondary"
												size="sm"
												// Clearing removes this button; focus returns to the range picker it cleared.
												onClick={() =>
													keepFocus(
														() => setDateRange(null),
														() => dateRangeTriggerRef.current
													)
												}
											>
												Clear date range
											</Button>
										) : null}
									</div>
								</div>
							) : (
								<div className="relative min-h-0 flex-1">
									<div
										aria-hidden
										className="pointer-events-none absolute inset-y-0 right-0 z-40 w-32 transition-opacity duration-200"
										style={{
											opacity: canScrollRight ? 1 : 0,
											background: 'linear-gradient(to left, var(--bg-overlay) 0%, transparent 100%)'
										}}
									/>
									<div
										ref={setScroller}
										className={`h-full ${isPreview ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
										style={
											{
												'--sticky-shadow': canScrollLeft ? '4px 0 8px -2px rgba(0,0,0,0.25)' : 'none'
											} as CSSProperties
										}
									>
										<div className="sticky top-0 z-20 bg-overlay" style={{ minWidth: `${tableWidth}px` }}>
											<div style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
												{columnMeta.map((column, position) => {
													const isSelected = cols.has(column.index)
													const isSorted = sortState?.index === column.index ? activeSortDirection : false
													const isSticky = position === 0
													return (
														<div
															key={column.index}
															className="border-t border-r border-subtle bg-overlay last:border-r-0"
															style={{
																position: isSticky ? 'sticky' : undefined,
																left: isSticky ? 0 : undefined,
																zIndex: isSticky ? 30 : undefined,
																background: 'var(--bg-overlay)',
																boxShadow: isSticky ? 'var(--sticky-shadow, none)' : undefined
															}}
														>
															<div className="flex items-center gap-0.5 p-2">
																<input
																	type="checkbox"
																	aria-label={`Include ${column.header} column`}
																	checked={isSelected}
																	onChange={() => toggleColumn(column.index)}
																	className="mr-1 size-3.5 shrink-0 cursor-pointer accent-brand"
																/>
																<button
																	type="button"
																	onClick={() => handleSort(column)}
																	className="flex min-w-0 flex-1 items-center gap-1"
																>
																	<span
																		className={`truncate label-sm ${isSelected ? 'text-secondary' : 'text-tertiary'}`}
																	>
																		{column.header}
																	</span>
																	<SortIcon dir={isSorted} />
																	{isSorted ? (
																		<span className="sr-only">
																			{isSorted === 'asc' ? ', sorted ascending' : ', sorted descending'}
																		</span>
																	) : null}
																</button>
															</div>
														</div>
													)
												})}
											</div>
										</div>

										<div
											style={{
												height: `${rowVirtualizer.totalSize}px`,
												minWidth: `${tableWidth}px`,
												position: 'relative'
											}}
										>
											{rowVirtualizer.items.map((virtualRow) => {
												const row = sortedRows[virtualRow.index]
												return (
													<div
														key={row.id}
														style={{
															display: 'grid',
															gridTemplateColumns: gridTemplate,
															minWidth: `${tableWidth}px`,
															position: 'absolute',
															top: 0,
															left: 0,
															width: '100%',
															height: `${virtualRow.size}px`,
															transform: `translateY(${virtualRow.start}px)`
														}}
													>
														{columnMeta.map((column, position) => {
															const rawValue = row.values[column.index] ?? ''
															const displayValue = formatCellValue(rawValue, column)
															const isSticky = position === 0
															const isSelected = cols.has(column.index)
															const tone = isSelected ? getCellTone(rawValue, column) : ''
															return (
																<div
																	key={column.index}
																	title={rawValue || undefined}
																	className={`truncate border-t border-r border-subtle p-2 body-md last:border-r-0 ${tone} ${!isSelected ? 'text-tertiary opacity-40' : ''}`}
																	style={{
																		textAlign: column.align,
																		position: isSticky ? 'sticky' : undefined,
																		left: isSticky ? 0 : undefined,
																		zIndex: isSticky ? 1 : undefined,
																		background: isSticky ? 'var(--bg-overlay)' : undefined,
																		boxShadow: isSticky ? 'var(--sticky-shadow, none)' : undefined
																	}}
																>
																	{displayValue}
																</div>
															)
														})}
													</div>
												)
											})}
										</div>
										{isPreview ? (
											<PlaceholderRows
												columnMeta={columnMeta}
												gridTemplate={gridTemplate}
												tableWidth={tableWidth}
												rows={sortedRows}
												cols={cols}
											/>
										) : null}
									</div>
									{isPreview ? <PreviewPaywall /> : null}
								</div>
							)}
						</div>

						{isBulk ? (
							<SelectedListSidebar
								noun={dataset.paramLabel.toLowerCase()}
								items={selectedParams}
								queries={csvQueries}
								activeValue={activePreviewValue}
								onPreview={(value) =>
									// On a phone, previewing an item switches to the table; the toggle keeps focus there.
									keepFocus(
										() => {
											handleSetActive(value)
											setShowSelected(false)
										},
										() => selectedToggleRef.current
									)
								}
								showOnPhone={showSelected}
								onRemove={handleRemoveParam}
								onClearAll={handleClearParams}
								onDownload={(param) => handleDownloadSingle(param, 'csv', `download:${param.value}`)}
								confirmed={confirmed}
								pickerTrigger={pickerTrigger}
								isPreview={!!isPreview}
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
