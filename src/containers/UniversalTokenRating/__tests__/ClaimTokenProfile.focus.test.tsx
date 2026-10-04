// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ClaimTokenProfile } from '../ClaimTokenProfile'
import type { UtrClaimProjectOption } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {} }) }))

const http = installFixtureFetch()
const project: UtrClaimProjectOption = {
	arcticId: 'a',
	projectName: 'Aave',
	symbol: 'AAVE',
	coingeckoId: null,
	tgeStatus: 'post',
	disclosureScore: null,
	gradedCount: 0,
	criteriaCount: 13
}
const receipt = (fileName: string) => ({
	key: `key-${fileName}`,
	fileName,
	mimeType: 'application/pdf',
	sizeBytes: 1,
	signature: 'signed'
})

let container: HTMLDivElement
let root: Root
let client: QueryClient
beforeEach(async () => {
	vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', '')
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ClaimTokenProfile projects={[project]} exchangeOptions={[]} marketMakerOptions={[]} />
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	vi.unstubAllEnvs()
})

function button(name: string) {
	const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)
	if (!found) throw new Error(`Missing button: ${name}`)
	return found
}
/** Clicks as a user does: the control takes focus first. */
async function press(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
/** The field a visible label names, as a reader finds it. */
function field(label: string) {
	const found = [...container.querySelectorAll('label')].find((el) => accessibleName(el) === label)
	if (!found) throw new Error(`Missing label: ${label}`)
	return document.getElementById(found.htmlFor) as HTMLInputElement
}
async function type(label: string, value: string) {
	const input = field(label)
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function attach(input: HTMLInputElement, names: Array<string>) {
	Object.defineProperty(input, 'files', {
		configurable: true,
		value: names.map((name) => new File(['x'], name, { type: 'application/pdf' }))
	})
	await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
const attachInput = () => container.querySelector<HTMLInputElement>('#attach-alignment')!

test('deleting a disclosure row hands focus to the next row, and the last one to Add more', async () => {
	const addMore = [...container.querySelectorAll<HTMLButtonElement>('button')].find((el) =>
		el.textContent?.includes('Add more')
	)!
	await press(addMore)
	await press(addMore)
	const table = container.querySelector('table')!
	const deleteButtons = () => table.querySelectorAll<HTMLButtonElement>('tbody button')
	await press(deleteButtons()[0])
	expect(document.activeElement).toBe(deleteButtons()[0])
	await press(deleteButtons()[0])
	expect(document.activeElement).toBe(addMore)
})

test('removing an attached file hands focus to the next file, and the last one to the attach control', async () => {
	http.serve({ '/api/public/utr/claim/documents': [receipt('a.pdf'), receipt('b.pdf')] })
	await attach(attachInput(), ['a.pdf', 'b.pdf'])
	await waitForUi(() => expect(button('Remove a.pdf')).toBeTruthy())
	await press(button('Remove a.pdf'))
	expect(document.activeElement).toBe(button('Remove b.pdf'))
	await press(button('Remove b.pdf'))
	expect(document.activeElement).toBe(attachInput())
})

test('the attach control keeps focus while the upload it started runs', async () => {
	const answer = Promise.withResolvers<Response>()
	http.serve({ '/api/public/utr/claim/documents': () => answer.promise })
	await act(async () => attachInput().focus())
	await attach(attachInput(), ['a.pdf'])
	expect(container.textContent).toContain('Uploading…')
	expect(attachInput().disabled).toBe(false)
	expect(attachInput().getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(attachInput())
	await act(async () => answer.resolve(Response.json([receipt('a.pdf')])))
	await waitForUi(() => expect(button('Remove a.pdf')).toBeTruthy())
})

test('dismissing an upload error hands focus to the attach control', async () => {
	await attach(attachInput(), ['notes.exe'])
	await press(button('Dismiss'))
	expect(container.textContent).not.toContain('supported formats')
	expect(document.activeElement).toBe(attachInput())
})

async function fillRequiredFields() {
	await type('First name', 'Ada')
	await type('Last name', 'Lovelace')
	await type('Position at organization', 'CEO')
	await type('Your email address', 'ada@example.com')
	for (const checkbox of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
		await act(async () => checkbox.click())
	}
}

test('a missing required field is marked invalid and reads its error', async () => {
	await press(button('Submit Disclosure Details'))
	const firstName = field('First name')
	expect(firstName.getAttribute('aria-required')).toBe('true')
	expect(firstName.getAttribute('aria-invalid')).toBe('true')
	expect(document.getElementById(firstName.getAttribute('aria-describedby')!)?.textContent).toBe(
		'First name is required'
	)
	await type('First name', 'Ada')
	expect(firstName.hasAttribute('aria-invalid')).toBe(false)
	expect(firstName.hasAttribute('aria-describedby')).toBe(false)
})

test('a failed submit stays on screen while its retry runs', async () => {
	const retry = Promise.withResolvers<Response>()
	const answers = [Promise.resolve(Response.json({ error: 'Forgd is unavailable' }, { status: 503 })), retry.promise]
	http.serve({ '/api/public/utr/claim': () => answers.shift()! })
	await fillRequiredFields()
	const submit = button('Submit Disclosure Details')
	await press(submit)
	await waitForUi(() => expect(container.textContent).toContain('Forgd is unavailable'))
	await press(submit)
	await waitForUi(() => expect(submit.getAttribute('aria-busy')).toBe('true'))
	expect(container.textContent).toContain('Forgd is unavailable')
	await act(async () => retry.resolve(Response.json({ id: 'claim-1' })))
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Request received'))
})

test('Submit keeps focus while the request runs, and the confirmation takes it once the request succeeds', async () => {
	const answer = Promise.withResolvers<Response>()
	http.serve({ '/api/public/utr/claim': () => answer.promise })
	await fillRequiredFields()
	const submit = button('Submit Disclosure Details')
	await press(submit)
	await waitForUi(() => expect(submit.getAttribute('aria-busy')).toBe('true'))
	expect(submit.disabled).toBe(false)
	expect(document.activeElement).toBe(submit)
	await act(async () => answer.resolve(Response.json({ id: 'claim-1' })))
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Request received'))
})
