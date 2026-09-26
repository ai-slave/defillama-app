// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import TopProtocols from '~/pages/top-protocols'

const router = vi.hoisted(() => ({
	pathname: '/top-protocols',
	asPath: '/top-protocols',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	router.query = {}
})

test('shows no chains after Deselect All in the chain picker', async () => {
	router.query = { chain: 'None' }
	await act(async () =>
		root.render(
			<TopProtocols
				data={[{ chain: 'Ethereum', Lending: 'Aave' }]}
				chains={['Ethereum']}
				uniqueCategories={['Lending']}
			/>
		)
	)
	expect(container.textContent).toContain('No results found')
})
