import { useEffect, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { SubscriptionBackground, SubscriptionFooter, SubscriptionHeader } from '~/containers/Subscription/sections'
import { Icon } from '~/ui/Icon'

export const APP_STORE_URL = 'https://apps.apple.com/us/app/defillama-defi-tracker/id6761379469'
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.defillama.mobile'

const FEATURES = [
	{
		icon: 'sparkles',
		title: 'Ask LlamaAI anything',
		description:
			'Your AI research analyst. Ask about any token, protocol, chain or wallet and get an answer built on DefiLlama data.'
	},
	{
		icon: 'file-text',
		title: 'Full investment theses',
		description:
			'A verdict, a conviction score and the reasoning behind it — where an asset stands, what the risks are, what would change the call.'
	},
	{
		icon: 'bar-chart-2',
		title: 'Charts on demand',
		description: 'Normalized return charts for any set of assets over any timeframe, with the key read written out.'
	},
	{
		icon: 'trending-up',
		title: 'Forecasts and simulations',
		description: 'Monte Carlo forecasts with p5/p50/p95 bands to see where a price could be headed. No code required.'
	},
	{
		icon: 'activity',
		title: 'Strategy backtests',
		description:
			'Test an idea on historical data and read the equity curve and performance summary before risking capital.'
	},
	{
		icon: 'clock',
		title: 'Scheduled alerts',
		description: 'Save a question as an alert and let it run on a schedule, so the answer comes to you.'
	}
] as const

const ASK_EXAMPLES = [
	'Protocol analysis',
	'Wallet analysis',
	'Income statements',
	'Monte Carlo',
	'Liquidations',
	'Deep research'
] as const

const PREVIEWS = [
	{
		src: '/assets/app/compare.webp',
		caption: 'Compare any asset across any timeframe',
		alt: 'LlamaAI in the DefiLlama app comparing ETH, BTC and SOL normalized returns over 365 days'
	},
	{
		src: '/assets/app/forecast.webp',
		caption: 'Price forecasts and simulations',
		alt: 'LlamaAI in the DefiLlama app running a 90-day Monte Carlo forecast with p5, p50 and p95 bands'
	},
	{
		src: '/assets/app/backtest.webp',
		caption: 'Backtest before risking capital',
		alt: 'LlamaAI in the DefiLlama app showing the equity curve of a BTC 15 minute breakout backtest'
	}
] as const

const FLOATING_CHIPS = [
	{
		icon: 'file-text',
		label: 'Full investment theses',
		className: 'top-[14%] -left-[132px]'
	},
	{
		icon: 'trending-up',
		label: 'Monte Carlo forecasts',
		className: 'top-[46%] -right-[132px] [animation-delay:2s]'
	},
	{
		icon: 'activity',
		label: 'Strategy backtests',
		className: 'bottom-[12%] -left-[108px] [animation-delay:4s]'
	}
] as const

// Detected after mount so the server-rendered markup keeps both store links:
// crawlers and unknown platforms see the full pair, phones narrow to their own store.
export function useDevicePlatform(): 'ios' | 'android' | null {
	const [platform, setPlatform] = useState<'ios' | 'android' | null>(null)

	useEffect(() => {
		const ua = navigator.userAgent
		// iPads report a Macintosh UA, so touch points are what separate them from desktop Safari
		if (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) {
			setPlatform('ios')
		} else if (/Android/.test(ua)) {
			setPlatform('android')
		}
	}, [])

	return platform
}

// Official badge glyphs (Apple artwork, Google artwork + brand colors) rendered on our
// own dark buttons so the pair matches in weight, corners and height in both themes.
// Fixed button size keeps the pair identical; artwork fills the height and centers.
const storeButtonSizeClassNames = {
	md: 'h-12 w-44 md:h-14 md:w-[196px]',
	lg: 'h-14 w-full max-w-[300px]'
} as const
const storeButtonClassName =
	'flex items-center justify-center rounded-xl bg-black transition-opacity duration-200 hover:opacity-85 dark:border dark:border-white/15'
const storeBadgeClassName = 'h-full w-auto'

export function StoreButtons({
	className = '',
	eventSuffix,
	size = 'md'
}: {
	className?: string
	eventSuffix: string
	size?: keyof typeof storeButtonSizeClassNames
}) {
	const platform = useDevicePlatform()

	return (
		<div className={`flex flex-col items-center gap-3 ${className}`}>
			<div
				className={
					size === 'lg'
						? 'flex w-full flex-col items-center gap-3'
						: 'flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row'
				}
			>
				{platform === 'android' ? null : (
					<a
						href={APP_STORE_URL}
						target="_blank"
						rel="noopener noreferrer"
						data-umami-event={`mobile-app-ios-${eventSuffix}`}
						className={`${storeButtonClassName} ${storeButtonSizeClassNames[size]}`}
					>
						<img
							src="/assets/app/app-store-badge.svg"
							alt="Download on the App Store"
							width={120}
							height={40}
							className={storeBadgeClassName}
						/>
					</a>
				)}
				{platform === 'ios' ? null : (
					<a
						href={PLAY_STORE_URL}
						target="_blank"
						rel="noopener noreferrer"
						data-umami-event={`mobile-app-android-${eventSuffix}`}
						className={`${storeButtonClassName} ${storeButtonSizeClassNames[size]}`}
					>
						<img
							src="/assets/app/google-play-badge.svg"
							alt="Get it on Google Play"
							width={239}
							height={71}
							className={storeBadgeClassName}
						/>
					</a>
				)}
			</div>

			{platform ? (
				<a
					href={platform === 'ios' ? PLAY_STORE_URL : APP_STORE_URL}
					target="_blank"
					rel="noopener noreferrer"
					data-umami-event={`mobile-app-other-store-${eventSuffix}`}
					className="text-xs text-sub-text-muted underline"
				>
					{platform === 'ios' ? 'Also on Google Play' : 'Also on the App Store'}
				</a>
			) : null}
		</div>
	)
}

const chipClassName =
	'rounded-full border border-sub-border bg-sub-surface-panel px-3 py-1.5 text-xs text-sub-text-secondary dark:bg-sub-dark-card'

function QuotaChips() {
	return (
		<div className="flex flex-wrap justify-center gap-2">
			<span className={chipClassName}>3 prompts without an account</span>
			<span className={chipClassName}>10 a day once you sign in</span>
			<span className={chipClassName}>
				Unlimited on{' '}
				<BasicLink href="/subscription" className="underline">
					DefiLlama Pro
				</BasicLink>
			</span>
		</div>
	)
}

const sectionHeadingClassName =
	'text-3xl leading-10 font-semibold tracking-tight text-sub-text-primary md:text-[40px] md:leading-[1.15]'

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
	return <section className={`mx-auto max-w-[1440px] px-4 md:px-10 2xl:px-32 ${className}`}>{children}</section>
}

function GradientWord({ children }: { children: React.ReactNode }) {
	return (
		<span className="bg-linear-to-r from-sub-purple to-sub-purple-soft bg-clip-text text-transparent">{children}</span>
	)
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
	return <span className="text-xs font-semibold tracking-[0.18em] text-sub-purple uppercase">{children}</span>
}

function HeroPhone() {
	return (
		<div className="relative">
			{/* aura + rings behind the phone */}
			<div
				aria-hidden="true"
				className="absolute top-1/2 left-1/2 size-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sub-brand-primary/25 blur-[90px] md:size-[500px] md:blur-[130px] dark:bg-sub-blue/35"
			/>
			<div
				aria-hidden="true"
				className="absolute top-1/2 left-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sub-brand-primary/10 md:size-[580px]"
			/>
			<div
				aria-hidden="true"
				className="absolute top-1/2 left-1/2 hidden size-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sub-brand-primary/5 md:block"
			/>

			<img
				src="/assets/app/thesis.webp"
				alt="LlamaAI in the DefiLlama app answering “Should I buy ETH right now?” with a full investment thesis"
				width={760}
				height={1245}
				className="relative w-full max-w-[300px] rounded-[2rem] border border-sub-border/60 shadow-2xl shadow-sub-brand-primary/20 md:max-w-[360px]"
			/>

			{FLOATING_CHIPS.map((chip) => (
				<div
					key={chip.label}
					className={`absolute hidden items-center gap-2.5 rounded-2xl border border-sub-border bg-sub-surface-panel/85 py-2.5 pr-4 pl-3 shadow-xl shadow-sub-brand-primary/5 backdrop-blur-md motion-safe:animate-float lg:flex dark:bg-sub-dark-card/85 ${chip.className}`}
				>
					<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sub-brand-primary to-sub-brand-soft text-on-brand">
						<Icon name={chip.icon} height={15} width={15} />
					</span>
					<span className="text-sm font-medium whitespace-nowrap text-sub-text-primary">{chip.label}</span>
				</div>
			))}
		</div>
	)
}

function Hero({ protocols, chains }: { protocols: number; chains: number }) {
	return (
		<Section className="relative flex flex-col items-center gap-14 pt-14 pb-20 md:gap-20 md:pt-24 md:pb-28">
			<div className="flex flex-col items-center gap-6">
				<span className="flex items-center gap-2 rounded-full border border-sub-border bg-sub-surface-panel px-3.5 py-1.5 text-xs font-medium text-sub-text-secondary dark:bg-sub-dark-card">
					<span className="size-1.5 rounded-full bg-sub-live shadow-sub-live" />
					Now on iOS and Android
				</span>

				<h1 className="max-w-[820px] text-center text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-sub-text-primary md:text-7xl">
					Meet <GradientWord>LlamaAI</GradientWord>
				</h1>

				<p className="max-w-[620px] text-center text-lg leading-8 text-sub-text-secondary md:text-xl md:leading-9">
					Your AI research analyst for crypto — full theses, live charts, forecasts and backtests, backed by DefiLlama
					data on {protocols.toLocaleString('en-US')} protocols across {chains.toLocaleString('en-US')} chains.
				</p>

				<StoreButtons className="w-full sm:w-auto" eventSuffix="hero" />

				<QuotaChips />
			</div>

			<HeroPhone />
		</Section>
	)
}

function Features() {
	return (
		<Section className="flex flex-col gap-12 py-16 md:py-24">
			<div className="mx-auto flex max-w-[680px] flex-col items-center gap-4 text-center">
				<SectionEyebrow>LlamaAI</SectionEyebrow>
				<h2 className={sectionHeadingClassName}>DeFi and TradFi data, live insights, actionable analysis</h2>
				<p className="text-base leading-6 text-sub-text-secondary">
					Everything DefiLlama knows, with an analyst that reads it for you and shows the work.
				</p>
				<div className="flex flex-wrap justify-center gap-2">
					{ASK_EXAMPLES.map((example) => (
						<span
							key={example}
							className="rounded-full border border-sub-border bg-sub-surface-panel px-3 py-1.5 text-xs text-sub-text-secondary transition-colors duration-200 hover:border-sub-brand-primary/40 hover:text-sub-text-primary dark:bg-sub-dark-card"
						>
							{example}
						</span>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{FEATURES.map((feature) => (
					<div
						key={feature.title}
						className="flex flex-col gap-3 rounded-2xl border border-sub-border bg-sub-surface-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-sub-brand-primary/40 hover:shadow-sub-blue-glow dark:bg-sub-dark-card"
					>
						<span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-sub-brand-primary to-sub-brand-soft text-on-brand shadow-sub-blue-glow">
							<Icon name={feature.icon} height={20} width={20} />
						</span>
						<h3 className="text-lg leading-6 font-semibold text-sub-text-primary">{feature.title}</h3>
						<p className="text-sm leading-6 text-sub-text-secondary">{feature.description}</p>
					</div>
				))}
			</div>
		</Section>
	)
}

function Previews() {
	return (
		<Section className="flex flex-col gap-12 py-16 md:py-24">
			<div className="mx-auto flex max-w-[640px] flex-col items-center gap-4 text-center">
				<SectionEyebrow>App preview</SectionEyebrow>
				<h2 className={sectionHeadingClassName}>See it in action</h2>
			</div>

			<div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
				{PREVIEWS.map((preview) => (
					<figure key={preview.src} className="flex w-[280px] shrink-0 snap-center flex-col gap-4 md:w-auto">
						<img
							src={preview.src}
							alt={preview.alt}
							width={760}
							height={1245}
							loading="lazy"
							className="w-full rounded-3xl border border-sub-border/60 shadow-xl shadow-black/5 transition-transform duration-300 md:hover:-translate-y-1.5 dark:shadow-black/30"
						/>
						<figcaption className="text-center text-base leading-6 font-medium text-sub-text-secondary">
							{preview.caption}
						</figcaption>
					</figure>
				))}
			</div>
		</Section>
	)
}

function FinalCta() {
	return (
		<Section className="pt-4 pb-16 md:pt-8 md:pb-28">
			<div className="relative overflow-hidden rounded-3xl border border-sub-brand-primary/25 bg-sub-surface-panel px-6 py-14 text-center md:py-20 dark:bg-sub-dark-card">
				<div
					aria-hidden="true"
					className="absolute inset-0 [background-image:var(--sub-grid-image-light)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)] [background-size:52px_52px] opacity-40 dark:[background-image:var(--sub-grid-image-dark)] dark:opacity-25"
				/>
				<div
					aria-hidden="true"
					className="absolute -top-32 left-1/2 h-64 w-[720px] max-w-full -translate-x-1/2 rounded-full bg-sub-brand-primary/20 blur-[100px] dark:bg-sub-blue/25"
				/>

				<div className="relative flex flex-col items-center gap-8">
					<div className="flex max-w-[640px] flex-col items-center gap-4">
						<h2 className="text-3xl leading-10 font-semibold tracking-tight text-sub-text-primary md:text-5xl md:leading-[1.1]">
							Put <GradientWord>LlamaAI</GradientWord> in your pocket
						</h2>
						<p className="max-w-[560px] text-base leading-6 text-sub-text-secondary">
							Try 3 prompts straight away, no account needed. Sign in for 10 free prompts a day, or go unlimited with a
							DefiLlama Pro subscription — the same one that works on the web.
						</p>
					</div>
					<StoreButtons eventSuffix="footer" />
				</div>
			</div>
		</Section>
	)
}

function SectionDivider() {
	return (
		<div
			aria-hidden="true"
			className="mx-auto h-px max-w-5xl bg-linear-to-r from-transparent via-sub-border/70 to-transparent"
		/>
	)
}

export function MobileAppLanding({ protocols, chains }: { protocols: number; chains: number }) {
	return (
		<div className="relative col-span-full min-h-screen w-full [overflow-x:clip] [overflow-y:visible] bg-sub-surface-page text-sub-text-primary dark:bg-sub-dark-page">
			<SubscriptionBackground />
			<SubscriptionHeader />

			<main className="relative z-10">
				<Hero protocols={protocols} chains={chains} />
				<SectionDivider />
				<Features />
				<SectionDivider />
				<Previews />
				<FinalCta />
			</main>

			<SubscriptionFooter />
		</div>
	)
}
