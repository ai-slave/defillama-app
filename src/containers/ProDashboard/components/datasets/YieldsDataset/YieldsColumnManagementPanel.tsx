import * as React from 'react'
import { Icon } from '~/ui/Icon'
import { YIELDS_COLUMN_IDS, YIELDS_COLUMN_ID_SET, type YieldColumnId } from './columns'

const yieldsColumnMetadata: Record<YieldColumnId, { name: string; description: string }> = {
	pool: { name: 'Pool', description: 'The pool or strategy name' },
	project: { name: 'Protocol', description: 'The protocol offering the opportunity' },
	chains: { name: 'Chain', description: 'The network where the pool operates' },
	tvl: { name: 'TVL', description: 'The current USD value tracked for the earn pool' },
	apy: { name: 'Supply APY', description: 'Current base and reward supply APY' },
	apyBase: { name: 'Base APY', description: 'Current base supply APY' },
	apyReward: { name: 'Reward APY', description: 'Current reward-token APY' },
	apyMean30d: { name: '30d Avg APY', description: 'Average total supply APY over 30 days' },
	stabilityRating: { name: '30d Stability', description: 'V2 supply APY stability classification' },
	volumeUsd1d: { name: '24h Volume', description: 'Tracked pool volume over 24 hours' },
	ilRisk: { name: 'IL Risk', description: 'Whether the pool has impermanent-loss exposure' },
	apyBorrow: { name: 'Borrow Cost APY', description: 'Current net cost to borrow' },
	totalSupplyUsd: { name: 'Total Supplied', description: 'Current supplied value for a matching borrow market' },
	totalBorrowUsd: { name: 'Total Borrowed', description: 'Current borrowed value' },
	totalAvailableUsd: { name: 'Available', description: 'Current liquidity available to borrow' },
	ltv: { name: 'LTV', description: 'Maximum loan-to-value ratio' }
}

const columnGroups: Array<{ title: string; columns: Array<YieldColumnId> }> = [
	{ title: 'Pool', columns: ['pool', 'project', 'chains', 'tvl'] },
	{ title: 'Supply APY', columns: ['apy', 'apyBase', 'apyReward', 'apyMean30d', 'stabilityRating'] },
	{ title: 'Pool Facts', columns: ['volumeUsd1d', 'ilRisk'] },
	{ title: 'Borrow Market', columns: ['apyBorrow', 'totalSupplyUsd', 'totalBorrowUsd', 'totalAvailableUsd', 'ltv'] }
]

interface YieldsColumnManagementPanelProps {
	showColumnPanel: boolean
	setShowColumnPanel: (show: boolean) => void
	searchTerm: string
	setSearchTerm: (term: string) => void
	currentColumns: Record<string, boolean>
	columnOrder: Array<string>
	toggleColumnVisibility: (columnKey: string, isVisible: boolean) => void
	moveColumnUp: (columnKey: string) => void
	moveColumnDown: (columnKey: string) => void
}

type ColumnButtonProps = {
	columnKey: YieldColumnId
	currentColumns: Record<string, boolean>
	columnOrder: Array<string>
	toggleColumnVisibility: (columnKey: string, isVisible: boolean) => void
} & (
	| {
			kind: 'active'
			moveColumnUp: (columnKey: string) => void
			moveColumnDown: (columnKey: string) => void
	  }
	| { kind: 'available' }
)

function ColumnButton(props: ColumnButtonProps) {
	const { columnKey, currentColumns, columnOrder, toggleColumnVisibility } = props
	const metadata = yieldsColumnMetadata[columnKey]
	const isActive = currentColumns[columnKey]
	const visibleColumns = columnOrder.filter((key) => currentColumns[key])
	const index = visibleColumns.indexOf(columnKey)

	return isActive ? (
		<div
			className="flex w-full items-center justify-between rounded-md border border-subtle bg-surface p-2"
			title={metadata.description}
		>
			<div className="flex items-center gap-2">
				<Icon name="check" className="size-3 text-success" />
				<span className="text-xs text-primary">{metadata.name}</span>
			</div>
			<div className="flex items-center gap-1">
				{props.kind === 'active' && index > 0 ? (
					<button
						type="button"
						onClick={() => props.moveColumnUp(columnKey)}
						className="p-1 text-tertiary hover:text-primary"
						title="Move up"
					>
						<Icon name="chevron-up" className="size-2.5" />
					</button>
				) : null}
				{props.kind === 'active' && index >= 0 && index < visibleColumns.length - 1 ? (
					<button
						type="button"
						onClick={() => props.moveColumnDown(columnKey)}
						className="p-1 text-tertiary hover:text-primary"
						title="Move down"
					>
						<Icon name="chevron-down" className="size-2.5" />
					</button>
				) : null}
				<button
					type="button"
					onClick={() => toggleColumnVisibility(columnKey, false)}
					className="p-1 text-tertiary hover:text-primary"
					title="Remove column"
				>
					<Icon name="x" className="size-3" />
				</button>
			</div>
		</div>
	) : (
		<button
			type="button"
			onClick={() => toggleColumnVisibility(columnKey, true)}
			className="hover:bg-surface-secondary flex w-full items-center gap-2 rounded-md border border-subtle bg-surface p-2 text-left"
			title={metadata.description}
		>
			<Icon name="plus" className="size-2.5 text-tertiary" />
			<span className="text-xs text-primary">{metadata.name}</span>
		</button>
	)
}

export function YieldsColumnManagementPanel({
	showColumnPanel,
	setShowColumnPanel,
	searchTerm,
	setSearchTerm,
	currentColumns,
	columnOrder,
	toggleColumnVisibility,
	moveColumnUp,
	moveColumnDown
}: YieldsColumnManagementPanelProps) {
	const filteredColumns = React.useMemo(() => {
		const lowerSearch = searchTerm.toLowerCase()
		return YIELDS_COLUMN_IDS.filter((key) => {
			const metadata = yieldsColumnMetadata[key]
			return (
				!lowerSearch ||
				metadata.name.toLowerCase().includes(lowerSearch) ||
				metadata.description.toLowerCase().includes(lowerSearch)
			)
		})
	}, [searchTerm])
	const filteredColumnSet = new Set(filteredColumns)

	if (!showColumnPanel) return null

	const visibleCount = YIELDS_COLUMN_IDS.filter((key) => currentColumns[key]).length

	return (
		<div className="relative mb-4 rounded-md border border-subtle bg-surface p-4">
			<div className="mb-3 flex items-center justify-between">
				<h4 className="text-sm font-medium text-primary">Customize columns</h4>
				<button
					type="button"
					onClick={() => setShowColumnPanel(false)}
					className="p-1 text-tertiary hover:text-primary"
					aria-label="Close column customization"
					title="Close"
				>
					<Icon name="x" className="size-4" />
				</button>
			</div>
			<div className="relative mb-3">
				<Icon name="search" className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tertiary" />
				<input
					type="text"
					placeholder="Search columns..."
					value={searchTerm}
					onChange={(event) => setSearchTerm(event.currentTarget.value)}
					className="bg-surface-secondary w-full rounded-md border border-subtle py-2 pr-3 pl-9 text-sm text-primary"
				/>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<p className="mb-2 text-xs font-medium text-secondary">Active columns ({visibleCount})</p>
					<div className="max-h-64 space-y-1 overflow-y-auto">
						{columnOrder
							.filter((key): key is YieldColumnId => YIELDS_COLUMN_ID_SET.has(key) && Boolean(currentColumns[key]))
							.map((columnKey) => (
								<ColumnButton
									key={columnKey}
									kind="active"
									columnKey={columnKey}
									currentColumns={currentColumns}
									columnOrder={columnOrder}
									moveColumnUp={moveColumnUp}
									moveColumnDown={moveColumnDown}
									toggleColumnVisibility={toggleColumnVisibility}
								/>
							))}
					</div>
				</div>
				<div>
					<p className="mb-2 text-xs font-medium text-secondary">Available columns</p>
					<div className="max-h-64 space-y-3 overflow-y-auto">
						{columnGroups.map((group) => {
							const columns = group.columns.filter((key) => filteredColumnSet.has(key))
							if (columns.length === 0) return null
							return (
								<div key={group.title}>
									<p className="mb-1 label-sm text-tertiary">{group.title}</p>
									<div className="space-y-1">
										{columns.map((columnKey) => (
											<ColumnButton
												key={columnKey}
												kind="available"
												columnKey={columnKey}
												currentColumns={currentColumns}
												columnOrder={columnOrder}
												toggleColumnVisibility={toggleColumnVisibility}
											/>
										))}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}
