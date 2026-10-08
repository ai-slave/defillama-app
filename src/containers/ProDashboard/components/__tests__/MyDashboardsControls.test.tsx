// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MyDashboardsControls } from '../MyDashboardsControls'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), replace: vi.fn() }) }))

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

function Controls() {
	const [query, setQuery] = useState('aave')
	return (
		<MyDashboardsControls
			query={query}
			sort="recent"
			visibility="all"
			onQueryChange={setQuery}
			onSortChange={() => {}}
			onVisibilityChange={() => {}}
		/>
	)
}

test('clearing the search hands focus back to the search box', async () => {
	await act(async () => root.render(<Controls />))
	const clear = container.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!
	await act(async () => {
		clear.focus()
		clear.click()
	})
	const search = container.querySelector<HTMLInputElement>('[aria-label="Search my dashboards"]')!
	expect(search.value).toBe('')
	expect(document.activeElement).toBe(search)
})
