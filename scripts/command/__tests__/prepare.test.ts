import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createPreparationSteps, runPreparationCommand, type PreparationStep } from '../prepare'
import { CommandExitError } from '../timedStep'

describe('preparation command', () => {
	it('runs the production build on Bun and scopes the Node heap override to the Next child process', () => {
		const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: { build: string } }
		const wrapper = readFileSync('scripts/command/runPreparedNext.mjs', 'utf8')

		expect(packageJson.scripts.build).toBe('bun run --bun ./scripts/command/runPreparedNext.mjs production build')
		expect(wrapper).not.toContain('BUILD_OLD_SPACE_OPTION')
		expect(wrapper).not.toContain('--max-old-space-size=4096')
		expect(wrapper).toContain("const buildNodeOptions = process.versions.bun ? '' : '--max-heap-size=6144'")
		expect(wrapper).toContain('buildNodeOptions ? { NODE_OPTIONS: buildNodeOptions } : {}')
		expect(wrapper).toContain("path.join(repoRoot, 'scripts', 'verifyDatasetSnapshotBuild.ts')")
		expect(wrapper).toContain('isProductionBuild && nextExitCode === 0')
	})

	it('creates default preparation steps in order', () => {
		const steps = createPreparationSteps({
			env: { NODE_ENV: 'test' },
			logger: { log: vi.fn() },
			repoRoot: '/tmp/defillama-app'
		})

		expect(steps.map((step) => step.name)).toEqual([
			'Metadata cache',
			'Site navigation',
			'Dataset snapshot',
			'llms.txt',
			'robots.txt'
		])
	})

	it('runs preparation steps in order', async () => {
		const calls: string[] = []
		const steps: PreparationStep[] = [
			{
				name: 'Metadata cache',
				run: vi.fn(async () => {
					calls.push('metadata')
				})
			},
			{
				name: 'Dataset cache',
				run: vi.fn(async () => {
					calls.push('dataset')
				})
			},
			{
				name: 'robots.txt',
				run: vi.fn(async () => {
					calls.push('robots')
				})
			}
		]

		const result = await runPreparationCommand({ logger: { log: vi.fn() }, steps })

		expect(result.exitCode).toBe(0)
		expect(calls).toEqual(['metadata', 'dataset', 'robots'])
	})

	it('keeps running later preparation steps after a failure', async () => {
		const dataset = vi.fn()
		const steps: PreparationStep[] = [
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

	it('uses the requested log prefix for build preparation', async () => {
		const logger = { log: vi.fn() }

		await runPreparationCommand({
			logger,
			prefix: '[build:prepare]',
			steps: [{ name: 'Metadata cache', run: vi.fn(async () => {}) }]
		})

		expect(logger.log).toHaveBeenCalledWith('[build:prepare] Preparing local data before Next.js starts')
		expect(logger.log).toHaveBeenCalledWith('[build:prepare] Metadata cache started')
	})
})
