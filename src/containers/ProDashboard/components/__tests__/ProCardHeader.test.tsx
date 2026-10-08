// @vitest-environment happy-dom
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SortableItem } from '~/containers/ProtocolOverview/ProtocolPro'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { DashboardCardContext, type DashboardCardContextValue } from '../DashboardCardContext'
import { ProCardHeader } from '../ProCardHeader'

const session = installSubscriberSession('u1', { resolved: true })
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
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

function renderInCard(children: ReactNode, context: DashboardCardContextValue, isReadOnly = false) {
	return (
		<session.Wrapper>
			<DashboardTestProvider mode={isReadOnly ? 'view' : 'edit'} permissions={{ isReadOnly }}>
				<DndContext>
					<SortableContext items={['card-1']}>
						<SortableItem
							id="card-1"
							className="group/dashboard-card"
							{...(isReadOnly ? { disabled: { draggable: true, droppable: true } } : {})}
						>
							<DashboardCardContext.Provider value={context}>{children}</DashboardCardContext.Provider>
						</SortableItem>
					</SortableContext>
				</DndContext>
			</DashboardTestProvider>
		</session.Wrapper>
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

	expect(container.textContent).toContain('Grouping')
	expect(container.textContent).toContain('Series')
	const pencil = buttons().find((node) => node.getAttribute('aria-label') === 'Edit card')!
	await act(async () => pencil.click())
	expect(onEdit).toHaveBeenCalledOnce()
})

test('a read-only card header drops the grip and the pencil but keeps the menu', async () => {
	await act(async () =>
		root.render(
			renderInCard(
				<ProCardHeader
					title="Aave TVL"
					controls={<button type="button">Grouping</button>}
					viewerControls={<button type="button">Series</button>}
					menu={{ csv: { onClick: vi.fn() } }}
				/>,
				{ itemId: 'card-1', onEdit: vi.fn(), onRemove: vi.fn() },
				true
			)
		)
	)
	expect(container.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(buttons().some((node) => node.textContent?.trim() === 'Edit card')).toBe(false)
	expect(container.textContent).not.toContain('Grouping')
	expect(container.textContent).toContain('Series')
	expect(container.querySelector('[aria-label="More actions"]')).not.toBeNull()
})
