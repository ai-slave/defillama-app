// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
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

test('drafts that fail to load say so, and Try again lists them with focus kept in the search field', async () => {
	session.serveInOrder(MINE, [fixtureStatus(500, { error: 'Database unavailable' })], DRAFTS)
	await click('Open')
	await expectText("Couldn't load your drafts.")
	expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('No drafts yet')
	await click('Try again')
	await expectText('Weekly recap')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.activeElement).toBe(document.querySelector('input'))
})

test('a failed export stays in the dialog as a plain sentence instead of a toast', async () => {
	session.serve({ [MINE]: DRAFTS, 'https://features.llama.fi/articles/a1/edit': fixtureStatus(500, { error: 'boom' }) })
	await click('Open')
	await expectText('Weekly recap')
	// A draft row reads its title, then its last edit date.
	const draft = [...document.querySelectorAll('button')].find((el) => accessibleName(el).startsWith('Weekly recap'))!
	await act(async () => draft.click())
	await click('Add to article')
	await act(async () => {
		await waitForUi(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't add to the article. Try again.")
		)
	})
	expect(session.urls()).toContain('https://features.llama.fi/articles/a1/edit')
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	expect(toastError).not.toHaveBeenCalled()
	expect(button('Add to article').getAttribute('aria-busy')).toBeNull()
})

test('without a target the add button says why it is unavailable', async () => {
	session.serve({ [MINE]: DRAFTS })
	await click('Open')
	await expectText('Choose a draft or create a new article.')
	expect(button('Add to article').disabled).toBe(true)
	await click('Create new article')
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Enter a title for the new article.')
})
