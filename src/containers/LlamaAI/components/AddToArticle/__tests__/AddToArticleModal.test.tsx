// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts, fieldErrorOf, fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))
// The toast library is the app's notification boundary; its calls are what a user would see.
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError, dismiss: vi.fn() } }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { AddToArticleModal } from '../AddToArticleModal'

const session = installSubscriberSession('writer', { resolved: true })
const MINE = 'https://features.llama.fi/articles/mine'
const DRAFTS = {
	items: [{ id: 'a1', title: 'Weekly recap', status: 'draft', updatedAt: '2026-09-01T00:00:00.000Z' }],
	total: 1
}
let root: Root

function Harness() {
	const store = Ariakit.useDialogStore()
	return (
		<session.Wrapper>
			<button type="button" onClick={store.show}>
				Open
			</button>
			<AddToArticleModal dialogStore={store} request={{ kind: 'selection', html: '<p>TVL rose</p>', charts: {} }} />
		</session.Wrapper>
	)
}
function button(name: string) {
	const found = [...document.querySelectorAll('button')].find((el) => accessibleName(el) === name)
	expect(found, `button ${name}`).not.toBeUndefined()
	return found!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
function dialog() {
	return document.querySelector('[role="dialog"]')!
}
async function expectText(text: string) {
	await act(async () => {
		await waitForUi(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain(text))
	})
}

beforeEach(async () => {
	vi.clearAllMocks()
	const container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<Harness />))
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

test('drafts that fail to load say so; Try again keeps the error while it waits, then lists them and focuses the search field', async () => {
	const retry = Promise.withResolvers<Response>()
	session.serveInOrder(MINE, [fixtureStatus(500, { error: 'Database unavailable' }), () => retry.promise], DRAFTS)
	await click('Open')
	await act(async () => {
		await waitForUi(() => expect(alertTexts(dialog())).toHaveLength(1))
	})
	expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('No drafts yet')
	const tryAgain = button('Try again')
	await act(async () => {
		tryAgain.focus()
		tryAgain.click()
	})
	await act(async () => {
		await waitForUi(() => expect(accessibleName(tryAgain)).toBe('Retrying…'))
	})
	expect(alertTexts(dialog())).toHaveLength(1)
	expect(document.activeElement).toBe(tryAgain)

	await act(async () => retry.resolve(Response.json(DRAFTS)))
	await expectText('Weekly recap')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	await act(async () => {
		await waitForUi(() => expect(document.activeElement).toBe(document.querySelector('input')))
	})
})

test('a failed export stays in the dialog as a plain sentence instead of a toast, also while its retry runs', async () => {
	const retry = Promise.withResolvers<Response>()
	session.serve({ [MINE]: DRAFTS })
	session.serveInOrder('https://features.llama.fi/articles/a1/edit', [
		fixtureStatus(500, { error: 'boom' }),
		() => retry.promise
	])
	await click('Open')
	await expectText('Weekly recap')
	// A draft row reads its title, then its last edit date.
	const draft = [...document.querySelectorAll('button')].find((el) => accessibleName(el).startsWith('Weekly recap'))!
	await act(async () => draft.click())
	await click('Add to article')
	await act(async () => {
		await waitForUi(() => expect(alertTexts(dialog())).toHaveLength(1))
	})
	// Adding to an existing article, not creating a draft.
	expect(alertTexts(dialog())[0]).toContain('add to the article')
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	expect(toastError).not.toHaveBeenCalled()
	expect(button('Add to article').getAttribute('aria-busy')).toBeNull()
	await click('Add to article')
	await act(async () => {
		await waitForUi(() => expect(button('Adding…').getAttribute('aria-busy')).toBe('true'))
	})
	expect(alertTexts(dialog())).toHaveLength(1)
	await act(async () => retry.resolve(fixtureStatus(500, { error: 'boom' })()))
})

test('adding without a target says what is missing under the field it names and focuses it', async () => {
	session.serve({ [MINE]: DRAFTS })
	await click('Open')
	await expectText('Weekly recap')
	expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Choose a draft')
	await click('Add to article')
	expect(fieldErrorTexts(document.querySelector('[role="dialog"]')!)).toEqual([
		'Choose a draft or create a new article.'
	])
	expect(document.activeElement).toBe(document.querySelector('input[aria-label="Search drafts"]'))
	await click('Create new article')
	expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Choose a draft')
	const title = document.querySelector<HTMLInputElement>('input[name="newArticleTitle"]')!
	await click('Create draft')
	expect(fieldErrorOf(title)).toBe('Enter a title for the new article.')
	expect(document.activeElement).toBe(title)
})

// A browser submits the form on Enter in a text field unless the keydown is cancelled; happy-dom does not, so the
// cancelled keydown is the contract.
test('Enter in the draft search finishes the search without submitting', async () => {
	session.serve({ [MINE]: DRAFTS })
	await click('Open')
	await expectText('Weekly recap')
	const search = document.querySelector<HTMLInputElement>('input[aria-label="Search drafts"]')!
	const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
	await act(async () => search.dispatchEvent(enter))
	expect(enter.defaultPrevented).toBe(true)
	expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Choose a draft')
})

test('while an export runs, the target cannot change under it', async () => {
	const edit = Promise.withResolvers<Response>()
	session.serve({ [MINE]: DRAFTS, 'https://features.llama.fi/articles/a1/edit': () => edit.promise })
	await click('Open')
	await expectText('Weekly recap')
	const draft = [...document.querySelectorAll('button')].find((el) => accessibleName(el).startsWith('Weekly recap'))!
	await act(async () => draft.click())
	await click('Add to article')
	await act(async () => {
		await waitForUi(() => expect(button('Adding…').getAttribute('aria-busy')).toBe('true'))
	})
	// A browser disables every control inside a disabled fieldset; happy-dom does not compute that, so read it the same way.
	const locked = (control: HTMLElement) =>
		control.matches(':disabled') || control.closest('fieldset[disabled]') !== null
	expect(locked(button('Create new article'))).toBe(true)
	expect(locked(draft)).toBe(true)
	await act(async () => edit.resolve(fixtureStatus(500, { error: 'boom' })()))
})
