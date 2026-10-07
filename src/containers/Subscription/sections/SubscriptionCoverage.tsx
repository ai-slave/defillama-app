import { useQuery } from '@tanstack/react-query'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus } from '~/ui/Status'
import { readExperimentVariant } from '~/utils/analytics/experiment'
import { fetchJson } from '~/utils/async'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import type { SubscriptionCoverageData } from '../coverage'
import { PRICING_EXPERIMENT_ID } from '../pricingExperiment'
import type { PricingCardData } from '../types'

const COVERAGE_MULTIPLIER = 3.5

/** Bars and fetched counters share one viewport-triggered timeline; loading never starts it. */
function animateCoverage(node: HTMLElement | null) {
	if (!node) return
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
	const counters = [...node.querySelectorAll<HTMLElement>('[data-coverage-count]')]
	const bars = [...node.querySelectorAll<HTMLElement>('[data-coverage-bar]')]
	let frame = 0
	let started = false
	let start: number | undefined
	const paint = (progress: number) => {
		for (const counter of counters) {
			const value = Number(counter.dataset.coverageCount)
			counter.textContent = formatNumber(Math.round(value * progress))
		}
		for (const bar of bars) bar.style.transform = `scaleX(${progress})`
	}
	const tick = (now: number) => {
		start ??= now
		const progress = Math.min((now - start) / 2800, 1)
		paint(1 - (1 - progress) ** 3)
		if (progress < 1) frame = requestAnimationFrame(tick)
	}
	const finish = () => {
		if (!reducedMotion.matches) return
		cancelAnimationFrame(frame)
		paint(1)
	}
	// The data-keyed graphic remounts once the totals arrive. Keep its bars empty until then.
	paint(counters.length > 0 && reducedMotion.matches ? 1 : 0)
	if (counters.length === 0) return
	const observer = new IntersectionObserver((entries) => {
		if (started || !entries.some((entry) => entry.isIntersecting)) return
		started = true
		observer.disconnect()
		if (reducedMotion.matches) paint(1)
		else {
			paint(0)
			frame = requestAnimationFrame(tick)
		}
	})
	observer.observe(node)
	reducedMotion.addEventListener('change', finish)
	return () => {
		observer.disconnect()
		cancelAnimationFrame(frame)
		reducedMotion.removeEventListener('change', finish)
	}
}

/** Mounted inside the pricing page's ClientOnly boundary; the pre-paint cohort is ready before this query runs.
 * B's marketing graphic uses accessible meters, and failed reads stay visible through automatic retries. */
export function SubscriptionCoverage() {
	const query = useQuery({
		queryKey: ['subscription-coverage'],
		queryFn: () => fetchJson<SubscriptionCoverageData>('/api/public/subscription/coverage'),
		enabled: readExperimentVariant(PRICING_EXPERIMENT_ID) === 'b',
		staleTime: 5 * 60 * 1000,
		refetchInterval: 5 * 60 * 1000,
		retry: 1
	})
	const { data } = query
	const failed = queryReadFailed(query)
	const loading = !failed && query.isPending
	const coverage = [
		{
			label: 'Protocols',
			value: data?.protocols,
			change: data ? `+${formatNumber(data.protocolsAddedThisWeek)} this week` : null
		},
		{ label: 'Chains', value: data?.chains },
		{ label: 'Yield pools', value: data?.yieldPools },
		{ label: 'RWA assets', value: data?.rwaAssets }
	]
	return (
		<div className="pricing-coverage w-full flex-col gap-8 text-center">
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-8">
					<div className="flex items-center justify-center gap-2">
						<img src="/assets/defillama-dark.webp" alt="DefiLlama" className="h-14 w-auto md:h-10 dark:hidden" />
						<img src="/assets/logo_white.webp" alt="" className="hidden size-14 md:size-10 dark:block" />
						<span className="hidden heading-sm text-sub-text-primary dark:inline">DefiLlama</span>
					</div>
					<div className="flex flex-col items-center gap-6">
						<h1 className="heading-lg text-sub-text-primary">
							The broadest DeFi coverage.
							<br />
							The <span className="text-link">deepest insight.</span>
						</h1>
						<p className="body-xl text-sub-text-secondary md:body-lg">One place to understand onchain markets.</p>
					</div>
				</div>
				<div
					key={coverage.map(({ value }) => value).join(':')}
					ref={animateCoverage}
					className="flex flex-col items-center gap-6"
				>
					<div className="flex w-full max-w-xl flex-col gap-2 px-2 text-left sm:px-0">
						<div className="flex flex-wrap items-baseline justify-between gap-1">
							<span className="title-lg text-sub-text-primary">DefiLlama</span>
							<span className="label-lg text-link">{formatNumber(COVERAGE_MULTIPLIER)}× the data coverage</span>
						</div>
						<div
							role="meter"
							aria-label="DefiLlama data coverage"
							aria-valuemin={0}
							aria-valuemax={COVERAGE_MULTIPLIER}
							aria-valuenow={COVERAGE_MULTIPLIER}
							aria-valuetext="3.5 times the data coverage of all other providers combined"
							className="h-5 overflow-hidden rounded-full bg-surface-elevated-2"
						>
							<div data-coverage-bar className="h-full origin-left rounded-full bg-brand" />
						</div>
						<span className="body-md text-sub-text-secondary">All other providers combined</span>
						<div
							role="meter"
							aria-label="All other providers combined"
							aria-valuemin={0}
							aria-valuemax={COVERAGE_MULTIPLIER}
							aria-valuenow={1}
							className="h-5 overflow-hidden rounded-full bg-surface-elevated-2"
						>
							<div
								data-coverage-bar
								className="h-full origin-left rounded-full bg-sub-text-cool-muted"
								style={{ width: `${100 / COVERAGE_MULTIPLIER}%` }}
							/>
						</div>
					</div>
					<dl aria-busy={loading} className="grid w-full max-w-5xl grid-cols-2 gap-y-6 md:grid-cols-4">
						{coverage.map(({ label, value, change }) => (
							<div
								key={label}
								className="flex min-w-0 flex-col items-center gap-2 px-2 even:border-l even:border-subtle md:border-l md:border-subtle md:first:border-l-0"
							>
								<dt className="order-last label-lg text-sub-text-primary md:heading-sm">{label}</dt>
								<dd className="flex flex-col items-center gap-2">
									<div className="min-h-5 label-md text-data-up">{change}</div>
									<div className="flex items-center justify-center gap-2 text-sub-text-primary">
										<span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-sub-live" />
										{value != null ? (
											<>
												<span className="sr-only">{formatNumber(value)}</span>
												<span aria-hidden="true" data-coverage-count={value} className="mono-xl tabular-nums">
													{formatNumber(value)}
												</span>
											</>
										) : loading ? (
											<>
												<span className="sr-only">Loading</span>
												<Skeleton className="h-8 w-24" />
											</>
										) : (
											<span aria-label="Unavailable" className="mono-xl text-tertiary">
												—
											</span>
										)}
									</div>
								</dd>
							</div>
						))}
					</dl>
				</div>
				{failed ? (
					<InlineStatus variant="error">
						{data
							? 'Coverage could not refresh. Showing the last available counts.'
							: 'Coverage data is temporarily unavailable.'}
					</InlineStatus>
				) : null}
			</div>
			<p className="body-lg text-sub-text-primary">The most-cited data provider in crypto</p>
		</div>
	)
}

const FEATURES = {
	free: [
		'31 free API endpoints',
		'Compare & analyze the best yields',
		'Access stablecoin data, inflows & distribution'
	],
	pro: ['Access Verified APY yields and Exit Status', 'Build your own custom dashboards', 'Add custom data columns'],
	api: ['Premium API endpoints', '1,000 requests / minute', '1M calls / month'],
	enterprise: ['Direct access to our database', 'Bespoke datasets built for your use case', 'Hourly data']
}

/** Uses the shared pricing data and checkout controls; only B's presentation and feature summary differ. */
export function CoveragePricingContent({
	card,
	isTrialAvailable
}: {
	card: PricingCardData
	isTrialAvailable: boolean
}) {
	return (
		<div className="pricing-coverage flex-col gap-4">
			<div className="flex flex-col gap-1">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="heading-sm text-sub-text-primary">{card.title}</h3>
					{card.recommendedLabel ? (
						<span className="rounded-sm bg-brand-muted px-2 py-1 label-sm text-link-on-tint">
							{card.recommendedLabel}
						</span>
					) : null}
				</div>
				<p className="body-md text-sub-text-secondary">{card.subtitle}</p>
				{card.priceMain ? (
					<>
						<p className="flex flex-wrap items-baseline gap-1">
							<span className="mono-xl text-link">{card.priceMain}</span>
							<span className="body-lg text-sub-text-primary">{card.priceUnit}</span>
						</p>
						{card.key === 'pro' && isTrialAvailable ? (
							<span className="w-fit rounded-sm bg-brand-muted px-2 py-1 label-sm text-link-on-tint">
								7-day free trial available
							</span>
						) : card.priceSecondary ? (
							<p className="body-md text-sub-text-secondary">{card.priceSecondary}</p>
						) : null}
					</>
				) : (
					<p className="heading-sm text-sub-text-primary">{card.description}</p>
				)}
			</div>
			<ul className="flex flex-col gap-2">
				{FEATURES[card.key].map((feature) => (
					<li key={feature} className="flex items-start gap-2 body-md text-sub-text-primary">
						<Icon name="check" width={14} height={14} className="mt-1 shrink-0 text-link" aria-hidden="true" />
						{feature}
					</li>
				))}
			</ul>
		</div>
	)
}
