// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { buildUtrClaimRequest } from '../claimRequest'
import { ClaimTokenProfile } from '../ClaimTokenProfile'

vi.mock('../claimRequest', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../claimRequest')>()
	return { ...actual, buildUtrClaimRequest: vi.fn(actual.buildUtrClaimRequest) }
})

test('keeps blank draft rows distinct through edits and deletion without sending their IDs', async () => {
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
		const add = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Add More'))!
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
		expect(table.querySelector('tbody tr')).toBe(surviving)
		const submittedRows = Object.values(vi.mocked(buildUtrClaimRequest).mock.lastCall![0].rows).flat()
		expect(submittedRows).toHaveLength(1)
		expect(Object.values(submittedRows[0])).toContain('Example')
		expect(submittedRows[0]).not.toHaveProperty('id')
		expect(submittedRows[0]).not.toHaveProperty('values')
	} finally {
		await act(async () => root.unmount())
		container.remove()
		client.clear()
	}
})
