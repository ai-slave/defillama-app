import * as Ariakit from '@ariakit/react'
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
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { Select } from '~/components/Select/Select'
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
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { CountBadge } from '~/ui/CountBadge'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { popoverRowStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'
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

	const [autocompleteState, setAutocompleteState] = useState({ showAutocomplete: false, autocompleteFilter: '' })
	const { showAutocomplete, autocompleteFilter } = autocompleteState

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
		if (!customExpression.trim()) return { isValid: false, error: 'Enter an expression.' }
		return validateExpression(customExpression)
	}, [customExpression])

	// Whether Add or Update was pressed on this draft. A taken name and an expression that does not parse show as
	// they are typed; an empty field waits for the press.
	const [customColumnSubmitted, setCustomColumnSubmitted] = useState(false)
	const nameTaken = customColumns.some(
		(col) => col.name.toLowerCase() === customName.toLowerCase() && col.id !== editingId
	)
	const nameError = !customName.trim()
		? 'Enter a column name.'
		: nameTaken
			? 'Another column already has this name.'
			: null
	const shownNameError = customColumnSubmitted || nameTaken ? nameError : null
	const shownExpressionError =
		customColumnSubmitted || customExpression.trim() ? (expressionValidation.error ?? null) : null

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

	const insertSuggestion = (suggestion: string) => {
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

		const newValue = value.slice(0, wordStart) + suggestion + value.slice(end)
		setCustomExpression(newValue)

		setTimeout(() => {
			const newPosition = wordStart + suggestion.length
			input.setSelectionRange(newPosition, newPosition)
			input.focus()
		}, 0)

		setShowAutocomplete(false)
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
		} else {
			setShowAutocomplete(false)
			setAutocompleteFilter('')
		}
	}

	// The combobox moves the highlighted suggestion with the arrows and inserts it on Enter; Tab inserts it too.
	const autocompleteOpen = showAutocomplete && filteredSuggestions.length > 0
	const autocomplete = Ariakit.useComboboxStore({
		inputValue: customExpression,
		open: autocompleteOpen,
		setOpen(open) {
			if (!open) setShowAutocomplete(false)
		}
	})

	const handleExpressionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!autocompleteOpen) {
			if (e.ctrlKey && e.code === 'Space') {
				e.preventDefault()
				setShowAutocomplete(true)
				setAutocompleteFilter('')
			}
			return
		}
		switch (e.key) {
			case 'Tab': {
				const highlighted = autocomplete.item(autocomplete.getState().activeId)?.value
				if (!highlighted) break
				e.preventDefault()
				insertSuggestion(highlighted)
				break
			}
			case 'Escape':
				e.preventDefault()
				// Dismiss the suggestions only; the enclosing Ariakit dialog stays open.
				e.stopPropagation()
				setShowAutocomplete(false)
				break
		}
	}

	const handleAddOrUpdateCustomColumn = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (nameError || !expressionValidation.isValid) {
			return showFieldErrors(event.currentTarget.closest('section')!, () => setCustomColumnSubmitted(true))
		}
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
		setCustomColumnSubmitted(false)
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

	const handleCancelEdit = () => {
		setDraft(EMPTY_CUSTOM_COLUMN_DRAFT)
		setCustomColumnSubmitted(false)
	}

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
			<Card as="section" padding="base">
				<div className="mb-2 flex items-center justify-between label-sm">
					<div className="flex items-center gap-2">
						<h4 className="title-sm text-primary">Selected</h4>
						<CountBadge count={selectedColumns.length} />
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
							<NoResults>No columns selected</NoResults>
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
							<div className="rounded-md border border-brand bg-brand-tint-strong px-2 py-1 label-sm text-link shadow-overlay">
								{activeColumn.header}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>

				<p className="mt-2 body-sm text-tertiary">Drag to reorder. First column pinned left.</p>
			</Card>

			<SortingSection
				currentSortColumn={currentSortColumn}
				isDescending={isDescending}
				selectableColumns={selectableColumnsForSort}
				onColumnChange={handleSortColumnChange}
				onDirectionChange={handleSortDirectionChange}
				onReset={onSortingReset}
			/>

			<Card as="section" padding="none" className="flex flex-col">
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
					<SearchField label="Search columns" value={search} onChange={setSearch} placeholder="Search columns…" />
				</div>

				<div className="max-h-[240px] overflow-y-auto p-2">
					{filteredColumns.length === 0 ? (
						<NoResults>No columns match</NoResults>
					) : (
						<div className="flex flex-col">
							{filteredColumns.map((column) => {
								const isSelected = selectedColumnsSet.has(column.id)
								return (
									<Checkbox
										key={column.id}
										variant="default"
										checked={isSelected}
										onChange={() => handleToggleColumn(column.id)}
									>
										<span className="flex-1 truncate">{column.header}</span>
										<span className="label-xs text-tertiary uppercase">{GROUP_LABELS[column.group]}</span>
									</Checkbox>
								)
							})}
						</div>
					)}
				</div>
			</Card>

			<Card as="section" padding="base">
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
							className="size-3.5 text-link"
						/>
						<span className="title-sm text-primary">
							{editingId ? 'Edit custom column' : 'Custom column'}
							{!hasActiveSubscription ? <span className="ml-1 body-sm text-tertiary">(Pro)</span> : null}
						</span>
						{customColumns.length > 0 ? <CountBadge count={customColumns.length} /> : null}
					</div>
					<Icon
						name="chevron-down"
						className={`size-3.5 text-tertiary transition-transform ${customColumnExpanded ? 'rotate-180' : ''}`}
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

						<Field label="Column name" live error={shownNameError}>
							{(control) => (
								<Input
									{...control}
									type="text"
									required
									value={customName}
									onChange={(e) => setDraft({ ...draft, name: e.target.value })}
									placeholder="e.g., TVL to market cap"
								/>
							)}
						</Field>

						<Field label="Expression" live error={shownExpressionError}>
							{(control) => (
								<div className="relative">
									<Ariakit.ComboboxProvider store={autocomplete}>
										<Ariakit.Combobox
											{...control}
											ref={expressionInputRef}
											type="text"
											required
											onChange={handleExpressionChange}
											onKeyDown={handleExpressionKeyDown}
											onFocus={() => customExpression && setShowAutocomplete(true)}
											placeholder="e.g., tvl / mcap, fees24h * 365"
											render={<Input variant="code" className="w-full pr-8" />}
										/>
										{customExpression ? (
											<div className="absolute top-1/2 right-2 -translate-y-1/2">
												{expressionValidation.isValid ? (
													<Icon name="check" className="size-3 text-success" />
												) : (
													<Icon name="x" className="size-3 text-error" />
												)}
											</div>
										) : null}
										<ComboboxSurface
											variant="search-results"
											sameWidth
											className="max-h-[min(160px,var(--popover-available-height))]"
										>
											{filteredSuggestions.map((suggestion) => (
												<Ariakit.ComboboxItem
													key={`${suggestion.type}-${suggestion.value}`}
													value={suggestion.value}
													setValueOnClick={false}
													onClick={() => insertSuggestion(suggestion.value)}
													className={popoverRowStyles}
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
												</Ariakit.ComboboxItem>
											))}
										</ComboboxSurface>
									</Ariakit.ComboboxProvider>
								</div>
							)}
						</Field>
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

						{/* The expression's error sits under its field; a valid one previews its result on sample metrics. */}
						{preview !== null ? (
							<div className="rounded-md border border-success-muted bg-success-faint p-2 body-sm">
								<div className="flex items-center justify-between">
									<span className="text-secondary">Result:</span>
									<span className="mono-sm-bold text-success">{preview}</span>
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

						<Button variant="primary" size="md" onClick={handleAddOrUpdateCustomColumn} className="w-full">
							{editingId ? 'Update column' : 'Add custom column'}
						</Button>
					</div>
				) : null}

				{customColumns.length > 0 ? (
					<div className="mt-3 space-y-1.5 border-t border-subtle pt-3">
						{customColumns.map((col) => (
							<div
								key={col.id}
								className={`flex items-center justify-between rounded-md border p-2 ${editingId === col.id ? 'border-brand bg-brand-muted' : 'border-subtle'}`}
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
			</Card>

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
				<Icon name="menu" className="size-4" />
			</span>
			<span className="max-w-[80px] truncate font-medium text-primary" title={label}>
				{label}
			</span>
			{isFirst ? <Icon name="pin" className="size-3.5 text-link" /> : null}
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

// Select options need a key; the empty sort column is this one.
const NO_SORT_KEY = '__no-sort__'

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
	const selectedLabel = useMemo(() => {
		if (!currentSortColumn) return 'No sorting'
		const selected = selectableColumns.find((col) => col.id === currentSortColumn)
		return selected?.header || currentSortColumn
	}, [currentSortColumn, selectableColumns])

	return (
		<Card as="section" padding="base">
			<h4 className="mb-2 title-sm text-primary">Sorting</h4>
			<div className="flex flex-wrap items-center gap-2 body-sm">
				<Select
					allValues={[
						{ key: NO_SORT_KEY, name: 'No sorting' },
						...selectableColumns.map((col) => ({ key: col.id, name: col.header }))
					]}
					selectedValues={currentSortColumn || NO_SORT_KEY}
					setSelectedValues={(value) => onColumnChange(value === NO_SORT_KEY ? '' : value)}
					label={selectedLabel}
					labelType="none"
					heading="Sort column"
					triggerProps={{ 'aria-label': 'Sort column' }}
					variant="input"
					size="md"
					className="min-w-[140px] flex-1"
				/>
				<SegmentedControl
					label="Sort direction"
					variant="default"
					size="md"
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
		</Card>
	)
}
