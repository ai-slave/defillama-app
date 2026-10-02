import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefCallback,
	type RefObject
} from 'react'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { ContextWarningBanner } from '~/containers/LlamaAI/components/ContextWarningBanner'
import { MessageBubble } from '~/containers/LlamaAI/components/messages/MessageBubble'
import { PromptInput, type PromptSubmitMode, type QueueSubmitResult } from '~/containers/LlamaAI/components/PromptInput'
import { QueueChips } from '~/containers/LlamaAI/components/QueueChips'
import { SectionsTOC } from '~/containers/LlamaAI/components/SectionsTOC'
import { AgentTimeline } from '~/containers/LlamaAI/components/status/AgentTimeline'
import { SpawnProgressCard, TodoChecklistPanel } from '~/containers/LlamaAI/components/status/StreamingStatus'
import { TipOrNotifyBanner } from '~/containers/LlamaAI/components/TipOrNotifyBanner'
import type { ContextWarningPayload } from '~/containers/LlamaAI/fetchAgenticResponse'
import type { QueueSurface } from '~/containers/LlamaAI/hooks/useChatQueueController'
import type { OutgoingAttachment } from '~/containers/LlamaAI/mutationProtocol'
import type { RecoveryState } from '~/containers/LlamaAI/streamState'
import type {
	AgentStep,
	AgenticAnswerMode,
	FactCheckedUsage,
	Message,
	ResearchUsage,
	SpawnAgentStatus,
	TodoItem
} from '~/containers/LlamaAI/types'
import { getScrollBehavior } from '~/containers/LlamaAI/utils/motion'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import styles from '../LlamaAIChat.module.css'
import { ComposerTray } from './ComposerTray'
import { ChatStatusLine } from './status/ChatStatusLine'

export interface ConversationViewModel {
	draftScope: string
	readOnly: boolean
	isSharedView?: boolean
	messages: Array<Message>
	sessionId: string | null
	isLlama: boolean
	isStreaming: boolean
	isQueuedUserMessagePending: boolean
	isStopping?: boolean
	steps: Array<AgentStep>
	spawnProgress: Map<string, SpawnAgentStatus>
	spawnStartTime: number
	todos: Array<TodoItem>
	todosStartTime: number
	executionStartedAt: number
	spawnIsResearchMode: boolean
	streamingDraft: Message | null
	duelSlot?: ReactNode
	isCompacting: boolean
	paginationState: {
		hasMore: boolean
		cursor: number | null
		isLoadingMore: boolean
		isLoadingNewer?: boolean
	}
	paginationError: string | null
	recovery: RecoveryState
	error: string | null
	onReconnectNow: () => void
	scrollContainerRef: RefObject<HTMLDivElement | null>
	/** Callback refs from useChatScroll: its listeners bind to the mounted elements through these. */
	attachScrollContainer: (node: HTMLDivElement | null) => void
	attachScrollContent: (node: HTMLDivElement | null) => void
	messagesEndRef: RefObject<HTMLDivElement | null>
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	restoreRequest?: {
		key: number
		text: string
		entities?: Array<{ term: string; slug: string; type?: string }>
	} | null
	onRestoreConsumed?: () => void
	isScrollAttached: boolean
	showScrollToBottom: boolean
	scrollToBottom: () => void
	syncScrollAfterLayout: () => void
	handleSubmit: (
		prompt: string,
		preResolvedEntities?: Array<{ term: string; slug: string; type?: string }>,
		images?: Array<OutgoingAttachment>,
		pageContext?: {
			entitySlug?: string
			entityType?: 'protocol' | 'chain' | 'page'
			route: string
		},
		isSuggestedQuestion?: boolean
	) => void | Promise<void> | boolean | QueueSubmitResult | Promise<QueueSubmitResult>
	submitMode: PromptSubmitMode
	queueSurface?: QueueSurface
	quotaResetTime?: string | null
	handleStopRequest: () => void
	handleActionClick: (message: string) => void
	onEditMessage?: (messageId: string, newText: string, original: Message) => Promise<void>
	onBranchSwitch?: (leafMessageId: string) => void
	isBranchSwitching?: boolean
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	researchUsage?: ResearchUsage | null
	factCheckedUsage?: FactCheckedUsage | null
	onFactCheckedGated?: () => void
	factCheckPhase?: 'drafting' | 'verifying' | 'finalizing' | null
	onOpenAlerts: () => void
	quotedText?: string | null
	onClearQuotedText?: () => void
	enterToSend: boolean
	onTableFullscreenOpen?: () => void
	onShare?: (messageId?: string) => void
	contextWarning?: ContextWarningPayload | null
	onDismissContextWarning?: () => void
	onStartNewChat?: () => void
}

interface ConversationViewProps {
	viewModel: ConversationViewModel
	animateActiveExchange: boolean
}

// Keep the active exchange tall enough that scrolling to its bottom places the
// submitted prompt slightly below the top edge on both mobile and desktop.
const ACTIVE_EXCHANGE_TOP_OFFSET_PX = 12

function getMessageTailSnapshot(messages: Array<Message>): readonly [Message | null, Message | null] {
	return [messages.at(-2) ?? null, messages.at(-1) ?? null] as const
}

function getMessageAnchorId(messageId?: string | null) {
	return messageId ? `msg-${messageId}` : undefined
}

function getMessageAnchorIdFromHash(hash: string) {
	return /^#msg-[A-Za-z0-9_-]+$/.test(hash) ? hash.slice(1) : null
}

type ActiveExchangeItem =
	| { type: 'message'; key: string; message: Message; isDraft?: boolean }
	| { type: 'live-status'; key: string }
	| { type: 'duel-slot'; key: string }

const ConversationMessageItem = memo(function ConversationMessageItem({
	message,
	nextUserMessage,
	onShare,
	sessionId,
	readOnly,
	isSharedView,
	isLlama,
	isLatest,
	onActionClick,
	onEditMessage,
	onBranchSwitch,
	isBranchSwitching,
	onTableFullscreenOpen,
	anchorId,
	anchorRef,
	enterToSend,
	isDraft = false
}: {
	message: Message
	nextUserMessage?: string
	onShare?: (messageId?: string) => void
	sessionId: string | null
	readOnly: boolean
	isSharedView?: boolean
	isLlama: boolean
	isLatest?: boolean
	onActionClick?: (message: string) => void
	onEditMessage?: (messageId: string, newText: string, original: Message) => Promise<void>
	onBranchSwitch?: (leafMessageId: string) => void
	isBranchSwitching?: boolean
	onTableFullscreenOpen?: () => void
	anchorId?: string
	anchorRef?: RefCallback<HTMLDivElement>
	enterToSend: boolean
	isDraft?: boolean
}) {
	const bubble = (
		<MessageBubble
			message={message}
			isDraft={isDraft}
			hideTimeline={isDraft}
			sessionId={sessionId}
			readOnly={readOnly}
			isSharedView={isSharedView}
			isLlama={isLlama}
			isLatest={isLatest}
			onActionClick={onActionClick}
			onEditMessage={onEditMessage}
			onBranchSwitch={onBranchSwitch}
			isBranchSwitching={isBranchSwitching}
			nextUserMessage={nextUserMessage}
			onShare={onShare}
			onTableFullscreenOpen={onTableFullscreenOpen}
			anchorId={anchorId}
			anchorRef={anchorRef}
			anchorClassName={anchorId ? styles.messageAnchor : undefined}
			enterToSend={enterToSend}
		/>
	)
	if (!message.answerLoadFailed) return bubble
	return (
		<>
			{bubble}
			<ChatStatusLine variant="error" align="start">
				Couldn't load this answer. Reload the conversation.
			</ChatStatusLine>
		</>
	)
})

const ConversationLiveStatus = memo(function ConversationLiveStatus({
	isStreaming,
	steps,
	spawnProgress,
	spawnStartTime,
	todos,
	todosStartTime,
	executionStartedAt,
	spawnIsResearchMode,
	streamingDraft,
	isCompacting,
	recovery,
	error,
	errorFollowsPrompt,
	onReconnectNow,
	isResearchMode,
	sessionId,
	readOnly,
	isLlama,
	onTableFullscreenOpen,
	factCheckPhase,
	renderStreamingDraft = true,
	duelSlot = null,
	isScrollAttached = true,
	hideActivity = false
}: {
	isStreaming: boolean
	steps: Array<AgentStep>
	spawnProgress: Map<string, SpawnAgentStatus>
	spawnStartTime: number
	todos: Array<TodoItem>
	todosStartTime: number
	executionStartedAt: number
	spawnIsResearchMode: boolean
	streamingDraft: Message | null
	isCompacting: boolean
	recovery: RecoveryState
	error: string | null
	/** The error is about the prompt above it (its answer never came), so it sits under that prompt. */
	errorFollowsPrompt: boolean
	onReconnectNow: () => void
	isResearchMode: boolean
	sessionId: string | null
	readOnly: boolean
	isLlama: boolean
	onTableFullscreenOpen?: () => void
	factCheckPhase?: 'drafting' | 'verifying' | 'finalizing' | null
	renderStreamingDraft?: boolean
	duelSlot?: ReactNode
	isScrollAttached?: boolean
	hideActivity?: boolean
}) {
	const hasTodos =
		!hideActivity &&
		shouldShowLiveTodoChecklist({
			todoCount: todos.length,
			isStreaming,
			recoveryStatus: recovery.status,
			activeToolCallCount: steps.filter((step) => step.kind === 'tool' && step.status === 'running').length,
			spawnProgressCount: spawnProgress.size,
			isCompacting
		})
	return (
		<>
			{hasTodos ? (
				<div style={{ overflowAnchor: 'none' }}>
					<TodoChecklistPanel todos={todos} startTime={todosStartTime} isLive />
				</div>
			) : null}
			{!hideActivity ? (
				<div style={{ overflowAnchor: 'none' }}>
					{spawnProgress.size > 0 && spawnIsResearchMode ? (
						<SpawnProgressCard
							agents={spawnProgress}
							startTime={spawnStartTime}
							isResearchMode
							recovery={recovery}
							onReconnect={onReconnectNow}
							indentForActiveTodo={hasTodos && todos.some((t) => t.status === 'in_progress')}
						/>
					) : (
						<AgentTimeline
							steps={steps}
							streaming={isStreaming}
							executionStartedAt={executionStartedAt}
							isCompacting={isCompacting}
							factCheckPhase={factCheckPhase}
							spawnProgress={spawnProgress.size > 0 ? spawnProgress : undefined}
							showToolDetails={isLlama}
							indent={hasTodos && todos.some((t) => t.status === 'in_progress')}
						/>
					)}
				</div>
			) : null}

			{!hideActivity ? (
				duelSlot ? (
					<div style={{ overflowAnchor: isScrollAttached ? 'none' : 'auto' }}>{duelSlot}</div>
				) : renderStreamingDraft && streamingDraft ? (
					<div style={{ overflowAnchor: 'none' }}>
						<MessageBubble
							key={streamingDraft.id || 'streaming-draft'}
							message={streamingDraft}
							sessionId={sessionId}
							isDraft
							hideTimeline
							readOnly={readOnly}
							isLlama={isLlama}
							onTableFullscreenOpen={onTableFullscreenOpen}
						/>
					</div>
				) : null
			) : null}

			{recovery.status === 'reconnecting' && (hideActivity || !(spawnProgress.size > 0 && spawnIsResearchMode)) ? (
				<ChatStatusLine
					variant="progress"
					align="start"
					action={
						<Button type="button" size="sm" onClick={onReconnectNow}>
							Reconnect now
						</Button>
					}
				>
					Reconnecting to the running {isResearchMode ? 'research session' : 'quick chat'} · attempt{' '}
					{Math.max(recovery.attemptCount, 1)}
				</ChatStatusLine>
			) : null}

			{recovery.status !== 'reconnecting' && error ? (
				<ChatStatusLine variant="error" align={errorFollowsPrompt ? 'end' : 'start'}>
					{error}
				</ChatStatusLine>
			) : null}
		</>
	)
})

export function shouldShowLiveTodoChecklist({
	todoCount,
	isStreaming,
	recoveryStatus,
	activeToolCallCount,
	spawnProgressCount,
	isCompacting
}: {
	todoCount: number
	isStreaming: boolean
	recoveryStatus: RecoveryState['status']
	activeToolCallCount: number
	spawnProgressCount: number
	isCompacting: boolean
}) {
	if (todoCount === 0) return false
	return (
		isStreaming ||
		recoveryStatus === 'reconnecting' ||
		activeToolCallCount > 0 ||
		spawnProgressCount > 0 ||
		isCompacting
	)
}

export function ConversationView({ viewModel, animateActiveExchange }: ConversationViewProps) {
	const {
		draftScope,
		readOnly,
		isSharedView = false,
		messages,
		sessionId,
		isLlama,
		isStreaming,
		isQueuedUserMessagePending,
		isStopping,
		steps,
		spawnProgress,
		spawnStartTime,
		todos,
		todosStartTime,
		executionStartedAt,
		spawnIsResearchMode,
		streamingDraft,
		duelSlot = null,
		isCompacting,
		paginationState,
		paginationError,
		recovery,
		error,
		onReconnectNow,
		scrollContainerRef,
		attachScrollContainer,
		attachScrollContent,
		messagesEndRef,
		promptInputRef,
		restoreRequest = null,
		onRestoreConsumed,
		isScrollAttached,
		showScrollToBottom,
		scrollToBottom,
		syncScrollAfterLayout,
		handleSubmit,
		submitMode,
		queueSurface,
		quotaResetTime,
		handleStopRequest,
		handleActionClick,
		onEditMessage,
		onBranchSwitch,
		isBranchSwitching,
		mode,
		setMode,
		researchUsage,
		factCheckedUsage,
		onFactCheckedGated,
		factCheckPhase,
		onOpenAlerts,
		quotedText,
		onClearQuotedText,
		enterToSend,
		onTableFullscreenOpen,
		onShare,
		contextWarning,
		onDismissContextWarning,
		onStartNewChat
	} = viewModel
	const isResearchMode = mode === 'research'
	const { isFullscreen, sidebarVisible } = useLlamaAIChrome()
	const isLiveExchange = isStreaming || recovery.status === 'reconnecting' || Boolean(error)
	const handledAnchorIdRef = useRef<string | null>(null)
	const highlightTimeoutRef = useRef<number | null>(null)
	const pendingScrollHighlightRef = useRef<(() => void) | null>(null)
	const activeExchangeRef = useRef<HTMLDivElement>(null)
	const targetAnchorId = typeof window !== 'undefined' ? getMessageAnchorIdFromHash(window.location.hash) : null
	const userMessageAnchorIds = useMemo(
		() =>
			messages
				.map((message) => (message.role === 'user' ? getMessageAnchorId(message.id) : undefined))
				.filter((anchorId): anchorId is string => Boolean(anchorId)),
		[messages]
	)

	// Stable identity: the keydown effect lists it, and it captures only a ref and the stylesheet.
	const highlightAnchorNode = useCallback((node: HTMLElement) => {
		node.classList.remove(styles.anchorHighlight)
		void node.offsetWidth
		node.classList.add(styles.anchorHighlight)
		if (highlightTimeoutRef.current !== null) {
			window.clearTimeout(highlightTimeoutRef.current)
		}
		highlightTimeoutRef.current = window.setTimeout(() => {
			node.classList.remove(styles.anchorHighlight)
			highlightTimeoutRef.current = null
		}, 2000)
	}, [])

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			// Shift+Arrow navigation is page-level only; editable controls keep their
			// native text-selection and caret movement behavior.
			if (
				!event.shiftKey ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				(event.key !== 'ArrowUp' && event.key !== 'ArrowDown') ||
				userMessageAnchorIds.length === 0
			) {
				return
			}

			const target = event.target instanceof HTMLElement ? event.target : null
			const editableTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				target instanceof HTMLButtonElement ||
				target?.isContentEditable ||
				!!target?.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"])')
			const isInsideConversation = !!target && !!scrollContainerRef.current?.contains(target)
			const isPageShortcut = target === document.body || (isInsideConversation && !editableTarget)
			if (!isPageShortcut) return

			const container = scrollContainerRef.current
			if (!container) return

			const containerTop = container.getBoundingClientRect().top
			const upThreshold = containerTop + 40
			const downThreshold = containerTop + 96
			const anchoredUserMessages = userMessageAnchorIds
				.map((anchorId) => {
					const node = document.getElementById(anchorId)
					return node ? { anchorId, node, top: node.getBoundingClientRect().top } : null
				})
				.filter((item): item is { anchorId: string; node: HTMLElement; top: number } => item != null)
			if (anchoredUserMessages.length === 0) return

			event.preventDefault()
			if (event.key === 'ArrowDown') {
				const nextMessage = anchoredUserMessages.find((item) => item.top > downThreshold)
				if (!nextMessage) {
					scrollToBottom()
					return
				}
				nextMessage.node.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' })
				highlightAnchorNode(nextMessage.node)
				return
			}

			const previousMessage = anchoredUserMessages.findLast((item) => item.top < upThreshold)
			const firstMessage = anchoredUserMessages[0]
			const isAtFirstRenderedMessage =
				previousMessage?.anchorId === firstMessage.anchorId && firstMessage.top >= containerTop - 8
			if (!previousMessage || isAtFirstRenderedMessage) {
				container.scrollTo({ top: 0, behavior: getScrollBehavior() })
				return
			}
			previousMessage.node.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' })
			highlightAnchorNode(previousMessage.node)
		}

		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [highlightAnchorNode, scrollContainerRef, scrollToBottom, userMessageAnchorIds])

	useEffect(() => {
		return () => {
			pendingScrollHighlightRef.current?.()
			if (highlightTimeoutRef.current !== null) {
				window.clearTimeout(highlightTimeoutRef.current)
				highlightTimeoutRef.current = null
			}
			handledAnchorIdRef.current = null
		}
	}, [])

	const getAnchorRef = (anchorId?: string): RefCallback<HTMLDivElement> | undefined => {
		if (!anchorId || anchorId !== targetAnchorId) return undefined

		return (node) => {
			if (!node || handledAnchorIdRef.current === anchorId) return
			if (window.location.hash !== `#${anchorId}` || node.id !== anchorId) return

			handledAnchorIdRef.current = anchorId
			requestAnimationFrame(() => {
				// Wait until smooth scrolling settles before flashing the target, with
				// a timeout for browsers that do not fire `scrollend`.
				const container = scrollContainerRef.current
				let fallbackTimer: number | null = null
				const applyHighlight = () => {
					if (fallbackTimer !== null) {
						window.clearTimeout(fallbackTimer)
					}
					container?.removeEventListener('scrollend', applyHighlight)
					pendingScrollHighlightRef.current = null
					highlightAnchorNode(node)
				}

				pendingScrollHighlightRef.current?.()
				pendingScrollHighlightRef.current = () => {
					if (fallbackTimer !== null) {
						window.clearTimeout(fallbackTimer)
					}
					container?.removeEventListener('scrollend', applyHighlight)
					pendingScrollHighlightRef.current = null
				}

				container?.addEventListener('scrollend', applyHighlight, { once: true })
				fallbackTimer = window.setTimeout(applyHighlight, 500)
				node.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' })
			})
		}
	}

	const [initialTailSnapshot] = useState(() => getMessageTailSnapshot(messages))
	const currentTailSnapshot = getMessageTailSnapshot(messages)
	const hasTailChangedSinceMount =
		currentTailSnapshot[0] !== initialTailSnapshot[0] || currentTailSnapshot[1] !== initialTailSnapshot[1]

	// The active exchange spacer only wraps the newest user->assistant pair so
	// submitted prompts stay near the top while the response streams below them.
	const lastUserIndex = (() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === 'user') return i
		}
		return -1
	})()

	// During streaming: the last message is the user prompt (response is a separate draft).
	// After streaming: keep the last user→response pair wrapped in the viewport-sized
	// spacer so the scroll position keeps the user message near the top of the viewport.
	const shouldSpaceLastExchange =
		!readOnly &&
		lastUserIndex >= 0 &&
		(isLiveExchange ? messages[messages.length - 1]?.role === 'user' : hasTailChangedSinceMount)

	const lastExchangeMessages = shouldSpaceLastExchange ? messages.slice(lastUserIndex) : []
	const activeExchangeItems: Array<ActiveExchangeItem> = (() => {
		if (!shouldSpaceLastExchange) return []
		const items: Array<ActiveExchangeItem> = lastExchangeMessages.map((message, i) => ({
			type: 'message',
			key: message.id || `exchange-${i}`,
			message
		}))
		if (isLiveExchange) {
			items.push({ type: 'live-status', key: 'live-status' })
			if (!duelSlot && streamingDraft) {
				items.push({
					type: 'message',
					key: streamingDraft.id || 'streaming-draft',
					message: streamingDraft,
					isDraft: true
				})
			}
		}
		if (duelSlot) {
			items.push({ type: 'duel-slot', key: 'duel-slot' })
		}
		return items
	})()
	const renderedMessages = shouldSpaceLastExchange ? messages.slice(0, lastUserIndex) : messages
	const canUseMessageControls = !readOnly && !isSharedView
	const errorFollowsPrompt = messages.at(-1)?.role === 'user'
	const showsContextWarning = !isSharedView && !!contextWarning && !!onStartNewChat && !!onDismissContextWarning
	// The tray says what blocks or shapes the next prompt; while it shows, a tip would only pile on above it.
	const hasComposerTray =
		submitMode.kind === 'blocked' ||
		(submitMode.kind === 'queue' && submitMode.atCapacity && !!submitMode.capacityMessage) ||
		showsContextWarning
	const scrollToBottomButton = (
		<Tooltip
			content="Scroll to bottom"
			render={<button type="button" onClick={scrollToBottom} />}
			className={`mx-auto flex size-8 items-center justify-center rounded-full border border-medium bg-overlay text-primary shadow-overlay-sm not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row ${showScrollToBottom ? 'pointer-events-auto' : 'pointer-events-none'}`}
		>
			<Icon name="arrow-down" height={16} width={16} />
			<span className="sr-only">Scroll to bottom</span>
		</Tooltip>
	)

	// Only the newest prompt and the newest response keep persistent controls. Older controls appear on hover,
	// or when the message is tapped or focused, so a phone without hover can still reach them.
	let lastAssistantId: string | null = null
	let lastUserId: string | null = null
	for (let i = messages.length - 1; i >= 0 && !(lastAssistantId && lastUserId); i--) {
		const { role, id } = messages[i]
		if (!id) continue
		if (role === 'assistant' && !lastAssistantId) lastAssistantId = id
		else if (role === 'user' && !lastUserId) lastUserId = id
	}

	useLayoutEffect(() => {
		const container = scrollContainerRef.current
		if (!container) return

		const updateActiveExchangeLayout = () => {
			const activeExchange = activeExchangeRef.current
			if (!activeExchange || !shouldSpaceLastExchange) return
			const paddingBottom = Number.parseFloat(window.getComputedStyle(container).paddingBottom) || 0
			activeExchange.style.minHeight = `${Math.max(0, container.clientHeight - paddingBottom - ACTIVE_EXCHANGE_TOP_OFFSET_PX)}px`
			syncScrollAfterLayout()
		}

		updateActiveExchangeLayout()
		const resizeObserver = new ResizeObserver(updateActiveExchangeLayout)
		resizeObserver.observe(container)
		return () => {
			resizeObserver.disconnect()
		}
	}, [scrollContainerRef, shouldSpaceLastExchange, syncScrollAfterLayout])

	return (
		<>
			<div
				ref={attachScrollContainer}
				// `both-edges` keeps the message column centered on the same axis as the composer below,
				// which sits outside this scroll container and never loses width to a classic scrollbar.
				className="relative flex-1 [scrollbar-gutter:stable_both-edges] overflow-y-auto p-2.5 max-lg:px-0"
				style={{
					// Browser anchoring can otherwise move scrollTop and look like an upward user gesture.
					overflowAnchor: isScrollAttached ? 'none' : 'auto'
				}}
			>
				<div
					ref={attachScrollContent}
					className={`relative mx-auto flex ${isFullscreen ? 'max-w-[80rem] justify-center' : 'llamaai-chat-width w-full flex-col'}`}
				>
					{isFullscreen && !sidebarVisible ? (
						<SectionsTOC messages={messages} scrollContainerRef={scrollContainerRef} />
					) : null}
					<div className={isFullscreen ? 'llamaai-chat-width flex w-full flex-col' : 'contents'}>
						<div className="flex w-full flex-col gap-2 px-2">
							<div className="flex flex-col gap-4">
								{paginationState.isLoadingMore ? (
									<div role="status" aria-live="polite" className="flex justify-center py-2">
										<LoadingIndicator label="Loading older messages" />
									</div>
								) : null}

								{paginationError ? (
									<ChatStatusLine variant="error" align="start">
										{paginationError}
									</ChatStatusLine>
								) : null}

								{renderedMessages.map((message, index) => {
									const nextMessage = messages[index + 1]
									const nextUserMessage = nextMessage?.role === 'user' ? nextMessage.content : undefined

									return (
										<ConversationMessageItem
											key={message.id || `msg-${index}`}
											message={message}
											nextUserMessage={nextUserMessage}
											onShare={onShare}
											sessionId={sessionId}
											readOnly={readOnly}
											isSharedView={isSharedView}
											isLlama={isLlama}
											isLatest={message.id === (message.role === 'user' ? lastUserId : lastAssistantId)}
											onActionClick={!readOnly && !isStreaming ? handleActionClick : undefined}
											onEditMessage={canUseMessageControls ? onEditMessage : undefined}
											onBranchSwitch={canUseMessageControls && !isStreaming ? onBranchSwitch : undefined}
											isBranchSwitching={isBranchSwitching}
											onTableFullscreenOpen={onTableFullscreenOpen}
											anchorId={getMessageAnchorId(message.id)}
											anchorRef={getAnchorRef(getMessageAnchorId(message.id))}
											enterToSend={enterToSend}
										/>
									)
								})}

								{paginationState.isLoadingNewer ? (
									<div className="flex justify-center py-2">
										<p className="m-0 text-xs text-tertiary">Loading newer messages&hellip;</p>
									</div>
								) : null}

								{shouldSpaceLastExchange ? (
									<div
										ref={activeExchangeRef}
										className={`flex flex-col gap-2.5 ${
											animateActiveExchange && isLiveExchange ? 'motion-safe:animate-ai-exchange-enter' : ''
										}`}
									>
										{activeExchangeItems.map((item) => {
											if (item.type === 'duel-slot') {
												return (
													<div key={item.key} style={{ overflowAnchor: isScrollAttached ? 'none' : 'auto' }}>
														{duelSlot}
													</div>
												)
											}
											if (item.type === 'live-status') {
												return (
													<ConversationLiveStatus
														key={item.key}
														isStreaming={isStreaming}
														steps={steps}
														spawnProgress={spawnProgress}
														spawnStartTime={spawnStartTime}
														todos={todos}
														todosStartTime={todosStartTime}
														executionStartedAt={executionStartedAt}
														spawnIsResearchMode={spawnIsResearchMode}
														streamingDraft={streamingDraft}
														isCompacting={isCompacting}
														recovery={recovery}
														error={error}
														errorFollowsPrompt={errorFollowsPrompt}
														onReconnectNow={onReconnectNow}
														isResearchMode={isResearchMode}
														sessionId={sessionId}
														readOnly={readOnly}
														isLlama={isLlama}
														onTableFullscreenOpen={onTableFullscreenOpen}
														renderStreamingDraft={false}
														factCheckPhase={factCheckPhase}
														hideActivity={isQueuedUserMessagePending}
													/>
												)
											}
											const message = item.message
											return (
												<ConversationMessageItem
													key={item.key}
													message={message}
													isDraft={item.isDraft}
													onShare={onShare}
													sessionId={sessionId}
													readOnly={readOnly}
													isSharedView={isSharedView}
													isLlama={isLlama}
													isLatest={
														!item.isDraft && message.id === (message.role === 'user' ? lastUserId : lastAssistantId)
													}
													onActionClick={!item.isDraft && !readOnly && !isStreaming ? handleActionClick : undefined}
													onEditMessage={!item.isDraft && canUseMessageControls ? onEditMessage : undefined}
													onBranchSwitch={
														!item.isDraft && canUseMessageControls && !isStreaming ? onBranchSwitch : undefined
													}
													isBranchSwitching={isBranchSwitching}
													onTableFullscreenOpen={onTableFullscreenOpen}
													anchorId={!item.isDraft ? getMessageAnchorId(message.id) : undefined}
													anchorRef={!item.isDraft ? getAnchorRef(getMessageAnchorId(message.id)) : undefined}
													enterToSend={enterToSend}
												/>
											)
										})}
									</div>
								) : (
									<ConversationLiveStatus
										isStreaming={isStreaming}
										steps={steps}
										spawnProgress={spawnProgress}
										spawnStartTime={spawnStartTime}
										todos={todos}
										todosStartTime={todosStartTime}
										executionStartedAt={executionStartedAt}
										spawnIsResearchMode={spawnIsResearchMode}
										streamingDraft={streamingDraft}
										isCompacting={isCompacting}
										recovery={recovery}
										error={error}
										errorFollowsPrompt={errorFollowsPrompt}
										onReconnectNow={onReconnectNow}
										isResearchMode={isResearchMode}
										sessionId={sessionId}
										readOnly={readOnly}
										isLlama={isLlama}
										onTableFullscreenOpen={onTableFullscreenOpen}
										factCheckPhase={factCheckPhase}
										hideActivity={isQueuedUserMessagePending}
										duelSlot={duelSlot}
										isScrollAttached={isScrollAttached}
									/>
								)}
							</div>
						</div>
						<div ref={messagesEndRef} />
					</div>
				</div>
			</div>

			{readOnly ? (
				<div
					className={`pointer-events-none sticky bottom-8 z-10 mx-auto -mb-2 ${showScrollToBottom ? 'opacity-100' : 'opacity-0'}`}
				>
					{scrollToBottomButton}
				</div>
			) : null}

			{!readOnly ? (
				// The 10px side inset comes off the width instead of padding so the shared column
				// max-width still applies to the composer itself and matches the message column.
				<div className="llamaai-chat-width relative mx-auto flex w-[calc(100%-1.25rem)] flex-col gap-2 pb-2.5">
					<div className="pointer-events-none absolute -top-8 right-0 left-0 h-8 bg-linear-to-b from-transparent to-surface" />
					{/* Anchored to the composer's top edge, so a taller composer (a notice, queued prompts, a quote,
					    several lines of text) carries the scroll button and the tip up with it. */}
					<div className="pointer-events-none absolute right-0 bottom-[calc(100%+8px)] left-0 z-20 flex flex-col items-center gap-2">
						<div className={showScrollToBottom ? 'opacity-100' : 'opacity-0'}>{scrollToBottomButton}</div>
						{!isSharedView && !hasComposerTray ? (
							<div className="pointer-events-auto w-full">
								<TipOrNotifyBanner
									answerRunning={isStreaming}
									premiumResponseId={
										!isStreaming && Number(messages.at(-1)?.messageMetadata?.x402CostUsd ?? 0) > 0
											? messages.at(-1)?.id
											: undefined
									}
								/>
							</div>
						) : null}
					</div>
					{queueSurface && queueSurface.rows.length > 0 ? (
						<QueueChips
							key={sessionId}
							surface={queueSurface}
							quotaResetTime={quotaResetTime}
							promptInputRef={promptInputRef}
						/>
					) : null}
					{/* One tray at a time, most urgent first: it explains why sending is blocked or what to do next. */}
					{submitMode.kind === 'blocked' ? (
						<ComposerTray
							tone="error"
							actions={
								<>
									<Button type="button" size="sm" onClick={submitMode.failure.onActivate}>
										{submitMode.failure.label}
									</Button>
									{submitMode.failure.onDiscard ? (
										<Button type="button" size="sm" variant="ghost" onClick={submitMode.failure.onDiscard}>
											Discard
										</Button>
									) : null}
								</>
							}
						>
							{submitMode.failure.notice}
						</ComposerTray>
					) : submitMode.kind === 'queue' && submitMode.atCapacity && submitMode.capacityMessage ? (
						<ComposerTray tone="warning">{submitMode.capacityMessage}</ComposerTray>
					) : showsContextWarning && contextWarning && onStartNewChat && onDismissContextWarning ? (
						<ContextWarningBanner
							warning={contextWarning}
							onStartNewChat={onStartNewChat}
							onDismiss={onDismissContextWarning}
						/>
					) : null}
					<PromptInput
						draftScope={draftScope}
						submitMode={submitMode}
						handleSubmit={handleSubmit}
						promptInputRef={promptInputRef}
						isPending={isStreaming}
						handleStopRequest={handleStopRequest}
						isStreaming={isStreaming}
						isStopping={isStopping}
						restoreRequest={restoreRequest}
						onRestoreConsumed={onRestoreConsumed}
						placeholder="Reply to LlamaAI&hellip; Type @ to add a protocol, chain or stablecoin, or $ to add a coin"
						shortPlaceholder="Reply to LlamaAI&hellip;"
						mode={mode}
						setMode={setMode}
						researchUsage={researchUsage}
						factCheckedUsage={factCheckedUsage}
						onFactCheckedGated={onFactCheckedGated}
						onOpenAlerts={onOpenAlerts}
						quotedText={quotedText}
						onClearQuotedText={onClearQuotedText}
						enterToSend={enterToSend}
					/>
				</div>
			) : null}
		</>
	)
}

export function LoadingConversationState() {
	return (
		<div role="status" aria-live="polite" className="flex flex-1 items-center justify-center">
			<LoadingIndicator />
		</div>
	)
}

export function EmptyConversationErrorState({
	message,
	onRetry,
	onNewChat
}: {
	message: string
	onRetry?: () => void
	onNewChat: () => void
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2">
			<p role="alert" className="text-sm text-error">
				{message}
			</p>
			<div className="flex items-center gap-2">
				{onRetry ? (
					<Button type="button" size="md" onClick={onRetry}>
						Retry
					</Button>
				) : null}
				<Button type="button" size="md" variant="ghost" onClick={onNewChat}>
					Start a new chat
				</Button>
			</div>
		</div>
	)
}
