// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Field } from '~/ui/Field'
import { fieldErrorOf, fieldErrorTexts } from '../fieldErrors'

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

async function renderFields(emailError: string | null) {
	await act(async () =>
		root.render(
			<>
				<Field label="Email" hint="We never share it." error={emailError}>
					{(control) => <input {...control} />}
				</Field>
				<Field label="Name" error="Enter a name.">
					{(control) => <input {...control} />}
				</Field>
			</>
		)
	)
	return [...container.querySelectorAll('input')]
}

test('a field with a hint reads its error, not the hint, and each control its own', async () => {
	const [email, name] = await renderFields('Enter a valid email.')
	expect(fieldErrorOf(email)).toBe('Enter a valid email.')
	expect(fieldErrorOf(name)).toBe('Enter a name.')
	expect(fieldErrorTexts(container)).toEqual(['Enter a valid email.', 'Enter a name.'])
})

test('a valid field with a hint has no error', async () => {
	const [email] = await renderFields(null)
	expect(fieldErrorOf(email)).toBeNull()
	expect(fieldErrorTexts(container)).toEqual(['Enter a name.'])
})
