// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useImperativeHandle, useState, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { InviteBanner } from '../InviteBanner'

vi.mock('@marsidev/react-turnstile', () => ({
	Turnstile: ({
		onSuccess,
		onExpire,
		onError,
		options,
		ref
	}: {
		onSuccess: (token: string) => void
		onExpire: () => void
		onError: () => void
		options: { action: string }
		ref: Ref<{ reset: () => void }>
	}) => {
		const [verified, setVerified] = useState(false)
		useImperativeHandle(ref, () => ({ reset: () => setVerified(false) }))
		return (
			<div>
				<span role="status">{verified ? 'Verification complete' : 'Verification required'}</span>
				<button type="button" onClick={onError}>
					Fail verification
				</button>
				<button
					type="button"
					onClick={() => {
						setVerified(true)
						onSuccess('verified-token')
					}}
				>
					Verify {options.action}
				</button>
				<button type="button" onClick={onExpire}>
					Expire verification
				</button>
			</div>
		)
	}
}))

let root: Root
let container: HTMLDivElement
let client: QueryClient
let available: boolean
let claimResponse: { status: string; code?: string; refreshAt?: string; retryAt?: string }
let claimStatus: number
let requests: Array<{ visitorId: string; turnstileToken: string; refresh: boolean }>

beforeEach(() => {
	localStorage.clear()
	available = true
	claimStatus = 200
	claimResponse = { status: 'assigned', code: 'ABCD1234', refreshAt: new Date(Date.now() + 3_600_000).toISOString() }
	requests = []
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, options?: RequestInit) => {
			if (url.endsWith('/invites/qfex/claim')) {
				requests.push(JSON.parse(options?.body as string))
				return Response.json(claimResponse, { status: claimStatus })
			}
			if (url.endsWith('/invites/qfex')) return Response.json({ available })
			throw new Error(`Unexpected request: ${url}`)
		})
	)
	client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	localStorage.clear()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

function button(text: string) {
	const element = Array.from(document.querySelectorAll('button')).find((element) => element.textContent === text)
	expect(element, `Button ${text}`).not.toBeUndefined()
	return element!
}

async function click(text: string) {
	await act(async () => button(text).click())
}

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<InviteBanner protocol="qfex" name="QFEX" website="https://www.qfex.com/" />
			</QueryClientProvider>
		)
	)
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

async function openAndVerify() {
	await click(localStorage.getItem('protocol-invite:qfex') ? 'View your code' : 'Get invite code')
	await click('Verify qfex_invite')
}

async function waitForText(text: string) {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
	expect(document.body.textContent).toContain(text)
}

test('requires verification and an explicit reveal, then shows the code and destination', async () => {
	await render()
	await click('Get invite code')
	expect(button('Reveal my code').disabled).toBe(true)
	await click('Verify qfex_invite')
	expect(button('Reveal my code').disabled).toBe(false)
	expect(requests).toEqual([])
	await click('Reveal my code')
	await waitForText('ABCD1234')
	expect(requests).toEqual([
		{ visitorId: localStorage.getItem('protocol-invite:qfex'), turnstileToken: 'verified-token', refresh: false }
	])
	expect(document.querySelector('a')?.href).toBe('https://www.qfex.com/')
	expect(document.body.textContent).toContain('Try again in 60 min.')
	await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Copy invite code"]')!.click())
	expect(await navigator.clipboard.readText()).toBe('ABCD1234')
})

test('offers an in-place retry when verification fails to load', async () => {
	await render()
	await click('Get invite code')
	await click('Fail verification')
	expect(document.querySelector('[role="alert"]')?.textContent).toBe('Verification could not load.')
	expect(Array.from(document.querySelectorAll('button')).some((b) => b.textContent === 'Reveal my code')).toBe(false)
	await click('Try again')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(button('Reveal my code').disabled).toBe(true)
	await click('Verify qfex_invite')
	expect(button('Reveal my code').disabled).toBe(false)
})

test('hides exhausted inventory for new visitors but lets a returning visitor retrieve the same assignment', async () => {
	available = false
	await render()
	expect(container.textContent).toBe('')
	localStorage.setItem('protocol-invite:qfex', '11111111-1111-4111-8111-111111111111')
	await act(async () => root.unmount())
	root = createRoot(container)
	await render()
	await openAndVerify()
	await click('Reveal my code')
	await waitForText('ABCD1234')
	expect(requests[0]).toEqual({
		visitorId: '11111111-1111-4111-8111-111111111111',
		turnstileToken: 'verified-token',
		refresh: false
	})
})

test('allows an explicit refresh after the cooldown with a fresh verification', async () => {
	claimResponse = { status: 'assigned', code: 'ABCD1234', refreshAt: new Date(Date.now() - 1000).toISOString() }
	await render()
	await openAndVerify()
	await click('Reveal my code')
	await waitForText('ABCD1234')
	expect(button('Try another code').disabled).toBe(true)
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Verification required')
	await click('Verify qfex_invite')
	claimResponse = { status: 'assigned', code: 'WXYZ5678', refreshAt: new Date(Date.now() + 3_600_000).toISOString() }
	await click('Try another code')
	await waitForText('WXYZ5678')
	expect(requests.map((request) => request.refresh)).toEqual([false, true])
	expect(requests[0]?.visitorId).toBe(requests[1]?.visitorId)
})

test('reports an exhausted pool in the open dialog and disables expired verification', async () => {
	claimResponse = { status: 'unavailable' }
	await render()
	await openAndVerify()
	await click('Expire verification')
	expect(button('Reveal my code').disabled).toBe(true)
	await click('Verify qfex_invite')
	await click('Reveal my code')
	await waitForText('No invite codes available')
	expect(document.body.textContent).not.toContain('Verify qfex_invite')
	expect(document.body.textContent).not.toContain('Reveal my code')
})

test('preserves the visitor identity after a lost response so a retry retrieves the original allocation', async () => {
	await render()
	await openAndVerify()
	vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
	await click('Reveal my code')
	await waitForText('Could not retrieve an invite code. Check your connection and try again.')
	const visitorId = localStorage.getItem('protocol-invite:qfex')
	expect(button('Try again').disabled).toBe(true)
	await click('Verify qfex_invite')
	await click('Try again')
	await waitForText('ABCD1234')
	expect(requests).toEqual([{ visitorId, turnstileToken: 'verified-token', refresh: false }])
})

test('handles a non-JSON service outage and permits retrying after verification', async () => {
	await render()
	await openAndVerify()
	vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>Unavailable</html>', { status: 502 }))
	await click('Reveal my code')
	await waitForText('Invite codes are temporarily unavailable. Please try again later.')
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Verification required')
	expect(button('Try again').disabled).toBe(true)
	await click('Verify qfex_invite')
	await click('Try again')
	await waitForText('ABCD1234')
	expect(document.querySelector('output')?.textContent).toBe('ABCD1234')
})

test('blocks new claims during the network cooldown and restores claiming when it ends', async () => {
	claimStatus = 429
	claimResponse = { status: 'cooldown', retryAt: new Date(Date.now() + 3_600_000).toISOString() }
	await render()
	await openAndVerify()
	await click('Reveal my code')
	await waitForText('Try again in 60 min')
	expect(document.body.textContent).not.toContain('Verify qfex_invite')
	expect(document.body.textContent).not.toContain('Reveal my code')
	const later = Date.now() + 3_600_001
	vi.spyOn(Date, 'now').mockReturnValue(later)
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 1100))
	})
	expect(button('Reveal my code').disabled).toBe(true)
	await click('Verify qfex_invite')
	claimStatus = 200
	claimResponse = { status: 'assigned', code: 'NEXT1234', refreshAt: new Date(later + 3_600_000).toISOString() }
	await click('Reveal my code')
	await waitForText('NEXT1234')
})

test('keeps verification checked until a pending claim reveals the code', async () => {
	await render()
	await openAndVerify()
	let finish!: (response: Response) => void
	vi.mocked(fetch).mockImplementationOnce(
		() =>
			new Promise<Response>((resolve) => {
				finish = resolve
			})
	)
	await click('Reveal my code')
	expect(button('Getting your code…').disabled).toBe(true)
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Verification complete')
	await act(async () => finish(Response.json(claimResponse)))
	await waitForText('ABCD1234')
	expect(document.querySelector('output')?.textContent).toBe('ABCD1234')
})
