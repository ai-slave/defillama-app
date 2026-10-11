import { type ReactNode, useRef, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { Button } from '~/ui/Button'
import { focusNeighborOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { SearchField } from '~/ui/SearchField'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { ProBadge, ProMeta } from '../../../ui'
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
	// Outlives the field, so reopening the search shows the query the rows are still filtered by.
	const [query, setQuery] = useState('')
	const restoreFocusRef = useRef(false)

	const collapse = (restoreFocus: boolean) => {
		restoreFocusRef.current = restoreFocus
		setExpanded(false)
	}

	if (!expanded) {
		return (
			<Tooltip
				content="Search table rows"
				render={
					<Button
						ref={(node) => {
							if (!node || !restoreFocusRef.current) return
							restoreFocusRef.current = false
							node.focus()
						}}
						size="sm"
						square
						variant="ghost"
						aria-label="Search table rows"
						onClick={() => setExpanded(true)}
					/>
				}
			>
				<Icon name="search" className="size-4" />
			</Tooltip>
		)
	}
	return (
		<SearchField
			label="Search table rows"
			autoFocus
			value={query}
			onChange={(value) => {
				setQuery(value)
				onSearchChange(value)
			}}
			placeholder="Search rows…"
			className="w-64"
			onBlur={(event) => {
				if (query) return
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
	const filtersButtonRef = useRef<HTMLButtonElement>(null)

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
							<Button
								ref={filtersButtonRef}
								size="sm"
								variant="filter"
								data-active={activeFilterCount > 0}
								onClick={onFiltersClick}
							>
								Filters
								{/* Unpadded, the count fits the sm button's 24px row; padded, it grew the button to 28px. */}
								{activeFilterCount ? (
									<ProBadge tone="info" className="py-0!">
										{activeFilterCount}
									</ProBadge>
								) : null}
							</Button>
						) : null}
					</>
				}
				controls={
					<>
						{isGroupingInteractive && groupingOptions?.length ? (
							<Select
								heading="Group rows by"
								size="sm"
								variant="filter"
								label={groupingLabel}
								labelType="none"
								allValues={groupingOptions.map((option) => ({ key: option.id, name: option.label }))}
								selectedValues={groupingSelectValue}
								setSelectedValues={(value: string) => onGroupingChange?.(value)}
								triggerProps={{ 'aria-label': 'Group table rows' }}
							/>
						) : null}
						{onCustomizeColumns ? (
							<Button size="sm" variant="secondary" onClick={onCustomizeColumns}>
								<Icon name="layout-grid" className="size-3.5" />
								Columns
								<span className="sr-only">Customize columns</span>
							</Button>
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
					{/* Its own row, so a removed chip's neighbor is a chip and never Clear all. */}
					<div className="contents">
						{filterChips.map((chip) =>
							canMutateFilters ? (
								<Button
									key={chip.id}
									variant="filter"
									size="sm"
									data-active
									data-row
									// After the last chip, the Filters button, else the card.
									ref={focusNeighborOnLeave(
										(node) => filtersButtonRef.current ?? node.parentElement?.closest<HTMLElement>('[tabindex]')
									)}
									onClick={() => onFilterRemove?.(chip)}
									aria-label={`Remove filter: ${chip.label}`}
								>
									<span>
										{chip.label}
										{chip.value ? `: ${chip.value}` : null}
									</span>
									<Icon name="x" className="size-3" />
								</Button>
							) : (
								<Tag key={chip.id}>
									<span className="font-medium text-primary">{chip.label}</span>
									{chip.value ? <span>: {chip.value}</span> : null}
								</Tag>
							)
						)}
					</div>
					{canMutateFilters && onClearFilters ? (
						<Button size="sm" variant="ghost" onClick={onClearFilters}>
							Clear all filters
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	)
}
