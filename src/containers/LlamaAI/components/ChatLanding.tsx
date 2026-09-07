import * as Ariakit from '@ariakit/react'
import Router from 'next/router'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { CAPABILITIES } from '~/containers/LlamaAI/capabilities'
import { OnboardingWalkthrough } from '~/containers/LlamaAI/components/OnboardingWalkthrough'
import { PromptInput } from '~/containers/LlamaAI/components/PromptInput'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { TipOrNotifyBanner } from '~/containers/LlamaAI/components/TipOrNotifyBanner'
import { useActiveTip } from '~/containers/LlamaAI/hooks/useLlamaAITip'
import type { AgenticAnswerMode, FactCheckedUsage, ResearchUsage } from '~/containers/LlamaAI/types'
import { isSettingsTabId } from '~/containers/LlamaAI/utils/settingsIntent'
import { useLlamaAIWelcome } from '~/contexts/LocalStorage'
import { useMedia } from '~/hooks/useMedia'
import { Icon } from '~/ui/Icon'
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
		images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>,
		pageContext?: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string },
		isSuggestedQuestion?: boolean
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
	onFactCheckedGated?: () => void
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
	onFactCheckedGated,
	onOpenAlerts,
	isAlertsModalOpen,
	quotedText,
	onClearQuotedText,
	enterToSend
}: ChatLandingProps) {
	const { hasActiveSubscription } = useAuthContext()
	const [hasSeenWelcome, markWelcomeSeen] = useLlamaAIWelcome(hasActiveSubscription)
	const { tip, dismissTip, clickTip } = useActiveTip()
	const tipActions = useTipActions()
	const greetingTip = !readOnly && !isSharedView && hasSeenWelcome && tip?.placement === 'greeting' ? tip : null
	const showBanner = !readOnly && !isSharedView && hasSeenWelcome && !greetingTip

	useEffect(() => {
		if (readOnly || isSharedView || !hasSeenWelcome) return
		promptInputRef.current?.focus()
	}, [readOnly, isSharedView, hasSeenWelcome, promptInputRef])

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

	return (
		<div className="llamaai-chat-width mx-auto flex h-full w-full flex-col gap-2.5 overflow-hidden px-2.5">
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 lg:mt-25 lg:flex-none lg:justify-start">
				<img src="/assets/llamaai/llama-ai.svg" alt="LlamaAI" className="object-contain" width={64} height={77} />
				{greetingTip && greetingTip.cta.kind !== 'none' ? (
					<span className="bg-ai-bronze-bright/7.000000000000001 inline-flex items-center gap-1.5 rounded-full border border-ai-bronze-bright/30 px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] text-ai-bronze uppercase">
						<Icon name="sparkles" height={11} width={11} />
						Suggested for you
					</span>
				) : null}
				<h1 className="text-center text-2xl font-semibold">{greetingTip ? greetingTip.title : title}</h1>
				{greetingTip && greetingTip.cta.kind !== 'none' ? (
					<div className="flex items-center gap-3 text-[13px]">
						<button
							type="button"
							onClick={onGreetingCta}
							className="group inline-flex items-center gap-1.5 font-medium text-ai-bronze transition-colors hover:text-ai-bronze-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ai-bronze-bright/60"
						>
							<span className="border-b border-ai-bronze-bright/0 pb-px transition-colors duration-200 group-hover:border-ai-bronze-bright/50">
								{greetingTip.cta.label}
							</span>
							<Icon
								name="arrow-right"
								height={12}
								width={12}
								className="transition-transform duration-200 group-hover:translate-x-0.5"
							/>
						</button>
						<span className="h-3 w-px bg-ai-landing-muted/30" aria-hidden />
						<button
							type="button"
							onClick={() => void dismissTip(greetingTip)}
							className="text-ai-landing-muted/75 transition-colors hover:text-ai-landing-text-strong"
						>
							Not now
						</button>
					</div>
				) : null}
				{showBanner ? (
					<div className="w-full">
						<TipOrNotifyBanner />
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
							placeholder="Ask LlamaAI... Type @ to add a protocol, chain or stablecoin, or $ to add a coin"
							mode={mode}
							setMode={setMode}
							researchUsage={researchUsage}
							factCheckedUsage={factCheckedUsage}
							onFactCheckedGated={onFactCheckedGated}
							onOpenAlerts={onOpenAlerts}
							quotedText={quotedText}
							onClearQuotedText={onClearQuotedText}
							enterToSend={enterToSend}
							walkthroughActive={!hasSeenWelcome}
						/>
					</div>

					<CapabilityRow promptInputRef={promptInputRef} onOpenAlerts={onOpenAlerts} />
				</>
			) : null}

			{!readOnly && !hasSeenWelcome ? (
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
		<div ref={rowRef} className="flex flex-wrap justify-center gap-2 pt-1 max-sm:hidden">
			{FEATURED_CAPABILITIES.map((cap) => (
				<Capability key={cap.key} cap={cap} promptInputRef={promptInputRef} getAnchorRect={getAnchorRect} />
			))}
			<SetAlertChip onOpenAlerts={onOpenAlerts} />
		</div>
	)
}

function SetAlertChip({ onOpenAlerts }: { onOpenAlerts: () => void }) {
	return (
		<button
			type="button"
			onClick={() => {
				trackUmamiEvent('llamaai-alerts-open', { source: 'landing' })
				onOpenAlerts()
			}}
			className="flex items-center gap-1.5 rounded-lg border border-ai-landing-line bg-ai-hover px-3 py-1.5 text-[13px] font-[450] text-ai-landing-text duration-150 hover:border-ai-landing-line-strong hover:bg-ai-surface-muted hover:text-ai-landing-text-strong"
		>
			<Icon name="calendar-plus" height={14} width={14} className="text-ai-warning-bright" />
			Set an alert
		</button>
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
				className="flex items-center gap-1.5 rounded-lg border border-ai-landing-line bg-ai-hover px-3 py-1.5 text-[13px] font-[450] text-ai-landing-text duration-150 hover:border-ai-landing-line-strong hover:bg-ai-surface-muted hover:text-ai-landing-text-strong aria-expanded:border-ai-accent-blue/30 aria-expanded:bg-ai-accent-blue/15 aria-expanded:text-ai-accent-blue"
			>
				<Icon name={cap.icon} height={14} width={14} />
				{cap.name}
				{cap.badge ? (
					<span className="rounded-sm bg-ai-accent-blue/15 px-1 py-px text-[9px] font-semibold tracking-wide text-ai-accent-blue uppercase">
						{cap.badge}
					</span>
				) : null}
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				unmountOnHide
				hideOnInteractOutside
				modal={isMobile}
				portal
				getAnchorRect={getAnchorRect}
				gutter={14}
				flip={false}
				wrapperProps={{
					className: 'max-sm:fixed! max-sm:bottom-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'
				}}
				className="z-50 flex min-h-0 w-[min(calc(100vw-32px),42rem)] max-w-xl flex-col overflow-hidden rounded-xl border border-ai-landing-line bg-ai-surface-card shadow-ai-md max-sm:h-[calc(100dvh-80px)] max-sm:w-full max-sm:max-w-full max-sm:drawer max-sm:rounded-xl max-sm:rounded-b-none sm:max-h-[min(420px,60dvh)] lg:max-h-(--popover-available-height)"
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-ai-line px-4 py-2.5">
					<Icon name={cap.icon} height={14} width={14} className="text-ai-accent-blue-soft" />
					<Ariakit.PopoverHeading className="text-[13px] font-medium text-ai-landing-text-strong">
						{cap.name}
					</Ariakit.PopoverHeading>
					<Ariakit.PopoverDismiss
						className="ml-auto text-ai-landing-muted hover:text-ai-landing-text-strong"
						aria-label={`Close ${cap.name} prompts`}
					>
						<Icon name="x" height={14} width={14} />
					</Ariakit.PopoverDismiss>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					{cap.prompts.map((prompt, i) => (
						<button
							key={`${cap.key}:${prompt}`}
							type="button"
							className={`group flex w-full items-center justify-between px-4 py-3 text-left text-[13.5px] text-ai-landing-text hover:bg-ai-surface hover:text-ai-landing-text-strong ${
								i < cap.prompts.length - 1 ? 'border-b border-ai-line dark:border-ai-line-subtle' : ''
							}`}
							onClick={() => handlePromptClick(prompt)}
						>
							{prompt}
							<Icon
								name="chevron-right"
								height={14}
								width={14}
								className="shrink-0 text-ai-landing-muted opacity-0 group-hover:opacity-100 dark:text-current dark:opacity-0 dark:group-hover:opacity-60"
							/>
						</button>
					))}
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
