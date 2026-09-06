// @vitest-environment happy-dom

import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AlertsDialogHeader } from '~/containers/LlamaAI/components/alerts/ui'
import { SchemaDrawer } from '../SchemaDrawer'

vi.mock('../SchemaBrowser', () => ({ SchemaBrowser: () => <div>Dataset browser</div> }))
vi.mock('../DocsPanel', () => ({ CookbookTab: () => null, ShortcutsTab: () => null }))

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

function SchemaHarness({ onClose }: { onClose: () => void }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Browse datasets
			</button>
			<SchemaDrawer
				open={open}
				onClose={() => {
					setOpen(false)
					onClose()
				}}
				totalDatasetCount={0}
				chartOptionsMap={{}}
				loadedTables={[]}
				loading={null}
				onLoad={async () => null}
				onReplaceSql={vi.fn()}
				onInsertAtCursor={vi.fn()}
				onApplyAndRun={vi.fn()}
			/>
		</>
	)
}

test.each(['dismiss', 'Escape'] as const)('SQL reference is named and %s closes once', async (action) => {
	const onClose = vi.fn()
	await act(async () => root.render(<SchemaHarness onClose={onClose} />))
	const trigger = container.querySelector('button')!
	await act(async () => {
		trigger.focus()
		trigger.click()
	})
	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('SQL reference')
	const dismiss = dialog.querySelector<HTMLButtonElement>('[aria-label="Close SQL reference"]')!
	await act(async () => {
		if (action === 'dismiss') dismiss.click()
		else dismiss.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	})
	expect(onClose).toHaveBeenCalledTimes(1)
})

test('alert dialogs use the supplied visible title as the dialog name', async () => {
	const title = 'New alert'
	const setOpen = vi.fn()
	await act(async () =>
		root.render(
			<Ariakit.DialogProvider defaultOpen setOpen={setOpen}>
				<Ariakit.Dialog>
					<AlertsDialogHeader title={title} />
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		)
	)
	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(title)
	await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.click())
	expect(setOpen.mock.calls).toEqual([[false]])
})
