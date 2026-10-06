// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { Dashboard } from '../../dashboardTypes'
import { DiscoverySection } from '../DiscoverySection'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, isReady: true }) }))
const session = installSubscriberSession('reader', { resolved: true })

function makeDashboard(id: string): Dashboard {
	return {
		id,
		data: { items: [], dashboardName: `Board ${id}` },
		created: '2026-01-01T00:00:00Z',
		updated: '2026-01-02T00:00:00Z'
	} as Dashboard
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
			<session.Wrapper>
				<DiscoverySection
					title="Trending Today"
					subtitle="Most viewed in the last 24 hours"
					dashboards={dashboards}
					isLoading={isLoading}
					seeAllHref="/pro?tab=discover&sortBy=trending"
					emptyMessage="Nothing trending yet"
					onTagClick={() => {}}
				/>
			</session.Wrapper>
		)
	)
}

const seeAllLink = () => [...container.querySelectorAll('a')].find((link) => link.textContent?.trim() === 'See all')

test('only a populated shelf links to see all; empty and loading shelves keep the heading', async () => {
	await render([])
	expect(container.querySelector('h3')?.textContent).toBe('Trending Today')
	expect(container.textContent).toContain('Nothing trending yet')
	expect(seeAllLink()).toBeUndefined()

	await render([], true)
	expect(container.querySelector('h3')?.textContent).toBe('Trending Today')
	expect(container.textContent).not.toContain('Nothing trending yet')
	expect(seeAllLink()).toBeUndefined()

	await render([makeDashboard('a')])
	expect(seeAllLink()?.getAttribute('href')).toBe('/pro?tab=discover&sortBy=trending')
})

test('an overflowing rail offers a scroll button only once it holds more than three cards', async () => {
	vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1200)
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
	try {
		await render([makeDashboard('a'), makeDashboard('b'), makeDashboard('c')])
		await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
		expect(container.textContent).toContain('Board c')
		expect(container.querySelector('[aria-label="Scroll Trending Today right"]')).toBeNull()

		await render([makeDashboard('a'), makeDashboard('b'), makeDashboard('c'), makeDashboard('d')])
		await waitForUi(() => expect(container.querySelector('[aria-label="Scroll Trending Today right"]')).not.toBeNull())
	} finally {
		vi.restoreAllMocks()
	}
})
