// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { PDFExportButton } from '../PDFExportButton'

const session = installSubscriberSession('reader', { resolved: true })

test('Dark Mode exports the message as a dark PDF and downloads the file', async () => {
	session.serve({
		'https://ai.llama.fi/export/pdf': { success: true, pdfUrl: 'https://files.llama.fi/export-1.pdf' },
		'https://files.llama.fi/export-1.pdf': () => new Response(new Blob(['%PDF'], { type: 'application/pdf' }))
	})
	const downloads: Array<string> = []
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf')
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
		downloads.push(this.download)
	})
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<PDFExportButton sessionId="session" messageId="message" exportType="single_message" />
				</session.Wrapper>
			)
		)
		await act(async () =>
			container.querySelector<HTMLButtonElement>('button[aria-label="Export PDF options"]')!.click()
		)
		const darkMode = await vi.waitFor(() => {
			const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
				(element) => element.textContent === 'Dark Mode'
			)
			expect(item?.getAttribute('aria-disabled')).not.toBe('true')
			return item!
		})
		await act(async () => darkMode.click())

		await vi.waitFor(() => expect(downloads).toHaveLength(1))
		expect(downloads[0]).toMatch(/^llama-ai-export-\d+\.pdf$/)
		const exportRequest = session.requests.find((request) => request.url.pathname === '/export/pdf')!
		expect(JSON.parse(exportRequest.init!.body as string)).toEqual({
			sessionId: 'session',
			exportType: 'single_message',
			messageId: 'message',
			options: { includeTimestamps: true, includeCitations: true, paperSize: 'A4', isDark: true }
		})
	} finally {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	}
})
