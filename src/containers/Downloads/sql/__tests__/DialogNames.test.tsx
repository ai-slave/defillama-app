// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SchemaDrawer } from '../SchemaDrawer'

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
				chartOptionsMap={{}}
				loadedTables={[]}
				loading={null}
				loadError={null}
				pickedParams={{}}
				setPickedParams={vi.fn()}
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
	const dismiss = dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!
	await act(async () => {
		if (action === 'dismiss') dismiss.click()
		else dismiss.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	})
	expect(onClose).toHaveBeenCalledTimes(1)
})
