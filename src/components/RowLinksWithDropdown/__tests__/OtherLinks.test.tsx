// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { OtherLinks } from '../OtherLinks'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(() => Promise.resolve(true)) }) }))

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

test('the links drawer is named after its list, not the active link on its trigger', async () => {
	await act(async () =>
		root.render(
			<OtherLinks
				heading="Chains"
				name="Ethereum"
				isActive
				options={[
					{ label: 'All', to: '/stablecoins' },
					{ label: 'Ethereum', to: '/stablecoins/Ethereum' }
				]}
			/>
		)
	)
	const trigger = container.querySelector('button')!
	expect(trigger.textContent).toContain('Ethereum')

	await act(async () => trigger.click())
	// With a search field inside, Ariakit gives the menu surface the dialog role.
	const drawer = await waitForUi(() => {
		const el = document.querySelector('[role="dialog"]')
		expect(el).not.toBeNull()
		return el!
	})
	expect(document.getElementById(drawer.getAttribute('aria-labelledby')!)?.textContent).toBe('Chains')
})
