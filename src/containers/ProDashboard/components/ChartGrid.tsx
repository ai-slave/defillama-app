import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { lazy, memo, type ReactNode, Suspense, useContext, useMemo, useState } from 'react'
import { SortableItem } from '~/containers/ProtocolOverview/ProtocolPro'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { StoredColSpan } from '../dashboardConfig/colSpan'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { INITIAL_DASHBOARD_STREAM_ITEM_COUNT } from '../dashboardStreamContract'
import {
	useProDashboardEditorActions,
	useProDashboardItemsState,
	useProDashboardPermissions
} from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import type { SqlChartConfig } from '../types'
import type { UnifiedTableConfig } from '../unifiedTable/config/current'
import { ConfirmationModal } from './ConfirmationModal'
import { InViewDashboardCard } from './InViewDashboardCard'
import { TextCard } from './TextCard'
import type { UnifiedTableFocusSection } from './UnifiedTable/types'

const YieldsChartCard = lazy(() => import('./YieldsChartCard').then((mod) => ({ default: mod.YieldsChartCard })))
const ChartCard = lazy(() => import('./ChartCard').then((mod) => ({ default: mod.ChartCard })))
const SqlChartCard = lazy(() =>
	import('./SqlChart/SqlChartCard').then((mod) => ({
		default: mod.SqlChartCard
	}))
)
const MultiChartCard = lazy(() => import('./MultiChartCard'))
const ChartBuilderCard = lazy(() =>
	import('./ChartBuilderCard').then((mod) => ({
		default: mod.ChartBuilderCard
	}))
)
const MetricCard = lazy(() => import('./MetricCard').then((mod) => ({ default: mod.MetricCard })))
const UnifiedTable = lazy(() => import('./UnifiedTable'))
const StablecoinsChartCard = lazy(() =>
	import('./StablecoinsChartCard').then((mod) => ({
		default: mod.StablecoinsChartCard
	}))
)
const StablecoinAssetChartCard = lazy(() =>
	import('./StablecoinAssetChartCard').then((mod) => ({
		default: mod.StablecoinAssetChartCard
	}))
)
const AdvancedTvlChartCard = lazy(() =>
	import('./AdvancedTvlChartCard').then((mod) => ({
		default: mod.AdvancedTvlChartCard
	}))
)
const BorrowedChartCard = lazy(() =>
	import('./BorrowedChartCard').then((mod) => ({
		default: mod.BorrowedChartCard
	}))
)
const IncomeStatementCard = lazy(() =>
	import('./IncomeStatementCard').then((mod) => ({
		default: mod.IncomeStatementCard
	}))
)
const UnlocksScheduleCard = lazy(() =>
	import('./UnlocksScheduleCard').then((mod) => ({
		default: mod.UnlocksScheduleCard
	}))
)
const UnlocksPieCard = lazy(() => import('./UnlocksPieCard').then((mod) => ({ default: mod.UnlocksPieCard })))
const LlamaAIChartCard = lazy(() => import('./LlamaAIChartCard'))
const RWAOverviewChartCard = lazy(() =>
	import('./RWAOverviewChartCard').then((mod) => ({
		default: mod.RWAOverviewChartCard
	}))
)
const RWAAssetChartCard = lazy(() =>
	import('./RWAAssetChartCard').then((mod) => ({
		default: mod.RWAAssetChartCard
	}))
)
const DatasetTableCard = lazy(() =>
	import('./DatasetTableCard').then((mod) => ({
		default: mod.DatasetTableCard
	}))
)

const STORED_COL_SPANS = [0.5, 1, 1.5, 2] as const satisfies ReadonlyArray<StoredColSpan>
const METRIC_COL_SPANS = [0.5, 1] as const satisfies ReadonlyArray<StoredColSpan>
const COL_SPAN_CLASS_MAP: Record<1 | 2 | 3 | 4, string> = {
	1: 'lg:col-span-1',
	2: 'lg:col-span-2',
	3: 'lg:col-span-3',
	4: 'lg:col-span-4'
}

const normalizeStoredColSpan = (span: StoredColSpan | undefined, fallback: StoredColSpan = 1): StoredColSpan =>
	span ?? fallback

const getEffectiveColSpan = (span?: StoredColSpan): 1 | 2 | 3 | 4 => {
	const stored = normalizeStoredColSpan(span)
	if (stored === 0.5) return 1
	if (stored === 1) return 2
	if (stored === 1.5) return 3
	return 4
}

type StoredColSpanOptions = readonly [StoredColSpan, ...Array<StoredColSpan>]

const getPreviousStoredColSpan = (
	span: StoredColSpan,
	options: StoredColSpanOptions = STORED_COL_SPANS
): StoredColSpan => {
	const index = options.indexOf(span)
	if (index <= 0) {
		return options[0]
	}
	const previous = options[index - 1]
	if (previous === undefined) throw new Error(`Missing previous column span for ${span}`)
	return previous
}

const getNextStoredColSpan = (span: StoredColSpan, options: StoredColSpanOptions = STORED_COL_SPANS): StoredColSpan => {
	const index = options.indexOf(span)
	if (index === -1 || index >= options.length - 1) {
		const last = options.at(-1)
		if (last === undefined) throw new Error('Column span options must not be empty')
		return last
	}
	const next = options[index + 1]
	if (next === undefined) throw new Error(`Missing next column span for ${span}`)
	return next
}

interface ChartGridProps {
	onAddChartClick: () => void
	onEditItem?: (item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => void
}

interface UnifiedTableCardProps {
	item: UnifiedTableConfig
	onEditItem?: (item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => void
}

function UnifiedTableCard({ item, onEditItem }: UnifiedTableCardProps) {
	const handleEdit = (focusSection?: UnifiedTableFocusSection) => {
		onEditItem?.(item, focusSection)
	}

	return (
		<Suspense fallback={<div className="flex min-h-[360px] flex-col p-1 md:min-h-[380px]" />}>
			<UnifiedTable config={item} {...(onEditItem ? { onEdit: handleEdit } : {})} />
		</Suspense>
	)
}

function SqlChartItem({ item }: { item: SqlChartConfig }) {
	return (
		<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
			<SqlChartCard config={item} />
		</Suspense>
	)
}

interface DashboardItemRendererBaseProps {
	item: DashboardItemConfig
	onEditItem?: (item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => void
}

type DashboardItemRendererProps = DashboardItemRendererBaseProps &
	(
		| {
				isEditable: true
				handleEditItem: (itemId: string, newItem: DashboardItemConfig) => void
		  }
		| { isEditable: false; handleEditItem?: never }
	)

const DashboardItemRenderer = memo(function DashboardItemRenderer(props: DashboardItemRendererProps) {
	const { item, isEditable, onEditItem } = props

	if (item.kind === 'chart') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<ChartCard chart={item} />
			</Suspense>
		)
	}

	if (item.kind === 'multi') {
		return (
			<Suspense fallback={<div className="flex min-h-[402px] flex-col p-1 md:min-h-[418px]" />}>
				<MultiChartCard multi={item} />
			</Suspense>
		)
	}

	if (item.kind === 'metric') {
		return (
			<Suspense fallback={<div className="flex min-h-[140px] flex-col p-1" />}>
				<MetricCard metric={item} />
			</Suspense>
		)
	}

	if (item.kind === 'builder') {
		return (
			<Suspense fallback={<div className="flex min-h-[422px] flex-col p-1 md:min-h-[438px]" />}>
				<ChartBuilderCard builder={item} />
			</Suspense>
		)
	}

	if (item.kind === 'yields') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<YieldsChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'stablecoins') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<StablecoinsChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'stablecoin-asset') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<StablecoinAssetChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'advanced-tvl') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<AdvancedTvlChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'advanced-borrowed') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<BorrowedChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'income-statement') {
		return (
			<Suspense fallback={<div className="flex min-h-[360px] flex-col p-1" />}>
				<IncomeStatementCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'unlocks-schedule') {
		return (
			<Suspense fallback={<div className="flex min-h-[360px] flex-col p-1" />}>
				<UnlocksScheduleCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'unlocks-pie') {
		return (
			<Suspense fallback={<div className="flex min-h-[360px] flex-col p-1" />}>
				<UnlocksPieCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'llamaai-chart') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<LlamaAIChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'rwa-overview') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<RWAOverviewChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'rwa-asset') {
		return (
			<Suspense fallback={<div className="flex min-h-[344px] flex-col p-1 md:min-h-[360px]" />}>
				<RWAAssetChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'sql') {
		return <SqlChartItem item={item} />
	}

	if (item.kind === 'text') {
		return <TextCard text={item} />
	}

	if (item.kind === 'unified-table') {
		return <UnifiedTableCard item={item} {...(isEditable && onEditItem ? { onEditItem } : {})} />
	}

	if (item.kind === 'dataset-table') {
		return (
			<Suspense fallback={<div className="flex min-h-[360px] flex-col p-1" />}>
				{props.isEditable ? (
					<DatasetTableCard config={item} onConfigChange={(config) => props.handleEditItem(item.id, config)} />
				) : (
					<DatasetTableCard config={item} />
				)}
			</Suspense>
		)
	}

	const exhaustiveItem: never = item
	return exhaustiveItem
})

function getReadOnlyCardMinHeight(item: DashboardItemConfig) {
	if (item.kind === 'metric') return 140
	if (item.kind === 'multi') return 418
	if (item.kind === 'builder') return 438
	if (item.kind === 'unified-table') return 380
	return 360
}

function StreamPrefetchEligibleScope({ children }: { children: ReactNode }) {
	const streamDone = useContext(StreamDoneContext)
	return <StreamDoneContext.Provider value={streamDone}>{children}</StreamDoneContext.Provider>
}

function DashboardCardStreamScope({
	children,
	streamPrefetchEligible
}: {
	children: ReactNode
	streamPrefetchEligible: boolean
}) {
	return streamPrefetchEligible ? (
		<StreamPrefetchEligibleScope>{children}</StreamPrefetchEligibleScope>
	) : (
		<StreamDoneContext.Provider value>{children}</StreamDoneContext.Provider>
	)
}

interface ReadOnlyDashboardItemProps {
	item: DashboardItemConfig
	streamPrefetchEligible: boolean
}

const ReadOnlyDashboardItem = memo(function ReadOnlyDashboardItem({
	item,
	streamPrefetchEligible
}: ReadOnlyDashboardItemProps) {
	const spanOptions = item.kind === 'metric' ? METRIC_COL_SPANS : STORED_COL_SPANS
	const fallbackSpan: StoredColSpan = item.kind === 'metric' ? spanOptions[0] : 1
	const storedColSpan = normalizeStoredColSpan(item.colSpan, fallbackSpan)
	const effectiveColSpan = getEffectiveColSpan(storedColSpan)
	const content = <DashboardItemRenderer item={item} isEditable={false} />

	return (
		<div
			className={`col-span-1 rounded-md border border-pro-cards-border bg-pro-cards-bg ${COL_SPAN_CLASS_MAP[effectiveColSpan]}`}
		>
			{item.kind === 'text' ? (
				content
			) : (
				<InViewDashboardCard minHeight={getReadOnlyCardMinHeight(item)}>
					<DashboardCardStreamScope streamPrefetchEligible={streamPrefetchEligible}>{content}</DashboardCardStreamScope>
				</InViewDashboardCard>
			)}
		</div>
	)
})

export function ChartGrid({ onAddChartClick, onEditItem }: ChartGridProps) {
	const { items } = useProDashboardItemsState()
	const { handleChartsReordered, handleRemoveItem, handleColSpanChange, handleEditItem } =
		useProDashboardEditorActions()
	const { isReadOnly } = useProDashboardPermissions()
	const [deleteConfirmItem, setDeleteConfirmItem] = useState<string | null>(null)
	const isSmallScreen = useMedia('(max-width: 768px)')

	const sortableItemIds = useMemo(() => items.map((item) => item.id), [items])

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: isSmallScreen ? 999_999 : 5
			}
		}),
		useSensor(KeyboardSensor)
	)

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event

		if (over && active.id !== over.id) {
			const oldIndex = items.findIndex((item) => item.id === active.id)
			const newIndex = items.findIndex((item) => item.id === over.id)
			const newCharts = arrayMove(items, oldIndex, newIndex)
			handleChartsReordered(newCharts)
		}
	}

	const handleDeleteClick = (itemId: string) => {
		setDeleteConfirmItem(itemId)
	}

	const handleConfirmDelete = () => {
		if (deleteConfirmItem) {
			handleRemoveItem(deleteConfirmItem)
			setDeleteConfirmItem(null)
		}
	}

	const handleCancelDelete = () => {
		setDeleteConfirmItem(null)
	}

	if (isReadOnly) {
		return (
			<div className="grid grid-flow-dense grid-cols-1 gap-2 lg:grid-cols-4">
				{items.map((item, index) => (
					<ReadOnlyDashboardItem
						key={item.id}
						item={item}
						streamPrefetchEligible={index < INITIAL_DASHBOARD_STREAM_ITEM_COUNT}
					/>
				))}
			</div>
		)
	}

	return (
		<>
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
				<SortableContext items={sortableItemIds} strategy={rectSortingStrategy}>
					<div className="grid grid-flow-dense grid-cols-1 gap-2 lg:grid-cols-4">
						{items.map((item, index) => {
							const spanOptions = item.kind === 'metric' ? METRIC_COL_SPANS : STORED_COL_SPANS
							const fallbackSpan: StoredColSpan = item.kind === 'metric' ? spanOptions[0] : 1
							const storedColSpan = normalizeStoredColSpan(item.colSpan, fallbackSpan)
							const effectiveColSpan = getEffectiveColSpan(storedColSpan)
							const shrinkTarget = getPreviousStoredColSpan(storedColSpan, spanOptions)
							const expandTarget = getNextStoredColSpan(storedColSpan, spanOptions)
							const disableShrink = shrinkTarget === storedColSpan
							const disableExpand = expandTarget === storedColSpan
							const streamPrefetchEligible = index < INITIAL_DASHBOARD_STREAM_ITEM_COUNT

							return (
								<SortableItem
									key={item.id}
									id={item.id}
									isTable={item.kind === 'dataset-table'}
									data-col={item.colSpan}
									className={`col-span-1 flex flex-col overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg ${COL_SPAN_CLASS_MAP[effectiveColSpan]}`}
								>
									<div className="flex flex-wrap items-center justify-end border-b border-pro-cards-border">
										{item.kind !== 'dataset-table' ? (
											<>
												<Tooltip
													content="Shrink width"
													render={
														<button
															type="button"
															onClick={() => handleColSpanChange(item.id, shrinkTarget)}
															disabled={disableShrink}
														/>
													}
													className="px-3 py-2 hover:pro-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
												>
													<Icon name="minus" height={14} width={14} />
													<span className="sr-only">Shrink width</span>
												</Tooltip>
												<Tooltip
													content="Expand width"
													render={
														<button
															type="button"
															onClick={() => handleColSpanChange(item.id, expandTarget)}
															disabled={disableExpand}
														/>
													}
													className="px-3 py-2 hover:pro-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
												>
													<Icon name="plus" height={14} width={14} />
													<span className="sr-only">Expand width</span>
												</Tooltip>
											</>
										) : null}
										{onEditItem && !(item.kind === 'text' && item.allowHtml) ? (
											<Tooltip
												content="Edit item"
												render={<button type="button" onClick={() => onEditItem(item)} />}
												className="px-3 py-2 hover:pro-btn-primary"
											>
												<Icon name="pencil" height={14} width={14} />
												<span className="sr-only">Edit item</span>
											</Tooltip>
										) : null}
										<Tooltip
											content="Remove item"
											render={<button type="button" onClick={() => handleDeleteClick(item.id)} />}
											className="rounded-tr-md px-3 py-2 hover:bg-error/10 hover:text-error"
										>
											<Icon name="x" height={14} width={14} />
											<span className="sr-only">Remove item</span>
										</Tooltip>
									</div>
									<div className="min-h-0 flex-1">
										{item.kind === 'text' ? (
											<DashboardItemRenderer
												item={item}
												isEditable
												handleEditItem={handleEditItem}
												{...(onEditItem !== undefined ? { onEditItem } : {})}
											/>
										) : (
											<InViewDashboardCard minHeight={getReadOnlyCardMinHeight(item)}>
												<DashboardCardStreamScope streamPrefetchEligible={streamPrefetchEligible}>
													<DashboardItemRenderer
														item={item}
														isEditable
														handleEditItem={handleEditItem}
														{...(onEditItem !== undefined ? { onEditItem } : {})}
													/>
												</DashboardCardStreamScope>
											</InViewDashboardCard>
										)}
									</div>
								</SortableItem>
							)
						})}
						<button
							type="button"
							onClick={onAddChartClick}
							className="relative isolate flex min-h-[340px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-pro-cards-border bg-pro-cards-bg p-2.5 text-link hover:bg-pro-info-300/5 dark:hover:bg-pro-info-300/10"
						>
							<svg
								width="40"
								height="40"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							<span className="text-lg font-medium">Add Item</span>
						</button>
					</div>
				</SortableContext>
			</DndContext>

			<ConfirmationModal
				isOpen={!!deleteConfirmItem}
				onClose={handleCancelDelete}
				onConfirm={handleConfirmDelete}
				title="Remove Item"
				message="Are you sure you want to remove this item from your dashboard? This action cannot be undone."
				confirmText="Remove"
				cancelText="Cancel"
			/>
		</>
	)
}
