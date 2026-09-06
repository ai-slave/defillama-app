import * as Ariakit from '@ariakit/react'
import { Popover, PopoverDisclosure, usePopoverStore } from '@ariakit/react'
import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
	type UniqueIdentifier
} from '@dnd-kit/core'
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnOrderState, SortingState, VisibilityState } from '@tanstack/react-table'
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)
import { isColumnSupported } from '~/containers/ProDashboard/components/UnifiedTable/config/metricCapabilities'
import {
	compileExpression,
	formatPreviewNumber,
	generateCustomColumnId,
	getAvailableVariables,
	getDefaultAggregation,
	getExpressionVariables,
	SAMPLE_METRICS,
	validateExpression
} from '~/containers/ProDashboard/components/UnifiedTable/utils/customColumns'
import {
	COLUMN_DICTIONARY_BY_ID,
	UNIFIED_TABLE_COLUMN_DICTIONARY
} from '~/containers/ProDashboard/unifiedTable/config/columnDictionary'
import type { MetricGroup } from '~/containers/ProDashboard/unifiedTable/config/columnDictionary'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '~/containers/ProDashboard/unifiedTable/config/types'

const AVAILABLE_VARIABLES = getAvailableVariables()
const AVAILABLE_VARIABLES_BY_KEY = new Map(AVAILABLE_VARIABLES.map((variable) => [variable.key, variable]))
const SAMPLE_METRICS_BY_KEY = new Map(Object.entries(SAMPLE_METRICS))
const EMPTY_CUSTOM_COLUMNS: Array<CustomColumnDefinition> = []

interface ColumnManagerProps {
	rowHeaders: ReadonlyArray<UnifiedRowHeaderType>
	columnOrder: ColumnOrderState
	columnVisibility: VisibilityState
	onChange: (columnOrder: ColumnOrderState, columnVisibility: VisibilityState) => void
	customColumns?: Array<CustomColumnDefinition>
	onAddCustomColumn?: (column: CustomColumnDefinition) => void
	onUpdateCustomColumn?: (id: string, updates: Partial<CustomColumnDefinition>) => void
	onRemoveCustomColumn?: (id: string) => void
	sorting?: SortingState
	onSortingChange?: (sorting: SortingState) => void
	onSortingReset?: () => void
}

type ColumnGroupId = MetricGroup | 'meta' | 'custom'
type ColumnFormat = CustomColumnDefinition['format']
type ColumnAggregation = CustomColumnDefinition['aggregation']

interface ColumnMeta {
	id: string
	header: string
	group: ColumnGroupId
}

const GROUP_FILTERS: Array<{ id: ColumnGroupId | 'all'; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'meta', label: 'Meta' },
	{ id: 'tvl', label: 'TVL' },
	{ id: 'fees', label: 'Fees' },
	{ id: 'volume', label: 'Volume' },
	{ id: 'revenue', label: 'Revenue' },
	{ id: 'ratios', label: 'Valuation' },
	{ id: 'perps', label: 'Perps' },
	{ id: 'custom', label: 'Custom' }
]

const GROUP_LABELS: Record<ColumnGroupId | 'all', string> = {
	all: 'All',
	meta: 'Meta',
	tvl: 'TVL',
	fees: 'Fees',
	volume: 'Volume',
	revenue: 'Revenue',
	earnings: 'Earnings',
	ratios: 'Valuation',
	perps: 'Perps',
	aggregators: 'Aggregators',
	'bridge-aggregators': 'Bridge Aggregators',
	'derivatives-aggregators': 'Derivatives Aggregators',
	options: 'Options',
	custom: 'Custom'
}

const FORMAT_OPTIONS: Array<{ id: ColumnFormat; label: string; description: string }> = [
	{ id: 'usd', label: '$', description: 'Currency' },
	{ id: 'percent', label: '%', description: 'Percent' },
	{ id: 'ratio', label: 'x', description: 'Ratio' },
	{ id: 'number', label: '#', description: 'Number' }
]

const AGGREGATION_OPTIONS: Array<{ id: ColumnAggregation; label: string; description: string }> = [
	{ id: 'recalculate', label: 'Recalc', description: 'Re-evaluate expression on aggregated metrics (best for ratios)' },
	{ id: 'sum', label: 'Sum', description: 'Sum individual row values (best for totals like 24h run-rate fees)' },
	{ id: 'first', label: 'First', description: 'Use first row value only' },
	{ id: 'none', label: 'None', description: 'Show dash (-) for grouped rows' }
]

const EXAMPLE_PRESETS: Array<{ name: string; expression: string; format: ColumnFormat }> = [
	{ name: 'TVL/MCap', expression: 'tvl / mcap', format: 'ratio' },
	{ name: 'Fees (24h Run Rate)', expression: 'fees24h * 365', format: 'usd' },
	{ name: 'Fee Yield (24h Run Rate)', expression: '(fees24h * 365) / tvl * 100', format: 'percent' },
	{ name: 'P/F Ratio (24h Run Rate)', expression: 'mcap / (fees24h * 365)', format: 'ratio' },
	{ name: 'Revenue Margin', expression: 'revenue24h / fees24h * 100', format: 'percent' }
]

interface AutocompleteSuggestion {
	type: 'variable' | 'operator' | 'function'
	value: string
	display: string
	description: string
	category: string
}

const NAME_COLUMN: ColumnMeta = { id: 'name', header: 'Name', group: 'meta' }

const getColumnMeta = (id: string, customColumns?: Array<CustomColumnDefinition>): ColumnMeta | null => {
	if (id === 'name') return NAME_COLUMN
	if (id.startsWith('custom_')) {
		const customCol = customColumns?.find((c) => c.id === id)
		if (customCol) {
			return { id: customCol.id, header: customCol.name, group: 'custom' }
		}
		return null
	}
	const dictionaryEntry = COLUMN_DICTIONARY_BY_ID.get(id)
	if (!dictionaryEntry) return null
	return {
		id: dictionaryEntry.id,
		header: dictionaryEntry.header,
		group: dictionaryEntry.group
	}
}

const buildAllColumns = (
	rowHeaders: ReadonlyArray<UnifiedRowHeaderType>,
	customColumns?: Array<CustomColumnDefinition>
): Array<ColumnMeta> => {
	const dictionaryMetas = UNIFIED_TABLE_COLUMN_DICTIONARY.filter((column) => isColumnSupported(column.id, rowHeaders))
		.map(({ id }) => getColumnMeta(id))
		.filter((meta): meta is ColumnMeta => Boolean(meta))

	const customMetas: Array<ColumnMeta> = (customColumns ?? EMPTY_CUSTOM_COLUMNS).map((col) => ({
		id: col.id,
		header: col.name,
		group: 'custom'
	}))

	return [NAME_COLUMN, ...dictionaryMetas, ...customMetas]
}

export function ColumnManager({
	rowHeaders,
	columnOrder,
	columnVisibility,
	onChange,
	customColumns,
	onAddCustomColumn,
	onUpdateCustomColumn,
	onRemoveCustomColumn,
	sorting,
	onSortingChange,
	onSortingReset
}: ColumnManagerProps) {
	const { hasActiveSubscription } = useAuthContext()
	const [shouldRenderSubscribeModal, setShouldRenderSubscribeModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({
		open: shouldRenderSubscribeModal,
		setOpen: setShouldRenderSubscribeModal
	})
	const [uiState, setUIState] = useState<{
		search: string
		groupFilter: ColumnGroupId | 'all'
		activeId: UniqueIdentifier | null
		customColumnExpanded: boolean
	}>({
		search: '',
		groupFilter: 'all',
		activeId: null,
		customColumnExpanded: false
	})
	const { search, groupFilter, activeId, customColumnExpanded } = uiState
	const deferredSearch = useDeferredValue(search)

	const [customColumnState, setCustomColumnState] = useState<{
		customName: string
		customExpression: string
		customFormat: ColumnFormat
		customAggregation: ColumnAggregation
		editingId: string | null
		aggregationTouched: boolean
	}>({
		customName: '',
		customExpression: '',
		customFormat: 'number',
		customAggregation: 'recalculate',
		editingId: null,
		aggregationTouched: false
	})
	const { customName, customExpression, customFormat, customAggregation, editingId, aggregationTouched } =
		customColumnState

	const [autocompleteState, setAutocompleteState] = useState<{
		showAutocomplete: boolean
		autocompleteIndex: number
		autocompleteFilter: string
	}>({
		showAutocomplete: false,
		autocompleteIndex: -1,
		autocompleteFilter: ''
	})
	const { showAutocomplete, autocompleteIndex, autocompleteFilter } = autocompleteState

	const setSearch = (value: string) => {
		setUIState((prev) => ({ ...prev, search: value }))
	}

	const setGroupFilter = (value: ColumnGroupId | 'all') => {
		setUIState((prev) => ({ ...prev, groupFilter: value }))
	}

	const setActiveId = (value: UniqueIdentifier | null) => {
		setUIState((prev) => ({ ...prev, activeId: value }))
	}

	const setCustomColumnExpanded = (value: boolean) => {
		setUIState((prev) => ({ ...prev, customColumnExpanded: value }))
	}

	const setCustomName = (value: string) => {
		setCustomColumnState((prev) => ({ ...prev, customName: value }))
	}

	const setCustomExpression = (value: string) => {
		setCustomColumnState((prev) => ({ ...prev, customExpression: value }))
	}

	const setCustomFormat = (value: ColumnFormat) => {
		setCustomColumnState((prev) => ({ ...prev, customFormat: value }))
	}

	const setCustomAggregation = (value: ColumnAggregation) => {
		setCustomColumnState((prev) => ({ ...prev, customAggregation: value }))
	}

	const setEditingId = (value: string | null) => {
		setCustomColumnState((prev) => ({ ...prev, editingId: value }))
	}

	const setAggregationTouched = (value: boolean) => {
		setCustomColumnState((prev) => ({ ...prev, aggregationTouched: value }))
	}

	const setShowAutocomplete = (value: boolean) => {
		setAutocompleteState((prev) => ({ ...prev, showAutocomplete: value }))
	}

	const setAutocompleteIndex = (value: number | ((prev: number) => number)) => {
		setAutocompleteState((prev) => ({
			...prev,
			autocompleteIndex: typeof value === 'function' ? value(prev.autocompleteIndex) : value
		}))
	}

	const setAutocompleteFilter = (value: string) => {
		setAutocompleteState((prev) => ({ ...prev, autocompleteFilter: value }))
	}
	const expressionInputRef = useRef<HTMLInputElement>(null)

	const allColumns = useMemo(() => buildAllColumns(rowHeaders, customColumns), [rowHeaders, customColumns])
	const allColumnIds = useMemo(() => new Set(allColumns.map((c) => c.id)), [allColumns])

	const visibleSet = useMemo(() => {
		const set = new Set<string>(['name'])
		for (const column of allColumns) {
			if (column.id === 'name') continue
			const isVisible = columnVisibility[column.id] !== false
			if (isVisible) set.add(column.id)
		}
		return set
	}, [allColumns, columnVisibility])

	const selectedColumns = useMemo(() => {
		const selected: Array<string> = []
		const addedIds = new Set<string>()
		for (const id of columnOrder) {
			if (id === 'name') continue
			if (!allColumnIds.has(id)) continue
			if (visibleSet.has(id)) {
				selected.push(id)
				addedIds.add(id)
			}
		}
		for (const meta of allColumns) {
			if (meta.id === 'name') continue
			if (addedIds.has(meta.id)) continue
			if (visibleSet.has(meta.id)) selected.push(meta.id)
		}
		return selected
	}, [allColumns, allColumnIds, columnOrder, visibleSet])

	const selectedColumnsSet = useMemo(() => new Set(selectedColumns), [selectedColumns])

	const filteredColumns = useMemo(() => {
		const term = deferredSearch.trim().toLowerCase()
		return allColumns.filter((column) => {
			if (column.id === 'name') return false
			if (groupFilter !== 'all' && column.group !== groupFilter) return false
			if (term && !column.header.toLowerCase().includes(term)) return false
			return true
		})
	}, [allColumns, deferredSearch, groupFilter])

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)

	const applyChanges = (nextSelected: Array<string>) => {
		const nextSelectedSet = new Set(nextSelected)
		const remaining = allColumns.map((c) => c.id).filter((id) => id !== 'name' && !nextSelectedSet.has(id))
		const nextOrder: ColumnOrderState = ['name', ...nextSelected, ...remaining]
		const nextVisibility: VisibilityState = { name: true }
		for (const column of allColumns) {
			if (column.id === 'name') continue
			nextVisibility[column.id] = nextSelectedSet.has(column.id)
		}
		onChange(nextOrder, nextVisibility)
	}

	const handleToggleColumn = (id: string) => {
		if (id === 'name') return
		const isSelected = selectedColumnsSet.has(id)
		if (isSelected) {
			applyChanges(selectedColumns.filter((c) => c !== id))
		} else {
			applyChanges([...selectedColumns, id])
		}
	}

	const handleRemoveColumn = (id: string) => {
		applyChanges(selectedColumns.filter((c) => c !== id))
	}

	const handleClearAll = () => {
		applyChanges([])
	}

	const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id)
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (over && active.id !== over.id) {
			const oldIndex = selectedColumns.indexOf(String(active.id))
			const newIndex = selectedColumns.indexOf(String(over.id))
			if (oldIndex !== -1 && newIndex !== -1) {
				applyChanges(arrayMove(selectedColumns, oldIndex, newIndex))
			}
		}
		setActiveId(null)
	}
	const handleDragCancel = () => setActiveId(null)

	const autocompleteSuggestions = useMemo<Array<AutocompleteSuggestion>>(() => {
		return [
			...AVAILABLE_VARIABLES.map((v) => ({
				type: 'variable' as const,
				value: v.key,
				display: v.key,
				description: v.name,
				category: v.group
			})),
			{ type: 'operator', value: ' + ', display: '+', description: 'Addition', category: 'Operators' },
			{ type: 'operator', value: ' - ', display: '-', description: 'Subtraction', category: 'Operators' },
			{ type: 'operator', value: ' * ', display: '*', description: 'Multiplication', category: 'Operators' },
			{ type: 'operator', value: ' / ', display: '/', description: 'Division', category: 'Operators' },
			{ type: 'function', value: 'abs(', display: 'abs()', description: 'Absolute value', category: 'Functions' },
			{ type: 'function', value: 'sqrt(', display: 'sqrt()', description: 'Square root', category: 'Functions' },
			{ type: 'function', value: 'max(', display: 'max(a,b)', description: 'Maximum', category: 'Functions' },
			{ type: 'function', value: 'min(', display: 'min(a,b)', description: 'Minimum', category: 'Functions' }
		]
	}, [])

	const filteredSuggestions = useMemo(() => {
		if (!autocompleteFilter.trim()) return autocompleteSuggestions.slice(0, 15)
		const filter = autocompleteFilter.toLowerCase()
		return autocompleteSuggestions
			.filter((s) => s.display.toLowerCase().includes(filter) || s.description.toLowerCase().includes(filter))
			.slice(0, 10)
	}, [autocompleteSuggestions, autocompleteFilter])

	const expressionValidation = useMemo(() => {
		if (!customExpression.trim()) return { isValid: false, error: 'Expression is required' }
		return validateExpression(customExpression)
	}, [customExpression])

	const validation = useMemo(() => {
		if (!customName.trim()) return { isValid: false, error: 'Name is required' }
		const isDuplicate = (customColumns ?? EMPTY_CUSTOM_COLUMNS).some(
			(col) => col.name.toLowerCase() === customName.toLowerCase() && col.id !== editingId
		)
		if (isDuplicate) return { isValid: false, error: 'Column name already exists' }
		return expressionValidation
	}, [customName, expressionValidation, customColumns, editingId])

	const preview = useMemo(() => {
		if (!customExpression.trim() || !expressionValidation.isValid) return null
		const result = compileExpression(customExpression).evaluate(SAMPLE_METRICS)
		if (result === null) return null
		return formatPreviewNumber(result, customFormat)
	}, [customExpression, expressionValidation.isValid, customFormat])

	const usedVariables = useMemo(() => {
		if (!customExpression.trim() || !expressionValidation.isValid) return []
		const vars = getExpressionVariables(customExpression)
		return vars
			.map((v) => {
				const meta = AVAILABLE_VARIABLES_BY_KEY.get(v)
				const value = SAMPLE_METRICS_BY_KEY.get(v)
				if (value === undefined) return null
				return {
					key: v,
					name: meta?.name ?? v,
					value,
					formatted: formatPreviewNumber(value, meta?.format ?? 'number')
				}
			})
			.filter((variable) => variable !== null)
	}, [customExpression, expressionValidation.isValid])
	const resolvedCustomAggregation =
		customExpression && expressionValidation.isValid && !editingId && !aggregationTouched
			? getDefaultAggregation(customExpression)
			: customAggregation

	const insertSuggestion = (suggestion: AutocompleteSuggestion) => {
		if (!expressionInputRef.current) return
		const input = expressionInputRef.current
		const start = input.selectionStart ?? 0
		const end = input.selectionEnd ?? 0
		const value = input.value

		let wordStart = start
		while (wordStart > 0) {
			const previousCharacter = value[wordStart - 1]
			if (previousCharacter === undefined || !/[a-zA-Z0-9_]/.test(previousCharacter)) break
			wordStart -= 1
		}

		const newValue = value.slice(0, wordStart) + suggestion.value + value.slice(end)
		setCustomExpression(newValue)

		setTimeout(() => {
			const newPosition = wordStart + suggestion.value.length
			input.setSelectionRange(newPosition, newPosition)
			input.focus()
		}, 0)

		setShowAutocomplete(false)
		setAutocompleteIndex(-1)
		setAutocompleteFilter('')
	}

	const handleExpressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value
		const cursorPos = e.target.selectionStart ?? 0
		setCustomExpression(newValue)

		let wordStart = cursorPos
		while (wordStart > 0) {
			const previousCharacter = newValue[wordStart - 1]
			if (previousCharacter === undefined || !/[a-zA-Z0-9_]/.test(previousCharacter)) break
			wordStart -= 1
		}
		const currentWord = newValue.slice(wordStart, cursorPos)

		if (currentWord.length > 0) {
			setAutocompleteFilter(currentWord)
			setShowAutocomplete(true)
			setAutocompleteIndex(-1)
		} else {
			setShowAutocomplete(false)
			setAutocompleteFilter('')
		}
	}

	const handleExpressionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!showAutocomplete || filteredSuggestions.length === 0) {
			if (e.ctrlKey && e.code === 'Space') {
				e.preventDefault()
				setShowAutocomplete(true)
				setAutocompleteFilter('')
				setAutocompleteIndex(-1)
			}
			return
		}
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				setAutocompleteIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0))
				break
			case 'ArrowUp':
				e.preventDefault()
				setAutocompleteIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1))
				break
			case 'Enter':
			case 'Tab':
				if (autocompleteIndex >= 0) {
					const suggestion = filteredSuggestions[autocompleteIndex]
					if (!suggestion) break
					e.preventDefault()
					insertSuggestion(suggestion)
				}
				break
			case 'Escape':
				e.preventDefault()
				// Dismiss the suggestions only; the enclosing Ariakit dialog stays open.
				e.stopPropagation()
				setShowAutocomplete(false)
				setAutocompleteIndex(-1)
				break
		}
	}

	const handleAddOrUpdateCustomColumn = () => {
		if (!validation.isValid) return
		const column: CustomColumnDefinition = {
			id: editingId ?? generateCustomColumnId(),
			name: customName.trim(),
			expression: customExpression.trim(),
			format: customFormat,
			aggregation: resolvedCustomAggregation
		}
		if (editingId && onUpdateCustomColumn) {
			onUpdateCustomColumn(editingId, {
				name: column.name,
				expression: column.expression,
				format: column.format,
				aggregation: column.aggregation
			})
			setEditingId(null)
		} else if (onAddCustomColumn) {
			onAddCustomColumn(column)
		}
		setAggregationTouched(false)
		setCustomName('')
		setCustomExpression('')
		setCustomFormat('number')
		setCustomAggregation('recalculate')
		setCustomColumnExpanded(false)
	}

	const handleApplyPreset = (preset: { name: string; expression: string; format: ColumnFormat }) => {
		setAggregationTouched(false)
		setCustomName(preset.name)
		setCustomExpression(preset.expression)
		setCustomFormat(preset.format)
		setCustomAggregation(getDefaultAggregation(preset.expression))
		setCustomColumnExpanded(true)
	}

	const handleEditCustomColumn = (col: CustomColumnDefinition) => {
		setCustomName(col.name)
		setCustomExpression(col.expression)
		setCustomFormat(col.format)
		setCustomAggregation(col.aggregation)
		setEditingId(col.id)
		setCustomColumnExpanded(true)
	}

	const handleCancelEdit = () => {
		setAggregationTouched(false)
		setCustomName('')
		setCustomExpression('')
		setCustomFormat('number')
		setCustomAggregation('recalculate')
		setEditingId(null)
	}

	useEffect(() => {
		const handleClickOutside = () => setAutocompleteState((prev) => ({ ...prev, showAutocomplete: false }))
		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [])

	const activeColumn = activeId ? getColumnMeta(String(activeId), customColumns) : null

	const currentSorting = sorting?.[0]
	const currentSortColumn = currentSorting?.id ?? ''
	const isDescending = currentSorting?.desc ?? true

	const selectableColumnsForSort = useMemo(() => {
		return columnOrder
			.filter((id) => columnVisibility[id] ?? true)
			.map((id) => getColumnMeta(id, customColumns))
			.filter((meta): meta is ColumnMeta => Boolean(meta))
	}, [columnOrder, columnVisibility, customColumns])

	const handleSortColumnChange = (value: string) => {
		if (!onSortingChange) return
		if (!value) {
			onSortingChange([])
			return
		}
		const nextDesc = currentSortColumn === value ? isDescending : true
		onSortingChange([{ id: value, desc: nextDesc }])
	}

	const handleSortDirectionChange = (desc: boolean) => {
		if (!onSortingChange || !currentSortColumn) return
		onSortingChange([{ id: currentSortColumn, desc }])
	}

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-3">
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h4 className="text-xs font-semibold text-pro-text-primary uppercase">Selected</h4>
						<span className="rounded-sm bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
							{selectedColumns.length}
						</span>
					</div>
					{selectedColumns.length > 0 ? (
						<button
							type="button"
							onClick={handleClearAll}
							className="text-[10px] font-medium text-error hover:underline"
						>
							Clear all
						</button>
					) : null}
				</div>

				<DndContext
					sensors={sensors}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragCancel={handleDragCancel}
				>
					<div className="max-h-[100px] overflow-y-auto">
						{selectedColumns.length === 0 ? (
							<div className="flex h-12 items-center justify-center rounded-md border border-dashed border-pro-cards-border text-xs text-pro-text-tertiary">
								No columns selected
							</div>
						) : (
							<SortableContext items={selectedColumns} strategy={horizontalListSortingStrategy}>
								<div className="flex flex-wrap gap-1.5">
									{selectedColumns.map((columnId, index) => {
										const meta = getColumnMeta(columnId, customColumns)
										if (!meta) return null
										return (
											<SortableChip
												key={meta.id}
												id={meta.id}
												label={meta.header}
												isFirst={index === 0}
												onRemove={() => handleRemoveColumn(meta.id)}
												isCustom={meta.group === 'custom'}
											/>
										)
									})}
								</div>
							</SortableContext>
						)}
					</div>
					<DragOverlay>
						{activeColumn ? (
							<div className="rounded-md border border-brand bg-brand/20 px-2 py-1 text-xs font-medium text-brand shadow-lg">
								{activeColumn.header}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>

				<p className="mt-2 text-[10px] text-pro-text-tertiary">Drag to reorder. First column pinned left.</p>
			</section>

			{sorting !== undefined && onSortingChange ? (
				<SortingSection
					currentSortColumn={currentSortColumn}
					isDescending={isDescending}
					selectableColumns={selectableColumnsForSort}
					onColumnChange={handleSortColumnChange}
					onDirectionChange={handleSortDirectionChange}
					onReset={onSortingReset}
				/>
			) : null}

			<section className="flex flex-col rounded-lg border border-pro-cards-border bg-pro-cards-bg">
				<div className="flex flex-wrap gap-1 border-b border-pro-cards-border p-2">
					{GROUP_FILTERS.map((filter) => (
						<button
							key={filter.id}
							type="button"
							onClick={() => setGroupFilter(filter.id)}
							className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
								groupFilter === filter.id
									? 'bg-brand/15 text-brand'
									: 'text-pro-text-tertiary hover:text-pro-text-secondary'
							}`}
						>
							{filter.label}
						</button>
					))}
				</div>

				<div className="border-b border-pro-cards-border p-2">
					<div className="relative">
						<Icon
							name="search"
							width={12}
							height={12}
							className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
						/>
						<input
							onInput={(e) => setSearch(e.currentTarget.value)}
							placeholder="Search columns..."
							className="w-full rounded-md border border-pro-cards-border py-1.5 pr-2.5 pl-8 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
						/>
					</div>
				</div>

				<div className="max-h-[240px] overflow-y-auto p-2">
					{filteredColumns.length === 0 ? (
						<p className="flex h-16 items-center justify-center text-xs text-pro-text-tertiary">No columns match</p>
					) : (
						<div className="flex flex-col gap-1">
							{filteredColumns.map((column) => {
								const isSelected = selectedColumnsSet.has(column.id)
								return (
									<button
										key={column.id}
										type="button"
										onClick={() => handleToggleColumn(column.id)}
										className={`group flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all ${
											isSelected ? 'border-brand/30 bg-brand/5' : 'border-transparent hover:border-pro-cards-border'
										}`}
									>
										<div
											className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
												isSelected
													? 'border-brand bg-brand text-on-brand'
													: 'border-pro-cards-border group-hover:border-brand/50'
											}`}
										>
											{isSelected ? <Icon name="check" width={8} height={8} /> : null}
										</div>
										<span
											className={`flex-1 truncate text-xs ${isSelected ? 'font-medium text-pro-text-primary' : 'text-pro-text-secondary'}`}
										>
											{column.header}
										</span>
										<span className="rounded-sm px-1 py-0.5 text-[9px] text-pro-text-tertiary uppercase">
											{GROUP_LABELS[column.group]}
										</span>
									</button>
								)
							})}
						</div>
					)}
				</div>
			</section>

			<section className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-3">
				<button
					type="button"
					onClick={() => {
						if (!hasActiveSubscription) {
							setSignupSource('pro-dashboard')
							subscribeModalStore.show()
							return
						}
						setCustomColumnExpanded(!customColumnExpanded)
						if (editingId) handleCancelEdit()
					}}
					className="flex w-full items-center justify-between"
				>
					<div className="flex items-center gap-2">
						<Icon
							name={!hasActiveSubscription ? 'file-lock-2' : customColumnExpanded ? 'minus' : 'plus'}
							width={14}
							height={14}
							className="text-brand"
						/>
						<span className="text-xs font-semibold text-pro-text-primary">
							{editingId ? 'Edit Custom Column' : 'Custom Column'}
							{!hasActiveSubscription ? <span className="ml-1 text-[10px] font-normal opacity-60">(Pro)</span> : null}
						</span>
						{(customColumns?.length ?? 0) > 0 ? (
							<span className="rounded-sm bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-500">
								{customColumns?.length}
							</span>
						) : null}
					</div>
					<Icon
						name="chevron-down"
						width={14}
						height={14}
						className={`text-pro-text-tertiary transition-transform ${customColumnExpanded ? 'rotate-180' : ''}`}
					/>
				</button>

				<div className="mt-2 flex flex-wrap gap-1.5">
					{EXAMPLE_PRESETS.map((preset) => (
						<button
							key={preset.name}
							type="button"
							onClick={() => handleApplyPreset(preset)}
							className="rounded-md border border-pro-cards-border px-2 py-1 text-[10px] font-medium text-pro-text-secondary transition-colors hover:border-brand hover:text-brand"
						>
							{preset.name}
						</button>
					))}
				</div>

				{customColumnExpanded ? (
					<div className="mt-3 space-y-3 border-t border-pro-cards-border pt-3">
						{editingId ? (
							<div className="flex items-center justify-between">
								<span className="text-xs text-pro-text-secondary">Editing: {customName || 'Custom Column'}</span>
								<button type="button" onClick={handleCancelEdit} className="text-xs text-brand hover:underline">
									Cancel
								</button>
							</div>
						) : null}

						<div className="flex gap-2">
							<input
								type="text"
								value={customName}
								onChange={(e) => setCustomName(e.target.value)}
								placeholder="Column name"
								className="flex-1 rounded-md border border-pro-cards-border px-2 py-1.5 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
							/>
						</div>

						<div className="relative" role="presentation" onClick={(e) => e.stopPropagation()}>
							<input
								ref={expressionInputRef}
								type="text"
								value={customExpression}
								onChange={handleExpressionChange}
								onKeyDown={handleExpressionKeyDown}
								onFocus={() => customExpression && setShowAutocomplete(true)}
								placeholder="e.g., tvl / mcap, fees24h * 365"
								className={`w-full rounded-md border px-2 py-1.5 pr-8 font-mono text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:outline-hidden ${
									customExpression && !expressionValidation.isValid
										? 'border-error'
										: customExpression && expressionValidation.isValid
											? 'border-success'
											: 'border-pro-cards-border focus:border-brand'
								}`}
							/>
							{customExpression ? (
								<div className="absolute top-1/2 right-2 -translate-y-1/2">
									{expressionValidation.isValid ? (
										<Icon name="check" height={12} width={12} className="text-success" />
									) : (
										<Icon name="x" height={12} width={12} className="text-error" />
									)}
								</div>
							) : null}
							{showAutocomplete && filteredSuggestions.length > 0 ? (
								<div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto overscroll-contain rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-lg">
									{filteredSuggestions.map((suggestion, index) => (
										<button
											key={`${suggestion.type}-${suggestion.value}`}
											type="button"
											onClick={() => insertSuggestion(suggestion)}
											onMouseEnter={() => setAutocompleteIndex(index)}
											className={`flex cursor-pointer items-center gap-2 px-2 py-1 text-xs ${
												index === autocompleteIndex ? 'bg-brand text-on-brand' : 'text-pro-text-primary'
											}`}
										>
											<span
												className={`size-1.5 shrink-0 rounded-full ${
													suggestion.type === 'variable'
														? 'bg-blue-400'
														: suggestion.type === 'function'
															? 'bg-purple-400'
															: 'bg-gray-400'
												}`}
											/>
											<code className="shrink-0">{suggestion.display}</code>
											<span className="ml-auto truncate text-pro-text-tertiary">{suggestion.description}</span>
										</button>
									))}
								</div>
							) : null}
						</div>
						<p className="text-[9px] text-pro-text-tertiary">Ctrl+Space to show all · ↑↓ navigate · Enter select</p>

						<div className="flex flex-wrap gap-2">
							<div className="flex-1">
								<p className="mb-1 text-[10px] font-medium text-pro-text-secondary">Format</p>
								<div className="flex gap-1">
									{FORMAT_OPTIONS.map((opt) => (
										<Tooltip key={opt.id} content={opt.description} placement="bottom">
											<button
												type="button"
												onClick={() => setCustomFormat(opt.id)}
												className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
													customFormat === opt.id
														? 'border-brand bg-brand/15 text-brand'
														: 'border-pro-cards-border text-pro-text-tertiary hover:border-brand/50'
												}`}
											>
												{opt.label}
											</button>
										</Tooltip>
									))}
								</div>
							</div>
							<div className="flex-1">
								<p className="mb-1 text-[10px] font-medium text-pro-text-secondary">Aggregation</p>
								<div className="flex gap-1">
									{AGGREGATION_OPTIONS.map((opt) => (
										<Tooltip key={opt.id} content={opt.description} placement="bottom">
											<button
												type="button"
												onClick={() => {
													setAggregationTouched(true)
													setCustomAggregation(opt.id)
												}}
												className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-medium transition-colors ${
													resolvedCustomAggregation === opt.id
														? 'border-brand bg-brand/15 text-brand'
														: 'border-pro-cards-border text-pro-text-tertiary hover:border-brand/50'
												}`}
											>
												{opt.label}
											</button>
										</Tooltip>
									))}
								</div>
							</div>
						</div>

						{customExpression ? (
							<div
								className={`rounded-md border p-2 text-xs ${
									expressionValidation.isValid ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'
								}`}
							>
								<div className="flex items-center justify-between">
									<span className="text-pro-text-secondary">Result:</span>
									{preview !== null ? (
										<span className="font-mono font-semibold text-success">{preview}</span>
									) : (
										<span className="text-error">{expressionValidation.error || 'Invalid'}</span>
									)}
								</div>
								{usedVariables.length > 0 ? (
									<div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-success/20 pt-1">
										{usedVariables.map((v) => (
											<span key={v.key} className="text-[10px] text-pro-text-tertiary">
												<code>{v.key}</code>={v.formatted}
											</span>
										))}
									</div>
								) : null}
							</div>
						) : null}

						<button
							type="button"
							onClick={handleAddOrUpdateCustomColumn}
							disabled={!validation.isValid}
							className="w-full rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-on-brand transition-colors hover:bg-brand-muted disabled:cursor-not-allowed disabled:opacity-50"
						>
							{editingId ? 'Update Column' : 'Add Custom Column'}
						</button>
					</div>
				) : null}

				{(customColumns?.length ?? 0) > 0 ? (
					<div className="mt-3 space-y-1.5 border-t border-pro-cards-border pt-3">
						{customColumns?.map((col) => (
							<div
								key={col.id}
								className={`flex items-center justify-between rounded-md border p-2 ${editingId === col.id ? 'border-brand bg-brand/5' : 'border-pro-cards-border'}`}
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span className="truncate text-xs font-medium text-pro-text-primary">{col.name}</span>
										<span className="rounded-sm border border-pro-cards-border bg-pro-cards-bg px-1 py-0.5 text-[9px] uppercase">
											{col.format}
										</span>
										<span className="rounded-sm border border-pro-cards-border bg-pro-cards-bg px-1 py-0.5 text-[9px] text-pro-text-tertiary">
											{AGGREGATION_OPTIONS.find((a) => a.id === col.aggregation)?.label}
										</span>
									</div>
									<code className="block truncate text-[10px] text-pro-text-tertiary">{col.expression}</code>
								</div>
								<div className="ml-2 flex shrink-0 items-center gap-1">
									<button
										type="button"
										onClick={() => handleEditCustomColumn(col)}
										className="rounded-sm p-1 text-pro-text-tertiary hover:text-brand"
									>
										<Icon name="pencil" height={12} width={12} />
									</button>
									<button
										type="button"
										onClick={() => onRemoveCustomColumn?.(col.id)}
										className="rounded-sm p-1 text-pro-text-tertiary hover:bg-error/10 hover:text-error"
									>
										<Icon name="trash-2" height={12} width={12} />
									</button>
								</div>
							</div>
						))}
					</div>
				) : null}
			</section>

			{shouldRenderSubscribeModal ? (
				<Suspense fallback={<></>}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</div>
	)
}

function SortableChip({
	id,
	label,
	isFirst,
	onRemove,
	isCustom
}: {
	id: string
	label: string
	isFirst: boolean
	onRemove: () => void
	isCustom?: boolean
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
	const style: React.CSSProperties = {
		transform: transform ? CSS.Transform.toString(transform) : undefined,
		transition,
		opacity: isDragging ? 0.5 : 1
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`group flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
				isFirst
					? 'border-brand/50 bg-brand/10'
					: isCustom
						? 'border-purple-500/30 bg-purple-500/5'
						: 'border-pro-cards-border'
			}`}
		>
			<span
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none text-pro-text-tertiary hover:text-pro-text-secondary active:cursor-grabbing"
			>
				<Icon name="menu" width={10} height={10} />
			</span>
			<span className="max-w-[80px] truncate font-medium text-pro-text-primary" title={label}>
				{label}
			</span>
			{isFirst ? <Icon name="pin" width={8} height={8} className="text-brand" /> : null}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onRemove()
				}}
				className="rounded-sm text-pro-text-tertiary transition-colors hover:text-error"
			>
				<Icon name="x" width={10} height={10} />
			</button>
		</div>
	)
}

function SortingSection({
	currentSortColumn,
	isDescending,
	selectableColumns,
	onColumnChange,
	onDirectionChange,
	onReset
}: {
	currentSortColumn: string
	isDescending: boolean
	selectableColumns: Array<ColumnMeta>
	onColumnChange: (value: string) => void
	onDirectionChange: (desc: boolean) => void
	onReset?: (() => void) | undefined
}) {
	const popover = usePopoverStore({ placement: 'bottom-start' })

	const selectedLabel = useMemo(() => {
		if (!currentSortColumn) return 'No sorting'
		const selected = selectableColumns.find((col) => col.id === currentSortColumn)
		return selected?.header || currentSortColumn
	}, [currentSortColumn, selectableColumns])

	return (
		<section className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-3">
			<h4 className="mb-2 text-xs font-semibold text-pro-text-primary uppercase">Sorting</h4>
			<div className="flex flex-wrap items-center gap-2">
				<div className="min-w-[140px] flex-1">
					<PopoverDisclosure
						store={popover}
						className="flex w-full items-center justify-between rounded-md border border-pro-cards-border px-2 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					>
						<span className={`truncate ${currentSortColumn ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}`}>
							{selectedLabel}
						</span>
						<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
					</PopoverDisclosure>
					<Popover
						store={popover}
						modal={false}
						portal
						flip={false}
						gutter={4}
						className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-lg"
						style={{ width: 'var(--popover-anchor-width)' }}
					>
						<div className="max-h-[280px] overflow-y-auto p-1">
							<button
								type="button"
								onClick={() => {
									onColumnChange('')
									popover.setOpen(false)
								}}
								className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
									!currentSortColumn ? 'bg-brand/10 font-semibold text-brand' : 'text-pro-text-secondary'
								}`}
							>
								<span>No sorting</span>
								{!currentSortColumn ? (
									<Icon name="check" width={12} height={12} className="ml-2 shrink-0 text-brand" />
								) : null}
							</button>
							{selectableColumns.map((col) => {
								const isActive = col.id === currentSortColumn
								return (
									<button
										key={col.id}
										type="button"
										onClick={() => {
											onColumnChange(col.id)
											popover.setOpen(false)
										}}
										className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
											isActive ? 'bg-brand/10 font-semibold text-brand' : 'text-pro-text-secondary'
										}`}
									>
										<span className="truncate">{col.header}</span>
										{isActive ? (
											<Icon name="check" width={12} height={12} className="ml-2 shrink-0 text-brand" />
										) : null}
									</button>
								)
							})}
						</div>
					</Popover>
				</div>
				<div className="flex overflow-hidden rounded-md border border-pro-cards-border">
					<button
						type="button"
						onClick={() => onDirectionChange(false)}
						disabled={!currentSortColumn}
						className={`px-2 py-1 text-[10px] font-medium transition ${
							!currentSortColumn
								? 'cursor-not-allowed text-pro-text-tertiary'
								: !isDescending
									? 'bg-brand text-on-brand'
									: 'text-pro-text-secondary'
						}`}
					>
						Asc
					</button>
					<button
						type="button"
						onClick={() => onDirectionChange(true)}
						disabled={!currentSortColumn}
						className={`border-l border-pro-cards-border px-2 py-1 text-[10px] font-medium transition ${
							!currentSortColumn
								? 'cursor-not-allowed text-pro-text-tertiary'
								: isDescending
									? 'bg-brand text-on-brand'
									: 'text-pro-text-secondary'
						}`}
					>
						Desc
					</button>
				</div>
				{onReset ? (
					<button type="button" onClick={onReset} className="text-[10px] text-brand hover:underline">
						Reset
					</button>
				) : null}
			</div>
		</section>
	)
}
