// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { ClaimTokenProfile } from '../ClaimTokenProfile'

vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {} }) }))

test('keeps blank draft rows distinct through edits and deletion', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	try {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<ClaimTokenProfile projects={[]} exchangeOptions={[]} marketMakerOptions={[]} />
				</QueryClientProvider>
			)
		)
		const add = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Add more'))!
		await act(async () => add.click())
		await act(async () => add.click())
		const table = container.querySelector('table')!
		const surviving = table.querySelectorAll('tbody tr')[1]
		const input = surviving.querySelector<HTMLInputElement>('input')!
		input.focus()
		await act(async () => table.querySelector<HTMLButtonElement>('tbody button')!.click())
		expect(table.querySelector('tbody tr')).toBe(surviving)
		expect(document.activeElement).toBe(input)
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Example')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(table.querySelectorAll('tbody tr')).toHaveLength(1)
		expect(table.querySelector('tbody tr')).toBe(surviving)
		expect(input.value).toBe('Example')
		expect(document.activeElement).toBe(input)
	} finally {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	}
})
