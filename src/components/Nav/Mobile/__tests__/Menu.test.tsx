// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '~/auth'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Menu } from '../Menu'

installFixtureFetch()
const pageNames: Record<string, string> = { '/fees': 'Fees', '/yields': 'Yields' }

// Reads the pins the way the nav does, so an unpin round-trips through storage.
function PinnedMenu() {
	const routes: Array<string> = JSON.parse(useStorageItem('pinned-metrics', '[]'))
	return (
		<Menu
			mainLinks={[]}
			pinnedPages={routes.map((route) => ({ name: pageNames[route], route }))}
			userDashboards={[]}
			dashboardsStatus={null}
			footerLinks={[]}
			oldMetricLinks={[]}
			asPath="/"
		/>
	)
}

let client: QueryClient
let container: HTMLDivElement
let root: Root
beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	setStorageItem('pinned-metrics', JSON.stringify(['/fees', '/yields']))
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<PinnedMenu />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	localStorage.clear()
})

const named = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)

async function press(name: string) {
	await waitForUi(() => expect(named(name)).toBeDefined())
	await act(async () => {
		named(name)!.focus()
		named(name)!.click()
	})
}

test('unpinning down to one page while reordering keeps focus in the menu', async () => {
	await press('Open navigation menu')
	await waitForUi(() => expect(document.querySelector('[role=dialog]')?.checkVisibility()).toBe(true))
	await press('Reorder')
	await press('Unpin Yields')
	await waitForUi(() => expect(named('Unpin Fees')).toBeUndefined())
	expect(document.activeElement).toBe(named('Close navigation menu'))
})
