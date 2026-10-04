// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CompareTokens } from '../index'

const router = vi.hoisted(() => ({
	pathname: '/compare-tokens',
	asPath: '/compare-tokens',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn(async (_url: unknown) => true)
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

const coin = (id: string, name: string) => ({ id, name, symbol: id }) as IResponseCGTokenRankingsDatasetItem
const coinsData = [coin('bitcoin', 'Bitcoin'), coin('ethereum', 'Ethereum')]

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
	router.query = {}
	router.push.mockClear()
})

const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)

test('each token picker is a named button that opens the search and gets focus back after a pick', async () => {
	router.query = { coin: ['bitcoin'] }
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<CompareTokens coinsData={coinsData} protocols={[]} />
			</QueryClientProvider>
		)
	)
	const second = button('Second token: none')!
	expect(button('First token: Bitcoin')).toBeDefined()

	await act(async () => {
		second.focus()
		second.click()
	})
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
	const ethereum = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((el) =>
		el.textContent?.includes('Ethereum')
	)!
	await act(async () => ethereum.click())

	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	expect(router.push.mock.calls[0][0]).toMatchObject({ query: { coin: ['bitcoin', 'ethereum'] } })
	expect(document.activeElement).toBe(second)
})
