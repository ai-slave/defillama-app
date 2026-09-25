// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CopyDashboardLinkButton } from './CopyDashboardLinkButton'

vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() })
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function buttonLabelled(label: string) {
	return Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
}

async function openShare() {
	await act(async () => buttonLabelled('Share')!.click())
}

test('a private dashboard hides the share button from everyone but its owner', async () => {
	await act(async () =>
		root.render(<CopyDashboardLinkButton dashboardVisibility="private" dashboardId="dashboard-1" />)
	)
	expect(buttonLabelled('Share')).toBeUndefined()

	await act(async () =>
		root.render(<CopyDashboardLinkButton dashboardVisibility="private" dashboardId="dashboard-1" isOwner />)
	)
	expect(buttonLabelled('Share')).toBeDefined()
})

test('the owner of a private dashboard gets an explanation and a way to publish', async () => {
	const onMakePublic = vi.fn(async () => {})
	const onSelect = vi.fn()
	await act(async () =>
		root.render(
			<CopyDashboardLinkButton
				dashboardVisibility="private"
				dashboardId="dashboard-1"
				isOwner
				onMakePublic={onMakePublic}
				manageAction={{ label: 'Open settings', onSelect }}
			/>
		)
	)
	await openShare()
	expect(document.body.textContent).toContain('This dashboard is private. Only you can open the link.')
	const makePublic = buttonLabelled('Make public')!
	expect(makePublic.getAttribute('data-umami-event')).toBe('dashboard-make-public')
	await act(async () => makePublic.click())
	expect(onMakePublic).toHaveBeenCalledOnce()

	await act(async () => buttonLabelled('Open settings')!.click())
	expect(onSelect).toHaveBeenCalledOnce()
})

test('publishing announces that the dashboard is live and offers to copy its link', async () => {
	const onMakePublic = vi.fn(async () => {})
	await act(async () =>
		root.render(
			<CopyDashboardLinkButton
				dashboardVisibility="private"
				dashboardId="dashboard-1"
				isOwner
				onMakePublic={onMakePublic}
			/>
		)
	)
	await openShare()
	await act(async () => buttonLabelled('Make public')!.click())

	const toast = (await import('react-hot-toast')).default
	const [render, options] = (
		toast as unknown as { mock: { calls: Array<[(instance: { id: string }) => ReactNode, { id: string }]> } }
	).mock.calls.at(-1)!
	expect(options.id).toBe('dashboard-live')
	const toastContainer = document.createElement('div')
	document.body.append(toastContainer)
	const toastRoot = createRoot(toastContainer)
	await act(async () => toastRoot.render(render({ id: 'dashboard-live' })))
	expect(toastContainer.textContent).toContain('Dashboard is live')
	const copyLinkAction = Array.from(toastContainer.querySelectorAll('button')).find(
		(node) => node.textContent?.trim() === 'Copy link'
	)!
	expect(copyLinkAction.getAttribute('data-umami-event')).toBe('dashboard-live-copy-link')
	await navigator.clipboard.writeText('')
	await act(async () => copyLinkAction.click())
	expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/pro/dashboard-1`)
	await act(async () => toastRoot.unmount())
	toastContainer.remove()
})

test('a publish that the server rejects surfaces its reason', async () => {
	const onMakePublic = vi.fn(async () => {
		throw new Error('This dashboard is read-only')
	})
	await act(async () =>
		root.render(
			<CopyDashboardLinkButton
				dashboardVisibility="private"
				dashboardId="dashboard-1"
				isOwner
				onMakePublic={onMakePublic}
			/>
		)
	)
	await openShare()
	await act(async () => buttonLabelled('Make public')!.click())
	const toast = (await import('react-hot-toast')).default
	expect(toast.error).toHaveBeenCalledWith('This dashboard is read-only')
})

test('a free-tier owner sees the explanation without the publish button', async () => {
	await act(async () =>
		root.render(<CopyDashboardLinkButton dashboardVisibility="private" dashboardId="dashboard-1" isOwner />)
	)
	await openShare()
	expect(document.body.textContent).toContain('This dashboard is private.')
	expect(buttonLabelled('Make public')).toBeUndefined()
})

test('a public dashboard keeps its link and embed snippet', async () => {
	await act(async () =>
		root.render(
			<CopyDashboardLinkButton dashboardVisibility="public" dashboardId="dashboard-1" dashboardSlug="my-board" />
		)
	)
	await openShare()
	const link = document.body.querySelector<HTMLInputElement>('input[readonly]')!
	expect(link.value).toContain('/pro/my-board')
	const embed = document.body.querySelector<HTMLTextAreaElement>('[aria-label="Embed code"]')!
	expect(embed.value).toContain('<iframe')
	expect(buttonLabelled('Make public')).toBeUndefined()
})
