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
import type { ColumnOrderState, ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
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
import type { MetricGroup } from '~/containers/ProDashboard/unifiedTable/config/columnDictionary'
import {
	COLUMN_DICTIONARY_BY_ID,
	UNIFIED_TABLE_COLUMN_DICTIONARY
} from '~/containers/ProDashboard/unifiedTable/config/columnDictionary'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '~/containers/ProDashboard/unifiedTable/config/types'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { codeInputStyles, Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { type CustomColumnDraft, EMPTY_CUSTOM_COLUMN_DRAFT } from '../hooks/useUnifiedTableWizard'

const AVAILABLE_VARIABLES = getAvailableVariables()
const AVAILABLE_VARIABLES_BY_KEY = new Map(AVAILABLE_VARIABLES.map((variable) => [variable.key, variable]))
const SAMPLE_METRICS_BY_KEY = new Map(Object.entries(SAMPLE_METRICS))

interface ColumnManagerProps {
	rowHeaders: ReadonlyArray<UnifiedRowHeaderType>
	columnOrder: ColumnOrderState
	columnVisibility: ColumnVisibilityState
	onChange: (columnOrder: ColumnOrderState, columnVisibility: ColumnVisibilityState) => void
	customColumns: Array<CustomColumnDefinition>
	onAddCustomColumn: (column: CustomColumnDefinition) => void
	onUpdateCustomColumn: (id: string, updates: Partial<CustomColumnDefinition>) => void
	onRemoveCustomColumn: (id: string) => void
	customColumnDraft: CustomColumnDraft
	onCustomColumnDraftChange: (draft: CustomColumnDraft) => void
	sorting: SortingState
	onSortingChange: (sorting: SortingState) => void
	onSortingReset: () => void
}

type ColumnGroupId = MetricGroup | 'meta' | 'custom'
type ColumnFormat = CustomColumnDefinition['format']
type ColumnAggregation = CustomColumnDefinition['aggregation']

interface ColumnMeta {
	id: string
	header: string
	group: ColumnGroupId
}

const GROUP_FILTERS: Array<SegmentedControlOption<ColumnGroupId | 'all'>> = [
	{ value: 'all', label: 'All' },
	{ value: 'meta', label: 'Meta' },
	{ value: 'tvl', label: 'TVL' },
	{ value: 'fees', label: 'Fees' },
	{ value: 'volume', label: 'Volume' },
	{ value: 'revenue', label: 'Revenue' },
	{ value: 'ratios', label: 'Valuation' },
	{ value: 'perps', label: 'Perps' },
	{ value: 'custom', label: 'Custom' }
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

const FORMAT_OPTIONS: Array<SegmentedControlOption<ColumnFormat>> = [
	{ value: 'usd', label: '$', ariaLabel: 'Currency', tooltip: 'Currency' },
	{ value: 'percent', label: '%', ariaLabel: 'Percent', tooltip: 'Percent' },
	{ value: 'ratio', label: 'x', ariaLabel: 'Ratio', tooltip: 'Ratio' },
	{ value: 'number', label: '#', ariaLabel: 'Number', tooltip: 'Number' }
]

const AGGREGATION_OPTIONS: Array<SegmentedControlOption<ColumnAggregation>> = [
	{ value: 'recalculate', label: 'Recalc', tooltip: 'Re-evaluate expression on aggregated metrics (best for ratios)' },
	{ value: 'sum', label: 'Sum', tooltip: 'Sum individual row values (best for totals like 24h run-rate fees)' },
	{ value: 'first', label: 'First', tooltip: 'Use first row value only' },
	{ value: 'none', label: 'None', tooltip: 'Show dash (-) for grouped rows' }
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

const AUTOCOMPLETE_SUGGESTIONS: Array<AutocompleteSuggestion> = [
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

const NAME_COLUMN: ColumnMeta = { id: 'name', header: 'Name', group: 'meta' }

const getColumnMeta = (id: string, customColumns: Array<CustomColumnDefinition>): ColumnMeta | null => {
	if (id === 'name') return NAME_COLUMN
	if (id.startsWith('custom_')) {
		const customCol = customColumns.find((c) => c.id === id)
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
	customColumns: Array<CustomColumnDefinition>
): Array<ColumnMeta> => {
	const dictionaryMetas = UNIFIED_TABLE_COLUMN_DICTIONARY.filter((column) => isColumnSupported(column.id, rowHeaders))
		.map(({ id }) => getColumnMeta(id, []))
		.filter((meta): meta is ColumnMeta => Boolean(meta))

	const customMetas: Array<ColumnMeta> = customColumns.map((col) => ({
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
	customColumnDraft: draft,
	onCustomColumnDraftChange: setDraft,
	sorting,
	onSortingChange,
	onSortingReset
}: ColumnManagerProps) {
	const { hasActiveSubscription } = useAuthContext()
	const subscribeModalStore = Ariakit.useDialogStore()
	const fieldId = useId()
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

	const { name: customName, expression: customExpression, format: customFormat, id: editingId } = draft

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

	const setCustomExpression = (expression: string) => setDraft({ ...draft, expression })

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
		const nextVisibility: ColumnVisibilityState = { name: true }
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

	const filteredSuggestions = useMemo(() => {
		if (!autocompleteFilter.trim()) return AUTOCOMPLETE_SUGGESTIONS.slice(0, 15)
		const filter = autocompleteFilter.toLowerCase()
		return AUTOCOMPLETE_SUGGESTIONS.filter(
			(s) => s.display.toLowerCase().includes(filter) || s.description.toLowerCase().includes(filter)
		).slice(0, 10)
	}, [autocompleteFilter])

	const expressionValidation = useMemo(() => {
		if (!customExpression.trim()) return { isValid: false, error: 'Expression is required' }
		return validateExpression(customExpression)
	}, [customExpression])

	const nameError = !customName.trim()
		? 'Name is required'
		: customColumns.some((col) => col.name.toLowerCase() === customName.toLowerCase() && col.id !== editingId)
			? 'Column name already exists'
			: null
	const canSaveCustomColumn = nameError === null && expressionValidation.isValid

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
		draft.aggregation ??
		(customExpression && expressionValidation.isValid ? getDefaultAggregation(customExpression) : 'recalculate')

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
		if (!canSaveCustomColumn) return
		const column: CustomColumnDefinition = {
			id: editingId ?? generateCustomColumnId(),
			name: customName.trim(),
			expression: customExpression.trim(),
			format: customFormat,
			aggregation: resolvedCustomAggregation
		}
		if (editingId) {
			onUpdateCustomColumn(editingId, {
				name: column.name,
				expression: column.expression,
				format: column.format,
				aggregation: column.aggregation
			})
		} else {
			onAddCustomColumn(column)
		}
		setDraft(EMPTY_CUSTOM_COLUMN_DRAFT)
		setCustomColumnExpanded(false)
	}

	const showUpgrade = () => {
		setSignupSource('pro-dashboard')
		subscribeModalStore.show()
	}

	const handleApplyPreset = (preset: { name: string; expression: string; format: ColumnFormat }) => {
		// A preset opens the custom column form, which is a Pro feature like the form's own toggle.
		if (!hasActiveSubscription) return showUpgrade()
		setDraft({ id: null, name: preset.name, expression: preset.expression, format: preset.format, aggregation: null })
		setCustomColumnExpanded(true)
	}

	const handleEditCustomColumn = (col: CustomColumnDefinition) => {
		setDraft({
			id: col.id,
			name: col.name,
			expression: col.expression,
			format: col.format,
			aggregation: col.aggregation
		})
		setCustomColumnExpanded(true)
	}

	const handleCancelEdit = () => setDraft(EMPTY_CUSTOM_COLUMN_DRAFT)

	useEffect(() => {
		const handleClickOutside = () => setAutocompleteState((prev) => ({ ...prev, showAutocomplete: false }))
		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [])

	const activeColumn = activeId ? getColumnMeta(String(activeId), customColumns) : null

	const currentSorting = sorting[0]
	const currentSortColumn = currentSorting?.id ?? ''
	const isDescending = currentSorting?.desc ?? true

	const selectableColumnsForSort = useMemo(() => {
		return columnOrder
			.filter((id) => columnVisibility[id] ?? true)
			.map((id) => getColumnMeta(id, customColumns))
			.filter((meta): meta is ColumnMeta => Boolean(meta))
	}, [columnOrder, columnVisibility, customColumns])

	const handleSortColumnChange = (value: string) => {
		if (!value) {
			onSortingChange([])
			return
		}
		const nextDesc = currentSortColumn === value ? isDescending : true
		onSortingChange([{ id: value, desc: nextDesc }])
	}

	const handleSortDirectionChange = (desc: boolean) => {
		if (!currentSortColumn) return
		onSortingChange([{ id: currentSortColumn, desc }])
	}

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-lg border border-subtle bg-surface p-3">
				<div className="mb-2 flex items-center justify-between label-sm">
					<div className="flex items-center gap-2">
						<h4 className="title-sm text-primary">Selected</h4>
						<span className="rounded-sm bg-brand-tint px-1.5 py-0.5 text-link">{selectedColumns.length}</span>
					</div>
					{selectedColumns.length > 0 ? (
						<Button variant="link" onClick={handleClearAll}>
							Clear all
						</Button>
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
							<div className="flex h-12 items-center justify-center rounded-md border border-dashed border-medium body-sm text-tertiary">
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
							<div className="rounded-md border border-brand bg-brand-tint-strong px-2 py-1 label-sm text-link shadow-lg">
								{activeColumn.header}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>

				<p className="mt-2 body-sm text-tertiary">Drag to reorder. First column pinned left.</p>
			</section>

			<SortingSection
				currentSortColumn={currentSortColumn}
				isDescending={isDescending}
				selectableColumns={selectableColumnsForSort}
				onColumnChange={handleSortColumnChange}
				onDirectionChange={handleSortDirectionChange}
				onReset={onSortingReset}
			/>

			<section className="flex flex-col rounded-lg border border-subtle bg-surface">
				<div className="border-b border-subtle p-2">
					<SegmentedControl
						label="Column group"
						variant="chips"
						size="sm"
						value={groupFilter}
						onValueChange={setGroupFilter}
						options={GROUP_FILTERS}
					/>
				</div>

				<div className="border-b border-subtle p-2">
					<div className="relative">
						<Icon name="search" width={16} height={16} className={searchFieldIconStyles} />
						<Input
							onInput={(e) => setSearch(e.currentTarget.value)}
							aria-label="Search columns"
							placeholder="Search columns…"
							className={searchFieldInputPlacementStyles}
						/>
					</div>
				</div>

				<div className="max-h-[240px] overflow-y-auto p-2">
					{filteredColumns.length === 0 ? (
						<p className="flex h-16 items-center justify-center body-sm text-tertiary">No columns match</p>
					) : (
						<div className="flex flex-col gap-1">
							{filteredColumns.map((column) => {
								const isSelected = selectedColumnsSet.has(column.id)
								return (
									<button
										key={column.id}
										type="button"
										aria-pressed={isSelected}
										onClick={() => handleToggleColumn(column.id)}
										className={`group flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all ${
											isSelected ? 'border-brand-muted bg-brand-faint' : 'border-transparent hover:border-medium'
										}`}
									>
										<div
											className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
												isSelected
													? 'border-brand bg-brand text-on-brand'
													: 'border-medium group-hover:border-brand-strong'
											}`}
										>
											{isSelected ? <Icon name="check" width={8} height={8} /> : null}
										</div>
										<span className={`flex-1 truncate label-sm ${isSelected ? 'text-primary' : 'text-secondary'}`}>
											{column.header}
										</span>
										<span className="rounded-sm px-1 py-0.5 label-xs text-tertiary uppercase">
											{GROUP_LABELS[column.group]}
										</span>
									</button>
								)
							})}
						</div>
					)}
				</div>
			</section>

			<section className="rounded-lg border border-subtle bg-surface p-3">
				<button
					type="button"
					onClick={() => {
						if (!hasActiveSubscription) return showUpgrade()
						// Like a new column's draft, an edit survives folding the form and leaving the section; Cancel drops it.
						setCustomColumnExpanded(!customColumnExpanded)
					}}
					aria-expanded={hasActiveSubscription ? customColumnExpanded : undefined}
					className="flex w-full items-center justify-between"
				>
					<div className="flex items-center gap-2">
						<Icon
							name={!hasActiveSubscription ? 'file-lock-2' : customColumnExpanded ? 'minus' : 'plus'}
							width={14}
							height={14}
							className="text-link"
						/>
						<span className="title-sm text-primary">
							{editingId ? 'Edit custom column' : 'Custom column'}
							{!hasActiveSubscription ? <span className="ml-1 body-sm text-tertiary">(Pro)</span> : null}
						</span>
						{customColumns.length > 0 ? (
							<span className="rounded-sm bg-pro-ai-tint px-1.5 py-0.5 label-sm text-pro-ai-text">
								{customColumns.length}
							</span>
						) : null}
					</div>
					<Icon
						name="chevron-down"
						width={14}
						height={14}
						className={`text-tertiary transition-transform ${customColumnExpanded ? 'rotate-180' : ''}`}
					/>
				</button>

				<div className="mt-2 flex flex-wrap gap-1.5">
					{EXAMPLE_PRESETS.map((preset) => (
						<Button key={preset.name} size="sm" onClick={() => handleApplyPreset(preset)}>
							{preset.name}
						</Button>
					))}
				</div>

				{customColumnExpanded ? (
					<div className="mt-3 space-y-3 border-t border-subtle pt-3">
						{editingId ? (
							<div className="flex items-center justify-between body-sm">
								<span className="text-secondary">Editing: {customName || 'Custom column'}</span>
								<Button variant="link" onClick={handleCancelEdit}>
									Cancel
								</Button>
							</div>
						) : null}

						<div className="flex flex-col gap-1">
							<label className="flex flex-col gap-1 label-sm text-secondary">
								Column name
								<Input
									type="text"
									value={customName}
									onChange={(e) => setDraft({ ...draft, name: e.target.value })}
									placeholder="e.g., TVL to market cap"
									aria-invalid={customName.trim() !== '' && nameError !== null}
									aria-describedby={nameError && (customName || customExpression) ? `${fieldId}-name-error` : undefined}
								/>
							</label>
							{/* The save button stays disabled until the name is valid; say why once the reader has typed something. */}
							{nameError && (customName || customExpression) ? (
								<p id={`${fieldId}-name-error`} className="body-sm text-error">
									{nameError}
								</p>
							) : null}
						</div>

						<div className="flex flex-col gap-1">
							<label htmlFor={`${fieldId}-expression`} className="label-sm text-secondary">
								Expression
							</label>
							<div className="relative" role="presentation" onClick={(e) => e.stopPropagation()}>
								<input
									id={`${fieldId}-expression`}
									ref={expressionInputRef}
									type="text"
									value={customExpression}
									onChange={handleExpressionChange}
									onKeyDown={handleExpressionKeyDown}
									onFocus={() => customExpression && setShowAutocomplete(true)}
									placeholder="e.g., tvl / mcap, fees24h * 365"
									aria-invalid={Boolean(customExpression) && !expressionValidation.isValid}
									className={`${codeInputStyles} w-full pr-8`}
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
									<div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto overscroll-contain rounded-md border border-medium bg-overlay shadow-lg">
										{filteredSuggestions.map((suggestion, index) => (
											<button
												key={`${suggestion.type}-${suggestion.value}`}
												type="button"
												onClick={() => insertSuggestion(suggestion)}
												onMouseEnter={() => setAutocompleteIndex(index)}
												className={`flex cursor-pointer items-center gap-2 px-2 py-1 label-sm ${
													index === autocompleteIndex ? 'bg-brand text-on-brand' : 'text-primary'
												}`}
											>
												<span
													className={`size-1.5 shrink-0 rounded-full ${
														suggestion.type === 'variable'
															? 'bg-brand'
															: suggestion.type === 'function'
																? 'bg-pro-ai'
																: 'bg-border-strong'
													}`}
												/>
												<code className="shrink-0">{suggestion.display}</code>
												<span className="ml-auto truncate text-tertiary">{suggestion.description}</span>
											</button>
										))}
									</div>
								) : null}
							</div>
						</div>
						<p className="body-xs text-tertiary">Ctrl+Space to show all · ↑↓ navigate · Enter select</p>

						{/* Each field keeps 14rem, so on a phone they stack instead of squeezing four segments each. */}
						<div className="flex flex-wrap gap-2">
							<div className="min-w-56 flex-1">
								<p id={`${fieldId}-format`} className="mb-1 label-sm text-secondary">
									Format
								</p>
								<SegmentedControl
									aria-labelledby={`${fieldId}-format`}
									label="Format"
									variant="field"
									size="md"
									value={customFormat}
									onValueChange={(format) => setDraft({ ...draft, format })}
									options={FORMAT_OPTIONS}
								/>
							</div>
							<div className="min-w-56 flex-1">
								<p id={`${fieldId}-aggregation`} className="mb-1 label-sm text-secondary">
									Aggregation
								</p>
								<SegmentedControl
									aria-labelledby={`${fieldId}-aggregation`}
									label="Aggregation"
									variant="field"
									size="md"
									value={resolvedCustomAggregation}
									onValueChange={(aggregation) => setDraft({ ...draft, aggregation })}
									options={AGGREGATION_OPTIONS}
								/>
							</div>
						</div>

						{customExpression ? (
							<div
								className={`rounded-md border p-2 body-sm ${
									expressionValidation.isValid
										? 'border-success-muted bg-success-faint'
										: 'border-error-muted bg-error-faint'
								}`}
							>
								<div className="flex items-center justify-between">
									<span className="text-secondary">Result:</span>
									{preview !== null ? (
										<span className="font-mono font-bold text-success">{preview}</span>
									) : (
										<span className="text-error">{expressionValidation.error || 'Invalid'}</span>
									)}
								</div>
								{usedVariables.length > 0 ? (
									<div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-success-muted pt-1">
										{usedVariables.map((v) => (
											<span key={v.key} className="body-sm text-tertiary">
												<code>{v.key}</code>={v.formatted}
											</span>
										))}
									</div>
								) : null}
							</div>
						) : null}

						<Button
							variant="primary"
							size="md"
							onClick={handleAddOrUpdateCustomColumn}
							disabled={!canSaveCustomColumn}
							className="w-full"
						>
							{editingId ? 'Update column' : 'Add custom column'}
						</Button>
					</div>
				) : null}

				{customColumns.length > 0 ? (
					<div className="mt-3 space-y-1.5 border-t border-subtle pt-3">
						{customColumns.map((col) => (
							<div
								key={col.id}
								className={`flex items-center justify-between rounded-md border p-2 ${editingId === col.id ? 'border-brand bg-brand-faint' : 'border-subtle'}`}
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span className="truncate label-sm text-primary">{col.name}</span>
										<span className="rounded-sm border border-medium bg-surface px-1 py-0.5 label-xs uppercase">
											{col.format}
										</span>
										<span className="rounded-sm border border-medium bg-surface px-1 py-0.5 label-xs text-tertiary">
											{AGGREGATION_OPTIONS.find((a) => a.value === col.aggregation)?.label}
										</span>
									</div>
									<code className="block truncate body-sm text-tertiary">{col.expression}</code>
								</div>
								<div className="ml-2 flex shrink-0 items-center gap-1">
									<Tooltip
										content={`Edit ${col.name}`}
										render={
											<Button
												variant="ghost"
												size="sm"
												square
												onClick={() => handleEditCustomColumn(col)}
												aria-label={`Edit ${col.name}`}
											/>
										}
									>
										<Icon name="pencil" className="size-4" />
									</Tooltip>
									<Tooltip
										content={`Delete ${col.name}`}
										render={
											<Button
												variant="ghostDestructive"
												size="sm"
												square
												onClick={() => onRemoveCustomColumn(col.id)}
												aria-label={`Delete ${col.name}`}
											/>
										}
									>
										<Icon name="trash-2" className="size-4" />
									</Tooltip>
								</div>
							</div>
						))}
					</div>
				) : null}
			</section>

			<LazySubscribeProModal dialogStore={subscribeModalStore} />
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
			className={`group flex items-center gap-1 rounded-md border px-1.5 py-0.5 body-sm transition-colors ${
				isFirst ? 'border-brand-strong bg-brand-tint' : isCustom ? 'border-medium bg-pro-ai-tint' : 'border-medium'
			}`}
		>
			<span
				{...attributes}
				{...listeners}
				aria-label={`Move ${label}`}
				className="cursor-grab touch-none text-tertiary hover:text-secondary active:cursor-grabbing"
			>
				<Icon name="menu" width={10} height={10} />
			</span>
			<span className="max-w-[80px] truncate font-medium text-primary" title={label}>
				{label}
			</span>
			{isFirst ? <Icon name="pin" width={8} height={8} className="text-link" /> : null}
			<Tooltip
				content={`Hide ${label}`}
				render={
					<Button
						variant="ghost"
						size="sm"
						square
						onClick={(e) => {
							e.stopPropagation()
							onRemove()
						}}
						aria-label={`Hide ${label}`}
					/>
				}
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
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
	onReset: () => void
}) {
	const popover = usePopoverStore({ placement: 'bottom-start' })

	const selectedLabel = useMemo(() => {
		if (!currentSortColumn) return 'No sorting'
		const selected = selectableColumns.find((col) => col.id === currentSortColumn)
		return selected?.header || currentSortColumn
	}, [currentSortColumn, selectableColumns])

	return (
		<section className="rounded-lg border border-subtle bg-surface p-3">
			<h4 className="mb-2 title-sm text-primary">Sorting</h4>
			<div className="flex flex-wrap items-center gap-2 body-sm">
				<div className="min-w-[140px] flex-1">
					<PopoverDisclosure
						store={popover}
						className="flex w-full items-center justify-between rounded-md border border-medium px-2 py-1.5 body-sm transition-colors hover:border-brand-muted focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					>
						<span className={`truncate ${currentSortColumn ? 'text-primary' : 'text-tertiary'}`}>{selectedLabel}</span>
						<Icon name="chevron-down" className="ml-2 size-3.5 shrink-0 text-tertiary" />
					</PopoverDisclosure>
					<Popover
						store={popover}
						modal={false}
						portal
						flip={false}
						gutter={4}
						className="z-50 rounded-md border border-medium bg-overlay shadow-lg"
						style={{ width: 'var(--popover-anchor-width)' }}
					>
						<div className="max-h-[280px] overflow-y-auto p-1">
							<button
								type="button"
								onClick={() => {
									onColumnChange('')
									popover.setOpen(false)
								}}
								className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left label-sm transition-colors ${
									!currentSortColumn
										? 'bg-brand-muted text-link'
										: 'text-secondary hover:bg-hover-row hover:text-primary'
								}`}
							>
								<span>No sorting</span>
								{!currentSortColumn ? (
									<Icon name="check" width={12} height={12} className="ml-2 shrink-0 text-link" />
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
										className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left label-sm transition-colors ${
											isActive ? 'bg-brand-muted text-link' : 'text-secondary hover:bg-hover-row hover:text-primary'
										}`}
									>
										<span className="truncate">{col.header}</span>
										{isActive ? <Icon name="check" width={12} height={12} className="ml-2 shrink-0 text-link" /> : null}
									</button>
								)
							})}
						</div>
					</Popover>
				</div>
				<SegmentedControl
					label="Sort direction"
					variant="default"
					size="sm"
					value={currentSortColumn ? (isDescending ? 'desc' : 'asc') : null}
					onValueChange={(direction) => onDirectionChange(direction === 'desc')}
					options={[
						{ value: 'asc', label: 'Asc', disabled: !currentSortColumn },
						{ value: 'desc', label: 'Desc', disabled: !currentSortColumn }
					]}
				/>
				<Button variant="link" onClick={onReset}>
					Reset
				</Button>
			</div>
		</section>
	)
}
