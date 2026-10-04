// @vitest-environment happy-dom
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ChatLanding } from '../ChatLanding'

vi.mock('next/router', () => ({
	default: { push: vi.fn() },
	useRouter: () => ({ asPath: '/ai/chat', pathname: '/ai/chat/[[...sessionId]]', query: {}, push: vi.fn() })
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function renderLanding(session: ReturnType<typeof installSubscriberSession>) {
	session.serve({
		'/user-settings': { settings: { customInstructions: '' }, tip: null },
		'/subscription/trial-available': { trialAvailable: false }
	})
	return act(async () =>
		root.render(
			<session.Wrapper>
				<ChatLanding
					draftScope="new"
					readOnly={false}
					title="What can I help you with?"
					handleSubmit={() => true}
					promptInputRef={createRef<HTMLTextAreaElement>()}
					handleStopRequest={() => {}}
					isStreaming={false}
					mode="quick"
					setMode={() => {}}
					onOpenAlerts={() => {}}
					isAlertsModalOpen={false}
					enterToSend
					holdWalkthrough={false}
				/>
			</session.Wrapper>
		)
	)
}

describe('free account', () => {
	const session = installSubscriberSession('reader', { account: 'free', resolved: true })

	test('a free user’s empty chat shows no walkthrough', async () => {
		await renderLanding(session)
		await waitForUi(() => expect(container.querySelector('form textarea')).not.toBeNull())
		expect(document.body.textContent).not.toContain('Welcome to LlamaAI')
	})
})

describe('subscriber', () => {
	const session = installSubscriberSession('reader', { account: 'subscriber', resolved: true })

	test('a paid user’s first empty chat opens the walkthrough', async () => {
		await renderLanding(session)
		await waitForUi(() => expect(document.body.textContent).toContain('Welcome to LlamaAI'))
	})
})
