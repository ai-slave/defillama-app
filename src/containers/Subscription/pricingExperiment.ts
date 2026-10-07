/*
 * pricing-coverage-v1 hashes the persistent visitor seed independently of the menu's site cohort.
 * Its pre-paint data-ab-pricing-coverage-v1 attribute drives both the layout and reported variant.
 * A is the original pricing page (also the fallback without assignment); B is the coverage design.
 * Umami's site cohort tag remains unchanged; use this experiment's variant field to compare pricing.
 *
 * Compare experiment-action metric=subscribe-click / metric=page-visit, grouped by variant.
 * A visit is one foreground arrival, including reloads, route returns and back/forward cache restores.
 * The shared experiment exposure remains once per tab session and is NOT this metric's denominator.
 * Count enabled Pro/API card and crypto CTAs, plus comparison-table plan CTAs. Repeat clicks count.
 * Trials, free signup, sign-in, sales, billing upgrades and automatic post-sign-in continuation do not.
 */
import type { MouseEvent } from 'react'
import { readExperimentVariant, trackExperimentAction, trackExperimentExposure } from '~/utils/analytics/experiment'

export const PRICING_EXPERIMENT_ID = 'pricing-coverage-v1'

// The node survives React Strict Mode's ref replay, but a new route arrival gets a new node.
// This dedupes page arrivals only; experiment exposure deduplication belongs to experiment.ts.
const visitedPages = new WeakSet<HTMLElement>()

function recordVisit(node: HTMLElement) {
	const variant = readExperimentVariant(PRICING_EXPERIMENT_ID) ?? 'a'
	trackExperimentExposure(PRICING_EXPERIMENT_ID, variant)
	if (!visitedPages.has(node)) {
		visitedPages.add(node)
		trackExperimentAction(PRICING_EXPERIMENT_ID, variant, 'page-visit')
	}
	return variant
}

export function observePricingPage(node: HTMLElement) {
	let visible = false
	const record = () => {
		if (visible && document.visibilityState === 'visible') recordVisit(node)
	}
	const onPageShow = (event: PageTransitionEvent) => {
		if (!event.persisted) return
		// Browser history can restore this same node without replaying its React ref.
		visitedPages.delete(node)
		record()
	}
	const observer = new IntersectionObserver((entries) => {
		visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)
		record()
	})
	observer.observe(node)
	document.addEventListener('visibilitychange', record)
	window.addEventListener('pageshow', onPageShow)
	return () => {
		observer.disconnect()
		document.removeEventListener('visibilitychange', record)
		window.removeEventListener('pageshow', onPageShow)
	}
}

export function trackPricingClick(event: MouseEvent<HTMLElement>) {
	if (event.button !== 0 || document.visibilityState !== 'visible' || !(event.target instanceof Element)) return
	const button = event.target.closest<HTMLButtonElement>(
		'button[data-umami-event="subscribe-checkout"], button[data-pricing-plan]'
	)
	if (!button || !event.currentTarget.contains(button) || button.matches(':disabled, [aria-disabled="true"]')) return
	const plan = button.dataset.umamiEventPlan ?? button.dataset.pricingPlan
	if (plan !== 'pro' && plan !== 'api') return
	const variant = recordVisit(event.currentTarget)
	trackExperimentAction(PRICING_EXPERIMENT_ID, variant, 'subscribe-click', {
		plan,
		provider: button.dataset.umamiEventProvider ?? 'stripe',
		placement: button.dataset.pricingPlan ? 'comparison' : 'cards',
		billing_cycle: event.currentTarget.dataset.billingCycle!
	})
}
