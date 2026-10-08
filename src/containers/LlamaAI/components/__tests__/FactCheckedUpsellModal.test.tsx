// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FactCheckedUpsellModal } from '~/containers/LlamaAI/components/UsageLimit'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ai/chat', query: {}, push: vi.fn() }) }))

const session = installSubscriberSession('reader', { account: 'free', resolved: true })
let root: Root

function OpenModal() {
	return <FactCheckedUpsellModal dialogStore={Ariakit.useDialogStore({ defaultOpen: true })} />
}

const render = async () => {
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal />
			</session.Wrapper>
		)
	)
	return document.querySelector('[role="dialog"]')!
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('a free user who taps Fact-checked is told it is part of Pro and offered the trial, never that a limit was reached', async () => {
	session.serve({ '/subscription/trial-available': { trialAvailable: true } })
	const dialog = await render()
	expect(dialog.textContent).toContain('Fact-checked answers are part of Pro')
	expect(dialog.textContent).not.toContain('limit reached')
	await waitForUi(() => expect(dialog.querySelector('a')?.textContent).toBe('Start 7-day free trial'))
})

test('a free user with no trial left is sent to upgrade, so nobody is offered a trial they cannot start', async () => {
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	const dialog = await render()
	await waitForUi(() => expect(dialog.querySelector('a')?.textContent).toBe('Upgrade to Pro'))
})
