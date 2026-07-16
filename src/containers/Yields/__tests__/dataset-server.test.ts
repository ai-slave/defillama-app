import { afterEach, describe, expect, it, vi } from 'vitest'

const acquireDatasetSnapshot = vi.hoisted(() => vi.fn())

vi.mock('~/server/datasetSnapshots/refresh.server', () => ({ acquireDatasetSnapshot }))

import { acquireOptionalYieldsSnapshot, acquireYieldsSnapshot } from '../server/dataset.server'

describe('Yields snapshot acquisition', () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it('keeps strict acquisition for core Yields consumers', async () => {
		const handle = { readJson: vi.fn() }
		acquireDatasetSnapshot.mockResolvedValueOnce({ handle })

		await expect(acquireYieldsSnapshot('background')).resolves.toBe(handle)
		expect(acquireDatasetSnapshot).toHaveBeenCalledWith('yields', 'background')
	})

	it('returns null when an optional consumer cannot acquire Yields', async () => {
		const error = new Error('snapshot unavailable')
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		acquireDatasetSnapshot.mockRejectedValueOnce(error)

		await expect(acquireOptionalYieldsSnapshot()).resolves.toBeNull()
		expect(acquireDatasetSnapshot).toHaveBeenCalledWith('yields', 'blocking')
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to acquire optional Yields snapshot', error)

		consoleErrorSpy.mockRestore()
	})
})
