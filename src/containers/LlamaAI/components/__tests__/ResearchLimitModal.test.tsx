// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResearchLimitModal } from '~/containers/LlamaAI/components/ResearchLimitModal'
import type { UsageLimitPeriod } from '~/containers/LlamaAI/types'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ai/chat', query: {}, push: vi.fn() }) }))

const session = installSubscriberSession('reader', { account: 'free', resolved: true })
let root: Root

function OpenModal({ period, limit }: { period: UsageLimitPeriod; limit: number }) {
	const store = Ariakit.useDialogStore({ defaultOpen: true })
	return (
		<ResearchLimitModal dialogStore={store} period={period} limit={limit} resetTime={null} feature="fact_checked" />
	)
}

const render = async (period: UsageLimitPeriod, limit: number) => {
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<OpenModal period={period} limit={limit} />
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
	const dialog = await render('blocked', 0)
	expect(dialog.textContent).toContain('Fact-checked answers are part of Pro')
	expect(dialog.textContent).not.toContain('limit reached')
	await waitForUi(() => expect(dialog.querySelector('a')?.textContent).toBe('Start 7-day free trial'))
})

test('a free user with no trial left is sent to upgrade, so nobody is offered a trial they cannot start', async () => {
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	const dialog = await render('blocked', 0)
	await waitForUi(() => expect(dialog.querySelector('a')?.textContent).toBe('Upgrade to Pro'))
})

test('at a daily cap the dialog still reads that the limit was reached', async () => {
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	const dialog = await render('daily', 10)
	expect(dialog.textContent).toContain('Fact-checked answer limit reached')
	expect(dialog.textContent).toContain("You've used all 10 fact-checked answers for today.")
})
