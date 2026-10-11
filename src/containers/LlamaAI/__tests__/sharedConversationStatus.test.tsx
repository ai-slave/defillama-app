// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	query: { shareToken: 'shared-token' },
	pathname: '/ai/chat/shared/[shareToken]',
	asPath: '/ai/chat/shared/shared-token',
	isReady: true,
	push: async () => true,
	replace: async () => true,
	prefetch: async () => {},
	events: { on: () => {}, off: () => {} }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
import SharedConversationPage from '~/pages/ai/chat/shared/[shareToken]'

const session = installSubscriberSession('reader', { account: 'signed-out' })
let root: Root

beforeEach(() => {
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

async function draw() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SharedConversationPage shareToken="shared-token" sessionTitle={null} />
			</session.Wrapper>
		)
	)
}

test.each([403, 404, 410])('a link the server refuses (%i) says it was not found, with a way back', async (status) => {
	session.serve({ '/user/public/shared-token': fixtureStatus(status, { error: 'Not found' }) })
	await draw()

	await waitForUi(() => expect(document.querySelector('h1')?.textContent).toBe('Conversation not found'))
	expect(alertTexts()).toEqual([])
	const back = [...document.querySelectorAll('a')].find((link) => accessibleName(link) === 'Go to LlamaAI')
	expect(back?.getAttribute('href')).toBe('/ai/chat')
})

test('a failed read keeps its error and waiting Try again while the retry runs', async () => {
	session.serve({ '/user/public/shared-token': fixtureStatus(500, { error: 'down' }) })
	await draw()

	await waitForUi(() => expect(alertTexts()).toHaveLength(1))
	expect(document.querySelector('h1')).toBeNull()
	session.serve({ '/user/public/shared-token': () => new Promise<Response>(() => {}) })
	const retry = [...document.querySelectorAll('button')].find((button) => accessibleName(button) === 'Try again')!
	await act(async () => retry.click())

	await waitForUi(() => expect(retry.getAttribute('aria-busy')).toBe('true'))
	expect(alertTexts()).toHaveLength(1)
})
