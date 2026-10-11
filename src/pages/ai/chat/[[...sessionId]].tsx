import { useRouter } from 'next/router'
import { type ComponentProps, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { ChatControls } from '~/containers/LlamaAI'
import { chatFrameStyles, LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import { ChatLanding, type ChatLandingProps } from '~/containers/LlamaAI/components/ChatLanding'
import { DeepLinkPromptModal } from '~/containers/LlamaAI/components/DeepLinkPromptModal'
import { AgenticSidebar } from '~/containers/LlamaAI/components/sidebar/AgenticSidebar'
import { useSidebarVisibility } from '~/containers/LlamaAI/hooks/useSidebarVisibility'
import { LlamaAIShell } from '~/containers/LlamaAI/LlamaAIShell'
import {
	clearPendingPrompt,
	setPendingEntrySource,
	setPendingMode,
	setPendingPageContext,
	setPendingPrompt,
	setPendingSuggestedFlag
} from '~/containers/LlamaAI/pendingPrompt'
import type { AgenticAnswerMode } from '~/containers/LlamaAI/types'
import { useQuestionSignIn } from '~/containers/LlamaAI/useQuestionSignIn'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EmptyState } from '~/ui/Status'

function LlamaAIPage() {
	const { user, loaders } = useAuthContext()
	// Signed in, the shell renders the chat itself; this page only adds the signed-out chat.
	if (loaders.userLoading || user) return null
	return <SignedOutChat />
}

function SignedOutChat() {
	const router = useRouter()
	const signIn = useQuestionSignIn()
	const promptInputRef = useRef<HTMLTextAreaElement>(null)
	const [mode, setMode] = useState<AgenticAnswerMode>('quick')
	const { sidebarVisible, toggleSidebar, hideSidebar, isFullscreen, fullscreenLocked, toggleFullscreen } =
		useSidebarVisibility()
	const promptParam = typeof router.query.prompt === 'string' ? router.query.prompt.trim() : ''
	const isSession = Array.isArray(router.query.sessionId) && router.query.sessionId.length === 1
	const cleanUrl = router.asPath.split(/[?#]/)[0]

	// A session link's ?prompt and ?shareToken stay in the URL, through sign-in too: the chat removes them once it sends them.

	const askToSignIn = (question: string | null) => {
		setSignupSource('llamaai-chat')
		signIn.open(question)
	}

	const holdForSignIn: ChatLandingProps['handleSubmit'] = (
		prompt,
		_entities,
		_images,
		pageContext,
		isSuggestedQuestion,
		entrySource
	) => {
		const question = prompt.trim()
		if (!question) return false
		clearPendingPrompt()
		setPendingPrompt(question)
		if (isSuggestedQuestion) setPendingSuggestedFlag()
		setPendingEntrySource(entrySource ?? 'chat')
		setPendingPageContext(pageContext ?? null)
		if (mode !== 'quick') setPendingMode(mode)
		askToSignIn(question)
		return false
	}

	const sidebarProps: ComponentProps<typeof AgenticSidebar> = {
		sessions: [],
		isLoading: false,
		currentSessionId: null,
		restoringSessionId: null,
		onSessionSelect: () => {},
		onNewChat: () => promptInputRef.current?.focus(),
		onDelete: async () => {},
		onOpenSettings: () => askToSignIn(null),
		onOpenAlerts: () => askToSignIn(null),
		emptyHistoryText: 'Sign in to see your chats'
	}

	const handleConfirmDeepLinkPrompt = () => {
		if (!promptParam) return
		setPendingPrompt(promptParam)
		setPendingEntrySource(typeof router.query.utm_source === 'string' ? router.query.utm_source : 'deep-link')
		void router.replace(cleanUrl, undefined, { shallow: true, scroll: false })
		askToSignIn(promptParam)
	}

	const handleCloseDeepLinkPrompt = () => {
		void router.replace(cleanUrl, undefined, { shallow: true, scroll: false })
	}

	return (
		<>
			{isSession ? (
				<EmptyState
					size="lg"
					icon="message-square"
					title="This chat needs an account"
					headingAs="h1"
					actions={
						<Button size="md" variant="primary" onClick={() => askToSignIn(null)}>
							Sign in
						</Button>
					}
				>
					Sign in to open chats saved to your account.
				</EmptyState>
			) : (
				<LlamaAIChromeContext.Provider
					value={{
						toggleSidebar,
						hideSidebar,
						toggleFullscreen,
						isFullscreen,
						fullscreenLocked,
						sidebarVisible,
						toggleDashboardPanel: () => {},
						isDashboardPanelOpen: false
					}}
				>
					<div className={chatFrameStyles}>
						{sidebarVisible ? (
							<>
								<AgenticSidebar {...sidebarProps} />
								<div className="flex min-h-11 lg:hidden" />
							</>
						) : (
							<AgenticSidebar {...sidebarProps} folded />
						)}
						<Card padding="none" className="relative isolate flex flex-1 flex-col overflow-hidden">
							{!sidebarVisible ? (
								<ChatControls
									handleNewChat={() => promptInputRef.current?.focus()}
									sessionTitle={null}
									canShare={false}
									isSessionSaved={false}
									onShare={() => {}}
								/>
							) : null}
							<ChatLanding
								draftScope="signed-out"
								readOnly={false}
								title="What can I help you with?"
								handleSubmit={holdForSignIn}
								promptInputRef={promptInputRef}
								handleStopRequest={() => {}}
								isStreaming={false}
								mode={mode}
								setMode={setMode}
								onAttachmentsGated={() => askToSignIn(null)}
								isAlertsModalOpen={false}
								enterToSend
								holdWalkthrough={!isSession && !!promptParam}
							/>
						</Card>
					</div>
				</LlamaAIChromeContext.Provider>
			)}
			<SignInModal {...signIn.dialogProps} />
			<DeepLinkPromptModal
				isOpen={!isSession && !!promptParam}
				prompt={promptParam}
				onClose={handleCloseDeepLinkPrompt}
				onConfirm={handleConfirmDeepLinkPrompt}
				promptInputRef={promptInputRef}
			/>
		</>
	)
}

LlamaAIPage.getLayout = LlamaAIShell.getLayout

export default LlamaAIPage
