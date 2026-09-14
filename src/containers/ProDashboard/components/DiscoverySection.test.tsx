// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import { DiscoverySection } from './DiscoverySection'

vi.mock('./DashboardCard', () => ({
	DashboardCard: ({ dashboard }: { dashboard: Dashboard }) => <div>{dashboard.data.dashboardName}</div>
}))

function makeDashboard(id: string): Dashboard {
	return { id, data: { items: [], dashboardName: `Board ${id}` } } as Dashboard
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(dashboards: Array<Dashboard>, isLoading = false) {
	await act(async () =>
		root.render(
			<DiscoverySection
				title="Trending Today"
				subtitle="Most viewed in the last 24 hours"
				dashboards={dashboards}
				isLoading={isLoading}
				seeAllHref="/pro?tab=discover&sortBy=trending"
				emptyMessage="Nothing trending yet"
				onTagClick={() => {}}
			/>
		)
	)
}

test('an empty shelf keeps its heading and explains the gap', async () => {
	await render([])
	expect(container.querySelector('h3')?.textContent).toBe('Trending Today')
	expect(container.textContent).toContain('Nothing trending yet')
	expect(container.querySelector('a')).toBeNull()
})

test('the heading carries the title, subtitle and a see all link', async () => {
	await render([makeDashboard('a')])
	expect(container.querySelector('h3')?.textContent).toBe('Trending Today')
	expect(container.textContent).toContain('Most viewed in the last 24 hours')
	const seeAll = container.querySelector('a')
	expect(seeAll?.getAttribute('href')).toBe('/pro?tab=discover&sortBy=trending')
	expect(seeAll?.textContent).toContain('See all')
})

test('a loading shelf shows the heading without a see all link', async () => {
	await render([], true)
	expect(container.querySelector('h3')?.textContent).toBe('Trending Today')
	expect(container.querySelector('a')).toBeNull()
})

test('three cards fit the rail, so no scroll button is rendered', async () => {
	await render([makeDashboard('a'), makeDashboard('b'), makeDashboard('c')])
	expect(container.querySelectorAll('button')).toHaveLength(0)
	expect(container.textContent).toContain('Board c')
})
