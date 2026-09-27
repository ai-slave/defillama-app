// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AlertsDialogHeader } from '../ui'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('alert dialogs are named by their visible title and close from the header', async () => {
	// Mirrors how CreateAlertModal and AlertsModal place the header inside their dialog.
	await act(async () =>
		root.render(
			<Ariakit.DialogProvider defaultOpen>
				<Ariakit.Dialog>
					<AlertsDialogHeader title="New alert" />
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		)
	)
	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('New alert')
	await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click())
	await waitForUi(() => expect(dialog.hidden).toBe(true))
})
