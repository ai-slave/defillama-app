import { useMemo, useRef, useState } from 'react'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { keepFocus, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListRow } from '~/ui/ListRow'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SearchField } from '~/ui/SearchField'
import { Select } from '~/ui/Select'
import { EmptyState } from '~/ui/Status'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import {
	FILTER_CATEGORIES,
	FILTER_CONFIGS,
	formatFilterValue,
	getFiltersByCategory,
	getFiltersForProtocols,
	type FilterCategory,
	type BooleanFilterConfig,
	type FilterConfig,
	type NumericOperator,
	type NumericRangeFilterConfig,
	type NumericSingleFilterConfig
} from './filterConfig'

interface FilterBuilderProps {
	filters: UnifiedTableFilters | undefined
	onFiltersChange: (filters: UnifiedTableFilters) => void
}

// A filter as the editor holds it. A range keeps only the bounds its operator saves: >= a minimum, <= a maximum,
// between both.
type RangeFilter = {
	type: 'numeric-range'
	config: NumericRangeFilterConfig
	operator: NumericOperator
	min: number | undefined
	max: number | undefined
}
type ActiveFilter =
	| { type: 'boolean'; config: BooleanFilterConfig }
	| { type: 'numeric-single'; config: NumericSingleFilterConfig; value: number | undefined }
	| RangeFilter

// A saved filter stores only a minimum and a maximum, so strict > and < would come back as >= and <=.
const OPERATOR_OPTIONS: Array<{ key: NumericOperator; name: string }> = [
	{ key: '>=', name: '>=' },
	{ key: '<=', name: '<=' },
	{ key: 'between', name: 'between' }
]

function parseNumberWithAbbreviation(input: string): number | undefined {
	const cleaned = input.trim().toLowerCase()
	if (!cleaned) return undefined
	const match = cleaned.match(/^(-?\d+\.?\d*)\s*([kmb])?$/)
	if (!match) return undefined

	const numStr = match[1]
	const suffix = match[2]
	if (numStr === undefined) return undefined
	const base = parseFloat(numStr)
	if (Number.isNaN(base)) return undefined
	if (suffix === 'k') return base * 1000
	if (suffix === 'm') return base * 1_000_000
	if (suffix === 'b') return base * 1_000_000_000
	return base
}

function filterHasValue(filter: ActiveFilter) {
	if (filter.type === 'boolean') return true
	if (filter.type === 'numeric-single') return filter.value !== undefined
	return filter.min !== undefined || filter.max !== undefined
}

function filtersToActiveFilters(filters: UnifiedTableFilters | undefined): Array<ActiveFilter> {
	if (!filters) return []

	const result: Array<ActiveFilter> = []
	for (const config of getFiltersForProtocols()) {
		if (config.type === 'boolean') {
			if (filters[config.booleanKey]) result.push({ type: 'boolean', config })
		} else if (config.type === 'numeric-single') {
			const value = filters[config.minKey]
			if (value !== undefined) result.push({ type: 'numeric-single', config, value })
		} else {
			const min = filters[config.minKey]
			const max = filters[config.maxKey]
			if (min === undefined && max === undefined) continue
			const operator = min !== undefined && max !== undefined ? 'between' : max !== undefined ? '<=' : '>='
			result.push({ type: 'numeric-range', config, operator, min, max })
		}
	}
	return result
}

function activeFilterToTableFilters(
	activeFilters: Array<ActiveFilter>,
	existingFilters: UnifiedTableFilters | undefined
): UnifiedTableFilters {
	const result: UnifiedTableFilters = { ...existingFilters }

	for (const config of FILTER_CONFIGS) {
		if (config.type === 'boolean') {
			delete result[config.booleanKey]
		} else if (config.type === 'numeric-range') {
			delete result[config.minKey]
			delete result[config.maxKey]
		} else if (config.type === 'numeric-single') {
			delete result[config.minKey]
		}
	}

	for (const filter of activeFilters) {
		if (filter.type === 'boolean') {
			result[filter.config.booleanKey] = true
		} else if (filter.type === 'numeric-single') {
			if (filter.value !== undefined) result[filter.config.minKey] = filter.value
		} else {
			if (filter.min !== undefined) result[filter.config.minKey] = filter.min
			if (filter.max !== undefined) result[filter.config.maxKey] = filter.max
		}
	}

	return result
}

const CATEGORY_LABELS: Record<FilterCategory, string> = {
	metrics: 'Metrics',
	volume: 'Volume',
	fees: 'Fees',
	revenue: 'Revenue',
	changes: 'Changes',
	dominance: 'Dominance',
	aggregators: 'Aggregators',
	'chain-metrics': 'Chain metrics',
	flags: 'Data availability'
}

const FILTERS_BY_CATEGORY = getFiltersByCategory()
const EMPTY_CATEGORY_FILTERS: Array<FilterConfig> = []
let TOTAL_FILTERS_AVAILABLE = 0
for (const categoryFilters of FILTERS_BY_CATEGORY.values()) TOTAL_FILTERS_AVAILABLE += categoryFilters.length

function buildDisplayValue(filter: ActiveFilter): string {
	if (filter.type === 'boolean') return 'Enabled'
	const format = filter.config.format || 'currency'
	if (filter.type === 'numeric-single') {
		return filter.value === undefined ? 'Not set' : `= ${formatFilterValue(filter.value, format)}`
	}
	const { min, max } = filter
	if (min !== undefined && max !== undefined)
		return `${formatFilterValue(min, format)} - ${formatFilterValue(max, format)}`
	if (min !== undefined) return `>= ${formatFilterValue(min, format)}`
	if (max !== undefined) return `<= ${formatFilterValue(max, format)}`
	return 'Not set'
}

// The text each field starts from: the single value is the range's bound for its operator.
function getInitialInputs(filter: ActiveFilter) {
	if (filter.type === 'boolean') return { value: '', minValue: '', maxValue: '' }
	if (filter.type === 'numeric-single') return { value: filter.value?.toString() ?? '', minValue: '', maxValue: '' }
	return {
		value: (filter.operator === '<=' ? filter.max : filter.min)?.toString() ?? '',
		minValue: filter.min?.toString() ?? '',
		maxValue: filter.max?.toString() ?? ''
	}
}

interface FilterItemEditorProps {
	filter: ActiveFilter
	onUpdate: (filter: ActiveFilter) => void
	onRemove: (removeButton: HTMLElement) => void
	isEditing: boolean
	onStartEdit: () => void
	onEndEdit: () => void
}

// The pill and its editor replace each other, and an added filter replaces its row in the list: each one that mounts
// takes the focus the control it replaced dropped (its first field, or the pill after Done).
function FilterItemEditor({ filter, onUpdate, onRemove, isEditing, onStartEdit, onEndEdit }: FilterItemEditorProps) {
	const { config } = filter
	const [localInputs, setLocalInputs] = useState(() => getInitialInputs(filter))
	const localValue = localInputs.value
	const localMinValue = localInputs.minValue
	const localMaxValue = localInputs.maxValue

	const minAllowed = config.min ?? 0
	const prefix = config.format === 'currency' ? '$' : ''
	const suffix = config.format === 'percent' ? '%' : ''

	// Reads a typed bound: undefined clears it, null means the text is not a number the filter accepts yet.
	const parseBound = (input: string) => {
		if (input === '') return undefined
		const parsed = parseNumberWithAbbreviation(input)
		return parsed !== undefined && parsed >= minAllowed ? parsed : null
	}

	const handleValueChange = (input: string) => {
		setLocalInputs((prev) => ({ ...prev, value: input }))
		const value = parseBound(input)
		if (value === null || filter.type === 'boolean') return
		if (filter.type === 'numeric-single') onUpdate({ ...filter, value })
		else onUpdate(filter.operator === '<=' ? { ...filter, max: value } : { ...filter, min: value })
	}

	// A minimum typed above the maximum (or the reverse) swaps the two.
	const handleBoundChange = (range: RangeFilter, bound: 'min' | 'max', input: string) => {
		const inputKey = bound === 'min' ? 'minValue' : 'maxValue'
		setLocalInputs((prev) => ({ ...prev, [inputKey]: input }))
		const value = parseBound(input)
		if (value === null) return
		const other = bound === 'min' ? range.max : range.min
		const crossed = value !== undefined && other !== undefined && (bound === 'min' ? value > other : value < other)
		if (!crossed) {
			onUpdate({ ...range, [bound]: value })
			return
		}
		const min = Math.min(value, other)
		const max = Math.max(value, other)
		onUpdate({ ...range, min, max })
		setLocalInputs((prev) => ({ ...prev, minValue: min.toString(), maxValue: max.toString() }))
	}

	const handleOperatorChange = (range: RangeFilter, operator: NumericOperator) => {
		const current = range.operator === '<=' ? range.max : range.operator === '>=' ? range.min : (range.min ?? range.max)
		const next: RangeFilter =
			operator === 'between'
				? { ...range, operator, min: range.min ?? current, max: range.max ?? current }
				: operator === '>='
					? { ...range, operator, min: current, max: undefined }
					: { ...range, operator, min: undefined, max: current }
		onUpdate(next)
		// The fields swap with the operator, so they show the bounds it kept rather than starting empty.
		setLocalInputs(getInitialInputs(next))
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== 'Enter' && e.key !== 'Escape') return
		// Escape closes this editor only; the enclosing dialog stays open.
		e.preventDefault()
		e.stopPropagation()
		onEndEdit()
	}

	const handleStartEdit = () => {
		setLocalInputs(getInitialInputs(filter))
		onStartEdit()
	}

	const displayValue = buildDisplayValue(filter)
	const hasValue = filterHasValue(filter)
	const categoryLabel = CATEGORY_LABELS[config.category]
	const categoryBadge = <Tag>{categoryLabel}</Tag>
	const removeButton = (
		<Tooltip
			content="Remove filter"
			render={
				<Button
					variant="ghost"
					size="sm"
					square
					data-filter-remove
					onClick={(event) => onRemove(event.currentTarget)}
					aria-label={`Remove ${config.label} filter`}
				/>
			}
		>
			<Icon name="x" className="size-4" />
		</Tooltip>
	)

	if (filter.type === 'boolean') {
		return (
			<div className="flex items-start justify-between rounded-md border border-medium bg-surface-elevated-1 px-2.5 py-2 text-primary">
				<div className="flex min-w-0 flex-col gap-0.5">
					<div className="flex items-center gap-1.5">
						<Icon name="check" className="size-3" />
						<span className="truncate title-sm">{config.label}</span>
						{config.description ? <QuestionHelper text={config.description} /> : null}
						{categoryBadge}
					</div>
					<span className="truncate body-sm text-secondary">{displayValue}</span>
				</div>
				{removeButton}
			</div>
		)
	}

	if (!isEditing && hasValue) {
		return (
			<div className="flex items-start justify-between rounded-md border border-medium bg-surface-elevated-1 px-2.5 py-2 text-primary">
				{/* The edit button anchors the filter's definition; the "?" only marks it (QuestionHelper header). */}
				<Tooltip
					content={config.description}
					placement="top"
					render={
						<button
							ref={takeLostFocus}
							type="button"
							onClick={handleStartEdit}
							className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
						/>
					}
				>
					<div className="flex min-w-0 flex-col gap-0.5">
						<div className="flex items-center gap-1.5">
							<span className="truncate title-sm">{config.label}</span>
							{config.description ? <Icon name="help-circle" className="size-3 text-tertiary" aria-hidden /> : null}
							{categoryBadge}
						</div>
						<span className="truncate label-sm text-secondary">{displayValue}</span>
					</div>
				</Tooltip>
				{removeButton}
			</div>
		)
	}

	if (filter.type === 'numeric-single') {
		return (
			<div className="flex flex-col gap-1.5 rounded-md border border-brand bg-surface-elevated-1 p-2 text-primary">
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<span className="truncate title-sm">{config.label}</span>
						{config.description ? <QuestionHelper text={config.description} /> : null}
						{categoryBadge}
					</div>
					{removeButton}
				</div>
				<div className="flex items-center gap-1.5">
					{prefix ? <span className="body-sm text-tertiary">{prefix}</span> : null}
					<Input
						type="text"
						inputMode="decimal"
						value={localValue}
						onChange={(e) => handleValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						ref={takeLostFocus}
						aria-label={`${config.label} value`}
						placeholder="e.g. 10, 1k, 1m"
						className="min-w-0 flex-1"
					/>
					{suffix ? <span className="body-sm text-tertiary">{suffix}</span> : null}
				</div>
				<Button size="sm" onClick={onEndEdit}>
					Done
				</Button>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-1.5 rounded-md border border-brand bg-surface-elevated-1 p-2 text-primary">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate title-sm">{config.label}</span>
					{categoryBadge}
				</div>
				{removeButton}
			</div>
			<Select
				allValues={OPERATOR_OPTIONS}
				label={filter.operator}
				labelType="none"
				heading="Operator"
				selectedValues={filter.operator}
				setSelectedValues={(value) => {
					const operator = OPERATOR_OPTIONS.find((option) => option.key === value)?.key
					if (!operator) throw new Error(`Unsupported numeric filter operator: ${value}`)
					handleOperatorChange(filter, operator)
				}}
				variant="input"
				size="md"
				className="w-full justify-between"
				triggerProps={{ 'aria-label': `${config.label} operator` }}
			/>
			{filter.operator === 'between' ? (
				<div className="flex items-center gap-1.5">
					{prefix ? <span className="body-sm text-tertiary">{prefix}</span> : null}
					<Input
						type="text"
						inputMode="decimal"
						value={localMinValue}
						onChange={(e) => handleBoundChange(filter, 'min', e.target.value)}
						onKeyDown={handleKeyDown}
						ref={takeLostFocus}
						aria-label={`${config.label} minimum`}
						placeholder="Min"
						className="min-w-0 flex-1"
					/>
					<span className="body-sm text-tertiary">-</span>
					<Input
						type="text"
						inputMode="decimal"
						value={localMaxValue}
						onChange={(e) => handleBoundChange(filter, 'max', e.target.value)}
						onKeyDown={handleKeyDown}
						aria-label={`${config.label} maximum`}
						placeholder="Max"
						className="min-w-0 flex-1"
					/>
					{suffix ? <span className="body-sm text-tertiary">{suffix}</span> : null}
				</div>
			) : (
				<div className="flex items-center gap-1.5">
					{prefix ? <span className="body-sm text-tertiary">{prefix}</span> : null}
					<Input
						type="text"
						inputMode="decimal"
						value={localValue}
						onChange={(e) => handleValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						ref={takeLostFocus}
						aria-label={`${config.label} value`}
						placeholder="e.g. 10, 1k, 1m"
						className="min-w-0 flex-1"
					/>
					{suffix ? <span className="body-sm text-tertiary">{suffix}</span> : null}
				</div>
			)}
			<Button size="sm" onClick={onEndEdit}>
				Done
			</Button>
		</div>
	)
}

export function FilterBuilder({ filters, onFiltersChange }: FilterBuilderProps) {
	const [search, setSearch] = useState('')
	const searchRef = useRef<HTMLInputElement>(null)
	const browseListRef = useRef<HTMLDivElement>(null)
	const activeListRef = useRef<HTMLDivElement>(null)
	const [expandedCategories, setExpandedCategories] = useState<Set<FilterCategory>>(new Set(['metrics', 'flags']))
	const [pendingFilters, setPendingFilters] = useState<Array<ActiveFilter>>([])
	const [editingFilterId, setEditingFilterId] = useState<string | null>(null)

	const savedFilters = useMemo(() => filtersToActiveFilters(filters), [filters])

	const allActiveFilters = useMemo(() => {
		const savedIds = new Set(savedFilters.map((f) => f.config.id))
		const uniquePending = pendingFilters.filter((f) => !savedIds.has(f.config.id))
		return [...savedFilters, ...uniquePending]
	}, [savedFilters, pendingFilters])

	const activeFilterIds = useMemo(() => new Set(allActiveFilters.map((f) => f.config.id)), [allActiveFilters])

	const filteredCategories = useMemo(() => {
		const searchLower = search.toLowerCase()
		const result: Array<{ category: FilterCategory; label: string; filters: Array<FilterConfig> }> = []

		for (const { key, label } of FILTER_CATEGORIES) {
			const categoryFilters = FILTERS_BY_CATEGORY.get(key) ?? EMPTY_CATEGORY_FILTERS
			const matchingFilters = categoryFilters.filter((f) => f.label.toLowerCase().includes(searchLower))

			if (matchingFilters.length > 0) {
				result.push({ category: key, label, filters: matchingFilters })
			}
		}

		return result
	}, [search])

	const inactiveFiltersCount = Math.max(TOTAL_FILTERS_AVAILABLE - activeFilterIds.size, 0)

	const visibleAvailableCount = useMemo(
		() =>
			filteredCategories.reduce(
				(sum, { filters: categoryFilters }) => sum + categoryFilters.filter((f) => !activeFilterIds.has(f.id)).length,
				0
			),
		[filteredCategories, activeFilterIds]
	)

	const handleAddFilter = (config: FilterConfig) => {
		if (activeFilterIds.has(config.id)) return

		if (config.type === 'boolean') {
			onFiltersChange(activeFilterToTableFilters([...savedFilters, { type: 'boolean', config }], filters))
			return
		}
		const newFilter: ActiveFilter =
			config.type === 'numeric-single'
				? { type: 'numeric-single', config, value: undefined }
				: { type: 'numeric-range', config, operator: '>=', min: undefined, max: undefined }
		setPendingFilters((prev) => [...prev, newFilter])
		setEditingFilterId(config.id)
	}

	const handleUpdateFilter = (updatedFilter: ActiveFilter) => {
		const isPending = pendingFilters.some((f) => f.config.id === updatedFilter.config.id)

		if (isPending) {
			if (filterHasValue(updatedFilter)) {
				setPendingFilters((prev) => prev.filter((f) => f.config.id !== updatedFilter.config.id))
				const newFilters = activeFilterToTableFilters([...savedFilters, updatedFilter], filters)
				onFiltersChange(newFilters)
			} else {
				setPendingFilters((prev) => prev.map((f) => (f.config.id === updatedFilter.config.id ? updatedFilter : f)))
			}
		} else {
			const newActiveFilters = savedFilters.map((f) => (f.config.id === updatedFilter.config.id ? updatedFilter : f))
			const newFilters = activeFilterToTableFilters(newActiveFilters, filters)
			onFiltersChange(newFilters)
		}
	}

	const handleRemoveFilter = (filterId: string) => {
		const isPending = pendingFilters.some((f) => f.config.id === filterId)

		if (isPending) {
			setPendingFilters((prev) => prev.filter((f) => f.config.id !== filterId))
		} else {
			const newActiveFilters = savedFilters.filter((f) => f.config.id !== filterId)
			const newFilters = activeFilterToTableFilters(newActiveFilters, filters)
			onFiltersChange(newFilters)
		}
		if (editingFilterId === filterId) {
			setEditingFilterId(null)
		}
	}

	// A filter that leaves the active list with nothing in its place hands focus to its option in the browse list, or to
	// the search when a collapsed category or the query hides the option.
	const optionOrSearch = (filterId: string) =>
		browseListRef.current?.querySelector<HTMLElement>(`[data-filter-id="${filterId}"]`) ?? searchRef.current

	// The next filter's × takes focus, else the previous one's, else the removed filter's option.
	const removeFilter = (filterId: string, removeButton: HTMLElement) => {
		const removes = [...activeListRef.current!.querySelectorAll<HTMLElement>('[data-filter-remove]')]
		const index = removes.indexOf(removeButton)
		const neighbor = removes[index + 1] ?? removes[index - 1]
		keepFocus(
			() => handleRemoveFilter(filterId),
			() => neighbor ?? optionOrSearch(filterId)
		)
	}

	const handleClearAll = () => {
		setPendingFilters([])
		setEditingFilterId(null)
		const clearedFilters = activeFilterToTableFilters([], filters)
		onFiltersChange(clearedFilters)
	}

	const toggleCategory = (category: FilterCategory) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev)
			if (next.has(category)) {
				next.delete(category)
			} else {
				next.add(category)
			}
			return next
		})
	}

	const expandAllCategories = () => {
		setExpandedCategories(new Set(FILTERS_BY_CATEGORY.keys()))
	}

	const collapseAllCategories = () => {
		setExpandedCategories(new Set())
	}

	return (
		<Card padding="base" className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<span className="title-sm text-secondary">Browse filters</span>
						<span className="body-sm text-tertiary">
							{search
								? `${visibleAvailableCount} match${visibleAvailableCount === 1 ? '' : 'es'}`
								: `${inactiveFiltersCount} available`}
						</span>
					</div>
					<div className="ml-auto flex items-center gap-1">
						<Button size="sm" onClick={expandAllCategories}>
							Expand all
						</Button>
						<Button size="sm" onClick={collapseAllCategories}>
							Collapse
						</Button>
					</div>
				</div>
				<SearchField
					ref={searchRef}
					label="Search filters"
					placeholder="Search filters…"
					value={search}
					onChange={(value) => {
						setSearch(value)
						// Each new query reveals all of its matches; the user can still collapse a category afterwards.
						if (value) expandAllCategories()
					}}
				/>
				<div ref={browseListRef} className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto pr-1">
					{filteredCategories.map(({ category, label, filters: categoryFilters }) => {
						const isExpanded = expandedCategories.has(category)
						const availableFilters = categoryFilters.filter((f) => !activeFilterIds.has(f.id))

						if (availableFilters.length === 0 && !isExpanded) return null

						return (
							<div key={category} className="rounded-md border border-subtle">
								<button
									type="button"
									aria-expanded={isExpanded}
									onClick={() => toggleCategory(category)}
									className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left transition-colors hover:bg-hover-row"
								>
									<div className="flex items-center gap-2">
										<Tag>{label}</Tag>
										<span className="body-sm text-tertiary">{availableFilters.length}</span>
									</div>
									<Icon
										name="chevron-down"
										className={`size-3.5 text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
									/>
								</button>
								{isExpanded && availableFilters.length > 0 ? (
									<div className="border-t border-subtle bg-surface p-1">
										{availableFilters.map((filter) => (
											// The row anchors the filter's definition; the "?" only marks it (QuestionHelper header).
											<Tooltip
												key={filter.id}
												content={filter.description}
												placement="right"
												render={
													<ListRow
														data-filter-id={filter.id}
														onClick={() => handleAddFilter(filter)}
														className="group justify-between"
													/>
												}
											>
												<div className="flex min-w-0 items-center gap-1.5">
													<span className="truncate">{filter.label}</span>
													{filter.description ? (
														<Icon name="help-circle" className="size-3 text-tertiary" aria-hidden />
													) : null}
												</div>
												<Icon
													name="plus"
													className="size-3.5 shrink-0 text-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100"
												/>
											</Tooltip>
										))}
									</div>
								) : null}
							</div>
						)
					})}
					{filteredCategories.length === 0 ? (
						<div className="flex items-center justify-between rounded-md border border-dashed border-medium p-3 body-sm text-tertiary">
							<span>No filters match "{search}".</span>
							<Button
								size="sm"
								onClick={() =>
									keepFocus(
										() => setSearch(''),
										() => searchRef.current
									)
								}
							>
								Clear search
							</Button>
						</div>
					) : null}
				</div>
			</div>

			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex items-center justify-between label-sm">
					<div className="flex items-center gap-2">
						<span className="text-secondary">Active ({allActiveFilters.length})</span>
					</div>
					{allActiveFilters.length > 0 ? (
						// The button leaves with the last filter, so focus goes to the search.
						<Button variant="link" onClick={() => keepFocus(handleClearAll, () => searchRef.current)}>
							Clear all
						</Button>
					) : null}
				</div>
				<div
					ref={activeListRef}
					className="grid max-h-[260px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-start gap-1.5 overflow-y-auto pr-1"
				>
					{allActiveFilters.length === 0 ? (
						<EmptyState size="md" icon="settings" title="No filters applied">
							Add from the left to start narrowing results.
						</EmptyState>
					) : (
						allActiveFilters.map((filter) => {
							const isPending = pendingFilters.some((f) => f.config.id === filter.config.id)
							const isEditing = editingFilterId === filter.config.id || isPending
							return (
								<FilterItemEditor
									key={filter.config.id}
									filter={filter}
									onUpdate={handleUpdateFilter}
									onRemove={(removeButton) => removeFilter(filter.config.id, removeButton)}
									isEditing={isEditing}
									onStartEdit={() => setEditingFilterId(filter.config.id)}
									// A new filter closed without a value adds nothing, so it leaves the list.
									onEndEdit={() =>
										isPending
											? keepFocus(
													() => handleRemoveFilter(filter.config.id),
													() => optionOrSearch(filter.config.id)
												)
											: setEditingFilterId(null)
									}
								/>
							)
						})
					)}
				</div>
			</div>
		</Card>
	)
}
