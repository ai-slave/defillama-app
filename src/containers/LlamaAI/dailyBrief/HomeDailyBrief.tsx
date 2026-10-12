import { useRouter } from 'next/router'
import { lazy, type MouseEvent, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { setPendingEntrySource, setPendingPrompt, setPendingSuggestedFlag } from '~/containers/LlamaAI/pendingPrompt'
import { useQuestionSignIn } from '~/containers/LlamaAI/useQuestionSignIn'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { DisclosureChevron } from '~/ui/DisclosureChevron'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import {
	type ExperimentVariant,
	readExperimentVariant,
	trackExperimentAction,
	trackExperimentExposure
} from '~/utils/analytics/experiment'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { DailyBrief } from './api'

const SignInDialog = lazy(() =>
	import('~/containers/Subscription/SignInDialog').then((module) => ({ default: module.SignInDialog }))
)

const EXPERIMENT_ID = 'home-brief-default-v1'
const DESKTOP_QUERY = '(min-width: 1024px)'

// The test is desktop-only: below lg the card always starts closed and the visitor is not in it.
const readVariant = (): ExperimentVariant | null =>
	window.matchMedia(DESKTOP_QUERY).matches ? readExperimentVariant(EXPERIMENT_ID) : null

function subscribeToDesktop(onChange: () => void) {
	const query = window.matchMedia(DESKTOP_QUERY)
	query.addEventListener('change', onChange)
	return () => query.removeEventListener('change', onChange)
}

const askStyles = 'text-ai-gold-deep'

const questionCardStyles =
	'hover-wash-card flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-lg border border-subtle bg-surface px-3 py-2 text-left active:bg-surface-elevated-1'

function tabsFade(canScrollLeft: boolean, canScrollRight: boolean): string | undefined {
	if (canScrollLeft && canScrollRight)
		return 'linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)'
	if (canScrollRight) return 'linear-gradient(to right, black calc(100% - 2rem), transparent)'
	if (canScrollLeft) return 'linear-gradient(to right, transparent, black 2rem)'
	return undefined
}

// Until the arm is read after hydration, the pre-paint attribute decides which state shows.
const showWhenBriefOpenByDefault = 'hidden lg:[html[data-ab-home-brief-default-v1=b]_&]:flex'
const hideWhenBriefOpenByDefault = 'lg:[html[data-ab-home-brief-default-v1=b]_&]:hidden'

export function HomeDailyBrief({ brief }: { brief: DailyBrief }) {
	const router = useRouter()
	const { isAuthenticated, loaders } = useAuthContext()
	const signIn = useQuestionSignIn(() => void router.push('/ai/chat'))
	// undefined on the server and in the hydration render, so the HTML carries both states for the CSS above.
	const variant = useSyncExternalStore(subscribeToDesktop, readVariant, () => undefined)
	const [toggledExpanded, setToggledExpanded] = useState<boolean | null>(null)
	const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
	const isExpanded = toggledExpanded ?? (variant === undefined ? null : variant === 'b')
	const { ref: tabsOverflowRef, canScrollLeft, canScrollRight } = useHorizontalOverflow()

	useEffect(() => {
		if (variant) trackExperimentExposure(EXPERIMENT_ID, variant)
	}, [variant])

	const onAsk = (question: string) => {
		const signedIn = !loaders.userLoading && isAuthenticated
		trackUmamiEvent('llamaai-daily-brief-click', { signedIn })
		if (variant) trackExperimentAction(EXPERIMENT_ID, variant, 'brief-question')
		setPendingPrompt(question)
		setPendingSuggestedFlag()
		setPendingEntrySource('daily-brief')
		if (signedIn) {
			void router.push('/ai/chat')
			return
		}
		setSignupSource('daily-brief')
		signIn.open(question)
	}

	const toggle = (event: MouseEvent<HTMLButtonElement>) => {
		const card = event.currentTarget.closest('section')
		// Closing from inside a tall open card would leave the reader below the shrunken card. Its top goes back on screen
		// first; 'nearest' does nothing here, because the open card already covers the viewport.
		if (isExpanded && card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' })
		setToggledExpanded(!isExpanded)
		setActiveSectionId(null)
		if (isExpanded) return
		trackUmamiEvent('llamaai-daily-brief-open')
		if (variant) trackExperimentAction(EXPERIMENT_ID, variant, 'brief-open')
	}

	const activeSection = brief.sections.find((section) => section.id === activeSectionId) ?? brief.sections[0]
	const bulletCount = brief.sections.reduce((sum, section) => sum + section.bullets.length, 0)
	const chips = brief.sections.slice(0, 3).flatMap((section) => section.bullets[0]?.question ?? [])

	const openLabel = (
		<>
			Hide full brief
			<DisclosureChevron kind="section" size="sm" open />
		</>
	)
	const closedLabel = (
		<>
			{`Read full brief · ${bulletCount}`}
			<DisclosureChevron kind="section" size="sm" open={false} />
		</>
	)

	return (
		<>
			<Card as="section" padding="sm" aria-labelledby="daily-brief-title" className="flex scroll-mt-4 flex-col gap-2">
				<header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<div className="flex items-center gap-1.5">
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-4" />
						<h2 id="daily-brief-title" className="label-md text-primary">
							Today in DeFi
						</h2>
					</div>
					<div className="flex items-center gap-3">
						<RelativeTime value={brief.generatedAt} prefix="Updated" className="label-sm text-tertiary max-lg:hidden" />
						<Button
							type="button"
							size="sm"
							variant="ghost"
							aria-expanded={isExpanded === true}
							aria-controls="daily-brief-details"
							onClick={toggle}
							className="-mr-2"
						>
							{isExpanded === null ? (
								<>
									<span className="contents lg:[html[data-ab-home-brief-default-v1=b]_&]:hidden">{closedLabel}</span>
									<span className="hidden lg:[html[data-ab-home-brief-default-v1=b]_&]:contents">{openLabel}</span>
								</>
							) : isExpanded ? (
								openLabel
							) : (
								closedLabel
							)}
						</Button>
					</div>
				</header>
				<button
					type="button"
					aria-expanded={isExpanded === true}
					aria-controls="daily-brief-details"
					onClick={toggle}
					className="group hover-wash -mx-2 -my-1 flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-left heading-xs text-primary"
				>
					<span className="line-clamp-2 sm:truncate">{brief.headline}</span>
					{/* Not DisclosureChevron: before hydration the brief's A/B variant opens it by CSS, so its chevron turns by the
					    same CSS. It follows the section convention the "Read full brief" button below uses. */}
					<Icon
						name="chevron-down"
						className={`size-4 shrink-0 text-tertiary transition-transform group-hover:text-primary group-focus-visible:text-primary motion-reduce:transition-none ${isExpanded ? 'rotate-180' : isExpanded === null ? 'lg:[html[data-ab-home-brief-default-v1=b]_&]:rotate-180' : ''}`}
					/>
				</button>
				{isExpanded !== false ? (
					<div
						id="daily-brief-details"
						className={`flex-col gap-2 ${isExpanded === null ? showWhenBriefOpenByDefault : 'flex'}`}
					>
						<p className="body-md text-secondary">{brief.summary}</p>
						<Tabs
							id="daily-brief"
							value={activeSection.id}
							onValueChange={setActiveSectionId}
							values={brief.sections.map((section) => section.id)}
						>
							{/* On phones the sections outrun the card's width, so the side that has more fades out. */}
							<div
								ref={tabsOverflowRef}
								className="scrollbar-none overflow-x-auto"
								style={{ maskImage: tabsFade(canScrollLeft, canScrollRight) }}
							>
								<SegmentedControl
									semantics="tabs"
									label="Brief sections"
									variant="default"
									size="md"
									className="w-max"
									options={brief.sections.map((section) => ({ value: section.id, label: section.title }))}
								/>
							</div>
							<TabPanel value={activeSection.id}>
								<ul className="grid gap-2 lg:grid-cols-3">
									{activeSection.bullets.map((bullet) => (
										<li key={bullet.question}>
											<button type="button" onClick={() => onAsk(bullet.question)} className={questionCardStyles}>
												<span className="body-md text-primary">{bullet.text}</span>
												<span className={`flex items-start gap-1.5 body-sm ${askStyles}`}>
													<span className="flex h-lh shrink-0 items-center">
														<Icon name="sparkles" className="size-3.5" />
													</span>
													<span className="line-clamp-2 flex-1">{bullet.question}</span>
													<span className="flex h-lh shrink-0 items-center">
														<Icon name="chevron-right" className="size-3.5" />
													</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							</TabPanel>
						</Tabs>
						{/* Below lg the questions stack and the header scrolls away, so the open card can be closed from its end. */}
						<div className="flex items-center justify-between gap-3 lg:hidden">
							<RelativeTime value={brief.generatedAt} prefix="Updated" className="label-sm text-tertiary" />
							<Button
								type="button"
								size="sm"
								variant="ghost"
								aria-expanded
								aria-controls="daily-brief-details"
								onClick={toggle}
								className="-mr-2"
							>
								Hide full brief
							</Button>
						</div>
					</div>
				) : null}
				{isExpanded === true ? null : (
					<div
						className={`flex scrollbar-none items-center gap-1.5 overflow-x-auto ${isExpanded === null ? hideWhenBriefOpenByDefault : ''}`}
					>
						{/* Question pills are md secondary Buttons, the brief's main action rather than an sm suggestion pill. They
						    share one row, so each truncates to one line and keeps the full question in its tooltip. */}
						{chips.map((question) => (
							<Tooltip
								key={question}
								content={question}
								render={
									<Button
										variant="secondary"
										size="md"
										truncate
										aria-label={`Ask LlamaAI: ${question}`}
										onClick={() => onAsk(question)}
									/>
								}
								className="max-w-64 shrink-0 sm:max-w-none sm:flex-1 sm:shrink"
							>
								<Icon name="sparkles" className={`size-3.5 shrink-0 ${askStyles}`} />
								<span className="truncate">{question}</span>
							</Tooltip>
						))}
					</div>
				)}
			</Card>
			{signIn.isOpen ? (
				<Suspense fallback={null}>
					<SignInDialog {...signIn.dialogProps} />
				</Suspense>
			) : null}
		</>
	)
}
