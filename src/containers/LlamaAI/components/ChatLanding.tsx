import * as Ariakit from '@ariakit/react'
import Router from 'next/router'
import { type RefObject, useCallback, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { CAPABILITIES } from '~/containers/LlamaAI/capabilities'
import { FreeUsageNote, getPhonePromptPlaceholder } from '~/containers/LlamaAI/components/FreeUsageNote'
import { OnboardingWalkthrough } from '~/containers/LlamaAI/components/OnboardingWalkthrough'
import { PromptInput } from '~/containers/LlamaAI/components/PromptInput'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { TipOrNotifyBanner } from '~/containers/LlamaAI/components/TipOrNotifyBanner'
import { useActiveTip } from '~/containers/LlamaAI/hooks/useLlamaAITip'
import type { OutgoingAttachment } from '~/containers/LlamaAI/mutationProtocol'
import type { AgenticAnswerMode, FactCheckedUsage, FreeUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { isSettingsTabId } from '~/containers/LlamaAI/utils/settingsIntent'
import { useLlamaAIWelcome } from '~/contexts/LocalStorage'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const FEATURED_KEYS = ['trade_thesis', 'x_data', 'tradfi', 'yields', 'onchain_analytics'] as const
const FEATURED_CAPABILITIES = FEATURED_KEYS.map((key) => CAPABILITIES.find((c) => c.key === key)).filter(
	(c): c is (typeof CAPABILITIES)[number] => c != null
)

export interface ChatLandingProps {
	draftScope: string
	readOnly: boolean
	isSharedView?: boolean
	title: string
	handleSubmit: (
		prompt: string,
		preResolvedEntities?: Array<{ term: string; slug: string; type?: string }>,
		images?: Array<OutgoingAttachment>,
		pageContext?: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string },
		isSuggestedQuestion?: boolean,
		entrySource?: string
	) => void | Promise<void> | boolean
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	handleStopRequest: () => void
	isStreaming: boolean
	isStopping?: boolean
	restoreRequest?: { key: number; text: string; entities?: Array<{ term: string; slug: string; type?: string }> } | null
	onRestoreConsumed?: () => void
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	researchUsage?: ResearchUsage | null
	factCheckedUsage?: FactCheckedUsage | null
	freeUsage?: FreeUsage | null
	onFactCheckedGated?: () => void
	onAttachmentsGated?: () => void
	onOpenAlerts: () => void
	isAlertsModalOpen: boolean
	quotedText?: string | null
	onClearQuotedText?: () => void
	enterToSend: boolean
}

export function ChatLanding({
	draftScope,
	readOnly,
	isSharedView = false,
	title,
	handleSubmit,
	promptInputRef,
	handleStopRequest,
	isStreaming,
	isStopping,
	restoreRequest = null,
	onRestoreConsumed,
	mode,
	setMode,
	researchUsage,
	factCheckedUsage,
	freeUsage,
	onFactCheckedGated,
	onAttachmentsGated,
	onOpenAlerts,
	isAlertsModalOpen,
	quotedText,
	onClearQuotedText,
	enterToSend
}: ChatLandingProps) {
	const { hasActiveSubscription } = useAuthContext()
	const [hasSeenWelcome, markWelcomeSeen] = useLlamaAIWelcome(hasActiveSubscription)
	const showWalkthrough = !readOnly && hasActiveSubscription && !hasSeenWelcome
	const { tip, markSeen, dismissTip, clickTip } = useActiveTip()
	const tipActions = useTipActions()
	const greetingTip = !readOnly && !isSharedView && hasSeenWelcome && tip?.placement === 'greeting' ? tip : null
	const showBanner = !readOnly && !isSharedView && hasSeenWelcome && !greetingTip

	const onGreetingCta = () => {
		if (!greetingTip || greetingTip.cta.kind === 'none') return
		void clickTip(greetingTip, greetingTip.cta.kind === 'link' ? 'link' : greetingTip.cta.action)
		if (greetingTip.cta.kind === 'link') {
			if (greetingTip.cta.external) window.open(greetingTip.cta.href, '_blank', 'noopener,noreferrer')
			else void Router.push(greetingTip.cta.href)
			return
		}
		switch (greetingTip.cta.action) {
			case 'open-settings': {
				const payload = greetingTip.cta.kind === 'action' ? greetingTip.cta.payload : undefined
				const tab = isSettingsTabId(payload?.tab) ? payload.tab : undefined
				tipActions.openSettingsModal?.(tab)
				break
			}
			case 'open-alerts':
				trackUmamiEvent('llamaai-alerts-open', { source: 'tip' })
				tipActions.openAlertsModal?.()
				break
			case 'open-research-mode':
				tipActions.toggleResearchMode?.()
				break
			case 'submit-prompt':
				if (greetingTip.cta.prompt) tipActions.submitPrompt?.(greetingTip.cta.prompt)
				break
		}
	}

	// Below lg the composer sits where the conversation's does: at the bottom, in thumb reach and just above an open
	// keyboard, with the same 10px inset, so the first send does not move it.
	return (
		<div className="llamaai-chat-width mx-auto flex h-full w-full flex-col gap-2.5 overflow-hidden px-2.5 pb-2.5">
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 lg:mt-25 lg:flex-none lg:justify-start">
				<img src="/assets/llamaai/llama-ai.svg" alt="LlamaAI" className="object-contain" width={64} height={77} />
				{greetingTip && greetingTip.cta.kind !== 'none' ? (
					<span className="inline-flex items-center gap-1.5 rounded-full border border-ai-gold/30 bg-ai-gold-tint px-2.5 py-1 label-xs tracking-wide text-ai-bronze uppercase">
						<Icon name="sparkles" height={14} width={14} />
						Suggested for you
					</span>
				) : null}
				{/* A greeting tip is shown by replacing the heading, so the heading records its impression. */}
				<h1 ref={greetingTip ? () => markSeen(greetingTip) : undefined} className="text-center heading-lg text-primary">
					{greetingTip ? greetingTip.title : title}
				</h1>
				{greetingTip && greetingTip.cta.kind !== 'none' ? (
					<div className="flex items-center gap-3 body-sm">
						<button
							type="button"
							onClick={onGreetingCta}
							className="group inline-flex items-center gap-1.5 font-medium text-ai-bronze not-disabled:not-aria-disabled:hover:text-ai-bronze-deep"
						>
							<span className="border-b border-ai-bronze-bright/0 pb-px group-hover:border-ai-bronze-bright/50">
								{greetingTip.cta.label}
							</span>
							<Icon name="arrow-right" height={14} width={14} />
						</button>
						<span className="h-3 w-px bg-surface-elevated-2" aria-hidden />
						<button
							type="button"
							onClick={() => void dismissTip(greetingTip)}
							className="text-tertiary not-disabled:not-aria-disabled:hover:text-primary"
						>
							Not now
						</button>
					</div>
				) : null}
				{showBanner ? (
					<div className="w-full">
						<TipOrNotifyBanner answerRunning={false} />
					</div>
				) : null}
			</div>
			{!readOnly ? (
				<>
					<div className="relative w-full">
						<PromptInput
							draftScope={draftScope}
							submitMode={{ kind: 'direct' }}
							handleSubmit={handleSubmit}
							promptInputRef={promptInputRef}
							isPending={isStreaming}
							handleStopRequest={handleStopRequest}
							isStreaming={isStreaming}
							isStopping={isStopping}
							restoreRequest={restoreRequest}
							onRestoreConsumed={onRestoreConsumed}
							placeholder="Ask LlamaAI&hellip; Type @ to add a protocol, chain or stablecoin, or $ to add a coin"
							shortPlaceholder={getPhonePromptPlaceholder(freeUsage)}
							mode={mode}
							setMode={setMode}
							researchUsage={researchUsage}
							factCheckedUsage={factCheckedUsage}
							onFactCheckedGated={onFactCheckedGated}
							onAttachmentsGated={onAttachmentsGated}
							onOpenAlerts={onOpenAlerts}
							quotedText={quotedText}
							onClearQuotedText={onClearQuotedText}
							enterToSend={enterToSend}
							walkthroughActive={showWalkthrough}
						/>
					</div>
					<FreeUsageNote usage={freeUsage} showBonus={false} className="-mt-1 px-4 lg:hidden" />
					<CapabilityRow promptInputRef={promptInputRef} onOpenAlerts={onOpenAlerts} />
				</>
			) : null}

			{showWalkthrough ? (
				<OnboardingWalkthrough
					isAlertsModalOpen={isAlertsModalOpen}
					mode={mode}
					setMode={setMode}
					handleSubmit={handleSubmit}
					promptInputRef={promptInputRef}
					onComplete={markWelcomeSeen}
				/>
			) : null}
		</div>
	)
}

function CapabilityRow({
	promptInputRef,
	onOpenAlerts
}: {
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	onOpenAlerts: () => void
}) {
	const rowRef = useRef<HTMLDivElement>(null)
	const getAnchorRect = useCallback(() => {
		const el = rowRef.current
		if (!el) return null
		const rect = el.getBoundingClientRect()
		return { x: rect.x + rect.width / 2, y: rect.bottom, width: 0, height: 0 }
	}, [])

	return (
		<div ref={rowRef} className="scrollbar-none shrink-0 overflow-x-auto pt-1 max-sm:hidden">
			<div className="mx-auto flex w-max gap-1.5">
				{FEATURED_CAPABILITIES.map((cap) => (
					<Capability key={cap.key} cap={cap} promptInputRef={promptInputRef} getAnchorRect={getAnchorRect} />
				))}
				<SetAlertChip onOpenAlerts={onOpenAlerts} />
			</div>
		</div>
	)
}

function SetAlertChip({ onOpenAlerts }: { onOpenAlerts: () => void }) {
	return (
		<Button
			type="button"
			size="md"
			onClick={() => {
				trackUmamiEvent('llamaai-alerts-open', { source: 'landing' })
				onOpenAlerts()
			}}
		>
			<Icon name="calendar-plus" height={14} width={14} className="text-warning" />
			Set an alert
		</Button>
	)
}

function Capability({
	cap,
	promptInputRef,
	getAnchorRect
}: {
	cap: (typeof FEATURED_CAPABILITIES)[number]
	promptInputRef: RefObject<HTMLTextAreaElement | null>
	getAnchorRect: () => { x: number; y: number; width: number; height: number } | null
}) {
	const isMobile = useMedia('(max-width: 640px)')
	const popoverStore = Ariakit.usePopoverStore()
	const open = Ariakit.useStoreState(popoverStore, 'open')

	const handlePromptClick = (prompt: string) => {
		trackUmamiEvent('llamaai-landing-prompt-click', {
			category: cap.key ?? 'unknown',
			prompt: prompt.slice(0, 100)
		})

		popoverStore.hide()

		const textarea = promptInputRef.current
		if (textarea) {
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
			nativeInputValueSetter?.call(textarea, prompt)
			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			requestAnimationFrame(() => textarea.focus())
		}
	}

	return (
		<Ariakit.PopoverProvider store={popoverStore}>
			<Ariakit.PopoverDisclosure
				onClick={() => trackUmamiEvent('llamaai-landing-capability-click', { category: cap.key })}
				render={<Button type="button" size="md" variant={open ? 'outline' : 'secondary'} />}
			>
				<Icon name={cap.icon} height={14} width={14} />
				{cap.name}
				{cap.badge ? (
					<span className="rounded-sm bg-brand-muted px-1 py-px label-xs tracking-wide text-link-on-tint uppercase">
						{cap.badge}
					</span>
				) : null}
			</Ariakit.PopoverDisclosure>
			<PopoverSurface
				variant="list"
				modal={isMobile}
				getAnchorRect={getAnchorRect}
				gutter={14}
				flip={false}
				dismiss="own"
				className="w-[min(calc(100vw-32px),42rem)] max-w-xl overflow-hidden"
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-subtle py-1 pr-2 pl-3">
					<Icon name={cap.icon} height={14} width={14} className="text-brand" />
					<Ariakit.PopoverHeading className="label-md text-primary">{cap.name}</Ariakit.PopoverHeading>
					<Ariakit.PopoverDismiss
						render={<Button type="button" variant="ghost" size="md" square className="ml-auto" />}
						aria-label={`Close ${cap.name} prompts`}
					>
						<Icon name="x" className="size-4" />
					</Ariakit.PopoverDismiss>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					{cap.prompts.map((prompt, i) => (
						<button
							key={`${cap.key}:${prompt}`}
							type="button"
							className={`${popoverMenuItemStyles} group w-full justify-between text-left ${
								i < cap.prompts.length - 1 ? 'border-b border-subtle' : ''
							}`}
							onClick={() => handlePromptClick(prompt)}
						>
							{prompt}
							<Icon
								name="chevron-right"
								height={14}
								width={14}
								className="shrink-0 text-tertiary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
							/>
						</button>
					))}
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
