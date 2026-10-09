// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorOf, fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ClaimDialog } from '../ClaimDialog'
import { ConnectDialog } from '../ConnectDialog'

// The Cloudflare widget cannot run in Node; the form only needs it mounted, never verified.
vi.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => null }))
// The interest picker is a Select, which reads the router.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/market-makers' }) }))

const http = installFixtureFetch()

let container: HTMLDivElement
let root: Root
let client: QueryClient

function render(element: ReactElement) {
	return act(async () => {
		root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
	})
}

function inputByLabel(label: string) {
	const field = Array.from(document.querySelectorAll('label')).find((el) => el.textContent === label)
	return field ? document.querySelector<HTMLInputElement>(`[id="${field.htmlFor}"]`) : null
}

function buttonByText(text: string) {
	return Array.from(document.querySelectorAll('button')).find((el) => el.textContent === text) ?? null
}

function type(el: HTMLInputElement, value: string) {
	const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
	return act(async () => {
		setValue.call(el, value)
		el.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

function click(el: HTMLElement) {
	return act(async () => el.click())
}

beforeEach(() => {
	client = new QueryClient()
	vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', '')
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	vi.unstubAllEnvs()
})

describe('lead dialogs start from a fresh form on each open', () => {
	test('the claim form does not keep what was typed before it was closed', async () => {
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		const fullName = inputByLabel('Your full name')!
		expect(fullName.value).toBe('')
		await type(fullName, 'Ada Lovelace')
		expect(inputByLabel('Your full name')!.value).toBe('Ada Lovelace')

		await render(
			<ClaimDialog open={false} onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />
		)
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		expect(inputByLabel('Your full name')!.value).toBe('')
	})

	test('the connect form does not keep what was typed before it was closed', async () => {
		await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		const fullName = inputByLabel('Full name')!
		await type(fullName, 'Ada Lovelace')
		expect(inputByLabel('Full name')!.value).toBe('Ada Lovelace')

		await render(
			<ConnectDialog open={false} onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />
		)
		await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		expect(inputByLabel('Full name')!.value).toBe('')
	})
})

describe('connect form token steps', () => {
	test('each token step hands focus to the control that replaces the one used', async () => {
		await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await click(document.querySelector<HTMLInputElement>('input[type="radio"][value="listed"]')!)
		const search = document.querySelector<HTMLInputElement>('input[placeholder="Search your token by name or ticker"]')!
		await act(async () => search.focus())
		await type(search, 'zz')
		const manual = await waitForUi(() => {
			const item = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
				(el) => el.textContent === 'My token does not appear in this list'
			)
			expect(item).toBeDefined()
			return item!
		})
		await click(manual)
		expect(document.activeElement).toBe(inputByLabel('Project name'))
		const back = buttonByText('Back to token search')!
		await act(async () => {
			back.focus()
			back.click()
		})
		expect(document.activeElement).toBe(
			document.querySelector('input[placeholder="Search your token by name or ticker"]')
		)
	})
})

describe('claim form submission', () => {
	test('Submit waits for the security check to pass', async () => {
		vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', 'claim-site-key')
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await fillClaim()
		const submit = buttonByText('Submit claim request')!
		expect(submit.getAttribute('aria-disabled')).toBe('true')
		expect(document.getElementById(submit.getAttribute('aria-describedby')!)?.textContent).toBe(
			'Waiting for the security check above to finish.'
		)

		await click(submit)

		expect(http.urls().some((url) => url.includes('/lead/claim'))).toBe(false)
	})

	test('names the outcome in the header after a claim is sent, and Done closes the dialog', async () => {
		http.serve({ '/api/public/market-makers/lead/claim': { status: 'ok', request_id: 'req-1' } })
		const onClose = vi.fn()
		await render(<ClaimDialog open onClose={onClose} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await type(inputByLabel('Position at organization')!, 'CEO')
		await type(inputByLabel('Your full name')!, 'Ada Lovelace')
		await type(inputByLabel('Your LinkedIn or X profile')!, 'linkedin.com/in/ada')
		await type(inputByLabel('Your organization email address')!, 'ada@acme.com')
		for (const checkbox of document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')) {
			await click(checkbox)
		}

		await click(buttonByText('Submit claim request')!)

		await waitForUi(() =>
			expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Claim request received')
		)
		await click(buttonByText('Done')!)
		expect(onClose).toHaveBeenCalledOnce()
	})

	test('stays open while the claim is sending, so the reader sees whether it went through', async () => {
		let answer!: () => void
		http.serve({
			'/api/public/market-makers/lead/claim': () =>
				new Promise((resolve) => {
					answer = () => resolve({ status: 'ok', request_id: 'req-1' })
				})
		})
		const onClose = vi.fn()
		await render(<ClaimDialog open onClose={onClose} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await type(inputByLabel('Position at organization')!, 'CEO')
		await type(inputByLabel('Your full name')!, 'Ada Lovelace')
		await type(inputByLabel('Your LinkedIn or X profile')!, 'linkedin.com/in/ada')
		await type(inputByLabel('Your organization email address')!, 'ada@acme.com')
		for (const checkbox of document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')) {
			await click(checkbox)
		}

		await click(buttonByText('Submit claim request')!)
		await waitForUi(() => expect(http.urls().some((url) => url.includes('/lead/claim'))).toBe(true))
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
		await act(async () => {
			dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		})
		await click(buttonByText('Cancel')!)
		await click(dialog.querySelector<HTMLElement>('[aria-label="Close dialog"]')!)
		expect(onClose).not.toHaveBeenCalled()
		expect(buttonByText('Cancel')!.getAttribute('aria-disabled')).toBe('true')

		await act(async () => answer())
		await waitForUi(() =>
			expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Claim request received')
		)
	})
})

async function fillClaim() {
	await type(inputByLabel('Position at organization')!, 'CEO')
	await type(inputByLabel('Your full name')!, 'Ada Lovelace')
	await type(inputByLabel('Your LinkedIn or X profile')!, 'linkedin.com/in/ada')
	await type(inputByLabel('Your organization email address')!, 'ada@acme.com')
	for (const checkbox of document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')) {
		await click(checkbox)
	}
}

describe('lead forms keep what was typed', () => {
	test('Escape on a filled claim form asks before discarding it', async () => {
		const onClose = vi.fn()
		await render(<ClaimDialog open onClose={onClose} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await type(inputByLabel('Your full name')!, 'Ada Lovelace')
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
		await act(async () => {
			dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		})

		await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Keep editing'))
		expect(onClose).not.toHaveBeenCalled()
	})

	test('Escape on a filled connect form asks before discarding it', async () => {
		const onClose = vi.fn()
		await render(<ConnectDialog open onClose={onClose} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await type(inputByLabel('Full name')!, 'Ada Lovelace')
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
		await act(async () => {
			dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		})

		await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Keep editing'))
		expect(onClose).not.toHaveBeenCalled()
	})

	test('an incomplete claim says what is missing under each field and focuses the first', async () => {
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await type(inputByLabel('Position at organization')!, 'CEO')
		await type(inputByLabel('Your organization email address')!, 'ada@acme')
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
		expect(fieldErrorTexts(dialog)).toEqual([])

		await click(buttonByText('Submit claim request')!)

		expect(fieldErrorTexts(dialog)).toEqual([
			'Enter your full name.',
			'Enter your LinkedIn or X profile URL.',
			'Enter a valid email address.',
			'Agree to both statements to submit the claim.'
		])
		expect(document.activeElement).toBe(inputByLabel('Your full name'))
		await type(inputByLabel('Your full name')!, 'Ada Lovelace')
		expect(fieldErrorTexts(dialog)).not.toContain('Enter your full name.')
		expect(http.urls().some((url) => url.includes('/lead/claim'))).toBe(false)
	})

	test('an unticked consent takes focus when it is the only thing missing', async () => {
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await fillClaim()
		const [alignment] = document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')
		await click(alignment)

		await click(buttonByText('Submit claim request')!)

		expect(document.activeElement).toBe(alignment)
		expect(fieldErrorOf(alignment)).toBe('Agree to both statements to submit the claim.')
	})

	test('a failed claim keeps its error on screen while the retry runs', async () => {
		let attempt = 0
		let answer!: () => void
		http.serve({
			'/api/public/market-makers/lead/claim': () =>
				++attempt === 1
					? Response.json({ error: 'Lead service unavailable' }, { status: 503 })
					: new Promise((resolve) => {
							answer = () => resolve({ status: 'ok', request_id: 'req-1' })
						})
		})
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await fillClaim()
		await click(buttonByText('Submit claim request')!)
		const alert = () => document.querySelector('[role="dialog"] [role="alert"]')?.textContent
		await waitForUi(() => expect(alert()).toBe('Lead service unavailable'))

		await click(buttonByText('Submit claim request')!)
		await waitForUi(() => expect(attempt).toBe(2))
		expect(alert()).toBe('Lead service unavailable')

		await act(async () => answer())
		await waitForUi(() =>
			expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Claim request received')
		)
	})
})

test('an empty connect request says what is missing and focuses the interest picker', async () => {
	await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
	await click(buttonByText('Submit request')!)

	expect(fieldErrorTexts(document.querySelector('[role="dialog"]')!)).toEqual([
		'Choose what you are interested in.',
		'Enter the project name.',
		'Enter the token ticker.',
		'Enter your full name.',
		'Enter an email address.'
	])
	expect(accessibleName(document.activeElement!)).toBe('What are you interested in?')
	expect(fieldErrorOf(document.activeElement!)).toBe('Choose what you are interested in.')
	expect(http.urls().some((url) => url.includes('/lead/connect'))).toBe(false)
})

test('a token status picked after a failed submit opens its token field without an error', async () => {
	await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
	const errorTexts = () => fieldErrorTexts(document.querySelector('[role="dialog"]')!)
	await click(buttonByText('Submit request')!)
	expect(errorTexts()).toContain('Enter the project name.')

	const listed = [...document.querySelectorAll('label')].find((el) => el.textContent === 'Listed')!
	await click(listed.querySelector('input')!)
	expect(errorTexts()).toEqual([])
	await click(buttonByText('Submit request')!)
	expect(errorTexts()).toContain('Choose your token, or “My token does not appear in this list”.')
})

describe('lead dialogs open on their first field', () => {
	test('the claim form focuses the position field', async () => {
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await waitForUi(() => expect(document.activeElement).toBe(inputByLabel('Position at organization')))
	})

	test('the connect form focuses the interest picker', async () => {
		await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)
		await waitForUi(() => expect(accessibleName(document.activeElement!)).toBe('What are you interested in?'))
	})
})
