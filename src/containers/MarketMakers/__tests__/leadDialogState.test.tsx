// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ClaimDialog } from '../ClaimDialog'
import { ConnectDialog } from '../ConnectDialog'

vi.mock('../client', () => ({
	requestLeadClickId: vi.fn(async () => 'click-1'),
	useSubmitLead: () => ({
		mutate: vi.fn(),
		reset: vi.fn(),
		isPending: false,
		isSuccess: false,
		isError: false,
		error: null
	})
}))
vi.mock('../ClaimTurnstile', () => ({
	ClaimTurnstile: () => null,
	isClaimTurnstileEnabled: () => false
}))

describe('lead dialogs start from a fresh form on each open', () => {
	let container: HTMLDivElement
	let root: Root

	function render(element: ReactElement) {
		return act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
					{element}
				</QueryClientProvider>
			)
		})
	}

	function inputByLabel(label: string) {
		const field = Array.from(document.querySelectorAll('label')).find((el) => el.textContent?.includes(label))
		return field?.querySelector('input') ?? null
	}

	function type(el: HTMLInputElement, value: string) {
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		return act(async () => {
			setValue.call(el, value)
			el.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('the claim form does not keep what was typed before it was closed', async () => {
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		const fullName = inputByLabel('Your Full Name')!
		expect(fullName.value).toBe('')
		await type(fullName, 'Ada Lovelace')
		expect(inputByLabel('Your Full Name')!.value).toBe('Ada Lovelace')

		await render(<ClaimDialog open={false} onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		await render(<ClaimDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		expect(inputByLabel('Your Full Name')!.value).toBe('')
	})

	test('the connect form does not keep what was typed before it was closed', async () => {
		await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		const fullName = inputByLabel('Full Name')!
		await type(fullName, 'Ada Lovelace')
		expect(inputByLabel('Full Name')!.value).toBe('Ada Lovelace')

		await render(<ConnectDialog open={false} onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		await render(<ConnectDialog open onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		expect(inputByLabel('Full Name')!.value).toBe('')
	})

	test('a closed dialog renders no form at all', async () => {
		await render(<ClaimDialog open={false} onClose={vi.fn()} marketMakerId="mm-1" marketMakerName="Acme" />)
		expect(inputByLabel('Your Full Name')).toBeNull()
	})
})
