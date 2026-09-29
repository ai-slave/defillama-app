import * as Ariakit from '@ariakit/react'
import { replaceEqualDeep, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
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
import {
	getDashboardHydrationState,
	getDashboardUpdatedAtMs,
	isDashboardEditingLocked,
	shouldApplyTrustedDashboard
} from './dashboardHydrationState'
import type { DashboardItemConfig } from './dashboardItemConfig'
import { streamPrefetchItemIds } from './dashboardLayout/buildDashboardLayout'
import { type DashboardHistoryEntry, dashboardReducer, initDashboardState } from './dashboardReducer'
import { dashboardItemHasStreamSources, dashboardStreamNeedsProtocolCatalog } from './dashboardStreamCapabilities'
import { INITIAL_DASHBOARD_STREAM_ITEM_COUNT } from './dashboardStreamContract'
import type {
	AIGeneratedData,
	AISessionData,
	AIUndoState,
	CustomTimePeriod,
	Dashboard,
	DashboardAnnotation,
	DashboardMode,
	DashboardRatingDecision,
	DashboardRole,
	DashboardTeam,
	DashboardVariable,
	TimePeriod
} from './dashboardTypes'
import { MAX_DASHBOARD_VARIABLES } from './dashboardTypes'
import {
	applyVariableValuesToItems,
	bindDashboardItems,
	type DashboardVariableCatalog,
	detectParameterCandidates,
	getEffectiveVariableValues,
	type ParameterCandidate,
	type ParameterUnavailable,
	readVariableOverridesFromQuery,
	replaceVariableOverridesInQuery,
	resolveDashboardItems,
	restoreItemsAfterIterate,
	setDashboardItemBinding,
	stripCustomDataRows,
	unbindDashboardVariable,
	VARIABLE_QUERY_PREFIX,
	type VariableBindingTarget
} from './dashboardVariables/resolve'
import { isDashboardWidget } from './dashboardWidgets'
import { notifyForcedPublicVisibility } from './freeTierNotice'
import { useAutoSave } from './hooks/useAutoSave'
import { getUnsavedDashboardChanges, useDashboardAPI, wasDashboardDeleted } from './hooks/useDashboardAPI'
import { useDashboardConfigFallback } from './hooks/useDashboardConfigFallback'
import { useDashboardPermissions, type DashboardReadOnlyReason } from './hooks/useDashboardPermissions'
import { useDashboardStream } from './hooks/useDashboardStream'
import { useFreeTierStatus } from './hooks/useFreeTierStatus'
import { isDashboardInitialRenderHydration } from './initialDashboard'
import {
	buildProDashboardParentMapping,
	buildProDashboardProtocolRelations,
	type ProDashboardProtocolRelations
} from './protocolCatalog'
import { ProxyAuthTokenContext, StreamDoneContext, StreamItemReadinessContext, useProtocolsAndChains } from './queries'
import { DashboardError, dashboardUrlKey, matchesDashboardKey } from './services/DashboardAPI'
import type { Chain, DashboardBindableField, Protocol } from './types'
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
	protocolRelations: ProDashboardProtocolRelations
}

interface ProDashboardPermissionsContextType {
	isReadOnly: boolean
	dashboardOwnerId: string | null
	hideDuplicateButton: boolean
	reason: DashboardReadOnlyReason
	role: DashboardRole
	canEdit: boolean
	canDelete: boolean
	canMove: boolean
	team: DashboardTeam | null
}

interface ProDashboardStreamProgressContextType {
	readyCount: number
	totalCount: number
	isStreaming: boolean
	isDone: boolean
	error: string | null
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
	moveDashboardTeam: (teamId: string | null) => Promise<void>
	publishDashboard: () => Promise<void>
	copyDashboard: () => Promise<Dashboard>
	handleCreateDashboard: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items?: Array<DashboardItemConfig>
		variables?: Array<DashboardVariable>
		aiGenerated?: AIGeneratedData | null
		teamId?: string
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
	| 'setVariables'
	| 'setVariableOverrides'
	| 'setAnnotations'
	| 'dispatchItemsWithVariablesAndSave'
	| 'undo'
	| 'redo'
>

interface ProDashboardItemsStateContextType {
	items: Array<DashboardItemConfig>
}

interface ProDashboardVariablesContextType {
	variables: Array<DashboardVariable>
	overrides: Record<string, string>
	values: Record<string, string>
	catalog: DashboardVariableCatalog | null
	resolvedItems: Array<DashboardItemConfig>
	unavailableByItemId: ReadonlyMap<string, ParameterUnavailable>
	candidates: Array<ParameterCandidate>
	canEditVariables: boolean
	setVariableValue: (variableId: string, value: string, options?: { persist?: boolean }) => void
	addVariable: (variable: DashboardVariable, bindTargets: ReadonlyArray<VariableBindingTarget>) => void
	bindItemField: (itemId: string, field: DashboardBindableField, variableId: string | null) => void
	renameVariable: (variableId: string, label: string) => void
	removeVariable: (variableId: string) => void
	unbindVariable: (variableId: string) => void
}

interface ProDashboardAnnotationsContextType {
	annotations: Array<DashboardAnnotation>
	setAnnotations: (annotations: Array<DashboardAnnotation>) => void
}

interface ProDashboardHistoryContextType {
	canUndo: boolean
	canRedo: boolean
	/** The entry Undo restores next. */
	undoEntry: DashboardHistoryEntry | null
	undo: () => boolean
	redo: () => boolean
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
const ProDashboardVariablesContext = createContext<ProDashboardVariablesContextType | undefined>(undefined)
const ProDashboardAnnotationsContext = createContext<ProDashboardAnnotationsContextType | undefined>(undefined)
const ProDashboardHistoryContext = createContext<ProDashboardHistoryContextType | undefined>(undefined)
const ProDashboardStreamProgressContext = createContext<ProDashboardStreamProgressContextType | undefined>(undefined)
const EMPTY_VARIABLE_OVERRIDES: Record<string, string> = {}

function readInitialVariableOverrides(): Record<string, string> {
	if (typeof window === 'undefined') return EMPTY_VARIABLE_OVERRIDES
	const query: Record<string, string> = {}
	for (const [key, value] of new URLSearchParams(window.location.search)) {
		if (key.startsWith(VARIABLE_QUERY_PREFIX)) query[key] = value
	}
	const overrides = readVariableOverridesFromQuery(query)
	return Object.keys(overrides).length > 0 ? overrides : EMPTY_VARIABLE_OVERRIDES
}

export function ProDashboardAPIProvider({
	children,
	initialDashboardId,
	initialDashboard,
	initialItems,
	hideDuplicateButton = false,
	mode = 'view',
	streamItemId
}: {
	children: ReactNode
	initialDashboardId?: string
	initialDashboard?: Dashboard | null
	initialItems?: Array<DashboardItemConfig>
	hideDuplicateButton?: boolean
	mode?: DashboardMode
	streamItemId?: string
}) {
	const { authToken, hasActiveSubscription, loaders } = useAuthContext()
	const hasMounted = useClientReady()
	const hasStoredToken = typeof window !== 'undefined' && pb.authStore.isValid && !!pb.authStore.token
	const authReady = hasMounted && !loaders.userLoading && (!hasStoredToken || !!authToken)
	const streamVariableOverrides = useMemo(() => readInitialVariableOverrides(), [])
	const initialDashboardEditedAt = initialDashboard?.editedAt
	const streamOptions = useMemo(
		() => ({
			...(streamVariableOverrides === EMPTY_VARIABLE_OVERRIDES ? {} : { variableOverrides: streamVariableOverrides }),
			...(streamItemId === undefined ? {} : { itemId: streamItemId }),
			...(initialDashboardEditedAt ? { version: initialDashboardEditedAt } : {})
		}),
		[streamVariableOverrides, streamItemId, initialDashboardEditedAt]
	)
	const stream = useDashboardStream(initialDashboardId, authToken, authReady, streamOptions)
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
				<StreamItemReadinessContext.Provider value={stream.readyItemIds}>
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
				</StreamItemReadinessContext.Provider>
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
		const draft = getUnsavedDashboardChanges(queryClient, initial.dashboardId, user?.id)
		// QueryClient retains in-flight/failed writes across route remounts. Recover the whole draft without retrying it.
		return draft
			? {
					...initial,
					...(draft.items === undefined ? {} : { items: draft.items }),
					...(draft.variables === undefined ? {} : { variables: draft.variables }),
					...(draft.annotations === undefined ? {} : { annotations: draft.annotations }),
					...(draft.timePeriod === undefined ? {} : { timePeriod: draft.timePeriod }),
					...(draft.customTimePeriod === undefined ? {} : { customTimePeriod: draft.customTimePeriod })
				}
			: initial
	})

	useEffect(() => {
		if (!initialDashboard && initialItems && initialItems.length > 0) {
			dispatch({ type: 'SET_ITEMS', payload: initialItems, skipHistory: true })
		}
	}, [initialDashboard, initialItems])

	const {
		items,
		timePeriod,
		customTimePeriod,
		variables,
		annotations,
		variableOverrides,
		history,
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
		isFetching: protocolCatalogFetching,
		refetch: refetchProtocolCatalog
	} = useProtocolsAndChains({ enabled: needsProtocolCatalog, waitForStream: waitForStreamedProtocolCatalog })
	const retryProtocolCatalog = useCallback(() => {
		void refetchProtocolCatalog()
	}, [refetchProtocolCatalog])
	const protocolCatalog = useMemo<ChartDataPrerequisite>(() => {
		if (!needsProtocolCatalog || protocolsAndChains !== undefined) return { status: 'ready' }
		if (protocolCatalogHasError && !protocolCatalogFetching) return { status: 'error', retry: retryProtocolCatalog }
		return { status: 'loading' }
	}, [needsProtocolCatalog, protocolCatalogHasError, protocolCatalogFetching, protocolsAndChains, retryProtocolCatalog])
	const protocolsLoading = protocolCatalog.status === 'loading'
	const protocols = protocolsAndChains?.protocols ?? EMPTY_PROTOCOLS
	const rawChains = protocolsAndChains?.chains ?? EMPTY_CHAINS
	const chains = rawChains
	const parentMapping = useMemo(() => buildProDashboardParentMapping(protocols), [protocols])
	const protocolRelations = useMemo(
		() => buildProDashboardProtocolRelations(protocolsAndChains ?? null),
		[protocolsAndChains]
	)
	const protocolBySlug = protocolRelations.protocolsBySlug

	const applyDashboard = useCallback(
		(dashboard: Dashboard) => {
			if (wasDashboardDeleted(queryClient, dashboard.id, user?.id)) return
			dispatch({ type: 'APPLY_DASHBOARD', payload: dashboard })
			if (currentDashboard?.id !== dashboard.id) {
				const draft = getUnsavedDashboardChanges(queryClient, dashboard.id, user?.id)
				if (draft) {
					if (draft.items) {
						dispatch({
							type: 'SET_ITEMS',
							payload: draft.items,
							...(draft.variables === undefined ? {} : { variables: draft.variables }),
							skipHistory: true
						})
					} else if (draft.variables) {
						dispatch({ type: 'SET_VARIABLES', payload: draft.variables, skipHistory: true })
					}
					if (draft.annotations) dispatch({ type: 'SET_ANNOTATIONS', payload: draft.annotations })
					if (draft.timePeriod) dispatch({ type: 'SET_TIME_PERIOD', payload: draft.timePeriod })
					if (draft.customTimePeriod !== undefined) {
						dispatch({ type: 'SET_CUSTOM_TIME_PERIOD', payload: draft.customTimePeriod })
					}
				}
			}
		},
		[currentDashboard?.id, queryClient, user?.id]
	)
	const lastAppliedTrustedDashboardRef = useRef<Dashboard | null>(initialDashboard ?? null)
	const [hasTrustedDashboard, setHasTrustedDashboard] = useState(!initialDashboard)

	// Use the dashboard API hook
	const {
		createDashboard: { mutateAsync: createDashboard },
		updateDashboard: { mutateAsync: updateDashboard },
		moveDashboardTeam: { mutateAsync: moveDashboardTeamRequest },
		deleteDashboard: deleteDashboardWithConfirmation,
		loadDashboard: loadDashboardData,
		navigateToDashboard
	} = useDashboardAPI(dashboardId)

	// Use the permissions hook
	const {
		isReadOnly: rawIsReadOnly,
		dashboardOwnerId,
		reason,
		role: dashboardRole,
		canEdit: canEditDashboard,
		canDelete: canDeleteDashboard,
		canMove: canMoveDashboard,
		team: dashboardTeam
	} = useDashboardPermissions(currentDashboard)
	const isReadOnly = mode === 'view' ? true : rawIsReadOnly
	const isReadOnlyUntilDashboardLoaded = isDashboardEditingLocked({
		isReadOnly,
		hasDashboardId: !!initialDashboardId,
		hasCurrentDashboard: !!currentDashboard,
		mode,
		hasInitialDashboard: !!initialDashboard,
		hasTrustedDashboard
	})
	const isOwnerWriteLocked = isDashboardEditingLocked({
		isReadOnly: rawIsReadOnly,
		hasDashboardId: !!initialDashboardId,
		hasCurrentDashboard: !!currentDashboard,
		mode: 'edit',
		hasInitialDashboard: !!initialDashboard,
		hasTrustedDashboard
	})

	const autosave = useAutoSave({
		dashboard: currentDashboard,
		isFreeUser,
		enabled: !isReadOnlyUntilDashboardLoaded && isAuthenticated && !!user?.id && canEditDashboard,
		timePeriod,
		customTimePeriod,
		variables,
		annotations
	})

	const { flush, acknowledge, hasPendingSave } = autosave

	const applyTrustedDashboard = useCallback(
		(dashboard: Dashboard | null | undefined) => {
			if (
				!dashboard ||
				isDashboardInitialRenderHydration(dashboard) ||
				!matchesDashboardKey(dashboard, initialDashboardId) ||
				lastAppliedTrustedDashboardRef.current === dashboard
			)
				return
			setHasTrustedDashboard(true)
			if (
				!shouldApplyTrustedDashboard({
					hasPendingSave: currentDashboard?.id === dashboard.id && hasPendingSave(),
					incomingUpdatedAt: getDashboardUpdatedAtMs(dashboard),
					appliedUpdatedAt: getDashboardUpdatedAtMs(lastAppliedTrustedDashboardRef.current)
				})
			)
				return
			lastAppliedTrustedDashboardRef.current = dashboard
			applyDashboard(dashboard)
		},
		[applyDashboard, initialDashboardId, hasPendingSave, currentDashboard?.id]
	)

	useEffect(() => {
		applyTrustedDashboard(stream.dashboard)
	}, [applyTrustedDashboard, stream.dashboard])

	const router = useRouter()
	const routerQuery = router.query
	const requestedTabId = typeof routerQuery.tab === 'string' ? routerQuery.tab : null
	const actions = useDashboardActions(
		dispatch,
		state,
		autosave.autoSave,
		isReadOnlyUntilDashboardLoaded,
		requestedTabId
	)

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
		setVariables,
		setVariableOverrides,
		setAnnotations,
		dispatchItemsWithVariablesAndSave,
		undo,
		redo
	} = actions

	useEffect(() => {
		const overrides = readVariableOverridesFromQuery(routerQuery as Record<string, string | Array<string> | undefined>)
		dispatch({ type: 'SET_VARIABLE_OVERRIDES', payload: overrides })
	}, [routerQuery])

	const getCurrentRatingSession = useCallback(() => {
		if (!isAuthenticated || !currentDashboard?.aiGenerated || !user?.id) return null
		return getLatestPendingRating(currentDashboard.aiGenerated, user.id)
	}, [isAuthenticated, currentDashboard, user])

	// Load initial dashboard — stream seeds this cache key, queryFn fires as fallback after stream
	const initialDashboardUpdatedAt = getDashboardUpdatedAtMs(initialDashboard)
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
		refetchOnWindowFocus: false,
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
	useEffect(() => {
		if (!initialDashboardId || !dashboardReady) return
		const refreshOnReturn = () => {
			if (document.visibilityState !== 'visible' || hasPendingSave()) return
			void queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
		}
		document.addEventListener('visibilitychange', refreshOnReturn)
		return () => document.removeEventListener('visibilitychange', refreshOnReturn)
	}, [initialDashboardId, dashboardReady, hasPendingSave, queryClient, dashboardQueryKey])
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
		async (
			overrides?: {
				dashboardName?: string
				visibility?: 'private' | 'public'
				tags?: Array<string>
				description?: string
				aiGenerated?: AIGeneratedData | null
				items?: Array<DashboardItemConfig>
				aiUndoState?: AIUndoState | null
			},
			options?: { allowOwnerInViewMode?: boolean }
		) => {
			if (!isAuthenticated) {
				throw new Error('Please sign in to save dashboards')
			}

			if (options?.allowOwnerInViewMode ? isOwnerWriteLocked : isReadOnly) {
				throw new Error('This dashboard is read-only')
			}

			// Reconciliation compares editable fields, not dialog visibility or the whole reducer state.
			const submitted = {
				items,
				timePeriod,
				customTimePeriod,
				variables,
				annotations,
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
			const requestedVisibility = overrides?.visibility ?? dashboardVisibility
			if (isFreeUser && requestedVisibility !== 'public') notifyForcedPublicVisibility()
			const data = {
				items: cleanedItems,
				dashboardName: nameToSave,
				timePeriod,
				customTimePeriod,
				variables,
				annotations,
				visibility: isFreeUser ? ('public' as const) : requestedVisibility,
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
						variables,
						annotations,
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
			variables,
			annotations,
			dashboardId,
			dashboardVisibility,
			dashboardTags,
			dashboardDescription,
			currentDashboard,
			isAuthenticated,
			isReadOnly,
			isOwnerWriteLocked,
			isFreeUser,
			updateDashboard,
			flush,
			acknowledge,
			createDashboard,
			navigateToDashboard
		]
	)

	const publishDashboard = useCallback(async () => {
		await saveDashboard({ visibility: 'public' }, { allowOwnerInViewMode: true })
	}, [saveDashboard])

	const moveDashboardTeam = useCallback(
		async (teamId: string | null) => {
			if (!dashboardId) throw new Error('Save the dashboard before sharing it with your team')
			if (!canMoveDashboard) throw new Error('Only the dashboard creator or the team admin can change this')
			await moveDashboardTeamRequest({ id: dashboardId, teamId })
		},
		[dashboardId, canMoveDashboard, moveDashboardTeamRequest]
	)

	const handleCreateDashboard = useCallback(
		async (data: {
			dashboardName: string
			visibility: 'private' | 'public'
			tags: Array<string>
			description: string
			items?: Array<DashboardItemConfig>
			variables?: Array<DashboardVariable>
			aiGenerated?: AIGeneratedData | null
			teamId?: string
		}) => {
			if (!canCreateDashboard) {
				throw new Error('You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.')
			}

			if (isFreeUser && data.visibility !== 'public') notifyForcedPublicVisibility()

			const defaultTimePeriod: TimePeriod = '365d'
			const dashboardData = {
				items: data.items ?? [],
				dashboardName: data.dashboardName,
				timePeriod: defaultTimePeriod,
				...(data.variables === undefined ? {} : { variables: data.variables }),
				visibility: isFreeUser ? ('public' as const) : data.visibility,
				tags: data.tags,
				description: data.description,
				aiGenerated: data.aiGenerated ?? null,
				...(data.teamId && !isFreeUser ? { teamId: data.teamId } : {})
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

			const restoredItems = restoreItemsAfterIterate(items, data.items)
			if (dashboardId) {
				const aiUndoState: AIUndoState | undefined = data.aiGenerationContext
					? {
							items: stripCustomDataRows(items),
							timestamp: new Date().toISOString(),
							sessionId: data.aiGenerationContext.sessionId
						}
					: undefined

				await saveDashboard({
					items: restoredItems,
					visibility: data.visibility,
					tags: data.tags,
					description: data.description,
					...(updatedAiGenerated ? { aiGenerated: updatedAiGenerated } : {}),
					...(aiUndoState === undefined ? {} : { aiUndoState })
				})
			} else {
				setItems(restoredItems)
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

		const currentById = new Map(items.map((item) => [item.id, item]))
		const previousItems = currentDashboard.data.aiUndoState.items.map((item) => {
			if (item.kind !== 'custom-data' || item.rows !== undefined) return item
			const current = currentById.get(item.id)
			return current?.kind === 'custom-data' && current.rows !== undefined ? { ...item, rows: current.rows } : item
		})
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
		dispatch({ type: 'CLEAR_HISTORY' })
	}, [currentDashboard, dashboardId, saveDashboard, items])

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

	const variableCatalog = useMemo<DashboardVariableCatalog | null>(
		() =>
			protocolsAndChains
				? { hasChain: (name) => chainByName.has(name), getProtocol: (slug) => protocolBySlug.get(slug) }
				: null,
		[protocolsAndChains, chainByName, protocolBySlug]
	)
	const variableValues = useMemo(
		() => getEffectiveVariableValues(variables, variableOverrides, variableCatalog),
		[variables, variableOverrides, variableCatalog]
	)
	const resolution = useMemo(
		() => resolveDashboardItems(items, variables, variableOverrides, variableCatalog),
		[items, variables, variableOverrides, variableCatalog]
	)
	const canEditVariables = !isReadOnlyUntilDashboardLoaded
	const parameterCandidates = useMemo(
		() => (canEditVariables && variables.length === 0 ? detectParameterCandidates(items) : []),
		[canEditVariables, variables.length, items]
	)
	const copyDashboard = useCallback(async () => {
		if (!isAuthenticated) {
			throw new Error('Please sign in to copy dashboards')
		}

		if (!canCreateDashboard) {
			throw new Error('You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.')
		}

		const effectiveVariables = variables.map((variable) => {
			const value = variableValues[variable.id]
			return value === undefined || value === variable.value ? variable : { ...variable, value }
		})
		const cleanedItems = toPersistedDashboardItems(
			applyVariableValuesToItems(items, effectiveVariables, variableCatalog)
		)
		const data = {
			items: cleanedItems,
			dashboardName,
			timePeriod,
			customTimePeriod,
			variables: effectiveVariables,
			annotations,
			visibility: isFreeUser ? ('public' as const) : dashboardVisibility,
			...(dashboardId && { copySourceDashboardId: dashboardId })
		}

		return createDashboard(data)
	}, [
		items,
		dashboardName,
		timePeriod,
		customTimePeriod,
		variables,
		variableValues,
		variableCatalog,
		annotations,
		isAuthenticated,
		createDashboard,
		canCreateDashboard,
		isFreeUser,
		dashboardVisibility,
		dashboardId
	])

	const setVariableValue = useCallback(
		(variableId: string, value: string, options?: { persist?: boolean }) => {
			const replaceVariableQuery = (nextOverrides: Record<string, string>) => {
				const query = replaceVariableOverridesInQuery(router.query, nextOverrides)
				void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false })
			}
			if (options?.persist && canEditVariables) {
				const nextVariables = variables.map((variable) =>
					variable.id === variableId && variable.value !== value ? { ...variable, value } : variable
				)
				const nextItems = applyVariableValuesToItems(items, nextVariables, variableCatalog)
				dispatchItemsWithVariablesAndSave(nextItems, nextVariables)
				if (variableOverrides[variableId] !== undefined) {
					const rest = Object.fromEntries(Object.entries(variableOverrides).filter(([id]) => id !== variableId))
					setVariableOverrides(rest)
					replaceVariableQuery(rest)
				}
				return
			}
			const nextOverrides = { ...variableOverrides, [variableId]: value }
			setVariableOverrides(nextOverrides)
			replaceVariableQuery(nextOverrides)
		},
		[
			canEditVariables,
			variables,
			items,
			variableCatalog,
			variableOverrides,
			dispatchItemsWithVariablesAndSave,
			setVariableOverrides,
			router
		]
	)
	const addVariable = useCallback(
		(variable: DashboardVariable, bindTargets: ReadonlyArray<VariableBindingTarget>) => {
			if (!canEditVariables || variables.length >= MAX_DASHBOARD_VARIABLES) return
			if (variables.some((existing) => existing.id === variable.id)) return
			const nextVariables = [...variables, variable]
			const boundItems = bindDashboardItems(items, bindTargets, variable.id)
			dispatchItemsWithVariablesAndSave(
				applyVariableValuesToItems(boundItems, nextVariables, variableCatalog),
				nextVariables
			)
		},
		[canEditVariables, variables, items, variableCatalog, dispatchItemsWithVariablesAndSave]
	)
	const bindItemField = useCallback(
		(itemId: string, field: DashboardBindableField, variableId: string | null) => {
			if (!canEditVariables) return
			const nextItems = items.map((item) =>
				item.id === itemId ? setDashboardItemBinding(item, field, variableId) : item
			)
			if (nextItems.every((item, index) => item === items[index])) return
			dispatchItemsWithVariablesAndSave(applyVariableValuesToItems(nextItems, variables, variableCatalog), variables)
		},
		[canEditVariables, items, variables, variableCatalog, dispatchItemsWithVariablesAndSave]
	)
	const renameVariable = useCallback(
		(variableId: string, label: string) => {
			setVariables(variables.map((variable) => (variable.id === variableId ? { ...variable, label } : variable)))
		},
		[variables, setVariables]
	)
	const unbindVariable = useCallback(
		(variableId: string) => {
			const nextItems = unbindDashboardVariable(items, variableId)
			if (nextItems !== items) dispatchItemsWithVariablesAndSave(nextItems, variables)
		},
		[items, variables, dispatchItemsWithVariablesAndSave]
	)
	const removeVariable = useCallback(
		(variableId: string) => {
			if (!canEditVariables) return
			dispatchItemsWithVariablesAndSave(
				unbindDashboardVariable(items, variableId),
				variables.filter((variable) => variable.id !== variableId)
			)
		},
		[canEditVariables, items, variables, dispatchItemsWithVariablesAndSave]
	)
	const variablesContextValue = useMemo<ProDashboardVariablesContextType>(
		() => ({
			variables,
			overrides: variableOverrides,
			values: variableValues,
			catalog: variableCatalog,
			resolvedItems: resolution.items,
			unavailableByItemId: resolution.unavailableByItemId,
			candidates: parameterCandidates,
			canEditVariables,
			setVariableValue,
			addVariable,
			bindItemField,
			renameVariable,
			removeVariable,
			unbindVariable
		}),
		[
			variables,
			variableOverrides,
			variableValues,
			variableCatalog,
			resolution,
			parameterCandidates,
			canEditVariables,
			setVariableValue,
			addVariable,
			bindItemField,
			renameVariable,
			removeVariable,
			unbindVariable
		]
	)
	const annotationsContextValue = useMemo<ProDashboardAnnotationsContextType>(
		() => ({ annotations, setAnnotations }),
		[annotations, setAnnotations]
	)
	const historyContextValue = useMemo<ProDashboardHistoryContextType>(
		() => ({
			canUndo: history.past.length > 0,
			canRedo: history.future.length > 0,
			undoEntry: history.past.at(-1) ?? null,
			undo,
			redo
		}),
		[history, undo, redo]
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
			protocolBySlug,
			protocolRelations
		}),
		[
			protocols,
			chains,
			protocolsLoading,
			protocolCatalog,
			getChainInfo,
			getProtocolInfo,
			parentMapping,
			protocolBySlug,
			protocolRelations
		]
	)

	const readOnlyReason: DashboardReadOnlyReason =
		reason ?? (mode === 'view' ? 'view-mode' : isReadOnlyUntilDashboardLoaded ? 'dashboard-loading' : null)

	const permissionsContextValue = useMemo(
		() => ({
			isReadOnly: isReadOnlyUntilDashboardLoaded,
			dashboardOwnerId,
			hideDuplicateButton,
			reason: readOnlyReason,
			role: dashboardRole,
			canEdit: canEditDashboard,
			canDelete: canDeleteDashboard,
			canMove: canMoveDashboard,
			team: dashboardTeam
		}),
		[
			isReadOnlyUntilDashboardLoaded,
			dashboardOwnerId,
			hideDuplicateButton,
			readOnlyReason,
			dashboardRole,
			canEditDashboard,
			canDeleteDashboard,
			canMoveDashboard,
			dashboardTeam
		]
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
			moveDashboardTeam,
			publishDashboard,
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
			moveDashboardTeam,
			publishDashboard,
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

	const streamProgressItemIds = useMemo(() => {
		const windowIds = new Set(streamPrefetchItemIds(items, INITIAL_DASHBOARD_STREAM_ITEM_COUNT))
		const ids: Array<string> = []
		for (const item of items) {
			if (!isDashboardWidget(item)) continue
			if (dashboardItemHasStreamSources(item) && !windowIds.has(item.id)) continue
			ids.push(item.id)
		}
		return ids
	}, [items])

	const streamProgressContextValue = useMemo(() => {
		let readyCount = 0
		for (const id of streamProgressItemIds) if (stream.readyItemIds.has(id)) readyCount++
		return {
			readyCount,
			totalCount: streamProgressItemIds.length,
			isStreaming: stream.isStreaming,
			isDone: stream.isDone,
			error: stream.error
		}
	}, [streamProgressItemIds, stream.error, stream.isDone, stream.isStreaming, stream.readyItemIds])

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
									<ProDashboardStreamProgressContext.Provider value={streamProgressContextValue}>
										<ProDashboardVariablesContext.Provider value={variablesContextValue}>
											<ProDashboardAnnotationsContext.Provider value={annotationsContextValue}>
												<ProDashboardHistoryContext.Provider value={historyContextValue}>
													<ProDashboardUIContext.Provider value={uiContextValue}>
														{children}
													</ProDashboardUIContext.Provider>
												</ProDashboardHistoryContext.Provider>
											</ProDashboardAnnotationsContext.Provider>
										</ProDashboardVariablesContext.Provider>
									</ProDashboardStreamProgressContext.Provider>
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

export function useDashboardStreamProgress() {
	const context = useContext(ProDashboardStreamProgressContext)
	if (context === undefined) {
		throw new Error('useDashboardStreamProgress must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardVariables() {
	const context = useContext(ProDashboardVariablesContext)
	if (context === undefined) {
		throw new Error('useProDashboardVariables must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardAnnotations() {
	const context = useContext(ProDashboardAnnotationsContext)
	if (context === undefined) {
		throw new Error('useProDashboardAnnotations must be used within a ProDashboardAPIProvider')
	}
	return context
}

export function useProDashboardHistory() {
	const context = useContext(ProDashboardHistoryContext)
	if (context === undefined) {
		throw new Error('useProDashboardHistory must be used within a ProDashboardAPIProvider')
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

/** The raw contexts, so tests can render consumers with plain dashboard state instead of the loading provider. */
export const ProDashboardContexts = {
	Save: ProDashboardSaveContext,
	Time: ProDashboardTimeContext,
	Catalog: ProDashboardCatalogContext,
	Permissions: ProDashboardPermissionsContext,
	Mode: ProDashboardModeContext,
	Dashboard: ProDashboardDashboardContext,
	EditorActions: ProDashboardEditorActionsContext,
	ItemsState: ProDashboardItemsStateContext,
	StreamProgress: ProDashboardStreamProgressContext,
	Variables: ProDashboardVariablesContext,
	Annotations: ProDashboardAnnotationsContext,
	History: ProDashboardHistoryContext,
	UI: ProDashboardUIContext
}
