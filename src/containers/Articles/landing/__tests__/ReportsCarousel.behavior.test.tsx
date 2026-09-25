// @vitest-environment happy-dom
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ReportsCarousel } from '~/containers/Articles/landing/ReportsCarousel'
import type { ArticleDocument } from '~/containers/Articles/types'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const report = (index: number) =>
	({
		id: `report-${index}`,
		slug: `report-${index}`,
		section: 'report',
		title: `Report ${index}`,
		excerpt: `Excerpt ${index}`,
		reportPdf: { url: `https://cdn.example/report-${index}.pdf` }
	}) as ArticleDocument

test('the centered report hydrates without a mismatch and offers both the report link and the PDF download', async () => {
	const carousel = <ReportsCarousel showButtons={false} reports={[1, 2, 3].map(report)} />
	container.innerHTML = renderToString(carousel)
	const onRecoverableError = vi.fn()

	await act(async () => {
		root = hydrateRoot(container, carousel, { onRecoverableError })
	})

	expect(onRecoverableError).not.toHaveBeenCalled()
	// The centered slide is the first report after priority reordering.
	const reportLink = container.querySelector<HTMLAnchorElement>('a[aria-label="Report 1"]')!
	expect(reportLink.getAttribute('href')).toBe('/research/report/report-1')
	const pdfLink = container.querySelector<HTMLAnchorElement>('a[href="https://cdn.example/report-1.pdf"]')!
	expect(pdfLink.textContent).toBe('Download PDF')
})
