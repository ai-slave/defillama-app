// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { Dashboard } from '../../dashboardTypes'
import { DashboardOverflowMenu } from '../DashboardOverflowMenu'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(async () => true) }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

let root: Root
let container: HTMLDivElement
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

test('a running duplicate is announced after its menu closes', async () => {
	const copy = Promise.withResolvers<Dashboard>()
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<DashboardTestProvider>
					<DashboardOverflowMenu phoneActions={[]} onDuplicate={() => copy.promise} />
				</DashboardTestProvider>
			</QueryClientProvider>
		)
	)
	await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Dashboard actions"]')!.click())
	const duplicate = await waitForUi(() => {
		const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(node) => node.textContent === 'Duplicate'
		)
		expect(item).toBeDefined()
		return item!
	})
	await act(async () => duplicate.click())
	await waitForUi(() => expect(document.querySelector('[role="menu"]')).toBeNull())
	expect(container.querySelector('[role="status"]')?.textContent).toBe('Duplicating dashboard…')
})
