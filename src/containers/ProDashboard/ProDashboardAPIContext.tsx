import * as Ariakit from '@ariakit/react'
import { replaceEqualDeep, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
	useSyncExternalStore
} from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import pb from '~/utils/pocketbase'
import type { ChartDataPrerequisite } from './chartRuntime'
import { getDashboardHydrationState, isDashboardEditingLocked } from './dashboardHydrationState'
import type { DashboardItemConfig } from './dashboardItemConfig'
import { dashboardReducer, initDashboardState } from './dashboardReducer'
import { dashboardStreamNeedsProtocolCatalog } from './dashboardStreamCapabilities'
import { INITIAL_DASHBOARD_STREAM_ITEM_COUNT } from './dashboardStreamContract'
import type {
	AIGeneratedData,
	AIUndoState,
	AISessionData,
	CustomTimePeriod,
	Dashboard,
	DashboardMode,
	DashboardRatingDecision,
	TimePeriod
} from './dashboardTypes'
import { useAutoSave } from './hooks/useAutoSave'
import { getUnsavedDashboardItems, useDashboardAPI, wasDashboardDeleted } from './hooks/useDashboardAPI'
import { useDashboardConfigFallback } from './hooks/useDashboardConfigFallback'
import { useDashboardPermissions } from './hooks/useDashboardPermissions'
import { useDashboardStream } from './hooks/useDashboardStream'
import { useFreeTierStatus } from './hooks/useFreeTierStatus'
import { isDashboardInitialRenderHydration } from './initialDashboard'
import { buildProDashboardParentMapping } from './protocolCatalog'
import { ProxyAuthTokenContext, StreamDoneContext, useProtocolsAndChains } from './queries'
import { DashboardError, dashboardUrlKey, matchesDashboardKey } from './services/DashboardAPI'
import type { Chain, Protocol } from './types'
import { useDashboardActions } from './useDashboardActions'
import { toPersistedDashboardItems } from './utils/dashboardUtils'

const EMPTY_PROTOCOLS: Array<Protocol> = []
const EMPTY_CHAINS: Array<Chain> = []
const NOOP = () => {}

function subscribeToClientReady(onStoreChange: () => void) {
	queueMicrotask(onStoreChange)
	return NOOP
}

function getClientReadySnapshot() {
	return true
}

function getServerReadySnapshot() {
	return false
}

function useClientReady() {
	return useSyncExternalStore(subscribeToClientReady, getClientReadySnapshot, getServerReadySnapshot)
}

function getDashboardInitialUpdatedAt(dashboard?: Dashboard | null) {
	if (!dashboard) return undefined
	const updatedAt = Date.parse(dashboard.editedAt || dashboard.updated || dashboard.created || '')
	return Number.isFinite(updatedAt) ? updatedAt : undefined
}

function isPendingRating(session: AISessionData, userId: string): boolean {
	return session.userId === userId && session.rating === undefined && !session.skipped
}

function getLatestPendingRating(
	aiGenerated: AIGeneratedData,
	userId: string
): (AISessionData & { sessionId: string }) | null {
	let latest: (AISessionData & { sessionId: string }) | null = null
	let latestTimestamp = Number.NEGATIVE_INFINITY
	for (const sessionId in aiGenerated) {
		if (!Object.hasOwn(aiGenerated, sessionId)) continue
		const session = aiGenerated[sessionId]
		if (!session || !isPendingRating(session, userId)) continue
		const timestamp = Date.parse(session.timestamp)
		if (latest && timestamp <= latestTimestamp) continue
		latest = { ...session, sessionId, rated: false }
		latestTimestamp = timestamp
	}
	return latest
}

type DialogStore = ReturnType<typeof Ariakit.useDialogStore>

interface ProDashboardTimeContextType {
	timePeriod: TimePeriod
	customTimePeriod: CustomTimePeriod | null
	setTimePeriod: (period: TimePeriod) => void
	setCustomTimePeriod: (customPeriod: CustomTimePeriod | null) => void
}

interface ProDashboardCatalogContextType {
	protocols: Array<Protocol>
	chains: Array<Chain>
	protocolsLoading: boolean
	protocolCatalog: ChartDataPrerequisite
	getChainInfo: (chainName: string) => Chain | undefined
	getProtocolInfo: (protocolId: string) => Protocol | undefined
	parentMapping: ReadonlyMap<string, ReadonlyArray<string>>
	protocolBySlug: ReadonlyMap<string, Protocol>
}

interface ProDashboardPermissionsContextType {
	isReadOnly: boolean
	dashboardOwnerId: string | null
	hideDuplicateButton: boolean
}

interface ProDashboardModeContextType {
	mode: DashboardMode
}

interface ProDashboardDashboardContextType {
	dashboardId: string | null
	currentDashboard: Dashboard | null
	dashboardName: string
	dashboardVisibility: 'private' | 'public'
	dashboardTags: Array<string>
	dashboardDescription: string
	isLoadingDashboard: boolean
	streamHasResolved: boolean
	loadError: { status: number; message: string } | null
	reloadDashboard: () => void
	getCurrentRatingSession: () => (AISessionData & { sessionId: string }) | null
	setDashboardName: (name: string) => void
	setDashboardVisibility: (visibility: 'private' | 'public') => void
	setDashboardTags: (tags: Array<string>) => void
	setDashboardDescription: (description: string) => void
	deleteDashboard: (id: string) => Promise<void>
	saveDashboard: (overrides?: {
		dashboardName?: string
		visibility?: 'private' | 'public'
		tags?: Array<string>
		description?: string
		aiGenerated?: AIGeneratedData | null
		items?: Array<DashboardItemConfig>
		aiUndoState?: AIUndoState | null
	}) => Promise<void>
	copyDashboard: () => Promise<Dashboard>
	handleCreateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items?: Array<DashboardItemConfig>
		aiGenerated?: AIGeneratedData | null
	}) => Promise<Dashboard>
	handleGenerateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items: Array<DashboardItemConfig>
		aiGenerationContext?: {
			sessionId: string
			mode: 'create' | 'iterate'
			timestamp: string
			prompt: string
		}
	}) => Promise<Dashboard>
	handleIterateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items: Array<DashboardItemConfig>
		aiGenerationContext?: {
			sessionId: string
			mode: 'create' | 'iterate'
			timestamp: string
			prompt: string
		}
	}) => Promise<void>
	submitRating: (sessionId: string, decision: DashboardRatingDecision) => Promise<void>
	undoAIGeneration: () => Promise<void>
	canUndo: boolean
}

type ProDashboardEditorActionsContextType = Omit<
	ReturnType<typeof useDashboardActions>,
	| 'setTimePeriod'
	| 'setCustomTimePeriod'
	| 'setDashboardName'
	| 'setDashboardVisibility'
	| 'setDashboardTags'
	| 'setDashboardDescription'
	| 'setShowGenerateDashboardModal'
	| 'setShowIterateDashboardModal'
	| 'setItems'
>

interface ProDashboardItemsStateContextType {
	items: Array<DashboardItemConfig>
}

interface ProDashboardUIContextType {
	createDashboardDialogStore: DialogStore
	showGenerateDashboardModal: boolean
	setShowGenerateDashboardModal: (show: boolean) => void
	showIterateDashboardModal: boolean
	setShowIterateDashboardModal: (show: boolean) => void
}

const ProDashboardSaveContext = createContext<ReturnType<typeof useAutoSave> | null>(null)

const ProDashboardTimeContext = createContext<ProDashboardTimeContextType | undefined>(undefined)
const ProDashboardCatalogContext = createContext<ProDashboardCatalogContextType | undefined>(undefined)
const ProDashboardPermissionsContext = createContext<ProDashboardPermissionsContextType | undefined>(undefined)
const ProDashboardModeContext = createContext<ProDashboardModeContextType>({
	mode: 'view'
})
const ProDashboardDashboardContext = createContext<ProDashboardDashboardContextType | undefined>(undefined)
const ProDashboardEditorActionsContext = createContext<ProDashboardEditorActionsContextType | undefined>(undefined)
const ProDashboardItemsStateContext = createContext<ProDashboardItemsStateContextType | undefined>(undefined)
const ProDashboardUIContext = createContext<ProDashboardUIContextType | undefined>(undefined)

export function ProDashboardAPIProvider({
	children,
	initialDashboardId,
	initialDashboard,
	initialItems,
	hideDuplicateButton = false,
	mode = 'view'
}: {
	children: ReactNode
	initialDashboardId?: string
	initialDashboard?: Dashboard | null
	initialItems?: Array<DashboardItemConfig>
	hideDuplicateButton?: boolean
	mode?: DashboardMode
}) {
	const { authToken, hasActiveSubscription, loaders } = useAuthContext()
	const hasMounted = useClientReady()
	const hasStoredToken = typeof window !== 'undefined' && pb.authStore.isValid && !!pb.authStore.token
	const authReady = hasMounted && !loaders.userLoading && (!hasStoredToken || !!authToken)
	const stream = useDashboardStream(initialDashboardId, authToken, authReady)
	const hasInitialDashboard = matchesDashboardKey(initialDashboard, initialDashboardId)
	const { dashboardReady, streamDone, streamHasResolved, shouldFetchTrustedDashboardFallback } =
		getDashboardHydrationState({
			hasDashboardId: !!initialDashboardId,
			hasInitialDashboard,
			authReady,
			streamIsDone: stream.isDone,
			hasStreamDashboard: stream.dashboard != null
		})
	const proxyAuthToken = hasActiveSubscription && pb.authStore.isValid ? pb.authStore.token : null
	const modeContextValue = useMemo(() => ({ mode }), [mode])

	return (
		<ProDashboardModeContext.Provider value={modeContextValue}>
			<StreamDoneContext.Provider value={streamDone}>
				<ProxyAuthTokenContext.Provider value={proxyAuthToken}>
					<ProDashboardAPIProviderInner
						stream={stream}
						dashboardReady={dashboardReady}
						streamHasResolved={streamHasResolved}
						shouldFetchTrustedDashboardFallback={shouldFetchTrustedDashboardFallback}
						mode={mode}
						{...(initialDashboardId === undefined ? {} : { initialDashboardId })}
						initialDashboard={hasInitialDashboard ? (initialDashboard ?? null) : null}
						{...(initialItems === undefined ? {} : { initialItems })}
						{...(hideDuplicateButton ? { hideDuplicateButton } : {})}
					>
						{children}
					</ProDashboardAPIProviderInner>
				</ProxyAuthTokenContext.Provider>
			</StreamDoneContext.Provider>
		</ProDashboardModeContext.Provider>
	)
}

function ProDashboardAPIProviderInner({
	children,
	stream,
	dashboardReady,
	streamHasResolved,
	shouldFetchTrustedDashboardFallback,
	mode,
	initialDashboardId,
	initialDashboard,
	initialItems,
	hideDuplicateButton = false
}: {
	children: ReactNode
	stream: ReturnType<typeof useDashboardStream>
	dashboardReady: boolean
	streamHasResolved: boolean
	shouldFetchTrustedDashboardFallback: boolean
	mode: DashboardMode
	initialDashboardId?: string
	initialDashboard?: Dashboard | null
	initialItems?: Array<DashboardItemConfig>
	hideDuplicateButton?: boolean
}) {
	const queryClient = useQueryClient()

	const { isAuthenticated, user } = useAuthContext()
	const { canCreateDashboard, isFreeUser } = useFreeTierStatus()

	const dashboardQueryKey = useMemo(
		() => ['pro-dashboard', 'dashboard', initialDashboardId, isAuthenticated, user?.id],
		[initialDashboardId, isAuthenticated, user?.id]
	)
	useEffect(() => {
		if (stream.dashboard && !wasDashboardDeleted(queryClient, stream.dashboard.id, user?.id)) {
			queryClient.setQueryData(dashboardQueryKey, stream.dashboard, {
				updatedAt: Date.now()
			})
			// Slug routes and mutation scopes must share the same confirmed snapshot by dashboard id.
			if (stream.dashboard.id !== initialDashboardId) {
				queryClient.setQueryData(
					['pro-dashboard', 'dashboard', stream.dashboard.id, isAuthenticated, user?.id],
					stream.dashboard
				)
			}
		}
	}, [stream.dashboard, queryClient, dashboardQueryKey, initialDashboardId, isAuthenticated, user?.id])

	const initArg = initialDashboard
		? { dashboard: initialDashboard }
		: initialItems?.length
			? {
					...(initialDashboardId === undefined ? {} : { dashboardId: initialDashboardId }),
					items: initialItems
				}
			: initialDashboardId
	const [state, dispatch] = useReducer(dashboardReducer, initArg, (arg) => {
		const initial = initDashboardState(arg)
		const draft = getUnsavedDashboardItems(queryClient, initial.dashboardId, user?.id)
		// QueryClient retains in-flight/failed writes across route remounts. Recover the draft without retrying it.
		return draft ? { ...initial, items: draft } : initial
	})

	useEffect(() => {
		if (!initialDashboard && initialItems && initialItems.length > 0) {
			dispatch({ type: 'SET_ITEMS', payload: initialItems })
		}
	}, [initialDashboard, initialItems])

	const {
		items,
		timePeriod,
		customTimePeriod,
		dashboardName,
		dashboardId,
		currentDashboard,
		dashboardVisibility,
		dashboardTags,
		dashboardDescription,
		showGenerateDashboardModal,
		showIterateDashboardModal
	} = state
	const createDashboardDialogStore = Ariakit.useDialogStore()
	const createDashboardDialogOpen = Ariakit.useStoreState(createDashboardDialogStore, 'open')
	const needsProtocolCatalog =
		createDashboardDialogOpen || mode !== 'view' || dashboardStreamNeedsProtocolCatalog(items)
	const waitForStreamedProtocolCatalog =
		!dashboardReady || dashboardStreamNeedsProtocolCatalog(items.slice(0, INITIAL_DASHBOARD_STREAM_ITEM_COUNT))
	const {
		data: protocolsAndChains,
		isError: protocolCatalogHasError,
		refetch: refetchProtocolCatalog
	} = useProtocolsAndChains({ enabled: needsProtocolCatalog, waitForStream: waitForStreamedProtocolCatalog })
	const retryProtocolCatalog = useCallback(() => {
		void refetchProtocolCatalog()
	}, [refetchProtocolCatalog])
	const protocolCatalog = useMemo<ChartDataPrerequisite>(() => {
		if (!needsProtocolCatalog || protocolsAndChains !== undefined) return { status: 'ready' }
		if (protocolCatalogHasError) return { status: 'error', retry: retryProtocolCatalog }
		return { status: 'loading' }
	}, [needsProtocolCatalog, protocolCatalogHasError, protocolsAndChains, retryProtocolCatalog])
	const protocolsLoading = protocolCatalog.status === 'loading'
	const protocols = protocolsAndChains?.protocols ?? EMPTY_PROTOCOLS
	const rawChains = protocolsAndChains?.chains ?? EMPTY_CHAINS
	const chains = rawChains
	const parentMapping = useMemo(() => buildProDashboardParentMapping(protocols), [protocols])
	const protocolBySlug = useMemo(() => {
		const map = new Map<string, Protocol>()
		for (const protocol of protocols) map.set(protocol.slug, protocol)
		return map
	}, [protocols])

	const applyDashboard = useCallback(
		(dashboard: Dashboard) => {
			if (wasDashboardDeleted(queryClient, dashboard.id, user?.id)) return
			dispatch({ type: 'APPLY_DASHBOARD', payload: dashboard })
			if (currentDashboard?.id !== dashboard.id) {
				const draft = getUnsavedDashboardItems(queryClient, dashboard.id, user?.id)
				if (draft) dispatch({ type: 'SET_ITEMS', payload: draft })
			}
		},
		[currentDashboard?.id, queryClient, user?.id]
	)
	const lastAppliedTrustedDashboardRef = useRef<Dashboard | null>(initialDashboard ?? null)
	const [hasTrustedDashboard, setHasTrustedDashboard] = useState(!initialDashboard)
	const applyTrustedDashboard = useCallback(
		(dashboard: Dashboard | null | undefined) => {
			if (
				!dashboard ||
				isDashboardInitialRenderHydration(dashboard) ||
				!matchesDashboardKey(dashboard, initialDashboardId) ||
				lastAppliedTrustedDashboardRef.current === dashboard
			)
				return
			lastAppliedTrustedDashboardRef.current = dashboard
			setHasTrustedDashboard(true)
			applyDashboard(dashboard)
		},
		[applyDashboard, initialDashboardId]
	)

	useEffect(() => {
		applyTrustedDashboard(stream.dashboard)
	}, [applyTrustedDashboard, stream.dashboard])

	// Use the dashboard API hook
	const {
		createDashboard: { mutateAsync: createDashboard },
		updateDashboard: { mutateAsync: updateDashboard },
		deleteDashboard: deleteDashboardWithConfirmation,
		loadDashboard: loadDashboardData,
		navigateToDashboard
	} = useDashboardAPI(dashboardId)

	// Use the permissions hook
	const { isReadOnly: rawIsReadOnly, dashboardOwnerId } = useDashboardPermissions(currentDashboard)
	const isReadOnly = mode === 'view' ? true : rawIsReadOnly
	const isReadOnlyUntilDashboardLoaded = isDashboardEditingLocked({
		isReadOnly,
		hasDashboardId: !!initialDashboardId,
		hasCurrentDashboard: !!currentDashboard,
		mode,
		hasInitialDashboard: !!initialDashboard,
		hasTrustedDashboard
	})

	const autosave = useAutoSave({
		dashboard: currentDashboard,
		isFreeUser,
		enabled: !isReadOnlyUntilDashboardLoaded && isAuthenticated && !!user?.id && currentDashboard?.user === user.id,
		timePeriod,
		customTimePeriod
	})

	const { flush, acknowledge } = autosave
	const actions = useDashboardActions(dispatch, state, autosave.autoSave, isReadOnlyUntilDashboardLoaded)

	const {
		setTimePeriod,
		setCustomTimePeriod,
		setDashboardName,
		setDashboardVisibility,
		setDashboardTags,
		setDashboardDescription,
		setShowGenerateDashboardModal,
		setShowIterateDashboardModal,
		setItems
	} = actions

	const getCurrentRatingSession = useCallback(() => {
		if (!isAuthenticated || !currentDashboard?.aiGenerated || !user?.id) return null
		return getLatestPendingRating(currentDashboard.aiGenerated, user.id)
	}, [isAuthenticated, currentDashboard, user])

	// Load initial dashboard — stream seeds this cache key, queryFn fires as fallback after stream
	const initialDashboardUpdatedAt = getDashboardInitialUpdatedAt(initialDashboard)
	const {
		data: currentDashboard2 = null,
		isLoading: isQueryLoadingDashboard,
		error: dashboardQueryError,
		refetch: refetchDashboardQuery
	} = useQuery<Dashboard | null>({
		queryKey: dashboardQueryKey,
		queryFn: async () => {
			if (!initialDashboardId) {
				return null
			}

			return await loadDashboardData(initialDashboardId)
		},
		staleTime: 1000 * 60 * 5,
		refetchOnMount: initialDashboard ? false : 'always',
		retry: (failureCount, error) => error instanceof DashboardError && error.status >= 500 && failureCount < 3,
		enabled: dashboardReady && !!initialDashboardId,
		...(initialDashboard && matchesDashboardKey(initialDashboard, initialDashboardId)
			? {
					// Read the deletion marker when seeding, not from a memoized render-time cache read.
					initialData: () =>
						wasDashboardDeleted(queryClient, initialDashboard.id, user?.id) ? undefined : initialDashboard
				}
			: {}),
		...(initialDashboardUpdatedAt === undefined ? {} : { initialDataUpdatedAt: initialDashboardUpdatedAt })
	})
	useDashboardConfigFallback(shouldFetchTrustedDashboardFallback, refetchDashboardQuery)
	// Loading until dashboard config arrives from stream (or query fallback)
	const isLoadingDashboard =
		(!!initialDashboardId && stream.dashboard === undefined && !dashboardReady) || isQueryLoadingDashboard

	useEffect(() => {
		applyTrustedDashboard(currentDashboard2)
	}, [applyTrustedDashboard, currentDashboard2])

	const loadError = useMemo<{ status: number; message: string } | null>(() => {
		if (!initialDashboardId || currentDashboard) return null
		if (dashboardQueryError) {
			const status = dashboardQueryError instanceof DashboardError ? dashboardQueryError.status : 500
			const message = dashboardQueryError instanceof Error ? dashboardQueryError.message : 'Failed to load dashboard'
			return { status, message }
		}
		if (streamHasResolved && !currentDashboard2 && stream.error) {
			const match = stream.error.match(/Stream failed:\s*(\d+)/)
			const status = match ? Number(match[1]) : 500
			return { status, message: stream.error }
		}
		return null
	}, [initialDashboardId, currentDashboard, dashboardQueryError, streamHasResolved, currentDashboard2, stream.error])

	const reloadDashboard = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
		void refetchDashboardQuery()
	}, [queryClient, dashboardQueryKey, refetchDashboardQuery])

	const deleteDashboard = useCallback(
		async (id: string) => {
			await deleteDashboardWithConfirmation(id, currentDashboard?.id === id ? currentDashboard?.slug : undefined)
		},
		[deleteDashboardWithConfirmation, currentDashboard?.id, currentDashboard?.slug]
	)

	// Save dashboard
	const saveDashboard = useCallback(
		async (overrides?: {
			dashboardName?: string
			visibility?: 'private' | 'public'
			tags?: Array<string>
			description?: string
			aiGenerated?: AIGeneratedData | null
			items?: Array<DashboardItemConfig>
			aiUndoState?: AIUndoState | null
		}) => {
			if (!isAuthenticated) {
				throw new Error('Please sign in to save dashboards')
			}

			if (isReadOnly) {
				throw new Error('This dashboard is read-only')
			}

			// Reconciliation compares editable fields, not dialog visibility or the whole reducer state.
			const submitted = {
				items,
				timePeriod,
				customTimePeriod,
				dashboardName,
				dashboardId,
				dashboardVisibility,
				dashboardTags,
				dashboardDescription
			}
			const itemsToSave = overrides?.items ?? items
			const cleanedItems = toPersistedDashboardItems(itemsToSave)
			const nameToSave = overrides?.dashboardName ?? dashboardName
			const aiGeneratedToSave =
				overrides && 'aiGenerated' in overrides ? overrides.aiGenerated : (currentDashboard?.aiGenerated ?? null)
			const data = {
				items: cleanedItems,
				dashboardName: nameToSave,
				timePeriod,
				customTimePeriod,
				visibility: isFreeUser ? ('public' as const) : (overrides?.visibility ?? dashboardVisibility),
				tags: overrides?.tags ?? dashboardTags,
				description: overrides?.description ?? dashboardDescription,
				aiGenerated: aiGeneratedToSave,
				aiUndoState: currentDashboard?.data.aiUndoState ?? null,
				...(overrides && 'aiUndoState' in overrides ? { aiUndoState: overrides.aiUndoState } : {})
			}

			if (dashboardId) {
				// Queue existing item edits first; this action owns only its explicit changes and local drafts.
				const flushedAutosave = flush()
				const savedDashboard = await updateDashboard({
					id: dashboardId,
					data,
					changes: {
						...(currentDashboard && replaceEqualDeep(currentDashboard.data.items, items) !== currentDashboard.data.items
							? { items: cleanedItems }
							: {}),
						timePeriod,
						customTimePeriod,
						...overrides,
						...(overrides?.items ? { items: cleanedItems } : {}),
						...(isFreeUser ? { visibility: 'public' as const } : {})
					}
				})
				if (savedDashboard) {
					acknowledge(flushedAutosave)
					dispatch({ type: 'SAVE_DASHBOARD', payload: savedDashboard, submitted })
					if (savedDashboard.artifactActivationPending) {
						toast.error('Dashboard saved, but chart refresh setup is pending.')
					}
				}
			} else {
				const newDashboard = await createDashboard(data, {
					onSuccess: (dashboard) => navigateToDashboard(dashboardUrlKey(dashboard))
				})
				if (newDashboard) {
					dispatch({ type: 'SAVE_DASHBOARD', payload: newDashboard, submitted })
					if (newDashboard.artifactActivationPending) {
						toast.error('Dashboard saved, but chart refresh setup is pending.')
					}
				}
			}
		},
		[
			items,
			dashboardName,
			timePeriod,
			customTimePeriod,
			dashboardId,
			dashboardVisibility,
			dashboardTags,
			dashboardDescription,
			currentDashboard,
			isAuthenticated,
			isReadOnly,
			isFreeUser,
			updateDashboard,
			flush,
			acknowledge,
			createDashboard,
			navigateToDashboard
		]
	)

	const copyDashboard = useCallback(async () => {
		if (!isAuthenticated) {
			throw new Error('Please sign in to copy dashboards')
		}

		if (!canCreateDashboard) {
			throw new Error('You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.')
		}

		const cleanedItems = toPersistedDashboardItems(items)
		const data = {
			items: cleanedItems,
			dashboardName: `${dashboardName} (Copy)`,
			timePeriod,
			customTimePeriod,
			visibility: isFreeUser ? ('public' as const) : dashboardVisibility,
			...(dashboardId && { copySourceDashboardId: dashboardId })
		}

		return createDashboard(data)
	}, [
		items,
		dashboardName,
		timePeriod,
		customTimePeriod,
		isAuthenticated,
		createDashboard,
		canCreateDashboard,
		isFreeUser,
		dashboardVisibility,
		dashboardId
	])

	const handleCreateDashboard = useCallback(
		async (data: {
			dashboardName: string
			visibility: 'private' | 'public'
			tags: Array<string>
			description: string
			items?: Array<DashboardItemConfig>
			aiGenerated?: AIGeneratedData | null
		}) => {
			if (!canCreateDashboard) {
				throw new Error('You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.')
			}

			const defaultTimePeriod: TimePeriod = '365d'
			const dashboardData = {
				items: data.items ?? [],
				dashboardName: data.dashboardName,
				timePeriod: defaultTimePeriod,
				visibility: isFreeUser ? ('public' as const) : data.visibility,
				tags: data.tags,
				description: data.description,
				aiGenerated: data.aiGenerated ?? null
			}

			return createDashboard(dashboardData)
		},
		[createDashboard, canCreateDashboard, isFreeUser]
	)

	const handleGenerateDashboard = useCallback(
		async (data: {
			dashboardName: string
			visibility: 'private' | 'public'
			tags: Array<string>
			description: string
			items: Array<DashboardItemConfig>
			aiGenerationContext?: {
				sessionId: string
				mode: 'create' | 'iterate'
				timestamp: string
				prompt: string
			}
		}) => {
			let aiGeneratedData: AIGeneratedData | null = null
			if (data.aiGenerationContext && user?.id) {
				const { sessionId, mode: aiMode, timestamp, prompt } = data.aiGenerationContext
				aiGeneratedData = {
					[sessionId]: {
						mode: aiMode,
						timestamp,
						prompt,
						userId: user.id,
						rated: false
					}
				}
			}

			return handleCreateDashboard({
				...data,
				aiGenerated: aiGeneratedData
			})
		},
		[handleCreateDashboard, user]
	)

	const handleIterateDashboard = useCallback(
		async (data: {
			dashboardName: string
			visibility: 'private' | 'public'
			tags: Array<string>
			description: string
			items: Array<DashboardItemConfig>
			aiGenerationContext?: {
				sessionId: string
				mode: 'create' | 'iterate'
				timestamp: string
				prompt: string
			}
		}) => {
			let updatedAiGenerated: AIGeneratedData | null = null
			if (data.aiGenerationContext && user?.id) {
				const { sessionId, mode: aiMode, timestamp, prompt } = data.aiGenerationContext
				const currentAiGenerated = currentDashboard?.aiGenerated || {}

				updatedAiGenerated = {
					...currentAiGenerated,
					[sessionId]: {
						mode: aiMode,
						timestamp,
						prompt,
						userId: user.id,
						rated: false
					}
				}
			}

			if (dashboardId) {
				const aiUndoState: AIUndoState | undefined = data.aiGenerationContext
					? {
							items,
							timestamp: new Date().toISOString(),
							sessionId: data.aiGenerationContext.sessionId
						}
					: undefined

				await saveDashboard({
					items: data.items,
					visibility: data.visibility,
					tags: data.tags,
					description: data.description,
					...(updatedAiGenerated ? { aiGenerated: updatedAiGenerated } : {}),
					...(aiUndoState === undefined ? {} : { aiUndoState })
				})
			} else {
				setItems(data.items)
			}
		},
		[dashboardId, saveDashboard, user, currentDashboard, items, setItems]
	)

	const submitRating = useCallback(
		async (sessionId: string, decision: DashboardRatingDecision) => {
			if (!isAuthenticated || !user?.id || !dashboardId) {
				throw new Error('Please sign in to rate dashboards')
			}

			const currentAiGenerated = currentDashboard?.aiGenerated ?? {}
			const existingSession = currentAiGenerated[sessionId]
			if (!existingSession) throw new Error('This rating session is no longer available')

			await saveDashboard({
				aiGenerated: {
					...currentAiGenerated,
					[sessionId]: {
						...existingSession,
						...decision,
						userId: user.id,
						rated: !('skipped' in decision)
					}
				}
			})
		},
		[isAuthenticated, user, dashboardId, currentDashboard, saveDashboard]
	)

	const undoAIGeneration = useCallback(async () => {
		if (!currentDashboard?.data?.aiUndoState || !dashboardId) {
			return
		}

		const previousItems = currentDashboard.data.aiUndoState.items
		const sessionId = currentDashboard.data.aiUndoState.sessionId

		const existingSession = currentDashboard.aiGenerated?.[sessionId]
		const updatedAiGenerated: AIGeneratedData | null = currentDashboard.aiGenerated
			? existingSession
				? {
						...currentDashboard.aiGenerated,
						[sessionId]: { ...existingSession, rating: -99 }
					}
				: currentDashboard.aiGenerated
			: null

		await saveDashboard({
			items: previousItems,
			aiUndoState: null,
			aiGenerated: updatedAiGenerated
		})
	}, [currentDashboard, dashboardId, saveDashboard])

	const canUndo = !!currentDashboard?.data?.aiUndoState?.items

	const chainByName = useMemo(() => {
		const map = new Map<string, Chain>()
		for (const chain of chains) {
			map.set(chain.name, chain)
		}
		return map
	}, [chains])

	const getChainInfo = useCallback(
		(chainName: string) => {
			return chainByName.get(chainName)
		},
		[chainByName]
	)

	const getProtocolInfo = useCallback(
		(protocolId: string) => {
			return protocolBySlug.get(protocolId)
		},
		[protocolBySlug]
	)

	const timeContextValue = useMemo(
		() => ({
			timePeriod,
			customTimePeriod,
			setTimePeriod,
			setCustomTimePeriod
		}),
		[timePeriod, customTimePeriod, setTimePeriod, setCustomTimePeriod]
	)

	const catalogContextValue = useMemo(
		() => ({
			protocols,
			chains,
			protocolsLoading,
			protocolCatalog,
			getChainInfo,
			getProtocolInfo,
			parentMapping,
			protocolBySlug
		}),
		[protocols, chains, protocolsLoading, protocolCatalog, getChainInfo, getProtocolInfo, parentMapping, protocolBySlug]
	)

	const permissionsContextValue = useMemo(
		() => ({
			isReadOnly: isReadOnlyUntilDashboardLoaded,
			dashboardOwnerId,
			hideDuplicateButton
		}),
		[isReadOnlyUntilDashboardLoaded, dashboardOwnerId, hideDuplicateButton]
	)

	const dashboardContextValue = useMemo(
		() => ({
			dashboardId,
			currentDashboard,
			dashboardName,
			dashboardVisibility,
			dashboardTags,
			dashboardDescription,
			isLoadingDashboard,
			streamHasResolved,
			loadError,
			reloadDashboard,
			getCurrentRatingSession,
			setDashboardName,
			setDashboardVisibility,
			setDashboardTags,
			setDashboardDescription,
			deleteDashboard,
			saveDashboard,
			copyDashboard,
			handleCreateDashboard,
			handleGenerateDashboard,
			handleIterateDashboard,
			submitRating,
			undoAIGeneration,
			canUndo
		}),
		[
			dashboardId,
			currentDashboard,
			dashboardName,
			dashboardVisibility,
			dashboardTags,
			dashboardDescription,
			isLoadingDashboard,
			streamHasResolved,
			loadError,
			reloadDashboard,
			getCurrentRatingSession,
			setDashboardName,
			setDashboardVisibility,
			setDashboardTags,
			setDashboardDescription,
			deleteDashboard,
			saveDashboard,
			copyDashboard,
			handleCreateDashboard,
			handleGenerateDashboard,
			handleIterateDashboard,
			submitRating,
			undoAIGeneration,
			canUndo
		]
	)

	const editorActionsContextValue: ProDashboardEditorActionsContextType = actions

	const itemsStateContextValue = useMemo(
		() => ({
			items
		}),
		[items]
	)

	const uiContextValue = useMemo(
		() => ({
			createDashboardDialogStore,
			showGenerateDashboardModal,
			setShowGenerateDashboardModal,
			showIterateDashboardModal,
			setShowIterateDashboardModal
		}),
		[
			createDashboardDialogStore,
			showGenerateDashboardModal,
			setShowGenerateDashboardModal,
			showIterateDashboardModal,
			setShowIterateDashboardModal
		]
	)

	return (
		<ProDashboardSaveContext.Provider value={autosave}>
			<ProDashboardTimeContext.Provider value={timeContextValue}>
				<ProDashboardCatalogContext.Provider value={catalogContextValue}>
					<ProDashboardPermissionsContext.Provider value={permissionsContextValue}>
						<ProDashboardDashboardContext.Provider value={dashboardContextValue}>
							<ProDashboardEditorActionsContext.Provider value={editorActionsContextValue}>
								<ProDashboardItemsStateContext.Provider value={itemsStateContextValue}>
									<ProDashboardUIContext.Provider value={uiContextValue}>{children}</ProDashboardUIContext.Provider>
								</ProDashboardItemsStateContext.Provider>
							</ProDashboardEditorActionsContext.Provider>
						</ProDashboardDashboardContext.Provider>
					</ProDashboardPermissionsContext.Provider>
				</ProDashboardCatalogContext.Provider>
			</ProDashboardTimeContext.Provider>
		</ProDashboardSaveContext.Provider>
	)
}

export function useProDashboardTime() {
	const context = useContext(ProDashboardTimeContext)
	if (context === undefined) {
		throw new Error('useProDashboardTime must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardCatalog() {
	const context = useContext(ProDashboardCatalogContext)
	if (context === undefined) {
		throw new Error('useProDashboardCatalog must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardPermissions() {
	const context = useContext(ProDashboardPermissionsContext)
	if (context === undefined) {
		throw new Error('useProDashboardPermissions must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardDashboard() {
	const context = useContext(ProDashboardDashboardContext)
	if (context === undefined) {
		throw new Error('useProDashboardDashboard must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardEditorActions() {
	const context = useContext(ProDashboardEditorActionsContext)
	if (context === undefined) {
		throw new Error('useProDashboardEditorActions must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardItemsState() {
	const context = useContext(ProDashboardItemsStateContext)
	if (context === undefined) {
		throw new Error('useProDashboardItemsState must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardUI() {
	const context = useContext(ProDashboardUIContext)
	if (context === undefined) {
		throw new Error('useProDashboardUI must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useDashboardMode() {
	return useContext(ProDashboardModeContext).mode
}

export function useProDashboardSave() {
	const context = useContext(ProDashboardSaveContext)
	if (!context) throw new Error('useProDashboardSave requires ProDashboardAPIProvider')
	return context
}
