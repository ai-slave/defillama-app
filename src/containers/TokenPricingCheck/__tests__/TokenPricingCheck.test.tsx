import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { alertTexts, fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TokenPricingCheck } from '../index'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/' }) }))

const http = installFixtureFetch()
let client: QueryClient
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<TokenPricingCheck chainDisplayNames={{}} />
			</QueryClientProvider>
		)
	)
}

const submit = () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!

test('waits for the chain list instead of asking for a chain the reader cannot pick yet', async () => {
	const chains = Promise.withResolvers<Response>()
	http.serve({ 'https://coins.llama.fi/chains': () => chains.promise })
	await render()

	expect(submit().textContent).toContain('Loading…')
	await act(async () => submit().click())
	expect(fieldErrorTexts(container)).toEqual([])
	expect(alertTexts(container)).toEqual([])

	await act(async () => chains.resolve(Response.json(['ethereum'])))
	await waitForUi(() => expect(submit().textContent).toBe('Check pricing'))
	await act(async () => submit().click())
	expect(fieldErrorTexts(container)).toEqual(['Choose a chain.', 'Enter a token address or ID.'])
})

test('keeps the submit off beside the chain list failure and its Try again', async () => {
	http.serve({ 'https://coins.llama.fi/chains': () => new Response(null, { status: 500 }) })
	await render()

	await waitForUi(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Try again'))
	expect(submit().disabled).toBe(true)
	await act(async () => submit().click())
	expect(fieldErrorTexts(container)).toEqual([])
	expect(alertTexts(container)).toEqual([expect.stringMatching(/^Couldn’t load the supported chains\./)])
})
