// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { PricingCardContent } from '~/containers/Subscription/components'
import type { PricingCardData } from '~/containers/Subscription/types'

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
	const card = {
		key: 'pro',
		title: 'Pro',
		primaryCta: 'Get Started',
		sections: [
			{
				title: 'Features',
				items: [
					{ label: 'Feature on the plan', availability: 'check' },
					{ label: 'Feature off the plan', availability: 'x' }
				]
			}
		]
	} satisfies PricingCardData
	await act(async () => root.render(<PricingCardContent card={card} />))
	const bullets = [...container.querySelectorAll('li')].map((item) => item.textContent)
	expect(bullets).toEqual(['Included: Feature on the plan', 'Not included: Feature off the plan'])
})
