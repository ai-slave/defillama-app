// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { HttpError } from '~/utils/async'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ConfirmActionDialog } from '../ConfirmActionDialog'
import { DialogBody, DialogHeader, SideSheet } from '../Dialog'

let root: Root
let container: HTMLDivElement
let attempts: Array<PromiseWithResolvers<void>>
beforeEach(() => {
	attempts = []
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Harness() {
	const [open, setOpen] = useState(false)
	const deletion = useMutation({
		mutationFn: () => {
			const attempt = Promise.withResolvers<void>()
			attempts.push(attempt)
			return attempt.promise
		}
	})
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Delete row
			</button>
			{open ? (
				<ConfirmActionDialog
					title="Delete row?"
					description="This cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					errorMessage="Couldn't delete the row."
					mutation={deletion}
					variables={undefined}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	)
}

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<Harness />
			</QueryClientProvider>
		)
	)
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
const alertText = () => document.querySelector('[role="alert"]')?.textContent ?? null

test('a failed attempt keeps its error on screen while the retry runs', async () => {
	await render()
	await click('Delete row')
	await click('Delete')
	await act(async () => attempts[0].reject(new TypeError('Failed to fetch')))
	await waitForUi(() => expect(alertText()).toBe("Couldn't delete the row."))
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…')).toBeDefined())
	expect(alertText()).toBe("Couldn't delete the row.")
	await act(async () => attempts[1].resolve())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
})

test('reopening after a failed attempt starts without the old error', async () => {
	await render()
	await click('Delete row')
	await click('Delete')
	await act(async () => attempts[0].reject(new HttpError('[HTTP] [error] [409]', 409, 'The row is in use.')))
	await waitForUi(() => expect(alertText()).toBe('The row is in use.'))
	await click('Cancel')
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await click('Delete row')
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
	expect(alertText()).toBeNull()
})

// A sheet of rows whose Delete opens a confirmation. happy-dom, like Safari and Firefox on macOS, does not focus a
// button on click, so without the sheet's help focus would stay on its × when the confirmation opens.
function SheetRows({ removes, named }: { removes: boolean; named: boolean }) {
	const [rows, setRows] = useState(['Alpha', 'Beta', 'Gamma'])
	const [confirming, setConfirming] = useState<string | null>(null)
	const deletion = useMutation({
		mutationFn: (_row: string) => {
			const attempt = Promise.withResolvers<void>()
			attempts.push(attempt)
			return attempt.promise
		},
		onSuccess: (_, row) => {
			if (removes) setRows((current) => current.filter((entry) => entry !== row))
		}
	})
	return (
		<SideSheet size="sm" open onClose={() => {}}>
			<DialogHeader title="Rows" />
			<DialogBody>
				<input aria-label="Search rows" />
				<button type="button">Clear search</button>
				<ul aria-label="Rows" tabIndex={-1}>
					{rows.map((row) => (
						<li key={row}>
							<button type="button" onClick={() => setConfirming(row)}>
								Delete {row}
							</button>
						</li>
					))}
				</ul>
			</DialogBody>
			{confirming ? (
				<ConfirmActionDialog
					title={`Delete ${confirming}?`}
					description="This cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					errorMessage="Couldn't delete the row."
					mutation={deletion}
					variables={confirming}
					onClose={() => setConfirming(null)}
					{...(named
						? {
								autoFocusOnHide: (trigger: HTMLElement | null) => {
									if (trigger?.isConnected) return true
									document.querySelector<HTMLElement>('ul[aria-label="Rows"]')!.focus()
									return false
								}
							}
						: {})}
				/>
			) : null}
		</SideSheet>
	)
}

async function renderSheet(props: { removes: boolean; named: boolean }) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<SheetRows {...props} />
			</QueryClientProvider>
		)
	)
	await waitForUi(() => expect(document.activeElement).toBe(button('Close dialog')))
}

async function confirmDeleteBeta() {
	await click('Delete Beta')
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
	await click('Delete')
	await act(async () => attempts[0].resolve())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	// Ariakit retries a trigger that is gone one frame later, then asks autoFocusOnHide.
	await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
}

test("a confirmation clicked open in a sheet hands focus to the caller's target once success removes its button", async () => {
	await renderSheet({ removes: true, named: true })
	await confirmDeleteBeta()
	expect(document.activeElement).toBe(document.querySelector('ul[aria-label="Rows"]'))
})

test('a confirmation clicked open in a sheet returns focus to its button when the button stays', async () => {
	await renderSheet({ removes: false, named: false })
	await confirmDeleteBeta()
	expect(document.activeElement).toBe(button('Delete Beta'))
})

test('a button clicked in a sheet while a text field has focus leaves focus in the field', async () => {
	await renderSheet({ removes: false, named: false })
	const search = document.querySelector<HTMLInputElement>('input[aria-label="Search rows"]')!
	await act(async () => search.focus())
	await click('Clear search')
	expect(document.activeElement).toBe(search)
})
