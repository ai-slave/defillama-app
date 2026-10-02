import * as Ariakit from '@ariakit/react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
	type CSSProperties,
	lazy,
	type RefObject,
	Suspense,
	useCallback,
	useDeferredValue,
	useMemo,
	useRef,
	useState
} from 'react'
import { setSignupSource } from '~/auth/signupSource'
import { SortIcon } from '~/components/Table/SortIcon'
import { useRecentDownloads, useSavedDownloads } from '~/contexts/LocalStorage'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { catchLostFocus, keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { slug as toSlug } from '~/utils'
import { formatIsoDate } from '~/utils/dateFormat'
import { downloadTabular, type DownloadFormat } from '~/utils/download'
import { formatNumber } from '~/utils/numberFormat'
import { ActionFeedbackStatus, ConfirmableContent, useActionFeedback } from './ActionFeedback'
import type { ChartDatasetDefinition } from './chart-datasets'
import { combineCsvsWide } from './combineCsvsWide'
import { filterParsedRowsByDateRange } from './csvDateFilter'
import { parseCsv, type ParsedCsvRow } from './csvParse'
import { DateRangePicker } from './DateRangePicker'
import { FormatSplitButton } from './FormatSplitButton'
import { SavePresetDialog } from './PresetDialogs'
import {
	downloadPreviewHasTime,
	formatDownloadPreviewDate,
	formatDownloadPreviewCurrency,
	formatDownloadPreviewNumber,
	formatDownloadPreviewPercent,
	parseDownloadPreviewDate
} from './previewFormatting'
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
import { sumCsvColumnsToTotal } from './sumCsvColumns'
import { buildShareUrl } from './urlState'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

const ROW_HEIGHT = 36
const COLUMN_DETECTION_SAMPLE_SIZE = 200
const COLUMN_WIDTH_SAMPLE_SIZE = 40
const EMPTY_SELECTION = new Set<number>()
const MAX_PARAMS = 25
const DATE_HEADER_PATTERN = /(date|time|timestamp|day)/i
const PERCENT_HEADER_PATTERN = /(apy|pct|percent|change|rate|fee)/i
const CURRENCY_HEADER_PATTERN =
	/(usd|tvl|mcap|market.?cap|price|amount|volume|fees?|revenue|supply|borrow|depositusd|withdrawusd|value|flow)/i

type PreviewRow = ParsedCsvRow
type ColumnKind = 'text' | 'number' | 'currency' | 'percent' | 'date'
type SortDirection = 'asc' | 'desc'

interface ColumnMeta {
	index: number
	header: string
	kind: ColumnKind
	align: 'start' | 'end'
	width: number
}

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

function parseNumericValue(value: string): number | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	const normalized = trimmed.replace(/[$,%\s]/g, '').replace(/,/g, '')
	if (!normalized) return null
	const parsed = Number(normalized)
	return Number.isFinite(parsed) ? parsed : null
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

function formatCellValue(value: string, column: ColumnMeta): string {
	if (!value) return ''
	if (column.kind === 'currency') {
		const n = parseNumericValue(value)
		return n === null ? value : formatDownloadPreviewCurrency(n)
	}
	if (column.kind === 'number') {
		const n = parseNumericValue(value)
		return n === null ? value : formatDownloadPreviewNumber(n)
	}
	if (column.kind === 'percent') {
		const n = parseNumericValue(value)
		return n === null ? value : formatDownloadPreviewPercent(n)
	}
	if (column.kind === 'date') {
		return formatDownloadPreviewDate(value, column.header) ?? value
	}
	return value
}

function getCellTone(value: string, column: ColumnMeta): string {
	if (column.kind !== 'percent') return ''
	const n = parseNumericValue(value)
	if (n === null) return ''
	if (n > 0) return 'text-success'
	if (n < 0) return 'text-error'
	return ''
}

function getInitialSortDirection(kind: ColumnKind): SortDirection {
	return kind === 'text' ? 'asc' : 'desc'
}

function buildSelectedCsvRows(
	columns: Array<ColumnMeta>,
	selected: Set<number>,
	rows: Array<PreviewRow>
): Array<Array<string>> {
	const active = columns.filter((c) => selected.has(c.index))
	if (active.length === 0) return []
	return [active.map((c) => c.header), ...rows.map((row) => active.map((c) => row.values[c.index] ?? ''))]
}

function buildTsvString(columns: Array<ColumnMeta>, selected: Set<number>, rows: Array<PreviewRow>): string {
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
	const tableContainerRef = useRef<HTMLDivElement>(null)
	const { ref: attachOverflow, canScrollLeft, canScrollRight } = useHorizontalOverflow()
	// The virtualizer reads the scroller through tableContainerRef; the overflow hook follows it across the
	// remount when a search or date range empties the table. Kept stable so React does not detach it every render.
	const setTableContainer = useCallback(
		(node: HTMLDivElement) => {
			tableContainerRef.current = node
			const detachOverflow = attachOverflow(node)
			return () => {
				tableContainerRef.current = null
				detachOverflow()
			}
		},
		[attachOverflow]
	)
	const deferredSearch = useDeferredValue(search.trim().toLowerCase())

	const supportsBreakdown = dataset.paramType === 'protocol' && !!dataset.categoryBreakdown
	const isCategoryMode = supportsBreakdown && selectedCategory !== null
	const maxSelections = isCategoryMode ? Number.POSITIVE_INFINITY : MAX_PARAMS
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
							const nonce = isPreview ? `&_n=${Math.random().toString(36).slice(2)}` : ''
							const url = `/api/private/downloads/chart/${dataset.slug}?param=${encodeURIComponent(param.value)}${nonce}`
							const response = isPreview ? await fetch(url) : await authorizedFetch(url)
							if (!response || !response.ok) {
								const errorData = await response?.json().catch(() => null)
								throw new Error(errorData?.error ?? `Download failed (${response?.status})`)
							}
							if (isTrial) {
								void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
							}
							return response.text()
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
			const nonce = isPreview ? `&_n=${Math.random().toString(36).slice(2)}` : ''
			const url = `/api/private/downloads/chart-breakdown/${dataset.slug}?category=${encodeURIComponent(cat)}${nonce}`
			const response = isPreview ? await fetch(url) : await authorizedFetch(url)
			if (!response || !response.ok) {
				const errorData = await response?.json().catch(() => null)
				throw new Error(errorData?.error ?? `Download failed (${response?.status})`)
			}
			if (isTrial) {
				void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
			}
			return response.text()
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
		if (!csvText) return { headers: [] as Array<string>, rows: [] as Array<PreviewRow> }
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

	const readyCount = useMemo(() => csvQueries.filter((q) => !!q.data).length, [csvQueries])
	const loadingCount = useMemo(() => csvQueries.filter((q) => q.isLoading).length, [csvQueries])

	const rowVirtualizer = useVirtualItems({
		count: sortedRows.length,
		getScrollElement: () => tableContainerRef.current,
		estimateSize: () => ROW_HEIGHT,
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

	const toggleAll = useCallback(() => {
		const allSelected = cols.size === headers.length
		if (allSelected) {
			setSelectedColumns(new Set())
			setSortState(null)
		} else {
			setSelectedColumns(new Set(headers.map((_, i) => i)))
		}
	}, [cols.size, headers])

	const handleSort = useCallback((column: ColumnMeta) => {
		setSortState((prev) => {
			if (!prev || prev.index !== column.index) {
				return { index: column.index, direction: getInitialSortDirection(column.kind) }
			}
			return { index: column.index, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
		})
	}, [])

	const findBreakdownColumnIndex = useCallback(
		(paramValue: string): number => {
			for (let i = 0; i < headers.length; i++) {
				const h = headers[i]
				if (h === 'date') continue
				if (toSlug(h) === paramValue) return i
			}
			return -1
		},
		[headers]
	)

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

	const handleRemoveParam = useCallback(
		(value: string) => {
			setSelectedParams((prev) => prev.filter((p) => p.value !== value))
			if (!isCategoryMode && activePreviewValue === value) {
				handleSetActive(null)
			}
			if (isCategoryMode) {
				const idx = findBreakdownColumnIndex(value)
				if (idx >= 0) {
					setSelectedColumns((prev) => {
						if (!prev) return prev
						const next = new Set(prev)
						next.delete(idx)
						return next
					})
				}
			}
		},
		[isCategoryMode, findBreakdownColumnIndex, activePreviewValue, handleSetActive]
	)

	const handleToggleParam = useCallback(
		(opt: ParamOption) => {
			const exists = selectedParams.some((p) => p.value === opt.value)
			if (exists) {
				handleRemoveParam(opt.value)
				return
			}
			// The picker disables options past the cap and says why in its header.
			if (selectedParams.length >= maxSelections) return
			setSelectedParams((prev) => [...prev, opt])
			if (isCategoryMode) {
				const idx = findBreakdownColumnIndex(opt.value)
				if (idx >= 0) {
					setSelectedColumns((prev) => {
						if (!prev) return prev
						const next = new Set(prev)
						next.add(idx)
						return next
					})
				}
			}
		},
		[selectedParams, isCategoryMode, maxSelections, findBreakdownColumnIndex, handleRemoveParam]
	)

	const handleClearParams = useCallback(() => {
		if (isCategoryMode) {
			setSelectedParams([])
			setSelectedColumns(null)
			setSortState(null)
			setSelectedCategory(null)
			return
		}
		setSelectedParams([])
		setActivePreviewValue(null)
		setSelectedColumns(null)
		setSortState(null)
		setSearch('')
	}, [isCategoryMode])

	const handleAddMultipleParams = useCallback(
		(opts: Array<ParamOption>) => {
			setSelectedParams((prev) => {
				const existing = new Set(prev.map((p) => p.value))
				const toAdd = opts.filter((o) => !existing.has(o.value))
				const combined = [...prev, ...toAdd]
				// The picker offers Add all only while everything in view fits under the cap.
				if (combined.length > maxSelections) return [...prev, ...toAdd.slice(0, maxSelections - prev.length)]
				return combined
			})
		},
		[maxSelections]
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

	const handleDownloadSingle = useCallback(
		(param: ParamOption, format: DownloadFormat, action: string) => {
			if (isCategoryMode) {
				if (!csvText) {
					report(action, false, 'Data not loaded yet')
					return
				}
				const parsed = parseCsv(csvText)
				const parsedDateIdx = parsed.headers.indexOf('date')
				const parsedColIdx = parsed.headers.findIndex((h, i) => i !== parsedDateIdx && toSlug(h) === param.value)
				if (parsedColIdx < 0) {
					report(action, false, `No data for ${param.label}`)
					return
				}
				const rowsForDownload = filterParsedRowsByDateRange(parsed.rows, parsedDateIdx, dateRange)
				const outHeader = ['date', parsed.headers[parsedColIdx]]
				const allRows: Array<Array<string>> = [outHeader]
				for (const r of rowsForDownload) {
					const date = r.values[parsedDateIdx] ?? ''
					const value = r.values[parsedColIdx] ?? ''
					if (!date) continue
					allRows.push([date, value])
				}
				if (allRows.length <= 1) {
					report(action, false, 'No rows to download')
					return
				}
				const filename = `${dataset.slug}_${param.value}.${format}`
				downloadTabular(format, filename, allRows, { addTimestamp: false })
				report(action, true, `Downloaded ${filename}`)

				const configBase = extractChartConfig({
					slug: dataset.slug,
					headers: outHeader,
					selectedParams: [param],
					selectedColumns: null,
					sort: null,
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
			isCategoryMode,
			csvText,
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
		(name: string, replaceExisting: boolean) => {
			const configBase = extractChartConfig({
				slug: dataset.slug,
				headers,
				selectedParams,
				selectedColumns: cols,
				sort: sortState,
				dateRange,
				categoryBreakdown: isCategoryMode && selectedCategory ? { category: selectedCategory } : null
			})
			saveDownload(
				{
					...configBase,
					id: generatePresetId(),
					name,
					createdAt: Date.now()
				},
				{ replaceByName: replaceExisting }
			)
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
	const allSelected = headers.length > 0 && cols.size === headers.length

	const hasActiveFilter = !!dateRange || deferredSearch.length > 0
	const rowsCountLabel = hasActiveFilter
		? `${formatNumber(sortedRows.length)} of ${formatNumber(rows.length)} rows`
		: `${formatNumber(sortedRows.length)} rows`

	const headerSubtitle = (() => {
		if (isCategoryMode) {
			if (dataLoading) return `Loading ${selectedCategory} breakdown...`
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
		if (dataLoading) return 'Loading...'
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

	return (
		<>
			<Ariakit.DialogProvider
				open
				setOpen={(open) => {
					if (!open) onClose()
				}}
			>
				<Ariakit.Dialog
					ref={catchLostFocus}
					className="fixed inset-0 z-50 m-auto flex max-h-[90dvh] min-h-[55dvh] w-[calc(100vw-1rem)] max-w-7xl flex-col overflow-hidden rounded-xl border border-subtle bg-surface shadow-2xl sm:w-[calc(100vw-2rem)]"
					portal
					unmountOnHide
				>
					<div className="flex shrink-0 flex-col border-b border-subtle">
						<div className="flex items-center gap-3 px-4 py-2.5">
							<div className="mr-auto min-w-0">
								<Ariakit.DialogHeading render={<h2>{dataset.name}</h2>} className="truncate heading-xs" />
								<p className="text-xs text-pro-text-tertiary">{headerSubtitle}</p>
							</div>

							{showTopBarActions ? (
								<>
									{!isBulk && hasData ? (
										<button
											type="button"
											onClick={() =>
												isPreview ? (setSignupSource('downloads'), subscribeModalStore.show()) : void handleCopy()
											}
											disabled={!isPreview && selectedCount === 0}
											className="hidden items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary disabled:opacity-40 sm:flex"
											title="Copy selected columns as TSV"
										>
											<ConfirmableContent
												confirmed={confirmed('copy')}
												idle={
													<>
														<Icon name="clipboard" className="size-3.5" />
														<span className="hidden lg:inline">Copy</span>
													</>
												}
												done={
													<>
														<Icon name="check" className="size-3.5" />
														<span className="hidden lg:inline">Copied</span>
													</>
												}
											/>
										</button>
									) : null}

									{!isPreview ? (
										<button
											type="button"
											onClick={() => setShowSaveDialog(true)}
											disabled={!hasSelection}
											className="hidden items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary disabled:opacity-40 sm:flex"
											title="Save as preset"
										>
											<ConfirmableContent
												confirmed={confirmed('save-preset')}
												idle={
													<>
														<Icon name="bookmark" className="size-3.5" />
														<span className="hidden lg:inline">Save preset</span>
													</>
												}
												done={
													<>
														<Icon name="check" className="size-3.5" />
														<span className="hidden lg:inline">Saved</span>
													</>
												}
											/>
										</button>
									) : null}

									{!isPreview ? (
										<button
											type="button"
											onClick={() => void handleCopyLink()}
											disabled={!currentConfig}
											className="hidden items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary disabled:opacity-40 sm:flex"
											title="Copy shareable link"
										>
											<ConfirmableContent
												confirmed={confirmed('copy-link')}
												idle={<Icon name="link" className="size-3.5" />}
												done={<Icon name="check" className="size-3.5" />}
											/>
										</button>
									) : null}

									{isPreview ? (
										<button
											type="button"
											onClick={() => {
												setSignupSource('downloads')
												subscribeModalStore.show()
											}}
											className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-on-brand transition-colors hover:opacity-90"
										>
											<Icon name="download-cloud" className="size-3.5" />
											<span className="hidden sm:inline">{downloadLabel}</span>
										</button>
									) : (
										<FormatSplitButton
											onDownload={(fmt) => handleDownload(fmt)}
											disabled={topBarDownloadDisabled}
											label={downloadLabel}
											confirmed={confirmed('download')}
										/>
									)}
								</>
							) : null}

							<button
								type="button"
								onClick={onClose}
								aria-label="Close chart preview"
								className="rounded-md p-1.5 text-pro-text-tertiary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
							>
								<Icon name="x" className="size-4" />
							</button>
						</div>

						<div className="flex flex-wrap items-center gap-2 border-t border-subtle px-4 py-2">
							{protocolCategories.length > 0 ? (
								<CategoryPickerPopover
									triggerRef={categoryPickerRef}
									categories={protocolCategories}
									selected={selectedCategory}
									onSelect={handleSelectCategory}
								/>
							) : null}
							{!isCategoryMode ? (
								<MultiOptionPickerPopover
									triggerRef={paramPickerRef}
									label={dataset.paramLabel}
									options={filteredOptions}
									selected={selectedParams}
									onToggle={handleToggleParam}
									onClearAll={handleClearParams}
									onAddMultiple={handleAddMultipleParams}
									maxSelections={maxSelections}
								/>
							) : (
								<span className="flex items-center gap-1.5 rounded-md border border-subtle bg-hover-row px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary">
									<Icon name="layers" className="size-3.5" />
									{selectedParams.length} protocols
								</span>
							)}

							{dataset.sumMode && !isCategoryMode ? (
								<button
									type="button"
									onClick={() => {
										setSumMode((s) => !s)
										setSelectedColumns(null)
										setSortState(null)
									}}
									aria-pressed={sumModeActive}
									title={
										sumModeActive
											? `Showing total per date. Click to show each ${dataset.paramLabel.toLowerCase()} as a separate column.`
											: `Sum all columns into a single total per date`
									}
									className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
										sumModeActive
											? 'border-brand bg-brand text-on-brand'
											: 'border-subtle text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'
									}`}
								>
									<Icon name="plus" className="size-3.5" />
									<span>Sum all</span>
								</button>
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
									<label className="relative min-w-32 flex-1 sm:min-w-48">
										<Icon
											name="search"
											height={14}
											width={14}
											className="absolute top-0 bottom-0 left-2.5 my-auto text-pro-text-tertiary"
										/>
										<input
											value={search}
											onChange={(e) => setSearch(e.currentTarget.value)}
											aria-label="Filter rows"
											placeholder="Filter rows..."
											className="w-full min-w-0 rounded-md border border-subtle bg-transparent py-1.5 pr-2.5 pl-8 text-xs outline-hidden transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand/30 sm:w-48"
										/>
									</label>

									<ColumnPickerPopover
										columns={columnMeta}
										selected={cols}
										allSelected={allSelected}
										onToggle={toggleColumn}
										onToggleAll={toggleAll}
									/>

									<button
										type="button"
										onClick={() => void handleCopy()}
										disabled={selectedCount === 0}
										className="flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary disabled:opacity-40 sm:hidden"
										title="Copy selected columns as TSV"
									>
										<ConfirmableContent
											confirmed={confirmed('copy')}
											idle={<Icon name="clipboard" className="size-3.5" />}
											done={<Icon name="check" className="size-3.5" />}
										/>
									</button>
								</>
							) : hasData && isPreview ? (
								<p className="text-xs text-pro-text-tertiary">Preview — showing first {sortedRows.length} rows</p>
							) : null}
						</div>
						<SavedPresetNotice notices={savedPresetNotices} />
						<ActionFeedbackStatus outcome={outcome} />
					</div>

					<div className="flex min-h-0 flex-1">
						<div className="relative flex min-w-0 flex-1 flex-col">
							{!hasPreviewTarget ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center">
										<Icon name="search" className="size-6 text-pro-text-tertiary" />
										<p className="text-sm text-pro-text-secondary">
											Select a {dataset.paramLabel.toLowerCase()} above to load chart data
										</p>
									</div>
								</div>
							) : dataLoading ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-3">
										<LoadingSpinner size={28} />
										<p className="text-sm text-pro-text-secondary">Fetching chart data...</p>
									</div>
								</div>
							) : dataError ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2">
										<Icon name="alert-triangle" className="size-6 text-error" />
										<p className="text-sm text-error">
											{dataError instanceof Error ? dataError.message : 'Failed to fetch data'}
										</p>
									</div>
								</div>
							) : columnMeta.length === 0 ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center">
										<Icon name="eye-off" className="size-6 text-pro-text-tertiary" />
										<p className="text-sm text-pro-text-secondary">No data</p>
									</div>
								</div>
							) : sortedRows.length === 0 ? (
								<div className="flex flex-1 items-center justify-center">
									<div className="flex flex-col items-center gap-2 text-center">
										<Icon name="search" className="size-6 text-pro-text-tertiary" />
										<p className="text-sm text-pro-text-secondary">
											{dateRange && rows.length > 0
												? 'No rows in selected date range'
												: deferredSearch.length > 0
													? 'No rows match your search'
													: 'No matching rows'}
										</p>
										{dateRange && rows.length > 0 ? (
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
											background: 'linear-gradient(to left, var(--bg-surface) 0%, transparent 100%)'
										}}
									/>
									<div
										ref={setTableContainer}
										className={`h-full ${isPreview ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
										style={
											{
												'--sticky-shadow': canScrollLeft ? '4px 0 8px -2px rgba(0,0,0,0.25)' : 'none'
											} as CSSProperties
										}
									>
										<div className="sticky top-0 z-20 bg-surface" style={{ minWidth: `${tableWidth}px` }}>
											<div style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
												{columnMeta.map((column, position) => {
													const isSelected = cols.has(column.index)
													const isSorted = sortState?.index === column.index ? activeSortDirection : false
													const isSticky = position === 0
													return (
														<div
															key={column.index}
															className="border-t border-r border-subtle bg-surface last:border-r-0"
															style={{
																position: isSticky ? 'sticky' : undefined,
																left: isSticky ? 0 : undefined,
																zIndex: isSticky ? 30 : undefined,
																background: 'var(--bg-surface)',
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
																		className={`truncate text-xs font-medium ${isSelected ? 'text-pro-text-secondary' : 'text-pro-text-tertiary'}`}
																	>
																		{column.header}
																	</span>
																	<SortIcon dir={isSorted} />
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
												const isOdd = virtualRow.index % 2 === 1
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
																	className={`truncate border-t border-r border-subtle p-2 text-sm last:border-r-0 ${tone} ${!isSelected ? 'text-pro-text-tertiary opacity-40' : ''}`}
																	style={{
																		textAlign: column.align,
																		position: isSticky ? 'sticky' : undefined,
																		left: isSticky ? 0 : undefined,
																		zIndex: isSticky ? 1 : undefined,
																		background: isSticky
																			? 'var(--bg-surface)'
																			: isOdd
																				? 'var(--bg-primary)'
																				: undefined,
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
									{isPreview ? (
										<>
											<div
												className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
												style={{
													top: '20%',
													backdropFilter: 'blur(4px)',
													WebkitBackdropFilter: 'blur(4px)',
													maskImage: 'linear-gradient(to bottom, transparent 0%, black 35%)',
													WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 35%)'
												}}
											/>
											<div className="absolute inset-x-0 bottom-0 z-50 border-t border-subtle bg-surface px-6 py-5">
												<div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
													<p className="text-sm font-semibold text-pro-text-primary">
														This is a preview — subscribe to download full datasets
													</p>
													<p className="text-xs text-pro-text-tertiary">
														Get access to all rows, all columns, and unlimited CSV downloads
													</p>
													<Link
														href="/subscribe"
														className="mt-1 inline-flex items-center gap-2 rounded-lg bg-brand px-8 py-2.5 text-sm font-semibold text-on-brand shadow-md transition-all hover:opacity-90"
													>
														<Icon name="arrow-up-right" className="size-4" />
														Subscribe
													</Link>
												</div>
											</div>
										</>
									) : null}
								</div>
							)}
						</div>

						{hasSelection ? (
							<BulkPreviewSidebar
								dataset={dataset}
								selectedParams={selectedParams}
								activePreviewValue={activePreviewValue}
								csvQueries={csvQueries}
								onSelectActive={handleSetActive}
								onRemove={handleRemoveParam}
								onClearAll={() => keepFocus(handleClearParams, pickerTrigger)}
								onDownloadSingle={(param) => handleDownloadSingle(param, 'csv', `download:${param.value}`)}
								onDownloadCombined={() => handleDownloadCombined('csv', 'download-combined')}
								confirmed={confirmed}
								pickerTrigger={pickerTrigger}
								isPreview={!!isPreview}
								onSubscribeClick={() => {
									setSignupSource('downloads')
									subscribeModalStore.show()
								}}
								readyCount={readyCount}
								loadingCount={loadingCount}
							/>
						) : null}
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
			{isPreview ? (
				<Suspense fallback={null}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
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

function PlaceholderRows({
	columnMeta,
	gridTemplate,
	tableWidth,
	rows,
	cols
}: {
	columnMeta: Array<ColumnMeta>
	gridTemplate: string
	tableWidth: number
	rows: Array<PreviewRow>
	cols: Set<number>
}) {
	if (rows.length === 0) return null
	const duplicated = [...rows, ...rows]
	return (
		<div style={{ minWidth: `${tableWidth}px` }}>
			{duplicated.map((row, rowIdx) => {
				const isOdd = (rows.length + rowIdx) % 2 === 1
				return (
					<div
						// oxlint-disable-next-line react/no-array-index-key -- Filler intentionally repeats source rows, so source IDs would collide.
						key={`placeholder-${rowIdx}`}
						style={{ display: 'grid', gridTemplateColumns: gridTemplate, height: `${ROW_HEIGHT}px` }}
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
									className={`truncate border-t border-r border-subtle p-2 text-sm last:border-r-0 ${tone} ${!isSelected ? 'text-pro-text-tertiary opacity-40' : ''}`}
									style={{
										textAlign: column.align,
										position: isSticky ? 'sticky' : undefined,
										left: isSticky ? 0 : undefined,
										zIndex: isSticky ? 1 : undefined,
										background: isSticky ? 'var(--bg-surface)' : isOdd ? 'var(--bg-primary)' : undefined,
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
	)
}

function CategoryPickerPopover({
	triggerRef,
	categories,
	selected,
	onSelect
}: {
	triggerRef: RefObject<HTMLButtonElement | null>
	categories: Array<[string, number]>
	selected: string | null
	onSelect: (cat: string | null) => void
}) {
	const [search, setSearch] = useState('')
	const deferred = useDeferredValue(search.trim().toLowerCase())

	const filtered = useMemo(() => {
		if (!deferred) return categories
		return categories.filter(([cat]) => cat.toLowerCase().includes(deferred))
	}, [categories, deferred])

	return (
		<Ariakit.PopoverProvider>
			<div className="relative">
				<Ariakit.PopoverDisclosure
					ref={triggerRef}
					className={`flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary ${selected ? 'pr-8' : ''}`}
				>
					<Icon name="tag" className="size-3.5" />
					<span>{selected ?? 'All categories'}</span>
				</Ariakit.PopoverDisclosure>
				{selected ? (
					<button
						type="button"
						aria-label="Clear category"
						onClick={() => {
							triggerRef.current?.focus()
							onSelect(null)
						}}
						className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 hover:bg-hover-row"
					>
						<Icon name="x" className="size-2.5" />
					</button>
				) : null}
			</div>
			<Ariakit.Popover
				gutter={6}
				portal
				unmountOnHide
				className="z-[60] flex max-h-80 w-64 flex-col overflow-hidden rounded-lg border border-medium bg-surface-elevated-1 shadow-xl"
			>
				<div className="border-b border-subtle px-3 py-2">
					<input
						value={search}
						onChange={(e) => setSearch(e.currentTarget.value)}
						placeholder="Search categories..."
						className="w-full rounded-md border border-subtle bg-transparent px-2.5 py-1.5 text-xs outline-hidden placeholder:text-pro-text-tertiary focus:border-brand"
						autoFocus
					/>
				</div>
				<div className="min-h-0 flex-auto overflow-auto py-1">
					<button
						type="button"
						onClick={() => onSelect(null)}
						className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-hover-row ${
							selected === null ? 'font-medium text-pro-text-primary' : 'text-pro-text-secondary'
						}`}
					>
						All categories
					</button>
					{filtered.map(([cat, count]) => (
						<button
							key={cat}
							type="button"
							onClick={() => onSelect(cat)}
							className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-hover-row ${
								selected === cat ? 'font-medium text-pro-text-primary' : 'text-pro-text-secondary'
							}`}
						>
							<span className="truncate">{cat}</span>
							<span className="shrink-0 text-pro-text-tertiary">{count}</span>
						</button>
					))}
					{filtered.length === 0 ? (
						<p className="px-3 py-2 text-xs text-pro-text-tertiary">No categories match</p>
					) : null}
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

function MultiOptionPickerPopover({
	triggerRef,
	label,
	options,
	selected,
	onToggle,
	onClearAll,
	onAddMultiple,
	maxSelections
}: {
	triggerRef: RefObject<HTMLButtonElement | null>
	label: string
	options: Array<ParamOption>
	selected: Array<ParamOption>
	onToggle: (option: ParamOption) => void
	onClearAll: () => void
	onAddMultiple: (options: Array<ParamOption>) => void
	maxSelections: number
}) {
	const popoverStore = Ariakit.usePopoverStore()
	const [optionSearch, setOptionSearch] = useState('')
	const searchRef = useRef<HTMLInputElement>(null)
	const deferredOptionSearch = useDeferredValue(optionSearch.trim().toLowerCase())

	const selectedValues = useMemo(() => new Set(selected.map((s) => s.value)), [selected])

	const filtered = useMemo(() => {
		const source = deferredOptionSearch
			? options.filter((o) => o.label.toLowerCase().includes(deferredOptionSearch))
			: options
		return source.slice(0, 200)
	}, [options, deferredOptionSearch])

	const capHit = selected.length >= maxSelections

	const unselectedInView = useMemo(
		() => filtered.filter((o) => !selectedValues.has(o.value)),
		[filtered, selectedValues]
	)
	const canAddAll = unselectedInView.length > 0 && selected.length + unselectedInView.length <= maxSelections

	const triggerText =
		selected.length === 0 ? `Select ${label}` : selected.length === 1 ? `1 ${label}` : `${selected.length} ${label}s`

	return (
		<Ariakit.PopoverProvider store={popoverStore}>
			<Ariakit.PopoverDisclosure
				ref={triggerRef}
				className="flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
			>
				<Icon name="chevron-down" className="size-3.5" />
				<span>{triggerText}</span>
				{selected.length > 0 ? (
					<span className="rounded-sm bg-brand px-1 text-[10px] font-semibold text-on-brand">{selected.length}</span>
				) : null}
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				gutter={6}
				portal
				unmountOnHide
				className="z-[60] flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border border-medium bg-surface-elevated-1 shadow-xl"
			>
				<div className="flex items-center justify-between gap-2 border-b border-subtle px-3 py-2">
					<span className="text-xs font-medium text-pro-text-secondary">
						{Number.isFinite(maxSelections)
							? `${selected.length}/${maxSelections} selected${capHit ? ' · remove one to add more' : ''}`
							: `${selected.length} selected`}
					</span>
					<div className="flex items-center gap-2">
						{canAddAll ? (
							<button
								type="button"
								// Add all and Clear all leave once used; the search field stays.
								onClick={() =>
									keepFocus(
										() => onAddMultiple(unselectedInView),
										() => searchRef.current
									)
								}
								className="text-xs text-brand hover:underline"
							>
								Add all ({unselectedInView.length})
							</button>
						) : null}
						{selected.length > 0 ? (
							<button
								type="button"
								onClick={() => keepFocus(onClearAll, () => searchRef.current)}
								className="text-xs text-brand hover:underline"
							>
								Clear all
							</button>
						) : null}
					</div>
				</div>
				<div className="border-b border-subtle px-3 py-2">
					<input
						ref={searchRef}
						value={optionSearch}
						onChange={(e) => setOptionSearch(e.currentTarget.value)}
						placeholder={`Search ${label.toLowerCase()}…`}
						className="w-full rounded-md border border-subtle bg-transparent px-2.5 py-1.5 text-xs outline-hidden placeholder:text-pro-text-tertiary focus:border-brand"
						autoFocus
					/>
				</div>
				<div className="min-h-0 flex-auto overflow-auto py-1">
					{filtered.length === 0 ? (
						<p className="px-3 py-2 text-xs text-pro-text-tertiary">No results</p>
					) : (
						filtered.map((opt) => {
							const isSelected = selectedValues.has(opt.value)
							const disabled = !isSelected && capHit
							return (
								<button
									key={opt.value}
									type="button"
									disabled={disabled}
									onClick={() => onToggle(opt)}
									title={disabled ? `Max ${maxSelections} items` : undefined}
									className={`flex w-full items-center gap-2.5 py-1.5 pr-3 text-left text-xs transition-colors hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40 ${
										isSelected ? 'text-pro-text-primary' : 'text-pro-text-secondary'
									} ${opt.isChild ? 'pl-7' : 'pl-3'}`}
								>
									<span
										className={`flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
											isSelected ? 'border-brand bg-brand text-on-brand' : 'border-subtle'
										}`}
									>
										{isSelected ? <Icon name="check" className="size-2.5" /> : null}
									</span>
									<span className="truncate">{opt.label}</span>
								</button>
							)
						})
					)}
					{filtered.length >= 200 ? (
						<p className="px-3 py-2 text-[11px] text-pro-text-tertiary">
							Showing first 200 — refine the search to narrow results
						</p>
					) : null}
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

function ColumnPickerPopover({
	columns,
	selected,
	allSelected,
	onToggle,
	onToggleAll
}: {
	columns: Array<ColumnMeta>
	selected: Set<number>
	allSelected: boolean
	onToggle: (index: number) => void
	onToggleAll: () => void
}) {
	const popoverStore = Ariakit.usePopoverStore()

	return (
		<Ariakit.PopoverProvider store={popoverStore}>
			<Ariakit.PopoverDisclosure className="flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary">
				<Icon name="eye" className="size-3.5" />
				Columns
				<span className="text-pro-text-tertiary">
					{selected.size}/{columns.length}
				</span>
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				gutter={6}
				portal
				unmountOnHide
				className="z-[60] flex max-h-80 w-64 flex-col overflow-hidden rounded-lg border border-medium bg-surface-elevated-1 shadow-xl"
			>
				<div className="flex items-center justify-between border-b border-subtle px-3 py-2">
					<span className="text-xs font-medium text-pro-text-secondary">Toggle columns</span>
					<button type="button" onClick={onToggleAll} className="text-xs text-brand hover:underline">
						{allSelected ? 'Deselect all' : 'Select all'}
					</button>
				</div>
				<div className="min-h-0 flex-auto overflow-auto py-1">
					{columns.map((column) => {
						const isSelected = selected.has(column.index)
						return (
							<button
								key={column.index}
								type="button"
								onClick={() => onToggle(column.index)}
								className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-hover-row"
							>
								<span
									className={`flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
										isSelected ? 'border-brand bg-brand text-on-brand' : 'border-subtle'
									}`}
								>
									{isSelected ? <Icon name="check" className="size-2.5" /> : null}
								</span>
								<span className={isSelected ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}>{column.header}</span>
							</button>
						)
					})}
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

interface CsvQueryStatus {
	data: unknown
	isLoading: boolean
	error: unknown
}

interface BulkPreviewSidebarProps {
	dataset: ChartDatasetDefinition
	selectedParams: Array<ParamOption>
	activePreviewValue: string | null
	csvQueries: ReadonlyArray<CsvQueryStatus>
	onSelectActive: (value: string) => void
	onRemove: (value: string) => void
	onClearAll: () => void
	onDownloadSingle: (param: ParamOption) => void
	onDownloadCombined: () => void
	/** Whether a download button shows its confirmation now. */
	confirmed: (action: string) => boolean
	/** Takes focus when the last row leaves. */
	pickerTrigger: () => HTMLElement | null
	isPreview: boolean
	onSubscribeClick: () => void
	readyCount: number
	loadingCount: number
}

function BulkPreviewSidebar({
	dataset,
	selectedParams,
	activePreviewValue,
	csvQueries,
	onSelectActive,
	onRemove,
	onClearAll,
	onDownloadSingle,
	onDownloadCombined,
	confirmed,
	pickerTrigger,
	isPreview,
	onSubscribeClick,
	readyCount,
	loadingCount
}: BulkPreviewSidebarProps) {
	const combinedDisabled = loadingCount > 0 || readyCount === 0
	const listRef = useRef<HTMLDivElement>(null)
	// A removed row's × hands focus to the × that takes its place, the one above, or the picker once none is left.
	const removeRow = (value: string, index: number) =>
		keepFocus(
			() => onRemove(value),
			() => {
				const removeButtons = listRef.current?.querySelectorAll<HTMLElement>('[data-row-remove]') ?? []
				return removeButtons[Math.min(index, removeButtons.length - 1)] ?? pickerTrigger()
			}
		)
	return (
		<aside className="hidden w-72 shrink-0 flex-col border-l border-subtle sm:flex">
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-3 py-2">
				<div className="min-w-0">
					<p className="text-xs font-semibold text-pro-text-primary">
						Selected {dataset.paramLabel.toLowerCase()}s ({selectedParams.length})
					</p>
					{loadingCount > 0 ? (
						<p className="text-[10px] text-pro-text-tertiary">
							Ready {readyCount}/{selectedParams.length}
						</p>
					) : null}
				</div>
				{selectedParams.length > 0 ? (
					<button
						type="button"
						onClick={onClearAll}
						className="shrink-0 text-[11px] text-pro-text-tertiary hover:text-pro-text-primary hover:underline"
					>
						Clear all
					</button>
				) : null}
			</div>
			<div ref={listRef} className="flex-1 overflow-auto">
				{selectedParams.map((param, i) => {
					const query = csvQueries[i]
					const isActive = param.value === activePreviewValue
					const isReady = typeof query?.data === 'string'
					const isQueryLoading = !!query?.isLoading
					const hasError = !!query?.error
					return (
						<div
							key={param.value}
							className={`flex items-center gap-1.5 border-b border-subtle px-2.5 py-2 text-xs transition-colors ${
								isActive ? 'bg-hover-row' : 'hover:bg-hover-row'
							}`}
						>
							<button
								type="button"
								onClick={() => onSelectActive(param.value)}
								className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
								title={`Preview ${param.label}`}
								aria-current={isActive ? true : undefined}
							>
								<span className="flex size-4 shrink-0 items-center justify-center">
									{isQueryLoading ? (
										<LoadingSpinner size={12} />
									) : hasError ? (
										<Icon name="alert-triangle" className="size-3.5 text-error" />
									) : isReady ? (
										<Icon name="check" className="size-3.5 text-success" />
									) : null}
								</span>
								<span
									className={`truncate ${isActive ? 'font-medium text-pro-text-primary' : 'text-pro-text-secondary'}`}
								>
									{param.label}
								</span>
							</button>
							<button
								type="button"
								onClick={() => onDownloadSingle(param)}
								disabled={!isReady || isPreview}
								title={isPreview ? 'Subscribe to download' : 'Download this CSV'}
								aria-label={`Download ${param.label} CSV`}
								className="shrink-0 rounded-sm p-1 text-pro-text-tertiary transition-colors hover:bg-surface hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
							>
								<ConfirmableContent
									confirmed={confirmed(`download:${param.value}`)}
									idle={<Icon name="download-cloud" className="size-3.5" />}
									done={<Icon name="check" className="size-3.5" />}
								/>
							</button>
							<button
								type="button"
								onClick={() => removeRow(param.value, i)}
								data-row-remove
								title="Remove"
								aria-label={`Remove ${param.label}`}
								className="shrink-0 rounded-sm p-1 text-pro-text-tertiary transition-colors hover:bg-surface hover:text-error"
							>
								<Icon name="x" className="size-3.5" />
							</button>
						</div>
					)
				})}
			</div>
			<div className="border-t border-subtle p-3">
				{isPreview ? (
					<button
						type="button"
						onClick={onSubscribeClick}
						className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-on-brand transition-colors hover:opacity-90"
					>
						<Icon name="arrow-up-right" className="size-3.5" />
						Subscribe to download
					</button>
				) : (
					<>
						<button
							type="button"
							onClick={onDownloadCombined}
							disabled={combinedDisabled}
							className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-on-brand transition-colors hover:opacity-90 disabled:opacity-40"
						>
							<ConfirmableContent
								confirmed={confirmed('download-combined')}
								idle={
									<>
										<Icon name="download-cloud" className="size-3.5" />
										Download combined CSV
									</>
								}
								done={
									<>
										<Icon name="check" className="size-3.5" />
										Downloaded
									</>
								}
							/>
						</button>
						<p className="mt-1.5 text-center text-[10px] text-pro-text-tertiary">
							Wide format — each {dataset.paramLabel.toLowerCase()} becomes a column
						</p>
					</>
				)}
			</div>
		</aside>
	)
}
