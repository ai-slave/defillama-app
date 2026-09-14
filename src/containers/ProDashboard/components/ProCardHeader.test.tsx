// @vitest-environment happy-dom
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SortableItem } from '~/containers/ProtocolOverview/ProtocolPro'
import { DashboardCardContext, type DashboardCardContextValue } from './DashboardCardContext'
import { ProCardHeader } from './ProCardHeader'

const mocks = vi.hoisted(() => ({
	permissions: { isReadOnly: false, hideDuplicateButton: false }
}))
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardPermissions: () => mocks.permissions,
	useProDashboardDashboard: () => ({ currentDashboard: null }),
	useProDashboardItemsState: () => ({ items: [] }),
	useProDashboardVariables: () => ({ variables: [], canEditVariables: false, bindItemField: () => {} })
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		hasActiveSubscription: true,
		isTrial: false,
		loaders: { userLoading: false }
	})
}))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.permissions.isReadOnly = false
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function renderInCard(children: ReactNode, context: DashboardCardContextValue) {
	return (
		<DndContext>
			<SortableContext items={['card-1']}>
				<SortableItem
					id="card-1"
					className="group/dashboard-card"
					{...(mocks.permissions.isReadOnly ? { disabled: { draggable: true, droppable: true } } : {})}
				>
					<DashboardCardContext.Provider value={context}>{children}</DashboardCardContext.Provider>
				</SortableItem>
			</SortableContext>
		</DndContext>
	)
}

function buttons() {
	return Array.from(container.querySelectorAll('button'))
}

test('an editable card header carries the grip, the pencil and the overflow menu', async () => {
	const onEdit = vi.fn()
	await act(async () =>
		root.render(
			renderInCard(
				<ProCardHeader
					title="Aave TVL"
					subtitle={<span>Protocol</span>}
					controls={<button type="button">Grouping</button>}
					viewerControls={<button type="button">Series</button>}
				/>,
				{ itemId: 'card-1', onEdit, onRemove: vi.fn() }
			)
		)
	)
	const grip = container.querySelector<HTMLButtonElement>('[aria-label="Drag to reorder this card"]')
	expect(grip).not.toBeNull()
	expect(grip!.getAttribute('aria-roledescription')).toBe('sortable')
	expect(container.querySelector('h2')?.textContent).toBe('Aave TVL')
	expect(container.querySelector('[aria-label="More actions"]')).not.toBeNull()

	const pencil = buttons().find((node) => node.textContent?.trim() === 'Edit card')!
	const controls = pencil.parentElement!
	expect(controls.getAttribute('role')).toBe('presentation')
	expect(controls.textContent).toContain('Grouping')
	expect(controls.textContent).not.toContain('Series')
	await act(async () => pencil.click())
	expect(onEdit).toHaveBeenCalledOnce()
})

test('a read-only card header drops the grip and the pencil but keeps the menu', async () => {
	mocks.permissions.isReadOnly = true
	await act(async () =>
		root.render(
			renderInCard(
				<ProCardHeader
					title="Aave TVL"
					viewerControls={<button type="button">Series</button>}
					menu={{ csv: { onClick: vi.fn() } }}
				/>,
				{ itemId: 'card-1', onEdit: vi.fn(), onRemove: vi.fn() }
			)
		)
	)
	expect(container.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(buttons().some((node) => node.textContent?.trim() === 'Edit card')).toBe(false)
	expect(container.textContent).toContain('Series')
	expect(container.querySelector('[aria-label="More actions"]')).not.toBeNull()
})
