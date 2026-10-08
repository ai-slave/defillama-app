import * as React from 'react'
import { Button } from '~/ui/Button'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { Tooltip } from '~/ui/Tooltip'

interface Column {
	id: string
	name: string
}

interface ColumnManagementPanelProps {
	columns: Array<Column>
	columnVisibility: Record<string, boolean>
	/** The shown columns, in table order. */
	activeColumns: Array<string>
	toggleColumnVisibility: (columnId: string) => void
	setAllColumnsVisible: (visible: boolean) => void
	moveColumn: (columnId: string, delta: -1 | 1) => void
	onDone: () => void
}

export function ColumnManagementPanel({
	columns,
	columnVisibility,
	activeColumns,
	toggleColumnVisibility,
	setAllColumnsVisible,
	moveColumn,
	onDone
}: ColumnManagementPanelProps) {
	const [searchTerm, setSearchTerm] = React.useState('')
	const searchRef = React.useRef<HTMLInputElement>(null)

	const filteredColumns = columns.filter(
		(column) => column.name && column.name.toLowerCase().includes(searchTerm.toLowerCase())
	)
	const columnGroups = [
		{ title: 'Percentage share', columns: filteredColumns.filter((col) => col.id.endsWith('_share')) },
		{ title: 'Standard metrics', columns: filteredColumns.filter((col) => !col.id.endsWith('_share')) }
	].filter((group) => group.columns.length > 0)

	// Hiding or adding a column moves its row to the other list; focus stays in the list the reader is working in.
	const toggleFromRow = (event: React.MouseEvent<HTMLButtonElement>, row: Element, columnId: string) => {
		const next = neighbourRowControl(row, event.currentTarget)
		keepFocus(
			() => toggleColumnVisibility(columnId),
			() => next ?? searchRef.current
		)
	}

	return (
		<div className="mb-4 rounded-md border border-subtle bg-surface p-4">
			<div className="mb-3 flex items-center justify-between">
				<h4 className="label-md text-primary">Customize columns</h4>
				<div className="flex items-center gap-2">
					<Button variant="secondary" size="sm" onClick={() => setAllColumnsVisible(true)}>
						Show all
					</Button>
					<Button variant="secondary" size="sm" onClick={() => setAllColumnsVisible(false)}>
						Hide all
					</Button>
				</div>
			</div>

			<div className="relative mb-3">
				<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
				<Input
					ref={searchRef}
					type="text"
					aria-label="Search columns"
					placeholder="Search columns…"
					onInput={(e) => setSearchTerm(e.currentTarget.value)}
					className={searchFieldInputPlacementStyles}
				/>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div>
					<h5 className="mb-2 flex items-center gap-2 title-sm text-secondary">
						<Icon name="eye" className="size-3.5" />
						Active columns ({activeColumns.length})
					</h5>
					<p className="mb-3 body-sm text-tertiary">Use arrows to reorder • Click × to hide</p>
					<div className="max-h-60 space-y-1 overflow-y-auto">
						{activeColumns.map((columnId, index) => {
							const column = columns.find((col) => col.id === columnId)
							if (!column) return null

							// The arrows stay rendered at the ends, so the pressed one keeps focus after a move.
							const isFirst = index === 0
							const isLast = index === activeColumns.length - 1

							return (
								<div
									key={columnId}
									className="hover-wash flex items-center justify-between rounded-md border border-subtle bg-surface-elevated-1 p-2 transition-colors"
								>
									<div className="flex items-center gap-2">
										<Icon name="check" className="size-3.5 text-success" />
										<span className="body-sm text-primary">{column.name}</span>
										{columnId.endsWith('_share') ? (
											<span className="rounded-md bg-brand-tint px-1 py-0.5 body-sm text-link">%</span>
										) : null}
									</div>
									<div className="flex items-center gap-1">
										<Tooltip
											content="Move up"
											render={
												<Button
													variant="ghost"
													size="sm"
													square
													disabled={isFirst}
													accessibleWhenDisabled
													onClick={() => moveColumn(columnId, -1)}
													aria-label={`Move ${column.name} up`}
												/>
											}
										>
											<Icon name="chevron-up" className="size-4" />
										</Tooltip>
										<Tooltip
											content="Move down"
											render={
												<Button
													variant="ghost"
													size="sm"
													square
													disabled={isLast}
													accessibleWhenDisabled
													onClick={() => moveColumn(columnId, 1)}
													aria-label={`Move ${column.name} down`}
												/>
											}
										>
											<Icon name="chevron-down" className="size-4" />
										</Tooltip>
										{/* The chain name always shows, so it has nothing to hide. */}
										{columnId === 'name' ? (
											<span aria-hidden className="size-6 shrink-0" />
										) : (
											<Tooltip
												content="Hide column"
												render={
													<Button
														variant="ghost"
														size="sm"
														square
														onClick={(event) =>
															toggleFromRow(event, event.currentTarget.parentElement!.parentElement!, columnId)
														}
														aria-label={`Hide ${column.name}`}
													/>
												}
											>
												<Icon name="x" className="size-4" />
											</Tooltip>
										)}
									</div>
								</div>
							)
						})}
					</div>
				</div>

				<div>
					<h5 className="mb-2 flex items-center gap-2 title-sm text-secondary">
						<Icon name="plus" className="size-3.5" />
						Available columns
					</h5>
					<p className="mb-3 body-sm text-tertiary">Click to add to table</p>
					<div className="max-h-60 space-y-3 overflow-y-auto">
						{columnGroups.map((group) => (
							<div key={group.title}>
								<h6 className="mb-1 label-sm text-secondary">{group.title}</h6>
								<div className="space-y-1">
									{group.columns
										.filter((col) => columnVisibility[col.id] === false)
										.map((column) => (
											<button
												type="button"
												key={column.id}
												onClick={(event) => toggleFromRow(event, event.currentTarget, column.id)}
												className="hover-wash flex w-full items-center gap-2 rounded-md border border-subtle bg-surface-elevated-1 p-2 text-left transition-colors"
											>
												<Icon name="plus" className="size-3.5" />
												<span className="label-sm text-primary">{column.name}</span>
												{column.id.endsWith('_share') ? (
													<span className="ml-auto rounded-md bg-brand-tint px-1 py-0.5 label-sm text-link">%</span>
												) : null}
											</button>
										))}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 body-sm">
				<span className="text-tertiary">
					{activeColumns.length} of {columns.length} columns visible
				</span>
				<Button variant="primary" size="sm" onClick={onDone}>
					Done
				</Button>
			</div>
		</div>
	)
}
