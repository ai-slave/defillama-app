// @vitest-environment happy-dom
import { act, useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
import { Editor } from '../Editor'

// Monaco cannot run in happy-dom. The stand-in renders only the element Monaco types into, which Editor finds by its
// class, and hands onMount the one editor method a read-only Editor calls besides getDomNode.
vi.mock('@monaco-editor/react', () => ({
	default: function MonacoStandIn({ onMount }: { onMount: (editor: unknown, monaco: unknown) => void }) {
		const node = useRef<HTMLDivElement>(null)
		useEffect(() => {
			onMount({ getDomNode: () => node.current, onDidDispose: () => {} }, {})
		}, [onMount])
		return (
			<div ref={node}>
				<div className="native-edit-context" role="textbox" tabIndex={0} />
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

test("the editable element carries the field's label and error, takes focus, and clears once fixed", async () => {
	await render(null)
	const editable = container.querySelector<HTMLElement>('.native-edit-context')!
	expect(container.querySelector('label')!.htmlFor).toBe(editable.id)
	expect(editable.getAttribute('aria-invalid')).toBeNull()

	await render('Enter a query.')
	await act(async () => showFieldErrors(container.querySelector('form')!, () => {}))
	expect(fieldErrorOf(editable)).toBe('Enter a query.')
	expect(document.activeElement).toBe(editable)

	await render(null)
	expect(editable.getAttribute('aria-invalid')).toBeNull()
	expect(editable.getAttribute('aria-describedby')).toBeNull()
})
