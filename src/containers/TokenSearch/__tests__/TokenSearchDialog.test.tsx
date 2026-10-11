import * as Ariakit from '@ariakit/react'
// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// constants read the search token at import time; without it searchApi skips the request.
vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SEARCH_API_TOKEN = 'test-token'
})

import { SEARCH_API_URL } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TokenSearchDialog } from '../TokenSearchDialog'

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

function Harness() {
	const store = Ariakit.useDialogStore({ defaultOpen: true })
	return <TokenSearchDialog dialogStore={store} selectToken={() => {}} selectedTokens={{}} />
}

test('a failed token search says so and Try again loads the tokens', async () => {
	// Two failures: the dialog's portal mounts the list twice, and a failed query retries on remount.
	http.serveInOrder(SEARCH_API_URL, [fixtureStatus(500), fixtureStatus(500)], {
		results: [{ hits: [{ id: 'coingecko_bitcoin_token', name: 'Bitcoin', symbol: 'BTC', mcapRank: 1 }] }]
	})
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)

	await waitForUi(() => expect(alertTexts(document.querySelector('[role="dialog"]')!)).toHaveLength(1))
	expect(document.body.textContent).not.toContain('No tokens found')

	const retry = [...document.querySelectorAll('button')].find((button) => accessibleName(button) === 'Try again')!
	await act(async () => retry.click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Bitcoin (BTC)'))
})
