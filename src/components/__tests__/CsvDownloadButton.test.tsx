// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CsvExportDropdown } from '~/containers/ProDashboard/components/UnifiedTable/core/CsvExportDropdown'
import { UnifiedTableHeader } from '~/containers/ProDashboard/components/UnifiedTable/core/UnifiedTableHeader'
import { CSVDownloadButton, type CsvPayload } from '../CsvDownloadButton'

const mocks = vi.hoisted(() => ({
	download: vi.fn(),
	auth: { isAuthenticated: true, hasActiveSubscription: true, isTrial: false, loaders: { userLoading: false } }
}))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.download }))
vi.mock('~/auth', () => ({ useAuthContext: () => mocks.auth }))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example' }) }))
// Substitute the paid offer content, retaining actual dialog composition and access checks.
vi.mock('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard', () => ({
	SubscribeProModal: ({ dialogStore }: { dialogStore: Ariakit.DialogStore }) => (
		<Ariakit.Dialog store={dialogStore}>
			<Ariakit.DialogHeading>Subscribe to export</Ariakit.DialogHeading>
			<Ariakit.DialogDismiss>Close offer</Ariakit.DialogDismiss>
		</Ariakit.Dialog>
	)
}))
vi.mock('~/containers/Subscription/shared/TrialCsvLimitModal', () => ({
	TrialCsvLimitModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
		<Ariakit.Dialog open={isOpen} onClose={onClose}>
			<Ariakit.DialogHeading>Trial CSV limit</Ariakit.DialogHeading>
			<Ariakit.DialogDismiss>Close trial limit</Ariakit.DialogDismiss>
		</Ariakit.Dialog>
	)
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	Object.assign(mocks.auth, {
		isAuthenticated: true,
		hasActiveSubscription: true,
		isTrial: false,
		loaders: { userLoading: false }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	toast.remove()
	container.remove()
	vi.clearAllMocks()
})
async function render(node: ReactNode) {
	await act(async () =>
		root.render(
			<>
				{node}
				<Toaster />
			</>
		)
	)
}
function button(name: string) {
	const found = [...document.querySelectorAll<HTMLButtonElement>('button, [role="menuitem"]')].find(
		(el) => el.textContent?.trim() === name
	)
	if (!found) throw new Error(`Missing button: ${name}`)
	return found
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function key(element: HTMLElement, value: string) {
	await act(async () => {
		element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true, cancelable: true }))
	})
}

test.each(['prepared', 'callback'] as const)(
	'%s export blocks duplicates, reports failure in a toast, and downloads on retry',
	async (mode) => {
		const pending = Promise.withResolvers<CsvPayload>()
		const prepare = vi
			.fn()
			.mockReturnValueOnce(pending.promise)
			.mockResolvedValueOnce({ filename: 'Tokens.csv', rows: [['Coin'], ['DOGE']] })
		const callback = async () => {
			const payload = await prepare()
			mocks.download('tokens.csv', payload.rows, { addTimestamp: false })
		}
		await render(
			mode === 'prepared' ? (
				<CSVDownloadButton prepareCsv={prepare} />
			) : (
				<CSVDownloadButton onClick={callback} isLoading={false} />
			)
		)
		await act(async () => button('Download .csv').focus())
		await click('Download .csv')
		await vi.waitFor(() => expect(button('Preparing…').getAttribute('aria-disabled')).toBe('true'))
		expect(document.activeElement).toBe(button('Preparing…'))
		await click('Preparing…')
		expect(prepare).toHaveBeenCalledOnce()
		expect(mocks.download).not.toHaveBeenCalled()
		await act(async () => pending.reject(new Error('Snapshot unavailable')))
		await vi.waitFor(() =>
			expect(document.querySelector('[data-rht-toaster]')?.textContent).toBe(
				'Couldn’t complete the CSV export. Please try again.'
			)
		)
		expect(container.querySelector('p[role="alert"]')).toBeNull()
		expect(button('Download .csv').disabled).toBe(false)
		await click('Download .csv')
		await vi.waitFor(() =>
			expect(mocks.download).toHaveBeenCalledExactlyOnceWith('tokens.csv', [['Coin'], ['DOGE']], {
				addTimestamp: false
			})
		)
		await vi.waitFor(() => expect(document.querySelector('[role="alert"]')).toBeNull())
	}
)

test.each(['auth', 'dataset'] as const)('does not announce an export during %s loading', async (loading) => {
	const pending = Promise.withResolvers<void>()
	const exportRows = () => pending.promise
	mocks.auth.loaders.userLoading = loading === 'auth'
	await render(<CSVDownloadButton onClick={exportRows} isLoading={loading === 'dataset'} />)
	expect(container.querySelector('span[role="status"]')?.textContent).toBe('')
	expect(button('Download .csv').getAttribute('aria-disabled')).toBe('true')
	mocks.auth.loaders.userLoading = false
	await render(<CSVDownloadButton onClick={exportRows} isLoading={false} />)
	await click('Download .csv')
	expect(container.querySelector('span[role="status"]')?.textContent).toBe('Preparing CSV download')
	await act(async () => pending.resolve())
	expect(container.querySelector('span[role="status"]')?.textContent).toBe('')
	expect(button('Download .csv').getAttribute('aria-disabled')).not.toBe('true')
})

test.each([true, false])(
	'table export forwards disabled state with grouping=%s, then becomes usable when rows arrive',
	async (grouped) => {
		const exportRows = vi.fn()
		const header = (disabled: boolean) => (
			<UnifiedTableHeader
				title="Protocols"
				scopeDescription="All chains"
				rowHeadersSummary={null}
				rowHeaders={grouped ? ['chain', 'protocol'] : ['protocol']}
				isExportDisabled={disabled}
				onCsvExport={exportRows}
				onCsvExportLevel={exportRows}
				onSearchChange={() => {}}
				filterChips={[]}
				activeFilterCount={0}
			/>
		)
		await render(header(true))
		const trigger = button('Download .csv')
		expect(trigger.disabled || trigger.getAttribute('aria-disabled') === 'true').toBe(true)
		await click('Download .csv')
		expect(exportRows).not.toHaveBeenCalled()
		await render(header(false))
		await click('Download .csv')
		if (grouped) await click('Chains Only')
		await vi.waitFor(() => expect(exportRows.mock.calls).toEqual(grouped ? [['chain']] : [[]]))
		expect(container.querySelector('input[aria-label="Search table rows"]')).not.toBeNull()
	}
)

test('grouped export supports arrows and Escape, retains failed choices, and prevents a second export while pending', async () => {
	const pending = Promise.withResolvers<void>()
	const exportRows = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
	await render(
		<CsvExportDropdown
			rowHeaders={['chain', 'category', 'protocol']}
			onExport={exportRows}
			isLoading={false}
			disabled={false}
		/>
	)
	const trigger = button('Download .csv')
	await act(async () => trigger.focus())
	await key(trigger, 'ArrowDown')
	await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('All Protocols'))
	expect(trigger.getAttribute('aria-expanded')).toBe('true')
	await key(document.activeElement as HTMLElement, 'ArrowDown')
	await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Chains Only'))
	await key(document.activeElement as HTMLElement, 'Escape')
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(trigger.getAttribute('aria-expanded')).toBe('false')
	await click('Download .csv')
	await click('Chains Only')
	await vi.waitFor(() => expect(button('Categories Only').getAttribute('aria-disabled')).toBe('true'))
	await click('Categories Only')
	expect(exportRows.mock.calls).toEqual([['chain']])
	await act(async () => pending.reject(new Error('Unavailable')))
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toBe(
			'Couldn’t complete the CSV export. Please try again.'
		)
	)
	expect(document.querySelector('[role="menu"] [role="alert"]')).toBeNull()
	expect(document.querySelector('[data-rht-toaster]')?.textContent).toBe('')
	await key(button('Chains Only'), 'Escape')
	await key(trigger, 'ArrowDown')
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
	expect(document.querySelector('[role="alert"]')).toBeNull()
	await click('Categories Only')
	await vi.waitFor(() => expect(exportRows.mock.calls).toEqual([['chain'], ['category']]))
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
	expect(document.querySelector('[role="alert"]')).toBeNull()
})

test.each(['trial', 'signed out'] as const)(
	'%s cannot export from the menu; closing the access dialog permits a later paid export',
	async (account) => {
		Object.assign(mocks.auth, {
			isAuthenticated: account === 'trial',
			hasActiveSubscription: false,
			isTrial: account === 'trial'
		})
		const exportRows = vi.fn()
		const menu = () => (
			<CsvExportDropdown rowHeaders={['chain', 'protocol']} onExport={exportRows} isLoading={false} disabled={false} />
		)
		await render(menu())
		await click('Download .csv')
		await click('Chains Only')
		await vi.waitFor(() =>
			expect(document.body.textContent).toContain(account === 'trial' ? 'Trial CSV limit' : 'Subscribe to export')
		)
		expect(exportRows).not.toHaveBeenCalled()
		await click(account === 'trial' ? 'Close trial limit' : 'Close offer')
		Object.assign(mocks.auth, { isAuthenticated: true, hasActiveSubscription: true, isTrial: false })
		await render(menu())
		await click('Chains Only')
		await vi.waitFor(() => expect(exportRows).toHaveBeenCalledExactlyOnceWith('chain'))
	}
)

test('free exports bypass a trial restriction while explicit disabled still blocks the download', async () => {
	mocks.auth.isTrial = true
	await render(
		<CSVDownloadButton free disabled prepareCsv={() => ({ filename: 'Public.csv', rows: [['Value'], [1]] })} />
	)
	await click('Download .csv')
	expect(mocks.download).not.toHaveBeenCalled()
	await render(<CSVDownloadButton free prepareCsv={() => ({ filename: 'Public.csv', rows: [['Value'], [1]] })} />)
	await click('Download .csv')
	await vi.waitFor(() =>
		expect(mocks.download).toHaveBeenCalledExactlyOnceWith('public.csv', [['Value'], [1]], { addTimestamp: false })
	)
})

test.each(['dismissed', 'unmounted'] as const)(
	'a %s grouped popup reports a late failure in a toast',
	async (closing) => {
		const pending = Promise.withResolvers<void>()
		const exportRows = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
		const dropdown = (
			<CsvExportDropdown rowHeaders={['chain', 'protocol']} onExport={exportRows} isLoading={false} disabled={false} />
		)
		await render(dropdown)
		await click('Download .csv')
		await click('Chains Only')
		if (closing === 'dismissed') {
			await key(button('Chains Only'), 'Escape')
		} else {
			await render(null)
		}
		await act(async () => pending.reject(new Error('Snapshot unavailable')))
		await vi.waitFor(() =>
			expect(document.querySelector('[data-rht-toaster]')?.textContent).toBe(
				'Couldn’t complete the CSV export. Please try again.'
			)
		)
		await render(dropdown)
		await click('Download .csv')
		expect(document.querySelector('p[role="alert"]')).toBeNull()
		await click('Chains Only')
		await vi.waitFor(() => expect(exportRows.mock.calls).toEqual([['chain'], ['chain']]))
		await vi.waitFor(() => expect(button('Download .csv').getAttribute('aria-expanded')).toBe('false'))
	}
)
