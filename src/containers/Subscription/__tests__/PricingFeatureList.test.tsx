// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { PricingCardContent } from '~/containers/Subscription/components'
import { MONTHLY_PRICING_CARDS } from '~/containers/Subscription/data'

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

test('a plan card says in words which features the plan includes and which it lacks', async () => {
	const pro = MONTHLY_PRICING_CARDS.find((card) => card.key === 'pro')!
	await act(async () => root.render(<PricingCardContent card={pro} />))
	const bullets = [...container.querySelectorAll('li')].map((item) => item.textContent)
	expect(bullets).toContain('Included: CSV data downloads')
	expect(bullets).toContain('Not included: API Access')
})
