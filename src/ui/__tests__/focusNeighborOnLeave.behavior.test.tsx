// @vitest-environment happy-dom

import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { focusNeighborOnLeave } from '../focus'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(() => {
	act(() => root.unmount())
	container.remove()
})

let removeLater: (name: string) => void = () => {}

function List({
	initial,
	hideBelowTwo = false,
	keepOne = false,
	withFallback = true
}: {
	initial: Array<string>
	hideBelowTwo?: boolean
	keepOne?: boolean
	withFallback?: boolean
}) {
	const [names, setNames] = useState(initial)
	const [renders, setRenders] = useState(0)
	const searchRef = useRef<HTMLInputElement>(null)
	removeLater = (name) => setNames((current) => current.filter((item) => item !== name))
	const shown = hideBelowTwo && names.length < 2 ? [] : names
	return (
		<>
			<input ref={searchRef} aria-label="Search" />
			<button type="button" onClick={() => setRenders(renders + 1)}>
				Re-render {renders}
			</button>
			<ul>
				{shown.map((name) => (
					<li key={name} data-row>
						<a href={`#${name}`}>{name}</a>
						<button
							type="button"
							aria-disabled={keepOne && names.length === 1 ? true : undefined}
							ref={focusNeighborOnLeave(withFallback ? () => searchRef.current : undefined)}
							onClick={() => setNames(names.filter((item) => item !== name))}
						>
							Remove {name}
						</button>
					</li>
				))}
			</ul>
		</>
	)
}

const button = (label: string) =>
	[...document.querySelectorAll('button')].find((element) => element.textContent?.startsWith(label))!

async function click(element: HTMLElement) {
	element.focus()
	await act(async () => {
		element.click()
		await Promise.resolve()
	})
}

test("removing a row hands focus to the next row's remove", async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta', 'Gamma']} />))
	await click(button('Remove Alpha'))
	expect(document.activeElement).toBe(button('Remove Beta'))
})

test("removing the last row hands focus to the previous row's remove", async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} />))
	await click(button('Remove Beta'))
	expect(document.activeElement).toBe(button('Remove Alpha'))
})

test('removing the only row hands focus to the fallback', async () => {
	act(() => root.render(<List initial={['Alpha']} />))
	await click(button('Remove Alpha'))
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Search')
})

test('a neighbor that leaves in the same commit gives way to the fallback', async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} hideBelowTwo />))
	await click(button('Remove Alpha'))
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Search')
})

test('a neighbor that disables in the same commit gives way to the fallback', async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} keepOne />))
	await click(button('Remove Alpha'))
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Search')
})

test('without a fallback, a disabled neighbor that stays focusable still takes focus', async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} keepOne withFallback={false} />))
	await click(button('Remove Alpha'))
	expect(document.activeElement).toBe(button('Remove Beta'))
})

test('a row that data drops later hands focus on the same way', async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} />))
	button('Remove Alpha').focus()
	await act(async () => {
		removeLater('Alpha')
		await Promise.resolve()
	})
	expect(document.activeElement).toBe(button('Remove Beta'))
})

test('a re-render that keeps the row leaves focus where it is', async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} />))
	button('Remove Alpha').focus()
	await act(async () => {
		removeLater('Gamma')
		await Promise.resolve()
	})
	expect(document.activeElement).toBe(button('Remove Alpha'))
})

test('removing a row another control was focused in moves nothing', async () => {
	act(() => root.render(<List initial={['Alpha', 'Beta']} />))
	button('Re-render').focus()
	await act(async () => {
		removeLater('Alpha')
		await Promise.resolve()
	})
	expect(document.activeElement).toBe(button('Re-render'))
})
