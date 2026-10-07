// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { PRICING_CARDS_BY_CYCLE } from '../data'
import { SubscriptionPricingSection } from '../sections/SubscriptionPricingSection'
import type { BillingCycle } from '../types'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

// The subscription page opens on the yearly toggle.
function PricingPage() {
	const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly')
	return (
		<SubscriptionPricingSection
			pricingCards={PRICING_CARDS_BY_CYCLE[billingCycle]}
			billingCycle={billingCycle}
			onBillingCycleChange={setBillingCycle}
			isAuthenticated
			isTrialAvailable
			onStartTrial={() => {}}
		/>
	)
}

function trialConversionLine() {
	const lines = [...container.querySelectorAll('p')].filter((p) => p.textContent?.startsWith('No charge for 7 days'))
	expect(lines).toHaveLength(1)
	return lines[0].textContent
}

test('the trial names the monthly Pro price it converts to while the yearly prices show', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<PricingPage />
			</QueryClientProvider>
		)
	)

	expect(container.textContent).toContain('$40.83')
	expect(trialConversionLine()).toBe('No charge for 7 days — converts to $49/month after')
})
