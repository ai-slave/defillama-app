import * as Ariakit from '@ariakit/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
	TimePeriod
} from './dashboardTypes'
import { useAutoSave } from './hooks/useAutoSave'
import { useDashboardAPI } from './hooks/useDashboardAPI'
import { useDashboardConfigFallback } from './hooks/useDashboardConfigFallback'
import { useDashboardPermissions } from './hooks/useDashboardPermissions'
import { useDashboardStream } from './hooks/useDashboardStream'
import { useFreeTierStatus } from './hooks/useFreeTierStatus'
import { isDashboardInitialRenderHydration } from './initialDashboard'
import { buildProDashboardParentMapping } from './protocolCatalog'
import { ProxyAuthTokenContext, StreamDoneContext, useProtocolsAndChains } from './queries'
import { DashboardError, matchesDashboardKey } from './services/DashboardAPI'
import type { Chain, Protocol } from './types'
import { useDashboardActions } from './useDashboardActions'
import { toPersistedDashboardItems } from './utils/dashboardUtils'

const EMPTY_PROTOCOLS: Protocol[] = []
const EMPTY_CHAINS: Chain[] = []
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
	protocols: Protocol[]
	chains: Chain[]
	protocolsLoading: boolean
	protocolCatalog: ChartDataPrerequisite
	getChainInfo: (chainName: string) => Chain | undefined
	getProtocolInfo: (protocolId: string) => Protocol | undefined
	parentMapping: ReadonlyMap<string, readonly string[]>
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
	dashboardTags: string[]
	dashboardDescription: string
	isLoadingDashboard: boolean
	streamHasResolved: boolean
	loadError: { status: number; message: string } | null
	reloadDashboard: () => void
	getCurrentRatingSession: () => (AISessionData & { sessionId: string }) | null
	autoSkipOlderSessionsForRating: () => Promise<void>
	setDashboardName: (name: string) => void
	setDashboardVisibility: (visibility: 'private' | 'public') => void
	setDashboardTags: (tags: string[]) => void
	setDashboardDescription: (description: string) => void
	deleteDashboard: (id: string) => Promise<void>
	saveDashboard: (overrides?: {
		dashboardName?: string
		visibility?: 'private' | 'public'
		tags?: string[]
		description?: string
		aiGenerated?: AIGeneratedData | null
		items?: DashboardItemConfig[]
		aiUndoState?: AIUndoState | null
	}) => Promise<void>
	copyDashboard: () => Promise<void>
	handleCreateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: string[]
		description: string
		items?: DashboardItemConfig[]
		aiGenerated?: AIGeneratedData | null
	}) => Promise<void>
	handleGenerateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: string[]
		description: string
		items: DashboardItemConfig[]
		aiGenerationContext?: {
			sessionId: string
			mode: 'create' | 'iterate'
			timestamp: string
			prompt: string
		}
	}) => Promise<void>
	handleIterateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: string[]
		description: string
		items: DashboardItemConfig[]
		aiGenerationContext?: {
			sessionId: string
			mode: 'create' | 'iterate'
			timestamp: string
			prompt: string
		}
	}) => Promise<void>
	submitRating: (sessionId: string, rating: number, feedback?: string) => Promise<void>
	skipRating: (sessionId: string) => Promise<void>
	dismissRating: (sessionId: string) => void
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
	| 'setCurrentDashboard'
>

interface ProDashboardItemsStateContextType {
	items: DashboardItemConfig[]
}

interface ProDashboardUIContextType {
	createDashboardDialogStore: DialogStore
	showGenerateDashboardModal: boolean
	setShowGenerateDashboardModal: (show: boolean) => void
	showIterateDashboardModal: boolean
	setShowIterateDashboardModal: (show: boolean) => void
}

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
	initialItems?: DashboardItemConfig[]
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
	initialItems?: DashboardItemConfig[]
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
		if (stream.dashboard) {
			queryClient.setQueryData(dashboardQueryKey, stream.dashboard, {
				updatedAt: Date.now()
			})
		}
	}, [stream.dashboard, queryClient, dashboardQueryKey])

	const initArg = initialDashboard
		? { dashboard: initialDashboard }
		: initialItems?.length
			? {
					...(initialDashboardId === undefined ? {} : { dashboardId: initialDashboardId }),
					items: initialItems
				}
			: initialDashboardId
	const [state, dispatch] = useReducer(dashboardReducer, initArg, initDashboardState)

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
	const needsProtocolCatalog = mode !== 'view' || dashboardStreamNeedsProtocolCatalog(items)
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

	const applyDashboard = useCallback((dashboard: Dashboard) => {
		dispatch({ type: 'APPLY_DASHBOARD', payload: dashboard })
	}, [])
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

	const createDashboardDialogStore = Ariakit.useDialogStore()

	// Use the dashboard API hook
	const {
		createDashboard,
		updateDashboard,
		deleteDashboard: deleteDashboardWithConfirmation,
		loadDashboard: loadDashboardData
	} = useDashboardAPI()

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

	// Use the auto-save hook
	const { autoSave } = useAutoSave({
		dashboardId,
		dashboardName,
		dashboardVisibility,
		dashboardTags,
		dashboardDescription,
		timePeriod,
		customTimePeriod,
		isAuthenticated,
		isReadOnly: isReadOnlyUntilDashboardLoaded,
		currentDashboard,
		userId: user?.id,
		updateDashboard,
		toPersistedDashboardItems,
		isFreeUser,
		mode
	})

	const actions = useDashboardActions(dispatch, state, autoSave, isReadOnlyUntilDashboardLoaded)

	const {
		setTimePeriod,
		setCustomTimePeriod,
		setDashboardName,
		setDashboardVisibility,
		setDashboardTags,
		setDashboardDescription,
		setShowGenerateDashboardModal,
		setShowIterateDashboardModal,
		setItems,
		setCurrentDashboard
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
			? { initialData: initialDashboard }
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
			tags?: string[]
			description?: string
			aiGenerated?: AIGeneratedData | null
			items?: DashboardItemConfig[]
			aiUndoState?: AIUndoState | null
		}) => {
			if (!isAuthenticated) {
				toast.error('Please sign in to save dashboards')
				return
			}

			if (isReadOnly) {
				return
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
				...(overrides && 'aiUndoState' in overrides ? { aiUndoState: overrides.aiUndoState } : {})
			}

			if (dashboardId) {
				const savedDashboard = await updateDashboard({ id: dashboardId, data })
				if (savedDashboard) {
					applyDashboard(savedDashboard)
					if (savedDashboard.artifactActivationPending) {
						toast.error('Dashboard saved, but chart refresh setup is pending.')
					}
				}
			} else {
				const newDashboard = await createDashboard(data)
				if (newDashboard) {
					applyDashboard(newDashboard)
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
			currentDashboard?.aiGenerated,
			isAuthenticated,
			isReadOnly,
			isFreeUser,
			updateDashboard,
			createDashboard,
			applyDashboard
		]
	)

	const autoSkipOlderSessionsForRating = useCallback(async () => {
		if (!isAuthenticated || !currentDashboard?.aiGenerated || !user?.id || !dashboardId) return
		const latestSession = getLatestPendingRating(currentDashboard.aiGenerated, user.id)
		if (!latestSession) return
		let updatedAiGenerated: AIGeneratedData | null = null
		for (const sessionId in currentDashboard.aiGenerated) {
			if (!Object.hasOwn(currentDashboard.aiGenerated, sessionId) || sessionId === latestSession.sessionId) continue
			const session = currentDashboard.aiGenerated[sessionId]
			if (!session || !isPendingRating(session, user.id)) continue
			if (updatedAiGenerated === null) updatedAiGenerated = { ...currentDashboard.aiGenerated }
			updatedAiGenerated[sessionId] = {
				...session,
				rated: false,
				skipped: true
			}
		}
		if (!updatedAiGenerated) return

		try {
			await saveDashboard({ aiGenerated: updatedAiGenerated })
		} catch (error) {
			console.log('Failed to auto-skip older sessions:', error)
			return
		}

		setCurrentDashboard((prev) =>
			prev
				? {
						...prev,
						aiGenerated: updatedAiGenerated
					}
				: null
		)
	}, [isAuthenticated, currentDashboard, user, dashboardId, saveDashboard, setCurrentDashboard])

	// Save dashboard name
	// Copy dashboard
	const copyDashboard = useCallback(async () => {
		if (!isAuthenticated) {
			toast.error('Please sign in to copy dashboards')
			return
		}

		if (!canCreateDashboard) {
			toast.error('You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.')
			return
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

		try {
			await createDashboard(data)
		} catch (error) {
			console.log('Failed to copy dashboard:', error)
		}
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
			tags: string[]
			description: string
			items?: DashboardItemConfig[]
			aiGenerated?: AIGeneratedData | null
		}) => {
			if (!canCreateDashboard) {
				toast.error('You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.')
				return
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

			try {
				await createDashboard(dashboardData)
			} catch (error) {
				console.log('Failed to create new dashboard:', error)
				toast.error('Failed to create new dashboard')
			}
		},
		[createDashboard, canCreateDashboard, isFreeUser]
	)

	const handleGenerateDashboard = useCallback(
		async (data: {
			dashboardName: string
			visibility: 'private' | 'public'
			tags: string[]
			description: string
			items: DashboardItemConfig[]
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

			await handleCreateDashboard({
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
			tags: string[]
			description: string
			items: DashboardItemConfig[]
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
							items: items,
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

				setItems(data.items)
				setCurrentDashboard((prev) =>
					prev
						? {
								...prev,
								data: {
									...prev.data,
									items: data.items,
									...(aiUndoState === undefined ? {} : { aiUndoState })
								},
								...(updatedAiGenerated ? { aiGenerated: updatedAiGenerated } : {})
							}
						: null
				)
			} else {
				setItems(data.items)
			}
		},
		[dashboardId, saveDashboard, user, currentDashboard, items, setItems, setCurrentDashboard]
	)

	const submitRating = useCallback(
		async (sessionId: string, rating: number, feedback?: string) => {
			if (!isAuthenticated || !user?.id || !dashboardId) {
				toast.error('Please sign in to rate dashboards')
				return
			}

			const currentAiGenerated = currentDashboard?.aiGenerated ?? {}
			const existingSession = currentAiGenerated[sessionId]
			if (!existingSession) {
				toast.error('This rating session is no longer available')
				return
			}
			const updatedAiGenerated: AIGeneratedData = {
				...currentAiGenerated,
				[sessionId]: {
					...existingSession,
					rating,
					...(feedback === undefined ? {} : { feedback }),
					userId: user.id,
					rated: true
				}
			}

			try {
				await saveDashboard({
					aiGenerated: updatedAiGenerated
				})
			} catch (error) {
				console.log('Failed to submit rating:', error)
				toast.error('Failed to submit rating. Please try again.')
				return
			}

			setCurrentDashboard((prev) =>
				prev
					? {
							...prev,
							aiGenerated: updatedAiGenerated
						}
					: null
			)

			toast.success('Thank you for your feedback!')
		},
		[isAuthenticated, user, dashboardId, currentDashboard, saveDashboard, setCurrentDashboard]
	)

	const skipRating = useCallback(
		async (sessionId: string) => {
			if (!isAuthenticated || !user?.id || !dashboardId) {
				return
			}

			const currentAiGenerated = currentDashboard?.aiGenerated ?? {}
			const existingSession = currentAiGenerated[sessionId]
			if (!existingSession) return
			const updatedAiGenerated: AIGeneratedData = {
				...currentAiGenerated,
				[sessionId]: {
					...existingSession,
					userId: user.id,
					rated: false,
					skipped: true
				}
			}

			try {
				await saveDashboard({
					aiGenerated: updatedAiGenerated
				})
			} catch (error) {
				console.log('Failed to skip rating:', error)
				return
			}

			setCurrentDashboard((prev) =>
				prev
					? {
							...prev,
							aiGenerated: updatedAiGenerated
						}
					: null
			)
		},
		[isAuthenticated, user, dashboardId, currentDashboard, saveDashboard, setCurrentDashboard]
	)

	const dismissRating = useCallback(
		async (sessionId: string) => {
			await skipRating(sessionId)
		},
		[skipRating]
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

		setItems(previousItems)
		setCurrentDashboard((prev) => {
			if (!prev) return null
			const { aiUndoState: _aiUndoState, ...dashboardData } = prev.data
			return {
				...prev,
				data: { ...dashboardData, items: previousItems },
				aiGenerated: updatedAiGenerated
			}
		})
	}, [currentDashboard, dashboardId, saveDashboard, setItems, setCurrentDashboard])

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
			autoSkipOlderSessionsForRating,
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
			skipRating,
			dismissRating,
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
			autoSkipOlderSessionsForRating,
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
			skipRating,
			dismissRating,
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
