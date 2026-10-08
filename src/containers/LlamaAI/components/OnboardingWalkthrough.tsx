import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { AgenticAnswerMode } from '~/containers/LlamaAI/types'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { catchLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { getExperimentVariant } from '~/utils/analytics/experiment'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { ChatLandingProps } from './ChatLanding'

const CAPABILITY_BADGES = [
	['bar-chart-2', 'Charts'],
	['file-text', 'Reports'],
	['trending-up', 'Forecasts'],
	['link', 'On-chain'],
	['calendar', 'Alerts']
] as const

const ONBOARDING_PROMPTS = [
	{
		label: 'Check if a protocol is safe',
		prompt: 'Is it safe to deposit into Aave on Ethereum? Analyze the risks.',
		icon: 'flag' as const
	},
	{
		label: 'Where is capital flowing?',
		prompt: 'Where is capital flowing in DeFi this week? Show me the biggest TVL changes.',
		icon: 'trending-up' as const
	},
	{
		label: 'Explain a market move',
		prompt: 'What caused the biggest TVL changes in the last 24 hours?',
		icon: 'activity' as const
	},
	{
		label: 'Build a yield strategy',
		prompt: 'Build me a risk-adjusted yield strategy for 10 ETH across L2s.',
		icon: 'bar-chart-2' as const
	}
]

type Step =
	| 'intro'
	| 'explore'
	| 'alerts'
	| 'upload'
	| 'research'
	| 'mobile-upload'
	| 'mobile-research'
	| 'mobile-explore'
	| 'prompts'

const DESKTOP_STEPS: Array<Step> = ['intro', 'explore', 'alerts', 'upload', 'research', 'prompts']
// Below lg the sidebar is a closed drawer whose folded rail stays in the DOM hidden, so the alerts step is left out.
const TABLET_STEPS: Array<Step> = ['intro', 'explore', 'upload', 'research', 'prompts']
const MOBILE_STEPS: Array<Step> = ['intro', 'mobile-upload', 'mobile-explore', 'mobile-research', 'prompts']

// Variant B: short walkthrough (intro → research → prompts)
const DESKTOP_STEPS_SHORT: Array<Step> = ['intro', 'research', 'prompts']
const MOBILE_STEPS_SHORT: Array<Step> = ['intro', 'mobile-research', 'prompts']

const MOBILE_DRAWER_STEPS = new Set<Step>(['mobile-upload', 'mobile-research', 'mobile-explore'])
const RESEARCH_STEPS = new Set<Step>(['research', 'mobile-research'])

interface SpotlightConfig {
	selectors: Array<string>
	title: string
	description: string
	icon: 'layout-grid' | 'calendar-plus' | 'image-plus' | 'search' | 'plus'
	tone: 'brand' | 'warning' | 'success'
	placement: 'top' | 'right'
}

const SPOTLIGHT_CONFIGS: Partial<Record<Step, SpotlightConfig>> = {
	explore: {
		selectors: ['[data-walkthrough="explore-button"]'],
		title: 'Explore',
		description:
			'Not sure what to ask? Browse here to see everything LlamaAI can do — yields, analytics, trade theses, on-chain, and more.',
		icon: 'layout-grid',
		tone: 'brand',
		placement: 'top'
	},
	alerts: {
		selectors: ['[data-walkthrough="alerts-item"]'],
		title: 'Scheduled alerts',
		description:
			'Ask LlamaAI to create alerts for you — daily price checks, portfolio monitors, custom data alerts. Manage them here.',
		icon: 'calendar-plus',
		tone: 'warning',
		placement: 'right'
	},
	upload: {
		selectors: ['[data-walkthrough="image-upload"]'],
		title: 'File upload',
		description: 'Upload images, PDFs, or CSVs and ask LlamaAI to analyze them — charts, reports, datasets, anything.',
		icon: 'image-plus',
		tone: 'success',
		placement: 'top'
	},
	research: {
		selectors: ['[data-walkthrough="mode-toggle"]'],
		title: 'Need deeper answers?',
		description: '', // Dynamic — set at render time based on isTrial
		icon: 'search',
		tone: 'brand',
		placement: 'top'
	},
	'mobile-upload': {
		selectors: ['[data-walkthrough="mobile-upload-item"]'],
		title: 'File upload',
		description: 'Upload images, PDFs, or CSVs and ask LlamaAI to analyze them — charts, reports, datasets, anything.',
		icon: 'image-plus',
		tone: 'success',
		placement: 'top'
	},
	'mobile-research': {
		selectors: ['[data-walkthrough="mobile-research-item"]'],
		title: 'Need deeper answers?',
		description: '', // Dynamic — set at render time based on isTrial
		icon: 'search',
		tone: 'brand',
		placement: 'top'
	},
	'mobile-explore': {
		selectors: ['[data-walkthrough="mobile-explore-item"]'],
		title: 'Explore',
		description:
			'Not sure what to ask? Browse here to see everything LlamaAI can do — yields, analytics, trade theses, on-chain, and more.',
		icon: 'layout-grid',
		tone: 'brand',
		placement: 'top'
	}
}

// Spotlight hues as theme colours: the glow, hairline, chip, and icon all derive from one variable.
const TONE_VAR = {
	brand: 'var(--color-brand)',
	warning: 'var(--color-warning)',
	success: 'var(--color-success)'
} as const
const TONE_TEXT = { brand: 'text-link', warning: 'text-warning', success: 'text-success' } as const

interface OnboardingWalkthroughProps {
	isAlertsModalOpen: boolean
	mode: AgenticAnswerMode
	setMode: (mode: AgenticAnswerMode) => void
	handleSubmit: ChatLandingProps['handleSubmit']
	promptInputRef: ChatLandingProps['promptInputRef']
	onComplete: () => void
}

export function OnboardingWalkthrough({
	isAlertsModalOpen,
	mode,
	setMode,
	handleSubmit,
	promptInputRef,
	onComplete
}: OnboardingWalkthroughProps) {
	const isResearchMode = mode === 'research'
	const [step, setStep] = useState<Step>('intro')
	const [spotlight, setSpotlight] = useState<{ step: Step; rect: DOMRect; expanded: boolean } | null>(null)
	const isMobile = useMedia('(max-width: 639px)')
	const isBelowLg = useMedia('(max-width: 1023px)')

	// A/B experiment: full steps (A) vs short steps (B)
	const { user, isTrial, hasActiveSubscription } = useAuthContext()
	const userId = user?.id ? String(user.id) : null
	const variant = userId ? getExperimentVariant('walkthrough-steps-v1', userId) : 'A'

	// Track experiment assignment once
	useEffect(() => {
		trackUmamiEvent('llamaai-walkthrough-assigned', { variant })
	}, [variant])

	const steps =
		variant === 'B'
			? isMobile
				? MOBILE_STEPS_SHORT
				: DESKTOP_STEPS_SHORT
			: isMobile
				? MOBILE_STEPS
				: isBelowLg
					? TABLET_STEPS
					: DESKTOP_STEPS
	const currentStep = RESEARCH_STEPS.has(step) && isResearchMode ? 'prompts' : step
	const spotlightRect = spotlight?.step === currentStep ? spotlight.rect : null
	const targetExpanded = spotlight?.step === currentStep && spotlight.expanded
	const config = SPOTLIGHT_CONFIGS[currentStep]
	const firstSpotlightStep = steps.find((candidate) => SPOTLIGHT_CONFIGS[candidate]) ?? null
	const isFirstSpotlight = currentStep === firstSpotlightStep

	const tapOrClick = isMobile ? 'Tap' : 'Click'
	const researchDescription = !hasActiveSubscription
		? `In-depth reports with analysis, charts, and citations. Free mode includes 1 report every 14 days. ${tapOrClick} below.`
		: isTrial
			? `In-depth reports with analysis, charts, and citations. You have 3 free queries to try. ${tapOrClick} below.`
			: `In-depth reports with analysis, charts, and citations. You get 5 per day. ${tapOrClick} below.`

	// Find and measure spotlight target(s)
	useEffect(() => {
		if (!config || isAlertsModalOpen) return

		const updateRect = () => {
			const rects: Array<DOMRect> = []
			let expanded = false
			for (const sel of config.selectors) {
				const el = document.querySelector(sel)
				if (el) {
					rects.push(el.getBoundingClientRect())
					expanded = expanded || el.getAttribute('aria-expanded') === 'true'
				}
			}
			if (rects.length === 0) return

			// Merge all rects into one bounding box
			const left = Math.min(...rects.map((r) => r.left))
			const top = Math.min(...rects.map((r) => r.top))
			const right = Math.max(...rects.map((r) => r.right))
			const bottom = Math.max(...rects.map((r) => r.bottom))
			setSpotlight({ step: currentStep, rect: new DOMRect(left, top, right - left, bottom - top), expanded })
		}

		// rAF-guarded version to coalesce rapid scroll/resize events
		let rafId = 0
		const debouncedUpdateRect = () => {
			if (rafId) cancelAnimationFrame(rafId)
			rafId = requestAnimationFrame(updateRect)
		}

		// If the drawer is about to open for this step, wait for its animation.
		// Otherwise measure on the next frame (element already in the DOM).
		const drawerButton = document.querySelector<HTMLElement>('[data-walkthrough="mobile-tools-button"]')
		const drawerOpening = MOBILE_DRAWER_STEPS.has(currentStep) && drawerButton?.getAttribute('aria-expanded') !== 'true'
		const initialDelay = drawerOpening ? 400 : 0

		const observer = new MutationObserver(debouncedUpdateRect)
		const timer = setTimeout(() => {
			debouncedUpdateRect()
			for (const selector of config.selectors) {
				const target = document.querySelector(selector)
				if (target) observer.observe(target, { attributes: true, attributeFilter: ['aria-expanded'] })
			}
		}, initialDelay)

		window.addEventListener('resize', debouncedUpdateRect)
		window.addEventListener('scroll', debouncedUpdateRect, true)
		return () => {
			clearTimeout(timer)
			observer.disconnect()
			if (rafId) cancelAnimationFrame(rafId)
			window.removeEventListener('resize', debouncedUpdateRect)
			window.removeEventListener('scroll', debouncedUpdateRect, true)
		}
	}, [currentStep, config, isAlertsModalOpen])

	// Auto-skip spotlight steps whose target element doesn't exist (e.g. alerts when not available)
	useEffect(() => {
		if (!config || isAlertsModalOpen) return

		const timer = setTimeout(() => {
			const hasTarget = config.selectors.some((sel) => document.querySelector(sel))
			if (!hasTarget) {
				const i = steps.indexOf(currentStep)
				if (i < steps.length - 1) {
					setStep(steps[i + 1])
				}
			}
		}, 600)

		return () => clearTimeout(timer)
	}, [currentStep, config, steps, isAlertsModalOpen])

	// The tour leaves the drawer as it found it: Skip, Escape, a prompt pick or finishing during a drawer step close it.
	useEffect(
		() => () => {
			const btn = document.querySelector<HTMLElement>('[data-walkthrough="mobile-tools-button"]')
			if (btn?.getAttribute('aria-expanded') === 'true') btn.click()
		},
		[]
	)

	// Manage mobile drawer: open when entering a drawer step, close when leaving all drawer steps
	useEffect(() => {
		if (isAlertsModalOpen) return
		const isMobileDrawerStep = MOBILE_DRAWER_STEPS.has(currentStep)
		const btn = document.querySelector<HTMLElement>('[data-walkthrough="mobile-tools-button"]')
		const isExpanded = btn?.getAttribute('aria-expanded') === 'true'

		if (isMobileDrawerStep) {
			if (btn && !isExpanded) {
				btn.click()
			}
		} else if (btn && isExpanded) {
			btn.click()
		}
	}, [currentStep, isAlertsModalOpen])

	const nextStep = useCallback(() => {
		const i = steps.indexOf(step)
		if (i < steps.length - 1) {
			const next = steps[i + 1]
			trackUmamiEvent('llamaai-walkthrough-step', { from: step, to: next, variant })
			setStep(next)
		}
	}, [step, steps, variant])

	const handlePromptClick = useCallback(
		(prompt: string) => {
			trackUmamiEvent('llamaai-walkthrough-complete', { action: 'prompt-click', prompt: prompt.slice(0, 60), variant })
			if (!isResearchMode) {
				setMode('research')
			}
			onComplete()
			handleSubmit(prompt, undefined, undefined, undefined, true)
		},
		[handleSubmit, onComplete, isResearchMode, setMode, variant]
	)

	const finish = (event: 'skip' | 'start-chatting') => {
		if (event === 'skip') trackUmamiEvent('llamaai-walkthrough-skip', { step: currentStep, variant })
		else trackUmamiEvent('llamaai-walkthrough-complete', { action: 'start-chatting', variant })
		setMode('research')
		onComplete()
		requestAnimationFrame(() => promptInputRef.current?.focus())
	}

	if (typeof document === 'undefined' || isAlertsModalOpen) return null

	const pad = 4

	// Show a plain dark overlay while waiting for spotlight measurement
	// so there's no flash of bare screen between intro and first spotlight
	const showGapOverlay = config && !spotlightRect

	return (
		<Ariakit.Portal>
			<div data-walkthrough="tour-layer" className="pointer-events-none fixed inset-0 z-9999">
				{/* Dark overlay bridging the gap between intro→spotlight and spotlight→prompts */}
				{showGapOverlay ? (
					<button
						type="button"
						aria-label="Skip walkthrough"
						className="pointer-events-auto absolute inset-0 bg-screen-dim"
						onClick={() => finish('skip')}
					/>
				) : null}

				{/* ─── Intro ─── */}
				{/* Rendered on every step so Ariakit plays its exit animation before unmounting it; a leaving intro takes no clicks. */}
				<Ariakit.Dialog
					open={currentStep === 'intro'}
					unmountOnHide
					onClose={() => finish('skip')}
					autoFocusOnHide={false}
					ref={catchLostFocus}
					backdrop={<div className="fixed inset-0 z-9999 bg-screen-dim" />}
					className="pointer-events-auto fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto p-4 data-leave:pointer-events-none motion-safe:animate-[fadein_0.3s_ease-out] data-leave:motion-safe:animate-[intro-exit_0.25s_ease-in_forwards]"
				>
					<div className="relative max-h-full w-full max-w-[340px] overflow-y-auto rounded-2xl border border-medium bg-overlay shadow-dialog dark:shadow-dialog-deep">
						<div className="h-px w-full bg-linear-to-r from-transparent via-ai-gold/60 to-transparent" />
						<div className="p-6">
							<div className="mb-5 flex flex-col items-center gap-3 text-center">
								<div className="relative">
									<div
										className="absolute inset-0 -m-3 rounded-full"
										style={{
											background:
												'radial-gradient(circle, color-mix(in srgb, var(--ai-gold) 20%, transparent) 0%, transparent 70%)',
											filter: 'blur(10px)'
										}}
									/>
									<img
										src="/assets/llamaai/llama-ai.svg"
										alt=""
										className="relative size-14 object-contain"
										width={56}
										height={56}
									/>
								</div>
								<Ariakit.DialogHeading className="heading-xs tracking-tight text-primary">
									Welcome to LlamaAI
								</Ariakit.DialogHeading>
								<p className="body-md text-secondary">
									AI-powered research across DeFi, TradFi, and on-chain data. Charts, reports, forecasts, and alerts —
									all in one conversation.
								</p>
							</div>

							<div className="mb-5 flex flex-wrap justify-center gap-1.5">
								{CAPABILITY_BADGES.map(([icon, label]) => (
									<span
										key={label}
										className="flex items-center gap-1 rounded-md border border-ai-bronze-deep/20 bg-ai-gold-tint px-2 py-0.5 body-xs text-ai-bronze-deep"
									>
										<Icon name={icon} height={12} width={12} className="opacity-70" />
										{label}
									</span>
								))}
							</div>

							<button
								type="button"
								onClick={nextStep}
								className="w-full rounded-xl bg-ai-gold-cta py-2.5 label-md text-ai-on-gold-strong shadow-ai-gold-ring not-disabled:not-aria-disabled:hover:shadow-ai-gold-ring-hover"
							>
								Show me around
							</button>
							<ProgressFooter currentStep="intro" steps={steps} onSkip={() => finish('skip')} />
						</div>
					</div>
				</Ariakit.Dialog>

				{/* ─── Spotlight steps ─── */}
				{config && spotlightRect && !targetExpanded ? (
					<>
						{/* Touch-blocking overlay: 4 rects around the spotlight hole */}
						<div
							className="pointer-events-auto fixed ease-out motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
							style={{ top: 0, left: 0, right: 0, height: spotlightRect.top - pad }}
						/>
						<div
							className="pointer-events-auto fixed ease-out motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
							style={{ top: spotlightRect.bottom + pad, left: 0, right: 0, bottom: 0 }}
						/>
						<div
							className="pointer-events-auto fixed ease-out motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
							style={{
								top: spotlightRect.top - pad,
								left: 0,
								width: spotlightRect.left - pad,
								height: spotlightRect.height + pad * 2
							}}
						/>
						<div
							className="pointer-events-auto fixed ease-out motion-safe:transition-[top,left,width,height] motion-safe:duration-200"
							style={{
								top: spotlightRect.top - pad,
								left: spotlightRect.right + pad,
								right: 0,
								height: spotlightRect.height + pad * 2
							}}
						/>

						{/* Spotlight cutout (visual dim + glow) */}
						<div
							className={`pointer-events-none fixed rounded-xl ease-out motion-safe:transition-[top,left,width,height] motion-safe:duration-200 ${isFirstSpotlight ? 'motion-safe:animate-[spotlight-enter_0.35s_ease-out]' : ''}`}
							style={{
								left: spotlightRect.left - pad,
								top: spotlightRect.top - pad,
								width: spotlightRect.width + pad * 2,
								height: spotlightRect.height + pad * 2,
								boxShadow: `0 0 0 9999px var(--bg-screen-dim), 0 0 24px 6px color-mix(in srgb, ${TONE_VAR[config.tone]} 25%, transparent)`
							}}
						/>

						{/* Tooltip card */}
						<Ariakit.PopoverProvider key={currentStep} placement={config.placement}>
							<Ariakit.Popover
								open
								getAnchorRect={() => spotlightRect}
								fixed
								gutter={18}
								overflowPadding={16}
								fitViewport
								hideOnInteractOutside={false}
								autoFocusOnHide={false}
								onClose={() => finish('skip')}
								className="pointer-events-auto z-9999 w-[280px] max-w-[calc(100vw-32px)] overflow-y-auto outline-hidden"
							>
								<Ariakit.PopoverArrow
									borderWidth={1}
									style={{ fill: 'var(--bg-overlay)', stroke: 'var(--border-medium)' }}
								/>

								<div className="overflow-hidden rounded-xl border border-medium bg-overlay shadow-overlay-sm">
									<div
										className="h-px w-full bg-linear-to-r from-transparent to-transparent"
										style={{
											backgroundImage: `linear-gradient(to right, transparent, color-mix(in srgb, ${TONE_VAR[config.tone]} 25%, transparent), transparent)`
										}}
									/>
									<div className="p-4">
										<div className="flex items-start gap-3">
											<div
												className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${TONE_TEXT[config.tone]}`}
												style={{ backgroundColor: `color-mix(in srgb, ${TONE_VAR[config.tone]} 10%, transparent)` }}
											>
												<Icon name={config.icon} height={14} width={14} />
											</div>
											<div className="flex flex-col gap-1">
												<Ariakit.PopoverHeading className="label-md text-primary">
													{config.title}
												</Ariakit.PopoverHeading>
												<span className="body-sm text-secondary">
													{RESEARCH_STEPS.has(currentStep) ? researchDescription : config.description}
												</span>
											</div>
										</div>

										<Button
											type="button"
											onClick={() => {
												const target = document.querySelector<HTMLElement>(config.selectors[0])
												const control = target?.matches('button, input, [tabindex]')
													? target
													: (target?.querySelector<HTMLElement>('input:checked') ??
														target?.querySelector<HTMLElement>('button, input, [tabindex]'))
												control?.focus()
											}}
											size="md"
											className="mt-3 w-full"
										>
											Try this control
										</Button>
										{!RESEARCH_STEPS.has(currentStep) ? (
											<Button type="button" onClick={nextStep} size="md" className="mt-3 w-full">
												Next
											</Button>
										) : null}

										<ProgressFooter currentStep={currentStep} steps={steps} onSkip={() => finish('skip')} />
									</div>
								</div>
							</Ariakit.Popover>
						</Ariakit.PopoverProvider>
					</>
				) : null}

				{/* ─── Prompts ─── */}
				{currentStep === 'prompts' ? (
					<Ariakit.Dialog
						open
						onClose={() => finish('skip')}
						autoFocusOnHide={false}
						ref={catchLostFocus}
						backdrop={<div className="fixed inset-0 z-9999 bg-screen-dim" />}
						className="pointer-events-auto fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto p-4 motion-safe:animate-ai-fade-in"
					>
						<div className="relative max-h-full w-full max-w-[400px] overflow-y-auto rounded-2xl border border-medium bg-overlay shadow-dialog dark:shadow-dialog-deep">
							<div className="h-px w-full bg-linear-to-r from-transparent via-success/50 to-transparent" />

							<div className="p-6">
								<div className="mb-4 flex flex-col items-center gap-1 text-center">
									<div className="mb-1 flex size-7 items-center justify-center rounded-full bg-success-tint">
										<Icon name="check" height={14} width={14} className="text-success" />
									</div>
									<Ariakit.DialogHeading className="title-md text-primary">Research mode is on</Ariakit.DialogHeading>
									<span className="body-sm text-secondary">Unsure what to ask? Try one of these:</span>
								</div>

								<div className="mb-4 flex flex-col gap-1.5">
									{ONBOARDING_PROMPTS.map((p) => (
										<button
											type="button"
											key={p.label}
											onClick={() => handlePromptClick(p.prompt)}
											className="group flex items-center gap-3 rounded-lg border border-medium px-3 py-2 text-left not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row"
										>
											<Icon
												name={p.icon}
												height={14}
												width={14}
												className="shrink-0 text-secondary group-hover:text-link group-focus-visible:text-link"
											/>
											<span className="label-md text-primary">{p.label}</span>
											<Icon
												name="arrow-right"
												height={14}
												width={14}
												className="ml-auto shrink-0 text-secondary opacity-0 group-hover:text-link group-hover:opacity-100 group-focus-visible:text-link group-focus-visible:opacity-100"
											/>
										</button>
									))}
								</div>

								<p className="mb-3 text-center body-sm text-secondary">Or type your own question in the input below.</p>

								<Button type="button" size="md" onClick={() => finish('start-chatting')} className="w-full">
									Start chatting
								</Button>

								<ProgressFooter currentStep={currentStep} steps={steps} onSkip={() => finish('skip')} />
							</div>
						</div>
					</Ariakit.Dialog>
				) : null}
			</div>
		</Ariakit.Portal>
	)
}

function ProgressFooter({ currentStep, steps, onSkip }: { currentStep: Step; steps: Array<Step>; onSkip: () => void }) {
	const currentIndex = steps.indexOf(currentStep)

	return (
		<div className="mt-3 flex items-center justify-between">
			<span className="sr-only" role="status">
				Step {currentIndex + 1} of {steps.length}
			</span>
			<div className="flex items-center gap-1" aria-hidden="true">
				{steps.map((stepName, index) => (
					<div
						key={stepName}
						className={`h-1 rounded-full motion-safe:transition-[width,opacity] motion-safe:duration-200 ${
							index <= currentIndex ? 'w-3.5 bg-ai-bronze-deep' : 'w-1 bg-surface-elevated-2'
						}`}
					/>
				))}
			</div>
			<Button type="button" size="md" variant="ghost" onClick={onSkip} className="-mr-3">
				Skip
			</Button>
		</div>
	)
}
