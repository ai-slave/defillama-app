import clsx from 'clsx'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { BasicLink } from '~/components/Link'
import { SEO } from '~/components/SEO'
import { AI_SERVER } from '~/constants'
import { GoldCta } from '~/containers/LlamaAI/components/GoldCta'
import { ComposerFrame } from '~/containers/LlamaAI/components/input/ComposerFrame'
import {
	FREE_DAILY_ALLOWANCE,
	FREE_RESEARCH_ALLOWANCE,
	WELCOME_WEEK_ALLOWANCE
} from '~/containers/LlamaAI/freePlanCopy'
import {
	hasPendingPrompt,
	setPendingEntrySource,
	setPendingPrompt,
	setPendingSuggestedFlag
} from '~/containers/LlamaAI/pendingPrompt'
import { TOOL_ICONS, TOOL_LABELS, TOOL_TONE_CLASS } from '~/containers/LlamaAI/toolMetadata'
import type { LandingQuestion } from '~/containers/LlamaAI/types'
import { useQuestionSignIn } from '~/containers/LlamaAI/useQuestionSignIn'
import { StoreButtons } from '~/containers/MobileApp'
import { LlamaAIMobileAppPromotion } from '~/containers/MobileApp/LlamaAIMobileAppGate'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const EXAMPLE_CONVERSATIONS = [
	{
		id: 'find-alpha',
		category: 'Find alpha',
		prompt: 'Show me the top 5 protocols with growing TVL but declining token prices',
		description: 'Table + chart analysis identifying potential value opportunities and key insights',
		url: 'https://defillama.com/ai/chat/shared/34525e47-528e-4b20-8ab4-4d2dd5d31252',
		screenshot: '/assets/llamaai/llamaai-3'
	},
	{
		id: 'research',
		category: 'Research',
		prompt: 'Provide an overview of the stablecoin sector with focus on CBDCs',
		description: 'In-depth research report covering market trends, legislation, and adoption',
		url: 'https://defillama.com/ai/chat/shared/9634371a-d385-4e28-bcd8-d758f0bbcd30',
		screenshot: '/assets/llamaai/llamaai-1'
	},
	{
		id: 'speculative',
		category: 'Speculative',
		prompt: 'Price estimate for BTC using technicals, Monte Carlo, and prediction markets',
		description: 'Blended analysis with charts, simulation outcomes, and Polymarket probabilities',
		url: 'https://defillama.com/ai/chat/shared/b60a2440-445e-4755-b227-7127557a4d79',
		screenshot: '/assets/llamaai/llamaai-2'
	}
] as const

const CAPABILITIES = [
	{ icon: 'bar-chart-2' as const, label: 'Charts & analytics', sub: 'Auto-generated charts' },
	{ icon: 'trending-up' as const, label: 'Price forecasts', sub: 'Monte Carlo + technicals' },
	{ icon: 'link' as const, label: 'On-chain analysis', sub: 'Smart money & logs' },
	{ icon: 'calendar' as const, label: 'Scheduled alerts', sub: 'Automated daily checks' },
	{ icon: 'file-text' as const, label: 'Research reports', sub: 'Multi-agent deep dives' }
]

const FALLBACK_QUESTIONS: Array<LandingQuestion> = [
	{ text: 'Which protocols have growing TVL but declining token prices right now?', tag: 'Find alpha' },
	{ text: 'Build a conviction-scored trade thesis on ETH with technicals and on-chain data', tag: 'Trade thesis' },
	{ text: 'What are the best delta-neutral yield strategies for 10 ETH on Ethereum?', tag: 'Yield strategy' },
	{ text: 'Show me all USDC mint events on Ethereum this week', tag: 'On-Chain' },
	{ text: 'Deep research report on the current state of restaking protocols', tag: 'Research' },
	{ text: 'What tokens does vitalik.eth hold and what changed recently?', tag: 'Wallet analysis' },
	{ text: 'Compare Uniswap vs Curve vs Balancer fees and volume over the last 30 days', tag: 'Analytics' },
	{ text: 'What are the latest crypto fundraising rounds this month?', tag: 'Raises' },
	{ text: 'Price estimate for BTC using Monte Carlo simulation and prediction markets', tag: 'Forecasting' }
]

function FreeQuestionsSection({ landingQuestions }: { landingQuestions?: Array<LandingQuestion> }) {
	const router = useRouter()
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const signIn = useQuestionSignIn(() => {
		if (hasPendingPrompt()) void router.push('/ai/chat')
	})

	// A subscriber needs no free questions, but the sign-in stays mounted: signing in as one hides the section, and the
	// dialog still has to finish that sign-in and hand the waiting question to the chat.
	const hidden = isAuthenticated && hasActiveSubscription

	const questions = landingQuestions?.length ? landingQuestions : FALLBACK_QUESTIONS
	const displayed = questions.slice(0, 9)

	const handleClick = (question: LandingQuestion) => {
		trackUmamiEvent('llamaai-landing-free-question-click', {
			tag: question.tag,
			question: question.text.slice(0, 50)
		})
		if (!loaders.userLoading && isAuthenticated) {
			setPendingPrompt(question.text)
			setPendingSuggestedFlag()
			setPendingEntrySource('landing')
			void router.push('/ai/chat')
		} else {
			setPendingPrompt(question.text)
			setPendingSuggestedFlag()
			setPendingEntrySource('landing')
			setSignupSource('llamaai-landing')
			signIn.open(question.text)
		}
	}

	return (
		<>
			{hidden ? null : (
				<section id="free-questions" className="relative z-10 mx-auto max-w-5xl px-4 pb-20 md:px-8 md:pb-28">
					<div className="mb-6 text-center">
						<h2 className="mb-2 text-[1.75rem] font-extrabold tracking-[-0.02em] text-primary md:text-[2rem]">
							Try LlamaAI for free
						</h2>
						<p className="body-md text-secondary">{`New here? ${WELCOME_WEEK_ALLOWANCE}.`}</p>
						<p className="body-md text-tertiary">
							{`After that: ${FREE_DAILY_ALLOWANCE} and ${FREE_RESEARCH_ALLOWANCE}.`}{' '}
							{isAuthenticated ? null : (
								<>
									<button
										type="button"
										onClick={() => {
											setSignupSource('llamaai-landing')
											signIn.open(null)
										}}
										className="font-medium text-ai-gold-deep underline decoration-ai-gold-muted transition-colors hover:decoration-current"
									>
										Sign in
									</button>{' '}
									to start.
								</>
							)}
						</p>
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{displayed.map((q, i) => (
							<Card
								as="button"
								type="button"
								padding="md"
								// oxlint-disable-next-line react/no-array-index-key -- Landing suggestions are a read-only snapshot with no IDs; text and tags may repeat.
								key={i}
								onClick={() => handleClick(q)}
								className="hover-wash-card group flex cursor-pointer flex-col items-start gap-3 text-left"
							>
								<span className="inline-block rounded-full border border-ai-gold-muted bg-ai-gold-tint px-2.5 py-0.5 label-sm text-ai-gold-deep">
									{q.tag}
								</span>
								<span className="flex-1 body-md text-secondary">{q.text}</span>
								<span className="flex items-center gap-1 label-md text-ai-gold-deep opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
									Ask this
									<Icon name="arrow-right" className="size-3.5" />
								</span>
							</Card>
						))}
					</div>

					<form
						noValidate
						className="mt-6"
						onSubmit={(e) => {
							e.preventDefault()
							const form = e.currentTarget
							const input = form.elements.namedItem('freeform') as HTMLInputElement
							const value = input.value.trim()
							if (!value) return
							trackUmamiEvent('llamaai-landing-freeform-submit', { question: value.slice(0, 50) })
							if (!loaders.userLoading && isAuthenticated) {
								setPendingPrompt(value)
								setPendingEntrySource('landing')
								void router.push('/ai/chat')
							} else {
								setPendingPrompt(value)
								setPendingEntrySource('landing')
								setSignupSource('llamaai-landing')
								signIn.open(value)
							}
						}}
					>
						<ComposerFrame layout="row" tone="gold">
							<input
								name="freeform"
								type="text"
								aria-label="Ask your own question"
								placeholder="Or ask your own question…"
								className="min-h-8 min-w-0 flex-1 bg-transparent px-1.5 py-1 body-lg text-primary outline-hidden placeholder:text-tertiary sm:body-md"
							/>
							<GoldCta type="submit" size="md">
								Ask
								<Icon name="arrow-right" className="size-3.5" />
							</GoldCta>
						</ComposerFrame>
					</form>
				</section>
			)}
			<SignInModal {...signIn.dialogProps} prompt="Sign in to get your answer — free" />
		</>
	)
}

function TrialBadge({ centered = false }: { centered?: boolean }) {
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()
	if (isAuthenticated && hasActiveSubscription) return null

	return (
		<p
			className={clsx('mt-3 body-md text-balance text-tertiary', centered ? 'text-center' : 'text-center md:text-left')}
		>
			{`${WELCOME_WEEK_ALLOWANCE} — 7-day Pro trial available`}
		</p>
	)
}

function MobileAppButton() {
	return (
		<Button
			as={BasicLink}
			variant="secondary"
			size="lg"
			href="/app"
			data-umami-event="mobile-app-ai-landing-hero-click"
			className="relative z-10"
		>
			<img src="/assets/app/app-icon.png" alt="" width={20} height={20} className="size-5 shrink-0 rounded-md" />
			<span>Get the mobile app</span>
		</Button>
	)
}

function MobileAppCard() {
	return (
		<Card padding="none" className="relative overflow-hidden">
			<div className="relative z-10 flex flex-col gap-5 p-5 sm:p-6 sm:pr-44">
				<div className="flex items-start gap-3">
					<img src="/assets/app/app-icon.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
					<div>
						<h3 className="font-semibold text-primary">Take LlamaAI with you</h3>
						<p className="mt-1 max-w-md body-md text-secondary">
							Full theses, forecasts, backtests and alerts on iOS and Android — plus extra free queries.
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
					<StoreButtons eventSuffix="ai-landing" size="sm" className="sm:items-start" />
					<BasicLink
						href="/app"
						data-umami-event="mobile-app-ai-landing-card-click"
						className="group inline-flex items-center gap-1 label-md text-ai-gold-deep"
					>
						Learn more
						<Icon
							name="arrow-right"
							height={12}
							width={12}
							className="transition-transform duration-200 group-hover:translate-x-0.5"
						/>
					</BasicLink>
				</div>
			</div>
			<img
				src="/assets/app/thesis.webp"
				alt=""
				aria-hidden="true"
				width={760}
				height={1245}
				loading="lazy"
				className="pointer-events-none absolute top-6 -right-6 hidden w-40 -rotate-6 rounded-3xl border border-subtle shadow-raised sm:block"
			/>
		</Card>
	)
}

function CTAButton() {
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()

	if (loaders.userLoading) {
		return (
			<GoldCta as="span" size="lg" aria-disabled className="relative z-10">
				<svg className="size-4 shrink-0">
					<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
				</svg>
				<span>LlamaAI</span>
			</GoldCta>
		)
	}

	return isAuthenticated && hasActiveSubscription ? (
		<GoldCta
			as={BasicLink}
			size="lg"
			href="/ai/chat"
			data-umami-event="llamaai-landing-cta-subscribed"
			className="relative z-10"
		>
			<svg className="size-4 shrink-0">
				<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
			</svg>
			<span>Ask LlamaAI</span>
		</GoldCta>
	) : (
		<GoldCta
			as="a"
			size="lg"
			href="#free-questions"
			onClick={(e) => {
				e.preventDefault()
				document.getElementById('free-questions')?.scrollIntoView({ behavior: 'smooth' })
			}}
			data-umami-event="llamaai-landing-cta-unsubscribed"
			className="relative z-10"
		>
			<svg className="size-4 shrink-0">
				<use href="/assets/llamaai/ask-llamaai-3.svg#ai-icon" />
			</svg>
			<span>Try LlamaAI for free</span>
		</GoldCta>
	)
}

function ExampleShowcase() {
	const [current, setCurrent] = useState(0)
	const [isTransitioning, setIsTransitioning] = useState(false)
	// Hovering or focusing the showcase holds its example, so it never changes under the reader.
	const [hovered, setHovered] = useState(false)
	const [focused, setFocused] = useState(false)
	const paused = hovered || focused

	const goTo = (index: number) => {
		setIsTransitioning(true)
		setTimeout(() => {
			setCurrent(index)
			setIsTransitioning(false)
		}, 200)
	}

	// The next example after 6s; picking one restarts the wait, since it changes `current`.
	useEffect(() => {
		if (paused) return
		const timer = setTimeout(() => {
			setIsTransitioning(true)
			setTimeout(() => {
				setCurrent((current + 1) % EXAMPLE_CONVERSATIONS.length)
				setIsTransitioning(false)
			}, 200)
		}, 6000)
		return () => clearTimeout(timer)
	}, [paused, current])

	const example = EXAMPLE_CONVERSATIONS[current]

	return (
		<div
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onFocus={() => setFocused(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
			}}
		>
			<div className="mb-3 flex items-start gap-2.5 px-1">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-subtle bg-surface-elevated-1 body-md">
					👤
				</div>
				<div>
					<span className="mb-1 block title-sm tracking-wider text-ai-gold-deep uppercase">{example.category}</span>
					<span className="label-md text-secondary">&ldquo;{example.prompt}&rdquo;</span>
				</div>
			</div>

			<Card
				as="a"
				padding="none"
				href={example.url}
				target="_blank"
				rel="noopener noreferrer"
				onClick={() => trackUmamiEvent('llamaai-landing-showcase-click', { example: example.id })}
				className="hover-wash-card group relative block overflow-hidden"
			>
				<div
					className={clsx(
						'relative aspect-4/3 w-full overflow-hidden bg-surface-elevated-1 transition-opacity duration-200',
						isTransitioning ? 'opacity-0' : 'opacity-100'
					)}
				>
					<img
						src={`${example.screenshot}.png`}
						alt={`LlamaAI ${example.category} example`}
						className="hidden size-full object-cover object-top dark:block"
					/>
					<img
						src={`${example.screenshot}-light.png`}
						alt={`LlamaAI ${example.category} example`}
						className="block size-full object-cover object-top dark:hidden"
					/>
					<div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
						<span
							aria-hidden="true"
							className="absolute inset-0 bg-linear-to-t from-ai-black via-transparent to-transparent opacity-50"
						/>
						<span className="relative flex items-center gap-2 rounded-full bg-ai-gold-bright px-5 py-2.5 title-md text-ai-on-gold">
							View full conversation
							<Icon name="arrow-up-right" height={14} width={14} />
						</span>
					</div>
				</div>
				<div className="flex items-center justify-between px-4 py-3">
					<span className="body-md text-tertiary">{example.description}</span>
					<span className="flex shrink-0 items-center gap-1 title-md text-ai-gold-deep">
						View
						<Icon name="arrow-up-right" className="size-3.5" />
					</span>
				</div>
			</Card>

			<div className="mt-1 flex items-center justify-center">
				{EXAMPLE_CONVERSATIONS.map((conversation, i) => (
					// The padding is the tap area; the bar inside is the mark.
					<button
						type="button"
						key={conversation.id}
						onClick={() => goTo(i)}
						aria-current={i === current ? 'true' : undefined}
						className="group rounded-full px-1 py-2"
						aria-label={`Show example ${i + 1}`}
					>
						<span
							className={clsx(
								'block h-1.5 rounded-full transition-all duration-300',
								i === current ? 'w-6 bg-ai-gold' : 'w-1.5 bg-ai-gold-muted group-hover:bg-ai-gold'
							)}
						/>
					</button>
				))}
			</div>
		</div>
	)
}

const CATEGORY_TAGS: Record<string, string> = {
	find_alpha: 'Find alpha',
	analytics: 'Analytics',
	speculative_guidance: 'Trade thesis',
	learn: 'Learn',
	research_report: 'Research'
}

export const getStaticProps = withPerformanceLogging('ai', async () => {
	let landingQuestions: Array<LandingQuestion> = []
	try {
		const res = await fetchWithPoolingOnServer(`${AI_SERVER}/suggested-questions/landing`)
		if (res.ok) {
			const data = await res.json()
			if (data?.questions?.length) {
				landingQuestions = data.questions
			} else if (data?.categories) {
				const cats = Object.entries(data.categories) as Array<[string, Array<string>]>
				for (const [cat, questions] of cats) {
					const tag = CATEGORY_TAGS[cat] || cat.replace(/_/g, ' ')
					for (const q of questions.slice(0, 2)) {
						landingQuestions.push({ text: q, tag })
					}
				}
				landingQuestions = landingQuestions.sort(() => Math.random() - 0.5).slice(0, 9)
			}
		}
	} catch {
		// The landing renders without suggested questions if the fetch fails.
	}

	return {
		props: { landingQuestions },
		revalidate: maxAgeForNext([22])
	}
})

export default function LlamaAIGetStarted({ landingQuestions }: { landingQuestions?: Array<LandingQuestion> }) {
	const [isVideoPlaying, setIsVideoPlaying] = useState(false)

	const isClient = useIsClient()

	return (
		<>
			<SEO
				title="AI Crypto Analysis - DeFi & TradFi Data - LlamaAI"
				description="AI-powered research across DeFi, TradFi, and onchain data. Parallel agents, scheduled alerts, custom memory, and DefiLlama's full dataset through natural conversation."
				canonicalUrl="/ai"
			/>
			<LlamaAIMobileAppPromotion />
			<div className="col-span-full flex min-h-screen flex-col overflow-x-hidden bg-page">
				{/* Header */}
				<header className="relative z-20 px-4 pt-4 md:px-8 md:pt-6">
					<BasicLink
						href="/"
						className="inline-block w-fit opacity-70 transition-opacity duration-300 hover:opacity-100"
					>
						<span className="sr-only">Navigate to DeFi Dashboard</span>
						<img
							src="/assets/defillama.webp"
							height={36}
							width={105}
							className="hidden object-contain object-left dark:block"
							alt=""
						/>
						<img
							src="/assets/defillama-dark.webp"
							height={36}
							width={105}
							className="object-contain object-left dark:hidden"
							alt=""
						/>
					</BasicLink>
				</header>

				{/* Hero Section */}
				<section className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-12 pb-16 md:px-8 md:pt-16 md:pb-20">
					<div className="grid items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-16">
						{/* Left: Text Content */}
						<div
							className={clsx(
								'relative z-10 flex flex-col items-center text-center md:items-start md:text-left',
								'transition-all duration-700',
								isClient ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
							)}
						>
							<div className="relative mb-8">
								<span
									className="absolute inset-0 -m-8 block rounded-full"
									style={{
										background: 'radial-gradient(circle, var(--ai-gold-bright) 0%, transparent 65%)',
										filter: 'blur(30px)',
										opacity: 0.6
									}}
								/>
								<span
									className="absolute inset-0 -m-4 block rounded-full"
									style={{
										background: 'radial-gradient(circle, var(--ai-gold-bright) 0%, transparent 60%)',
										filter: 'blur(15px)',
										opacity: 0.4
									}}
								/>
								<img
									src="/assets/llamaai/llama-ai.svg"
									alt=""
									className="relative size-20 object-contain drop-shadow-ai-gold md:size-24"
								/>
							</div>
							<h1 className="mb-6 text-[3rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-primary md:text-[4rem] lg:text-[4.5rem]">
								<span className="bg-linear-to-r from-ai-gold to-ai-gold-deep bg-clip-text text-transparent">
									LlamaAI
								</span>
							</h1>
							<p className="mb-8 max-w-lg text-lg leading-relaxed text-tertiary md:text-xl">
								AI-powered research: DeFi and TradFi data with live insights and actionable analysis.
							</p>
							<div className="relative z-20 flex flex-col items-center md:items-start">
								<div className="flex flex-col items-center gap-3 sm:flex-row">
									<CTAButton />
									<MobileAppButton />
								</div>
								<TrialBadge />
							</div>
						</div>

						{/* Right: Rotating Showcase */}
						<div
							className={clsx(
								'relative w-full pt-4',
								'transition-all delay-200 duration-700',
								isClient ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
							)}
						>
							<ExampleShowcase />
						</div>
					</div>
				</section>

				{/* Capability Strip - Desktop: single row of 5, Mobile: 3 top + 2 bottom centered */}
				<section className="relative z-10 mx-auto max-w-5xl px-4 pb-10 md:px-8">
					{/* Desktop: all 5 in one row */}
					<div className="hidden overflow-hidden rounded-xl border border-subtle bg-border-subtle md:grid md:grid-cols-5 md:gap-px">
						{CAPABILITIES.map((cap) => (
							<div key={cap.label} className="flex flex-col items-center gap-1.5 bg-surface px-3 py-4 text-center">
								<Icon name={cap.icon} height={18} width={18} className="text-ai-gold" />
								<span className="title-sm text-tertiary">{cap.label}</span>
								<span className="body-xs text-tertiary">{cap.sub}</span>
							</div>
						))}
					</div>
					{/* Mobile: top row of 3, bottom row of 2 centered */}
					<div className="flex flex-col items-center md:hidden">
						<div className="grid w-full grid-cols-3 gap-px overflow-hidden rounded-t-xl border-x border-t border-subtle bg-border-subtle">
							{CAPABILITIES.slice(0, 3).map((cap) => (
								<div key={cap.label} className="flex flex-col items-center gap-1.5 bg-surface px-3 py-4 text-center">
									<Icon name={cap.icon} height={18} width={18} className="text-ai-gold" />
									<span className="title-sm text-tertiary">{cap.label}</span>
									<span className="body-xs text-tertiary">{cap.sub}</span>
								</div>
							))}
						</div>
						<div className="grid w-2/3 grid-cols-2 gap-px overflow-hidden rounded-b-xl border-x border-b border-subtle bg-border-subtle">
							{CAPABILITIES.slice(3).map((cap) => (
								<div key={cap.label} className="flex flex-col items-center gap-1.5 bg-surface px-3 py-4 text-center">
									<Icon name={cap.icon} height={18} width={18} className="text-ai-gold" />
									<span className="title-sm text-tertiary">{cap.label}</span>
									<span className="body-xs text-tertiary">{cap.sub}</span>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Free Questions */}
				{isClient && <FreeQuestionsSection landingQuestions={landingQuestions} />}

				{/* Bento Grid */}
				<section className="relative z-10 px-4 pb-20 md:px-8 md:pb-28">
					<div className="mx-auto max-w-5xl">
						<h2 className="mb-8 text-center text-[1.75rem] font-extrabold tracking-[-0.02em] text-primary md:mb-10 md:text-[2rem]">
							Every metric. Every market. One conversation.
						</h2>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{/* DeFi & TradFi - wide card */}
							<div className="group relative overflow-hidden rounded-2xl border border-subtle bg-surface p-6 pb-5 md:col-span-2">
								<h3 className="mb-1.5 title-lg text-ai-gold-deep">DeFi, TradFi & Onchain</h3>
								<p className="mb-4 max-w-lg body-md text-tertiary">
									DefiLlama's 5,000+ protocols paired with stocks, macro, and onchain data. Questions that used to need
									multiple tools and tabs are now single prompts.
								</p>
								<div className="overflow-hidden rounded-lg border border-subtle bg-surface-elevated-1">
									<div className="flex items-center justify-between border-b border-subtle px-3 py-2">
										<span className="label-sm text-secondary">5 tool calls</span>
										<span className="body-xs text-tertiary">
											<span className="text-success">5/5 ok</span> 6921ms
										</span>
									</div>
									<div className="space-y-0 divide-y divide-(--border-subtle)">
										{[
											{ key: 'load_skill', time: '2ms' },
											{ key: 'execute_sql', time: '31ms', detail: '64 rows' },
											{ key: 'valyu_search', time: '6579ms', detail: '42 rows' },
											{ key: 'execute_code', time: '14ms' },
											{ key: 'generate_chart', time: '295ms' }
										].map((tool) => {
											const meta = TOOL_ICONS[tool.key] || { icon: 'sparkles', tone: 'neutral' }
											return (
												<div key={tool.key} className="flex items-center gap-2 px-3 py-1.5">
													<Icon
														name={meta.icon as any}
														height={12}
														width={12}
														className={`shrink-0 ${TOOL_TONE_CLASS[meta.tone]}`}
													/>
													<span className="flex-1 truncate body-sm text-secondary">{TOOL_LABELS[tool.key]}</span>
													<span className="label-xs text-success">ok</span>
													<span className="body-xs text-tertiary tabular-nums">{tool.time}</span>
													{tool.detail ? (
														<span className="body-xs text-tertiary tabular-nums">{tool.detail}</span>
													) : null}
												</div>
											)
										})}
									</div>
								</div>
							</div>

							{/* Scheduled Alerts */}
							<div className="group relative overflow-hidden rounded-2xl border border-subtle bg-surface p-6 pb-5">
								<h3 className="mb-1.5 title-lg text-ai-gold-deep">Scheduled alerts</h3>
								<p className="mb-4 body-md text-tertiary">
									Automate recurring prompts. Set up daily price checks, portfolio summaries, or custom data monitors on
									your schedule.
								</p>
								<div className="overflow-hidden rounded-lg border border-subtle bg-surface-elevated-1">
									<div className="border-b border-subtle px-3 py-2">
										<div className="flex items-center gap-2">
											<div className="flex size-5 items-center justify-center rounded-sm bg-ai-gold-tint">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="11"
													height="11"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													className="text-ai-gold"
												>
													<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
													<line x1="16" y1="2" x2="16" y2="6" />
													<line x1="8" y1="2" x2="8" y2="6" />
													<line x1="3" y1="10" x2="21" y2="10" />
												</svg>
											</div>
											<span className="title-sm text-secondary">Your alerts</span>
										</div>
									</div>
									<div className="flex items-center gap-2 px-3 py-2.5">
										<div className="min-w-0 flex-1">
											<p className="truncate label-sm text-secondary">Daily crypto price check</p>
											<p className="body-xs text-tertiary">Daily at 9 AM UTC</p>
										</div>
										<div className="h-3.5 w-6 shrink-0 rounded-full bg-brand p-0.5">
											<div className="size-2.5 translate-x-2.5 rounded-full bg-on-brand shadow-raised" />
										</div>
									</div>
								</div>
							</div>

							{/* Memory & Settings */}
							<div className="group relative overflow-hidden rounded-2xl border border-subtle bg-surface p-6 pb-5">
								<h3 className="mb-1.5 title-lg text-ai-gold-deep">Customize your experience</h3>
								<p className="mb-4 body-md text-tertiary">
									LlamaAI learns what you care about and tailors responses to your style. Set custom instructions and
									let memory build your profile across sessions.
								</p>
								<div className="overflow-hidden rounded-lg border border-subtle bg-surface-elevated-1">
									<div className="border-b border-subtle px-3 py-2">
										<div className="flex items-center gap-2">
											<div className="flex size-5 items-center justify-center rounded-sm bg-brand-tint-strong">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="11"
													height="11"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													className="text-link"
												>
													<circle cx="12" cy="12" r="3" />
													<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
												</svg>
											</div>
											<span className="title-sm text-secondary">Settings</span>
										</div>
									</div>
									<div className="space-y-0 divide-y divide-(--border-subtle)">
										<div className="px-3 py-2">
											<p className="label-sm text-secondary">Custom instructions</p>
											<p className="body-xs text-tertiary">Be concise. Always include % changes.</p>
										</div>
										<div className="flex items-center gap-2 px-3 py-2">
											<div className="min-w-0 flex-1">
												<p className="label-sm text-secondary">Remember my preferences</p>
											</div>
											<div className="h-3.5 w-6 shrink-0 rounded-full bg-brand p-0.5">
												<div className="size-2.5 translate-x-2.5 rounded-full bg-on-brand shadow-raised" />
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Research Reports - wide card */}
							<div className="group relative overflow-hidden rounded-2xl border border-subtle bg-surface p-6 pb-5 md:col-span-2">
								<h3 className="mb-1.5 title-lg text-ai-gold-deep">Research reports</h3>
								<p className="mb-4 max-w-lg body-md text-tertiary">
									Generate in-depth research reports on any protocol, sector, or trend. Multiple agents research in
									parallel, then synthesize everything into a single exportable PDF.
								</p>
								<div className="overflow-hidden rounded-lg border border-subtle bg-surface-elevated-1">
									<div className="flex items-center gap-2.5 border-b border-subtle px-3 py-2">
										<span className="body-md">🦙</span>
										<span className="flex-1 label-sm text-secondary">Researching in parallel…</span>
										<span className="rounded-sm bg-surface-elevated-2 px-1.5 py-0.5 label-xs text-secondary">
											1/3 done
										</span>
										<span className="rounded-sm bg-surface-elevated-2 px-1.5 py-0.5 mono-sm text-secondary">01:27</span>
									</div>
									<div className="space-y-1.5 px-3 py-2.5">
										<div className="flex items-center gap-2">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="10"
												height="10"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												className="text-success"
												strokeWidth="3"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<polyline points="20 6 9 17 4 12" />
											</svg>
											<span className="body-sm text-secondary">
												<span className="font-medium text-secondary">regulatory</span> Complete (19 tools, 3 charts)
											</span>
										</div>
										<div className="flex items-center gap-2">
											<div className="size-2.5 shrink-0 rounded-full bg-brand" />
											<span className="body-sm text-secondary">
												<span className="font-medium text-secondary">market_dynamics</span> {TOOL_LABELS.generate_chart}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<div className="size-2.5 shrink-0 rounded-full bg-brand" />
											<span className="body-sm text-secondary">
												<span className="font-medium text-secondary">competitive_positioning</span>{' '}
												{TOOL_LABELS.web_search}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Demo Video */}
				<section className="relative z-10 px-4 pb-20 md:px-8 md:pb-28">
					<div className="mx-auto max-w-5xl">
						<div className="mb-6 text-center">
							<h2 className="mb-3 text-[1.75rem] font-extrabold tracking-[-0.02em] text-primary md:text-[2rem]">
								See it in action
							</h2>
							<p className="body-lg text-tertiary">Watch a full walkthrough of LlamaAI</p>
						</div>
						<div className="group relative overflow-hidden rounded-2xl border border-subtle">
							<div className="relative aspect-video w-full">
								{!isVideoPlaying ? (
									<button
										type="button"
										onClick={() => {
											trackUmamiEvent('llamaai-landing-video-play')
											setIsVideoPlaying(true)
										}}
										className="absolute inset-0 z-10 flex items-center justify-center"
										aria-label="Play demo video"
									>
										<img
											src="https://img.youtube.com/vi/rEJz1gfC0Oc/maxresdefault.jpg"
											alt="LlamaAI Demo"
											className="absolute inset-0 size-full object-cover"
										/>
										<div className="absolute inset-0 bg-linear-to-t from-ai-black to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40" />
										<div className="relative z-10 flex size-16 items-center justify-center rounded-full bg-linear-to-br from-ai-gold-bright to-ai-gold shadow-ai-halo-strong md:size-20">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 24 24"
												fill="currentColor"
												className="ml-1 size-6 text-ai-on-gold-strong md:size-8"
											>
												<path d="M8 5.14v14l11-7-11-7z" />
											</svg>
										</div>
										<span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ai-ink-scrim px-3 py-1.5 label-sm text-ai-white backdrop-blur-sm md:bottom-6 md:px-4 md:py-2 md:label-md">
											Watch demo
										</span>
									</button>
								) : (
									// oxlint-disable-next-line react/iframe-missing-sandbox -- YouTube embeds require allow-scripts + allow-same-origin which the rule forbids
									<iframe
										// Replaces the Play button that had focus, so the player takes it.
										ref={takeLostFocus}
										src="https://www.youtube.com/embed/rEJz1gfC0Oc?si=0DD5sxzyUpC7GO14&autoplay=1"
										title="LlamaAI Demo"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
										referrerPolicy="strict-origin-when-cross-origin"
										allowFullScreen
										className="absolute inset-0 size-full"
									/>
								)}
							</div>
						</div>
					</div>
				</section>

				{/* FAQ */}
				<section className="relative z-10 px-4 pb-24 md:px-8 md:pb-32">
					<div className="mx-auto max-w-3xl">
						<h2 className="mb-8 text-center text-[1.75rem] font-extrabold tracking-[-0.02em] text-primary md:mb-10 md:text-[2rem]">
							FAQs
						</h2>

						<div className="divide-y divide-(--border-subtle) border-t border-subtle">
							<FAQ question="What is LlamaAI?">
								<p>
									Your AI research assistant for DeFi and financial markets. Ask questions in plain language and get
									ranked tables, custom charts, research reports, and analysis. LlamaAI combines DefiLlama's
									comprehensive dataset with TradFi data, onchain analytics, and real-time web search.
								</p>
							</FAQ>
							<FAQ question="What can it do right now?">
								<p className="mb-2">Across protocols, chains, categories, and tokens, LlamaAI can:</p>
								<ul className="flex list-disc flex-col gap-1.5 pl-4">
									<li>Run complex multi-factor queries (e.g., growing TVL + revenue but declining token price)</li>
									<li>Generate custom charts and export data as CSV</li>
									<li>Write in-depth research reports on any topic</li>
									<li>Query DeFi, TradFi (stocks, ETFs, macro), and onchain data in a single prompt</li>
									<li>Set up scheduled alerts for automated research (e.g., daily price checks)</li>
									<li>Remember your preferences, yield criteria, and custom instructions across sessions</li>
								</ul>
							</FAQ>
							<FAQ question="What data does LlamaAI have access to?">
								<p>
									DefiLlama's complete dataset, onchain data across EVM chains, TradFi data (stocks, ETFs, macros), and
									real-time web search for the latest context.
								</p>
							</FAQ>
							<FAQ question="Who has access?">
								<p>
									LlamaAI is included in all paid subscriptions along with the DefiLlama Pro features. Signed-in users
									can also use it for free:{' '}
									{`${WELCOME_WEEK_ALLOWANCE}, then ${FREE_DAILY_ALLOWANCE} and ${FREE_RESEARCH_ALLOWANCE}.`}
								</p>
							</FAQ>
							<FAQ question="What sort of prompts can it answer?">
								<ul className="flex list-disc flex-col gap-1.5 pl-4">
									<li>&quot;Which protocols have growing TVL and revenue but declining token prices?&quot;</li>
									<li>&quot;Give me a chart of total app revenue divided by category&quot;</li>
									<li>&quot;What are the best stablecoin yields with at least $10M TVL?&quot;</li>
									<li>&quot;Deep dive into Hyperliquid&quot;</li>
									<li>&quot;What are the probabilities that ETH price will go lower?&quot;</li>
									<li>&quot;What are the top tokens traded on CowSwap over the last 30 days?&quot;</li>
									<li>&quot;How is AAPL performing relative to BTC this quarter?&quot;</li>
								</ul>
							</FAQ>
							<FAQ question="Can I export results?">
								<p>Yes. Tables and charts export as CSV, and research reports can be downloaded as PDF.</p>
							</FAQ>
							<FAQ question="Is this investment advice?">
								<p>
									LlamaAI provides data and analysis to support your research, not replace it. Always verify and think
									critically.
								</p>
							</FAQ>
							<FAQ question="Need help?">
								<p>
									Contact{' '}
									<a
										href="mailto:support@defillama.com"
										className="text-ai-gold-deep underline decoration-ai-gold-muted transition-colors hover:decoration-current"
									>
										support@defillama.com
									</a>
								</p>
							</FAQ>
						</div>
					</div>
				</section>

				{/* Other ways to use LlamaAI: mobile app + MCP */}
				<section className="relative z-10 -mt-12 px-4 pb-10 md:-mt-16 md:px-8 md:pb-14">
					<div className="mx-auto flex max-w-3xl flex-col gap-4">
						<MobileAppCard />
						{/* Card's surface fill cannot carry the MCP violet, so this upsell keeps its own fill and border on Card's
						    shape: 8px, the card wash on hover, no lift. */}
						<BasicLink
							href="/mcp"
							onClick={() => trackUmamiEvent('llamaai-mcp-upsell-click')}
							className="hover-wash-card group flex flex-col gap-4 rounded-lg border border-ai-violet-muted bg-ai-violet-faint p-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h3 className="font-semibold text-primary">
									Building with AI agents? <span className="text-ai-violet">Try our MCP Server</span>
								</h3>
								<p className="mt-1 max-w-lg body-md text-secondary">
									Connect Claude, Cursor, OpenClaw, or any MCP-compatible agent directly to DefiLlama's data. 23 tools
									for TVL, yields, prices, protocol metrics, and more.
								</p>
							</div>
							<span className="flex min-h-8 shrink-0 items-center self-start rounded-lg border border-ai-violet-muted px-3 py-1.5 label-sm text-ai-violet group-hover:bg-ai-violet-tint group-focus-visible:bg-ai-violet-tint sm:self-center">
								Explore MCP
							</span>
						</BasicLink>
					</div>
				</section>

				{/* Final CTA */}
				<section className="relative z-10 px-4 pb-16 md:px-8 md:pb-24">
					<div className="mx-auto max-w-3xl">
						<div className="relative overflow-hidden rounded-2xl border border-subtle bg-linear-to-br from-surface via-surface to-ai-gold-tint">
							<div className="pointer-events-none absolute inset-0 overflow-hidden">
								<div
									className="absolute -right-16 -bottom-16 size-48 rounded-full opacity-30"
									style={{
										background: 'radial-gradient(circle, var(--ai-gold-bright) 0%, transparent 70%)',
										filter: 'blur(40px)'
									}}
								/>
								<div
									className="absolute -top-8 -left-8 size-32 rounded-full opacity-20"
									style={{
										background: 'radial-gradient(circle, var(--ai-gold-bright) 0%, transparent 70%)',
										filter: 'blur(30px)'
									}}
								/>
							</div>

							<div className="relative z-10 px-6 py-10 text-center md:px-10 md:py-12">
								<h3 className="mb-3 text-xl font-extrabold tracking-[-0.02em] text-primary md:text-2xl">
									Ready to use LlamaAI?
								</h3>
								<p className="mx-auto mb-6 max-w-md body-md text-secondary md:body-lg">
									Research protocols, generate charts, and stay ahead of the market.
								</p>
								<CTAButton />
								<TrialBadge centered />
							</div>
						</div>
					</div>
				</section>
			</div>
		</>
	)
}

function FAQ({ question, children }: { question: string; children: React.ReactNode }) {
	return (
		<details className="group">
			<summary className="flex cursor-pointer items-center gap-4 py-4 md:py-5">
				<span className="flex-1 label-md text-primary transition-colors group-hover:text-ai-gold-deep md:label-lg">
					{question}
				</span>
				<Icon
					name="chevron-down"
					height={16}
					width={16}
					className="shrink-0 text-tertiary transition-transform duration-200 group-open:rotate-180"
				/>
			</summary>
			<div className="pb-4 body-md text-secondary md:pb-5">{children}</div>
		</details>
	)
}
