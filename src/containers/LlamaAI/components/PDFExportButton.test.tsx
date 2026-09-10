// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { PDFExportButton } from './PDFExportButton'

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ loaders: { userLoading: false }, authorizedFetch: vi.fn(), hasActiveSubscription: true })
}))

test('PDF options open the export menu and Escape returns focus to the button', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(<PDFExportButton sessionId="session" messageId="message" exportType="single_message" />)
		)
		const button = container.querySelector<HTMLButtonElement>('button[aria-label="Export PDF options"]')!
		await act(async () => {
			button.focus()
			button.click()
		})
		await vi.waitFor(() => {
			const menu = document.querySelector('[role="menu"]')
			expect(menu?.textContent).toContain('Light Mode')
			expect(menu?.textContent).toContain('Dark Mode')
			expect(button.getAttribute('aria-controls')).toBe(menu?.id)
		})
		await act(async () =>
			document
				.querySelector('[role="menu"]')!
				.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		)
		await vi.waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('false'))
		await vi.waitFor(() => expect(document.activeElement).toBe(button))
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
