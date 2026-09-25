import { afterEach, describe, expect, test, vi } from 'vitest'
import { installTelemetrySink } from '~/utils/testing/telemetry'

const telemetry = installTelemetrySink()

describe('optionalPageData', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('records a degradation and returns the fallback only when the loader fails', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const error = new Error('upstream unavailable')
		const { optionalPageData } = await import('../optionalPageData')

		await expect(optionalPageData('chain:ethereum:stablecoins', async () => 123, 0)).resolves.toBe(123)
		expect(await telemetry.events()).toEqual([])

		await expect(
			optionalPageData('chain:ethereum:stablecoins', async () => Promise.reject(error), null)
		).resolves.toBeNull()

		expect(await telemetry.events()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'runtime_error',
					phase: 'pageBuild',
					error_message: 'upstream unavailable',
					attributes: expect.objectContaining({
						optional: true,
						label: 'chain:ethereum:stablecoins'
					})
				})
			])
		)
		expect(warnSpy).toHaveBeenCalledWith('[optional-page-data] chain:ethereum:stablecoins failed: upstream unavailable')
	})
})
