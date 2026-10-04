// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { NewPortfolioDialog } from '../NewPortfolioDialog'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a refused name moves focus to the field that reads its error', async () => {
	const onCreate = vi.fn()
	await act(async () =>
		root.render(<NewPortfolioDialog open setOpen={vi.fn()} portfolios={['main']} onCreate={onCreate} />)
	)
	const input = await waitForUi(() => document.querySelector<HTMLInputElement>('input[name="name"]')!)
	const create = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Create')!
	await act(async () => {
		create.focus()
		create.click()
	})

	expect(document.activeElement).toBe(input)
	expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Enter a name.')
	expect(onCreate).not.toHaveBeenCalled()
})
