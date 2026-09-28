import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { Icon } from '~/ui/Icon'
import { ProBadge, ProButton, ProChip, ProMeta } from '../../../ui'
import { proInputStyles } from '../../../ui/styles'
import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import { ProCardHeader } from '../../ProCardHeader'
import type { ActiveFilterChip } from '../utils/filterChips'
import type { CsvExportLevel } from './csvExportLevels'

interface GroupingOption {
	id: string
	label: string
}

interface UnifiedTableHeaderProps {
	title: string
	titleBadge?: ReactNode
	scopeDescription: string
	rowHeadersSummary: string | null
	onCustomizeColumns?: (() => void) | undefined
	onDuplicate?: (() => void) | undefined
	onCsvExport?: (() => void | Promise<void>) | undefined
	onCsvExportLevel?: ((level: CsvExportLevel) => void | Promise<void>) | undefined
	rowHeaders?: Array<UnifiedRowHeaderType>
	isExportDisabled?: boolean
	isLoading?: boolean
	onSearchChange: (value: string) => void
	filterChips: Array<ActiveFilterChip>
	onFilterRemove?: ((chip: ActiveFilterChip) => void) | undefined
	onClearFilters?: (() => void) | undefined
	filtersEditable?: boolean
	activeFilterCount: number
	onFiltersClick?: (() => void) | undefined
	groupingOptions?: Array<GroupingOption>
	selectedGroupingId?: string | undefined
	onGroupingChange?: ((optionId: string) => void) | undefined
}

function TableSearchField({ onSearchChange }: { onSearchChange: (value: string) => void }) {
	const [expanded, setExpanded] = useState(false)
	const [retainedQuery, setRetainedQuery] = useState('')
	const valueRef = useRef('')
	const searchButtonRef = useRef<HTMLButtonElement>(null)
	const restoreFocusRef = useRef(false)

	useEffect(() => {
		if (expanded || !restoreFocusRef.current) return
		restoreFocusRef.current = false
		searchButtonRef.current?.focus()
	}, [expanded])

	const collapse = (restoreFocus: boolean) => {
		restoreFocusRef.current = restoreFocus
		setRetainedQuery(valueRef.current)
		setExpanded(false)
	}

	if (!expanded) {
		return (
			<ProButton
				ref={searchButtonRef}
				size="sm"
				square
				variant="ghost"
				aria-label="Search table rows"
				onClick={() => setExpanded(true)}
			>
				<Icon name="search" height={14} width={14} />
			</ProButton>
		)
	}
	return (
		<input
			type="search"
			autoFocus
			defaultValue={retainedQuery}
			aria-label="Search table rows"
			placeholder="Search rows…"
			className={`${proInputStyles} w-64`}
			onInput={(event) => {
				valueRef.current = event.currentTarget.value
				onSearchChange(valueRef.current)
			}}
			onBlur={(event) => {
				if (valueRef.current) return
				collapse(event.relatedTarget === null)
			}}
			onKeyDown={(event) => {
				if (event.key !== 'Escape') return
				event.stopPropagation()
				collapse(true)
			}}
		/>
	)
}

export function UnifiedTableHeader({
	title,
	titleBadge,
	scopeDescription,
	rowHeadersSummary,
	onCustomizeColumns,
	onDuplicate,
	onCsvExport,
	onCsvExportLevel,
	rowHeaders,
	isExportDisabled = false,
	isLoading = false,
	onSearchChange,
	filterChips,
	onFilterRemove,
	onClearFilters,
	filtersEditable = false,
	activeFilterCount,
	onFiltersClick,
	groupingOptions,
	selectedGroupingId,
	onGroupingChange
}: UnifiedTableHeaderProps) {
	const hasCsvLevels = Boolean(rowHeaders && rowHeaders.length > 1 && onCsvExportLevel)
	const hasFilters = filterChips.length > 0
	const canMutateFilters = filtersEditable && Boolean(onFilterRemove)
	const isGroupingInteractive = Boolean(onGroupingChange)
	const groupingSelectValue = groupingOptions
		? groupingOptions.find((option) => option.id === selectedGroupingId)?.id || groupingOptions[0]?.id || ''
		: ''
	const groupingLabel = groupingOptions?.find((option) => option.id === groupingSelectValue)?.label ?? ''

	return (
		<div className="mb-2 flex flex-col gap-2">
			<ProCardHeader
				titleAs="h3"
				title={title}
				badge={titleBadge}
				subtitle={<ProMeta items={[scopeDescription, rowHeadersSummary ? `Grouped by ${rowHeadersSummary}` : null]} />}
				viewerControls={
					<>
						<TableSearchField onSearchChange={onSearchChange} />
						{onFiltersClick ? (
							<ProButton size="sm" variant={activeFilterCount ? 'primary' : 'secondary'} onClick={onFiltersClick}>
								Filters
								{activeFilterCount ? <ProBadge tone="info">{activeFilterCount}</ProBadge> : null}
							</ProButton>
						) : null}
					</>
				}
				controls={
					<>
						{isGroupingInteractive && groupingOptions?.length ? (
							<Select
								heading="Group rows by"
								size="sm"
								variant="pro"
								label={groupingLabel}
								labelType="none"
								allValues={groupingOptions.map((option) => ({ key: option.id, name: option.label }))}
								selectedValues={groupingSelectValue}
								setSelectedValues={(value: string) => onGroupingChange?.(value)}
								triggerProps={{ 'aria-label': 'Group table rows' }}
							/>
						) : null}
						{onCustomizeColumns ? (
							<ProButton size="sm" variant="secondary" onClick={onCustomizeColumns}>
								<Icon name="layout-grid" height={14} width={14} />
								Columns
								<span className="sr-only">Customize columns</span>
							</ProButton>
						) : null}
					</>
				}
				menu={{
					onDuplicate,
					disabled: isExportDisabled,
					csvLevels:
						hasCsvLevels && onCsvExportLevel && rowHeaders
							? { rowHeaders, onExport: onCsvExportLevel, isLoading }
							: undefined,
					csv: !hasCsvLevels && onCsvExport ? { onClick: onCsvExport, isLoading } : undefined
				}}
			/>
			{hasFilters ? (
				<div className="flex flex-wrap items-center gap-2 px-3">
					{filterChips.map((chip) =>
						canMutateFilters ? (
							<ProChip
								key={chip.id}
								as="button"
								type="button"
								onClick={() => onFilterRemove?.(chip)}
								aria-label={`Remove filter: ${chip.label}`}
							>
								<span className="font-medium text-pro-text-primary">{chip.label}</span>
								{chip.value ? <span>: {chip.value}</span> : null}
								<Icon name="x" height={12} width={12} />
							</ProChip>
						) : (
							<ProChip key={chip.id}>
								<span className="font-medium text-pro-text-primary">{chip.label}</span>
								{chip.value ? <span>: {chip.value}</span> : null}
							</ProChip>
						)
					)}
					{canMutateFilters && onClearFilters ? (
						<ProButton size="sm" variant="ghost" onClick={onClearFilters}>
							Clear all filters
						</ProButton>
					) : null}
				</div>
			) : null}
		</div>
	)
}
