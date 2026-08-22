import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import {
	consumePendingPrompt,
	consumePendingPageContext,
	consumePendingSuggestedFlag
} from '~/components/LlamaAIFloatingButton'
import { AI_SERVER } from '~/constants'
import { AbortScope } from '~/containers/LlamaAI/abortScope'
import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'
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
import {
	ExecutionCoordinator,
	waitForAbortableDelay,
	type ExecutionOperation
} from '~/containers/LlamaAI/executionCoordinator'
import type { AgenticExecutionSnapshot } from '~/containers/LlamaAI/executionProtocol'
import { fetchAgenticResponse, stopAgenticExecution } from '~/containers/LlamaAI/fetchAgenticResponse'
import { useChatExecutionOwner } from '~/containers/LlamaAI/hooks/useChatExecutionOwner'
import { useChatQueueController, type QueueSurface } from '~/containers/LlamaAI/hooks/useChatQueueController'
import { useChatScroll } from '~/containers/LlamaAI/hooks/useChatScroll'
import { useLlamaAISetting, useLlamaAISettings } from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import { movePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import { useSessionList } from '~/containers/LlamaAI/hooks/useSessionList'
import { useSessionMutations } from '~/containers/LlamaAI/hooks/useSessionMutations'
import { useSettingsRouteIntent } from '~/containers/LlamaAI/hooks/useSettingsRouteIntent'
import { useSidebarVisibility } from '~/containers/LlamaAI/hooks/useSidebarVisibility'
import { useStreamNotification } from '~/containers/LlamaAI/hooks/useStreamNotification'
import { useVisualViewport } from '~/containers/LlamaAI/hooks/useVisualViewport'
import {
	mapPersistedMessage,
	mapPersistedMessages,
	mapSharedSessionMessage,
	type PersistedMessage,
	type SessionRestoreResult,
	type SharedSession
} from '~/containers/LlamaAI/messageMappers'
import { AgenticMutationReconcileError, createAgenticMutationEnvelope } from '~/containers/LlamaAI/mutationProtocol'
import { ProjectLanding } from '~/containers/LlamaAI/projects/ProjectLanding'
import { ProjectsGrid } from '~/containers/LlamaAI/projects/ProjectsGrid'
import { getProjectTier } from '~/containers/LlamaAI/projects/tier'
import { decodeQueueSnapshot } from '~/containers/LlamaAI/queue/protocol'
import { isFreeLimitError, runAgenticRequest, type UsageLimitError } from '~/containers/LlamaAI/runAgenticRequest'
import { appendBufferedAssistantMessage, createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import {
	createInitialStreamState,
	createStreamBuffer,
	hasStreamBufferContent,
	streamReducer,
	type ChatPageContext,
	type FailedRequest,
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
import { useMedia } from '~/hooks/useMedia'
import { useStableCallback } from '~/hooks/useStableCallback'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'
import { DuelPanel, type DuelChoice } from './components/DuelPanel'
import { useDuelStream } from './hooks/useDuelStream'
import {
	isSameAgenticRouteTransition,
	shouldSkipCurrentSessionRouteRestore,
	type AgenticRouteTransition
} from './routeTransition'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

const DashboardPanel = lazy(() =>
	import('~/containers/LlamaAI/components/DashboardPanel').then((m) => ({ default: m.DashboardPanel }))
)

interface RestoreSessionSnapshotResult {
	restored: boolean
	execution: AgenticExecutionSnapshot | null
}

function buildFreeLimitMessage(err: UsageLimitError & { code: FreeLimitOffer['code'] }): Message {
	const isDaily = err.code === 'FREE_DAILY_LIMIT'
	let content = isDaily ? "You've reached today's free question limit." : "You've reached your free question limit."
	if (err.details?.resetTime) {
		const resetMs = new Date(err.details.resetTime).getTime() - Date.now()
		if (resetMs > 0) {
			const hours = Math.floor(resetMs / 3600000)
			const minutes = Math.floor((resetMs % 3600000) / 60000)
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
	const projectHomeSignalRef = useRef(projectHomeSignal)
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
		updateSessionTitle,
		applyServerSessionTitle,
		isDeletingSession,
		isUpdatingTitle,
		bulkDeleteSessions,
		pinSession,
		isSwitchingActiveLeaf,
		replaceOptimisticSessionId
	} = useSessionMutations()
	const { sidebarVisible, toggleSidebar, hideSidebar, isFullscreen, toggleFullscreen } = useSidebarVisibility()
	const enableSoundNotifications = useLlamaAISetting('enableSoundNotifications')
	const { notify, primeAudio } = useStreamNotification({ soundEnabled: enableSoundNotifications })
	const alertsModalStore = Ariakit.useDialogStore()
	const settingsModalStore = Ariakit.useDialogStore()
	const [shouldRenderSubscribeModal, setShouldRenderSubscribeModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({
		open: shouldRenderSubscribeModal,
		setOpen: setShouldRenderSubscribeModal
	})

	const [messages, setMessages] = useState<Message[]>([])
	const [activeLeafMessageId, setActiveLeafMessageId] = useState<string | null>(null)
	const [sessionId, setSessionId] = useState<string | null>(null)
	const queueController = useChatQueueController({
		sessionId,
		enabled: routeSessionId === null || routeSessionId === sessionId,
		authorizedFetch
	})
	const {
		serverQueue: queuedMessages,
		rows: queueRows,
		maxDepth: queueMaxDepth,
		atCapacity: queueAtCap,
		ownedEditId,
		rowStatus: queueRowStatus,
		applySnapshot: applyQueueSnapshot,
		restoreSnapshot: restoreQueueSnapshot,
		enqueue: enqueuePrompt,
		beginEdit: beginQueueEdit,
		updateEditDraft: updateQueueEditDraft,
		saveEdit: saveQueueEdit,
		cancelEdit: cancelQueueEdit,
		dismiss: dismissQueueItem,
		retry: retryQueueItem,
		takeStartedItem,
		getServerQueue,
		abortCommands: abortQueueCommands
	} = queueController
	const [sessionTitle, setSessionTitle] = useState<string | null>(null)
	const [currentSessionProjectId, setCurrentSessionProjectId] = useState<string | null>(null)
	const [streamState, dispatchStream] = useReducer(streamReducer, undefined, createInitialStreamState)
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
	const [deepLinkConfirmationPrompt, setDeepLinkConfirmationPrompt] = useState<string | null>(null)
	const router = useRouter()
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
	const [limitModalFeature, setLimitModalFeature] = useState<'research' | 'fact_checked'>('research')
	const currentMessageIdRef = useRef<string | null>(null)
	const executionCoordinatorRef = useRef<ExecutionCoordinator | null>(null)
	const restoreCoordinatorRef = useRef<AbortScope | null>(null)
	const paginationCoordinatorRef = useRef<AbortScope | null>(null)
	const branchCoordinatorRef = useRef<AbortScope | null>(null)
	executionCoordinatorRef.current ??= new ExecutionCoordinator()
	restoreCoordinatorRef.current ??= new AbortScope()
	paginationCoordinatorRef.current ??= new AbortScope()
	branchCoordinatorRef.current ??= new AbortScope()
	const executionCoordinator = executionCoordinatorRef.current
	const restoreCoordinator = restoreCoordinatorRef.current
	const paginationCoordinator = paginationCoordinatorRef.current
	const branchCoordinator = branchCoordinatorRef.current
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
	const { keyboardOpen, viewportHeight } = useVisualViewport()
	const promptInputRef = useRef<HTMLTextAreaElement>(null)
	const toolCallIdRef = useRef(0)
	const promptSubmissionLockRef = useRef<number | null>(null)
	const nextPromptSubmissionIdRef = useRef(0)
	const isFirstMessageRef = useRef(true)
	const promptTransitionTimerRef = useRef<number | null>(null)
	const currentSessionIdRef = useRef(sessionId)
	currentSessionIdRef.current = sessionId
	const routeSessionIdRef = useRef(routeSessionId)
	routeSessionIdRef.current = routeSessionId
	const currentSessionProjectIdRef = useRef<string | null>(null)
	const previousRouteTransitionRef = useRef<AgenticRouteTransition | null>(null)
	const consumedInitialPromptRef = useRef<{ sessionId: string; prompt: string } | null>(null)
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
		thinking: streamingThinking,
		activeToolCalls,
		spawnProgress,
		spawnStartTime,
		spawnIsResearchMode,
		todos: streamingTodos,
		todosStartTime,
		executionStartedAt,
		recovery,
		error,
		lastFailedRequest,
		rateLimitDetails,
		contextWarning
	} = streamState
	const isStopping = streamPhase.status === 'stopping'

	const queryClient = useQueryClient()
	const wasStreamingRef = useRef(false)
	useEffect(() => {
		if (wasStreamingRef.current && !isStreaming) {
			void queryClient.invalidateQueries({ queryKey: [AI_BALANCE_QUERY_KEY] })
		}
		wasStreamingRef.current = isStreaming
	}, [isStreaming, queryClient])

	const isStreamingRef = useRef(isStreaming)
	isStreamingRef.current = isStreaming

	const sharedMessages = useMemo(
		() => sharedSession?.messages.map((msg, i) => mapSharedSessionMessage(msg, i)) ?? null,
		[sharedSession]
	)
	const forkedFromShared = sharedSession && sessionId
	const isSharedView = !!sharedSession && !forkedFromShared
	const isRouteSessionPending = !sharedSession && routeSessionId !== null && routeSessionId !== sessionId
	const visibleDashboardVersions = isRouteSessionPending ? [] : dashboardVersions
	const visibleDashboardConfig = isRouteSessionPending ? null : dashboardPanelMountedConfig
	const effectiveMessages = isRouteSessionPending ? [] : ((forkedFromShared ? null : sharedMessages) ?? messages)
	const effectiveSessionId = (forkedFromShared ? sessionId : sharedSession?.session.sessionId) ?? sessionId
	const lookupSessionId = routeSessionId ?? sessionId ?? null
	const sessionListEntry = lookupSessionId ? (sessions.find((s) => s.sessionId === lookupSessionId) ?? null) : null
	const sessionListTitle = sessionListEntry?.title ?? null
	const effectiveSessionTitle =
		sharedSession?.session.title ?? (isRouteSessionPending ? sessionListTitle : (sessionTitle ?? sessionListTitle))
	const effectiveSessionProjectId = isRouteSessionPending
		? (sessionListEntry?.projectId ?? null)
		: (currentSessionProjectId ?? sessionListEntry?.projectId ?? null)
	const visibleIsStreaming = !isRouteSessionPending && isStreaming
	const hasMessages = effectiveMessages.length > 0 || visibleIsStreaming
	const visibleError = isRouteSessionPending
		? restoreFailure?.sessionId === routeSessionId
			? restoreFailure.message
			: null
		: (viewError ?? error)
	const shouldShowLanding = !hasMessages && !visibleError && !restoringSessionId
	const shouldAnimateLandingTransition =
		promptTransitionMode === 'landing' && hasMessages && !visibleError && !restoringSessionId && !readOnly
	const shouldAnimateConversationTransition =
		promptTransitionMode === 'conversation' && hasMessages && !visibleError && !restoringSessionId && !readOnly
	const shouldStartDetachedForAnchor = typeof window !== 'undefined' && /^#msg-/.test(window.location.hash)

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
	}, [sessionId, closeCitationSheet])

	useEffect(() => {
		currentSessionProjectIdRef.current = currentSessionProjectId
	}, [currentSessionProjectId])

	useEffect(() => {
		const timer = setTimeout(() => window.dispatchEvent(new CustomEvent('chartResize')), 250)
		return () => clearTimeout(timer)
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
			}, 480)
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
			id: currentMessageIdRef.current || undefined,
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
		scrollToBottom,
		isAttached: isScrollAttached,
		showScrollToBottom
	} = useChatScroll({
		scrollContainerRef,
		isStreaming,
		items: effectiveMessages,
		hasMessages,
		paginationState: renderedPaginationState,
		onLoadMoreMessages: handleLoadMoreMessagesEvent,
		onLoadNewerMessages: handleLoadNewerMessagesEvent,
		keyboardOpen,
		startDetached: shouldStartDetachedForAnchor
	})

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
			replaceUserMessageId
		}: {
			buffer: StreamBuffer
			isCurrent: () => boolean
			targetSessionId: string
			deferEmptyDone?: boolean
			onSessionId?: (sessionId: string) => void
			onTitle?: (title: string) => void
			onDuelStart?: (pairId: string) => void
			replaceUserMessageId?: (messageId: string, queueItemId?: string) => void
		}) =>
			createAgenticCallbacks({
				isCurrent,
				buffer,
				dispatch: dispatchStream,
				currentMessageIdRef,
				toolCallIdRef,
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
				onSessionId,
				onTitle:
					onTitle ??
					((title) => {
						if (targetSessionId === currentSessionIdRef.current) setSessionTitle(title)
						applyServerSessionTitle(targetSessionId, title, currentSessionProjectIdRef.current)
						moveSessionToTop(targetSessionId, currentSessionProjectIdRef.current)
					})
			})
	)

	const clearRecoveryController = useCallback((resetState: boolean = true) => {
		const controller = recoveryControllerRef.current
		if (controller && controller.timer !== null) window.clearTimeout(controller.timer)
		recoveryControllerRef.current = null
		if (resetState) {
			dispatchStream({ type: 'RESET_RECOVERY' })
		}
	}, [])

	const { ensureQueueAttached, resumeRunningExecution } = useChatExecutionOwner({
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
			if (recoveryControllerRef.current?.sessionId === targetSessionId) clearRecoveryController()
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
			const result = await restoreSession(targetSessionId, 10, options?.around, operation.signal).catch(
				() => null as SessionRestoreResult | null
			)
			if (!result || !operation.isCurrent()) {
				return { restored: false, execution: null }
			}

			const restored: Message[] = (result.messages || []).map(mapPersistedMessage)

			if (options?.around) {
				window.location.hash = `msg-${options.around}`
			}

			setMessages(restored)
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
			dispatchStream({ type: 'SET_LAST_FAILED_REQUEST', value: null })
			dispatchStream({ type: 'RESET_RECOVERY' })

			return { restored: true, execution: result.execution ?? null }
		},
		[attach, restoreQueueSnapshot, restoreSession, sessions]
	)

	const exhaustRecovery = useCallback(
		(controller: RecoveryController) => {
			if (recoveryControllerRef.current?.id !== controller.id) return
			clearRecoveryController()
			appendBufferedAssistantMessage(controller.buffer, currentMessageIdRef, appendMessage)
			dispatchStream({ type: 'RESET_STREAM' })
			dispatchStream({
				type: 'SET_ERROR',
				value: 'Lost connection and could not reconnect. The response may still finish on the server.'
			})
			dispatchStream({ type: 'SET_LAST_FAILED_REQUEST', value: controller.failedRequest })
		},
		[appendMessage, clearRecoveryController]
	)

	const attemptRecoveryForController = useStableCallback(async (recoveryId: number) => {
		const controller = recoveryControllerRef.current
		if (!controller || controller.id !== recoveryId) return

		controller.attemptCount += 1
		dispatchStream({
			type: 'UPDATE_RECOVERY',
			attemptCount: controller.attemptCount,
			lastErrorMessage: controller.lastErrorMessage
		})

		const resumeOutcome = await resumeRunningExecution({
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

		const { restored, execution } = await restoreCoordinator.run(latest.sessionId, (operation) =>
			restoreSessionSnapshot(latest.sessionId, operation)
		)
		if (recoveryControllerRef.current?.id !== recoveryId) return
		if (restored && execution?.status !== 'running') {
			dispatchStream({ type: 'RESET_STREAM' })
			clearRecoveryController()
			return
		}
		if (Date.now() - latest.startedAt >= RECOVERY_MAX_MS) {
			exhaustRecovery(latest)
			return
		}
		const backoffMs = Math.min(1000 * 2 ** Math.max(0, latest.attemptCount - 1), 8000)
		scheduleRecoveryAttempt(latest, backoffMs, () => void attemptRecoveryForController(recoveryId))
	})

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
		[attemptRecoveryForController, clearRecoveryController]
	)

	// Invalidate callbacks before waiting for transport cleanup. A slow reader must
	// never delay or remain authoritative during navigation to another session.
	const abortActiveRequest = useCallback(() => {
		executionCoordinator.invalidate()
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
		dispatchStream({ type: 'SET_LAST_FAILED_REQUEST', value: null })
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
		promptSubmissionLockRef.current = null
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

	useEffect(() => {
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
			const persistSession = createSession({
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

			const { restored: restoredOk, execution } = await restoreCoordinator.run(selectedSessionId, (operation) =>
				restoreSessionSnapshot(selectedSessionId, operation, options)
			)

			if (routeSessionIdRef.current !== selectedSessionId) return
			if (!restoredOk) {
				setRestoreFailure({ sessionId: selectedSessionId, message: 'Failed to restore session' })
				setRestoringSessionId(null)
				return
			}

			setRestoreFailure(null)
			setRestoringSessionId(null)

			await resumeRunningExecution({
				targetSessionId: selectedSessionId,
				executionHint: execution,
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
			resumeRunningExecution,
			startRecoveryCycle
		]
	)

	const handleSearchMatchClick = useCallback(
		(targetSessionId: string, messageId: string) => {
			void navigate.toSession(targetSessionId, { around: messageId })
		},
		[navigate]
	)

	const routeTransition = useMemo<AgenticRouteTransition | null>(() => {
		if (readOnly || sharedSession) return null
		if (route.kind === 'chat-new') return { kind: 'new-chat' }
		if (route.kind === 'chat-session') {
			return {
				kind: 'session',
				sessionId: resolveSessionAlias(route.sessionId),
				aroundMessageId: route.aroundMessageId
			}
		}
		if (route.kind === 'project-list') return { kind: 'project-list' }
		if (route.kind === 'project') return { kind: 'project', projectId: route.projectId }
		return null
	}, [readOnly, sharedSession, route, resolveSessionAlias])

	// Same-URL project clicks (sidebar click while already on /ai/projects/[id]) bump the project-home
	// signal so we can reset the inline chat back to the project landing — Next.js doesn't fire route
	// change events for same-URL navigation, so we need a separate trigger.
	useEffect(() => {
		if (projectHomeSignal === projectHomeSignalRef.current) return
		projectHomeSignalRef.current = projectHomeSignal
		if (readOnly || sharedSession) return
		if (route.kind !== 'project') return
		void clearConversationState()
	}, [projectHomeSignal, route.kind, readOnly, sharedSession, clearConversationState])

	useLayoutEffect(() => {
		if (!routeTransition) return

		const previousTransition = previousRouteTransitionRef.current

		// Bail out if the route hasn't actually changed. The effect can re-fire if a callback
		// in its dep list re-creates (e.g. after we dispatch state changes inside the transition),
		// and re-running the transition body would loop the clear/restore actions indefinitely.
		if (previousTransition && isSameAgenticRouteTransition(previousTransition, routeTransition)) return
		previousRouteTransitionRef.current = routeTransition

		const transition = async () => {
			if (routeTransition.kind === 'new-chat') {
				clearConversationState()
				promptInputRef.current?.focus()
				return
			}

			if (routeTransition.kind === 'session') {
				const nextSessionId = routeTransition.sessionId
				if (shouldSkipCurrentSessionRouteRestore(routeTransition, previousTransition, currentSessionIdRef.current))
					return

				setQuotedText(null)
				setMessages([])
				setActiveLeafMessageId(null)
				setSessionTitle(null)
				resetDuel()
				dispatchDashboardPanel({ type: 'RESET' })
				setPaginationState({ hasMore: false, cursor: null })
				restoredSessionIdRef.current = null
				await handleSessionSelect(
					nextSessionId,
					routeTransition.aroundMessageId ? { around: routeTransition.aroundMessageId } : undefined
				)
				return
			}

			if (routeTransition.kind === 'project-list') {
				clearConversationState()
				return
			}

			if (routeTransition.kind === 'project') {
				// Always reset to the project landing on navigation. The submit-from-landing flow
				// keeps the inline chat visible because URL doesn't change (no transition fires);
				// any actual navigation to /ai/projects/[id] should land you on the project home.
				clearConversationState()
			}
		}

		void transition()
	}, [routeTransition, clearConversationState, handleSessionSelect, resetDuel])

	const startPromptSubmission = useCallback(
		(effectiveMode: AgenticAnswerMode, prepare: () => PreparedPromptSubmission): boolean => {
			if (isStreamingRef.current || promptSubmissionLockRef.current !== null) return false
			triggerPromptTransition(shouldShowLanding ? 'landing' : 'conversation')
			const submissionId = ++nextPromptSubmissionIdRef.current
			promptSubmissionLockRef.current = submissionId
			const releaseSubmission = () => {
				if (promptSubmissionLockRef.current === submissionId) promptSubmissionLockRef.current = null
			}
			if (effectiveMode === 'research') {
				try {
					if (!localStorage.getItem('llamaai-research-duration-toast')) {
						localStorage.setItem('llamaai-research-duration-toast', '1')
						toast(
							'Research reports usually take 10–20 minutes. You can leave this page — the run continues and will be here when you come back.',
							{ icon: '🔍', duration: 8000 }
						)
					}
				} catch {}
			}

			const abandonedDuelSessionId = duelPairId ? sessionId : null

			abortActiveRequest()
			void (async () => {
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
				const { failedRequest, submitProjectId } = prepared
				const { mutation } = failedRequest
				const userImages = mutation.images?.map((image) => ({
					url: image.data,
					mimeType: image.mimeType,
					filename: image.filename
				}))
				setMessages((prev) =>
					prev.some((message) => message.id === failedRequest.optimisticMessageId)
						? prev
						: [
								...prev,
								{
									role: 'user',
									content: mutation.message,
									images: userImages?.length ? userImages : undefined,
									quotedText: mutation.quotedText,
									id: failedRequest.optimisticMessageId
								}
							]
				)
				attach()
				moveSessionToTop(currentSessionId, submitProjectId)

				const buffer = createStreamBuffer()
				const adoptResponseSession = (id: string) => {
					const previousSessionId = currentSessionId
					movePromptDraft(getPromptDraftScope(previousSessionId, submitProjectId), `session:${id}`)
					setSessionId(id)
					currentSessionId = id
					if (previousSessionId && previousSessionId !== id) {
						executionCoordinator.adoptSession(previousSessionId, id)
						registerSessionAlias(previousSessionId, id)
						replaceOptimisticSessionId(previousSessionId, id, submitProjectId)
					}
					if (sharedSession) onSharedSessionFork?.(id)
					if (previousSessionId !== id && !sessions.some((session) => session.sessionId === id)) {
						void createSession({
							sessionId: id,
							title: sessionTitle ?? undefined,
							projectId: submitProjectId
						}).catch((createSessionError) => {
							console.error('[llama-ai] [createSession] failed:', getErrorMessage(createSessionError))
						})
					}
				}

				void executionCoordinator.run(currentSessionId, 'prompt', async (operation) => {
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
								if (err.status === 'pending') {
									dispatchStream({
										type: 'SET_ERROR',
										value: 'The prompt request is still being processed. Reconnect to check again.'
									})
									dispatchStream({ type: 'SET_LAST_FAILED_REQUEST', value: failedRequest })
									dispatchStream({ type: 'RESET_STREAM' })
									return
								}
								startRecoveryCycle({
									targetSessionId: err.sessionId,
									buffer,
									failedRequest,
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
							if (kind === 'temporary-connectivity' && currentSessionId) {
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
							dispatchStream({ type: 'SET_ERROR', value: err.message || 'Failed to get response' })
							dispatchStream({
								type: 'SET_LAST_FAILED_REQUEST',
								value: failedRequest
							})
							appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
							dispatchStream({ type: 'RESET_STREAM' })
						},
						onSuccess: async ({ isCurrent, eventCounter }) => {
							let handedOffToResume = false
							let recoveryStarted = false
							if (isCurrent() && currentSessionId && !buffer.error && !hasStreamBufferContent(buffer)) {
								// The HTTP stream can finish without local content if the result was
								// persisted server-side first; attach to that execution before clearing UI.
								buffer.receivedEventCount = eventCounter.count
								const resumeSessionId = currentSessionId
								const resumeOutcome = await resumeRunningExecution({
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
							}

							if (!handedOffToResume && isCurrent()) {
								setActiveLeafMessageId(currentMessageIdRef.current)
							}
						},
						onFinally: ({ isCurrent }) => {
							releaseSubmission()
							if (isCurrent()) finishDuel()
						}
					})
				})
			})().catch(() => {
				releaseSubmission()
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
			restoreCoordinator,
			resumeRunningExecution,
			startRecoveryCycle,
			sessionTitle,
			sessions,
			attach,
			shouldShowLanding,
			triggerPromptTransition,
			sharedSession,
			registerSessionAlias,
			replaceOptimisticSessionId,
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

			try {
				let timezone: string | undefined
				try {
					timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
				} catch {}

				const effectiveMode = modeOverride ?? mode
				const effectiveQuotedText =
					quotedTextOverride === undefined ? quotedText || undefined : (quotedTextOverride ?? undefined)
				const result = await enqueuePrompt({
					message: trimmed,
					entities: entities?.length ? entities : undefined,
					images: images?.length ? images : undefined,
					researchMode: effectiveMode === 'research',
					factCheckMode: effectiveMode === 'fact_checked',
					quotedText: effectiveQuotedText,
					timezone,
					client: 'web',
					projectId: currentSessionProjectId ?? undefined,
					customInstructions: settings.customInstructions || undefined,
					blockedSkills: isMobileChatView ? ['dashboard'] : undefined
				})
				if (result === 'busy') return { status: 'cancelled' as const }
				if (result === 'aborted') return { status: 'cancelled' as const }
				if (result === 'session_idle') {
					return handleSubmit(trimmed, entities, images, undefined, { modeOverride, quotedTextOverride })
						? ({ status: 'accepted' } as const)
						: ({ status: 'rejected', message: 'Failed to submit your prompt. Please try again.' } as const)
				}

				if (
					quotedTextOverride === undefined &&
					effectiveQuotedText !== undefined &&
					quotedText === effectiveQuotedText
				) {
					setQuotedText(null)
				}
				return { status: 'accepted' as const }
			} catch (queueError) {
				if (queueError instanceof LlamaAITransportError) {
					const body = queueError.body as { error?: string; maxDepth?: number } | null
					if (body?.error === 'queue_full') {
						return {
							status: 'rejected' as const,
							message: body.maxDepth
								? `Queue is full (max ${body.maxDepth}). Wait for a message to send first.`
								: 'Queue is full. Wait for a message to send first.'
						}
					}
				}
				console.error('[llama-ai] [queue-enqueue] failed:', getErrorMessage(queueError))
				return { status: 'rejected' as const, message: 'Failed to queue your prompt. Please try again.' }
			}
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

	const queueOwnsComposer = shouldQueuePrompt(isStreaming, queuedMessages)
	const handleComposerSubmit = useCallback(
		(
			prompt: string,
			entities?: Array<{ term: string; slug: string; type?: string }>,
			images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>
		) => {
			const queueIsActive = shouldQueuePrompt(isStreamingRef.current, getServerQueue())
			if (queueIsActive) return handleQueue(prompt, entities, images)
			return handleSubmit(prompt, entities, images)
		},
		[getServerQueue, handleQueue, handleSubmit]
	)

	const handleEditMessage = useCallback(
		async (messageId: string, newText: string, original: Message): Promise<void> => {
			const trimmed = newText.trim()
			if (!sessionId || !trimmed) return
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
							const resumeOutcome = await resumeRunningExecution({
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
			resumeRunningExecution,
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
				try {
					const result = await switchActiveLeaf({ sessionId, leafMessageId, signal: operation.signal })
					if (!operation.isCurrent() || currentSessionIdRef.current !== sessionId) return
					setActiveLeafMessageId(result.activeLeafMessageId)
					if (Array.isArray(result.messages)) {
						const restored = mapPersistedMessages(result.messages as PersistedMessage[])
						setMessages(restored)
						setConversationViewResetKey((current) => current + 1)
						dispatchDashboardPanel({ type: 'RESTORE', value: restored.flatMap((message) => message.dashboards || []) })
						setPaginationState(normalizePaginationState(result.pagination))
						dispatchStream({ type: 'SET_ERROR', value: null })
						dispatchStream({ type: 'SET_LAST_FAILED_REQUEST', value: null })
						dispatchStream({ type: 'RESET_RECOVERY' })
					} else {
						await restoreSessionSnapshot(sessionId, operation)
					}
				} catch (switchError) {
					if (operation.isCurrent() && currentSessionIdRef.current === sessionId) {
						setViewError(getErrorMessage(switchError))
					}
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
		void (async () => {
			let acknowledged = false
			let confirmedInactive = false
			try {
				while (
					!stopController.signal.aborted &&
					(routeSessionIdRef.current ?? currentSessionIdRef.current) === targetSessionId
				) {
					try {
						const result = await stopAgenticExecution(targetSessionId, authorizedFetchCompat, stopController.signal)
						if ((routeSessionIdRef.current ?? currentSessionIdRef.current) !== targetSessionId) return
						acknowledged = true
						if (result.active) {
							await waitForAbortableDelay(500, stopController.signal)
							continue
						}
						applyQueueSnapshot(result.snapshot)
						confirmedInactive = true
						break
					} catch (stopError) {
						if (stopController.signal.aborted) return
						if (!acknowledged) throw stopError
						await waitForAbortableDelay(1000, stopController.signal)
					}
				}
			} catch {
				if (stopController.signal.aborted) return
				if ((routeSessionIdRef.current ?? currentSessionIdRef.current) === targetSessionId) {
					dispatchStream({ type: 'STOP_FAILED', error: 'Could not stop the response. Try again.' })
				}
				return
			} finally {
				if (stopSettlementControllerRef.current === stopController) stopSettlementControllerRef.current = null
			}

			if (!confirmedInactive || (routeSessionIdRef.current ?? currentSessionIdRef.current) !== targetSessionId) return
			await abortActiveRequest()
			if ((routeSessionIdRef.current ?? currentSessionIdRef.current) !== targetSessionId) return
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
		const resumeOutcome = await resumeRunningExecution({ targetSessionId })
		if (resumeOutcome === 'settled' || resumeOutcome === 'aborted') return
		if (!ownsTarget()) return

		const restoreResult = await restoreCoordinator.run(targetSessionId, (operation) =>
			restoreSessionSnapshot(targetSessionId, operation)
		)
		if (!ownsTarget() || !restoreResult.restored) return
		if (restoreResult.execution) {
			await resumeRunningExecution({ targetSessionId, executionHint: restoreResult.execution })
		}
	})

	// Immediately attempt to reconnect to a running or completed server-side execution.
	// Works during active recovery (doesn't require lastFailedRequest).
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
	const handleReconnectFailedPrompt = useCallback(() => {
		if (!lastFailedRequest) return
		const failedRequest = lastFailedRequest
		dispatchStream({ type: 'SET_ERROR', value: null })
		if (failedRequest.mutation.shareToken) shareTokenConsumedRef.current = true
		startPromptSubmission(failedRequest.mutation.mode ?? 'quick', () => ({
			currentSessionId: sessionId ?? failedRequest.mutation.sessionId,
			failedRequest,
			submitProjectId: failedRequest.mutation.projectId ?? null
		}))
	}, [lastFailedRequest, sessionId, startPromptSubmission])

	// Consume pending prompts injected by the floating button once the base chat page mounts.
	const submitPendingPromptEvent = useStableCallback(
		(
			prompt: string,
			pageContext?: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string },
			isSuggestedQuestion?: boolean
		) => {
			handleSubmit(prompt, undefined, undefined, pageContext, { isSuggestedQuestion })
		}
	)

	// Confirm shareable deep-link prompts before spending a user request. Prompts that were already
	// confirmed before auth are still delivered through the existing pending-prompt queue.
	const deepLinkPrompt = route.kind === 'chat-new' ? route.initialPrompt?.trim() || undefined : undefined
	const deepLinkUtmSource = typeof router.query.utm_source === 'string' ? router.query.utm_source : null
	const deepLinkUtmCampaign = typeof router.query.utm_campaign === 'string' ? router.query.utm_campaign : null
	const deepLinkConsumedKeyRef = useRef<string | null>(null)

	useEffect(() => {
		if (route.kind !== 'chat-new' || sharedSession) return

		const pendingPrompt = consumePendingPrompt()
		const pendingPageContext = consumePendingPageContext()
		const isSuggested = consumePendingSuggestedFlag()
		if (pendingPrompt) {
			if (deepLinkPrompt) {
				deepLinkConsumedKeyRef.current = `${deepLinkPrompt}\n${deepLinkUtmSource ?? ''}\n${deepLinkUtmCampaign ?? ''}`
				setDeepLinkConfirmationPrompt(null)
				void navigate.refineCurrent('/ai/chat')
			}
			submitPendingPromptEvent(pendingPrompt, pendingPageContext ?? undefined, isSuggested || undefined)
			return
		}

		if (deepLinkPrompt) {
			const deepLinkKey = `${deepLinkPrompt}\n${deepLinkUtmSource ?? ''}\n${deepLinkUtmCampaign ?? ''}`
			if (deepLinkConsumedKeyRef.current === deepLinkKey) return
			deepLinkConsumedKeyRef.current = deepLinkKey
			setDeepLinkConfirmationPrompt(deepLinkPrompt)
			trackUmamiEvent('llamaai-deeplink-view', {
				source: deepLinkUtmSource,
				campaign: deepLinkUtmCampaign,
				prompt: deepLinkPrompt.replace(/\s+/g, ' ').slice(0, 100)
			})
			return
		}

		deepLinkConsumedKeyRef.current = null
		setDeepLinkConfirmationPrompt(null)
	}, [
		route.kind,
		deepLinkPrompt,
		deepLinkUtmSource,
		deepLinkUtmCampaign,
		sharedSession,
		navigate,
		submitPendingPromptEvent
	])

	const handleConfirmDeepLinkPrompt = useCallback(() => {
		const prompt = deepLinkConfirmationPrompt?.trim()
		if (!prompt) return
		deepLinkConsumedKeyRef.current = `${prompt}\n${deepLinkUtmSource ?? ''}\n${deepLinkUtmCampaign ?? ''}`
		setDeepLinkConfirmationPrompt(null)
		trackUmamiEvent('llamaai-deeplink-run', {
			source: deepLinkUtmSource,
			campaign: deepLinkUtmCampaign,
			prompt: prompt.replace(/\s+/g, ' ').slice(0, 100)
		})
		void navigate.refineCurrent('/ai/chat')
		submitPendingPromptEvent(prompt)
	}, [deepLinkConfirmationPrompt, deepLinkUtmSource, deepLinkUtmCampaign, navigate, submitPendingPromptEvent])

	const handleCloseDeepLinkPrompt = useCallback(() => {
		if (deepLinkConfirmationPrompt) {
			trackUmamiEvent('llamaai-deeplink-dismiss', {
				source: deepLinkUtmSource,
				campaign: deepLinkUtmCampaign,
				prompt: deepLinkConfirmationPrompt.replace(/\s+/g, ' ').slice(0, 100)
			})
		}
		setDeepLinkConfirmationPrompt(null)
		void navigate.refineCurrent('/ai/chat')
	}, [deepLinkConfirmationPrompt, deepLinkUtmSource, deepLinkUtmCampaign, navigate])

	// When returning to the tab after a dropped stream, try to reconnect to any still-running execution.
	// Resets the recovery grace period so it doesn't immediately exhaust after mobile sleep
	// (setTimeout timers are frozen during sleep but wall clock advances).
	const reconnectVisibleExecutionEvent = useEffectEvent(() => {
		if (readOnly || isRouteSessionPending) return
		const controller = recoveryControllerRef.current
		if (controller) {
			controller.startedAt = Date.now()
			scheduleRecoveryAttempt(controller, 0, () => void attemptRecoveryForController(controller.id))
			return
		}
		if (sessionId && !isStreaming && error) {
			void reconcileSessionExecution(sessionId)
		}
	})

	useEffect(() => {
		const onVisibilityChange = () => {
			if (!document.hidden) {
				reconnectVisibleExecutionEvent()
			}
		}
		const onPageShow = (e: PageTransitionEvent) => {
			if (e.persisted) {
				reconnectVisibleExecutionEvent()
			}
		}

		document.addEventListener('visibilitychange', onVisibilityChange)
		window.addEventListener('pageshow', onPageShow)
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange)
			window.removeEventListener('pageshow', onPageShow)
		}
	}, [])

	useEffect(() => {
		const onOnline = () => {
			reconnectVisibleExecutionEvent()
		}

		window.addEventListener('online', onOnline)
		return () => window.removeEventListener('online', onOnline)
	}, [])

	// After recovery exhausts, periodically check if the server-side execution completed
	// so we can restore the result without requiring user interaction.
	useEffect(() => {
		if (isRouteSessionPending || isStreaming || !error || !sessionId || readOnly) return
		const intervalId = window.setInterval(() => {
			if (document.hidden) return
			void reconcileSessionExecution(sessionId)
		}, 30_000)
		return () => window.clearInterval(intervalId)
	}, [isRouteSessionPending, isStreaming, error, sessionId, readOnly, reconcileSessionExecution])

	// Shared/public sessions are read-only snapshots, so they should never create a fake local session.
	useEffect(() => {
		if (!sharedSession) return
		isFirstMessageRef.current = false
	}, [sharedSession])

	// Auto-send the initial prompt after a forked session finishes restoring.
	useEffect(() => {
		if (!routeInitialPrompt) return
		if (!sharedSession && !routeSessionId) return
		const nextToken = { sessionId: routeSessionId ?? 'shared', prompt: routeInitialPrompt }
		const currentToken = consumedInitialPromptRef.current
		if (currentToken?.sessionId === nextToken.sessionId && currentToken.prompt === nextToken.prompt) return
		consumedInitialPromptRef.current = nextToken
	}, [routeInitialPrompt, routeSessionId, sharedSession])

	useEffect(() => {
		const token = consumedInitialPromptRef.current
		if (!token) return
		if (restoringSessionId) return
		if (!sharedSession && resolveSessionAlias(token.sessionId) !== sessionId) return
		consumedInitialPromptRef.current = null
		const frameId = window.requestAnimationFrame(() => {
			handleSubmit(token.prompt)
		})

		return () => {
			window.cancelAnimationFrame(frameId)
		}
	}, [restoringSessionId, sessionId, sharedSession, resolveSessionAlias, handleSubmit])

	const handleAlertPrefillPrompt = useCallback(
		(text: string) => {
			setAlertPrefillRequest((prev) => ({ key: (prev?.key ?? 0) + 1, text }))
			requestAnimationFrame(() => promptInputRef.current?.focus())
		},
		[promptInputRef]
	)

	const tipActionHandlers = useMemo(
		() => ({
			openSettingsModal: (tab?: SettingsTabId) => {
				if (tab) setInitialIntegrationsState({ tab, tgloginToken: null })
				settingsModalStore.show()
			},
			openAlertsModal: () => {
				alertsModalStore.show()
			},
			toggleResearchMode: () => setMode((current) => (current === 'research' ? 'quick' : 'research')),
			submitPrompt: (prompt: string) => handleSubmit(prompt)
		}),
		[settingsModalStore, alertsModalStore, setMode, handleSubmit]
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
		quotedText,
		onClearQuotedText: () => setQuotedText(null),
		enterToSend: settings.enterToSend
	}

	const queueCapMessage =
		queueAtCap && queueMaxDepth !== null
			? `Queue is full (max ${queueMaxDepth}). Wait for a message to send first.`
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
			onRetry: retryQueueItem
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
			retryQueueItem
		]
	)

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
		activeToolCalls,
		spawnProgress,
		spawnStartTime,
		todos: streamingTodos,
		todosStartTime,
		executionStartedAt,
		spawnIsResearchMode,
		streamingThinking,
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
		lastFailedPrompt: viewError ? null : (lastFailedRequest?.mutation.message ?? null),
		onReconnectFailedPrompt: handleReconnectFailedPrompt,
		onReconnectNow: handleReconnectNow,
		scrollContainerRef,
		messagesEndRef,
		promptInputRef,
		restoreRequest: alertPrefillRequest,
		onRestoreConsumed: () => setAlertPrefillRequest(null),
		isScrollAttached,
		showScrollToBottom,
		scrollToBottom,
		handleSubmit: handleComposerSubmit,
		submitMode: queueOwnsComposer
			? { kind: 'queue', atCapacity: queueAtCap, capacityMessage: queueCapMessage }
			: { kind: 'direct' },
		queueSurface,
		quotaResetTime: rateLimitDetails?.resetTime ?? null,
		handleStopRequest,
		handleActionClick,
		onEditMessage: handleEditMessage,
		onBranchSwitch: handleBranchSwitch,
		isBranchSwitching: isSwitchingActiveLeaf,
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
					<Suspense fallback={<></>}>
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
										onDelete={deleteSession}
										onUpdateTitle={updateSessionTitle}
										isDeletingSession={isDeletingSession}
										isUpdatingTitle={isUpdatingTitle}
										shouldAnimate={shouldAnimateSidebar}
										onOpenSettings={settingsModalStore.show}
										hasCustomInstructions={settings.customInstructions.trim().length > 0}
										onBulkDelete={bulkDeleteSessions}
										onPinSession={pinSession}
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
								className={`llamaai-chat-panel relative isolate flex flex-1 flex-col overflow-hidden rounded-lg border border-ai-line bg-surface ${sidebarVisible && shouldAnimateSidebar ? 'lg:animate-[shrinkToRight_0.1s_ease-out]' : ''}`}
							>
								{!readOnly && !sidebarVisible ? (
									<ChatControls
										handleNewChat={handleNewChat}
										onOpenSettings={settingsModalStore.show}
										hasCustomInstructions={settings.customInstructions.trim().length > 0}
										sessionTitle={effectiveSessionTitle}
										canShare={!isSharedView && effectiveMessages.length > 0}
										onShare={() => openShareModal()}
									/>
								) : null}
								{!readOnly && !isSharedView && effectiveMessages.length > 0 ? (
									<button
										onClick={() => openShareModal()}
										data-umami-event="llamaai-share-modal-open"
										data-umami-event-source="header_controls"
										className="absolute top-2.5 right-2.5 z-10 hidden items-center gap-1.5 rounded-md border border-ai-line bg-surface px-3 py-1.5 text-xs font-medium text-ai-secondary transition-colors hover:bg-ai-surface-muted lg:flex"
									>
										<Icon name="share" height={14} width={14} />
										Share
									</button>
								) : null}
								{(isRouteSessionPending || restoringSessionId) && !hasMessages && !visibleError ? (
									<LoadingConversationState />
								) : !hasMessages && visibleError ? (
									<EmptyConversationErrorState
										message={visibleError}
										onRetry={
											isRouteSessionPending && routeSessionId
												? () => void handleSessionSelect(routeSessionId)
												: lastFailedRequest
													? handleReconnectFailedPrompt
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
								<aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto rounded-lg border border-ai-line bg-surface lg:ml-2 lg:flex">
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
									open={true}
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
								<Suspense fallback={<></>}>
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
	onShare
}: {
	handleNewChat: () => void
	onOpenSettings: () => void
	hasCustomInstructions: boolean
	sessionTitle: string | null
	canShare: boolean
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
							onClick={toggleSidebar}
							data-umami-event="llamaai-sidebar-toggle"
							data-umami-event-action="open"
							data-umami-event-source="collapsed_controls"
						/>
					}
					className="flex size-6 items-center justify-center gap-2 rounded-sm bg-brand/12 text-brand hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white"
				>
					<Icon name="panel-left-open" height={16} width={16} />
					<span className="sr-only">Open Chat History</span>
				</Tooltip>
				<Tooltip
					content="New Chat"
					render={<button onClick={handleNewChat} />}
					className="flex size-6 items-center justify-center gap-2 rounded-sm bg-brand text-ai-white hover:bg-brand focus-visible:bg-brand max-lg:ml-auto"
				>
					<Icon name="message-square-plus" height={16} width={16} />
					<span className="sr-only">New Chat</span>
				</Tooltip>
				{canShare ? (
					<button
						onClick={onShare}
						data-umami-event="llamaai-share-modal-open"
						data-umami-event-source="header_controls"
						className="flex h-6 items-center gap-1 rounded-sm bg-brand/12 px-2 text-[11px] text-brand transition-colors hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white lg:hidden"
					>
						<Icon name="share" height={12} width={12} />
						Share
					</button>
				) : null}
				{!isMobile ? (
					<Tooltip
						content={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
						render={
							<button
								onClick={toggleFullscreen}
								data-umami-event="llamaai-fullscreen-toggle"
								data-umami-event-action={isFullscreen ? 'exit' : 'enter'}
								data-umami-event-source="collapsed_controls"
							/>
						}
						className="flex size-6 items-center justify-center gap-2 rounded-sm bg-brand/12 text-brand hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white"
					>
						<Icon name={isFullscreen ? 'shrink' : 'expand'} height={16} width={16} />
						<span className="sr-only">{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
					</Tooltip>
				) : null}
			</nav>
			<Tooltip
				content="Settings"
				render={<button onClick={onOpenSettings} />}
				className="absolute bottom-2.5 left-2.5 z-10 flex size-6 items-center justify-center rounded-sm bg-brand/12 text-brand hover:bg-brand hover:text-ai-white focus-visible:bg-brand focus-visible:text-ai-white max-lg:hidden"
			>
				<div className="relative">
					<Icon name="settings" height={16} width={16} />
					{hasCustomInstructions ? (
						<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-ai-accent-blue-deep" />
					) : null}
				</div>
				<span className="sr-only">Settings</span>
			</Tooltip>
		</div>
	)
})

// Selection pill with the researcher-only "Add to article" action. Charts crossed
// by the selection are resolved against every message's chart artifacts by id.
function ArticleSelectionPopup({ messages, onSelect }: { messages: Message[]; onSelect: (text: string) => void }) {
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
