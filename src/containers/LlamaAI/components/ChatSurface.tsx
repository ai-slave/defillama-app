import { useRef, type ReactNode } from 'react'
import { ChatLanding, type ChatLandingProps } from '~/containers/LlamaAI/components/ChatLanding'
import { ConversationView, type ConversationViewModel } from '~/containers/LlamaAI/components/ConversationView'
import { FileDropContext } from './FileDrop'

export interface LandingOverrideApi {
	handleSubmit: ChatLandingProps['handleSubmit']
	isStreaming: boolean
}

interface ChatSurfaceProps {
	showLanding: boolean
	animateLandingTransition: boolean
	animateConversationTransition: boolean
	landingOverride?: ((api: LandingOverrideApi) => ReactNode) | null
	landingProps: ChatLandingProps
	conversationViewModel: ConversationViewModel
	conversationKey: string
}

function renderLanding(landingOverride: ChatSurfaceProps['landingOverride'], landingProps: ChatLandingProps) {
	return landingOverride ? (
		landingOverride({ handleSubmit: landingProps.handleSubmit, isStreaming: landingProps.isStreaming })
	) : (
		<ChatLanding {...landingProps} />
	)
}

export function ChatSurface({
	showLanding,
	animateLandingTransition,
	animateConversationTransition,
	landingOverride,
	landingProps,
	conversationViewModel,
	conversationKey
}: ChatSurfaceProps) {
	// The exit copy must not bind the live composer ref: React nulls a shared ref when the
	// exit layer unmounts, detaching the still-mounted conversation composer (auto-grow,
	// focus, and combobox anchoring all silently break).
	const exitLandingPromptInputRef = useRef<HTMLTextAreaElement | null>(null)

	if (showLanding && !animateLandingTransition) {
		return renderLanding(landingOverride, landingProps)
	}

	return (
		<div className="relative flex flex-1 overflow-hidden">
			{animateLandingTransition ? (
				<div
					key="landing-exit"
					inert
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 motion-safe:animate-ai-landing-exit motion-reduce:opacity-0"
				>
					<FileDropContext.Provider value={null}>
						{renderLanding(landingOverride, { ...landingProps, promptInputRef: exitLandingPromptInputRef })}
					</FileDropContext.Provider>
				</div>
			) : null}
			<div
				key="conversation"
				className={
					animateLandingTransition
						? 'absolute inset-0 flex flex-col motion-safe:animate-ai-conversation-enter motion-reduce:animate-none'
						: 'flex flex-1 flex-col'
				}
			>
				<ConversationView
					key={conversationKey}
					viewModel={conversationViewModel}
					animateActiveExchange={animateLandingTransition ? false : animateConversationTransition}
				/>
			</div>
		</div>
	)
}
