// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardSaveNotices } from '../../hooks/useDashboardAPI'
import { DashboardSettingsModal } from '../DashboardSettingsModal'

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const session = installSubscriberSession('owner', { resolved: true })
let root: Root
let container: HTMLDivElement
const save = vi.fn(async (): Promise<DashboardSaveNotices> => ({ refreshPending: false }))
const close = vi.fn()
const remove = vi.fn(async () => {})
const move = vi.fn(async () => {})

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderSettings(
	tags: Array<string> = [],
	teamProps: {
		myTeam?: { id: string; name: string } | null
		team?: { id: string; name: string } | null
		canMove?: boolean
	} = {}
) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardSettingsModal
					isOpen
					onClose={close}
					dashboardName="Original"
					visibility="public"
					tags={tags}
					dashboardId="dashboard-1"
					onSave={save}
					onDelete={remove}
					onMoveTeam={move}
					{...teamProps}
				/>
			</session.Wrapper>
		)
	)
}

function teamSwitch() {
	return document.querySelector<HTMLInputElement>('input[type="checkbox"][id$="-share-team"]')
}

function tagInput() {
	const label = [...document.querySelectorAll('label')].find((node) => node.textContent === 'Tags')!
	return document.getElementById(label.htmlFor) as HTMLInputElement
}

function button(label: string) {
	return Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
}

async function submit() {
	await act(async () =>
		document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
}

test('the form keeps visibility and tags and no longer carries the name or description', async () => {
	await renderSettings()
	expect(document.querySelector('[name="dashboardName"]')).toBeNull()
	expect(document.querySelector('[name="description"]')).toBeNull()
	tagInput().value = 'Lending'
	await act(async () => button('Add tag')!.click())
	await act(async () => document.querySelector<HTMLInputElement>('input[type="radio"][value="private"]')!.click())
	await submit()
	expect(save).toHaveBeenCalledExactlyOnceWith({ visibility: 'private', tags: ['lending'] })
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	const toast = (await import('react-hot-toast')).default
	expect(toast.success).toHaveBeenCalledWith(
		'Settings saved',
		expect.objectContaining({ id: 'dashboard-settings-saved' })
	)
})

test("the save's merge and refresh notices show only once the dialog has closed", async () => {
	const saved = Promise.withResolvers<DashboardSaveNotices>()
	save.mockReturnValueOnce(saved.promise)
	const toast = (await import('react-hot-toast')).default
	// Whether the dialog had closed when each notice appeared.
	const closedWhenShown: Array<boolean> = []
	vi.mocked(toast).mockImplementationOnce(() => (closedWhenShown.push(close.mock.calls.length > 0), ''))
	vi.mocked(toast.error).mockImplementationOnce(() => (closedWhenShown.push(close.mock.calls.length > 0), ''))
	await renderSettings()
	await submit()
	await act(async () => saved.resolve({ mergeNotice: 'Your edits were merged.', refreshPending: true }))
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(vi.mocked(toast).mock.calls[0][0]).toBe('Your edits were merged.')
	expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('Dashboard saved, but chart refresh setup is pending.')
	expect(closedWhenShown).toEqual([true, true])
})

test('a removed tag leaves the draft before the save is sent', async () => {
	await renderSettings(['lending'])
	await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Remove tag lending"]')!.click())
	await submit()
	expect(save).toHaveBeenCalledExactlyOnceWith({ visibility: 'public', tags: [] })
})

test('removing a tag hands focus to the next tag, then the previous one, then the tag field', async () => {
	await renderSettings(['defi', 'lending', 'yield'])
	const removeTag = (tag: string) => document.querySelector<HTMLButtonElement>(`[aria-label="Remove tag ${tag}"]`)!
	const press = async (tagButton: HTMLButtonElement) =>
		act(async () => {
			tagButton.focus()
			tagButton.click()
		})
	await press(removeTag('lending'))
	expect(document.activeElement).toBe(removeTag('yield'))
	await press(removeTag('yield'))
	expect(document.activeElement).toBe(removeTag('defi'))
	await press(removeTag('defi'))
	expect(document.activeElement).toBe(document.querySelector('input[placeholder="e.g. lending"]'))
})

test('deletion runs through the confirmation dialog and reports a failure there', async () => {
	remove.mockRejectedValueOnce(new Error('Offline'))
	await renderSettings()
	await act(async () => button('Delete dashboard')!.click())
	expect(document.body.textContent).toContain('Deleting “Original” cannot be undone.')
	await act(async () => button('Delete')!.click())
	await waitForUi(() =>
		expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Could not delete')
	)
	expect(close).not.toHaveBeenCalled()
	await act(async () => button('Delete')!.click())
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(remove).toHaveBeenCalledTimes(2)
	expect(remove).toHaveBeenLastCalledWith('dashboard-1')
})

test('sharing with the team is a separate call that lands after the settings save', async () => {
	await renderSettings([], { myTeam: { id: 'team-1', name: 'Growth' }, team: null, canMove: true })
	const toggle = teamSwitch()!
	expect(toggle.checked).toBe(false)
	expect(document.body.textContent).toContain('Share with Growth')
	await act(async () => toggle.click())
	await submit()
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(move).toHaveBeenCalledExactlyOnceWith('team-1')
	expect(save).toHaveBeenCalledExactlyOnceWith({ visibility: 'public', tags: [] })
	expect(save.mock.invocationCallOrder[0]).toBeLessThan(move.mock.invocationCallOrder[0])
})

test('an unchanged switch does not move, and unchecking moves the dashboard back to personal', async () => {
	await renderSettings([], {
		myTeam: { id: 'team-1', name: 'Growth' },
		team: { id: 'team-1', name: 'Growth' },
		canMove: true
	})
	const toggle = teamSwitch()!
	expect(toggle.checked).toBe(true)
	await submit()
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(move).not.toHaveBeenCalled()

	close.mockClear()
	await act(async () => toggle.click())
	await submit()
	await waitForUi(() => expect(close).toHaveBeenCalledOnce())
	expect(move).toHaveBeenCalledExactlyOnceWith(null)
})

test('members see the sharing state but cannot change it, and users without a team see nothing', async () => {
	await renderSettings([], {
		myTeam: { id: 'team-1', name: 'Growth' },
		team: { id: 'team-1', name: 'Growth' },
		canMove: false
	})
	expect(teamSwitch()!.disabled).toBe(true)
	expect(teamSwitch()!.checked).toBe(true)
	expect(document.body.textContent).toContain('Only the creator or a team admin can change this.')

	await renderSettings([], { myTeam: null, team: null, canMove: true })
	expect(teamSwitch()).toBeNull()
})

test('a failed move keeps the dialog open after the settings save', async () => {
	move.mockRejectedValueOnce(new Error('Unauthorized'))
	await renderSettings([], { myTeam: { id: 'team-1', name: 'Growth' }, team: null, canMove: true })
	await act(async () => teamSwitch()!.click())
	await submit()
	await waitForUi(() =>
		expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Could not save changes')
	)
	expect(save).toHaveBeenCalledOnce()
	expect(close).not.toHaveBeenCalled()
})
