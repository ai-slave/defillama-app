import { describe, expect, test, vi } from 'vitest'
import { runPreparationCommand, type PreparationStep } from '../prepare'
import { CommandExitError } from '../timedStep'

describe('preparation command', () => {
	test('keeps running later preparation steps after a failure', async () => {
		const dataset = vi.fn()
		const steps: Array<PreparationStep> = [
			{
				name: 'Metadata cache',
				async run() {
					throw new CommandExitError(9, 'metadata failed')
				}
			},
			{ name: 'Dataset cache', run: dataset }
		]

		const result = await runPreparationCommand({ logger: { log: vi.fn() }, steps })

		expect(result.exitCode).toBe(9)
		expect(dataset).toHaveBeenCalledTimes(1)
	})
})
