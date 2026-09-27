// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { IYieldTableRow } from '../types'
import { EarnApyCell, ExitCell } from '../YieldsCells'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/yields', push: vi.fn() }) }))

const session = installSubscriberSession('subscriber')
const LOCK_LABEL = "This pool's verified APY is available on a Pro subscription"

// An embedded public table: the server withheld the measurement and marked the row locked.
const publicMeasuredRow = {
	apy: 5,
	apyBase: 5,
	apyReward: null,
	apyRewardRaw: null,
	configID: '79e042b5-e55d-4a4e-b0b0-6661a570470b',
	pool: 'Pool',
	verified: null,
	verifiedLocked: true,
	resolvedApy: { base: 5, reward: null, intrinsic: null, total: 5 },
	rewardTokensSymbols: [],
	intrinsicSourceSymbol: null
} as unknown as IYieldTableRow

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderCells() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<div data-cell="apy">
					<EarnApyCell row={publicMeasuredRow} median={undefined} />
				</div>
				<div data-cell="exit">
					<ExitCell row={publicMeasuredRow} />
				</div>
			</session.Wrapper>
		)
	)
}
const cell = (name: string) => container.querySelector(`[data-cell="${name}"]`)!
const hasLock = () => cell('apy').querySelector(`[aria-label="${LOCK_LABEL}"]`) != null

describe('embedded public yields rows', () => {
	test('a subscriber sees the reported APY without a Pro lock or upsell', async () => {
		await renderCells()
		await waitForUi(() => expect(session.urls().some((url) => url.endsWith('/subscription/status'))).toBe(true), {
			timeout: 1000
		})
		await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
		expect(cell('apy').textContent).toContain('5.00%')
		expect(hasLock()).toBe(false)
		expect(cell('exit').textContent).toBe('')
	})

	test('a signed-out reader sees both cells locked', async () => {
		pb.authStore.clear()
		await renderCells()
		await waitForUi(() => expect(cell('exit').textContent).toBe('•••'), { timeout: 1000 })
		expect(hasLock()).toBe(true)
	})
})
