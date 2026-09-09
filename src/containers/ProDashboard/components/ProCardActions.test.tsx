// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProCardEditControls, ProCardOverflowMenu } from './ProCardActions'
const mocks = vi.hoisted(() => ({
	permissions: { isReadOnly: false, hideDuplicateButton: false },
	auth: { isAuthenticated: true, hasActiveSubscription: true, isTrial: false, loaders: { userLoading: false } },
	download: vi.fn()
}))
vi.mock('../ProDashboardAPIContext', () => ({ useProDashboardPermissions: () => mocks.permissions }))
vi.mock('~/auth', () => ({ useAuthContext: () => mocks.auth }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.download }))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))
vi.mock('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard', () => ({
	SubscribeProModal: () => <div>Subscribe to export</div>
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.permissions.isReadOnly = false
	mocks.permissions.hideDuplicateButton = false
	mocks.auth.hasActiveSubscription = true
	mocks.download.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function openMenu() {
	await act(async () => (container.querySelector('[aria-label="More actions"]') as HTMLButtonElement).click())
}
test('readonly allows exports but hides duplicate and edit controls', async () => {
	mocks.permissions.isReadOnly = true
	await act(async () =>
		root.render(
			<>
				<ProCardEditControls>
					<button type="button">Edit</button>
				</ProCardEditControls>
				<ProCardOverflowMenu image={{ chartInstance: () => null }} onDuplicate={vi.fn()} />
			</>
		)
	)
	expect(container.textContent).not.toContain('Edit')
	await openMenu()
	expect(document.body.textContent).toContain('Download image')
	expect(document.body.textContent).not.toContain('Duplicate')
})
test('has no trigger without actions and respects hidden duplicate', async () => {
	await act(async () => root.render(<ProCardOverflowMenu />))
	expect(container.querySelector('button')).toBeNull()
	mocks.permissions.hideDuplicateButton = true
	await act(async () => root.render(<ProCardOverflowMenu onDuplicate={vi.fn()} />))
	expect(container.querySelector('button')).toBeNull()
})
test('CSV downloads for subscribers and opens the gate otherwise', async () => {
	const prepareCsv = () => ({ filename: 'Example', rows: [['value'], [1]] })
	await act(async () => root.render(<ProCardOverflowMenu csv={{ prepareCsv }} />))
	await openMenu()
	await act(async () =>
		Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
			.find((node) => node.textContent === 'Download CSV')!
			.click()
	)
	expect(mocks.download).toHaveBeenCalledOnce()
	mocks.auth.hasActiveSubscription = false
	await act(async () => root.render(<ProCardOverflowMenu csv={{ prepareCsv }} />))
	await openMenu()
	await act(async () =>
		Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
			.find((node) => node.textContent === 'Download CSV')!
			.click()
	)
	expect(mocks.download).toHaveBeenCalledOnce()
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 20))
	})
	expect(document.body.textContent).toContain('Subscribe to export')
})
