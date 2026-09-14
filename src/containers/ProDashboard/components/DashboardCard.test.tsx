// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import { DashboardCard } from './DashboardCard'

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: vi.fn(), isAuthenticated: true })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, isReady: true }) }))
vi.mock('../services/DashboardAPI', async () => {
	const actual = await vi.importActual<typeof import('../services/DashboardAPI')>('../services/DashboardAPI')
	return { ...actual, dashboardAPI: {} }
})

function makeDashboard(overrides: Partial<Dashboard>): Dashboard {
	return {
		id: 'dash-1',
		slug: 'dash-1-slug',
		data: {
			items: [{ kind: 'chart' }, { kind: 'chart' }, { kind: 'unified-table' }, { kind: 'section' }],
			dashboardName: 'Audit board'
		},
		tags: ['Security', 'Yields', 'Fees', 'Extra'],
		viewCount: 1234,
		created: '2026-01-01T00:00:00Z',
		updated: '2026-01-02T00:00:00Z',
		...overrides
	} as Dashboard
}

let container: HTMLDivElement
let root: Root
let client: QueryClient

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(dashboard: Dashboard, onDelete?: (id: string) => Promise<void>) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardCard dashboard={dashboard} viewMode="grid" {...(onDelete ? { onDelete } : {})} />
			</QueryClientProvider>
		)
	)
}

function previewTiles() {
	return container.querySelectorAll('[data-testid="dashboard-preview-tile"]')
}

test('a private dashboard renders the config composition instead of an image', async () => {
	await render(makeDashboard({ visibility: 'private' }))
	expect(container.querySelector('img')).toBeNull()
	expect(container.querySelector('[data-testid="dashboard-preview"]')).not.toBeNull()
	expect(previewTiles()).toHaveLength(3)
	expect(container.textContent).toContain('Security')
	expect([...container.querySelectorAll('span')].some((node) => node.textContent === 'Extra')).toBe(false)
})

test('a private dashboard with no cards says so', async () => {
	await render(makeDashboard({ visibility: 'private', data: { items: [], dashboardName: 'Empty board' } }))
	expect(container.querySelector('img')).toBeNull()
	expect(previewTiles()).toHaveLength(0)
	expect(container.textContent).toContain('No cards yet')
})

test('a public dashboard renders the same composition, not the shared thumbnail', async () => {
	await render(makeDashboard({ visibility: 'public' }))
	expect(container.querySelector('img')).toBeNull()
	expect(container.querySelector('[data-testid="dashboard-preview"]')).not.toBeNull()
	expect(previewTiles()).toHaveLength(3)
})

test('the card and view counters read as plain text and the kinds move to a title', async () => {
	await render(makeDashboard({ visibility: 'public' }))
	expect(container.textContent).toContain('3 cards')
	expect(container.textContent).toContain('1,234 views')
	expect(container.querySelector('[aria-label="3 cards"]')).toBeNull()
	expect(container.querySelector('[aria-label="1,234 views"]')).toBeNull()
	expect(container.querySelector('[title="2 charts, 1 table"]')?.textContent).toBe('3 cards')
})

test('a single card and a single view read in the singular', async () => {
	await render(
		makeDashboard({
			visibility: 'public',
			viewCount: 1,
			data: { items: [{ kind: 'metric' }], dashboardName: 'One card' } as Dashboard['data']
		})
	)
	expect(container.textContent).toContain('1 card')
	expect(container.textContent).toContain('1 view')
})

test('the card actions menu only exists when the card can be deleted', async () => {
	await render(makeDashboard({ visibility: 'private' }))
	expect(container.querySelector('[aria-label="Dashboard card actions"]')).toBeNull()
	await render(makeDashboard({ visibility: 'private' }), async () => {})
	expect(container.querySelector('[aria-label="Dashboard card actions"]')).not.toBeNull()
})
