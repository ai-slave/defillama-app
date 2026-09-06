import * as React from 'react'
import { Icon } from '~/ui/Icon'

interface Column {
	id: string
	name: string
	category?: string
}

interface ColumnManagementPanelProps {
	showColumnPanel: boolean
	setShowColumnPanel: (show: boolean) => void
	columns: Array<Column>
	columnVisibility: Record<string, boolean>
	columnOrder: Array<string>
	toggleColumnVisibility: (columnId: string) => void
	moveColumnUp?: (columnId: string) => void
	moveColumnDown?: (columnId: string) => void
}

export function ColumnManagementPanel({
	showColumnPanel,
	setShowColumnPanel,
	columns,
	columnVisibility,
	columnOrder,
	toggleColumnVisibility,
	moveColumnUp,
	moveColumnDown
}: ColumnManagementPanelProps) {
	const [searchTerm, setSearchTerm] = React.useState('')

	const filteredColumns = React.useMemo(() => {
		return columns.filter((column) => column.name && column.name.toLowerCase().includes(searchTerm.toLowerCase()))
	}, [columns, searchTerm])

	const percentageShareColumns = React.useMemo(() => {
		return filteredColumns.filter((col) => col.id.endsWith('_share'))
	}, [filteredColumns])

	const standardColumns = React.useMemo(() => {
		return filteredColumns.filter((col) => !col.id.endsWith('_share'))
	}, [filteredColumns])

	const columnGroups = React.useMemo(() => {
		const groups = [
			{
				title: 'Percentage Share',
				columns: percentageShareColumns,
				show: percentageShareColumns.length > 0
			},
			{
				title: 'Standard Metrics',
				columns: standardColumns,
				show: standardColumns.length > 0
			}
		]
		return groups.filter((group) => group.show)
	}, [percentageShareColumns, standardColumns])

	const activeColumns = React.useMemo(() => {
		const orderedVisibleColumns = columnOrder.filter((id) => columnVisibility[id] !== false)
		const unorderedVisibleColumns = columns
			.filter((col) => columnVisibility[col.id] !== false && !columnOrder.includes(col.id))
			.map((col) => col.id)
		return [...orderedVisibleColumns, ...unorderedVisibleColumns]
	}, [columnOrder, columnVisibility, columns])

	if (!showColumnPanel) return null

	return (
		<div className="mb-4 rounded-md border border-pro-cards-border bg-pro-cards-bg p-4">
			<div className="mb-3 flex items-center justify-between">
				<h4 className="text-sm font-medium text-pro-text-primary">Customize Columns</h4>
				<div className="flex items-center gap-2">
					<button
						onClick={() => {
							for (const col of columns) {
								if (columnVisibility[col.id] === false) {
									toggleColumnVisibility(col.id)
								}
							}
						}}
						className="rounded-md border pro-divider pro-hover-bg pro-panel-raised px-2 py-1 text-xs text-pro-text-secondary transition-colors"
					>
						Show All
					</button>
					<button
						onClick={() => {
							for (const col of columns) {
								if (col.id !== 'name' && columnVisibility[col.id] !== false) {
									toggleColumnVisibility(col.id)
								}
							}
						}}
						className="rounded-md border pro-divider pro-hover-bg pro-panel-raised px-2 py-1 text-xs text-pro-text-secondary transition-colors"
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
					type="text"
					placeholder="Search columns..."
					defaultValue={searchTerm}
					onInput={(e) => setSearchTerm(e.currentTarget.value)}
					className="w-full rounded-md border pro-border bg-pro-glass-bg py-2 pr-3 pl-9 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
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

							const isFirst = index === 0
							const isLast = index === activeColumns.length - 1

							return (
								<div
									key={columnId}
									className="flex items-center justify-between rounded-md border pro-divider pro-hover-bg pro-panel-raised p-2 transition-colors"
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
										{moveColumnUp && !isFirst ? (
											<button
												onClick={() => moveColumnUp(columnId)}
												className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
												title="Move up"
											>
												<Icon name="chevron-up" height={10} width={10} />
											</button>
										) : null}
										{moveColumnDown && !isLast ? (
											<button
												onClick={() => moveColumnDown(columnId)}
												className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
												title="Move down"
											>
												<Icon name="chevron-down" height={10} width={10} />
											</button>
										) : null}
										<button
											onClick={() => toggleColumnVisibility(columnId)}
											className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
											disabled={columnId === 'name'}
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
												key={column.id}
												onClick={() => toggleColumnVisibility(column.id)}
												className="flex w-full items-center gap-2 rounded-md border pro-divider pro-hover-bg pro-panel-raised p-2 text-left transition-colors"
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

			<div className="mt-4 flex items-center justify-between border-t pro-divider pt-3 text-xs">
				<span className="text-pro-text-tertiary">
					{activeColumns.length} of {columns.length} columns visible
				</span>
				<button
					onClick={() => setShowColumnPanel(false)}
					className="rounded-md border border-brand bg-brand px-3 py-1 text-on-brand transition-colors hover:bg-brand-muted"
				>
					Done
				</button>
			</div>
		</div>
	)
}
