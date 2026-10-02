// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FreeLimitCard } from '~/containers/LlamaAI/components/FreeLimitCard'
import { getVariant } from '~/utils/analytics/experiment'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/ai/chat', query: {}, push: vi.fn() }) }))

// A user id the free-limit-cta-v1 split puts in arm B.
const USER_B = 'abtest-free-b1'
const session = installSubscriberSession(USER_B, { account: 'free', resolved: true })
const track = installUmamiSink()
let root: Root
let container: HTMLDivElement

const render = async (trialAvailable: boolean) => {
	session.serve({ '/subscription/trial-available': { trialAvailable } })
	container = document.createElement('div')
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<FreeLimitCard offer={{ code: 'FREE_FORM_LIMIT' }} />
			</session.Wrapper>
		)
	)
}
const primaryLabel = () => container.querySelector('a')?.textContent
const experimentCalls = () => track.mock.calls.filter(([name]) => String(name).startsWith('experiment-'))

describe('FreeLimitCard', () => {
	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
	})
	afterEach(async () => {
		await act(async () => root.unmount())
		sessionStorage.clear()
	})

	test('reports each time it is shown, so its click rate has a denominator', async () => {
		await render(true)
		expect(track).toHaveBeenCalledWith('llamaai-free-limit-view', { limit: 'FREE_FORM_LIMIT' })
	})

	test('variant B with a trial left leads with the trial, reports exposure, and counts a trial click for B', async () => {
		expect(getVariant('free-limit-cta-v1', USER_B)).toBe('b')
		await render(true)
		await waitForUi(() => expect(primaryLabel()).toBe('Start 7-day free trial'))
		expect(container.textContent).toContain('DefiLlama App')
		expect(track).toHaveBeenCalledWith('experiment-exposure', { experiment: 'free-limit-cta-v1', variant: 'b' })

		const trial = container.querySelector('a')!
		trial.addEventListener('click', (event) => event.preventDefault())
		await act(async () => trial.click())
		expect(track).toHaveBeenCalledWith('experiment-action', {
			experiment: 'free-limit-cta-v1',
			variant: 'b',
			metric: 'trial-click'
		})
	})

	test('a B user without a trial gets the current card and is not in the experiment, so nobody is offered a trial they cannot start', async () => {
		await render(false)
		await waitForUi(() => expect(primaryLabel()).toBe('Get the DefiLlama App'))
		expect(experimentCalls()).toEqual([])
	})
})
