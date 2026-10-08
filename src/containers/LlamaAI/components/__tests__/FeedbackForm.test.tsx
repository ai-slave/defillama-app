// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))
// The toast library is the app's notification boundary; its calls are what a user would see.
vi.mock('react-hot-toast', () => ({ toast: { success: toastSuccess, error: toastError } }))

import { ResponseControls } from '../ResponseControls'

const session = installSubscriberSession('reader', { resolved: true })
const RATE = 'https://ai.llama.fi/user/messages/m1/rate'
let root: Root
let container: HTMLDivElement

beforeEach(async () => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ResponseControls messageId="m1" />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	document.body.innerHTML = ''
})

function button(name: string) {
	const found = [...document.querySelectorAll('button')].find((el) => accessibleName(el) === name)
	expect(found, `button ${name}`).not.toBeUndefined()
	return found!
}
const dialog = () => document.querySelector('[role="dialog"]')
async function click(name: string) {
	await act(async () => button(name).click())
}
async function type(text: string) {
	const field = document.querySelector('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, text)
		field.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('a failed submission stays in the dialog with its text, also while its retry runs, and the retry closes it and thanks the reader', async () => {
	const retry = Promise.withResolvers<Response>()
	session.serveInOrder(RATE, [fixtureStatus(500, { message: 'boom' }), () => retry.promise])
	await click('Thumbs up')
	await type('The TVL is stale')
	await click('Submit')
	await act(async () => {
		await waitForUi(() =>
			expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't send your feedback. Try again.")
		)
	})
	expect(dialog()).not.toBeNull()
	expect(document.querySelector('textarea')?.value).toBe('The TVL is stale')
	expect(toastError).not.toHaveBeenCalled()
	await click('Submit')
	await act(async () => {
		await waitForUi(() => expect(button('Submitting…')).toBeDefined())
	})
	expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't send your feedback. Try again.")
	await act(async () => retry.resolve(Response.json({ ok: true })))
	await act(async () => {
		await waitForUi(() => expect(toastSuccess).toHaveBeenCalledWith('Thank you for your feedback!'))
	})
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(
		session.requests.filter((request) => request.url.href === RATE).map((r) => JSON.parse(`${r.init!.body}`))
	).toEqual([
		{ rating: 'good', feedback: 'The TVL is stale' },
		{ rating: 'good', feedback: 'The TVL is stale' }
	])
})

test('after rating, focus returns to the thumb, which shows the rating and refuses a second one', async () => {
	session.serveInOrder(RATE, [{ ok: true }])
	const thumb = button('Thumbs up')
	await act(async () => thumb.focus())
	await click('Thumbs up')
	await click('Submit')
	await act(async () => {
		await waitForUi(() => expect(toastSuccess).toHaveBeenCalledWith('Thank you for your feedback!'))
		await waitForUi(() => expect(document.activeElement).toBe(thumb))
	})
	expect(thumb.getAttribute('aria-pressed')).toBe('true')
	expect(thumb.getAttribute('aria-disabled')).toBe('true')
	await click('Thumbs up')
	expect(dialog()).toBeNull()
})

test('closing with typed feedback asks first, and keeping it returns to the text', async () => {
	await click('Thumbs down')
	await type('Wrong chain')
	await click('Cancel')
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard your feedback?')
	await click('Keep editing')
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	expect(document.querySelector('textarea')?.value).toBe('Wrong chain')
	await click('Cancel')
	await click('Discard')
	await act(async () => {
		await waitForUi(() => expect(dialog()).toBeNull())
	})
})

test('a running submission names itself and cannot be cancelled', async () => {
	const response = Promise.withResolvers<Response>()
	session.serveInOrder(RATE, [() => response.promise])
	await click('Thumbs down')
	await click('Submit')
	await act(async () => {
		await waitForUi(() => expect(button('Submitting…').getAttribute('aria-busy')).toBe('true'))
	})
	expect(button('Cancel').getAttribute('aria-disabled')).toBe('true')
	await act(async () => {
		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	})
	expect(dialog()).not.toBeNull()
	await act(async () => response.resolve(Response.json({ ok: true })))
	await act(async () => {
		await waitForUi(() => expect(toastSuccess).toHaveBeenCalledWith('Thank you for your feedback!'))
	})
})

test('general feedback says a rating is needed until one is chosen', async () => {
	await click('Provide feedback')
	expect(dialog()?.textContent).toContain('Choose Good or Bad to submit.')
	expect(button('Submit').disabled).toBe(true)
	await click('Good')
	expect(button('Good').getAttribute('aria-pressed')).toBe('true')
	expect(dialog()?.textContent).not.toContain('Choose Good or Bad to submit.')
	expect(button('Submit').disabled).toBe(false)
})
