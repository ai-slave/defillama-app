// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { KpkMetadata } from '../api'
import KpkHeader from '../KpkHeader'

const http = installFixtureFetch()

const METADATA: KpkMetadata = {
	projectId: 8,
	projectName: 'KPK',
	tagline: 'Investor relations',
	asOf: '2026-09-22',
	updatedAt: '2026-09-22T00:00:00Z',
	notes: [],
	links: {
		website: 'https://kpk.io',
		app: 'https://app.kpk.io',
		docs: 'https://docs.kpk.io',
		x: 'https://x.com/kpk_io',
		github: 'https://github.com/karpatkey'
	}
}

let served: KpkMetadata = METADATA

describe('KpkHeader', () => {
	let container: HTMLDivElement
	let root: Root
	let client: QueryClient

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		served = METADATA
		client = new QueryClient()
		http.serve({ '/api/public/kpk/metadata': () => served })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	})

	const renderHeader = async () => {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<KpkHeader />
				</QueryClientProvider>
			)
		)
		await vi.waitFor(() => expect(container.textContent).toContain('Data as of'), { timeout: 1000 })
	}

	const links = () =>
		[...container.querySelectorAll<HTMLAnchorElement>('nav a')].map((link) => [link.textContent, link.href])

	test('links GitHub after X', async () => {
		await renderHeader()

		expect(links().map(([label]) => label)).toEqual(['kpk.io', 'App', 'Docs', 'X', 'GitHub'])
		expect(links().at(-1)?.[1]).toBe('https://github.com/karpatkey')
	})

	test('drops a link the backend does not send', async () => {
		served = { ...METADATA, links: { ...METADATA.links, github: undefined } }
		await renderHeader()

		expect(links().map(([label]) => label)).toEqual(['kpk.io', 'App', 'Docs', 'X'])
	})
})
