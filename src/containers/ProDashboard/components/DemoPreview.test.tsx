// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DemoPreview } from './DemoPreview'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/pro/preview', query: {} }) }))
vi.mock('next/link', () => ({
	default: ({
		children,
		href,
		prefetch: _prefetch,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
		<a href={href} {...props}>
			{children}
		</a>
	)
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => <div data-demo-chart /> }))
vi.mock('./UnifiedTable', () => ({ default: () => <div data-demo-table /> }))
vi.mock('./TextCard', () => ({ TextCard: () => null }))

describe('DemoPreview', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<DemoPreview />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('labels the sample charts as sample data and the table below them as live', () => {
		const captions = Array.from(container.querySelectorAll('p'))
		const chartsCaption = captions.find((node) => node.textContent?.trim() === 'Sample charts use illustrative data')!
		const liveCaption = captions.find((node) => node.textContent?.trim() === 'Live data from DefiLlama')!
		const table = container.querySelector('[data-demo-table]')!
		const firstChart = container.querySelector('[data-demo-chart]')!
		expect(chartsCaption.compareDocumentPosition(firstChart) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		)
		expect(liveCaption.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		)
		expect(firstChart.compareDocumentPosition(liveCaption) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		)
	})

	test('offers account creation that returns to the preview, and community dashboards', () => {
		const links = Array.from(container.querySelectorAll('a'))
		const createAccount = links.find((link) => link.textContent?.trim() === 'Create a free account')
		const discover = links.find((link) => link.textContent?.trim() === 'See community dashboards')
		expect(createAccount?.getAttribute('href')).toBe('/subscription?returnUrl=%2Fpro%2Fpreview')
		expect(discover?.getAttribute('href')).toBe('/pro?tab=discover')
	})
})
