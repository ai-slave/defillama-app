// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TopAuthorEntry } from '~/containers/Authors/types'
import { TopAuthorsRail } from './TopAuthorsRail'

const mocks = vi.hoisted(() => ({
	topAuthors: { authors: [] as Array<TopAuthorEntry>, isLoading: false }
}))
vi.mock('../hooks/useTopAuthors', () => ({ useTopAuthors: () => mocks.topAuthors }))

function makeEntry(overrides: Partial<TopAuthorEntry> = {}): TopAuthorEntry {
	return {
		author: {
			slug: 'llama',
			displayName: 'Llama Analyst',
			bio: 'Charts every day',
			avatarUrl: null,
			socials: {},
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z'
		},
		dashboardCount: 12,
		totalViews: 15_400,
		totalLikes: 2300,
		followerCount: 42,
		...overrides
	} as TopAuthorEntry
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.topAuthors = { authors: [], isLoading: false }
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render() {
	await act(async () => root.render(<TopAuthorsRail />))
}

test('the rail keeps its heading without authors', async () => {
	await render()
	expect(container.querySelector('h3')?.textContent).toBe('Top Authors')
	expect(container.textContent).toContain('No authors to show yet')
})

test('author cards carry compact counts in a meta row', async () => {
	mocks.topAuthors = { authors: [makeEntry()], isLoading: false }
	await render()
	expect(container.querySelector('h3')?.textContent).toBe('Top Authors')
	expect(container.textContent).toContain('12 dashboards')
	expect(container.textContent).toContain('15.4K views')
	expect(container.textContent).toContain('2.3K likes')
	expect(container.textContent).toContain('@llama')
	expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
})

test('the loading rail keeps the heading', async () => {
	mocks.topAuthors = { authors: [], isLoading: true }
	await render()
	expect(container.querySelector('h3')?.textContent).toBe('Top Authors')
})
