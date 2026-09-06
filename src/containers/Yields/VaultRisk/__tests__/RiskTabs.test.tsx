// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RiskTabs, type RiskTab } from '../components/RiskTabs'

const renders = vi.fn()
function ScenarioDraft() {
	renders()
	const [drop, setDrop] = useState(10)
	return (
		<button type="button" onClick={() => setDrop(drop + 10)}>
			Drop {drop}%
		</button>
	)
}
const tabs: Array<RiskTab> = [
	{ id: 'vault-risk-collateral', icon: 'layers', label: 'Collateral', content: <p>Collateral details</p> },
	{ id: 'vault-risk-scenarios', icon: 'layers', label: 'Scenarios', content: <ScenarioDraft /> },
	{ id: 'vault-risk-trust', icon: 'users', label: 'Trust', content: <p>Trust details</p> }
]
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	window.history.replaceState(null, '', '/')
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: true }))
	)
	vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
	renders.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
function view() {
	return <RiskTabs tabs={tabs} defaultId="vault-risk-collateral" />
}
function tab(label: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((el) => el.textContent === label)!
}
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
test('SSR includes inactive content and public anchors with the correct visibility', () => {
	container.innerHTML = renderToStaticMarkup(view())
	expect(container.querySelector('#vault-risk-collateral')!.hasAttribute('hidden')).toBe(false)
	for (const id of ['vault-risk-scenarios', 'vault-risk-trust']) {
		const panel = container.querySelector(`#${id}`)!
		expect(panel.hasAttribute('hidden')).toBe(true)
		expect(panel.textContent).not.toBe('')
		expect(container.querySelector(`[id="${panel.getAttribute('aria-labelledby')}"]`)).not.toBeNull()
	}
})
test('hash navigation preserves scenario state without rerendering inactive content', async () => {
	window.history.replaceState(null, '', '/#vault-risk-scenarios')
	await act(async () => root.render(view()))
	await vi.waitFor(() => expect(tab('Scenarios').getAttribute('aria-selected')).toBe('true'))
	const draft = container.querySelector<HTMLButtonElement>('#vault-risk-scenarios button')!
	await act(async () => draft.click())
	expect(draft.textContent).toBe('Drop 20%')
	const renderCount = renders.mock.calls.length
	await act(async () => tab('Scenarios').focus())
	await press(tab('Scenarios'), 'ArrowRight')
	expect(tab('Trust').getAttribute('aria-selected')).toBe('true')
	expect(window.location.hash).toBe('#vault-risk-trust')
	await act(async () => {
		window.history.replaceState(null, '', '/#vault-risk-scenarios')
		window.dispatchEvent(new HashChangeEvent('hashchange'))
	})
	expect(tab('Scenarios').getAttribute('aria-selected')).toBe('true')
	expect(container.querySelector('#vault-risk-scenarios button')).toBe(draft)
	expect(draft.textContent).toBe('Drop 20%')
	expect(renders).toHaveBeenCalledTimes(renderCount)
	await act(async () => {
		window.history.replaceState(null, '', '/#unrelated-anchor')
		window.dispatchEvent(new HashChangeEvent('hashchange'))
	})
	expect(tab('Scenarios').getAttribute('aria-selected')).toBe('true')
	expect(window.location.hash).toBe('#unrelated-anchor')
})
