// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, onTestFinished, test } from 'vitest'
import { ListRow } from '../ListRow'

async function render(node: React.ReactNode) {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	onTestFinished(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	await act(async () => root.render(node))
	return container
}

test('a multi-pick row leads with its box and a single-pick row trails with its check', async () => {
	const container = await render(
		<>
			<ListRow check="box" checked>
				<span>Aave</span>
			</ListRow>
			<ListRow check="tick" checked={false}>
				<span>Lido</span>
			</ListRow>
		</>
	)
	const [multi, single] = [...container.querySelectorAll('button')]
	expect(multi.firstElementChild?.getAttribute('data-checked')).toBe('true')
	expect(multi.lastElementChild?.textContent).toBe('Aave')
	// The empty check keeps its slot, so the label never shifts when it is picked.
	expect(single.lastElementChild?.tagName.toLowerCase()).toBe('svg')
	expect(single.lastElementChild?.getAttribute('data-checked')).toBe('false')
})

test('a check follows `selected` unless `checked` says otherwise', async () => {
	const container = await render(
		<>
			<ListRow selected check="tick">
				<span>Aave</span>
			</ListRow>
			<ListRow selected check="tick" checked={false}>
				<span>Lido</span>
			</ListRow>
		</>
	)
	const [followed, overridden] = [...container.querySelectorAll('button')]
	expect(followed.lastElementChild?.getAttribute('data-checked')).toBe('true')
	expect(overridden.lastElementChild?.getAttribute('data-checked')).toBe('false')
})
