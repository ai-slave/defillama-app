// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { Dashboard } from '../../dashboardTypes'
import { DashboardCard } from '../DashboardCard'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, isReady: true }) }))

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

const session = installSubscriberSession('reader', { resolved: true })
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

async function render(dashboard: Dashboard, onDelete?: (id: string) => Promise<void>) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardCard dashboard={dashboard} viewMode="grid" {...(onDelete ? { onDelete } : {})} />
			</session.Wrapper>
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
	expect(container.textContent).not.toContain('1 cards')
	expect(container.textContent).toContain('1 view')
	expect(container.textContent).not.toContain('1 views')
})

test('the card actions menu only exists when the card can be deleted', async () => {
	await render(makeDashboard({ visibility: 'private' }))
	expect(container.querySelector('[aria-label="Actions for Audit board"]')).toBeNull()
	await render(makeDashboard({ visibility: 'private' }), async () => {})
	expect(container.querySelector('[aria-label="Actions for Audit board"]')).not.toBeNull()
})

test('a team dashboard names its last editor and hides delete for members who cannot delete', async () => {
	const onDelete = vi.fn(async () => {})
	await render(
		makeDashboard({
			visibility: 'private',
			team: { id: 'team-1', name: 'Growth' },
			editedBy: { slug: 'ana', displayName: 'Ana', socials: {}, createdAt: '', updatedAt: '' },
			access: { role: 'member', canEdit: true, canDelete: false, canMove: false }
		}),
		onDelete
	)
	expect(container.textContent).toContain('Edited by Ana')
	expect(container.querySelector('[aria-label="Actions for Audit board"]')).toBeNull()

	await render(
		makeDashboard({
			visibility: 'private',
			team: { id: 'team-1', name: 'Growth' },
			access: { role: 'admin', canEdit: true, canDelete: true, canMove: true }
		}),
		onDelete
	)
	expect(container.querySelector('[aria-label="Actions for Audit board"]')).not.toBeNull()
})

test('a tag is a plain label where the page has no tag filter, and a filter button where it does', async () => {
	await render(makeDashboard({ visibility: 'private' }))
	const label = [...container.querySelectorAll('span')].find((node) => node.textContent === 'Security')
	expect(label).toBeDefined()
	expect([...container.querySelectorAll('button')].some((node) => node.textContent === 'Security')).toBe(false)

	const onTagClick = vi.fn()
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardCard dashboard={makeDashboard({ visibility: 'private' })} viewMode="grid" onTagClick={onTagClick} />
			</session.Wrapper>
		)
	)
	const button = [...container.querySelectorAll('button')].find((node) => node.textContent === 'Security')!
	await act(async () => button.click())
	expect(onTagClick).toHaveBeenCalledWith('Security')
})

test('every card names its own link and actions after its dashboard', async () => {
	await render(makeDashboard({ visibility: 'private' }), async () => {})
	expect(container.querySelector('a[href="/pro/dash-1-slug"]')?.textContent).toBe('View Audit board')
	expect(container.querySelector('[aria-label="Actions for Audit board"]')).not.toBeNull()
})

test('canceling a delete from the card menu returns focus to the menu button', async () => {
	await render(makeDashboard({}), async () => {})
	const menuButton = container.querySelector<HTMLButtonElement>('[aria-label="Actions for Audit board"]')!
	await act(async () => {
		menuButton.focus()
		menuButton.click()
	})
	const remove = await waitForUi(() => {
		const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(el) => el.textContent === 'Delete…'
		)
		expect(item).toBeDefined()
		return item!
	})
	await act(async () => {
		remove.focus()
		remove.click()
	})
	const cancel = await waitForUi(() => {
		const button = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
			(el) => el.textContent === 'Cancel'
		)
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => cancel.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(menuButton))
})

async function deleteFromMenu(name: string) {
	const menuButton = container.querySelector<HTMLButtonElement>(`[aria-label="Actions for ${name}"]`)!
	await act(async () => {
		menuButton.focus()
		menuButton.click()
	})
	const remove = await waitForUi(() => {
		const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(el) => el.textContent === 'Delete…'
		)
		expect(item).toBeDefined()
		return item!
	})
	await act(async () => {
		remove.focus()
		remove.click()
	})
	const confirm = await waitForUi(() => {
		const button = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
			(el) => el.textContent === 'Delete'
		)
		expect(button).toBeDefined()
		return button!
	})
	await act(async () => confirm.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(menuButton))
}

function renderList(dashboards: Array<Dashboard>) {
	return act(async () =>
		root.render(
			<session.Wrapper>
				<main>
					<section aria-label="My dashboards" tabIndex={-1}>
						<div>
							{dashboards.map((item) => (
								<DashboardCard key={item.id} dashboard={item} viewMode="grid" onDelete={async () => {}} />
							))}
						</div>
					</section>
				</main>
			</session.Wrapper>
		)
	)
}

test('a deleted dashboard that leaves the list hands focus to the next card', async () => {
	const first = makeDashboard({})
	const second = makeDashboard({ id: 'dash-2', slug: 'dash-2-slug', data: { items: [], dashboardName: 'Fees board' } })
	await renderList([first, second])
	await deleteFromMenu('Audit board')
	// The list refetch drops the deleted card after the confirmation has closed onto its menu button.
	await renderList([second])
	await waitForUi(() => expect(document.activeElement).toBe(container.querySelector('a[href="/pro/dash-2-slug"]')))
})

test('the last deleted dashboard hands focus to the list region', async () => {
	await renderList([makeDashboard({})])
	await deleteFromMenu('Audit board')
	await renderList([])
	await waitForUi(() => expect(document.activeElement).toBe(container.querySelector('section')))
})
