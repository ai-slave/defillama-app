import * as React from 'react'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { focusNeighborOnLeave, keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SearchField } from '~/ui/SearchField'
import { Tooltip } from '~/ui/Tooltip'
import { YIELDS_COLUMN_IDS, YIELDS_COLUMN_ID_SET, YIELDS_IDENTITY_COLUMN_ID, type YieldColumnId } from './columns'

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
	{ title: 'Pool facts', columns: ['volumeUsd1d', 'ilRisk'] },
	{ title: 'Borrow market', columns: ['apyBorrow', 'totalSupplyUsd', 'totalBorrowUsd', 'totalAvailableUsd', 'ltv'] }
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
	/** Close hands focus back to the header's Customize table toggle. */
	toggleRef: React.RefObject<HTMLButtonElement | null>
}

type ColumnButtonProps = {
	columnKey: YieldColumnId
	currentColumns: Record<string, boolean>
	columnOrder: Array<string>
	toggleColumnVisibility: (columnKey: string, isVisible: boolean) => void
	searchRef: React.RefObject<HTMLInputElement | null>
} & (
	| {
			kind: 'active'
			moveColumnUp: (columnKey: string) => void
			moveColumnDown: (columnKey: string) => void
	  }
	| { kind: 'available' }
)

function ColumnButton(props: ColumnButtonProps) {
	const { columnKey, currentColumns, columnOrder, toggleColumnVisibility, searchRef } = props
	const metadata = yieldsColumnMetadata[columnKey]
	const isActive = currentColumns[columnKey]
	const visibleColumns = columnOrder.filter((key) => currentColumns[key])
	const index = visibleColumns.indexOf(columnKey)

	return isActive ? (
		<Card data-row padding="sm" className="flex w-full items-center justify-between">
			<div className="flex items-center gap-2">
				<Icon name="check" className="size-3.5 text-success" />
				<span className="body-sm text-primary">{metadata.name}</span>
				<QuestionHelper text={metadata.description} />
			</div>
			<div className="flex items-center gap-1">
				{props.kind === 'active' ? (
					<>
						<Tooltip
							content="Move up"
							render={
								<Button
									variant="ghost"
									size="sm"
									square
									disabled={index <= 0}
									accessibleWhenDisabled
									onClick={() => props.moveColumnUp(columnKey)}
									aria-label={`Move ${metadata.name} up`}
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
									disabled={index < 0 || index >= visibleColumns.length - 1}
									accessibleWhenDisabled
									onClick={() => props.moveColumnDown(columnKey)}
									aria-label={`Move ${metadata.name} down`}
								/>
							}
						>
							<Icon name="chevron-down" className="size-4" />
						</Tooltip>
					</>
				) : null}
				{columnKey === YIELDS_IDENTITY_COLUMN_ID ? (
					<span aria-hidden className="size-6 shrink-0" />
				) : (
					<Tooltip
						content="Remove column"
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								// Hiding or adding a column moves its row to the other list; focus stays in the list the
								// reader is working in.
								ref={focusNeighborOnLeave(() => searchRef.current)}
								onClick={() => toggleColumnVisibility(columnKey, false)}
								aria-label={`Remove ${metadata.name}`}
							/>
						}
					>
						<Icon name="x" className="size-4" />
					</Tooltip>
				)}
			</div>
		</Card>
	) : (
		<Tooltip
			content={metadata.description}
			render={
				<Button
					variant="secondary"
					size="md"
					data-row
					ref={focusNeighborOnLeave(() => searchRef.current)}
					onClick={() => toggleColumnVisibility(columnKey, true)}
					className="w-full justify-start"
				/>
			}
		>
			<Icon name="plus" className="size-3.5" />
			{metadata.name}
		</Tooltip>
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
	moveColumnDown,
	toggleRef
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
	const searchRef = React.useRef<HTMLInputElement>(null)

	if (!showColumnPanel) return null

	const visibleCount = YIELDS_COLUMN_IDS.filter((key) => currentColumns[key]).length

	return (
		<Card padding="md" className="relative mb-4">
			<div className="mb-3 flex items-center justify-between">
				<h4 className="label-md text-primary">Customize columns</h4>
				<Tooltip
					content="Close"
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							onClick={() =>
								keepFocus(
									() => setShowColumnPanel(false),
									() => toggleRef.current
								)
							}
							aria-label="Close column customization"
						/>
					}
				>
					<Icon name="x" className="size-4" />
				</Tooltip>
			</div>
			<SearchField
				ref={searchRef}
				label="Search columns"
				value={searchTerm}
				onChange={setSearchTerm}
				placeholder="Search columns…"
				className="mb-3"
			/>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<p className="mb-2 label-sm text-secondary">Active columns ({visibleCount})</p>
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
									searchRef={searchRef}
								/>
							))}
					</div>
				</div>
				<div>
					<p className="mb-2 label-sm text-secondary">Available columns</p>
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
												searchRef={searchRef}
											/>
										))}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</Card>
	)
}
