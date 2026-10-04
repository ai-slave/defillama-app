import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { BasicLink } from '~/components/Link'
import { getMyDashboardAuthorProfile } from '~/containers/Authors/api'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { hasCustomizedAuthorProfile } from '~/containers/Authors/profileDefaults'
import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import { useMyTeam } from '~/containers/ProDashboard/hooks/useMyTeam'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import { isMacPlatform } from '~/utils/platform'
import { toQueryString } from '~/utils/routerQuery'
import { AppMetadataProvider } from './AppMetadataContext'
import { AnnotationsPopover } from './components/AnnotationsPopover'
import { AutosaveStatus } from './components/AutosaveStatus'
import { ChartGrid } from './components/ChartGrid'
import { ChartSyncToggle } from './components/ChartSyncToggle'
import { CopyDashboardLinkButton } from './components/CopyDashboardLinkButton'
import { CustomTimePeriodPicker } from './components/CustomTimePeriodPicker'
import { CopyDashboardButton, EditDashboardButton, UndoAIGenerationButton } from './components/DashboardActionButtons'
import { DashboardActionsSheet, type DashboardSheetAction } from './components/DashboardActionsSheet'
import { DashboardLoadProgress } from './components/DashboardLoadProgress'
import { DashboardOverflowMenu } from './components/DashboardOverflowMenu'
import { DashboardVariablesBar } from './components/DashboardVariablesBar'
import { EmptyState } from './components/EmptyState'
import { LikeDashboardButton } from './components/LikeDashboardButton'
import { ParameterHint } from './components/ParameterHint'
import { SimilarDashboards } from './components/SimilarDashboards'
import {
	getInitialSqlRefreshProgress,
	getSqlRefreshProgress,
	refreshAllSqlCharts,
	subscribeSqlRefreshProgress
} from './components/SqlChart/sqlRefreshBus'
import type { UnifiedTableFocusSection } from './components/UnifiedTable/types'
import type { DashboardItemConfig } from './dashboardItemConfig'
import { dashboardItemsUseTimePeriod } from './dashboardTimePeriodCapabilities'
import {
	type DashboardToolbarActionId,
	desktopDashboardToolbarActions,
	visibleDashboardToolbarActions
} from './dashboardToolbarActions'
import { DASHBOARD_DESCRIPTION_MAX_LENGTH, DASHBOARD_NAME_MAX_LENGTH, type TimePeriod } from './dashboardTypes'
import { useDashboardEditorHotkeys } from './hooks/useDashboardEditorHotkeys'
import { requestDashboardItemReveal } from './hooks/useDashboardItemDeepLink'
import { useFreeTierStatus } from './hooks/useFreeTierStatus'
import {
	useDashboardMode,
	useProDashboardCatalog,
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardHistory,
	useProDashboardItemsState,
	useProDashboardPermissions,
	useProDashboardSave,
	useProDashboardTime,
	useProDashboardUI,
	useProDashboardVariables
} from './ProDashboardAPIContext'
import type { SectionConfig, SqlChartConfig } from './types'
import {
	InlineTextField,
	ProBadge,
	ProButton,
	type ProButtonVariant,
	ProChip,
	ProDialogFallback,
	ProSegmented
} from './ui'
import { type DashboardItemPlacement, toastRefusal } from './useDashboardActions'
import { generateItemId } from './utils/dashboardUtils'

const SYNCABLE_CHART_KINDS: ReadonlySet<DashboardItemConfig['kind']> = new Set([
	'chart',
	'multi',
	'builder',
	'advanced-tvl',
	'advanced-borrowed',
	'stablecoins',
	'stablecoin-asset',
	'yields',
	'unlocks-schedule'
])

const DONE_ACKNOWLEDGED_MS = 1500

const DemoPreview = lazy(() => import('./components/DemoPreview').then((m) => ({ default: m.DemoPreview })))

import { DashboardPaywallModal, type PaywallReason } from './components/DashboardPaywallModal'
const AddChartModal = lazy(() =>
	import('./components/AddChartModal/AddChartModal').then((m) => ({ default: m.AddChartModal }))
)
const SqlChartModal = lazy(() =>
	import('./components/SqlChart/SqlChartModal').then((m) => ({ default: m.SqlChartModal }))
)
const CreateDashboardPicker = lazy(() =>
	import('./components/CreateDashboardPicker').then((m) => ({ default: m.CreateDashboardPicker }))
)
const DashboardSettingsModal = lazy(() =>
	import('./components/DashboardSettingsModal').then((m) => ({ default: m.DashboardSettingsModal }))
)
const GenerateDashboardModal = lazy(() =>
	import('./components/GenerateDashboardModal').then((m) => ({ default: m.GenerateDashboardModal }))
)
const AIGenerationHistory = lazy(() =>
	import('./components/AIGenerationHistory').then((m) => ({ default: m.AIGenerationHistory }))
)
const Rating = lazy(() => import('./components/Rating').then((m) => ({ default: m.Rating })))
const QuickAddPalette = lazy(() => import('./components/QuickAddPalette').then((m) => ({ default: m.QuickAddPalette })))

function warmEditorModalChunks() {
	void import('./components/QuickAddPalette')
	void import('./components/AddChartModal/AddChartModal')
	void import('./components/SqlChart/SqlChartModal')
	void import('./components/DashboardSettingsModal')
}

function DashboardAuthorByline({ author }: { author?: PublicDashboardAuthor }) {
	if (!author) return null
	return (
		<BasicLink
			href={`/authors/${author.slug}`}
			className="inline-flex items-center gap-2 text-sm text-pro-text-secondary hover:text-link"
		>
			{author.avatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={author.avatarUrl} alt="" loading="lazy" className="size-6 rounded-full object-cover" />
			) : (
				<span
					className="flex size-6 items-center justify-center rounded-full text-sm"
					style={avatarColorStyle(author.slug)}
				>
					🦙
				</span>
			)}
			<span>
				By <span className="font-medium">{author.displayName}</span>
			</span>
		</BasicLink>
	)
}

function AuthorProfileSetupNotice() {
	const [dismissed, setDismissed] = useState(false)
	if (dismissed) return null

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-link/20 bg-pro-link-button-bg px-3 py-2">
			<div className="flex min-w-0 items-start gap-2">
				<Icon name="users" className="mt-0.5 size-4 shrink-0 text-link" />
				<div className="min-w-0">
					<p className="label-md text-pro-text-primary">Set up your dashboard author profile</p>
					<p className="mt-0.5 body-sm text-pro-text-secondary">
						Add your name, avatar, and links so visitors can see who built this dashboard.
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Button as={BasicLink} href="/account?tab=profile" variant="primary" size="md">
					Open settings
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="md"
					square
					onClick={() => setDismissed(true)}
					aria-label="Dismiss profile setup notice"
				>
					<Icon name="x" className="size-4" aria-hidden="true" />
				</Button>
			</div>
		</div>
	)
}

type DashboardToolbarAction = DashboardSheetAction & {
	variant: ProButtonVariant
	square?: boolean
	umami?: string
	busy?: boolean
}

function DashboardToolbarButton({ action }: { action: DashboardToolbarAction }) {
	return (
		<Tooltip
			content={action.title ?? action.label}
			render={
				<ProButton
					type="button"
					variant={action.variant}
					square={action.square ?? false}
					aria-label={action.label}
					aria-disabled={action.disabled || undefined}
					icon={<Icon name={action.icon} height={16} width={16} />}
					{...(action.busy ? { loading: true } : {})}
					onClick={() => {
						if (!action.disabled) void action.onSelect()
					}}
					{...(action.umami ? { 'data-umami-event': action.umami } : {})}
				/>
			}
		>
			{action.square ? null : <span>{action.label}</span>}
		</Tooltip>
	)
}

function DemoPreviewFallback() {
	return (
		<div
			role="alert"
			className="mx-auto my-12 flex max-w-xl flex-col items-center gap-3 rounded-md border border-pro-cards-border bg-pro-cards-bg p-6 text-center"
		>
			<p className="body-sm text-data-down">The preview could not be displayed.</p>
			<BasicLink href="/pro?tab=discover" className="label-sm text-link hover:underline">
				See community dashboards
			</BasicLink>
		</div>
	)
}

function ProDashboardContent() {
	const [addModalSession, setAddModalSession] = useState<{ key: number; open: boolean } | null>(null)
	const [quickAddSession, setQuickAddSession] = useState<{
		key: number
		open: boolean
		placement?: DashboardItemPlacement
	} | null>(null)
	const [addDraftItem, setAddDraftItem] = useState<DashboardItemConfig | null>(null)
	const [editModalState, setEditModalState] = useState<{
		item: DashboardItemConfig | null
		focusSection?: UnifiedTableFocusSection
	}>({ item: null })
	const [sqlModalSession, setSqlModalSession] = useState<{
		key: number
		open: boolean
		item: SqlChartConfig | null
	} | null>(null)
	const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false)
	const { authorizedFetch, isAuthenticated, hasActiveSubscription, user } = useAuthContext()
	const { isAtDashboardLimit, isFreeUser } = useFreeTierStatus()
	const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)
	const showPaywall = (reason: PaywallReason) => {
		setSignupSource('pro-dashboard')
		setPaywallReason(reason)
	}
	const router = useRouter()
	const mode = useDashboardMode()
	useEffect(() => {
		if (mode === 'edit') warmEditorModalChunks()
	}, [mode])
	const { items } = useProDashboardItemsState()
	const { protocolsLoading } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod, setTimePeriod, setCustomTimePeriod } = useProDashboardTime()
	const {
		isReadOnly,
		reason: readOnlyReason,
		canEdit: canEditDashboard,
		canDelete: canDeleteDashboard,
		canMove: canMoveDashboard,
		team: dashboardTeam
	} = useProDashboardPermissions()
	const myTeam = useMyTeam()
	const { handleAppendItems } = useProDashboardEditorActions()
	const { canUndo: canUndoEdit, canRedo: canRedoEdit, undo: undoEdit, redo: redoEdit } = useProDashboardHistory()
	const { variables } = useProDashboardVariables()
	useDashboardEditorHotkeys({
		enabled: !isReadOnly,
		undo: undoEdit,
		redo: redoEdit,
		openQuickAdd: () => openQuickAdd()
	})
	const sqlRefreshProgress = useSyncExternalStore(
		subscribeSqlRefreshProgress,
		getSqlRefreshProgress,
		getInitialSqlRefreshProgress
	)
	const sqlRefreshActive = sqlRefreshProgress.active > 0
	const prevSqlRefreshActiveRef = useRef(0)
	useEffect(() => {
		const prevActive = prevSqlRefreshActiveRef.current
		prevSqlRefreshActiveRef.current = sqlRefreshProgress.active
		if (prevActive > 0 && sqlRefreshProgress.active === 0 && sqlRefreshProgress.bulk) {
			if (sqlRefreshProgress.failed > 0) {
				toast.error(`${sqlRefreshProgress.failed} of ${sqlRefreshProgress.total} SQL cards failed to refresh`)
			} else {
				toast.success('All SQL cards refreshed')
			}
		}
	}, [sqlRefreshProgress])
	const guardNavigationWhileRefreshing = sqlRefreshActive && !isReadOnly
	useEffect(() => {
		if (!guardNavigationWhileRefreshing) return
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		const handleRouteChangeStart = () => {
			if (window.confirm('SQL cards are still refreshing. Leave anyway?')) return
			router.events.emit('routeChangeError')
			throw new Error('Route change aborted: SQL refresh in progress')
		}
		window.addEventListener('beforeunload', handleBeforeUnload)
		router.events.on('routeChangeStart', handleRouteChangeStart)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
			router.events.off('routeChangeStart', handleRouteChangeStart)
		}
	}, [guardNavigationWhileRefreshing, router])
	const {
		dashboardName,
		dashboardId,
		saveDashboard,
		saveDashboardWithNotices,
		moveDashboardTeam,
		publishDashboard,
		copyDashboard,
		dashboardVisibility,
		dashboardTags,
		dashboardDescription,
		currentDashboard,
		handleCreateDashboard,
		handleGenerateDashboard,
		handleIterateDashboard,
		getCurrentRatingSession,
		submitRating,
		undoAIGeneration,
		canUndo,
		deleteDashboard
	} = useProDashboardDashboard()
	const { createDashboardDialogStore, aiDialog, setAiDialog } = useProDashboardUI()
	const createDashboardDialogOpen = Ariakit.useStoreState(createDashboardDialogStore, 'open')
	const { flush: flushAutoSave, state: autoSaveState, saving: autoSaving } = useProDashboardSave()
	const autoSaveFailed = autoSaveState?.status === 'error'
	const [justPublished, setJustPublished] = useState(false)
	const publishAndCelebrate = async () => {
		await publishDashboard()
		setJustPublished(true)
	}
	const [doneAcknowledged, setDoneAcknowledged] = useState(false)
	useEffect(() => {
		if (!doneAcknowledged || autoSaving || autoSaveFailed) return
		const timeout = setTimeout(() => setDoneAcknowledged(false), DONE_ACKNOWLEDGED_MS)
		return () => clearTimeout(timeout)
	}, [doneAcknowledged, autoSaving, autoSaveFailed])
	const doneStatusLabel =
		doneAcknowledged && !autoSaveFailed && mode === 'view' ? (autoSaving ? 'Saving…' : 'Saved') : null
	const finishEditing = () => {
		if (autoSaveFailed) {
			toast.error('Changes could not be saved. Retry the save first.', { id: 'dashboard-done-blocked' })
			return
		}
		flushAutoSave()
		setDoneAcknowledged(true)
		void router.push(dashboardModeHref('view'), undefined, { shallow: true })
	}
	const isDashboardOwner = isAuthenticated && !!currentDashboard?.user && currentDashboard.user === user?.id
	const { data: authorProfile, isSuccess: authorProfileLoaded } = useQuery({
		queryKey: ['dashboard-author-profile', user?.id],
		queryFn: () => getMyDashboardAuthorProfile(authorizedFetch),
		enabled: isDashboardOwner && !!user?.id,
		retry: false,
		refetchOnWindowFocus: false
	})

	// Speaks to the creator, whose own subscription lapsing is what made the dashboard read-only.
	const showSubscriptionEndedNotice = readOnlyReason === 'subscription' && isDashboardOwner

	const timePeriods: Array<{ value: TimePeriod; label: string }> = [
		{ value: '30d', label: '30d' },
		{ value: '90d', label: '90d' },
		{ value: '365d', label: '365d' },
		{ value: 'ytd', label: 'YTD' },
		{ value: '3y', label: '3Y' },
		{ value: 'all', label: 'All' }
	]

	const isLoadingDashboardEdits =
		mode === 'edit' && (readOnlyReason === 'loading' || readOnlyReason === 'dashboard-loading')
	const canUseToolbarActions = !isReadOnly || isLoadingDashboardEdits
	const hasAnyItems = items.length > 0
	const hasTimePeriodItems = dashboardItemsUseTimePeriod(items)
	const showTimePeriodSelector = hasTimePeriodItems || (mode === 'edit' && hasAnyItems)
	const showSqlRefresh = !!dashboardId && items.some((item) => item.kind === 'sql')
	const hasSyncableCharts = items.some((item) => SYNCABLE_CHART_KINDS.has(item.kind))
	const showToolbarRow =
		showTimePeriodSelector ||
		showSqlRefresh ||
		variables.length > 0 ||
		hasSyncableCharts ||
		(canUseToolbarActions && hasAnyItems)

	const currentRatingSession = getCurrentRatingSession()
	const shouldShowAuthorProfileSetup =
		isDashboardOwner && authorProfileLoaded && !!authorProfile && !hasCustomizedAuthorProfile(authorProfile)

	const [addPlacement, setAddPlacement] = useState<DashboardItemPlacement | undefined>(undefined)
	const startAddModalSession = () => setAddModalSession((current) => ({ key: (current?.key ?? 0) + 1, open: true }))
	const clearAddModalState = () => {
		setAddModalSession(null)
		setEditModalState({ item: null })
		setAddPlacement(undefined)
		setAddDraftItem(null)
	}
	// Add card clears its state once its exit ends (onClosed); a SQL save with no Add card under it closes nothing.
	const closeAddModalSession = () => setAddModalSession((current) => (current ? { ...current, open: false } : null))
	const openQuickAdd = (placement?: DashboardItemPlacement) =>
		setQuickAddSession((current) =>
			current?.open
				? current
				: { key: (current?.key ?? 0) + 1, open: true, ...(placement === undefined ? {} : { placement }) }
		)
	const closeQuickAdd = () => setQuickAddSession((current) => (current ? { ...current, open: false } : null))
	const clearQuickAddSession = () => setQuickAddSession(null)
	const openFullEditorFromQuickAdd = ({
		placement,
		draftItem
	}: {
		placement?: DashboardItemPlacement
		draftItem?: DashboardItemConfig
	}) => {
		closeQuickAdd()
		setEditModalState({ item: null })
		setAddPlacement(placement)
		setAddDraftItem(draftItem ?? null)
		startAddModalSession()
	}
	const startSqlModalSession = (item: SqlChartConfig | null) =>
		setSqlModalSession((current) => ({ key: (current?.key ?? 0) + 1, open: true, item }))
	const closeSqlModalSession = () =>
		setSqlModalSession((current) => (current ? { key: current.key, open: false, item: current.item } : null))

	const dashboardModeHref = (targetMode: 'view' | 'edit') => {
		const { dashboardId: _routeDashboardId, mode: _routeMode, ...carriedQuery } = router.query
		return `/pro/${currentDashboard?.slug ?? dashboardId}${targetMode === 'edit' ? '/edit' : ''}${toQueryString(carriedQuery)}`
	}

	const openIterateDashboardOrPaywall = () => {
		if (hasActiveSubscription) setAiDialog('iterate')
		else showPaywall('llamaai')
	}
	const openDashboardSettings = () => setShowSettingsModal(true)
	const renameDashboard = useMutation({ mutationFn: (next: string) => saveDashboard({ dashboardName: next }) })
	const describeDashboard = useMutation({ mutationFn: (next: string) => saveDashboard({ description: next }) })
	const canEditHeaderText = mode === 'edit' && !isReadOnly
	const dashboardManageAction =
		mode === 'view'
			? {
					label: 'Edit dashboard',
					onSelect: () => void router.push(dashboardModeHref('edit'), undefined, { shallow: true })
				}
			: { label: 'Open settings', onSelect: openDashboardSettings }
	const isClient = useIsClient()
	const quickAddShortcutLabel = isClient && isMacPlatform() ? '⌘K' : 'Ctrl+K'
	const addSection = () => {
		const section: SectionConfig = {
			id: generateItemId('section', ''),
			kind: 'section',
			title: 'New section',
			displayAs: 'heading'
		}
		const added = handleAppendItems(() => [section])
		toastRefusal(added)
		if (added.status === 'saved') requestDashboardItemReveal(section.id, { focusTitle: true })
	}
	const toolbarActionById: Record<DashboardToolbarActionId, DashboardToolbarAction> = {
		'add-card': {
			label: 'Add card',
			icon: 'plus',
			onSelect: () => openQuickAdd(),
			variant: 'primary',
			disabled: isLoadingDashboardEdits,
			title: isLoadingDashboardEdits ? 'Loading dashboard…' : `Add a card (${quickAddShortcutLabel})`
		},
		'add-section': {
			label: 'Add section',
			icon: 'layout-grid',
			onSelect: addSection,
			variant: 'secondary',
			disabled: isLoadingDashboardEdits,
			title: isLoadingDashboardEdits ? 'Loading dashboard…' : 'Group cards into a section',
			umami: 'dashboard-section-add'
		},
		'edit-with-ai': {
			label: 'Edit with LlamaAI',
			icon: 'sparkles',
			onSelect: openIterateDashboardOrPaywall,
			variant: 'ai'
		},
		'undo-ai': { label: 'Undo AI changes', icon: 'sparkles', onSelect: undoAIGeneration, variant: 'secondary' },
		undo: {
			label: 'Undo',
			icon: 'arrow-left',
			onSelect: () => void undoEdit(),
			variant: 'ghost',
			square: true,
			title: 'Undo (Ctrl+Z)',
			umami: 'dashboard-undo'
		},
		redo: {
			label: 'Redo',
			icon: 'arrow-right',
			onSelect: () => void redoEdit(),
			variant: 'ghost',
			square: true,
			title: 'Redo (Shift+Ctrl+Z)',
			umami: 'dashboard-redo'
		},
		'refresh-sql': {
			label: sqlRefreshActive
				? `Refreshing ${sqlRefreshProgress.total - sqlRefreshProgress.active}/${sqlRefreshProgress.total}…`
				: 'Refresh all SQL',
			icon: 'repeat',
			onSelect: () => refreshAllSqlCharts(),
			variant: 'secondary',
			disabled: sqlRefreshActive,
			busy: sqlRefreshActive,
			title: 'Re-run every SQL chart and table on this dashboard and update the results for everyone.'
		},
		settings: { label: 'Settings', icon: 'settings', onSelect: openDashboardSettings, variant: 'secondary' }
	}
	const toolbarActionState = {
		isReadOnly,
		hasAnyItems,
		canUndoAi: canUndo,
		canUndoEdit,
		canRedoEdit,
		hasDashboardId: !!dashboardId,
		showSqlRefresh,
		isLoadingEdits: isLoadingDashboardEdits
	}
	const visibleActionIds = visibleDashboardToolbarActions(toolbarActionState)
	const desktopActions = desktopDashboardToolbarActions(toolbarActionState)
	const sheetActions: Array<DashboardSheetAction> = canUseToolbarActions
		? visibleActionIds.filter((id) => id !== 'refresh-sql').map((id) => toolbarActionById[id])
		: []

	const handleEditItemModal = (item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => {
		if (item.kind === 'sql') {
			startSqlModalSession(item)
			return
		}
		setEditModalState({ item, ...(focusSection === undefined ? {} : { focusSection }) })
		startAddModalSession()
	}

	const openSqlModal = () => {
		startSqlModalSession(null)
	}

	if (!isAuthenticated && !hasActiveSubscription && dashboardVisibility !== 'public') {
		return (
			<ErrorBoundary fallback={<DemoPreviewFallback />}>
				<Suspense
					fallback={
						<div
							role="status"
							aria-live="polite"
							className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1"
						>
							<LoadingIndicator label="Loading preview" />
						</div>
					}
				>
					<DemoPreview />
				</Suspense>
			</ErrorBoundary>
		)
	}

	return (
		<div className="flex flex-1 flex-col gap-2 p-2 pro-dashboard lg:px-0">
			<div className="flex flex-wrap items-center gap-2">
				<ProButton as={BasicLink} href="/pro" variant="ghost" className="-ml-3">
					<Icon name="arrow-left" height={14} width={14} />
					Dashboards
				</ProButton>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1">
					<Tooltip content="Views" render={<p />} className="min-h-8 gap-1.5 px-2 text-sm text-pro-text-tertiary">
						<Icon name="eye" height={14} width={14} />
						<span className="tabular-nums">{formatNumber(currentDashboard?.viewCount ?? 0)}</span>
						<span className="sr-only">Views</span>
					</Tooltip>
					{currentDashboard && dashboardId ? (
						<>
							<LikeDashboardButton
								currentDashboard={currentDashboard}
								dashboardVisibility={dashboardVisibility}
								dashboardId={dashboardId}
							/>
							<CopyDashboardLinkButton
								dashboardVisibility={dashboardVisibility}
								dashboardId={dashboardId}
								isOwner={isDashboardOwner}
								{...(isDashboardOwner ? { manageAction: dashboardManageAction } : {})}
								{...(isDashboardOwner && !isFreeUser ? { onMakePublic: publishAndCelebrate } : {})}
								{...(currentDashboard.slug ? { dashboardSlug: currentDashboard.slug } : {})}
							/>
						</>
					) : null}
					<DashboardOverflowMenu
						{...(!isReadOnly && dashboardId ? { onOpenSettings: openDashboardSettings } : {})}
						{...(isAuthenticated && dashboardId ? { onDuplicate: copyDashboard } : {})}
						{...(isAuthenticated && dashboardId && isAtDashboardLimit
							? { onDuplicateBlocked: () => showPaywall('dashboard-limit') }
							: {})}
						{...(isAuthenticated
							? {
									onNewDashboard: () => {
										if (isAtDashboardLimit) showPaywall('dashboard-limit')
										else createDashboardDialogStore.show()
									}
								}
							: {})}
						{...(canDeleteDashboard && dashboardId ? { onDelete: () => deleteDashboard(dashboardId) } : {})}
						{...(canMoveDashboard && myTeam && dashboardId
							? { moveTeam: { team: dashboardTeam, myTeam, isCreator: isDashboardOwner, onMove: moveDashboardTeam } }
							: {})}
					/>
					<DashboardActionsSheet actions={sheetActions} />
					{isAuthenticated ? (
						<>
							<span role="status" className="sr-only">
								{doneStatusLabel ?? ''}
							</span>
							{doneStatusLabel ? (
								<span
									aria-hidden="true"
									className="inline-flex min-h-8 animate-pro-fade-in items-center gap-1 px-2 body-md text-pro-text-secondary"
								>
									{autoSaving ? <LoadingSpinner size={14} /> : <Icon name="check" height={14} width={14} />}
									{doneStatusLabel}
								</span>
							) : null}
							{mode === 'view' && dashboardId && canEditDashboard ? (
								<EditDashboardButton key={`edit-${dashboardId}`} href={dashboardModeHref('edit')} />
							) : null}
							{mode === 'edit' && dashboardId ? (
								<ProButton
									type="button"
									variant="primary"
									onClick={finishEditing}
									icon={<Icon name="check" height={16} width={16} />}
									{...(sqlRefreshActive ? { loading: true } : {})}
								>
									<span>{sqlRefreshActive ? 'Refreshing SQL…' : 'Done'}</span>
								</ProButton>
							) : null}
							{isReadOnly && currentDashboard?.user !== user?.id ? (
								<CopyDashboardButton
									key={`copy-${dashboardId}`}
									onCopy={copyDashboard}
									onLimitReached={isAtDashboardLimit ? () => showPaywall('dashboard-limit') : undefined}
								/>
							) : null}
						</>
					) : null}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h1 className="text-2xl leading-tight font-semibold text-pro-text-primary md:text-3xl">
					{canEditHeaderText ? (
						<InlineTextField
							value={dashboardName}
							placeholder="Dashboard name"
							maxLength={DASHBOARD_NAME_MAX_LENGTH}
							status={renameDashboard.isPending ? 'saving' : renameDashboard.isError ? 'error' : 'idle'}
							{...(renameDashboard.error ? { errorMessage: renameDashboard.error.message } : {})}
							className="max-w-full text-2xl leading-tight font-semibold md:text-3xl"
							onCommit={(next) => {
								if (next) renameDashboard.mutate(next)
							}}
						/>
					) : (
						dashboardName
					)}
				</h1>
				{dashboardVisibility === 'public' ? (
					<ProBadge
						key={dashboardVisibility}
						tone="success"
						icon={<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
						{...(justPublished ? { className: 'animate-pro-pop' } : {})}
					>
						Public
					</ProBadge>
				) : (
					<ProBadge tone="premium" icon={<Icon name="key" height={12} width={12} />}>
						Private
					</ProBadge>
				)}
				{dashboardTeam ? (
					<ProBadge tone="info" icon={<Icon name="users" height={12} width={12} />}>
						{dashboardTeam.name}
					</ProBadge>
				) : null}
				{currentDashboard?.aiGenerated && Object.keys(currentDashboard.aiGenerated).length > 0 ? (
					<ProBadge tone="info" icon={<Icon name="sparkles" height={12} width={12} />}>
						AI Generated
					</ProBadge>
				) : null}
			</div>

			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-pro-text-secondary">
					<DashboardAuthorByline {...(currentDashboard?.author ? { author: currentDashboard.author } : {})} />
					{currentDashboard?.author && (canEditHeaderText || dashboardDescription) ? (
						<span aria-hidden="true">·</span>
					) : null}
					{canEditHeaderText ? (
						<InlineTextField
							multiline
							value={dashboardDescription ?? ''}
							placeholder="Add a description"
							maxLength={DASHBOARD_DESCRIPTION_MAX_LENGTH}
							status={describeDashboard.isPending ? 'saving' : describeDashboard.isError ? 'error' : 'idle'}
							{...(describeDashboard.error ? { errorMessage: describeDashboard.error.message } : {})}
							className="w-full max-w-3xl text-sm"
							onCommit={(next) => describeDashboard.mutate(next)}
						/>
					) : dashboardDescription ? (
						<p className="max-w-3xl leading-6">{dashboardDescription}</p>
					) : null}
				</div>
				{currentDashboard?.copiedFrom ? (
					<p className="text-xs text-pro-text-secondary">
						Forked from{' '}
						<BasicLink
							href={`/pro/${currentDashboard.copiedFrom.slug ?? currentDashboard.copiedFrom.id}`}
							className="text-link"
						>
							{currentDashboard.copiedFrom.name}
						</BasicLink>
					</p>
				) : null}
				{showSubscriptionEndedNotice ? (
					<InlineStatus variant="warning">
						Your subscription has ended, so this dashboard is view-only.{' '}
						<BasicLink href="/subscription" className="font-medium underline">
							Renew
						</BasicLink>
					</InlineStatus>
				) : null}
				{shouldShowAuthorProfileSetup ? <AuthorProfileSetupNotice /> : null}
				{dashboardTags.length > 0 ? (
					<ul aria-label="Dashboard tags" className="flex flex-wrap gap-1.5">
						{dashboardTags.map((tag) => (
							<li key={tag}>
								<ProChip
									as={BasicLink}
									href={`/pro?tab=discover&tag=${encodeURIComponent(tag)}`}
									data-umami-event="dashboard-tag-click"
								>
									{tag}
								</ProChip>
							</li>
						))}
					</ul>
				) : null}
			</div>

			{currentDashboard?.aiGenerated ? <AIGenerationHistory aiGenerated={currentDashboard.aiGenerated} /> : null}

			{currentRatingSession && !isReadOnly ? (
				<Suspense fallback={null}>
					<Rating
						sessionId={currentRatingSession.sessionId}
						mode={currentRatingSession.mode}
						prompt={currentRatingSession.prompt}
						onSubmit={submitRating}
					/>
				</Suspense>
			) : null}

			{showToolbarRow ? (
				<div className="mt-1 flex min-h-8 flex-wrap items-center gap-2">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						{showTimePeriodSelector ? (
							<Tooltip
								content={!hasTimePeriodItems ? 'Add a chart card to enable the time period' : null}
								placement="bottom"
							>
								<div className="flex max-w-full min-w-0 items-center gap-2">
									<ProSegmented
										className="min-w-0"
										label="Time period"
										options={timePeriods.map((period) => ({ ...period, disabled: !hasTimePeriodItems }))}
										value={timePeriod}
										onValueChange={(period) => setTimePeriod(period)}
									/>
									<CustomTimePeriodPicker
										isActive={timePeriod === 'custom'}
										customPeriod={customTimePeriod}
										onApply={(period) => setCustomTimePeriod(period)}
										onClear={() => setTimePeriod('365d')}
										disabled={!hasTimePeriodItems}
									/>
								</div>
							</Tooltip>
						) : null}
						<DashboardVariablesBar />
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-1">
						{hasSyncableCharts ? <ChartSyncToggle /> : null}
						{!isReadOnly ? <AnnotationsPopover /> : null}
						{visibleActionIds.includes('refresh-sql') ? (
							<DashboardToolbarButton action={toolbarActionById['refresh-sql']} />
						) : null}
						<div className="hidden items-center gap-1 md:flex">
							{desktopActions
								.filter(({ id }) => id !== 'refresh-sql')
								.map(({ id, disabled }) =>
									id === 'undo-ai' ? (
										<UndoAIGenerationButton key={dashboardId ?? id} onUndo={undoAIGeneration} />
									) : (
										<DashboardToolbarButton
											key={id}
											action={disabled ? { ...toolbarActionById[id], disabled: true } : toolbarActionById[id]}
										/>
									)
								)}
						</div>
					</div>
				</div>
			) : null}

			<DashboardLoadProgress />

			{dashboardId && (!isReadOnly || (isDashboardOwner && autoSaveFailed)) ? <AutosaveStatus /> : null}

			<ParameterHint />

			{items.length > 0 ? (
				<ChartGrid onAddChartClick={openQuickAdd} onEditItem={handleEditItemModal} tabQueryParam="tab" />
			) : null}

			{mode === 'view' && dashboardId && dashboardTags.length > 0 ? (
				<SimilarDashboards dashboardId={dashboardId} tags={dashboardTags} />
			) : null}

			<Suspense fallback={<ProDialogFallback width="xl" workspace />}>
				{addModalSession ? (
					<AddChartModal
						key={addModalSession.key}
						isOpen={addModalSession.open}
						onClose={closeAddModalSession}
						onClosed={clearAddModalState}
						editItem={editModalState.item}
						initialUnifiedFocusSection={editModalState.focusSection}
						onOpenSqlModal={openSqlModal}
						{...(addPlacement ? { placement: addPlacement } : {})}
						{...(addDraftItem ? { draftItem: addDraftItem } : {})}
					/>
				) : null}
			</Suspense>

			<Suspense fallback={<ProDialogFallback width="md" />}>
				{quickAddSession ? (
					<QuickAddPalette
						key={quickAddSession.key}
						open={quickAddSession.open}
						onClose={closeQuickAdd}
						onClosed={clearQuickAddSession}
						onOpenFullEditor={openFullEditorFromQuickAdd}
						{...(quickAddSession.placement ? { placement: quickAddSession.placement } : {})}
					/>
				) : null}
			</Suspense>

			<Suspense fallback={<ProDialogFallback width="xl" workspace />}>
				{sqlModalSession ? (
					<SqlChartModal
						key={sqlModalSession.key}
						isOpen={sqlModalSession.open}
						editItem={sqlModalSession.item}
						{...(addPlacement ? { placement: addPlacement } : {})}
						onClose={closeSqlModalSession}
						onClosed={() => setSqlModalSession(null)}
						onSaved={() => {
							closeSqlModalSession()
							closeAddModalSession()
						}}
					/>
				) : null}
			</Suspense>

			{!protocolsLoading && !hasAnyItems ? (
				<EmptyState
					onAddChart={() => openQuickAdd()}
					onGenerateWithAI={hasActiveSubscription ? () => setAiDialog('iterate') : () => showPaywall('llamaai')}
					isReadOnly={isReadOnly}
					{...(isReadOnly && canEditDashboard && dashboardId ? { editHref: dashboardModeHref('edit') } : {})}
				/>
			) : null}

			<Suspense fallback={showSettingsModal && !isReadOnly ? <ProDialogFallback width="sm" /> : null}>
				<DashboardSettingsModal
					isOpen={showSettingsModal && !isReadOnly}
					onClose={() => setShowSettingsModal(false)}
					dashboardName={dashboardName}
					visibility={dashboardVisibility}
					tags={dashboardTags}
					dashboardId={dashboardId}
					onSave={saveDashboardWithNotices}
					{...(canDeleteDashboard ? { onDelete: deleteDashboard } : {})}
					myTeam={myTeam}
					team={dashboardTeam}
					canMove={canMoveDashboard}
					onMoveTeam={moveDashboardTeam}
				/>
			</Suspense>

			<Suspense fallback={createDashboardDialogOpen ? <ProDialogFallback width="lg" /> : null}>
				<CreateDashboardPicker
					dialogStore={createDashboardDialogStore}
					onCreate={handleCreateDashboard}
					team={myTeam}
				/>
			</Suspense>

			<Suspense fallback={aiDialog === 'generate' ? <ProDialogFallback width="md" /> : null}>
				<GenerateDashboardModal
					isOpen={aiDialog === 'generate'}
					onClose={() => setAiDialog(null)}
					onGenerate={handleGenerateDashboard}
				/>
			</Suspense>

			<Suspense fallback={aiDialog === 'iterate' ? <ProDialogFallback width="md" /> : null}>
				<GenerateDashboardModal
					isOpen={aiDialog === 'iterate'}
					onClose={() => setAiDialog(null)}
					mode="iterate"
					existingDashboard={{
						dashboardName,
						visibility: dashboardVisibility,
						tags: dashboardTags,
						description: dashboardDescription,
						items,
						...(currentDashboard?.aiGenerated ? { aiGenerated: currentDashboard.aiGenerated } : {})
					}}
					onGenerate={handleIterateDashboard}
				/>
			</Suspense>

			{paywallReason ? <DashboardPaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} /> : null}
		</div>
	)
}

export default function ProDashboard() {
	return (
		<AppMetadataProvider>
			<ProDashboardContent />
		</AppMetadataProvider>
	)
}
