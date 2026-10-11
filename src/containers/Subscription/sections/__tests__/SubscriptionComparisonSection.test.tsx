// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { COMPARISON_SECTIONS, PLAN_ORDER } from '~/containers/Subscription/data'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { SubscriptionComparisonSection } from '../SubscriptionComparisonSection'

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

test('the comparison table is labeled, and each plan action names its plan', async () => {
	await act(async () =>
		root.render(
			<SubscriptionComparisonSection
				planOrder={PLAN_ORDER}
				comparisonSections={COMPARISON_SECTIONS}
				billingCycle="monthly"
				selectedPlan="api"
				currentPlan="free"
				hidePlanActions={false}
				onPlanAction={() => {}}
			/>
		)
	)
	const table = container.querySelector('[role=table]')!
	expect(accessibleName(table as HTMLElement)).toBe('Plan comparison')
	expect([...table.querySelectorAll('[role=columnheader] button')].map((button) => accessibleName(button))).toEqual([
		'Get started: Pro',
		'Get started: API',
		'Contact us: Enterprise'
	])
})

test('a Limited cell explains its limit to a keyboard reader', async () => {
	await act(async () =>
		root.render(
			<SubscriptionComparisonSection
				planOrder={PLAN_ORDER}
				comparisonSections={COMPARISON_SECTIONS}
				billingCycle="monthly"
				selectedPlan="api"
				currentPlan="free"
				hidePlanActions={false}
				onPlanAction={() => {}}
			/>
		)
	)
	const research = [...container.querySelectorAll('[role=row]')].find((row) =>
		row.textContent?.includes('Deep research')
	)!
	const limited = [...research.querySelectorAll<HTMLElement>('[tabindex="0"]')].find(
		(el) => el.textContent === 'Limited'
	)
	expect(limited).toBeDefined()
	await act(async () => limited!.focus())
	await waitForUi(() => expect(document.querySelector('[role=tooltip]')?.textContent).toBe('1 report every 2 weeks'))
})
