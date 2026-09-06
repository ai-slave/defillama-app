// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { CSVDownloadButton, type CsvPayload } from '../CsvDownloadButton'

const mocks = vi.hoisted(() => ({ toast: vi.fn(), download: vi.fn() }))
vi.mock('react-hot-toast', () => ({ toast: { error: mocks.toast } }))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.download }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		hasActiveSubscription: true,
		isTrial: false,
		loaders: { userLoading: false }
	})
}))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/tokens' }) }))
vi.mock('~/containers/Subscription/shared/TrialCsvLimitModal', () => ({ TrialCsvLimitModal: () => null }))

afterEach(() => {
	vi.clearAllMocks()
	vi.restoreAllMocks()
})

test('stops loading after a failed export, downloads nothing, and prepares again on retry', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.spyOn(console, 'log').mockImplementation(() => {})
	const pending = Promise.withResolvers<CsvPayload>()
	const payload: CsvPayload = { filename: 'tokens.csv', rows: [['Coin'], ['DOGE']] }
	const prepareCsv = vi
		.fn<() => Promise<CsvPayload>>()
		.mockReturnValueOnce(pending.promise)
		.mockResolvedValueOnce(payload)
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<CSVDownloadButton prepareCsv={prepareCsv} />))
		const button = container.querySelector('button')
		if (!button) throw new Error('Missing export button')
		await act(async () => button.click())
		expect(button.disabled).toBe(true)
		expect(mocks.download).not.toHaveBeenCalled()
		await act(async () => pending.reject(new Error('Snapshot unavailable')))
		expect(mocks.toast).toHaveBeenCalledExactlyOnceWith('Couldn’t complete the CSV export. Please try again.')
		expect(button.disabled).toBe(false)
		expect(mocks.download).not.toHaveBeenCalled()
		await act(async () => button.click())
		expect(prepareCsv).toHaveBeenCalledTimes(2)
		expect(mocks.download).toHaveBeenCalledExactlyOnceWith('tokens.csv', payload.rows, { addTimestamp: false })
		expect(mocks.toast).toHaveBeenCalledTimes(1)
		expect(button.disabled).toBe(false)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test('logs custom handler failures without a toast or download and remains usable', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const log = vi.spyOn(console, 'log').mockImplementation(() => {})
	const error = new Error('Custom export failure')
	const onClick = vi.fn<() => void>().mockImplementation(() => {
		throw error
	})
	const container = document.createElement('div')
	const root = createRoot(container)
	try {
		await act(async () => root.render(<CSVDownloadButton onClick={onClick} isLoading={false} free />))
		const button = container.querySelector('button')
		if (!button) throw new Error('Missing export button')
		await act(async () => button.click())
		expect(onClick).toHaveBeenCalledOnce()
		expect(log).toHaveBeenCalledExactlyOnceWith(error)
		expect(button.disabled).toBe(false)
		onClick.mockImplementation(() => {})
		await act(async () => button.click())
		expect(onClick).toHaveBeenCalledTimes(2)
		expect(button.disabled).toBe(false)
		expect(mocks.toast).not.toHaveBeenCalled()
		expect(mocks.download).not.toHaveBeenCalled()
	} finally {
		await act(async () => root.unmount())
	}
})
