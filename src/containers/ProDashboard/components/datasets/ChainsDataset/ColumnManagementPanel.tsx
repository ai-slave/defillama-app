import * as React from 'react'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'

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
		{ title: 'Percentage Share', columns: filteredColumns.filter((col) => col.id.endsWith('_share')) },
		{ title: 'Standard Metrics', columns: filteredColumns.filter((col) => !col.id.endsWith('_share')) }
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
		<div className="mb-4 rounded-md border border-pro-cards-border bg-pro-cards-bg p-4">
			<div className="mb-3 flex items-center justify-between">
				<h4 className="text-sm font-medium text-pro-text-primary">Customize Columns</h4>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setAllColumnsVisible(true)}
						className="rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2 py-1 text-xs text-pro-text-secondary transition-colors hover:bg-pro-hover-fill"
					>
						Show All
					</button>
					<button
						type="button"
						onClick={() => setAllColumnsVisible(false)}
						className="rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2 py-1 text-xs text-pro-text-secondary transition-colors hover:bg-pro-hover-fill"
					>
						Hide All
					</button>
				</div>
			</div>

			<div className="relative mb-3">
				<Icon
					name="search"
					height={14}
					width={14}
					className="absolute top-1/2 left-3 -translate-y-1/2 transform text-pro-text-tertiary"
				/>
				<input
					ref={searchRef}
					type="text"
					aria-label="Search columns"
					placeholder="Search columns..."
					onInput={(e) => setSearchTerm(e.currentTarget.value)}
					className="w-full rounded-md border border-pro-cards-border bg-pro-glass-bg py-2 pr-3 pl-9 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
				/>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div>
					<h5 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-pro-text-secondary uppercase">
						<Icon name="eye" height={12} width={12} />
						Active Columns ({activeColumns.length})
					</h5>
					<p className="mb-3 text-xs text-pro-text-tertiary">Use arrows to reorder • Click × to hide</p>
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
									className="flex items-center justify-between rounded-md border border-pro-cards-border bg-surface-elevated-1 p-2 transition-colors hover:bg-pro-hover-fill"
								>
									<div className="flex items-center gap-2">
										<Icon name="check" height={12} width={12} className="text-success" />
										<span className="text-xs text-pro-text-primary">{column.name}</span>
										{columnId.endsWith('_share') ? (
											<span className="rounded-md bg-pro-info-100 px-1 py-0.5 text-xs text-pro-info-400 dark:bg-pro-info-300/20 dark:text-pro-info-200">
												%
											</span>
										) : null}
									</div>
									<div className="flex items-center gap-1">
										<button
											type="button"
											aria-disabled={isFirst}
											onClick={() => {
												if (!isFirst) moveColumn(columnId, -1)
											}}
											className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary aria-disabled:opacity-40"
											aria-label={`Move ${column.name} up`}
										>
											<Icon name="chevron-up" height={10} width={10} />
										</button>
										<button
											type="button"
											aria-disabled={isLast}
											onClick={() => {
												if (!isLast) moveColumn(columnId, 1)
											}}
											className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary aria-disabled:opacity-40"
											aria-label={`Move ${column.name} down`}
										>
											<Icon name="chevron-down" height={10} width={10} />
										</button>
										<button
											type="button"
											onClick={(event) =>
												toggleFromRow(event, event.currentTarget.parentElement!.parentElement!, columnId)
											}
											className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
											disabled={columnId === 'name'}
											aria-label={`Hide ${column.name}`}
										>
											<Icon name="x" height={12} width={12} />
										</button>
									</div>
								</div>
							)
						})}
					</div>
				</div>

				<div>
					<h5 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-pro-text-secondary uppercase">
						<Icon name="plus" height={12} width={12} />
						Available Columns
					</h5>
					<p className="mb-3 text-xs text-pro-text-tertiary">Click to add to table</p>
					<div className="max-h-60 space-y-3 overflow-y-auto">
						{columnGroups.map((group) => (
							<div key={group.title}>
								<h6 className="mb-1 text-xs font-medium text-pro-text-secondary">{group.title}</h6>
								<div className="space-y-1">
									{group.columns
										.filter((col) => columnVisibility[col.id] === false)
										.map((column) => (
											<button
												type="button"
												key={column.id}
												onClick={(event) => toggleFromRow(event, event.currentTarget, column.id)}
												className="flex w-full items-center gap-2 rounded-md border border-pro-cards-border bg-surface-elevated-1 p-2 text-left transition-colors hover:bg-pro-hover-fill"
											>
												<Icon name="plus" height={10} width={10} className="text-pro-text-tertiary" />
												<span className="text-xs text-pro-text-primary">{column.name}</span>
												{column.id.endsWith('_share') ? (
													<span className="ml-auto rounded-md bg-pro-info-100 px-1 py-0.5 text-xs text-pro-info-400 dark:bg-pro-info-300/20 dark:text-pro-info-200">
														%
													</span>
												) : null}
											</button>
										))}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="mt-4 flex items-center justify-between border-t border-pro-cards-border pt-3 text-xs">
				<span className="text-pro-text-tertiary">
					{activeColumns.length} of {columns.length} columns visible
				</span>
				<button
					type="button"
					onClick={onDone}
					className="rounded-md border border-brand bg-brand px-3 py-1 text-on-brand transition-colors hover:bg-brand-muted"
				>
					Done
				</button>
			</div>
		</div>
	)
}
