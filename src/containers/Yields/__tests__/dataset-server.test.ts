import { afterEach, describe, expect, it, vi } from 'vitest'

const acquireDatasetSnapshot = vi.hoisted(() => vi.fn())

vi.mock('~/server/datasetSnapshots/refresh.server', () => ({ acquireDatasetSnapshot }))

import { acquireOptionalYieldsSnapshot, acquireYieldsSnapshot } from '../server/dataset.server'

describe('Yields snapshot acquisition', () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it('keeps strict acquisition for core Yields consumers', async () => {
		const handle = {
			ref: { snapshotId: 'gen-1', createdAt: 1_700_000_000_000 },
			readJson: vi.fn().mockResolvedValue('artifact')
		}
		acquireDatasetSnapshot.mockResolvedValueOnce({ handle })

		const snapshot = await acquireYieldsSnapshot('background')
		expect(snapshot.generationId).toBe('gen-1')
		expect(snapshot.generatedAt).toBe(1_700_000_000_000)
		await expect(snapshot.readJson('earn.json')).resolves.toBe('artifact')
		expect(handle.readJson).toHaveBeenCalledWith('earn.json')
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
