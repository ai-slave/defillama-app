// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ProjectsGrid } from '../ProjectsGrid'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/router', () => ({ useRouter: () => ({ push }) }))

const session = installSubscriberSession('user')
let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	push.mockReset()
	session.serve({
		[`${AI_SERVER}/projects/usage`]: { limits: { projects: 10 } },
		[`${AI_SERVER}/projects`]: {
			projects: [{ id: 'research', name: 'Research', updated_at: '2026-09-01', file_count: 0, total_bytes: 0 }]
		}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProjectsGrid />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const openDialog = () =>
	[...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].find((dialog) => !dialog.hidden)
const dialogTitle = () => document.getElementById(openDialog()!.getAttribute('aria-labelledby')!)?.textContent

test('project cards have a real link with separate rename and delete controls', async () => {
	await waitForUi(() => expect(container.querySelector('a[href="/ai/projects/research"]')).not.toBeNull())
	const link = container.querySelector<HTMLAnchorElement>('a[href="/ai/projects/research"]')!
	expect(link.textContent).toBe('Research')
	expect(link.querySelector('button')).toBeNull()

	await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Rename Research"]')!.click())
	await waitForUi(() => expect(dialogTitle()).toBe('Rename project'))
	expect(openDialog()!.querySelector('input')!.value).toBe('Research')
	const cancel = [...openDialog()!.querySelectorAll('button')].find((button) => button.textContent === 'Cancel')!
	await act(async () => cancel.click())
	await waitForUi(() => expect(openDialog()).toBeUndefined())

	await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Delete Research"]')!.click())
	await waitForUi(() => expect(openDialog()?.textContent).toContain('Research'))
	expect(push).not.toHaveBeenCalled()
})

test.each(['Clear project search', 'Clear search'])('%s returns focus to the search field', async (name) => {
	await waitForUi(() => expect(container.querySelector('a[href="/ai/projects/research"]')).not.toBeNull())
	const search = container.querySelector<HTMLInputElement>('input[aria-label="Search projects"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'nothing matches')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	const clear = () =>
		[...container.querySelectorAll('button')].find(
			(button) => button.getAttribute('aria-label') === name || button.textContent === name
		)
	await waitForUi(() => expect(clear()).toBeDefined())
	await act(async () => {
		clear()!.focus()
		clear()!.click()
	})
	await waitForUi(() => expect(clear()).toBeUndefined())
	expect(search.value).toBe('')
	expect(document.activeElement).toBe(search)
})
