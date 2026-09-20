// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { UploadSelectionNotice } from './UploadSelectionNotice'

test('keeps skipped filenames and reasons available until dismissed', async () => {
	const host = document.createElement('div')
	const root = createRoot(host)
	const dismiss = vi.fn()
	await act(async () =>
		root.render(
			<UploadSelectionNotice
				feedback={{
					added: 1,
					skipped: [
						{ filename: 'oversized.csv', reason: 'Exceeds 100 MB.' },
						{ filename: 'archive.zip', reason: 'Unzip first.' }
					]
				}}
				onDismiss={dismiss}
			/>
		)
	)
	expect(host.querySelector('[role="status"]')!.textContent).toBe('1 file added · 2 skipped')
	expect(host.querySelectorAll('li')).toHaveLength(2)
	expect(host.textContent).toContain('oversized.csv')
	expect(host.textContent).toContain('Unzip first.')
	await act(async () => host.querySelector<HTMLButtonElement>('button')!.click())
	expect(dismiss).toHaveBeenCalledOnce()
	await act(async () => root.render(<UploadSelectionNotice feedback={null} onDismiss={dismiss} />))
	expect(host.textContent).toBe('')
	await act(async () => root.unmount())
})
