// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION } from '../tableQuery'

const router = vi.hoisted(() => ({
	pathname: '/equities',
	asPath: '/equities?rankBy=holder-yield',
	isReady: false,
	query: { rankBy: 'holder-yield' } as Record<string, string>,
	push: vi.fn(async () => true),
	replace: vi.fn(async () => true)
}))

vi.mock('next/router', () => ({ useRouter: () => router }))

import { EquitiesOverview } from '../index'

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

const button = (label: string) =>
	[...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === label)

test('a hidden rank-by preset in the URL opens the extra presets, and Less still collapses them', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<EquitiesOverview
					initialData={{
						schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
						rows: [],
						page: 1,
						pageSize: 100,
						total: 0,
						totalPages: 1,
						hasMore: false,
						options: { country: [], sector: [], industry: [] },
						updatedAt: null
					}}
					initialDataGeneratedAt={0}
				/>
			</QueryClientProvider>
		)
	)
	expect(button('Holder Yield')?.getAttribute('aria-current')).toBe('page')
	expect(button('Enterprise Value')).toBeDefined()

	await act(async () => button('Less')!.click())

	expect(button('Enterprise Value')).toBeUndefined()
	expect(button('+ More')?.getAttribute('aria-expanded')).toBe('false')
})
