// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { EXAMPLE_QUERIES } from '../examples'
import { ExamplesPanel } from '../ExamplesPanel'

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

// Wired the way the SQL workspace holds the playbook: a run marks its example busy.
function Playbook() {
	const [collapsed, setCollapsed] = useState(false)
	const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
	return (
		<ExamplesPanel
			onApply={(example) => setBusyTaskId(`example:${example.title}`)}
			busyTaskId={busyTaskId}
			collapse={{ collapsed, onToggle: () => setCollapsed((current) => !current) }}
		/>
	)
}

const byLabel = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!

async function press(button: HTMLElement) {
	await act(async () => {
		button.focus()
		button.click()
	})
}

test('collapsing and expanding the playbook keeps focus on its toggle', async () => {
	await act(async () => root.render(<Playbook />))
	await press(byLabel('Collapse playbook'))
	expect(document.activeElement).toBe(byLabel('Expand playbook'))
	await press(byLabel('Expand playbook'))
	expect(document.activeElement).toBe(byLabel('Collapse playbook'))
})

test('the example a reader runs keeps focus while it is busy', async () => {
	await act(async () => root.render(<Playbook />))
	const example = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
		button.textContent?.includes(EXAMPLE_QUERIES[0].title)
	)!
	await press(example)
	expect(example.getAttribute('aria-busy')).toBe('true')
	// Browsers blur a natively disabled button and drop focus to the page; happy-dom does not, so check the cause.
	expect(example.matches(':disabled')).toBe(false)
	expect(example.getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(example)
})

test('a playbook that cannot collapse, as in the SQL chart sidebar, lists its examples without a toggle', async () => {
	await act(async () => root.render(<ExamplesPanel onApply={() => {}} busyTaskId={null} />))
	expect(container.textContent).toContain(EXAMPLE_QUERIES[0].title)
	expect(byLabel('Collapse playbook')).toBeNull()
})
