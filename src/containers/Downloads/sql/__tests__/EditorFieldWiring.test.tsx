// @vitest-environment happy-dom
import { act, useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Editor } from '../Editor'

// Monaco cannot run in happy-dom. The stand-in renders the DOM Monaco 0.55 builds in each input mode and hands a
// minimal editor to onMount. EditContext mode (the default where the browser supports it) types into
// div.native-edit-context and keeps a readonly, aria-hidden .ime-text-area beside it; the fallback types into
// textarea.inputarea.
const shape = vi.hoisted(() => ({ current: 'editContext' as 'editContext' | 'textarea' }))
vi.mock('@monaco-editor/react', () => ({
	default: function MonacoStandIn({ onMount }: { onMount: (editor: unknown, monaco: unknown) => void }) {
		const node = useRef<HTMLDivElement>(null)
		useEffect(() => {
			onMount({ getDomNode: () => node.current, getContentHeight: () => 0, onDidDispose: () => {} }, {})
		}, [onMount])
		return (
			<div ref={node}>
				{shape.current === 'editContext' ? (
					<>
						<div className="native-edit-context" role="textbox" tabIndex={0} aria-label="Editor content" />
						<textarea className="ime-text-area" readOnly tabIndex={-1} aria-hidden="true" />
					</>
				) : (
					<textarea className="inputarea" aria-label="Editor content" />
				)}
			</div>
		)
	},
	loader: { config: () => {} }
}))

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

function render(error: string | null) {
	return act(async () =>
		root.render(
			<form noValidate>
				<Field label="SQL query" hideLabel error={error}>
					{(control) => <Editor {...control} value="" onChange={() => {}} onRun={() => {}} tables={[]} readOnly />}
				</Field>
			</form>
		)
	)
}

test.each([
	['editContext', '.native-edit-context'],
	['textarea', 'textarea.inputarea']
] as const)(
	"in %s mode the editable element carries the field's label, error and focus",
	async (mode, editableSelector) => {
		shape.current = mode
		await render(null)
		const editable = container.querySelector<HTMLElement>(editableSelector)!
		expect(container.querySelector('label')!.htmlFor).toBe(editable.id)
		expect(editable.getAttribute('aria-invalid')).toBeNull()

		await render('Enter a query.')
		await act(async () => showFieldErrors(container.querySelector('form')!, () => {}))
		expect(editable.getAttribute('aria-invalid')).toBe('true')
		expect(document.getElementById(editable.getAttribute('aria-describedby')!)?.textContent).toBe('Enter a query.')
		expect(document.activeElement).toBe(editable)
		const imeTextArea = container.querySelector('.ime-text-area')
		expect(imeTextArea?.hasAttribute('aria-invalid') ?? false).toBe(false)

		await render(null)
		expect(editable.getAttribute('aria-invalid')).toBeNull()
		expect(editable.getAttribute('aria-describedby')).toBeNull()
	}
)
