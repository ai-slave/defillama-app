// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Button } from '~/ui/Button'
import { accessibleName } from '../accessibleName'

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

test('a busy button is named by its pending label, not the idle label it keeps for width', async () => {
	await act(async () =>
		root.render(
			<Button size="md" pendingLabel="Saving…">
				Save
			</Button>
		)
	)
	expect(accessibleName(container.querySelector('button')!)).toBe('Saving…')
})

test('an aria-labelled icon button is named by its label', async () => {
	await act(async () =>
		root.render(
			<Button size="sm" square aria-label="Close dialog">
				<svg aria-hidden="true" />
			</Button>
		)
	)
	expect(accessibleName(container.querySelector('button')!)).toBe('Close dialog')
})
