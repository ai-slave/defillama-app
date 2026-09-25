// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Tabs } from '~/ui/Tabs'
import { ProSegmented } from './ProSegmented'

let root: Root
let container: HTMLDivElement

const OPTIONS = [
	{ value: 'output' as const, label: 'Chart' },
	{ value: 'query' as const, label: 'SQL' }
]

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

test('tabs semantics select the tab for the current value', async () => {
	const render = (value: 'output' | 'query') =>
		act(async () =>
			root.render(
				<Tabs value={value} onValueChange={vi.fn()} values={['output', 'query']}>
					<ProSegmented semantics="tabs" options={OPTIONS} label="SQL card view" />
				</Tabs>
			)
		)
	const selectedTab = () => container.querySelector('[role="tab"][aria-selected="true"]')!.textContent
	await render('output')
	expect(selectedTab()).toBe('Chart')
	await render('query')
	expect(selectedTab()).toBe('SQL')
})

test('radio semantics keep the selected input checked', async () => {
	await act(async () =>
		root.render(<ProSegmented value="query" onValueChange={vi.fn()} options={OPTIONS} label="SQL card view" />)
	)
	const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	expect(radios.map((radio) => radio.checked)).toEqual([false, true])
	expect(container.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('SQL card view')
})
