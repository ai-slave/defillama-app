import * as Ariakit from '@ariakit/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { type CSSProperties, lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { setSignupSource } from '~/auth/signupSource'
import { VirtualizedMultiSelect, VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import { SortIcon } from '~/components/Table/SortIcon'
import { useRecentDownloads, useSavedDownloads } from '~/contexts/LocalStorage'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { SearchField } from '~/ui/SearchField'
import { downloadTabular, type DownloadFormat } from '~/utils/download'
import { formatNumber } from '~/utils/numberFormat'
import { ActionFeedbackStatus, useActionFeedback } from './ActionFeedback'
import { parseCsv } from './csvParse'
import type { DatasetDefinition } from './datasets'
import { SavePresetDialog } from './PresetDialogs'
import {
	downloadPreviewHasTime,
	formatDownloadPreviewDate,
	formatDownloadPreviewCurrency,
	formatDownloadPreviewNumber,
	formatDownloadPreviewPercent,
	parseDownloadPreviewDate
} from './previewFormatting'
import { PreviewHeaderActions } from './PreviewHeaderActions'
import { createPreviewSearchIndex, filterPreviewRows } from './previewSearch'
import { RowLimitPicker } from './RowLimitPicker'
import {
	applyDatasetConfig,
	defaultPresetName,
	type DatasetSavedConfig,
	extractDatasetConfig,
	generatePresetId,
	missingColumnNotices,
	type SavedDownloadInput
} from './savedDownloads'
import { SavedPresetNotice } from './SavedPresetNotice'
import { buildShareUrl } from './urlState'
import { usePreviewTableScroller } from './usePreviewTableScroller'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

const ROW_HEIGHT = 36
const COLUMN_DETECTION_SAMPLE_SIZE = 200
const COLUMN_WIDTH_SAMPLE_SIZE = 40
const EMPTY_SELECTION = new Set<number>()
const DATE_HEADER_PATTERN = /(date|time|timestamp|day|unlock)/i
const PERCENT_HEADER_PATTERN = /(apy|pct|percent|change|rate|fee|mnav|ltv)/i
const CURRENCY_HEADER_PATTERN =
	/(usd|tvl|mcap|market.?cap|price|amount|volume|fees?|revenue|supply|borrow|debt|cost|aum|valuation|value|flow)/i

type PreviewRow = {
	id: number
	values: Array<string>
}

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

function parseNumericValue(value: string): number | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	const normalized = trimmed.replace(/[$,%\s]/g, '').replace(/,/g, '')
	if (!normalized) return null
	const parsed = Number(normalized)
	return Number.isFinite(parsed) ? parsed : null
}

function detectColumnKind(header: string, values: Array<string>): ColumnKind {
	const sample = values.filter((value) => value.trim()).slice(0, COLUMN_DETECTION_SAMPLE_SIZE)
	if (sample.length === 0) return 'text'
	const numericMatches = sample.filter((value) => parseNumericValue(value) !== null).length
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
	for (const value of values.slice(0, COLUMN_WIDTH_SAMPLE_SIZE))
		sampleMaxLength = Math.max(sampleMaxLength, value.length)
	if (kind === 'date') return downloadPreviewHasTime(header, values) ? (isFirst ? 240 : 220) : isFirst ? 200 : 160
	if (kind === 'currency' || kind === 'number' || kind === 'percent') return isFirst ? 200 : 140
	const estimated = Math.max(140, Math.min(300, sampleMaxLength * 8 + 24))
	return isFirst ? Math.max(200, estimated) : estimated
}

function formatCellValue(value: string, column: ColumnMeta): string {
	if (!value) return ''
	if (column.kind === 'currency') {
		const numeric = parseNumericValue(value)
		return numeric === null ? value : formatDownloadPreviewCurrency(numeric)
	}
	if (column.kind === 'number') {
		const numeric = parseNumericValue(value)
		return numeric === null ? value : formatDownloadPreviewNumber(numeric)
	}
	if (column.kind === 'percent') {
		const numeric = parseNumericValue(value)
		return numeric === null ? value : formatDownloadPreviewPercent(numeric)
	}
	if (column.kind === 'date') {
		return formatDownloadPreviewDate(value, column.header) ?? value
	}
	return value
}

function getCellTone(value: string, column: ColumnMeta): string {
	if (column.kind !== 'percent') return ''
	const numeric = parseNumericValue(value)
	if (numeric === null) return ''
	if (numeric > 0) return 'text-success'
	if (numeric < 0) return 'text-error'
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
	const activeCols = columns.filter((c) => selected.has(c.index))
	if (activeCols.length === 0) return []
	return [activeCols.map((c) => c.header), ...rows.map((row) => activeCols.map((c) => row.values[c.index] ?? ''))]
}

function buildTsvString(columns: Array<ColumnMeta>, selected: Set<number>, rows: Array<PreviewRow>): string {
	const activeCols = columns.filter((c) => selected.has(c.index))
	if (activeCols.length === 0) return ''
	const header = activeCols.map((c) => c.header).join('\t')
	const body = rows.map((row) => activeCols.map((c) => row.values[c.index] ?? '').join('\t')).join('\n')
	return `${header}\n${body}`
}

interface Props {
	dataset: DatasetDefinition
	authorizedFetch: (url: string, options?: any) => Promise<Response | null>
	onClose: () => void
	isTrial?: boolean
	isPreview?: boolean
	initialConfig?: DatasetSavedConfig
}

export function DatasetPreviewModal({ dataset, authorizedFetch, onClose, isTrial, isPreview, initialConfig }: Props) {
	const queryClient = useQueryClient()
	const subscribeModalStore = Ariakit.useDialogStore()
	const { savedDownloads, saveDownload } = useSavedDownloads()
	const { recordRecent } = useRecentDownloads()
	const [selectedColumns, setSelectedColumns] = useState<Set<number> | null>(null)
	const [search, setSearch] = useState('')
	const [sortState, setSortState] = useState<SortState | null>(null)
	const [rowLimit, setRowLimit] = useState<number | null>(initialConfig?.rowLimit ?? null)
	const [selectedChain, setSelectedChain] = useState<string | null>(initialConfig?.chain ?? null)
	const [excludeState, setExcludeState] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {}
		for (const toggle of dataset.excludeToggles ?? []) {
			initial[toggle.field] = toggle.defaultExclude ?? false
		}
		if (initialConfig?.exclude) {
			for (const [k, v] of Object.entries(initialConfig.exclude)) {
				initial[k] = v
			}
		}
		return initial
	})
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	const { outcome, report, confirmed } = useActionFeedback()
	const [appliedInitialConfig, setAppliedInitialConfig] = useState<ReturnType<typeof applyDatasetConfig> | null>(null)
	const { scrollerRef, setScroller, canScrollLeft, canScrollRight } = usePreviewTableScroller()
	const deferredSearch = useDeferredValue(search.trim().toLowerCase())

	const { data: availableChains } = useQuery({
		queryKey: ['downloads-chains', dataset.slug],
		queryFn: async () => {
			const response = await authorizedFetch(`/api/private/downloads/${dataset.slug}?mode=chains`)
			if (!response || !response.ok) return []
			const json = await response.json()
			return (json?.chains as Array<string>) ?? []
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		enabled: !!dataset.chainFilterType
	})

	const chainQueryParam = selectedChain ? `?chain=${encodeURIComponent(selectedChain)}` : ''

	const {
		data: csvText,
		isLoading: loading,
		error
	} = useQuery({
		queryKey: ['downloads-preview', dataset.slug, selectedChain, isPreview],
		queryFn: async () => {
			const sep = chainQueryParam ? '&' : '?'
			const nonce = isPreview ? `${sep}_n=${Math.random().toString(36).slice(2)}` : ''
			const url = `/api/private/downloads/${dataset.slug}${chainQueryParam}${nonce}`
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
	})

	const { headers, rows } = useMemo(() => {
		if (!csvText) return { headers: [] as Array<string>, rows: [] as Array<PreviewRow> }
		return parseCsv(csvText)
	}, [csvText])

	// Initialize the editable draft once the CSV arrives. Subsequent user edits stay authoritative.
	if (headers.length > 0 && selectedColumns === null) {
		if (initialConfig && appliedInitialConfig === null) {
			const applied = applyDatasetConfig(initialConfig, headers)
			setSelectedColumns(applied.selectedColumns)
			setSortState(applied.sort)
			setAppliedInitialConfig(applied)
		} else {
			setSelectedColumns(new Set(headers.map((_, index) => index)))
			if (dataset.defaultSortField && sortState === null) {
				const sortIndex = headers.indexOf(dataset.defaultSortField)
				if (sortIndex !== -1) {
					const values = rows.map((row) => row.values[sortIndex] ?? '')
					const kind = detectColumnKind(dataset.defaultSortField, values)
					setSortState({ index: sortIndex, direction: getInitialSortDirection(kind) })
				}
			}
		}
	}

	const cols = selectedColumns ?? EMPTY_SELECTION

	const columnMeta = useMemo(() => {
		return headers.map<ColumnMeta>((header, index) => {
			const values = rows.map((row) => row.values[index] ?? '')
			const kind = detectColumnKind(header, values)
			return {
				index,
				header,
				kind,
				align: kind === 'text' || kind === 'date' ? 'start' : 'end',
				width: getColumnWidth(header, kind, values, index === 0)
			}
		})
	}, [headers, rows])

	const selectedCount = useMemo(() => columnMeta.filter((c) => cols.has(c.index)).length, [columnMeta, cols])

	const excludeFilteredRows = useMemo(() => {
		const toggles = dataset.excludeToggles
		if (!toggles || toggles.length === 0) return rows
		const headerIndices = new Map<string, number>()
		for (const [index, header] of headers.entries()) {
			if (!headerIndices.has(header)) headerIndices.set(header, index)
		}
		const fieldIndices: Array<number> = []
		for (const toggle of toggles) {
			if (!excludeState[toggle.field]) continue
			const index = headerIndices.get(toggle.field)
			if (index !== undefined) fieldIndices.push(index)
		}
		if (fieldIndices.length === 0) return rows
		return rows.filter((row) => !fieldIndices.some((idx) => row.values[idx]?.toLowerCase() === 'true'))
	}, [rows, headers, dataset.excludeToggles, excludeState])
	const searchIndex = useMemo(() => createPreviewSearchIndex(rows, columnMeta.length), [rows, columnMeta.length])

	const filteredRows = useMemo(() => {
		return filterPreviewRows(excludeFilteredRows, searchIndex, deferredSearch)
	}, [excludeFilteredRows, searchIndex, deferredSearch])

	const sortedRows = useMemo(() => {
		if (!sortState) return filteredRows
		const activeColumn = columnMeta.find((column) => column.index === sortState.index)
		if (!activeColumn) return filteredRows
		const dir = sortState.direction === 'asc' ? 1 : -1

		return filteredRows.toSorted((leftRow, rightRow) => {
			const a = leftRow.values[activeColumn.index] ?? ''
			const b = rightRow.values[activeColumn.index] ?? ''

			const aBlank = !a.trim()
			const bBlank = !b.trim()
			if (aBlank && bBlank) return leftRow.id - rightRow.id
			if (aBlank) return 1
			if (bBlank) return -1

			if (activeColumn.kind === 'date') {
				const aVal = parseDownloadPreviewDate(a, activeColumn.header)?.timestamp ?? null
				const bVal = parseDownloadPreviewDate(b, activeColumn.header)?.timestamp ?? null
				if (aVal === null && bVal === null) return leftRow.id - rightRow.id
				if (aVal === null) return 1
				if (bVal === null) return -1
				const cmp = aVal - bVal
				return cmp === 0 ? leftRow.id - rightRow.id : cmp * dir
			}

			if (activeColumn.kind === 'number' || activeColumn.kind === 'currency' || activeColumn.kind === 'percent') {
				const aVal = parseNumericValue(a)
				const bVal = parseNumericValue(b)
				if (aVal === null && bVal === null) return leftRow.id - rightRow.id
				if (aVal === null) return 1
				if (bVal === null) return -1
				const cmp = aVal - bVal
				return cmp === 0 ? leftRow.id - rightRow.id : cmp * dir
			}

			const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
			return cmp === 0 ? leftRow.id - rightRow.id : cmp * dir
		})
	}, [columnMeta, filteredRows, sortState])

	const displayedRows = useMemo(
		() => (rowLimit && rowLimit > 0 ? sortedRows.slice(0, rowLimit) : sortedRows),
		[sortedRows, rowLimit]
	)

	const tableWidth = useMemo(() => columnMeta.reduce((total, column) => total + column.width, 0), [columnMeta])
	const gridTemplate = useMemo(
		() => columnMeta.map((column) => `minmax(${column.width}px, 1fr)`).join(' '),
		[columnMeta]
	)

	const hasData = !loading && !error && headers.length > 0

	const rowVirtualizer = useVirtualItems({
		count: displayedRows.length,
		getScrollElement: () => scrollerRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 10
	})

	const toggleColumn = useCallback((index: number) => {
		setSelectedColumns((previous) => {
			const next = new Set(previous ?? [])
			if (next.has(index)) {
				next.delete(index)
			} else {
				next.add(index)
			}
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
		setSortState((previous) => {
			if (!previous || previous.index !== column.index) {
				return { index: column.index, direction: getInitialSortDirection(column.kind) }
			}
			return {
				index: column.index,
				direction: previous.direction === 'asc' ? 'desc' : 'asc'
			}
		})
	}, [])

	const handleDownload = useCallback(
		(format: DownloadFormat = 'csv') => {
			if (selectedCount === 0) {
				report('download', false, 'Select at least one column')
				return
			}
			const csvRows = buildSelectedCsvRows(columnMeta, cols, displayedRows)
			if (csvRows.length <= 1) {
				report('download', false, 'No rows to download')
				return
			}
			const extension = format === 'json' ? 'json' : 'csv'
			downloadTabular(format, `${dataset.slug}.${extension}`, csvRows, { addTimestamp: false })
			report('download', true, `Downloaded ${dataset.slug}.${extension}`)

			const configBase = extractDatasetConfig({
				slug: dataset.slug,
				headers,
				selectedColumns: cols,
				sort: sortState,
				chain: selectedChain,
				exclude: excludeState,
				rowLimit
			})
			recordRecent({
				...configBase,
				id: generatePresetId(),
				name: defaultPresetName(configBase, dataset.name),
				createdAt: Date.now()
			})
		},
		[
			dataset.slug,
			dataset.name,
			columnMeta,
			cols,
			displayedRows,
			selectedCount,
			headers,
			sortState,
			selectedChain,
			excludeState,
			rowLimit,
			recordRecent,
			report
		]
	)

	const handleSavePreset = useCallback(
		(name: string, replaceExisting: boolean) => {
			const configBase = extractDatasetConfig({
				slug: dataset.slug,
				headers,
				selectedColumns: cols,
				sort: sortState,
				chain: selectedChain,
				exclude: excludeState,
				rowLimit
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
		[dataset.slug, headers, cols, sortState, selectedChain, excludeState, rowLimit, saveDownload, report]
	)

	const currentConfig = useMemo<SavedDownloadInput | null>(() => {
		if (headers.length === 0 || !selectedColumns) return null
		return extractDatasetConfig({
			slug: dataset.slug,
			headers,
			selectedColumns: cols,
			sort: sortState,
			chain: selectedChain,
			exclude: excludeState,
			rowLimit
		})
	}, [dataset.slug, headers, selectedColumns, cols, sortState, selectedChain, excludeState, rowLimit])

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
		const tsv = buildTsvString(columnMeta, cols, displayedRows)
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
	}, [columnMeta, cols, displayedRows, selectedCount, report])

	const subscribe = () => {
		setSignupSource('downloads')
		subscribeModalStore.show()
	}

	const activeSortDirection = sortState ? sortState.direction : false

	return (
		<>
			<Dialog size="xl" workspace open onClose={onClose}>
				<DialogHeader
					title={dataset.name}
					subtitle={
						loading
							? 'Loading...'
							: error
								? 'Error'
								: (() => {
										const isLimited = rowLimit !== null && rowLimit > 0 && displayedRows.length < sortedRows.length
										const rowsLabel = isLimited
											? `${formatNumber(displayedRows.length)} of ${formatNumber(sortedRows.length)} rows`
											: `${formatNumber(sortedRows.length)} rows`
										return `${rowsLabel} · ${selectedCount}/${headers.length} cols selected`
									})()
					}
					actions={
						hasData ? (
							isPreview ? (
								<PreviewHeaderActions mode="preview" downloadLabel="Download" copy onSubscribe={subscribe} />
							) : (
								<PreviewHeaderActions
									mode="full"
									confirmed={confirmed}
									downloadLabel="Download"
									copy={{ run: () => void handleCopy(), disabled: selectedCount === 0 }}
									savePreset={{ run: () => setShowSaveDialog(true), disabled: selectedCount === 0 }}
									copyLink={{ run: () => void handleCopyLink(), disabled: !currentConfig }}
									onDownload={handleDownload}
									downloadDisabled={selectedCount === 0}
								/>
							)
						) : null
					}
				/>

				{hasData ? (
					<DialogToolbar>
						<div className="flex flex-wrap items-center gap-2">
							{!isPreview ? (
								<>
									<SearchField
										label="Filter rows"
										value={search}
										onChange={setSearch}
										placeholder="Filter rows…"
										className="min-w-32 flex-1 sm:max-w-56 sm:min-w-48"
									/>

									{dataset.chainFilterType && availableChains && availableChains.length > 0 ? (
										<VirtualizedSelect
											variant="chip"
											label="Chain"
											options={[
												{ value: '', label: 'All' },
												...availableChains.map((chain) => ({ value: chain, label: chain }))
											]}
											selectedValue={selectedChain ?? ''}
											placeholder="All"
											onChange={(option) => {
												setSelectedChain(option.value || null)
												setSelectedColumns(null)
												setSortState(null)
											}}
										/>
									) : null}

									{dataset.excludeToggles?.map((toggle) => (
										<Button
											key={toggle.field}
											variant="toggle"
											size="md"
											data-active={!(excludeState[toggle.field] ?? false)}
											aria-pressed={!(excludeState[toggle.field] ?? false)}
											onClick={() =>
												setExcludeState((prev) => ({ ...prev, [toggle.field]: !(prev[toggle.field] ?? false) }))
											}
										>
											<Icon name={excludeState[toggle.field] ? 'eye-off' : 'eye'} className="size-3.5" />
											{toggle.label}
										</Button>
									))}

									<VirtualizedMultiSelect
										variant="chip"
										label="Columns"
										options={columnOptions}
										selectedValues={selectedColumnValues}
										onChange={handleColumnsChange}
										placeholder="None"
									/>

									<RowLimitPicker value={rowLimit} totalRows={sortedRows.length} onChange={setRowLimit} />
								</>
							) : (
								<p className="text-xs text-pro-text-tertiary">Preview — showing first {sortedRows.length} rows</p>
							)}
						</div>
					</DialogToolbar>
				) : null}
				{/* Each band draws the line under itself, as the toolbar above does. */}
				<SavedPresetNotice notices={missingColumnNotices(appliedInitialConfig)} />
				<ActionFeedbackStatus outcome={outcome} />

				<DialogBody kind="flush">
					<div className="flex h-full min-h-0 flex-col">
						{loading ? (
							<div className="flex flex-1 items-center justify-center">
								<div className="flex flex-col items-center gap-3">
									<LoadingSpinner size={28} />
									<p className="text-sm text-pro-text-secondary">Fetching dataset...</p>
								</div>
							</div>
						) : error ? (
							<div className="flex flex-1 items-center justify-center">
								<div className="flex flex-col items-center gap-2">
									<Icon name="alert-triangle" className="size-6 text-error" />
									<p className="text-sm text-error">
										{error instanceof Error ? error.message : 'Failed to fetch data'}
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
									<p className="text-sm text-pro-text-secondary">No matching rows</p>
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
											const row = displayedRows[virtualRow.index]
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
																	background: isSticky ? 'var(--bg-overlay)' : isOdd ? 'var(--bg-primary)' : undefined,
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
										<div className="absolute inset-x-0 bottom-0 z-50 border-t border-subtle bg-overlay px-6 py-5">
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
				</DialogBody>
			</Dialog>
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
										background: isSticky ? 'var(--bg-overlay)' : isOdd ? 'var(--bg-primary)' : undefined,
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
