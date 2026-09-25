// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TVLRange } from '../TVLRange'

const router = vi.hoisted(() => ({
	pathname: '/yields',
	asPath: '/yields?page=3&chain=Ethereum',
	query: { page: '3', chain: 'Ethereum' },
	push: vi.fn((_url: { pathname: string; query: Record<string, unknown> }) => Promise.resolve(true))
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	router.push.mockReset()
})

test.each([
	[true, { chain: 'Ethereum', minTvl: '100', maxTvl: '200' }],
	[false, { page: '3', chain: 'Ethereum', minTvl: '100', maxTvl: '200' }]
])('with page reset %s, applying a range navigates to %j', async (resetPageOnChange, expectedQuery) => {
	await act(async () => root.render(<TVLRange resetPageOnChange={resetPageOnChange} />))
	await act(async () => container.querySelector('button')!.click())
	const min = document.querySelector<HTMLInputElement>('input[name="min"]')!
	const max = document.querySelector<HTMLInputElement>('input[name="max"]')!
	min.value = '100'
	max.value = '200'
	await act(async () => document.querySelector('form')!.requestSubmit())
	expect(router.push.mock.calls[0]![0].query).toStrictEqual(expectedQuery)
})
