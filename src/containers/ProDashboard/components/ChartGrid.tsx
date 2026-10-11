import {
	type Announcements,
	closestCenter,
	defaultDropAnimationSideEffects,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	type DropAnimation,
	KeyboardSensor,
	PointerSensor,
	type ScreenReaderInstructions,
	type UniqueIdentifier,
	useSensor,
	useSensors
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useRouter } from 'next/router'
import {
	lazy,
	memo,
	type ReactNode,
	Suspense,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import { ChartMotionContext } from '~/components/ECharts/shared/chartMotion'
import { ChartWatermarkContext } from '~/components/ECharts/shared/watermark'
import { SortableItem } from '~/containers/ProtocolOverview/ProtocolPro'
import { useMedia } from '~/hooks/useMedia'
import { usePrefersReducedMotion } from '~/hooks/usePrefersReducedMotion'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import type { StoredColSpan } from '../dashboardConfig/colSpan'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import {
	buildDashboardLayout,
	type DashboardLayout,
	type DashboardLayoutGroup,
	type DashboardLayoutTab,
	findGroupHeadingForItem,
	moveDashboardItemWithinBounds,
	moveSectionWithChildren,
	removeSectionKeepingChildren,
	resolveDropIndex,
	sectionRange,
	streamPrefetchItemIds,
	visibleGroupBounds
} from '../dashboardLayout/buildDashboardLayout'
import {
	cardScaleStyle,
	dashboardItemSupportsHeight,
	getCardHeightScale,
	getReadOnlyCardMinHeight,
	getDashboardItemHeight
} from '../dashboardLayout/cardHeight'
import type { DashboardHistoryEntry } from '../dashboardReducer'

export { getReadOnlyCardMinHeight }
import { INITIAL_DASHBOARD_STREAM_ITEM_COUNT } from '../dashboardStreamContract'
import type { ParameterUnavailable } from '../dashboardVariables/resolve'
import { useCollapsedSections } from '../hooks/useCollapsedSections'
import {
	dashboardItemElementId,
	type DashboardItemRevealOptions,
	requestDashboardItemReveal,
	useDashboardItemDeepLink
} from '../hooks/useDashboardItemDeepLink'
import {
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardHistory,
	useProDashboardItemsState,
	useProDashboardPermissions,
	useProDashboardVariables
} from '../ProDashboardAPIContext'
import { StreamDoneContext, StreamItemReadinessContext } from '../queries'
import { DASHBOARD_CARD_HEIGHTS, type DashboardCardHeight, type SectionConfig, type SqlChartConfig } from '../types'
import { DashedTile, ProMeta } from '../ui'
import { proCardShellStyles } from '../ui/styles'
import type { UnifiedTableConfig } from '../unifiedTable/config/current'
import { type DashboardItemPlacement, type DashboardWriteResult, toastRefusal } from '../useDashboardActions'
import { generateItemId } from '../utils/dashboardUtils'
import { gridColumnSpan, itemColSpan, itemColSpanOptions, itemSpansFullRow } from './cardColSpan'
import { CardHeightScaleContext } from './cardHeightContext'
import { CollapsibleGroup } from './CollapsibleGroup'
import { DashboardCardContext, type DashboardCardContextValue } from './DashboardCardContext'
import { DashboardCardLoader } from './DashboardCardLoader'
import { DashboardTabs } from './DashboardTabs'
import { actionToast, TOAST_DURATION_UNDO } from './dashboardToasts'
import { dragAnnouncement } from './dragAnnouncements'
import { DragPreviewCard } from './DragPreviewCard'
import { InViewDashboardCard } from './InViewDashboardCard'
import { ParameterUnavailableCard } from './ParameterUnavailableCard'
import { SectionCard } from './SectionCard'
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
const CustomDataCard = lazy(() =>
	import('./CustomData/CustomDataCard').then((mod) => ({
		default: mod.CustomDataCard
	}))
)

const COL_SPAN_CLASS_MAP: Record<1 | 2 | 3 | 4, string> = {
	1: 'lg:col-span-1',
	2: 'lg:col-span-2',
	3: 'lg:col-span-3',
	4: 'lg:col-span-4'
}
const GROUP_GRID_CLASS = 'grid grid-flow-dense grid-cols-1 gap-3 lg:grid-cols-4'
const DRAGGING_CARD_CLASS =
	'data-[dragging=true]:border-dashed data-[dragging=true]:border-brand-strong data-[dragging=true]:bg-page data-[dragging=true]:shadow-none data-[dragging=true]:*:opacity-0'
const DROP_ANIMATION: DropAnimation = {
	duration: 200,
	easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
	sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } })
}
const DRAG_OVERLAY_TRANSITION = 'transform 180ms cubic-bezier(0.25, 1, 0.5, 1)'
const DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
	draggable: 'Press space to pick up a card, arrow keys to move it, space to drop, escape to cancel.'
}
const STATIC_SORTABLE = { draggable: true, droppable: true } as const
const CARD_REMOVED_TOAST_ID = 'card-removed'
const SECTION_REMOVED_TOAST_ID = 'section-removed'
const NO_CARD_HEIGHTS: ReadonlyArray<DashboardCardHeight> = []

interface ChartGridProps {
	onAddChartClick: (placement?: DashboardItemPlacement) => void
	onEditItem?: (item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => void
	tabQueryParam?: string | undefined
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
		<Suspense fallback={<DashboardCardLoader className="min-h-[360px] md:min-h-[380px]" kind="unified-table" />}>
			<UnifiedTable config={item} {...(onEditItem ? { onEdit: handleEdit } : {})} />
		</Suspense>
	)
}

function SqlChartItem({ item }: { item: SqlChartConfig }) {
	return (
		<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="sql" />}>
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
				handleEditItem: (itemId: string, newItem: DashboardItemConfig) => DashboardWriteResult
		  }
		| { isEditable: false; handleEditItem?: never }
	)

// Two of its three call sites sit inside the grid's item map, where the compiler caches the callback
// rather than each element, so an unrelated card changing would otherwise re-render every renderer.
export const DashboardItemRenderer = memo(function DashboardItemRenderer(props: DashboardItemRendererProps) {
	const { item, isEditable, onEditItem } = props

	if (item.kind === 'chart') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="chart" />}>
				<ChartCard chart={item} />
			</Suspense>
		)
	}

	if (item.kind === 'multi') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[402px] md:min-h-[418px]" kind="multi" />}>
				<MultiChartCard multi={item} />
			</Suspense>
		)
	}

	if (item.kind === 'metric') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[140px]" kind="metric" />}>
				<MetricCard metric={item} />
			</Suspense>
		)
	}

	if (item.kind === 'builder') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[422px] md:min-h-[438px]" kind="builder" />}>
				<ChartBuilderCard builder={item} />
			</Suspense>
		)
	}

	if (item.kind === 'yields') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="yields" />}>
				<YieldsChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'stablecoins') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="stablecoins" />}>
				<StablecoinsChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'stablecoin-asset') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="stablecoin-asset" />}>
				<StablecoinAssetChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'advanced-tvl') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="advanced-tvl" />}>
				<AdvancedTvlChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'advanced-borrowed') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="advanced-borrowed" />}>
				<BorrowedChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'income-statement') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[360px]" kind="income-statement" />}>
				<IncomeStatementCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'unlocks-schedule') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[360px]" kind="unlocks-schedule" />}>
				<UnlocksScheduleCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'unlocks-pie') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[360px]" kind="unlocks-pie" />}>
				<UnlocksPieCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'llamaai-chart') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="llamaai-chart" />}>
				<LlamaAIChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'rwa-overview') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="rwa-overview" />}>
				<RWAOverviewChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'rwa-asset') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[344px] md:min-h-[360px]" kind="rwa-asset" />}>
				<RWAAssetChartCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'sql') {
		return <SqlChartItem item={item} />
	}

	if (item.kind === 'custom-data') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[380px]" kind="custom-data" />}>
				<CustomDataCard config={item} />
			</Suspense>
		)
	}

	if (item.kind === 'text') {
		return <TextCard text={item} />
	}

	if (item.kind === 'section') {
		return null
	}

	if (item.kind === 'unified-table') {
		return <UnifiedTableCard item={item} {...(isEditable && onEditItem ? { onEditItem } : {})} />
	}

	if (item.kind === 'dataset-table') {
		return (
			<Suspense fallback={<DashboardCardLoader className="min-h-[360px]" kind="dataset-table" />}>
				{props.isEditable ? (
					<DatasetTableCard
						config={item}
						onConfigChange={(config) => toastRefusal(props.handleEditItem(item.id, config))}
					/>
				) : (
					<DatasetTableCard config={item} />
				)}
			</Suspense>
		)
	}

	const exhaustiveItem: never = item
	return exhaustiveItem
})

function StreamPrefetchEligibleScope({ children, itemId }: { children: ReactNode; itemId: string }) {
	const streamDone = useContext(StreamDoneContext)
	const readyItemIds = useContext(StreamItemReadinessContext)
	const value = streamDone || readyItemIds?.has(itemId) === true
	return <StreamDoneContext.Provider value={value}>{children}</StreamDoneContext.Provider>
}

export function DashboardCardStreamScope({
	children,
	streamPrefetchEligible,
	itemId
}: {
	children: ReactNode
	streamPrefetchEligible: boolean
	itemId: string
}) {
	return streamPrefetchEligible ? (
		<StreamPrefetchEligibleScope itemId={itemId}>{children}</StreamPrefetchEligibleScope>
	) : (
		<StreamDoneContext.Provider value>{children}</StreamDoneContext.Provider>
	)
}

const CardBody = memo(function CardBody({
	item,
	rawItem,
	unavailable,
	streamPrefetchEligible,
	editable,
	canMoveUp,
	canMoveDown,
	onEditItem,
	handleEditItem,
	onColSpanChange,
	onHeightChange,
	onMoveItem,
	onRemoveItem
}: {
	item: DashboardItemConfig
	rawItem: DashboardItemConfig
	unavailable: ParameterUnavailable | undefined
	streamPrefetchEligible: boolean
	editable: boolean
	canMoveUp: boolean
	canMoveDown: boolean
	onEditItem?: ((item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => void) | undefined
	handleEditItem?: ((itemId: string, newItem: DashboardItemConfig) => DashboardWriteResult) | undefined
	onColSpanChange?: ((itemId: string, colSpan: StoredColSpan) => void) | undefined
	onHeightChange?: ((itemId: string, height: DashboardCardHeight) => void) | undefined
	onMoveItem?: ((itemId: string, direction: -1 | 1) => void) | undefined
	onRemoveItem?: ((itemId: string) => void) | undefined
}) {
	const editRaw = onEditItem
		? (_item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => onEditItem(rawItem, focusSection)
		: undefined
	const content = unavailable ? (
		<ParameterUnavailableCard
			item={rawItem}
			unavailable={unavailable}
			onEdit={editable && onEditItem ? () => onEditItem(rawItem) : undefined}
		/>
	) : editable && handleEditItem ? (
		<DashboardItemRenderer
			item={item}
			isEditable
			handleEditItem={handleEditItem}
			{...(editRaw !== undefined ? { onEditItem: editRaw } : {})}
		/>
	) : (
		<DashboardItemRenderer item={item} isEditable={false} />
	)
	const cardContextValue = useMemo<DashboardCardContextValue>(() => {
		const allowsEdit = !(rawItem.kind === 'text' && rawItem.allowHtml)
		const onEdit = editable && onEditItem && allowsEdit ? () => onEditItem(rawItem) : undefined
		const onRemove = editable && onRemoveItem ? () => onRemoveItem(rawItem.id) : undefined
		if (!onColSpanChange || !onHeightChange || !onMoveItem) return { itemId: rawItem.id, onEdit, onRemove }
		const supportsHeight = dashboardItemSupportsHeight(rawItem)
		return {
			itemId: rawItem.id,
			onEdit,
			onRemove,
			layout: {
				colSpan: itemColSpan(rawItem),
				colSpanOptions: itemColSpanOptions(rawItem),
				onColSpanChange: (colSpan) => onColSpanChange(rawItem.id, colSpan),
				height: supportsHeight ? getDashboardItemHeight(rawItem) : null,
				heightOptions: supportsHeight ? DASHBOARD_CARD_HEIGHTS : NO_CARD_HEIGHTS,
				onHeightChange: (height) => onHeightChange(rawItem.id, height),
				canMoveUp,
				canMoveDown,
				onMove: (direction) => onMoveItem(rawItem.id, direction)
			}
		}
	}, [rawItem, editable, onEditItem, onRemoveItem, canMoveUp, canMoveDown, onColSpanChange, onHeightChange, onMoveItem])
	const cardHeightScale = getCardHeightScale(getDashboardItemHeight(rawItem))
	const scoped = (
		<DashboardCardContext.Provider value={cardContextValue}>
			<CardHeightScaleContext.Provider value={cardHeightScale}>{content}</CardHeightScaleContext.Provider>
		</DashboardCardContext.Provider>
	)
	if (item.kind === 'text') return scoped
	return (
		<InViewDashboardCard minHeight={getReadOnlyCardMinHeight(rawItem)} kind={rawItem.kind}>
			<DashboardCardStreamScope streamPrefetchEligible={streamPrefetchEligible} itemId={rawItem.id}>
				{scoped}
			</DashboardCardStreamScope>
		</InViewDashboardCard>
	)
})

function useActiveTab(layout: DashboardLayout, tabQueryParam: string | undefined) {
	const router = useRouter()
	const [localTab, setLocalTab] = useState<string | null>(null)
	const tabs = layout.tabs
	const queryValue = tabQueryParam ? router.query[tabQueryParam] : undefined
	const requested = tabQueryParam ? (Array.isArray(queryValue) ? queryValue[0] : queryValue) : localTab
	const firstTabId = tabs?.[0]?.section.id ?? null
	const activeTabId =
		tabs && requested && tabs.some((tab) => tab.section.id === requested) ? requested : (firstTabId ?? null)
	const staleTabQuery = tabQueryParam !== undefined && tabs === null && queryValue !== undefined
	useEffect(() => {
		if (!staleTabQuery || !tabQueryParam) return
		const query = { ...router.query }
		delete query[tabQueryParam]
		void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false })
	}, [staleTabQuery, tabQueryParam, router])
	const setActiveTab = useCallback(
		(tabId: string) => {
			if (!tabQueryParam) {
				setLocalTab(tabId)
				return
			}
			const query = { ...router.query }
			if (tabId === firstTabId) delete query[tabQueryParam]
			else query[tabQueryParam] = tabId
			void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false })
		},
		[router, tabQueryParam, firstTabId]
	)
	return { activeTabId, setActiveTab }
}

export function ChartGrid({ onAddChartClick, onEditItem, tabQueryParam }: ChartGridProps) {
	const { items } = useProDashboardItemsState()
	const { resolvedItems, unavailableByItemId } = useProDashboardVariables()
	const { dashboardId } = useProDashboardDashboard()
	const {
		handleChartsReordered,
		handleRemoveItem,
		handleColSpanChange,
		handleHeightChange,
		handleEditItem,
		handleUpdateSection
	} = useProDashboardEditorActions()
	const { undo, undoEntry } = useProDashboardHistory()
	const { isReadOnly } = useProDashboardPermissions()
	const isSmallScreen = useMedia('(max-width: 768px)')
	const gridRef = useRef<HTMLDivElement>(null)
	const reducedMotion = usePrefersReducedMotion()
	const [autoFocusSectionId, setAutoFocusSectionId] = useState<string | null>(null)
	const [activeDragId, setActiveDragId] = useState<string | null>(null)

	const rawById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
	const layout = useMemo(() => buildDashboardLayout(resolvedItems), [resolvedItems])
	const prefetchIds = useMemo(() => new Set(streamPrefetchItemIds(items, INITIAL_DASHBOARD_STREAM_ITEM_COUNT)), [items])
	const { activeTabId, setActiveTab } = useActiveTab(layout, tabQueryParam)
	const { isCollapsed, toggle: toggleCollapsed, expand: expandSection } = useCollapsedSections(dashboardId)
	const revealItem = useCallback(
		(itemId: string) => {
			const heading = findGroupHeadingForItem(layout, itemId)
			if (heading) expandSection(heading)
		},
		[layout, expandSection]
	)
	const onRevealRequest = useCallback((itemId: string, options: DashboardItemRevealOptions) => {
		if (options.focusTitle) setAutoFocusSectionId(itemId)
	}, [])
	useDashboardItemDeepLink({
		layout,
		setActiveTab,
		enabled: typeof window !== 'undefined',
		revealItem,
		onRevealRequest
	})
	const sortableItemIds = useMemo(() => items.map((item) => item.id), [items])

	// A removal toast belongs to the undo entry its removal pushes ('pending' until that commit lands), so
	// any other newest entry means a later edit, undo or redo. Compare entries, not depth: once history is
	// full, every edit leaves the depth at its cap.
	const removalEntryRef = useRef<DashboardHistoryEntry | 'pending' | null>(null)
	useEffect(() => {
		if (removalEntryRef.current === null || removalEntryRef.current === undoEntry) return
		if (removalEntryRef.current === 'pending') {
			removalEntryRef.current = undoEntry
			return
		}
		removalEntryRef.current = null
		toast.dismiss(CARD_REMOVED_TOAST_ID)
		toast.dismiss(SECTION_REMOVED_TOAST_ID)
	}, [undoEntry])
	useEffect(
		() => () => {
			toast.dismiss(CARD_REMOVED_TOAST_ID)
			toast.dismiss(SECTION_REMOVED_TOAST_ID)
		},
		[]
	)

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: isSmallScreen ? 999_999 : 5
			}
		}),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)

	const activeDragItem = activeDragId === null ? null : (rawById.get(activeDragId) ?? null)

	const handleDragStart = (event: DragStartEvent) => {
		setActiveDragId(String(event.active.id))
	}

	const handleDragCancel = () => {
		setActiveDragId(null)
	}

	const reorderItems = (next: Array<DashboardItemConfig>, movedItemId: string) => {
		handleChartsReordered(next)
		const heading = findGroupHeadingForItem(buildDashboardLayout(next), movedItemId)
		if (heading) expandSection(heading)
	}

	const handleDragEnd = (event: DragEndEvent) => {
		setActiveDragId(null)
		const { active, over } = event
		if (!over) return
		const targetIndex = resolveDropIndex(items, String(active.id), String(over.id), activeTabId)
		if (targetIndex === null) return
		const oldIndex = items.findIndex((item) => item.id === active.id)
		if (oldIndex === -1) return
		reorderItems(arrayMove(items, oldIndex, targetIndex), String(active.id))
	}

	const announcements = useMemo<Announcements>(() => {
		const context = { items, rawById, layout, activeTabId }
		const overId = (over: { id: UniqueIdentifier } | null) => (over ? String(over.id) : null)
		return {
			onDragStart: ({ active }) => dragAnnouncement(context, 'start', String(active.id), null),
			onDragOver: ({ active, over }) => dragAnnouncement(context, 'over', String(active.id), overId(over)),
			onDragEnd: ({ active, over }) => dragAnnouncement(context, 'end', String(active.id), overId(over)),
			onDragCancel: ({ active }) => dragAnnouncement(context, 'cancel', String(active.id), null)
		}
	}, [items, activeTabId, layout, rawById])

	const undoToast = (message: string, id: string) => {
		actionToast({
			message,
			icon: <Icon name="trash-2" className="size-3.5" />,
			action: { label: 'Undo', onClick: undo, umamiEvent: 'dashboard-undo' },
			id,
			duration: TOAST_DURATION_UNDO
		})
	}

	const handleDeleteClick = (itemId: string) => {
		handleRemoveItem(itemId)
		gridRef.current?.focus()
		removalEntryRef.current = 'pending'
		undoToast('Card removed', CARD_REMOVED_TOAST_ID)
	}

	const handleMoveItem = (itemId: string, direction: -1 | 1) => {
		const index = items.findIndex((item) => item.id === itemId)
		if (index === -1) return
		const next = moveDashboardItemWithinBounds(items, index, direction, visibleGroupBounds(items, itemId, activeTabId))
		if (next === items) return
		reorderItems(next, itemId)
		requestDashboardItemReveal(itemId, { scroll: 'nearest' })
	}

	const handleMoveSection = (sectionId: string, direction: -1 | 1) => {
		const next = moveSectionWithChildren(items, sectionId, direction)
		if (next === items) return
		handleChartsReordered(next)
		requestDashboardItemReveal(sectionId, { scroll: 'nearest' })
	}

	const handleDeleteSection = (sectionId: string) => {
		const section = rawById.get(sectionId)
		const next = removeSectionKeepingChildren(items, sectionId)
		if (next === items) return
		handleChartsReordered(next)
		gridRef.current?.focus()
		if (section?.kind === 'section' && section.displayAs === 'tab' && activeTabId === sectionId) {
			const remainingTab = layout.tabs?.find((tab) => tab.section.id !== sectionId)
			if (remainingTab) setActiveTab(remainingTab.section.id)
		}
		removalEntryRef.current = 'pending'
		undoToast('Section removed · cards stay', SECTION_REMOVED_TOAST_ID)
	}

	const insertSection = (afterIndex: number) => {
		const section: SectionConfig = {
			id: generateItemId('section', ''),
			kind: 'section',
			title: 'New section',
			displayAs: 'heading'
		}
		setAutoFocusSectionId(section.id)
		const insertAt = Math.min(afterIndex + 1, items.length)
		handleChartsReordered([...items.slice(0, insertAt), section, ...items.slice(insertAt)])
	}

	const handleAddSectionBelow = (sectionId: string) => {
		const range = sectionRange(items, sectionId)
		insertSection(range ? range[1] - 1 : items.length - 1)
	}

	const renderItem = (item: DashboardItemConfig, collapsed: boolean) => {
		const rawItem = rawById.get(item.id) ?? item
		const effectiveColSpan = gridColumnSpan(itemColSpan(rawItem))
		const index = items.findIndex((candidate) => candidate.id === item.id)
		const bounds = visibleGroupBounds(items, item.id, activeTabId)
		return (
			<SortableItem
				key={item.id}
				id={item.id}
				elementId={dashboardItemElementId(rawItem.id)}
				{...(isReadOnly || collapsed ? { disabled: STATIC_SORTABLE } : {})}
				isTable={itemSpansFullRow(rawItem)}
				data-col={itemColSpan(rawItem)}
				data-item-id={rawItem.id}
				// A card control that leaves while it has focus, such as a retry that succeeds, hands focus to its card.
				tabIndex={-1}
				style={cardScaleStyle(getDashboardItemHeight(rawItem))}
				className={`${proCardShellStyles} ${DRAGGING_CARD_CLASS} group/dashboard-card col-span-1 flex flex-col overflow-hidden ${COL_SPAN_CLASS_MAP[effectiveColSpan]}`}
			>
				<div className="min-h-0 flex-1">
					<CardBody
						item={item}
						rawItem={rawItem}
						unavailable={unavailableByItemId.get(item.id)}
						streamPrefetchEligible={prefetchIds.has(item.id)}
						editable={!isReadOnly}
						canMoveUp={!isReadOnly && !!bounds && index > bounds[0]}
						canMoveDown={!isReadOnly && !!bounds && index < bounds[1] - 1}
						{...(isReadOnly
							? {}
							: {
									onEditItem,
									handleEditItem,
									onColSpanChange: handleColSpanChange,
									onHeightChange: handleHeightChange,
									onMoveItem: handleMoveItem,
									onRemoveItem: handleDeleteClick
								})}
					/>
				</div>
			</SortableItem>
		)
	}

	const renderSection = (
		section: SectionConfig,
		itemCount: number,
		collapsed: boolean,
		contentId: string,
		flushTop = false
	) => {
		const canMoveUp = moveSectionWithChildren(items, section.id, -1) !== items
		const canMoveDown = moveSectionWithChildren(items, section.id, 1) !== items
		return (
			<SortableItem
				key={section.id}
				id={section.id}
				fullWidth
				disabled={isReadOnly || section.displayAs === 'tab' ? STATIC_SORTABLE : { draggable: true, droppable: false }}
				data-item-id={section.id}
				className="col-span-full"
			>
				<SectionCard
					section={section}
					itemCount={itemCount}
					collapsed={collapsed}
					onToggleCollapsed={() => toggleCollapsed(section)}
					contentId={contentId}
					flushTop={flushTop}
					{...(isReadOnly
						? {}
						: {
								editing: {
									autoFocusTitle: autoFocusSectionId === section.id,
									onUpdate: (patch: Partial<SectionConfig>) => handleUpdateSection(section.id, patch),
									onMove: (direction: -1 | 1) => handleMoveSection(section.id, direction),
									canMoveUp,
									canMoveDown,
									onDelete: () => handleDeleteSection(section.id),
									onAddSectionBelow: () => handleAddSectionBelow(section.id)
								}
							})}
				/>
			</SortableItem>
		)
	}

	const addItemTile = (placement?: DashboardItemPlacement) => (
		<DashedTile onClick={() => onAddChartClick(placement)} className="col-span-full min-h-12 w-full">
			<Icon name="plus" className="size-3.5" />
			Add card
		</DashedTile>
	)

	const renderGroups = (
		groups: Array<DashboardLayoutGroup>,
		options: { withAddTile: boolean; placement?: DashboardItemPlacement; inTab?: boolean; startsGrid?: boolean }
	) =>
		groups.map((group, index) => {
			const collapsed = group.heading ? isCollapsed(group.heading) : false
			const contentId = `section-content-${group.heading?.id ?? 'root'}`
			const isLast = index === groups.length - 1
			const showAddTile = options.withAddTile && isLast
			const showEmptyTabNotice = options.inTab === true && group.items.length === 0 && isLast
			return (
				<div
					key={group.heading?.id ?? `group-${index}`}
					className="group/dashboard-section flex flex-col gap-2"
					{...(group.heading ? { id: dashboardItemElementId(group.heading.id) } : {})}
				>
					{group.heading
						? renderSection(
								group.heading,
								group.items.length,
								collapsed,
								contentId,
								index === 0 && !!options.startsGrid
							)
						: null}
					<CollapsibleGroup id={contentId} collapsed={collapsed} contentClassName={GROUP_GRID_CLASS}>
						{group.items.map((item) => renderItem(item, collapsed))}
						{showAddTile ? addItemTile(options.placement) : null}
					</CollapsibleGroup>
					{showEmptyTabNotice ? (
						<EmptyState
							size="md"
							title={showAddTile ? 'This tab has no cards yet' : 'Nothing in this tab yet'}
							framed
							className="min-h-24"
						/>
					) : null}
				</div>
			)
		})

	const renderTab = (tab: DashboardLayoutTab) => {
		const tabItemCount = tab.groups.reduce((count, group) => count + group.items.length, 0)
		return (
			<>
				{isReadOnly ? null : (
					<div id={dashboardItemElementId(tab.section.id)} className="group/dashboard-section flex flex-col gap-2">
						{renderSection(tab.section, tabItemCount, false, `section-content-${tab.section.id}`)}
					</div>
				)}
				{renderGroups(tab.groups, { withAddTile: !isReadOnly, inTab: true })}
			</>
		)
	}

	const sharedPlacement = layout.tabs?.[0] ? { beforeItemId: layout.tabs[0].section.id } : undefined

	return (
		<ChartMotionContext.Provider value="draw">
			<ChartWatermarkContext.Provider value="export-only">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					accessibility={{ announcements, screenReaderInstructions: DRAG_INSTRUCTIONS }}
					onDragStart={handleDragStart}
					onDragCancel={handleDragCancel}
					onDragEnd={handleDragEnd}
				>
					<SortableContext items={sortableItemIds} strategy={rectSortingStrategy}>
						<div ref={gridRef} tabIndex={-1} className="flex flex-col gap-3" data-testid="dashboard-grid">
							{layout.tabs === null ? (
								renderGroups(layout.shared, { withAddTile: !isReadOnly, startsGrid: true })
							) : layout.shared.length > 0 || !isReadOnly ? (
								<div className="flex flex-col gap-2">
									{isReadOnly ? null : (
										<ProMeta
											className="px-1"
											items={[
												<>
													<Icon name="pin" className="size-3" />
													Shown on every tab
												</>
											]}
										/>
									)}
									{layout.shared.length > 0 ? (
										renderGroups(layout.shared, {
											withAddTile: !isReadOnly,
											startsGrid: isReadOnly,
											...(sharedPlacement ? { placement: sharedPlacement } : {})
										})
									) : (
										<div className={GROUP_GRID_CLASS}>{addItemTile(sharedPlacement)}</div>
									)}
								</div>
							) : null}
							{layout.tabs && activeTabId ? (
								<DashboardTabs
									tabs={layout.tabs}
									activeTabId={activeTabId}
									onChange={setActiveTab}
									renderTab={renderTab}
								/>
							) : null}
						</div>
					</SortableContext>
					<DragOverlay
						dropAnimation={reducedMotion ? null : DROP_ANIMATION}
						zIndex={50}
						{...(reducedMotion ? {} : { transition: DRAG_OVERLAY_TRANSITION })}
					>
						{activeDragItem ? <DragPreviewCard item={activeDragItem} /> : null}
					</DragOverlay>
				</DndContext>
			</ChartWatermarkContext.Provider>
		</ChartMotionContext.Provider>
	)
}
