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

test('a min above the max, typed or picked, says so under the max instead of applying', async () => {
	await act(async () => root.render(<TVLRange minPresets={[1000]} />))
	await act(async () => container.querySelector('button')!.click())
	const max = document.querySelector<HTMLInputElement>('input[name="max"]')!
	const type = (input: HTMLInputElement, value: string) =>
		act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
	const maxError = () => document.getElementById(max.getAttribute('aria-describedby') ?? '')?.textContent
	await type(max, '200')
	const pick = [...document.querySelectorAll('button')].find((button) => button.textContent === '$1k')!
	await act(async () => pick.click())
	expect(router.push).not.toHaveBeenCalled()
	expect(maxError()).toBe('Enter a max no lower than the min.')
	expect(document.activeElement).toBe(max)

	await type(max, '5000')
	expect(maxError()).toBeUndefined()
	await act(async () => document.querySelector('form')!.requestSubmit())
	expect(router.push.mock.calls[0]![0].query).toMatchObject({ minTvl: '1000', maxTvl: '5000' })
})
