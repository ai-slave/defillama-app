import { describe, expect, test, vi } from 'vitest'
import { installTelemetrySink } from '~/utils/test/telemetry'
import { getTopProtocolsByFeesChart, runChainOverviewPhase } from '../queries.server'

const telemetry = installTelemetrySink()

describe('chain overview phases', () => {
	test('records a failing optional section and falls back', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		await expect(
			runChainOverviewPhase({
				chainName: 'Ethereum',
				phaseTimer: undefined,
				label: 'stablecoins',
				run: () => Promise.reject(new Error('stablecoins unavailable')),
				options: { fallback: null }
			})
		).resolves.toBeNull()

		const event = (await telemetry.events()).find((item) => item.type === 'runtime_error')
		expect(event).toMatchObject({
			phase: 'pageBuild',
			attributes: { optional: true, label: 'chain:Ethereum:stablecoins' }
		})
	})

	test('fails the page when a required section fails', async () => {
		await expect(
			runChainOverviewPhase({
				chainName: 'Ethereum',
				phaseTimer: undefined,
				label: 'protocols_by_chain',
				run: () => Promise.reject(new Error('protocols unavailable')),
				options: undefined
			})
		).rejects.toThrow('protocols unavailable')
	})
})

describe('top protocols by fees chart', () => {
	test('keeps the 14 highest positive 24h fee protocols in descending order', () => {
		const protocols = Array.from({ length: 16 }, (_, index) => ({
			name: `Protocol ${index + 1}`,
			fees: { total24h: index + 1 }
		}))
		protocols.push({ name: 'Zero Protocol', fees: { total24h: 0 } })

		expect(getTopProtocolsByFeesChart(protocols, [{}])?.map(([name, total24h]) => [name, total24h])).toEqual(
			Array.from({ length: 14 }, (_, index) => [`Protocol ${16 - index}`, 16 - index])
		)
	})

	test('has no chart when the chain reports no fee protocols or no positive fees', () => {
		expect(getTopProtocolsByFeesChart([{ name: 'A', fees: { total24h: 5 } }], [])).toBeNull()
		expect(getTopProtocolsByFeesChart([{ name: 'A', fees: { total24h: 0 } }], [{}])).toBeNull()
	})
})
