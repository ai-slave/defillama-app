import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { AgenticAnswerMode } from '~/containers/LlamaAI/types'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { useMedia } from '~/hooks/useMedia'
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
	| 'mobile-alerts'
	| 'prompts'

const DESKTOP_STEPS: Array<Step> = ['intro', 'explore', 'alerts', 'upload', 'research', 'prompts']
const MOBILE_STEPS: Array<Step> = [
	'intro',
	'mobile-upload',
	'mobile-explore',
	'mobile-alerts',
	'mobile-research',
	'prompts'
]

// Variant B: short walkthrough (intro → research → prompts)
const DESKTOP_STEPS_SHORT: Array<Step> = ['intro', 'research', 'prompts']
const MOBILE_STEPS_SHORT: Array<Step> = ['intro', 'mobile-research', 'prompts']

const MOBILE_DRAWER_STEPS = new Set<Step>(['mobile-upload', 'mobile-research', 'mobile-explore', 'mobile-alerts'])
const RESEARCH_STEPS = new Set<Step>(['research', 'mobile-research'])

interface SpotlightConfig {
	selectors: Array<string>
	title: string
	description: string
	icon: 'layout-grid' | 'calendar-plus' | 'image-plus' | 'search' | 'plus'
	iconColor: string
	accentColor: string
	position: 'above' | 'below'
}

const SPOTLIGHT_CONFIGS = {
	explore: {
		selectors: ['[data-walkthrough="explore-button"]'],
		title: 'Explore',
		description:
			'Not sure what to ask? Browse here to see everything LlamaAI can do — yields, analytics, trade theses, on-chain, and more.',
		icon: 'layout-grid',
		iconColor: '#60a5fa',
		accentColor: 'rgba(37, 99, 235, 0.25)',
		position: 'above'
	},
	alerts: {
		selectors: ['[data-walkthrough="alerts-button"]'],
		title: 'Scheduled Alerts',
		description:
			'Ask LlamaAI to create alerts for you — daily price checks, portfolio monitors, custom data alerts. This button is for managing them.',
		icon: 'calendar-plus',
		iconColor: '#f59e0b',
		accentColor: 'rgba(245, 158, 11, 0.25)',
		position: 'above'
	},
	upload: {
		selectors: ['[data-walkthrough="image-upload"]'],
		title: 'File Upload',
		description: 'Upload images, PDFs, or CSVs and ask LlamaAI to analyze them — charts, reports, datasets, anything.',
		icon: 'image-plus',
		iconColor: '#10b981',
		accentColor: 'rgba(16, 185, 129, 0.25)',
		position: 'above'
	},
	research: {
		selectors: ['[data-walkthrough="mode-toggle"]'],
		title: 'Need deeper answers?',
		description: '', // Dynamic — set at render time based on isTrial
		icon: 'search',
		iconColor: '#60a5fa',
		accentColor: 'rgba(37, 99, 235, 0.25)',
		position: 'above'
	},
	'mobile-upload': {
		selectors: ['[data-walkthrough="mobile-upload-item"]'],
		title: 'File Upload',
		description: 'Upload images, PDFs, or CSVs and ask LlamaAI to analyze them — charts, reports, datasets, anything.',
		icon: 'image-plus',
		iconColor: '#10b981',
		accentColor: 'rgba(16, 185, 129, 0.25)',
		position: 'above'
	},
	'mobile-research': {
		selectors: ['[data-walkthrough="mobile-research-item"]'],
		title: 'Need deeper answers?',
		description: '', // Dynamic — set at render time based on isTrial
		icon: 'search',
		iconColor: '#60a5fa',
		accentColor: 'rgba(37, 99, 235, 0.25)',
		position: 'above'
	},
	'mobile-explore': {
		selectors: ['[data-walkthrough="mobile-explore-item"]'],
		title: 'Explore',
		description:
			'Not sure what to ask? Browse here to see everything LlamaAI can do — yields, analytics, trade theses, on-chain, and more.',
		icon: 'layout-grid',
		iconColor: '#60a5fa',
		accentColor: 'rgba(37, 99, 235, 0.25)',
		position: 'above'
	},
	'mobile-alerts': {
		selectors: ['[data-walkthrough="mobile-alerts-item"]'],
		title: 'Scheduled Alerts',
		description:
			'Ask LlamaAI to create alerts for you — daily price checks, portfolio monitors, custom data alerts. This button is for managing them.',
		icon: 'calendar-plus',
		iconColor: '#f59e0b',
		accentColor: 'rgba(245, 158, 11, 0.25)',
		position: 'above'
	}
} satisfies Partial<Record<Step, SpotlightConfig>>

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
	const [introExiting, setIntroExiting] = useState(false)
	const [spotlight, setSpotlight] = useState<{ step: Step; rect: DOMRect; expanded: boolean } | null>(null)
	const isMobile = useMedia('(max-width: 639px)')

	// A/B experiment: full steps (A) vs short steps (B)
	const { user, isTrial, hasActiveSubscription } = useAuthContext()
	const userId = user?.id ? String(user.id) : null
	const variant = userId ? getExperimentVariant('walkthrough-steps-v1', userId) : 'A'

	// Track experiment assignment once
	useEffect(() => {
		trackUmamiEvent('llamaai-walkthrough-assigned', { variant })
	}, [variant])

	const steps = isMobile
		? variant === 'B'
			? MOBILE_STEPS_SHORT
			: MOBILE_STEPS
		: variant === 'B'
			? DESKTOP_STEPS_SHORT
			: DESKTOP_STEPS
	const currentStep = RESEARCH_STEPS.has(step) && isResearchMode ? 'prompts' : step
	const spotlightRect = spotlight?.step === currentStep ? spotlight.rect : null
	const targetExpanded = spotlight?.step === currentStep && spotlight.expanded
	const config = getOwnRegistryValue<SpotlightConfig>(SPOTLIGHT_CONFIGS, currentStep)
	const isSpotlightStep = !!config
	const firstSpotlightStep =
		steps.find((candidate) => getOwnRegistryValue(SPOTLIGHT_CONFIGS, candidate) != null) ?? null
	const isFirstSpotlight = currentStep === firstSpotlightStep

	const tapOrClick = isMobile ? 'Tap' : 'Click'
	const researchDescription = !hasActiveSubscription
		? `In-depth reports with analysis, charts, and citations. Free mode includes 1 report every 14 days. ${tapOrClick} below.`
		: isTrial
			? `In-depth reports with analysis, charts, and citations. You have 3 free queries to try. ${tapOrClick} below.`
			: `In-depth reports with analysis, charts, and citations. You get 5 per day. ${tapOrClick} below.`

	// Find and measure spotlight target(s)
	useEffect(() => {
		if (!isSpotlightStep || !config || isAlertsModalOpen) return

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
	}, [currentStep, isSpotlightStep, config, isAlertsModalOpen])

	// Auto-skip spotlight steps whose target element doesn't exist (e.g. alerts when not available)
	useEffect(() => {
		if (!isSpotlightStep || !config || isAlertsModalOpen) return

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
	}, [currentStep, isSpotlightStep, config, steps, isAlertsModalOpen])

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

			// Animate intro modal out before advancing
			if (step === 'intro') {
				setIntroExiting(true)
				setTimeout(() => {
					setIntroExiting(false)
					setStep(next)
				}, 250)
			} else {
				setStep(next)
			}
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

	const handleSkip = useCallback(() => {
		trackUmamiEvent('llamaai-walkthrough-skip', { step: currentStep, variant })
		setMode('research')
		onComplete()
		requestAnimationFrame(() => promptInputRef.current?.focus())
	}, [currentStep, variant, setMode, onComplete, promptInputRef])

	const handleStartChatting = useCallback(() => {
		trackUmamiEvent('llamaai-walkthrough-complete', { action: 'start-chatting', variant })
		setMode('research')
		onComplete()
		requestAnimationFrame(() => promptInputRef.current?.focus())
	}, [variant, setMode, onComplete, promptInputRef])

	if (typeof document === 'undefined' || isAlertsModalOpen) return null

	const pad = 4

	// Show a plain dark overlay while waiting for spotlight measurement
	// so there's no flash of bare screen between intro and first spotlight
	const showGapOverlay = isSpotlightStep && !spotlightRect

	return (
		<Ariakit.Portal>
			<div className="pointer-events-none fixed inset-0 z-9999">
				{/* Dark overlay bridging the gap between intro→spotlight and spotlight→prompts */}
				{showGapOverlay ? (
					<button
						type="button"
						aria-label="Skip walkthrough"
						className="pointer-events-auto absolute inset-0 bg-ai-backdrop"
						onClick={handleSkip}
					/>
				) : null}

				{/* ─── Intro ─── */}
				{currentStep === 'intro' ? (
					<Ariakit.Dialog
						open
						onClose={handleSkip}
						autoFocusOnHide={false}
						backdrop={<div className="fixed inset-0 z-9999 bg-ai-backdrop" />}
						className={`pointer-events-auto fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto p-4 ${
							introExiting ? 'animate-[intro-exit_0.25s_ease-in_forwards]' : 'animate-[fadein_0.3s_ease-out]'
						}`}
					>
						<div className="relative max-h-full w-full max-w-[340px] overflow-y-auto rounded-2xl border border-ai-gold/15 bg-ai-ink shadow-ai-modal">
							<div className="h-px w-full bg-linear-to-r from-transparent via-ai-gold/60 to-transparent" />
							<div className="p-6">
								<div className="mb-5 flex flex-col items-center gap-3 text-center">
									<div className="relative">
										<div
											className="absolute inset-0 -m-3 rounded-full"
											style={{
												background: 'radial-gradient(circle, rgba(201,154,74,0.2) 0%, transparent 70%)',
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
									<Ariakit.DialogHeading className="text-lg font-bold tracking-tight text-ai-white">
										Welcome to LlamaAI
									</Ariakit.DialogHeading>
									<p className="text-[13px] leading-relaxed text-ai-on-ink-muted">
										AI-powered research across DeFi, TradFi, and on-chain data. Charts, reports, forecasts, and alerts —
										all in one conversation.
									</p>
								</div>

								<div className="mb-5 flex flex-wrap justify-center gap-1.5">
									{CAPABILITY_BADGES.map(([icon, label]) => (
										<span
											key={label}
											className="flex items-center gap-1 rounded-md border border-ai-gold/10 bg-ai-gold/5 px-2 py-0.5 text-[10px] text-ai-gold"
										>
											<Icon name={icon} height={9} width={9} className="opacity-70" />
											{label}
										</span>
									))}
								</div>

								<button
									type="button"
									onClick={nextStep}
									className="w-full rounded-xl bg-ai-gold-cta py-2.5 text-[13px] font-semibold text-ai-on-gold-strong shadow-ai-gold-ring transition-all hover:shadow-ai-gold-ring-hover"
								>
									Show me around
								</button>
								<ProgressFooter currentStep={currentStep} steps={steps} onSkip={handleSkip} />
							</div>
						</div>
					</Ariakit.Dialog>
				) : null}

				{/* ─── Spotlight steps ─── */}
				{isSpotlightStep && spotlightRect && config && !targetExpanded ? (
					<>
						{/* Touch-blocking overlay: 4 rects around the spotlight hole */}
						<div
							className="pointer-events-auto fixed transition-all duration-300 ease-in-out"
							style={{ top: 0, left: 0, right: 0, height: spotlightRect.top - pad }}
						/>
						<div
							className="pointer-events-auto fixed transition-all duration-300 ease-in-out"
							style={{ top: spotlightRect.bottom + pad, left: 0, right: 0, bottom: 0 }}
						/>
						<div
							className="pointer-events-auto fixed transition-all duration-300 ease-in-out"
							style={{
								top: spotlightRect.top - pad,
								left: 0,
								width: spotlightRect.left - pad,
								height: spotlightRect.height + pad * 2
							}}
						/>
						<div
							className="pointer-events-auto fixed transition-all duration-300 ease-in-out"
							style={{
								top: spotlightRect.top - pad,
								left: spotlightRect.right + pad,
								right: 0,
								height: spotlightRect.height + pad * 2
							}}
						/>

						{/* Spotlight cutout (visual dim + glow) */}
						<div
							className={`pointer-events-none fixed rounded-xl transition-all duration-300 ease-in-out ${isFirstSpotlight ? 'animate-[spotlight-enter_0.35s_ease-out]' : ''}`}
							style={{
								left: spotlightRect.left - pad,
								top: spotlightRect.top - pad,
								width: spotlightRect.width + pad * 2,
								height: spotlightRect.height + pad * 2,
								boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 24px 6px ${config.accentColor}`
							}}
						/>

						{/* Tooltip card */}
						<Ariakit.PopoverProvider key={currentStep} placement={config.position === 'above' ? 'top' : 'bottom'}>
							<Ariakit.Popover
								open
								getAnchorRect={() => spotlightRect}
								fixed
								gutter={18}
								overflowPadding={16}
								fitViewport
								hideOnInteractOutside={false}
								autoFocusOnHide={false}
								onClose={handleSkip}
								className="pointer-events-auto z-9999 w-[280px] max-w-[calc(100vw-32px)] overflow-y-auto outline-hidden"
							>
								<Ariakit.PopoverArrow className="fill-ai-ink" />

								<div className="overflow-hidden rounded-xl border border-ai-ink-line bg-ai-ink shadow-ai-overlay">
									<div
										className="h-px w-full bg-linear-to-r from-transparent to-transparent"
										style={{
											backgroundImage: `linear-gradient(to right, transparent, ${config.iconColor}40, transparent)`
										}}
									/>
									<div className="p-4">
										<div className="flex items-start gap-3">
											<div
												className="flex size-7 shrink-0 items-center justify-center rounded-lg"
												style={{ backgroundColor: `${config.iconColor}15` }}
											>
												<Icon name={config.icon} height={14} width={14} style={{ color: config.iconColor }} />
											</div>
											<div className="flex flex-col gap-1">
												<Ariakit.PopoverHeading className="text-[13px] font-semibold text-ai-white">
													{config.title}
												</Ariakit.PopoverHeading>
												<span className="text-xs leading-snug text-ai-on-ink-muted">
													{RESEARCH_STEPS.has(currentStep) ? researchDescription : config.description}
												</span>
											</div>
										</div>

										<button
											type="button"
											onClick={() => {
												const target = document.querySelector<HTMLElement>(config.selectors[0])
												const control = target?.matches('button, input, [tabindex]')
													? target
													: (target?.querySelector<HTMLElement>('input:checked') ??
														target?.querySelector<HTMLElement>('button, input, [tabindex]'))
												control?.focus()
											}}
											className="mt-3 w-full rounded-lg bg-ai-ink-raised py-2 text-xs font-medium text-ai-on-ink hover:bg-ai-ink-hover focus-visible:outline-2"
										>
											Try this control
										</button>
										{!RESEARCH_STEPS.has(currentStep) ? (
											<button
												type="button"
												onClick={nextStep}
												className="mt-3 w-full rounded-lg bg-ai-ink-raised py-2 text-xs font-medium text-ai-on-ink transition-colors hover:bg-ai-ink-hover hover:text-ai-white"
											>
												Next
											</button>
										) : null}

										<ProgressFooter currentStep={currentStep} steps={steps} onSkip={handleSkip} />
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
						onClose={handleSkip}
						autoFocusOnHide={false}
						backdrop={<div className="fixed inset-0 z-9999 bg-ai-backdrop" />}
						className="pointer-events-auto fixed inset-0 z-9999 flex animate-ai-fade-in items-center justify-center overflow-y-auto p-4"
					>
						<div className="relative max-h-full w-full max-w-[400px] overflow-y-auto rounded-2xl border border-ai-ink-line bg-ai-ink shadow-ai-modal">
							<div className="h-px w-full bg-linear-to-r from-transparent via-ai-success-vivid/50 to-transparent" />

							<div className="p-6">
								<div className="mb-4 flex flex-col items-center gap-1 text-center">
									<div className="mb-1 flex size-7 items-center justify-center rounded-full bg-ai-success-vivid/12">
										<Icon name="check" height={14} width={14} className="text-ai-success-vivid" />
									</div>
									<Ariakit.DialogHeading className="text-[15px] font-bold text-ai-white">
										Research mode is on
									</Ariakit.DialogHeading>
									<span className="text-[13px] text-ai-on-ink-muted">Unsure what to ask? Try one of these:</span>
								</div>

								<div className="mb-4 flex flex-col gap-1.5">
									{ONBOARDING_PROMPTS.map((p) => (
										<button
											type="button"
											key={p.label}
											onClick={() => handlePromptClick(p.prompt)}
											className="group flex items-center gap-3 rounded-xl border border-ai-ink-line bg-ai-ink px-3.5 py-2.5 text-left transition-all duration-150 hover:border-ai-accent-blue/20 hover:bg-ai-accent-blue/5"
										>
											<Icon
												name={p.icon}
												height={14}
												width={14}
												className="shrink-0 text-ai-secondary transition-colors group-hover:text-ai-accent-blue-soft"
											/>
											<span className="text-[13px] font-medium text-ai-on-ink group-hover:text-ai-white">
												{p.label}
											</span>
											<Icon
												name="arrow-right"
												height={12}
												width={12}
												className="ml-auto shrink-0 text-ai-secondary opacity-0 transition-all group-hover:text-ai-accent-blue-soft group-hover:opacity-100"
											/>
										</button>
									))}
								</div>

								<p className="mb-3 text-center text-[11px] text-ai-secondary">
									Or type your own question in the input below.
								</p>

								<button
									type="button"
									onClick={handleStartChatting}
									className="w-full rounded-xl border border-ai-ink-line bg-ai-ink py-2.5 text-[13px] font-medium text-ai-on-ink transition-colors hover:bg-ai-ink-raised hover:text-ai-white"
								>
									Start chatting
								</button>

								<ProgressFooter currentStep={currentStep} steps={steps} onSkip={handleSkip} />
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
						className={`h-1 rounded-full transition-all duration-300 ${
							index <= currentIndex ? 'w-3.5 bg-ai-gold' : 'w-1 bg-ai-ink-hover'
						}`}
					/>
				))}
			</div>
			<button
				type="button"
				onClick={onSkip}
				className="text-[11px] text-ai-secondary transition-colors hover:text-ai-on-ink-muted"
			>
				Skip
			</button>
		</div>
	)
}
