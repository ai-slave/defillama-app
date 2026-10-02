// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ClaimDialog } from '../ClaimDialog'
import { ConnectDialog } from '../ConnectDialog'

// The Cloudflare widget cannot run in Node; the form only needs it mounted, never verified.
vi.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => null }))

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
	const field = Array.from(document.querySelectorAll('label')).find((el) => el.textContent?.includes(label))
	return field?.querySelector('input') ?? null
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
	test('asks for the verification check when Submit is pressed before it passes', async () => {
		vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', 'claim-site-key')
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" clickId={null} />)

		await click(buttonByText('Submit claim request')!)

		expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
			'Complete the verification check to submit'
		)
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
