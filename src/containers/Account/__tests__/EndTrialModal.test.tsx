// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { EndTrialModal } from '../EndTrialModal'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/', query: {} }) }))

const session = installSubscriberSession('trial-user', { resolved: true })
const END_TRIAL = `${AUTH_SERVER}/subscription/end-trial`

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

const control = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('[role=alertdialog] a, [role=alertdialog] button')].find(
		(element) => accessibleName(element) === name
	)!

test('the plans link cannot leave the page while the charge runs', async () => {
	const charge = Promise.withResolvers<Response>()
	session.serve({ [END_TRIAL]: () => charge.promise, '/subscription/trial-available': { trialAvailable: false } })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<EndTrialModal isOpen onClose={() => {}} confirmLabel="Upgrade to Pro" secondaryHref="/subscription" />
			</session.Wrapper>
		)
	)
	expect(control('View all plans').getAttribute('href')).toBe('/subscription')

	await act(async () => control('Upgrade to Pro').click())
	await waitForUi(() => expect(control('Processing…')).toBeDefined())
	expect(control('View all plans').hasAttribute('href')).toBe(false)
	expect(control('View all plans').getAttribute('aria-disabled')).toBe('true')

	await act(async () => charge.resolve(Response.json({ message: 'ok' })))
	await waitForUi(() => expect(document.querySelector('[role=alertdialog] h2')?.textContent).toBe('Upgrade Successful'))
})
