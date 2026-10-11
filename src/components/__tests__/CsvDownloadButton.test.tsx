// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProCardOverflowMenu } from '~/containers/ProDashboard/components/ProCardActions'
import { UnifiedTableHeader } from '~/containers/ProDashboard/components/UnifiedTable/core/UnifiedTableHeader'
import { ProDashboardAPIProvider } from '~/containers/ProDashboard/ProDashboardAPIContext'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CSVDownloadButton, type CsvPayload } from '../CsvDownloadButton'
// Warm the lazily loaded access dialog; a cold import under full-suite load outlasts waitFor.
import '~/containers/Subscription/shared/SubscribeCards/SubscribeProCard'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example', query: {}, push: vi.fn() }) }))

const session = installSubscriberSession('subscriber')
const downloads = installDownloadSink()
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// The dashboard provider loads the reader's dashboard list.
	session.serve({ '/dashboards': { items: [] }, '/lite/dashboards': { items: [] } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	toast.remove()
	container.remove()
})
async function render(node: ReactNode) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProDashboardAPIProvider mode="view">{node}</ProDashboardAPIProvider>
				<Toaster />
			</session.Wrapper>
		)
	)
}
function button(name: string) {
	const found = [...document.querySelectorAll<HTMLButtonElement>('button, [role="menuitem"]')].find(
		(el) => accessibleName(el) === name
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
const waitFor = (assertion: () => void) => waitForUi(assertion, { timeout: 1000 })
// The export is gated until the session's subscription check settles.
const waitForSession = () =>
	waitFor(() => expect(button('Download .csv').getAttribute('aria-disabled')).not.toBe('true'))
const toastText = () => document.querySelector('[data-rht-toaster]')?.textContent
// The export only ever toasts its failure, so any toast here is the error one.
const toasts = () => document.querySelectorAll('[data-rht-toaster] [role="status"]')

test('a prepared export blocks duplicates, reports failure in a toast, and downloads on retry', async () => {
	const pending = Promise.withResolvers<CsvPayload>()
	const prepare = vi
		.fn()
		.mockReturnValueOnce(pending.promise)
		.mockResolvedValueOnce({ filename: 'Tokens.csv', rows: [['Coin'], ['DOGE']] })
	await render(<CSVDownloadButton prepareCsv={prepare} />)
	await waitForSession()
	await act(async () => button('Download .csv').focus())
	await click('Download .csv')
	// The button keeps its label while the file is prepared; the status line announces the wait.
	await waitFor(() => expect(button('Download .csv').getAttribute('aria-disabled')).toBe('true'))
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Preparing CSV download')
	expect(document.activeElement).toBe(button('Download .csv'))
	await click('Download .csv')
	expect(prepare).toHaveBeenCalledOnce()
	expect(downloads).toEqual([])

	await act(async () => pending.reject(new Error('Snapshot unavailable')))
	await waitFor(() => expect(toasts()).toHaveLength(1))
	expect(button('Download .csv').disabled).toBe(false)

	await click('Download .csv')
	await waitFor(() => expect(downloads.map((download) => download.filename)).toEqual(['tokens.csv']))
	expect(await downloads[0]!.blob.text()).toBe('Coin\nDOGE')
})

test('an export callback announces progress only after the session settles', async () => {
	let settleSubscription!: () => void
	const subscription = new Promise<void>((resolve) => (settleSubscription = resolve))
	session.serve({
		'/subscription/status': async () => {
			await subscription
			return Response.json({ subscription: { status: 'active', expires_at: '2100-01-01', type: 'pro' } })
		}
	})
	const pending = Promise.withResolvers<void>()
	await render(<CSVDownloadButton onClick={() => pending.promise} isLoading={false} />)
	const status = () => container.querySelector('span[role="status"]')?.textContent
	expect(status()).toBe('')
	expect(button('Download .csv').getAttribute('aria-disabled')).toBe('true')

	await act(async () => settleSubscription())
	await waitForSession()
	await click('Download .csv')
	expect(status()).toBe('Preparing CSV download')
	await act(async () => pending.resolve())
	expect(status()).toBe('')
	expect(button('Download .csv').getAttribute('aria-disabled')).not.toBe('true')
})

test('a loading dataset keeps the export disabled without announcing it', async () => {
	await render(<CSVDownloadButton onClick={vi.fn()} isLoading />)
	expect(container.querySelector('span[role="status"]')?.textContent).toBe('')
	expect(button('Download .csv').getAttribute('aria-disabled')).toBe('true')
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
		const trigger = button('More actions')
		expect(trigger.disabled || trigger.getAttribute('aria-disabled') === 'true').toBe(true)
		await click('More actions')
		expect(exportRows).not.toHaveBeenCalled()
		await render(header(false))
		await click('More actions')
		await click(grouped ? 'Download CSV: Chains Only' : 'Download CSV')
		await waitFor(() => expect(exportRows.mock.calls).toEqual(grouped ? [['chain']] : [[]]))
	}
)

test('grouped export supports arrows and Escape, retains failed choices, and prevents a second export while pending', async () => {
	const pending = Promise.withResolvers<void>()
	const exportRows = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
	await render(
		<ProCardOverflowMenu csvLevels={{ rowHeaders: ['chain', 'category', 'protocol'], onExport: exportRows }} />
	)
	const trigger = button('More actions')
	await act(async () => trigger.focus())
	await key(trigger, 'ArrowDown')
	await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Download CSV: All Protocols'))
	expect(trigger.getAttribute('aria-expanded')).toBe('true')
	await key(document.activeElement as HTMLElement, 'ArrowDown')
	await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Download CSV: Chains Only'))
	await key(document.activeElement as HTMLElement, 'Escape')
	await waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(trigger.getAttribute('aria-expanded')).toBe('false')

	await click('More actions')
	await waitFor(() => expect(button('Download CSV: Chains Only').getAttribute('aria-disabled')).not.toBe('true'))
	await click('Download CSV: Chains Only')
	await waitFor(() => expect(button('Download CSV: Categories Only').getAttribute('aria-disabled')).toBe('true'))
	await click('Download CSV: Categories Only')
	expect(exportRows.mock.calls).toEqual([['chain']])
	await act(async () => pending.reject(new Error('Unavailable')))
	await waitFor(() => expect(alertTexts()).toHaveLength(1))
	expect(toastText()).toBe('')

	await key(button('Download CSV: Chains Only'), 'Escape')
	await key(trigger, 'ArrowDown')
	await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
	expect(document.querySelector('[role="alert"]')).toBeNull()
	await click('Download CSV: Categories Only')
	await waitFor(() => expect(exportRows.mock.calls).toEqual([['chain'], ['category']]))
	await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
})

test.each([
	['trial', 'CSV downloads require Pro'],
	['signed out', 'Unlock Pro features']
] as const)('a %s reader opens an access dialog instead of exporting', async (account, heading) => {
	if (account === 'trial') {
		const record = { ...pb.authStore.record!, flags: { is_trial: true } }
		pb.authStore.save(pb.authStore.token, record)
		session.serve({
			'/api/collections/users/auth-refresh': { token: pb.authStore.token, record },
			'/subscription/trial-available': { trialAvailable: false }
		})
	} else {
		pb.authStore.clear()
	}
	const exportRows = vi.fn()
	await render(<ProCardOverflowMenu csvLevels={{ rowHeaders: ['chain', 'protocol'], onExport: exportRows }} />)
	await click('More actions')
	await waitFor(() => expect(button('Download CSV: Chains Only').getAttribute('aria-disabled')).not.toBe('true'))
	await click('Download CSV: Chains Only')
	await waitFor(() => expect(document.body.textContent).toContain(heading))
	expect(exportRows).not.toHaveBeenCalled()
})

test('free exports bypass a trial restriction while explicit disabled still blocks the download', async () => {
	pb.authStore.clear()
	const prepareCsv = () => ({ filename: 'Public.csv', rows: [['Value'], [1]] })
	await render(<CSVDownloadButton free disabled prepareCsv={prepareCsv} />)
	await click('Download .csv')
	expect(downloads).toEqual([])
	await render(<CSVDownloadButton free prepareCsv={prepareCsv} />)
	await click('Download .csv')
	await waitFor(() => expect(downloads.map((download) => download.filename)).toEqual(['public.csv']))
})

test.each(['dismissed', 'unmounted'] as const)(
	'a %s grouped popup reports a late failure in a toast',
	async (closing) => {
		const pending = Promise.withResolvers<void>()
		const exportRows = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
		const dropdown = <ProCardOverflowMenu csvLevels={{ rowHeaders: ['chain', 'protocol'], onExport: exportRows }} />
		await render(dropdown)
		await click('More actions')
		await waitFor(() => expect(button('Download CSV: Chains Only').getAttribute('aria-disabled')).not.toBe('true'))
		await click('Download CSV: Chains Only')
		if (closing === 'dismissed') {
			await key(button('Download CSV: Chains Only'), 'Escape')
		} else {
			await render(null)
		}
		await act(async () => pending.reject(new Error('Snapshot unavailable')))
		await waitFor(() => expect(toasts()).toHaveLength(1))

		await render(dropdown)
		await click('More actions')
		expect(document.querySelector('p[role="alert"]')).toBeNull()
		await click('Download CSV: Chains Only')
		await waitFor(() => expect(exportRows.mock.calls).toEqual([['chain'], ['chain']]))
	}
)
