import { afterEach, describe, expect, it, vi } from 'vitest'

const recordRuntimeErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../telemetry', () => ({
	recordRuntimeError: recordRuntimeErrorMock
}))

describe('optionalPageData', () => {
	afterEach(() => {
		recordRuntimeErrorMock.mockClear()
		vi.restoreAllMocks()
	})

	it('returns successful data without recording a degradation', async () => {
		const { optionalPageData } = await import('../optionalPageData')

		await expect(optionalPageData('chain:ethereum:stablecoins', async () => 123, 0)).resolves.toBe(123)

		expect(recordRuntimeErrorMock).not.toHaveBeenCalled()
	})

	it('records optional page degradation and returns fallback on failure', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const error = new Error('upstream unavailable')
		const { optionalPageData } = await import('../optionalPageData')

		await expect(
			optionalPageData('chain:ethereum:stablecoins', async () => Promise.reject(error), null)
		).resolves.toBeNull()

		expect(recordRuntimeErrorMock).toHaveBeenCalledWith(error, 'pageBuild', {
			optional: true,
			label: 'chain:ethereum:stablecoins'
		})
		expect(warnSpy).toHaveBeenCalledWith('[optional-page-data] chain:ethereum:stablecoins failed: upstream unavailable')
	})
})
