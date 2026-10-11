// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/pro"}

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LlamaAITab } from '../LlamaAITab'

// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const session = installSubscriberSession('reader', { account: 'signed-out' })
let root: Root
beforeEach(async () => {
	session.serve({ [`${AI_SERVER}/charts`]: () => ({ charts: [] }) })
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAITab selectedChart={null} onChartSelect={vi.fn()} />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('signed out, Sign in opens the sign-in dialog, which stays on its own step after a sign-in from another tab', async () => {
	const signIn = await waitForUi(() => {
		const button = [...document.querySelectorAll('button')].find((el) => accessibleName(el) === 'Sign in')
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => signIn.click())
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Sign in'))
	await act(async () => pb.authStore.save(session.token, session.record as never))
	await waitForUi(() => expect(document.querySelector('[role=dialog] h2')?.textContent).toBe("You're signed in"))
})
