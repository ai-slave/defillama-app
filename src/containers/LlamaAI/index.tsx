import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { AI_SERVER } from '~/constants'
import { AbortScope } from '~/containers/LlamaAI/abortScope'
import { authorizedFetchAsFetch } from '~/containers/LlamaAI/authorizedFetchAdapter'
import { LlamaAIChromeContext, useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { ArticleExportProvider } from '~/containers/LlamaAI/components/AddToArticle/ArticleExportContext'
import { useArticleExport } from '~/containers/LlamaAI/components/AddToArticle/useArticleExport'
import { AlertsModal } from '~/containers/LlamaAI/components/AlertsModal'
import { ChatSurface, type LandingOverrideApi } from '~/containers/LlamaAI/components/ChatSurface'
import {
	EmptyConversationErrorState,
	LoadingConversationState,
	type ConversationViewModel
} from '~/containers/LlamaAI/components/ConversationView'
import { DeepLinkPromptModal } from '~/containers/LlamaAI/components/DeepLinkPromptModal'
import { CitationDetailPanel } from '~/containers/LlamaAI/components/messages/CitationDetailPanel'
import {
	CitationSheetProvider,
	useCitationSheetController
} from '~/containers/LlamaAI/components/messages/CitationSheetContext'
import { ResearchLimitModal } from '~/containers/LlamaAI/components/ResearchLimitModal'
import { SettingsModal } from '~/containers/LlamaAI/components/SettingsModal'
import { ShareModal } from '~/containers/LlamaAI/components/ShareModal'
import { AgenticSidebar } from '~/containers/LlamaAI/components/sidebar/AgenticSidebar'
import { TextSelectionPopup } from '~/containers/LlamaAI/components/TextSelectionPopup'
import { TipActionProvider } from '~/containers/LlamaAI/components/TipActionContext'
import { TokenLimitModal } from '~/containers/LlamaAI/components/TokenLimitModal'
import { RECOVERY_MAX_MS } from '~/containers/LlamaAI/connectionErrors'
import { dashboardPanelReducer, INITIAL_DASHBOARD_PANEL_STATE } from '~/containers/LlamaAI/dashboardPanelState'
import { ExecutionCoordinator, type ExecutionOperation } from '~/containers/LlamaAI/executionCoordinator'
import { fetchAgenticResponse } from '~/containers/LlamaAI/fetchAgenticResponse'
import { useAgenticRouteTransition } from '~/containers/LlamaAI/hooks/useAgenticRouteTransition'
import { useChatExecutionOwner } from '~/containers/LlamaAI/hooks/useChatExecutionOwner'
import { useChatQueueController, type QueueSurface } from '~/containers/LlamaAI/hooks/useChatQueueController'
import { useChatScroll } from '~/containers/LlamaAI/hooks/useChatScroll'
import { useClearUnseenCompletion } from '~/containers/LlamaAI/hooks/useClearUnseenCompletion'
import { useDeepLinkPrompt } from '~/containers/LlamaAI/hooks/useDeepLinkPrompt'
import { useForegroundRecovery } from '~/containers/LlamaAI/hooks/useForegroundRecovery'
import { useForkInitialPrompt } from '~/containers/LlamaAI/hooks/useForkInitialPrompt'
import { useLlamaAISetting, useLlamaAISettings } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import { movePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import { useSessionList } from '~/containers/LlamaAI/hooks/useSessionList'
import { useSessionMutations } from '~/containers/LlamaAI/hooks/useSessionMutations'
import { useSettingsRouteIntent } from '~/containers/LlamaAI/hooks/useSettingsRouteIntent'
import { useSidebarVisibility } from '~/containers/LlamaAI/hooks/useSidebarVisibility'
import { useStreamNotification } from '~/containers/LlamaAI/hooks/useStreamNotification'
import { useVisualViewport } from '~/containers/LlamaAI/hooks/useVisualViewport'
import { useWebCompletionSeen } from '~/containers/LlamaAI/hooks/useWebCompletionSeen'
import {
	useWebMobilePushPreference,
	WEB_MOBILE_PUSH_QUERY_KEY
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import {
	mapPersistedMessage,
	mapPersistedMessages,
	mapSharedSessionMessage,
	type PersistedMessage,
	type SessionRestoreResult,
	type SharedSession
} from '~/containers/LlamaAI/messageMappers'
import { AgenticMutationReconcileError, createAgenticMutationEnvelope } from '~/containers/LlamaAI/mutationProtocol'
import { useProjectSessions } from '~/containers/LlamaAI/projects/hooks'
import { ProjectLanding } from '~/containers/LlamaAI/projects/ProjectLanding'
import { ProjectsGrid } from '~/containers/LlamaAI/projects/ProjectsGrid'
import { getProjectTier } from '~/containers/LlamaAI/projects/tier'
import { resolveTimezone, runEnqueue } from '~/containers/LlamaAI/promptEnqueue'
import {
	canProbeSessionAfterEmptyResponse,
	getPromptFailurePolicy,
	isPromptMutationConfirmed,
	materializeFailedPrompt,
	projectPromptFailure,
	promptFailuresReducer,
	type FailedRequest,
	type PromptFailure,
	type PromptFailureAction
} from '~/containers/LlamaAI/promptFailures'
import { decodeQueueSnapshot } from '~/containers/LlamaAI/queue/protocol'
import { reportChatError } from '~/containers/LlamaAI/reportChatError'
import { isFreeLimitError, runAgenticRequest, type UsageLimitError } from '~/containers/LlamaAI/runAgenticRequest'
import { runPromptSubmission } from '~/containers/LlamaAI/runPromptSubmission'
import { settleStopRequest } from '~/containers/LlamaAI/stopSettlement'
import { appendBufferedAssistantMessage, createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import {
	createInitialStreamState,
	createStreamBuffer,
	hasStreamBufferContent,
	streamReducer,
	type ChatPageContext,
	type StreamBuffer
} from '~/containers/LlamaAI/streamState'
import type { AgenticAnswerMode, FreeLimitOffer, Message } from '~/containers/LlamaAI/types'
import { chartsMapFromGroups } from '~/containers/LlamaAI/utils/articleExport'
import { shouldFocusComposerOnSessionChange } from '~/containers/LlamaAI/utils/composerFocus'
import { shouldQueuePrompt } from '~/containers/LlamaAI/utils/composerSubmit'
import { materializePersistedUserMessage } from '~/containers/LlamaAI/utils/materializeUserMessage'
import { hasClaimableQueueWork } from '~/containers/LlamaAI/utils/queueAttach'
import type { SettingsInitialState, SettingsTabId } from '~/containers/LlamaAI/utils/settingsIntent'
import { AI_BALANCE_QUERY_KEY, useAiBalance } from '~/containers/Subscription/useTopup'
import { useLlamaAINavigate, useProjectHomeSignal } from '~/contexts/LlamaAINavigate'
import { useLlamaAIRouteContext } from '~/contexts/LlamaAIRouteState'
import { useOptionalSessionAliases } from '~/contexts/SessionAliasRegistry'
import { useConstant } from '~/hooks/useConstant'
import { useMedia } from '~/hooks/useMedia'
import { useStableCallback } from '~/hooks/useStableCallback'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'
import { DuelPanel, type DuelChoice } from './components/DuelPanel'
import { useDuelStream } from './hooks/useDuelStream'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

const DashboardPanel = lazy(() =>
	import('~/containers/LlamaAI/components/DashboardPanel').then((m) => ({ default: m.DashboardPanel }))
)

type RestoreSessionSnapshotResult = { status: 'restored' | 'failed' | 'aborted' }

function buildFreeLimitMessage(err: UsageLimitError & { code: FreeLimitOffer['code'] }): Message {
	const isDaily = err.code === 'FREE_DAILY_LIMIT'
	let content = isDaily ? "You've reached today's free question limit." : "You've reached your free question limit."
	if (err.details?.resetTime) {
		const resetMs = new Date(err.details.resetTime).getTime() - Date.now()
		if (resetMs > 0) {
			const hours = Math.floor(resetMs / 3_600_000)
			const minutes = Math.floor((resetMs % 3_600_000) / 60_000)
			const timeStr = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`
			content += ` Resets in ${timeStr}.`
		}
	}
	return {
		role: 'assistant',
		content,
		freeLimitOffer: {
			code: err.code,
			resetTime: err.details?.resetTime ?? null
		}
	}
}

type PromptTransitionMode = 'idle' | 'landing' | 'conversation'

type PreparedPromptSubmission = {
	currentSessionId: string
	failedRequest: FailedRequest
	submitProjectId: string | null
}

function getPromptDraftScope(sessionId: string | null, projectId: string | null): string {
	if (sessionId) return `session:${sessionId}`
	return projectId ? `project:${projectId}` : 'new'
}

const SHARE_TOOLTIP = 'Share conversation'
const SHARE_PENDING_TOOLTIP = 'Available once the conversation is saved.'

type RecoveryController = {
	id: number
	sessionId: string
	startedAt: number
	buffer: StreamBuffer
	failedRequest: FailedRequest | null
	lastErrorMessage: string | null
	attemptCount: number
	timer: number | null
}

function scheduleRecoveryAttempt(controller: RecoveryController, delay: number, execute: () => void) {
	if (controller.timer !== null) window.clearTimeout(controller.timer)
	controller.timer = window.setTimeout(() => {
		controller.timer = null
		execute()
	}, delay)
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return String(error)
}

// Capture the current scroll height so older messages can be prepended without jumping the viewport.
function getScrollSnapshot(container: HTMLDivElement | null) {
	return {
		container,
		prevScrollHeight: container?.scrollHeight ?? 0
	}
}

// Wait for the next paint before measuring or restoring scroll positions.
function waitForNextPaint() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve())
	})
}

// Restore the user's relative scroll position after older messages are added above.
function restoreScrollPosition(snapshot: { container: HTMLDivElement | null; prevScrollHeight: number }) {
	if (!snapshot.container) return
	snapshot.container.scrollTop = snapshot.container.scrollHeight - snapshot.prevScrollHeight
}

// Keep pagination state shape consistent across restore and load-more responses.
function normalizePaginationState(
	pagination: { hasMore?: boolean; cursor?: number | null; hasNewer?: boolean; newerCursor?: number | null } | undefined
): {
	hasMore: boolean
	cursor: number | null
	hasNewer?: boolean
	newerCursor?: number | null
} {
	return {
		hasMore: pagination?.hasMore || false,
		cursor: pagination?.cursor ?? null,
		hasNewer: pagination?.hasNewer ?? false,
		newerCursor: pagination?.newerCursor ?? null
	}
}

interface AgenticChatProps {
	sharedSession?: SharedSession
	readOnly?: boolean
	onForkSubmit?: (prompt: string) => void
	onSharedSessionFork?: (sessionId: string) => void
	initialPrompt?: string
	shareToken?: string
	rightPanel?: React.ReactNode
}

export function AgenticChat({
	sharedSession,
	readOnly = false,
	onForkSubmit,
	onSharedSessionFork,
	initialPrompt,
	shareToken,
	rightPanel
}: AgenticChatProps = {}) {
	const { authorizedFetch, user, hasActiveSubscription, isTrial } = useAuthContext()
	const hasUser = !!user
	const isMobileChatView = useMedia('(max-width: 1023px)')
	const route = useLlamaAIRouteContext()
	const navigate = useLlamaAINavigate()
	const projectHomeSignal = useProjectHomeSignal()
	const sessionAliases = useOptionalSessionAliases()
	const resolveSessionAlias = useCallback((id: string) => sessionAliases?.resolve(id) ?? id, [sessionAliases])
	const registerSessionAlias = useCallback(
		(fakeId: string, realId: string) => {
			sessionAliases?.register(fakeId, realId)
		},
		[sessionAliases]
	)
	const routeSessionId = route.kind === 'chat-session' ? resolveSessionAlias(route.sessionId) : null
	const routeProjectId = route.kind === 'project' ? route.projectId : null
	const routeInitialPrompt = route.kind === 'chat-session' ? route.initialPrompt : initialPrompt
	const routeShareToken = route.kind === 'chat-session' ? route.shareToken : undefined
	const effectiveShareToken = shareToken ?? routeShareToken
	const projectTier = getProjectTier(user, hasActiveSubscription, isTrial)

	// Send shareToken only on the first agentic request so the backend can copy shared messages.
	// Uses a "consumed" flag so we always read the current prop but only forward it once per mount.
	const shareTokenConsumedRef = useRef(false)

	// Adapt the auth helper to the native fetch signature while preserving non-2xx responses for downstream error handling.
	const authorizedFetchCompat = useMemo(() => authorizedFetchAsFetch(authorizedFetch), [authorizedFetch])

	const duelStream = useDuelStream()
	const duelPairId = duelStream.pairId
	const duelMessageIdA = duelStream.a.messageId
	const duelMessageIdB = duelStream.b.messageId
	const startDuel = duelStream.start
	const handleDuelArmEvent = duelStream.handleArmEvent
	const finishDuel = duelStream.finish
	const resetDuel = duelStream.reset
	const markDuelReady = duelStream.markReady

	// Guard authenticated fetches so downstream code never has to handle a null/empty response object.
	const isLlama = !!user?.flags?.is_llama
	const {
		sessions,
		researchUsage,
		factCheckedUsage,
		alertsUsage,
		isLoading: isLoadingSessions,
		error: sessionListError,
		hasNextPage: hasMoreSessions,
		isFetchingNextPage: isFetchingMoreSessions,
		loadMoreSessionsError,
		fetchNextPage: loadMoreSessions,
		moveSessionToTop
	} = useSessionList()
	const {
		createSession,
		createFakeSession,
		restoreSession,
		loadMoreMessages,
		loadNewerMessages,
		switchActiveLeaf,
		deleteSession,
		applyServerSessionTitle,
		bulkDeleteSessions,
		replaceOptimisticSessionId
	} = useSessionMutations()
	const { sidebarVisible, toggleSidebar, hideSidebar, isFullscreen, toggleFullscreen } = useSidebarVisibility()
	const enableSoundNotifications = useLlamaAISetting('enableSoundNotifications')
	const alertsModalStore = Ariakit.useDialogStore()
	const settingsModalStore = Ariakit.useDialogStore()
	const [shouldRenderSubscribeModal, setShouldRenderSubscribeModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({
		open: shouldRenderSubscribeModal,
		setOpen: setShouldRenderSubscribeModal
	})

	const [messages, setMessages] = useState<Array<Message>>([])
	const [activeLeafMessageId, setActiveLeafMessageId] = useState<string | null>(null)
	const [sessionId, setSessionId] = useState<string | null>(null)
	const [sessionTitle, setSessionTitle] = useState<string | null>(null)
	const [currentSessionProjectId, setCurrentSessionProjectId] = useState<string | null>(null)
	const [streamState, dispatchStream] = useReducer(streamReducer, undefined, createInitialStreamState)
	const [promptFailures, dispatchPromptFailure] = useReducer(
		promptFailuresReducer,
		undefined,
		() => new Map<string, PromptFailure>()
	)
	const promptFailuresRef = useRef(promptFailures)
	const [mode, setMode] = useState<AgenticAnswerMode>('quick')
	const [quotedText, setQuotedText] = useState<string | null>(null)
	const [alertPrefillRequest, setAlertPrefillRequest] = useState<{
		key: number
		text: string
		entities?: Array<{ term: string; slug: string; type?: string }>
	} | null>(null)
	const [
		{
			isOpen: dashboardPanelIsOpen,
			mountedConfig: dashboardPanelMountedConfig,
			versions: dashboardVersions,
			versionIndex: dashboardVersionIndex
		},
		dispatchDashboardPanel
	] = useReducer(dashboardPanelReducer, INITIAL_DASHBOARD_PANEL_STATE)
	const citationSheet = useCitationSheetController()
	const [showTokenLimitModal, setShowTokenLimitModal] = useState(false)
	const [showShareModal, setShowShareModal] = useState(false)
	const [shareTargetMessageId, setShareTargetMessageId] = useState<string | null>(null)
	const [initialIntegrationsState, setInitialIntegrationsState] = useState<SettingsInitialState | null>(null)
	const router = useRouter()
	const submitPendingPromptRef = useRef<
		(prompt: string, pageContext?: ChatPageContext, isSuggestedQuestion?: boolean) => void
	>(() => {})
	const deepLinkPrompt = route.kind === 'chat-new' ? route.initialPrompt?.trim() || undefined : undefined
	const deepLinkUtmSource = typeof router.query.utm_source === 'string' ? router.query.utm_source : null
	const deepLinkUtmCampaign = typeof router.query.utm_campaign === 'string' ? router.query.utm_campaign : null
	const {
		confirmationPrompt: deepLinkConfirmationPrompt,
		confirm: handleConfirmDeepLinkPrompt,
		dismiss: handleCloseDeepLinkPrompt
	} = useDeepLinkPrompt({
		isNewChat: route.kind === 'chat-new',
		sharedSession: !!sharedSession,
		deepLinkPrompt,
		utmSource: deepLinkUtmSource,
		utmCampaign: deepLinkUtmCampaign,
		clearDeepLinkFromUrl: () => {
			void navigate.refineCurrent('/ai/chat')
		},
		submitPrompt: (prompt, pageContext, isSuggestedQuestion) =>
			submitPendingPromptRef.current(prompt, pageContext, isSuggestedQuestion)
	})
	const {
		settings,
		actions,
		availableModels,
		availableEfforts,
		telegramStatus,
		queryState: settingsQueryState
	} = useLlamaAISettings()
	const [shouldAnimateSidebar, setShouldAnimateSidebar] = useState(false)
	const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null)
	const [restoreFailure, setRestoreFailure] = useState<{ sessionId: string; message: string } | null>(null)
	const [viewError, setViewError] = useState<string | null>(null)
	const [paginationError, setPaginationError] = useState<string | null>(null)
	const researchModalStore = Ariakit.useDialogStore()
	const isAlertsModalOpen = Ariakit.useStoreState(alertsModalStore, 'open')
	const isResearchModalOpen = Ariakit.useStoreState(researchModalStore, 'open')
	const isSettingsModalOpen = Ariakit.useStoreState(settingsModalStore, 'open')
	const isSubscribeModalOpen = Ariakit.useStoreState(subscribeModalStore, 'open')
	const [limitModalFeature, setLimitModalFeature] = useState<'research' | 'fact_checked'>('research')
	const currentMessageIdRef = useRef<string | null>(null)
	const executionCoordinator = useConstant(() => new ExecutionCoordinator())
	const restoreCoordinator = useConstant(() => new AbortScope())
	const paginationCoordinator = useConstant(() => new AbortScope())
	const branchCoordinator = useConstant(() => new AbortScope())
	const restoredSessionIdRef = useRef<string | null>(null)
	const recoveryIdRef = useRef(0)
	const recoveryControllerRef = useRef<RecoveryController | null>(null)
	const [paginationState, setPaginationState] = useState<{
		hasMore: boolean
		cursor: number | null
		hasNewer?: boolean
		newerCursor?: number | null
	}>({ hasMore: false, cursor: null })
	const [conversationViewResetKey, setConversationViewResetKey] = useState(0)
	const [promptTransitionMode, setPromptTransitionMode] = useState<PromptTransitionMode>('idle')

	const stopSettlementControllerRef = useRef<AbortController | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const scrollContentRef = useRef<HTMLDivElement>(null)
	const { keyboardOpen, viewportHeight } = useVisualViewport()
	const promptInputRef = useRef<HTMLTextAreaElement>(null)
	const promptSubmissionLockRef = useRef<number | null>(null)
	const nextPromptSubmissionIdRef = useRef(0)
	const isFirstMessageRef = useRef(true)
	const promptTransitionTimerRef = useRef<number | null>(null)
	const currentSessionIdRef = useRef(sessionId)
	const routeSessionIdRef = useRef(routeSessionId)
	const currentSessionProjectIdRef = useRef(currentSessionProjectId)
	const {
		phase: streamPhase,
		isStreaming,
		isCompacting,
		text: streamingText,
		charts: streamingCharts,
		csvExports: streamingCsvExports,
		mdExports: streamingMdExports,
		alerts: streamingAlerts,
		dashboards: streamingDashboards,
		citations: streamingCitations,
		legacyUrlCitations: streamingLegacyUrlCitations,
		toolExecutions: streamingToolExecutions,
		generatedImages: streamingGeneratedImages,
		messageId: streamMessageId,
		steps: streamingSteps,
		spawnProgress,
		spawnStartTime,
		spawnIsResearchMode,
		todos: streamingTodos,
		todosStartTime,
		executionStartedAt,
		recovery,
		error,
		rateLimitDetails,
		contextWarning
	} = streamState
	const isStopping = streamPhase.status === 'stopping'
	const queueAdmissionPaused =
		isStopping || (!isStreaming && (!!error || (sessionId ? promptFailures.has(sessionId) : false)))
	const queueController = useChatQueueController({
		sessionId,
		enabled: routeSessionId === null || routeSessionId === sessionId,
		admissionPaused: queueAdmissionPaused,
		authorizedFetch
	})
	const {
		serverQueue: queuedMessages,
		rows: queueRows,
		maxDepth: queueMaxDepth,
		atCapacity: queueAtCap,
		hasLocalRows: queueHasLocalRows,
		paused: queuePaused,
		ownedEditId,
		rowStatus: queueRowStatus,
		queueAction,
		queueActionError,
		applySnapshot: applyQueueSnapshot,
		restoreSnapshot: restoreQueueSnapshot,
		enqueue: enqueuePrompt,
		beginEdit: beginQueueEdit,
		updateEditDraft: updateQueueEditDraft,
		saveEdit: saveQueueEdit,
		cancelEdit: cancelQueueEdit,
		dismiss: dismissQueueItem,
		retry: retryQueueItem,
		continueQueue,
		clearQueue,
		forgetSession: forgetQueueSession,
		adoptSession: adoptQueueSession,
		takeStartedItem,
		getServerQueue,
		abortCommands: abortQueueCommands
	} = queueController

	const queryClient = useQueryClient()
	const wasStreamingRef = useRef(false)
	useEffect(() => {
		if (wasStreamingRef.current && !isStreaming) {
			void queryClient.invalidateQueries({ queryKey: [AI_BALANCE_QUERY_KEY] })
		}
		wasStreamingRef.current = isStreaming
	}, [isStreaming, queryClient])

	const isStreamingRef = useRef(isStreaming)

	// These four carry the latest value into network callbacks that must not be rebuilt on every change.
	// Writing them during render is what costs this component its compiler optimization, and nothing
	// reads them before commit: every reader is an event handler, a stream callback or a later effect.
	// A layout effect keeps them ahead of every passive effect in the tree.
	useLayoutEffect(() => {
		currentSessionIdRef.current = sessionId
		routeSessionIdRef.current = routeSessionId
		currentSessionProjectIdRef.current = currentSessionProjectId
		isStreamingRef.current = isStreaming
	})
	// Network callbacks need the latest failure before React commits the queued reducer action.
	const updatePromptFailures = useCallback((action: PromptFailureAction) => {
		promptFailuresRef.current = promptFailuresReducer(promptFailuresRef.current, action)
		dispatchPromptFailure(action)
	}, [])
	const rememberPromptFailure = useCallback(
		(targetSessionId: string, failure: PromptFailure) =>
			updatePromptFailures({ type: 'remember', sessionId: targetSessionId, failure }),
		[updatePromptFailures]
	)
	const clearPromptFailure = useCallback(
		(targetSessionId: string, clientMutationId?: string) =>
			updatePromptFailures({ type: 'clear', sessionId: targetSessionId, clientMutationId }),
		[updatePromptFailures]
	)
	const movePromptFailure = useCallback(
		(fromSessionId: string, toSessionId: string) => updatePromptFailures({ type: 'move', fromSessionId, toSessionId }),
		[updatePromptFailures]
	)

	const sharedMessages = useMemo(
		() => sharedSession?.messages.map((msg, i) => mapSharedSessionMessage(msg, i)) ?? null,
		[sharedSession]
	)
	const forkedFromShared = sharedSession && sessionId
	const isSharedView = !!sharedSession && !forkedFromShared
	const isRouteSessionPending = !sharedSession && routeSessionId !== null && routeSessionId !== sessionId
	const visibleDashboardVersions = isRouteSessionPending ? [] : dashboardVersions
	const visibleDashboardConfig = isRouteSessionPending ? null : dashboardPanelMountedConfig
	const sessionPromptFailure = !isSharedView && sessionId ? (promptFailures.get(sessionId) ?? null) : null
	const promptFailurePolicy = sessionPromptFailure ? getPromptFailurePolicy(sessionPromptFailure) : null
	const effectiveMessages = useMemo(() => {
		if (isRouteSessionPending) return []
		const baseMessages = (forkedFromShared ? null : sharedMessages) ?? messages
		return projectPromptFailure(baseMessages, sessionPromptFailure)
	}, [forkedFromShared, isRouteSessionPending, messages, sessionPromptFailure, sharedMessages])
	const effectiveSessionId = (forkedFromShared ? sessionId : sharedSession?.session.sessionId) ?? sessionId
	const lookupSessionId = routeSessionId ?? sessionId ?? null
	const sessionListEntry = lookupSessionId ? (sessions.find((s) => s.sessionId === lookupSessionId) ?? null) : null
	// A first submit assigns a local UUID before the server persists the session, so a non-null id is not
	// yet shareable. Only a positively optimistic entry blocks sharing: the list is paginated, so an older
	// session opened by URL may not be loaded at all.
	const isSessionSaved = !!effectiveSessionId && sessionListEntry?.isOptimistic !== true
	const sessionListTitle = sessionListEntry?.title ?? null
	const effectiveSessionTitle =
		sharedSession?.session.title ?? (isRouteSessionPending ? sessionListTitle : (sessionTitle ?? sessionListTitle))
	const effectiveSessionProjectId = isRouteSessionPending
		? (sessionListEntry?.projectId ?? null)
		: (currentSessionProjectId ?? sessionListEntry?.projectId ?? null)
	const projectSessions = useProjectSessions(effectiveSessionProjectId)
	const projectSessionEntry =
		lookupSessionId && projectSessions.data
			? (projectSessions.data.find((session) => session.sessionId === lookupSessionId) ?? null)
			: null
	const visibleIsStreaming = !isRouteSessionPending && isStreaming
	const hasMessages = effectiveMessages.length > 0 || visibleIsStreaming
	const visibleError = isRouteSessionPending
		? restoreFailure?.sessionId === routeSessionId
			? restoreFailure.message
			: null
		: ((!isStreaming ? sessionPromptFailure?.error : null) ?? viewError ?? error)
	const shouldShowLanding = !hasMessages && !visibleError && !restoringSessionId
	const shouldAnimateLandingTransition =
		promptTransitionMode === 'landing' && hasMessages && !visibleError && !restoringSessionId && !readOnly
	const shouldAnimateConversationTransition =
		promptTransitionMode === 'conversation' && hasMessages && !visibleError && !restoringSessionId && !readOnly
	const shouldStartDetachedForAnchor = typeof window !== 'undefined' && window.location.hash.startsWith('#msg-')

	useEffect(() => {
		if (!quotedText || readOnly) return

		const frameId = window.requestAnimationFrame(() => {
			const input = promptInputRef.current
			if (!input) return

			input.focus()
			const cursorPosition = input.value.length
			input.setSelectionRange(cursorPosition, cursorPosition)
		})

		return () => window.cancelAnimationFrame(frameId)
	}, [quotedText, readOnly])

	useEffect(() => {
		return () => {
			stopSettlementControllerRef.current?.abort()
			stopSettlementControllerRef.current = null
		}
		// eslint-disable-next-line react/exhaustive-effect-dependencies -- the session ids are the trigger: abort the settlement controller when the chat changes
	}, [routeSessionId, sessionId])

	// Switching chats should hand the caret back to the composer. Skipped on mobile, where
	// focusing would pop the on-screen keyboard on every navigation.
	const lastFocusedSessionRef = useRef<string | null>(null)
	useEffect(() => {
		const settledSessionId = sessionId ?? 'new'
		if (
			!shouldFocusComposerOnSessionChange({
				readOnly,
				isMobile: isMobileChatView,
				restoringSessionId,
				settledSessionId,
				lastFocusedSessionId: lastFocusedSessionRef.current
			})
		) {
			return
		}

		lastFocusedSessionRef.current = settledSessionId
		const frameId = window.requestAnimationFrame(() => promptInputRef.current?.focus())
		return () => window.cancelAnimationFrame(frameId)
	}, [sessionId, restoringSessionId, readOnly, isMobileChatView])

	const closeCitationSheet = citationSheet.close
	useEffect(() => {
		closeCitationSheet()
		// eslint-disable-next-line react/exhaustive-effect-dependencies -- sessionId is the trigger: close the citation sheet when the chat changes
	}, [sessionId, closeCitationSheet])

	useEffect(() => {
		const timer = setTimeout(() => window.dispatchEvent(new CustomEvent('chartResize')), 250)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react/exhaustive-effect-dependencies -- the panel state is the trigger: charts remeasure after it opens or its config changes
	}, [dashboardPanelIsOpen, dashboardPanelMountedConfig])

	useSettingsRouteIntent({ router, user, settingsModalStore, setInitialIntegrationsState })

	const clearPromptTransitionTimer = useCallback(() => {
		if (promptTransitionTimerRef.current !== null) {
			window.clearTimeout(promptTransitionTimerRef.current)
			promptTransitionTimerRef.current = null
		}
	}, [])

	const resetPromptTransition = useCallback(() => {
		clearPromptTransitionTimer()
		setPromptTransitionMode('idle')
	}, [clearPromptTransitionTimer])

	const openShareModal = useCallback((messageId?: string) => {
		setShareTargetMessageId(messageId ?? null)
		setShowShareModal(true)
	}, [])

	const handleFactCheckedGated = useCallback(() => {
		dispatchStream({
			type: 'SET_RATE_LIMIT_DETAILS',
			value: { period: 'blocked', limit: 0, resetTime: null }
		})
		setLimitModalFeature('fact_checked')
		researchModalStore.show()
	}, [researchModalStore])

	const setShareModalOpen = useCallback((nextOpen: boolean) => {
		setShowShareModal(nextOpen)
		if (!nextOpen) {
			setShareTargetMessageId(null)
		}
	}, [])

	const triggerPromptTransition = useCallback(
		(nextTransitionMode: PromptTransitionMode) => {
			clearPromptTransitionTimer()
			setPromptTransitionMode(nextTransitionMode)
			promptTransitionTimerRef.current = window.setTimeout(() => {
				setPromptTransitionMode('idle')
				promptTransitionTimerRef.current = null
			}, 200)
		},
		[clearPromptTransitionTimer]
	)

	useEffect(() => {
		return () => {
			clearPromptTransitionTimer()
		}
	}, [clearPromptTransitionTimer])

	const streamingDraft = useMemo((): Message | null => {
		if (!visibleIsStreaming) return null
		const hasContent =
			streamingText ||
			streamingCharts.length > 0 ||
			streamingCsvExports.length > 0 ||
			streamingMdExports.length > 0 ||
			streamingAlerts.length > 0 ||
			streamingDashboards.length > 0 ||
			streamingCitations.length > 0 ||
			streamingLegacyUrlCitations.length > 0 ||
			streamingToolExecutions.length > 0 ||
			streamingGeneratedImages.length > 0
		if (!hasContent) return null
		return {
			id: streamMessageId || undefined,
			role: 'assistant',
			content: streamingText || undefined,
			charts: streamingCharts.length > 0 ? streamingCharts : undefined,
			csvExports: streamingCsvExports.length > 0 ? streamingCsvExports : undefined,
			mdExports: streamingMdExports.length > 0 ? streamingMdExports : undefined,
			alerts: streamingAlerts.length > 0 ? streamingAlerts : undefined,
			dashboards: streamingDashboards.length > 0 ? streamingDashboards : undefined,
			citations: streamingCitations.length > 0 ? streamingCitations : undefined,
			legacyUrlCitations: streamingLegacyUrlCitations.length > 0 ? streamingLegacyUrlCitations : undefined,
			toolExecutions: streamingToolExecutions.length > 0 ? streamingToolExecutions : undefined,
			generatedImages: streamingGeneratedImages.length > 0 ? streamingGeneratedImages : undefined
		}
	}, [
		visibleIsStreaming,
		streamMessageId,
		streamingText,
		streamingCharts,
		streamingCsvExports,
		streamingMdExports,
		streamingAlerts,
		streamingDashboards,
		streamingCitations,
		streamingLegacyUrlCitations,
		streamingToolExecutions,
		streamingGeneratedImages
	])

	const loadMoreMessagesMutation = useMutation({
		mutationFn: ({
			targetSessionId,
			cursor,
			signal
		}: {
			targetSessionId: string
			cursor: number
			signal: AbortSignal
		}) => loadMoreMessages(targetSessionId, cursor, signal)
	})
	const loadNewerMessagesMutation = useMutation({
		mutationFn: ({
			targetSessionId,
			cursor,
			signal
		}: {
			targetSessionId: string
			cursor: number
			signal: AbortSignal
		}) => loadNewerMessages(targetSessionId, cursor, signal)
	})
	const isLoadingMoreCurrentSession =
		loadMoreMessagesMutation.isPending && loadMoreMessagesMutation.variables?.targetSessionId === sessionId
	const isLoadingNewerCurrentSession =
		loadNewerMessagesMutation.isPending && loadNewerMessagesMutation.variables?.targetSessionId === sessionId
	const renderedPaginationState = useMemo(
		() => ({
			...paginationState,
			isLoadingMore: isLoadingMoreCurrentSession,
			isLoadingNewer: isLoadingNewerCurrentSession
		}),
		[paginationState, isLoadingMoreCurrentSession, isLoadingNewerCurrentSession]
	)

	// Load older messages when the user reaches the top, while preserving the current viewport position.
	const handleLoadMoreMessages = useCallback(async () => {
		if (!sessionId || !paginationState.hasMore || loadMoreMessagesMutation.isPending || isStreaming) return
		await paginationCoordinator.run(sessionId, async (operation) => {
			setPaginationError(null)
			await waitForNextPaint()
			if (!operation.isCurrent()) return
			const scrollSnapshot = getScrollSnapshot(scrollContainerRef.current)
			const result = await loadMoreMessagesMutation
				.mutateAsync({ targetSessionId: sessionId, cursor: paginationState.cursor!, signal: operation.signal })
				.catch(() => null)
			if (!operation.isCurrent()) return
			if (!result) {
				setPaginationError('Failed to load older messages')
				return
			}
			const older = mapPersistedMessages(result.messages)
			setMessages((prev) => [...older, ...prev])
			requestAnimationFrame(() => restoreScrollPosition(scrollSnapshot))
			setPaginationState(normalizePaginationState(result.pagination))
		})
	}, [sessionId, paginationState, loadMoreMessagesMutation, isStreaming, paginationCoordinator])

	// Load newer messages when the user reaches the bottom of a mid-conversation restore window.
	const handleLoadNewerMessages = useCallback(async () => {
		if (!sessionId || !paginationState.hasNewer || loadNewerMessagesMutation.isPending || isStreaming) return
		await paginationCoordinator.run(sessionId, async (operation) => {
			setPaginationError(null)
			const result = await loadNewerMessagesMutation
				.mutateAsync({ targetSessionId: sessionId, cursor: paginationState.newerCursor!, signal: operation.signal })
				.catch(() => null)
			if (!operation.isCurrent()) return
			if (!result) {
				setPaginationError('Failed to load newer messages')
				return
			}
			const newer = mapPersistedMessages(result.messages)
			setMessages((prev) => [...prev, ...newer])
			setPaginationState((prev) => ({
				...prev,
				hasNewer: result.pagination?.hasNewer ?? false,
				newerCursor: result.pagination?.newerCursor ?? null
			}))
		})
	}, [sessionId, paginationState, loadNewerMessagesMutation, isStreaming, paginationCoordinator])

	// Expose the load-more callback through a stable event wrapper for the scroll listener.
	const handleLoadMoreMessagesEvent = useStableCallback(() => {
		void handleLoadMoreMessages()
	})

	const handleLoadNewerMessagesEvent = useStableCallback(() => {
		void handleLoadNewerMessages()
	})

	const {
		attach,
		attachScrollContainer,
		attachScrollContent,
		scrollToBottom,
		syncAfterLayout: syncScrollAfterLayout,
		isAttached: isScrollAttached,
		showScrollToBottom
	} = useChatScroll({
		scrollContainerRef,
		scrollContentRef,
		isStreaming,
		items: effectiveMessages,
		hasMessages,
		paginationState: renderedPaginationState,
		onLoadMoreMessages: handleLoadMoreMessagesEvent,
		onLoadNewerMessages: handleLoadNewerMessagesEvent,
		keyboardOpen,
		startDetached: shouldStartDetachedForAnchor
	})
	const { preference: webMobilePreference, setEnabled: setWebMobilePushEnabled } = useWebMobilePushPreference()
	// Read through a local: the declared dependency was `streamingDraft?.id` while the compiler infers
	// the whole draft, and a mismatch there costs the component its optimization.
	const streamingDraftId = streamingDraft?.id
	const visibleMessageIds = useMemo(() => {
		const ids = new Set(effectiveMessages.map((message) => message.id).filter((id): id is string => !!id))
		if (streamingDraftId) ids.add(streamingDraftId)
		return ids
	}, [effectiveMessages, streamingDraftId])
	const isChatPresent =
		!readOnly &&
		!(isMobileChatView && (sidebarVisible || citationSheet.isOpen)) &&
		!isAlertsModalOpen &&
		!isResearchModalOpen &&
		!isSettingsModalOpen &&
		!isSubscribeModalOpen &&
		!showTokenLimitModal &&
		!showShareModal &&
		!deepLinkConfirmationPrompt
	const attention = useMemo(
		() => ({
			uncovered: isChatPresent,
			sessionId: readOnly || isRouteSessionPending ? null : sessionId,
			visibleMessageIds
		}),
		[isChatPresent, isRouteSessionPending, readOnly, sessionId, visibleMessageIds]
	)
	const { notify, primeAudio } = useStreamNotification({
		soundEnabled: enableSoundNotifications,
		attention
	})
	const { markCompletionSeen: markWebCompletionSeen } = useWebCompletionSeen({
		attention,
		preference: webMobilePreference
	})
	useClearUnseenCompletion({
		attention,
		projectId: effectiveSessionProjectId,
		hasUnseenCompletion:
			sessionListEntry?.hasUnseenCompletion === true || projectSessionEntry?.hasUnseenCompletion === true
	})

	const openSettings = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: WEB_MOBILE_PUSH_QUERY_KEY })
		settingsModalStore.show()
	}, [queryClient, settingsModalStore])
	const openSettingsAtTab = useCallback(
		(tab: SettingsTabId) => {
			setInitialIntegrationsState({ tab, tgloginToken: null })
			openSettings()
		},
		[openSettings]
	)
	const openSettingsModal = useCallback(
		(tab?: SettingsTabId) => {
			if (tab === undefined) openSettings()
			else openSettingsAtTab(tab)
		},
		[openSettings, openSettingsAtTab]
	)

	// Trigger the sidebar open/close animation before toggling visibility.
	const handleSidebarToggle = useCallback(() => {
		setShouldAnimateSidebar(true)
		toggleSidebar()
	}, [toggleSidebar])

	const toggleDashboardPanel = useCallback(() => {
		dispatchDashboardPanel({ type: 'TOGGLE' })
	}, [])

	const handleDashboardVersionChange = useCallback((index: number) => {
		dispatchDashboardPanel({ type: 'SELECT_VERSION', value: index })
	}, [])

	const handleDashboardClose = useCallback(() => {
		dispatchDashboardPanel({ type: 'CLOSE' })
	}, [])

	const handleDashboardExited = useCallback(() => {
		dispatchDashboardPanel({ type: 'UNMOUNT' })
	}, [])

	const chromeValue = useMemo(
		() => ({
			toggleSidebar: handleSidebarToggle,
			hideSidebar,
			toggleFullscreen,
			isFullscreen,
			sidebarVisible,
			toggleDashboardPanel,
			isDashboardPanelOpen: dashboardPanelIsOpen
		}),
		[
			handleSidebarToggle,
			hideSidebar,
			toggleFullscreen,
			isFullscreen,
			sidebarVisible,
			toggleDashboardPanel,
			dashboardPanelIsOpen
		]
	)

	// Append one message to the live conversation state.
	const appendMessage = useCallback((message: Message) => {
		setMessages((prev) => {
			if (message.id && prev.some((m) => m.id === message.id)) {
				return prev.map((m) => (m.id === message.id ? message : m))
			}
			return [...prev, message]
		})
	}, [])

	const handleQueueUpdated = applyQueueSnapshot

	// When the backend persists a freshly-sent user message, swap the
	// optimistic `local-N` id for the real UUID so edit/branch controls work.
	const replaceLocalUserMessageId = useCallback(
		(realId: string, queueItemId?: string) => {
			const queuedItem = queueItemId ? takeStartedItem(queueItemId) : null
			setMessages((prev) => materializePersistedUserMessage(prev, realId, queueItemId, queuedItem))
		},
		[takeStartedItem]
	)

	// Apply siblingInfo to a specific message by id (avoids a full restore roundtrip after edits).
	const setMessageSiblingInfo = useCallback((messageId: string, siblingInfo: Message['siblingInfo']) => {
		setMessages((prev) => {
			const idx = prev.findIndex((m) => m.id === messageId)
			if (idx < 0) return prev
			const next = prev.slice()
			next[idx] = { ...next[idx], siblingInfo }
			return next
		})
	}, [])

	const createChatStreamCallbacks = useStableCallback(
		({
			buffer,
			isCurrent,
			targetSessionId,
			deferEmptyDone,
			onSessionId,
			onTitle,
			onDuelStart,
			replaceUserMessageId,
			onUserMessageId
		}: {
			buffer: StreamBuffer
			isCurrent: () => boolean
			targetSessionId: string
			deferEmptyDone?: boolean
			onSessionId?: (sessionId: string) => void
			onTitle?: (title: string) => void
			onDuelStart?: (pairId: string) => void
			replaceUserMessageId?: (messageId: string, queueItemId?: string) => void
			onUserMessageId?: (messageId: string) => void
		}) => {
			let completionSessionId = targetSessionId
			return createAgenticCallbacks({
				isCurrent,
				buffer,
				dispatch: dispatchStream,
				currentMessageIdRef,
				appendMessage,
				replaceLocalUserMessageId: replaceUserMessageId ?? replaceLocalUserMessageId,
				setMessageSiblingInfo,
				deferEmptyDone,
				notify,
				onDuelStart: onDuelStart ?? startDuel,
				onArmEvent: handleDuelArmEvent,
				onDuelReady: markDuelReady,
				onDashboardArtifact: (dashboard) => dispatchDashboardPanel({ type: 'APPEND', value: dashboard }),
				onTokenLimit: () => setShowTokenLimitModal(true),
				onQueueUpdated: handleQueueUpdated,
				onUserMessageIdObserved: onUserMessageId,
				onSessionId: (observedSessionId) => {
					completionSessionId = observedSessionId
					onSessionId?.(observedSessionId)
				},
				onCompletion: (messageId) => {
					markWebCompletionSeen(completionSessionId, messageId)
				},
				onTitle:
					onTitle ??
					((title) => {
						if (targetSessionId === currentSessionIdRef.current) setSessionTitle(title)
						applyServerSessionTitle(targetSessionId, title, currentSessionProjectIdRef.current)
						moveSessionToTop(targetSessionId, currentSessionProjectIdRef.current)
					})
			})
		}
	)

	const clearRecoveryController = useCallback((resetState = true) => {
		const controller = recoveryControllerRef.current
		if (controller && controller.timer !== null) window.clearTimeout(controller.timer)
		recoveryControllerRef.current = null
		if (resetState) {
			dispatchStream({ type: 'RESET_RECOVERY' })
		}
	}, [])

	const { ensureQueueAttached, resumeIfRunning, recoverExecution } = useChatExecutionOwner({
		appendMessage,
		authorizedFetch: authorizedFetchCompat,
		clearRecovery: clearRecoveryController,
		createCallbacks: createChatStreamCallbacks,
		currentMessageIdRef,
		dispatch: dispatchStream,
		executionCoordinator,
		getCurrentSessionId: () => currentSessionIdRef.current,
		getServerQueue,
		onSettled: (targetSessionId) => {
			const controller = recoveryControllerRef.current
			if (controller?.sessionId !== targetSessionId) return
			if (controller.failedRequest && controller.buffer.executionId) {
				clearPromptFailure(targetSessionId, controller.failedRequest.mutation.clientMutationId)
			}
			clearRecoveryController()
		},
		replaceUserMessageId: replaceLocalUserMessageId,
		setPaginationError,
		setViewError
	})
	useEffect(() => {
		if (!sessionId || isRouteSessionPending || isStreaming || !hasClaimableQueueWork(queuedMessages)) return
		void ensureQueueAttached(sessionId)
	}, [ensureQueueAttached, isRouteSessionPending, isStreaming, queuedMessages, sessionId])

	const restoreSessionSnapshot = useCallback(
		async (
			targetSessionId: string,
			operation: ExecutionOperation,
			options?: { around?: string }
		): Promise<RestoreSessionSnapshotResult> => {
			// Settled through `then` rather than try/catch: the compiler cannot lower a conditional inside a
			// catch block, and one here costs the whole chat component its optimization.
			const outcome = await restoreSession(targetSessionId, 10, options?.around, operation.signal).then(
				(value) => ({ ok: true as const, value: value as SessionRestoreResult }),
				() => ({ ok: false as const, value: undefined })
			)
			if (!outcome.ok) {
				const aborted = operation.signal.aborted || !operation.isCurrent()
				return { status: aborted ? 'aborted' : 'failed' }
			}
			const result = outcome.value
			if (!operation.isCurrent()) return { status: 'aborted' }

			const restored: Array<Message> = (result.messages || []).map(mapPersistedMessage)
			const projected = options?.around
				? restored
				: projectPromptFailure(restored, promptFailuresRef.current.get(targetSessionId) ?? null)

			if (options?.around) {
				window.location.hash = `msg-${options.around}`
			}

			setMessages(projected)
			dispatchStream({ type: 'SET_TODOS', value: Array.isArray(result.todos) ? result.todos : [] })
			const queueSnapshot = decodeQueueSnapshot({
				sessionId: targetSessionId,
				revision: result.queueRevision,
				queue: result.queuedMessages
			})
			if (queueSnapshot) restoreQueueSnapshot(queueSnapshot)
			setActiveLeafMessageId(
				'activeLeafMessageId' in result
					? (result.activeLeafMessageId ?? restored[restored.length - 1]?.id ?? null)
					: (restored[restored.length - 1]?.id ?? null)
			)
			setConversationViewResetKey((current) => current + 1)
			setSessionId(targetSessionId)
			const match = sessions.find((session) => session.sessionId === targetSessionId)
			setSessionTitle(match?.title || null)
			setCurrentSessionProjectId(result.projectId ?? match?.projectId ?? null)

			const allDashboards = restored.flatMap((m) => m.dashboards || [])
			dispatchDashboardPanel({ type: 'RESTORE', value: allDashboards })
			restoredSessionIdRef.current = targetSessionId
			isFirstMessageRef.current = false
			if (!options?.around) {
				attach()
			}
			setPaginationState({
				hasMore: result.pagination?.hasMore ?? false,
				cursor: result.pagination?.cursor ?? null,
				hasNewer: result.pagination?.hasNewer ?? false,
				newerCursor: result.pagination?.newerCursor ?? null
			})
			setViewError(null)
			setPaginationError(null)
			dispatchStream({ type: 'SET_ERROR', value: null })
			dispatchStream({ type: 'RESET_RECOVERY' })

			return { status: 'restored' }
		},
		[attach, restoreQueueSnapshot, restoreSession, sessions]
	)

	const exhaustRecovery = useCallback(
		(controller: RecoveryController) => {
			if (recoveryControllerRef.current?.id !== controller.id) return
			clearRecoveryController()
			appendBufferedAssistantMessage(controller.buffer, currentMessageIdRef, appendMessage)
			dispatchStream({ type: 'RESET_STREAM' })
			const recoveryErrorMessage =
				'Lost connection and could not reconnect. The response may still finish on the server.'
			if (controller.failedRequest) {
				rememberPromptFailure(controller.sessionId, {
					kind: 'reconnect',
					error: recoveryErrorMessage,
					request: controller.failedRequest
				})
				dispatchStream({ type: 'SET_ERROR', value: null })
			} else {
				dispatchStream({ type: 'SET_ERROR', value: recoveryErrorMessage })
			}
		},
		[appendMessage, clearRecoveryController, rememberPromptFailure]
	)

	// The retry timer must call the latest attempt closure, not the one from the render that scheduled it,
	// so it goes through a ref that the layout effect below points at the stable wrapper.
	const retryRecoveryRef = useRef<(recoveryId: number) => void>(() => {})
	const attemptRecoveryForController = useStableCallback(async (recoveryId: number) => {
		const controller = recoveryControllerRef.current
		if (!controller || controller.id !== recoveryId) return

		controller.attemptCount += 1
		dispatchStream({
			type: 'UPDATE_RECOVERY',
			attemptCount: controller.attemptCount,
			lastErrorMessage: controller.lastErrorMessage
		})

		const resumeOutcome = await recoverExecution({
			targetSessionId: controller.sessionId,
			buffer: controller.buffer,
			resetStream: false,
			onTemporaryDisconnect: (disconnectError, streamBuffer) => {
				const latest = recoveryControllerRef.current
				if (!latest || latest.id !== recoveryId) return
				latest.buffer = streamBuffer
				latest.lastErrorMessage = getErrorMessage(disconnectError)
				dispatchStream({
					type: 'UPDATE_RECOVERY',
					attemptCount: latest.attemptCount,
					lastErrorMessage: latest.lastErrorMessage
				})
			}
		})
		const latest = recoveryControllerRef.current
		if (!latest || latest.id !== recoveryId) return
		if (resumeOutcome === 'aborted') return
		if (resumeOutcome === 'settled') {
			clearRecoveryController()
			return
		}

		const restoreResult = await restoreCoordinator.run(latest.sessionId, (operation) =>
			restoreSessionSnapshot(latest.sessionId, operation)
		)
		if (recoveryControllerRef.current?.id !== recoveryId) return
		if (restoreResult.status === 'restored') {
			dispatchStream({ type: 'RESET_STREAM' })
			clearRecoveryController()
			return
		}
		if (Date.now() - latest.startedAt >= RECOVERY_MAX_MS) {
			exhaustRecovery(latest)
			return
		}
		const backoffMs = Math.min(1000 * 2 ** Math.max(0, latest.attemptCount - 1), 8000)
		scheduleRecoveryAttempt(latest, backoffMs, () => retryRecoveryRef.current(recoveryId))
	})
	useLayoutEffect(() => {
		retryRecoveryRef.current = (recoveryId) => void attemptRecoveryForController(recoveryId)
	}, [attemptRecoveryForController])

	const startRecoveryCycle = useCallback(
		({
			targetSessionId,
			buffer,
			failedRequest,
			error: recoveryError
		}: {
			targetSessionId: string
			buffer: StreamBuffer
			failedRequest: FailedRequest | null
			error: Error
		}) => {
			const existing = recoveryControllerRef.current
			if (existing?.sessionId === targetSessionId) {
				existing.buffer = buffer
				existing.failedRequest = failedRequest
				existing.lastErrorMessage = getErrorMessage(recoveryError)
				dispatchStream({
					type: 'UPDATE_RECOVERY',
					attemptCount: existing.attemptCount,
					lastErrorMessage: existing.lastErrorMessage
				})
				scheduleRecoveryAttempt(existing, 0, () => void attemptRecoveryForController(existing.id))
				return true
			}
			if (failedRequest) {
				rememberPromptFailure(targetSessionId, {
					kind: 'reconnect',
					error: getErrorMessage(recoveryError),
					request: failedRequest
				})
			}

			clearRecoveryController(false)

			const startedAt = Date.now()
			const controller: RecoveryController = {
				id: recoveryIdRef.current + 1,
				sessionId: targetSessionId,
				startedAt,
				buffer,
				failedRequest,
				lastErrorMessage: getErrorMessage(recoveryError),
				attemptCount: 0,
				timer: null
			}
			recoveryIdRef.current = controller.id
			recoveryControllerRef.current = controller
			dispatchStream({
				type: 'START_RECOVERY',
				startedAt,
				lastErrorMessage: controller.lastErrorMessage
			})

			scheduleRecoveryAttempt(controller, 0, () => void attemptRecoveryForController(controller.id))
			return true
		},
		[attemptRecoveryForController, clearRecoveryController, rememberPromptFailure]
	)

	// Invalidate callbacks before waiting for transport cleanup. A slow reader must
	// never delay or remain authoritative during navigation to another session.
	const abortActiveRequest = useCallback(() => {
		executionCoordinator.invalidate()
		promptSubmissionLockRef.current = null
		currentMessageIdRef.current = null
		clearRecoveryController()
	}, [clearRecoveryController, executionCoordinator])

	// Reset transient streaming and error state without touching the actual message history.
	const clearConversationRuntimeState = useCallback(() => {
		clearRecoveryController()
		resetPromptTransition()
		setViewError(null)
		setPaginationError(null)
		dispatchStream({ type: 'RESET_STREAM' })
		dispatchStream({ type: 'SET_ERROR', value: null })
		dispatchStream({ type: 'SET_RATE_LIMIT_DETAILS', value: null })
		dispatchStream({ type: 'SET_CONTEXT_WARNING', value: null })
	}, [clearRecoveryController, resetPromptTransition])

	const clearConversationState = useCallback(() => {
		restoreCoordinator.invalidate()
		paginationCoordinator.invalidate()
		branchCoordinator.invalidate()
		abortActiveRequest()
		abortQueueCommands()
		clearConversationRuntimeState()
		setMessages([])
		setActiveLeafMessageId(null)
		setQuotedText(null)
		resetDuel()
		setConversationViewResetKey((current) => current + 1)
		setSessionId(null)
		setSessionTitle(null)
		setCurrentSessionProjectId(null)
		dispatchDashboardPanel({ type: 'RESET' })
		restoredSessionIdRef.current = null
		isFirstMessageRef.current = true
		attach()
		setPaginationState({ hasMore: false, cursor: null })
	}, [
		abortActiveRequest,
		abortQueueCommands,
		attach,
		branchCoordinator,
		clearConversationRuntimeState,
		paginationCoordinator,
		resetDuel,
		restoreCoordinator
	])

	const handleDeleteSession = useCallback(
		async (targetSessionId: string, projectId?: string | null) => {
			await deleteSession.mutateAsync({ sessionId: targetSessionId, projectId })
			clearPromptFailure(targetSessionId)
			forgetQueueSession(targetSessionId)
			// Check the current view after the request; the reader may have switched chats while it ran.
			if ((routeSessionIdRef.current ?? currentSessionIdRef.current) === targetSessionId) {
				clearConversationState()
				void navigate.toNewChat()
			}
		},
		[clearConversationState, clearPromptFailure, deleteSession, forgetQueueSession, navigate]
	)

	const handleBulkDeleteSessions = useCallback(
		async (sessionIds: Array<string>) => {
			await bulkDeleteSessions.mutateAsync(sessionIds)
			for (const targetSessionId of sessionIds) {
				clearPromptFailure(targetSessionId)
				forgetQueueSession(targetSessionId)
			}
			const viewedSessionId = routeSessionIdRef.current ?? currentSessionIdRef.current
			if (viewedSessionId && sessionIds.includes(viewedSessionId)) {
				clearConversationState()
				void navigate.toNewChat()
			}
		},
		[bulkDeleteSessions, clearConversationState, clearPromptFailure, forgetQueueSession, navigate]
	)

	useLayoutEffect(() => {
		return () => {
			executionCoordinator.invalidate()
			restoreCoordinator.invalidate()
			paginationCoordinator.invalidate()
			branchCoordinator.invalidate()
			abortQueueCommands()
		}
	}, [abortQueueCommands, branchCoordinator, executionCoordinator, paginationCoordinator, restoreCoordinator])

	// Start a brand-new chat, keeping project-owned sessions inside their project.
	const handleNewChat = useCallback(async () => {
		const projectIdForNewChat = route.kind === 'project' ? route.projectId : currentSessionProjectId
		if (projectIdForNewChat && !sharedSession) {
			clearConversationState()
			const nextSessionId = createFakeSession(projectIdForNewChat)
			setSessionId(nextSessionId)
			setSessionTitle(null)
			setCurrentSessionProjectId(projectIdForNewChat)
			restoredSessionIdRef.current = nextSessionId
			isFirstMessageRef.current = false
			const persistSession = createSession.mutateAsync({
				sessionId: nextSessionId,
				projectId: projectIdForNewChat
			})
			try {
				await persistSession
				if (currentSessionIdRef.current !== nextSessionId) return
				void navigate.toSession(nextSessionId)
			} catch (createSessionError) {
				console.error('[llama-ai] [createSession] failed:', getErrorMessage(createSessionError))
			}
			promptInputRef.current?.focus()
			return
		}

		if (route.kind !== 'chat-new' || sharedSession) {
			void navigate.toNewChat()
			return
		}
		clearConversationState()
		promptInputRef.current?.focus()
	}, [
		clearConversationState,
		createFakeSession,
		createSession,
		currentSessionProjectId,
		navigate,
		route,
		sharedSession
	])

	// Restore a saved session, and resume any still-active server execution attached to it.
	const handleSessionSelect = useCallback(
		async (selectedSessionId: string, options?: { around?: string }) => {
			if (
				selectedSessionId === restoredSessionIdRef.current &&
				selectedSessionId === currentSessionIdRef.current &&
				!options?.around
			)
				return
			setRestoreFailure(null)
			setRestoringSessionId(selectedSessionId)
			abortActiveRequest()
			abortQueueCommands()
			paginationCoordinator.invalidate()
			branchCoordinator.invalidate()
			clearConversationRuntimeState()

			const restoreResult = await restoreCoordinator.run(selectedSessionId, (operation) =>
				restoreSessionSnapshot(selectedSessionId, operation, options)
			)

			if (routeSessionIdRef.current !== selectedSessionId) return
			if (restoreResult.status === 'aborted') return
			if (restoreResult.status === 'failed') {
				setRestoreFailure({ sessionId: selectedSessionId, message: 'Failed to restore session' })
				setRestoringSessionId(null)
				return
			}

			setRestoreFailure(null)
			setRestoringSessionId(null)

			await resumeIfRunning({
				targetSessionId: selectedSessionId,
				onTemporaryDisconnect: (disconnectError, buffer) => {
					startRecoveryCycle({
						targetSessionId: selectedSessionId,
						buffer,
						failedRequest: null,
						error: disconnectError
					})
				}
			})
		},
		[
			abortActiveRequest,
			abortQueueCommands,
			branchCoordinator,
			clearConversationRuntimeState,
			paginationCoordinator,
			restoreCoordinator,
			restoreSessionSnapshot,
			resumeIfRunning,
			startRecoveryCycle
		]
	)

	const handleSearchMatchClick = useCallback(
		(targetSessionId: string, messageId: string) => {
			void navigate.toSession(targetSessionId, { around: messageId })
		},
		[navigate]
	)

	useAgenticRouteTransition({
		route,
		readOnly,
		sharedSession: !!sharedSession,
		resolveSessionAlias,
		projectHomeSignal,
		getCurrentSessionId: () => currentSessionIdRef.current,
		onNewChat: () => {
			clearConversationState()
			promptInputRef.current?.focus()
		},
		onOpenSession: (nextSessionId, aroundMessageId) => {
			setQuotedText(null)
			setMessages([])
			setActiveLeafMessageId(null)
			setSessionTitle(null)
			resetDuel()
			dispatchDashboardPanel({ type: 'RESET' })
			setPaginationState({ hasMore: false, cursor: null })
			restoredSessionIdRef.current = null
			return handleSessionSelect(nextSessionId, aroundMessageId ? { around: aroundMessageId } : undefined)
		},
		onClearChat: () => {
			void clearConversationState()
		}
	})

	const startPromptSubmission = useCallback(
		(effectiveMode: AgenticAnswerMode, prepare: () => PreparedPromptSubmission): boolean => {
			if (isStreamingRef.current || promptSubmissionLockRef.current !== null) return false
			abortActiveRequest()
			triggerPromptTransition(shouldShowLanding ? 'landing' : 'conversation')
			const submissionId = ++nextPromptSubmissionIdRef.current
			promptSubmissionLockRef.current = submissionId
			if (effectiveMode === 'research') {
				try {
					if (!localStorage.getItem('llamaai-research-duration-toast')) {
						localStorage.setItem('llamaai-research-duration-toast', '1')
						toast(
							'Research reports usually take 10–20 minutes. You can leave this page — the run continues and will be here when you come back.',
							{ icon: '🔍', duration: 8000 }
						)
					}
				} catch {
					// Storage can be unavailable; the one-time hint is skipped.
				}
			}

			const abandonedDuelSessionId = duelPairId ? sessionId : null

			const execute = async () => {
				setViewError(null)
				setPaginationError(null)
				primeAudio()
				resetDuel()
				// Both duel answers only ever lived in the duel panel, never in the message list,
				// so moving on without choosing would erase that turn from the thread. Reload the
				// persisted branch instead: the server has already resolved it to the default
				// answer, and asking for it keeps the client blind to which arm that was.
				if (abandonedDuelSessionId) {
					await restoreCoordinator.run(abandonedDuelSessionId, (operation) =>
						restoreSessionSnapshot(abandonedDuelSessionId, operation)
					)
					if (promptSubmissionLockRef.current !== submissionId) return
				}
				dispatchStream({ type: 'START_STREAM' })
				currentMessageIdRef.current = null

				const prepared = prepare()
				let { currentSessionId } = prepared
				let { failedRequest } = prepared
				const { submitProjectId } = prepared
				const { mutation } = failedRequest
				const isPromptFailureReplay =
					promptFailuresRef.current.get(currentSessionId)?.request.mutation.clientMutationId ===
					mutation.clientMutationId
				setMessages((prev) =>
					prev.some((message) => message.id === failedRequest.optimisticMessageId)
						? prev
						: [...prev, materializeFailedPrompt(failedRequest)]
				)
				attach()
				moveSessionToTop(currentSessionId, submitProjectId)

				const buffer = createStreamBuffer()
				let mutationAccepted = false
				const adoptResponseSession = (id: string) => {
					const previousSessionId = currentSessionId
					movePromptDraft(getPromptDraftScope(previousSessionId, submitProjectId), `session:${id}`)
					setSessionId(id)
					currentSessionId = id
					if (previousSessionId && previousSessionId !== id) {
						executionCoordinator.adoptSession(previousSessionId, id)
						adoptQueueSession(previousSessionId, id)
						movePromptFailure(previousSessionId, id)
						registerSessionAlias(previousSessionId, id)
					}
					// The server can persist the client UUID without assigning a different ID.
					replaceOptimisticSessionId(previousSessionId, id, submitProjectId)
					if (sharedSession) onSharedSessionFork?.(id)
					if (previousSessionId !== id && !sessions.some((session) => session.sessionId === id)) {
						void createSession
							.mutateAsync({
								sessionId: id,
								title: sessionTitle ?? undefined,
								projectId: submitProjectId
							})
							.catch((createSessionError) => {
								console.error('[llama-ai] [createSession] failed:', getErrorMessage(createSessionError))
							})
					}
				}

				await executionCoordinator.run(currentSessionId, 'prompt', async (operation) => {
					await runAgenticRequest({
						mode: 'prompt',
						operation,
						createCallbacks: ({ isCurrent }) =>
							createChatStreamCallbacks({
								buffer,
								isCurrent,
								targetSessionId: currentSessionId!,
								deferEmptyDone: true,
								onDuelStart: (pairId) => {
									startDuel(pairId)
									trackUmamiEvent('llamaai-duel-shown')
								},
								onSessionId: (id) => {
									if (!isCurrent()) return
									adoptResponseSession(id)
								},
								onUserMessageId: (messageId) => {
									mutationAccepted = true
									failedRequest = { ...failedRequest, optimisticMessageId: messageId }
									clearPromptFailure(currentSessionId, mutation.clientMutationId)
								},
								onTitle: (title) => {
									if (!isCurrent()) return
									setSessionTitle(title)
									if (currentSessionId) {
										applyServerSessionTitle(currentSessionId, title, submitProjectId)
										moveSessionToTop(currentSessionId, submitProjectId)
									}
								}
							}),
						execute: ({ callbacks, signal, eventCounter }) =>
							fetchAgenticResponse({
								mutation,
								abortSignal: signal,
								fetchFn: authorizedFetchCompat,
								eventCounter,
								callbacks
							}),
						onError: async ({ kind, error: err }, { isCurrent, eventCounter }) => {
							if (!isCurrent()) return
							if (err instanceof AgenticMutationReconcileError) {
								adoptResponseSession(err.sessionId)
								if (err.messageId) {
									replaceLocalUserMessageId(err.messageId)
									failedRequest = { ...failedRequest, optimisticMessageId: err.messageId }
								}
								if (err.status === 'pending') {
									rememberPromptFailure(err.sessionId, {
										kind: 'reconnect',
										error: 'The prompt request is still being processed. Reconnect to check again.',
										request: failedRequest
									})
									dispatchStream({ type: 'SET_ERROR', value: null })
									dispatchStream({ type: 'RESET_STREAM' })
									return
								}
								clearPromptFailure(err.sessionId, mutation.clientMutationId)
								mutationAccepted = true
								startRecoveryCycle({
									targetSessionId: err.sessionId,
									buffer,
									failedRequest: null,
									error: err
								})
								return
							}
							if (kind === 'abort') {
								appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
								dispatchStream({ type: 'RESET_STREAM' })
								return
							}
							if (kind === 'free-limit' && isFreeLimitError(err)) {
								appendMessage(buildFreeLimitMessage(err))
								dispatchStream({ type: 'RESET_STREAM' })
								return
							}
							if (err.code === 'FACT_CHECKED_REQUIRES_SUBSCRIPTION') {
								dispatchStream({
									type: 'SET_RATE_LIMIT_DETAILS',
									value: {
										period: 'blocked',
										limit: 0,
										resetTime: null
									}
								})
								dispatchStream({ type: 'RESET_STREAM' })
								setLimitModalFeature('fact_checked')
								researchModalStore.show()
								return
							}
							if (kind === 'usage-limit') {
								dispatchStream({
									type: 'SET_RATE_LIMIT_DETAILS',
									value: {
										period: err.details?.period || 'lifetime',
										limit: err.details?.limit || 0,
										resetTime: err.details?.resetTime || null
									}
								})
								dispatchStream({ type: 'RESET_STREAM' })
								setLimitModalFeature(err.details?.feature === 'fact_checked' ? 'fact_checked' : 'research')
								researchModalStore.show()
								return
							}
							if (kind === 'temporary-connectivity' && currentSessionId && buffer.executionId) {
								buffer.receivedEventCount = eventCounter.count
								if (
									startRecoveryCycle({
										targetSessionId: currentSessionId,
										buffer,
										failedRequest,
										error: err
									})
								) {
									return
								}
							}
							rememberPromptFailure(currentSessionId, {
								kind: kind === 'temporary-connectivity' ? 'reconnect' : 'retry',
								error: err.message || 'Failed to get response',
								request: failedRequest
							})
							dispatchStream({ type: 'SET_ERROR', value: null })
							appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
							dispatchStream({ type: 'RESET_STREAM' })
						},
						onSuccess: async ({ isCurrent, eventCounter }) => {
							let handedOffToResume = false
							let recoveryStarted = false
							if (
								isCurrent() &&
								currentSessionId &&
								!buffer.error &&
								!hasStreamBufferContent(buffer) &&
								canProbeSessionAfterEmptyResponse(isPromptFailureReplay, mutationAccepted)
							) {
								// The HTTP stream can finish without local content if the result was
								// persisted server-side first; attach to that execution before clearing UI.
								buffer.receivedEventCount = eventCounter.count
								const resumeSessionId = currentSessionId
								const resumeOutcome = await recoverExecution({
									targetSessionId: resumeSessionId,
									buffer,
									resetStream: false,
									operation,
									onTemporaryDisconnect: (disconnectError, streamBuffer) => {
										recoveryStarted = startRecoveryCycle({
											targetSessionId: resumeSessionId,
											buffer: streamBuffer,
											failedRequest,
											error: disconnectError
										})
									}
								})
								handedOffToResume = resumeOutcome === 'settled'
								if (!handedOffToResume && !recoveryStarted && isCurrent()) {
									dispatchStream({ type: 'RESET_STREAM' })
								}
							} else if (isCurrent() && isPromptFailureReplay && !mutationAccepted) {
								dispatchStream({ type: 'RESET_STREAM' })
							}

							if (!handedOffToResume && isCurrent()) {
								setActiveLeafMessageId(currentMessageIdRef.current)
							}
							if (
								isCurrent() &&
								currentSessionId &&
								!buffer.error &&
								!recoveryStarted &&
								isPromptMutationConfirmed(mutationAccepted, hasStreamBufferContent(buffer))
							) {
								clearPromptFailure(currentSessionId, mutation.clientMutationId)
							}
						},
						onFinally: ({ isCurrent }) => {
							if (isCurrent()) finishDuel()
						}
					})
				})
			}
			void runPromptSubmission({
				submissionId,
				submissionLockRef: promptSubmissionLockRef,
				execute,
				onFailure: (submissionError) => {
					dispatchStream({ type: 'RESET_STREAM' })
					setViewError('The request was interrupted. Reload this conversation before trying again.')
					reportChatError(submissionError, 'submission', '')
				}
			})

			return true
		},
		[
			startDuel,
			finishDuel,
			resetDuel,
			duelPairId,
			restoreSessionSnapshot,
			sessionId,
			authorizedFetchCompat,
			createSession,
			applyServerSessionTitle,
			moveSessionToTop,
			researchModalStore,
			primeAudio,
			appendMessage,
			abortActiveRequest,
			createChatStreamCallbacks,
			executionCoordinator,
			adoptQueueSession,
			restoreCoordinator,
			recoverExecution,
			startRecoveryCycle,
			sessionTitle,
			sessions,
			attach,
			shouldShowLanding,
			triggerPromptTransition,
			sharedSession,
			registerSessionAlias,
			replaceOptimisticSessionId,
			replaceLocalUserMessageId,
			rememberPromptFailure,
			clearPromptFailure,
			movePromptFailure,
			onSharedSessionFork
		]
	)

	// Composer state is captured once here. Retries bypass this path and reuse
	// the immutable request that this submission creates.
	const handleSubmit = useCallback(
		(
			prompt: string,
			entities?: Array<{ term: string; slug: string; type?: string }>,
			images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>,
			pageContext?: ChatPageContext,
			options?: {
				isSuggestedQuestion?: boolean
				modeOverride?: AgenticAnswerMode
				quotedTextOverride?: string | null
			}
		): boolean => {
			const trimmed = prompt.trim()
			const hasImages = !!images?.length
			if ((!trimmed && !hasImages) || isStreamingRef.current || promptSubmissionLockRef.current !== null) return false
			if (sessionId && promptFailuresRef.current.has(sessionId)) return false

			if (sharedSession && !sessionId && !hasUser) {
				onForkSubmit?.(trimmed)
				return true
			}

			const effectiveMode = options?.modeOverride ?? mode
			return startPromptSubmission(effectiveMode, () => {
				const submitProjectId = routeProjectId ?? currentSessionProjectId
				let currentSessionId = sessionId

				if (sharedSession && !currentSessionId) {
					currentSessionId = createFakeSession(submitProjectId)
					setSessionId(currentSessionId)
					setCurrentSessionProjectId(submitProjectId)
					setSessionTitle(sharedSession.session.title)
					setMessages(sharedSession.messages.map((message, index) => mapSharedSessionMessage(message, index)))
					isFirstMessageRef.current = false
				} else if (isFirstMessageRef.current && !currentSessionId) {
					currentSessionId = createFakeSession(submitProjectId, trimmed)
					setSessionId(currentSessionId)
					setCurrentSessionProjectId(submitProjectId)
					isFirstMessageRef.current = false
				}

				const currentQuotedText =
					options?.quotedTextOverride === undefined
						? quotedText || undefined
						: (options.quotedTextOverride ?? undefined)
				if (options?.quotedTextOverride === undefined && currentQuotedText) setQuotedText(null)

				// A share token forks a public snapshot exactly once. The immutable
				// request retains it if the network later needs an exact replay.
				const currentShareToken = !shareTokenConsumedRef.current ? effectiveShareToken : undefined
				if (currentShareToken) shareTokenConsumedRef.current = true

				const failedRequest: FailedRequest = {
					mutation: createAgenticMutationEnvelope({
						clientMutationId: crypto.randomUUID(),
						message: trimmed,
						sessionId: currentSessionId!,
						mode: effectiveMode,
						entities: entities?.length ? entities : undefined,
						images: images?.length ? images : undefined,
						pageContext,
						quotedText: currentQuotedText,
						customInstructions: settings.customInstructions || undefined,
						enablePremiumTools: settings.enablePremiumTools,
						model: settings.model || undefined,
						effort: settings.effort || undefined,
						isSuggestedQuestion: options?.isSuggestedQuestion,
						blockedSkills: isMobileChatView ? ['dashboard'] : undefined,
						shareToken: currentShareToken,
						projectId: submitProjectId
					}),
					optimisticMessageId: `local-${crypto.randomUUID()}`
				}
				return { currentSessionId: currentSessionId!, failedRequest, submitProjectId }
			})
		},
		[
			sharedSession,
			sessionId,
			hasUser,
			onForkSubmit,
			mode,
			startPromptSubmission,
			routeProjectId,
			currentSessionProjectId,
			createFakeSession,
			quotedText,
			effectiveShareToken,
			settings.customInstructions,
			settings.enablePremiumTools,
			settings.model,
			settings.effort,
			isMobileChatView
		]
	)

	const handleQueue = useCallback(
		async (
			prompt: string,
			entities?: Array<{ term: string; slug: string; type?: string }>,
			images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>,
			modeOverride?: AgenticAnswerMode,
			quotedTextOverride?: string | null
		) => {
			const trimmed = prompt.trim()
			const hasImages = !!images && images.length > 0
			if ((!trimmed && !hasImages) || !sessionId) return { status: 'cancelled' as const }

			const effectiveMode = modeOverride ?? mode
			const effectiveQuotedText =
				quotedTextOverride === undefined ? quotedText || undefined : (quotedTextOverride ?? undefined)
			// The payload is built out here on purpose: every `??`, `?.` and ternary below is a value block,
			// and the compiler cannot lower one inside a try or catch.
			const payload = {
				message: trimmed,
				entities: entities?.length ? entities : undefined,
				images: images?.length ? images : undefined,
				researchMode: effectiveMode === 'research',
				factCheckMode: effectiveMode === 'fact_checked',
				quotedText: effectiveQuotedText,
				timezone: resolveTimezone(),
				client: 'web' as const,
				projectId: currentSessionProjectId ?? undefined,
				customInstructions: settings.customInstructions || undefined,
				blockedSkills: isMobileChatView ? (['dashboard'] as Array<string>) : undefined
			}
			const outcome = await runEnqueue(() => enqueuePrompt(payload))
			if (outcome.kind === 'queue-full') {
				return {
					status: 'rejected' as const,
					message: outcome.maxDepth
						? `Queue is full (max ${outcome.maxDepth}). Wait for a message to send first.`
						: 'Queue is full. Wait for a message to send first.'
				}
			}
			if (outcome.kind === 'error') {
				return { status: 'rejected' as const, message: 'Failed to queue your prompt. Please try again.' }
			}

			const result = outcome.value
			if (result === 'aborted') return { status: 'cancelled' as const }
			if (result === 'session_idle') {
				return handleSubmit(trimmed, entities, images, undefined, { modeOverride, quotedTextOverride })
					? ({ status: 'accepted' } as const)
					: ({ status: 'rejected', message: 'Failed to submit your prompt. Please try again.' } as const)
			}

			if (quotedTextOverride === undefined && effectiveQuotedText !== undefined && quotedText === effectiveQuotedText) {
				setQuotedText(null)
			}
			return { status: 'accepted' as const }
		},
		[
			sessionId,
			mode,
			quotedText,
			currentSessionProjectId,
			settings.customInstructions,
			isMobileChatView,
			handleSubmit,
			enqueuePrompt
		]
	)

	const queueOwnsComposer =
		!queueAdmissionPaused && !queuePaused && (queueHasLocalRows || shouldQueuePrompt(isStreaming, queuedMessages))
	const handleComposerSubmit = useCallback(
		(
			prompt: string,
			entities?: Array<{ term: string; slug: string; type?: string }>,
			images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>
		) => {
			const queueIsActive =
				!queueAdmissionPaused &&
				!queuePaused &&
				(queueHasLocalRows || shouldQueuePrompt(isStreamingRef.current, getServerQueue()))
			if (queueIsActive) return handleQueue(prompt, entities, images)
			return handleSubmit(prompt, entities, images)
		},
		[getServerQueue, handleQueue, handleSubmit, queueAdmissionPaused, queueHasLocalRows, queuePaused]
	)

	const handleEditMessage = useCallback(
		async (messageId: string, newText: string, original: Message): Promise<void> => {
			const trimmed = newText.trim()
			if (!sessionId || !trimmed || promptFailuresRef.current.has(sessionId)) return
			const idx = messages.findIndex((message) => message.id === messageId && message.role === 'user')
			if (idx < 0) return

			const messagesSnapshot = messages
			const activeLeafSnapshot = activeLeafMessageId
			const truncated = messages.slice(0, idx)
			// Backend message ids create a branch; synthetic local/persisted/shared ids
			// can only replay from the truncated local history.
			const isBranchingEdit = !/^(local|persisted|shared)-/.test(messageId)

			abortActiveRequest()

			const submissionId = ++nextPromptSubmissionIdRef.current
			promptSubmissionLockRef.current = submissionId
			triggerPromptTransition('conversation')

			setViewError(null)
			setPaginationError(null)
			dispatchStream({ type: 'START_STREAM' })
			currentMessageIdRef.current = null
			setMessages([
				...truncated,
				{
					role: 'user',
					content: trimmed,
					images: original.images,
					quotedText: original.quotedText,
					id: `local-edit-${Date.now()}`
				}
			])
			attach()

			const buffer = createStreamBuffer()
			const mutation = createAgenticMutationEnvelope({
				clientMutationId: crypto.randomUUID(),
				message: trimmed,
				sessionId,
				editMessageId: isBranchingEdit ? messageId : undefined,
				mode,
				quotedText: original.quotedText || undefined,
				customInstructions: settings.customInstructions || undefined,
				enablePremiumTools: settings.enablePremiumTools,
				model: settings.model || undefined,
				effort: settings.effort || undefined,
				blockedSkills: isMobileChatView ? ['dashboard'] : undefined,
				projectId: currentSessionProjectId
			})
			let shouldThrowEditError: UsageLimitError | null = null
			let handedOffToResume = false

			await executionCoordinator.run(sessionId, 'edit', async (operation) => {
				await runAgenticRequest({
					mode: 'edit',
					operation,
					createCallbacks: ({ isCurrent }) =>
						createChatStreamCallbacks({
							buffer,
							isCurrent,
							targetSessionId: sessionId,
							deferEmptyDone: true,
							onTitle: (title) => {
								setSessionTitle(title)
								applyServerSessionTitle(sessionId, title, currentSessionProjectId)
							}
						}),
					execute: ({ callbacks, signal, eventCounter }) =>
						fetchAgenticResponse({
							mutation,
							abortSignal: signal,
							fetchFn: authorizedFetchCompat,
							eventCounter,
							callbacks
						}),
					onSuccess: async ({ isCurrent, eventCounter }) => {
						if (isCurrent() && !buffer.error && !hasStreamBufferContent(buffer)) {
							buffer.receivedEventCount = eventCounter.count
							let recoveryStarted = false
							const resumeOutcome = await recoverExecution({
								targetSessionId: sessionId,
								buffer,
								resetStream: false,
								operation,
								onTemporaryDisconnect: (disconnectError, streamBuffer) => {
									recoveryStarted = startRecoveryCycle({
										targetSessionId: sessionId,
										buffer: streamBuffer,
										failedRequest: null,
										error: disconnectError
									})
								}
							})
							handedOffToResume = resumeOutcome === 'settled'
							if (handedOffToResume || recoveryStarted) return
							if (isCurrent()) {
								dispatchStream({ type: 'RESET_STREAM' })
							}
						}
						if (isCurrent()) {
							setActiveLeafMessageId(currentMessageIdRef.current)
						}
						// siblingInfo arrives via SSE `sibling_info` mid-stream — no extra restore call needed
					},
					onError: ({ kind, error: editError }, { isCurrent, eventCounter }) => {
						if (!isCurrent()) return
						if (kind === 'abort') {
							appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
							dispatchStream({ type: 'RESET_STREAM' })
							return
						}
						if (kind === 'temporary-connectivity') {
							buffer.receivedEventCount = eventCounter.count
							if (
								startRecoveryCycle({
									targetSessionId: sessionId,
									buffer,
									failedRequest: null,
									error: editError
								})
							) {
								return
							}
						}
						if (kind === 'free-limit' && isFreeLimitError(editError)) {
							setMessages(messagesSnapshot)
							setActiveLeafMessageId(activeLeafSnapshot)
							appendMessage(buildFreeLimitMessage(editError))
							dispatchStream({ type: 'RESET_STREAM' })
							return
						}
						if (editError.code === 'FACT_CHECKED_REQUIRES_SUBSCRIPTION') {
							setMessages(messagesSnapshot)
							setActiveLeafMessageId(activeLeafSnapshot)
							dispatchStream({
								type: 'SET_RATE_LIMIT_DETAILS',
								value: {
									period: 'blocked',
									limit: 0,
									resetTime: null
								}
							})
							dispatchStream({ type: 'RESET_STREAM' })
							setLimitModalFeature('fact_checked')
							researchModalStore.show()
							return
						}
						if (kind === 'usage-limit') {
							setMessages(messagesSnapshot)
							setActiveLeafMessageId(activeLeafSnapshot)
							dispatchStream({
								type: 'SET_RATE_LIMIT_DETAILS',
								value: {
									period: editError.details?.period || 'lifetime',
									limit: editError.details?.limit || 0,
									resetTime: editError.details?.resetTime || null
								}
							})
							dispatchStream({ type: 'RESET_STREAM' })
							setLimitModalFeature(editError.details?.feature === 'fact_checked' ? 'fact_checked' : 'research')
							researchModalStore.show()
							return
						}
						setMessages(messagesSnapshot)
						setActiveLeafMessageId(activeLeafSnapshot)
						setViewError(getErrorMessage(editError))
						dispatchStream({ type: 'RESET_STREAM' })
						shouldThrowEditError = editError
					},
					onFinally: ({ isCurrent }) => {
						if (promptSubmissionLockRef.current === submissionId) promptSubmissionLockRef.current = null
						if (isCurrent()) finishDuel()
					}
				})
			})
			if (!handedOffToResume && shouldThrowEditError) {
				const editError = new Error(shouldThrowEditError.message)
				editError.name = shouldThrowEditError.name
				Object.assign(editError, {
					code: shouldThrowEditError.code,
					details: shouldThrowEditError.details,
					upgradeUrl: shouldThrowEditError.upgradeUrl,
					cause: shouldThrowEditError
				})
				throw editError
			}
		},
		[
			activeLeafMessageId,
			appendMessage,
			attach,
			authorizedFetchCompat,
			abortActiveRequest,
			createChatStreamCallbacks,
			executionCoordinator,
			finishDuel,
			isMobileChatView,
			mode,
			messages,
			researchModalStore,
			recoverExecution,
			sessionId,
			currentSessionProjectId,
			settings.customInstructions,
			settings.enablePremiumTools,
			settings.effort,
			settings.model,
			startRecoveryCycle,
			triggerPromptTransition,
			applyServerSessionTitle
		]
	)

	const handleBranchSwitch = useCallback(
		async (leafMessageId: string) => {
			if (!sessionId || isStreaming) return
			abortActiveRequest()
			await branchCoordinator.run(sessionId, async (operation) => {
				setViewError(null)
				setPaginationError(null)
				// Both halves live outside the try on purpose: they are full of optional chains and logical
				// operators, and the compiler cannot lower one inside a try or catch. Calling out to them
				// keeps the error handling identical while leaving the try itself trivial.
				const applySwitchedLeaf = async (result: Awaited<ReturnType<typeof switchActiveLeaf.mutateAsync>>) => {
					if (!operation.isCurrent() || currentSessionIdRef.current !== sessionId) return
					setActiveLeafMessageId(result.activeLeafMessageId)
					if (Array.isArray(result.messages)) {
						const restored = mapPersistedMessages(result.messages as Array<PersistedMessage>)
						setMessages(projectPromptFailure(restored, promptFailuresRef.current.get(sessionId) ?? null))
						setConversationViewResetKey((current) => current + 1)
						dispatchDashboardPanel({ type: 'RESTORE', value: restored.flatMap((message) => message.dashboards || []) })
						setPaginationState(normalizePaginationState(result.pagination))
						dispatchStream({ type: 'SET_ERROR', value: null })
						dispatchStream({ type: 'RESET_RECOVERY' })
					} else {
						await restoreSessionSnapshot(sessionId, operation)
					}
				}
				const reportSwitchFailure = (switchError: unknown) => {
					if (operation.isCurrent() && currentSessionIdRef.current === sessionId) {
						setViewError(getErrorMessage(switchError))
					}
				}
				try {
					await applySwitchedLeaf(
						await switchActiveLeaf.mutateAsync({ sessionId, leafMessageId, signal: operation.signal })
					)
				} catch (switchError) {
					reportSwitchFailure(switchError)
				}
			})
		},
		[abortActiveRequest, branchCoordinator, isStreaming, restoreSessionSnapshot, sessionId, switchActiveLeaf]
	)

	const submitDuelVote = useCallback(
		(choice: DuelChoice) => {
			if (!duelPairId) return
			// Ties and "neither is good" still have to leave the thread on one answer; arm A is
			// the run whose messages were appended to the live conversation history.
			const winnerMessageId = choice === 'b' ? duelMessageIdB : duelMessageIdA
			trackUmamiEvent('llamaai-duel-vote', { choice })
			// Not awaited: the branch switch aborts the active request, so letting the vote
			// round-trip first lets it land on a prompt the user submitted in the meantime.
			void authorizedFetchCompat(`${AI_SERVER}/agentic/ab-vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pairId: duelPairId, choice, winnerMessageId, sessionId })
			}).catch((voteError) => {
				console.error('[llama-ai] [ab-vote] failed:', getErrorMessage(voteError))
			})
			void (async () => {
				// Both answers are persisted as siblings, so the chosen one renders through
				// the normal branch loader with sibling navigation to the other answer.
				if (winnerMessageId) await handleBranchSwitch(winnerMessageId)
				resetDuel()
			})()
		},
		[authorizedFetchCompat, duelMessageIdA, duelMessageIdB, duelPairId, handleBranchSwitch, resetDuel, sessionId]
	)

	// Keep the stream attached until the server confirms that the execution stopped.
	const handleStopRequest = useCallback(() => {
		if (!sessionId || streamPhase.status === 'stopping') return

		const targetSessionId = sessionId
		const stopController = new AbortController()
		stopSettlementControllerRef.current?.abort()
		stopSettlementControllerRef.current = stopController
		dispatchStream({ type: 'STOP_REQUESTED' })
		const isCurrentSession = () => (routeSessionIdRef.current ?? currentSessionIdRef.current) === targetSessionId
		void (async () => {
			const settlement = await settleStopRequest({
				sessionId: targetSessionId,
				signal: stopController.signal,
				authorizedFetch: authorizedFetchCompat,
				isCurrentSession,
				applyQueueSnapshot,
				release: () => {
					if (stopSettlementControllerRef.current === stopController) stopSettlementControllerRef.current = null
				}
			})
			if (settlement === 'failed') {
				dispatchStream({ type: 'STOP_FAILED', error: 'Could not stop the response. Try again.' })
				return
			}
			if (settlement !== 'stopped' || !isCurrentSession()) return
			await abortActiveRequest()
			if (!isCurrentSession()) return
			resetDuel()
			dispatchStream({ type: 'RESET_STREAM' })
		})()
	}, [sessionId, streamPhase.status, abortActiveRequest, authorizedFetchCompat, resetDuel, applyQueueSnapshot])

	// Reuse the same submit path for assistant action buttons.
	const handleActionClick = useCallback(
		(message: string) => {
			if (!isStreaming) handleSubmit(message)
		},
		[isStreaming, handleSubmit]
	)

	const reconcileSessionExecution = useStableCallback(async (targetSessionId: string) => {
		const ownsTarget = () => (routeSessionIdRef.current ?? currentSessionIdRef.current) === targetSessionId
		if (!ownsTarget()) return
		const resumeOutcome = await resumeIfRunning({ targetSessionId })
		if (resumeOutcome === 'settled' || resumeOutcome === 'aborted') return
		if (!ownsTarget()) return

		await restoreCoordinator.run(targetSessionId, (operation) => restoreSessionSnapshot(targetSessionId, operation))
	})

	// Immediately attempt to reconnect to a running or completed server-side execution.
	const handleReconnectNow = useStableCallback(() => {
		const controller = recoveryControllerRef.current
		if (controller) {
			attemptRecoveryForController(controller.id)
			return
		}
		if (sessionId) {
			void reconcileSessionExecution(sessionId)
		}
	})

	// Replay only the sealed request. Current composer text, images, settings,
	// quote, and project state cannot alter a failed prompt.
	const handlePromptFailureAction = useCallback(() => {
		if (!sessionId || !sessionPromptFailure) return
		const failedRequest = sessionPromptFailure.request
		dispatchStream({ type: 'SET_ERROR', value: null })
		if (failedRequest.mutation.shareToken) shareTokenConsumedRef.current = true
		startPromptSubmission(failedRequest.mutation.mode ?? 'quick', () => ({
			currentSessionId: sessionId,
			failedRequest,
			submitProjectId: failedRequest.mutation.projectId ?? null
		}))
	}, [sessionId, sessionPromptFailure, startPromptSubmission])

	const handleDiscardPromptFailure = useCallback(() => {
		if (!sessionId || sessionPromptFailure?.kind !== 'retry') return
		const { request } = sessionPromptFailure
		clearPromptFailure(sessionId, request.mutation.clientMutationId)
		setMessages((current) => current.filter((message) => message.id !== request.optimisticMessageId))
	}, [clearPromptFailure, sessionId, sessionPromptFailure])

	// The deep-link hook is built before handleSubmit exists, so it calls through this ref. Assigning it
	// after commit rather than during render keeps the component optimizable; the only caller is the
	// hook's own confirm handler, which cannot run before the first commit.
	useLayoutEffect(() => {
		submitPendingPromptRef.current = (prompt, pageContext, isSuggestedQuestion) => {
			handleSubmit(prompt, undefined, undefined, pageContext, { isSuggestedQuestion })
		}
	})

	useForegroundRecovery({
		readOnly,
		isRouteSessionPending,
		isStreaming,
		sessionId,
		hasGenericError: !!error,
		promptFailure: sessionPromptFailure,
		getHasActiveRecovery: () => recoveryControllerRef.current !== null,
		onResumeRecovery: () => {
			const controller = recoveryControllerRef.current
			if (!controller) return
			controller.startedAt = Date.now()
			scheduleRecoveryAttempt(controller, 0, () => void attemptRecoveryForController(controller.id))
		},
		onReplayPrompt: handlePromptFailureAction,
		onProbeSession: (targetSessionId) => {
			void reconcileSessionExecution(targetSessionId)
		}
	})

	useForkInitialPrompt({
		initialPrompt: routeInitialPrompt,
		routeSessionId,
		sharedSession: !!sharedSession,
		restoringSessionId,
		sessionId,
		resolveSessionAlias,
		submitPrompt: (prompt) => {
			handleSubmit(prompt)
		}
	})

	// Shared/public sessions are read-only snapshots, so they should never create a fake local session.
	useEffect(() => {
		if (!sharedSession) return
		isFirstMessageRef.current = false
	}, [sharedSession])

	const handleAlertPrefillPrompt = useCallback(
		(text: string) => {
			setAlertPrefillRequest((prev) => ({ key: (prev?.key ?? 0) + 1, text }))
			requestAnimationFrame(() => promptInputRef.current?.focus())
		},
		[promptInputRef]
	)

	const tipActionHandlers = useMemo(
		() => ({
			openSettingsModal,
			openAlertsModal: () => {
				alertsModalStore.show()
			},
			toggleResearchMode: () => setMode((current) => (current === 'research' ? 'quick' : 'research')),
			submitPrompt: (prompt: string) => handleSubmit(prompt)
		}),
		[openSettingsModal, alertsModalStore, setMode, handleSubmit]
	)

	const promptDraftScope = getPromptDraftScope(effectiveSessionId, routeProjectId)

	const landingProps = {
		readOnly,
		isSharedView,
		draftScope: promptDraftScope,
		title: readOnly ? effectiveSessionTitle || 'Shared Conversation' : 'What can I help you with?',
		handleSubmit: (
			prompt: string,
			entities?: Array<{ term: string; slug: string; type?: string }>,
			images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>,
			pageContext?: ChatPageContext,
			isSuggestedQuestion?: boolean
		) => handleSubmit(prompt, entities, images, pageContext, { isSuggestedQuestion }),
		promptInputRef,
		handleStopRequest,
		isStreaming,
		isStopping,
		restoreRequest: alertPrefillRequest,
		onRestoreConsumed: () => setAlertPrefillRequest(null),
		mode,
		setMode,
		researchUsage,
		factCheckedUsage,
		onFactCheckedGated: handleFactCheckedGated,
		onOpenAlerts: alertsModalStore.show,
		isAlertsModalOpen,
		quotedText,
		onClearQuotedText: () => setQuotedText(null),
		enterToSend: settings.enterToSend
	}

	const queueCapMessage =
		queueAtCap && queueMaxDepth !== null
			? `Server queue is full (max ${queueMaxDepth}). New prompts wait here until space opens.`
			: null
	const queueSurface = useMemo<QueueSurface>(
		() => ({
			rows: queueRows,
			ownedEditId,
			rowStatus: queueRowStatus,
			onEditStart: beginQueueEdit,
			onEditDraftChange: updateQueueEditDraft,
			onEditSave: saveQueueEdit,
			onEditCancel: cancelQueueEdit,
			onDismiss: dismissQueueItem,
			onRetry: retryQueueItem,
			onContinue: continueQueue,
			onClear: clearQueue,
			queueAction,
			queueActionError
		}),
		[
			queueRows,
			ownedEditId,
			queueRowStatus,
			beginQueueEdit,
			updateQueueEditDraft,
			saveQueueEdit,
			cancelQueueEdit,
			dismissQueueItem,
			retryQueueItem,
			continueQueue,
			clearQueue,
			queueAction,
			queueActionError
		]
	)
	const promptFailureAction =
		!isStreaming && sessionPromptFailure && promptFailurePolicy
			? {
					label: promptFailurePolicy.label,
					onActivate: handlePromptFailureAction,
					...(promptFailurePolicy.canDiscard ? { onDiscard: handleDiscardPromptFailure } : {})
				}
			: null

	const conversationViewModel: ConversationViewModel = {
		readOnly,
		isSharedView,
		draftScope: promptDraftScope,
		messages: effectiveMessages,
		sessionId: effectiveSessionId,
		isLlama,
		isStreaming,
		isQueuedUserMessagePending: streamState.pendingQueueItemId !== null,
		isStopping,
		steps: streamingSteps,
		spawnProgress,
		spawnStartTime,
		todos: streamingTodos,
		todosStartTime,
		executionStartedAt,
		spawnIsResearchMode,
		streamingDraft,
		duelSlot: duelPairId ? (
			<DuelPanel
				key={duelPairId}
				a={duelStream.a}
				b={duelStream.b}
				sessionId={sessionId}
				isStreaming={isStreaming}
				canResolve={duelStream.ready}
				onVote={submitDuelVote}
			/>
		) : null,
		isCompacting,
		paginationState: renderedPaginationState,
		paginationError,
		recovery,
		error: visibleError,
		promptFailureAction,
		onReconnectNow: handleReconnectNow,
		scrollContainerRef,
		attachScrollContainer,
		attachScrollContent,
		messagesEndRef,
		promptInputRef,
		restoreRequest: alertPrefillRequest,
		onRestoreConsumed: () => setAlertPrefillRequest(null),
		isScrollAttached,
		showScrollToBottom,
		scrollToBottom,
		syncScrollAfterLayout,
		handleSubmit: handleComposerSubmit,
		submitMode: queueOwnsComposer
			? { kind: 'queue', atCapacity: queueAtCap, capacityMessage: queueCapMessage }
			: sessionPromptFailure
				? { kind: 'blocked', message: 'Retry or discard the failed prompt before sending another.' }
				: { kind: 'direct' },
		queueSurface,
		quotaResetTime: rateLimitDetails?.resetTime ?? null,
		handleStopRequest,
		handleActionClick,
		onEditMessage: handleEditMessage,
		onBranchSwitch: handleBranchSwitch,
		isBranchSwitching: switchActiveLeaf.isPending,
		mode,
		setMode,
		researchUsage,
		factCheckedUsage,
		onFactCheckedGated: handleFactCheckedGated,
		factCheckPhase: streamState.factCheckPhase,
		onOpenAlerts: alertsModalStore.show,
		quotedText,
		onClearQuotedText: () => setQuotedText(null),
		enterToSend: settings.enterToSend,
		onTableFullscreenOpen: hideSidebar,
		onShare: openShareModal,
		contextWarning,
		onDismissContextWarning: () => dispatchStream({ type: 'SET_CONTEXT_WARNING', value: null }),
		onStartNewChat: () => void handleNewChat()
	}

	const landingOverride =
		route.kind === 'project-list'
			? () => <ProjectsGrid />
			: route.kind === 'project'
				? (api: LandingOverrideApi) => (
						<ProjectLanding
							key={route.projectId}
							projectId={route.projectId}
							tier={projectTier}
							sessionList={sessions}
							initialTab={route.initialTab}
							onSubmit={api.handleSubmit}
							isStreaming={api.isStreaming}
							enterToSend={settings.enterToSend}
							onPickSession={(nextSessionId) => {
								void navigate.toSession(nextSessionId)
							}}
						/>
					)
				: null
	if (!user && !readOnly && !sharedSession) {
		return (
			<>
				<div className="isolate flex flex-1 flex-col items-center justify-center rounded-md border border-medium bg-surface p-1">
					<p className="flex items-center gap-1 text-center">
						Please{' '}
						<button
							type="button"
							onClick={() => {
								setSignupSource('llamaai')
								if (!shouldRenderSubscribeModal) setShouldRenderSubscribeModal(true)
								subscribeModalStore.show()
							}}
							className="underline"
						>
							log in
						</button>{' '}
						to use LlamaAI.
					</p>
				</div>
				{shouldRenderSubscribeModal ? (
					<Suspense fallback={null}>
						<SubscribeProModal dialogStore={subscribeModalStore} />
					</Suspense>
				) : null}
			</>
		)
	}

	return (
		<TipActionProvider handlers={tipActionHandlers}>
			<LlamaAIChromeContext.Provider value={chromeValue}>
				<ArticleExportProvider sessionTitle={effectiveSessionTitle ?? undefined}>
					<CitationSheetProvider value={citationSheet}>
						<div
							className="isolate flex flex-nowrap overflow-hidden max-lg:fixed max-lg:inset-x-0 max-lg:top-[68px] max-lg:bottom-0 max-lg:z-10 max-lg:flex-col lg:relative lg:h-[calc(100dvh-72px)]"
							style={viewportHeight ? { height: `${viewportHeight - 68}px` } : undefined}
						>
							{!readOnly && sidebarVisible ? (
								<>
									<AgenticSidebar
										sessions={sessions}
										isLoading={isLoadingSessions}
										loadError={sessionListError}
										currentSessionId={routeSessionId ?? sessionId ?? null}
										restoringSessionId={restoringSessionId}
										onSessionSelect={(nextSessionId) => {
											void navigate.toSession(nextSessionId)
										}}
										onNewChat={handleNewChat}
										onDelete={handleDeleteSession}
										shouldAnimate={shouldAnimateSidebar}
										onOpenSettings={openSettings}
										hasCustomInstructions={settings.customInstructions.trim().length > 0}
										onBulkDelete={handleBulkDeleteSessions}
										onSearchMatchClick={handleSearchMatchClick}
										hasMoreSessions={hasMoreSessions}
										isFetchingMoreSessions={isFetchingMoreSessions}
										loadMoreSessionsError={loadMoreSessionsError}
										onLoadMoreSessions={loadMoreSessions}
										currentProjectId={routeProjectId}
										currentSessionProjectId={effectiveSessionProjectId}
										alertsCount={alertsUsage?.count ?? null}
										onOpenAlerts={alertsModalStore.show}
									/>
									<div className="flex min-h-11 lg:hidden" />
								</>
							) : null}

							<div
								className={`llamaai-chat-panel relative isolate flex flex-1 flex-col overflow-hidden rounded-lg border border-subtle bg-surface ${sidebarVisible && shouldAnimateSidebar ? 'motion-safe:lg:animate-[shrinkToRight_0.1s_ease-out]' : ''}`}
							>
								{!readOnly && !sidebarVisible ? (
									<ChatControls
										handleNewChat={handleNewChat}
										onOpenSettings={openSettings}
										hasCustomInstructions={settings.customInstructions.trim().length > 0}
										sessionTitle={effectiveSessionTitle}
										canShare={!isSharedView && effectiveMessages.length > 0}
										isSessionSaved={isSessionSaved}
										onShare={() => openShareModal()}
									/>
								) : null}
								{!readOnly && !isSharedView && effectiveMessages.length > 0 ? (
									<Tooltip
										content={isSessionSaved ? SHARE_TOOLTIP : SHARE_PENDING_TOOLTIP}
										placement="bottom-end"
										render={
											<Ariakit.Button
												type="button"
												onClick={() => openShareModal()}
												disabled={!isSessionSaved}
												accessibleWhenDisabled
												data-umami-event="llamaai-share-modal-open"
												data-umami-event-source="header_controls"
											/>
										}
										className="absolute top-2.5 right-2.5 z-10 hidden size-6 items-center justify-center rounded-sm bg-brand/12 text-brand not-disabled:not-aria-disabled:hover:bg-brand not-disabled:not-aria-disabled:hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white aria-disabled:cursor-not-allowed aria-disabled:opacity-50 lg:flex"
									>
										<Icon name="share" height={14} width={14} />
										<span className="sr-only">{SHARE_TOOLTIP}</span>
									</Tooltip>
								) : null}
								{(isRouteSessionPending || restoringSessionId) && !hasMessages && !visibleError ? (
									<LoadingConversationState />
								) : !hasMessages && visibleError ? (
									<EmptyConversationErrorState
										onNewChat={() => void navigate.toNewChat()}
										message={visibleError}
										onRetry={
											isRouteSessionPending && routeSessionId
												? () => void handleSessionSelect(routeSessionId)
												: undefined
										}
									/>
								) : (
									<ChatSurface
										showLanding={!hasMessages && !visibleError}
										animateLandingTransition={shouldAnimateLandingTransition}
										animateConversationTransition={shouldAnimateConversationTransition}
										landingOverride={landingOverride}
										landingProps={landingProps}
										conversationViewModel={conversationViewModel}
										conversationKey={`conversation-${conversationViewResetKey}`}
									/>
								)}
							</div>
							{!isRouteSessionPending && rightPanel ? (
								<aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto rounded-lg border border-subtle bg-surface lg:ml-2 lg:flex">
									{rightPanel}
								</aside>
							) : null}
							{!isRouteSessionPending && citationSheet.isOpen ? (
								<CitationDetailPanel
									advancedProvenance={settings.advancedProvenance}
									onBackToDashboard={
										visibleDashboardVersions.length > 0 && dashboardPanelIsOpen ? citationSheet.close : undefined
									}
								/>
							) : visibleDashboardVersions.length > 0 && visibleDashboardConfig ? (
								<Suspense fallback={null}>
									<DashboardPanel
										config={visibleDashboardConfig}
										isOpen={dashboardPanelIsOpen}
										versions={visibleDashboardVersions}
										versionIndex={dashboardVersionIndex}
										onVersionChange={handleDashboardVersionChange}
										onClose={handleDashboardClose}
										onExited={handleDashboardExited}
										sessionId={sessionId}
									/>
								</Suspense>
							) : null}
							{!readOnly ? (
								<ArticleSelectionPopup
									messages={messages}
									onSelect={(text) => {
										setQuotedText(text)
										promptInputRef.current?.focus()
									}}
								/>
							) : null}
							{!readOnly && rateLimitDetails ? (
								<ResearchLimitModal
									dialogStore={researchModalStore}
									period={rateLimitDetails.period}
									limit={rateLimitDetails.limit}
									resetTime={rateLimitDetails.resetTime}
									feature={limitModalFeature}
								/>
							) : null}
							{!readOnly ? (
								<TokenLimitModal isOpen={showTokenLimitModal} onClose={() => setShowTokenLimitModal(false)} />
							) : null}
							{!readOnly && showShareModal ? (
								<ShareModal
									open
									setOpen={setShareModalOpen}
									sessionId={effectiveSessionId}
									messageId={shareTargetMessageId}
								/>
							) : null}
							{!readOnly ? (
								<DeepLinkPromptModal
									isOpen={!!deepLinkConfirmationPrompt}
									prompt={deepLinkConfirmationPrompt}
									onClose={handleCloseDeepLinkPrompt}
									onConfirm={handleConfirmDeepLinkPrompt}
								/>
							) : null}
							{!readOnly ? (
								<AlertsModal
									dialogStore={alertsModalStore}
									alertsUsage={alertsUsage}
									onPrefillPrompt={handleAlertPrefillPrompt}
								/>
							) : null}
							{shouldRenderSubscribeModal ? (
								<Suspense fallback={null}>
									<SubscribeProModal dialogStore={subscribeModalStore} />
								</Suspense>
							) : null}
							{!readOnly ? (
								<SettingsModal
									dialogStore={settingsModalStore}
									settings={settings}
									actions={actions}
									availableModels={availableModels}
									availableEfforts={availableEfforts}
									telegramStatus={telegramStatus}
									isSettingsLoading={
										settingsQueryState.isLoading || (settingsQueryState.isFetching && !settingsQueryState.data)
									}
									initialState={initialIntegrationsState}
									onInitialStateConsumed={() => setInitialIntegrationsState(null)}
									mobileNotificationPreference={webMobilePreference}
									setMobileNotificationEnabled={setWebMobilePushEnabled}
								/>
							) : null}
						</div>
					</CitationSheetProvider>
				</ArticleExportProvider>
			</LlamaAIChromeContext.Provider>
		</TipActionProvider>
	)
}

const ChatControls = memo(function ChatControls({
	handleNewChat,
	onOpenSettings,
	hasCustomInstructions,
	sessionTitle,
	canShare,
	isSessionSaved,
	onShare
}: {
	handleNewChat: () => void
	onOpenSettings: () => void
	hasCustomInstructions: boolean
	sessionTitle: string | null
	canShare: boolean
	isSessionSaved: boolean
	onShare: () => void
}) {
	const isMobile = useMedia('(max-width: 1023px)')
	const { isFullscreen, toggleFullscreen, toggleSidebar } = useLlamaAIChrome()
	const { balance, totalAvailable } = useAiBalance()

	const tooltipContent =
		sessionTitle || balance ? (
			<div className="flex items-center gap-3">
				<span>Open</span>
				<div className="flex flex-col items-end text-right">
					{sessionTitle ? <span>{sessionTitle}</span> : null}
					{balance ? (
						<span>{formatUsd(totalAvailable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
					) : null}
				</div>
			</div>
		) : (
			'Open Chat History'
		)

	return (
		<div className="llamaai-chat-controls">
			<nav
				className="flex gap-2 max-lg:flex-wrap max-lg:items-center max-lg:p-2.5 lg:absolute lg:top-2.5 lg:left-2.5 lg:z-10 lg:flex-col"
				aria-label="Chat controls"
			>
				<Tooltip
					content={tooltipContent}
					render={
						<button
							type="button"
							onClick={toggleSidebar}
							data-umami-event="llamaai-sidebar-toggle"
							data-umami-event-action="open"
							data-umami-event-source="collapsed_controls"
						/>
					}
					className="flex size-6 items-center justify-center gap-2 rounded-sm bg-brand/12 text-brand not-disabled:not-aria-disabled:hover:bg-brand not-disabled:not-aria-disabled:hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white"
				>
					<Icon name="panel-left-open" height={16} width={16} />
					<span className="sr-only">Open Chat History</span>
				</Tooltip>
				<Tooltip
					content="New Chat"
					render={<button type="button" onClick={handleNewChat} />}
					className="flex size-6 items-center justify-center gap-2 rounded-sm bg-brand text-ai-white not-disabled:not-aria-disabled:hover:bg-brand focus-visible:bg-brand max-lg:ml-auto"
				>
					<Icon name="message-square-plus" height={16} width={16} />
					<span className="sr-only">New Chat</span>
				</Tooltip>
				{canShare ? (
					<Tooltip
						content={isSessionSaved ? SHARE_TOOLTIP : SHARE_PENDING_TOOLTIP}
						render={
							<Ariakit.Button
								type="button"
								onClick={onShare}
								disabled={!isSessionSaved}
								accessibleWhenDisabled
								data-umami-event="llamaai-share-modal-open"
								data-umami-event-source="header_controls"
							/>
						}
						className="flex size-6 items-center justify-center rounded-sm bg-brand/12 text-brand not-disabled:not-aria-disabled:hover:bg-brand not-disabled:not-aria-disabled:hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white aria-disabled:cursor-not-allowed aria-disabled:opacity-50 lg:hidden"
					>
						<Icon name="share" height={14} width={14} />
						<span className="sr-only">{SHARE_TOOLTIP}</span>
					</Tooltip>
				) : null}
				{!isMobile ? (
					<Tooltip
						content={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
						render={
							<button
								type="button"
								onClick={toggleFullscreen}
								data-umami-event="llamaai-fullscreen-toggle"
								data-umami-event-action={isFullscreen ? 'exit' : 'enter'}
								data-umami-event-source="collapsed_controls"
							/>
						}
						className="flex size-6 items-center justify-center gap-2 rounded-sm bg-brand/12 text-brand not-disabled:not-aria-disabled:hover:bg-brand not-disabled:not-aria-disabled:hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white"
					>
						<Icon name={isFullscreen ? 'shrink' : 'expand'} height={16} width={16} />
						<span className="sr-only">{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
					</Tooltip>
				) : null}
			</nav>
			<Tooltip
				content="Settings"
				render={<button type="button" onClick={onOpenSettings} />}
				className="absolute bottom-2.5 left-2.5 z-10 flex size-6 items-center justify-center rounded-sm bg-brand/12 text-brand not-disabled:not-aria-disabled:hover:bg-brand not-disabled:not-aria-disabled:hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white max-lg:hidden"
			>
				<div className="relative">
					<Icon name="settings" height={16} width={16} />
					{hasCustomInstructions ? (
						<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand" />
					) : null}
				</div>
				<span className="sr-only">Settings</span>
			</Tooltip>
		</div>
	)
})

// Selection pill with the researcher-only "Add to article" action. Charts crossed
// by the selection are resolved against every message's chart artifacts by id.
function ArticleSelectionPopup({ messages, onSelect }: { messages: Array<Message>; onSelect: (text: string) => void }) {
	const openArticleExport = useArticleExport()
	const handleAddToArticle = useCallback(
		(html: string) => {
			if (!openArticleExport) return
			const groups = messages.flatMap((m) => m.charts ?? [])
			openArticleExport({ kind: 'selection', html, charts: chartsMapFromGroups(groups) })
		},
		[openArticleExport, messages]
	)
	return <TextSelectionPopup onSelect={onSelect} onAddToArticle={openArticleExport ? handleAddToArticle : undefined} />
}
