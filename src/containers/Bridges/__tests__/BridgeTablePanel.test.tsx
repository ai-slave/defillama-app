// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { BridgeTablePanel } from '../BridgeProtocolOverview'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/bridge/wormhole' }) }))

const http = installFixtureFetch()

let unmount = () => {}
afterEach(() => {
	unmount()
	// The settings toggle writes both storage and a URL override.
	localStorage.clear()
	window.history.replaceState({}, '', '/')
})

async function renderPanel() {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	// The addresses table links rows through the block explorer list.
	http.serve({ '/blockExplorers.json': [] })
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<BridgeTablePanel tokensTableData={[]} addressesTableData={[]} />
			</QueryClientProvider>
		)
	)
	unmount = () => {
		act(() => root.unmount())
		container.remove()
	}
	return container
}

const tab = (container: HTMLElement, name: string) =>
	[...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) => el.getAttribute('aria-label') === name)!

const firstColumn = (container: HTMLElement) => container.querySelector('[role="tabpanel"] th')?.textContent

test('clicking the selected Tokens tab keeps the tokens table', async () => {
	const container = await renderPanel()
	expect(firstColumn(container)).toContain('Token')
	await act(async () => tab(container, 'Tokens').click())
	expect(firstColumn(container)).toContain('Token')
	expect(tab(container, 'Tokens').getAttribute('aria-selected')).toBe('true')
})

test('clicking the Addresses tab shows the addresses table', async () => {
	const container = await renderPanel()
	await act(async () => tab(container, 'Addresses').click())
	expect(firstColumn(container)).toContain('Address')
	expect(tab(container, 'Addresses').getAttribute('aria-selected')).toBe('true')
})
