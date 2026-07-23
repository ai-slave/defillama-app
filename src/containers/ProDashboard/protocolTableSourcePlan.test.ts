import { describe, expect, it } from 'vitest'
import { resolveProtocolTableSourcePlan } from './protocolTableSourcePlan'

const enabledSources = (input: Parameters<typeof resolveProtocolTableSourcePlan>[0]) =>
	resolveProtocolTableSourcePlan(input).sources

describe('resolveProtocolTableSourcePlan', () => {
	it('uses only the protocols source for a minimal Essential table', () => {
		expect(enabledSources({})).toEqual(['protocols'])
	})

	it('resolves metric-heavy presets and their sorting dependency', () => {
		expect(enabledSources({ activePresetId: 'advanced' })).toEqual(['protocols', 'volume', 'fees'])
		expect(enabledSources({ activePresetId: 'open-interest' })).toEqual(['protocols', 'perps', 'openInterest'])
	})

	it('uses saved visibility instead of loading every saved column-order entry', () => {
		expect(
			enabledSources({
				columnOrder: ['name', 'fees_24h', 'options_volume_24h'],
				columnVisibility: { name: true, fees_24h: true, options_volume_24h: false },
				activePresetId: 'options'
			})
		).toEqual(['protocols', 'fees'])
	})

	it('adds sorting, active dataset, filter, and visible custom-expression dependencies', () => {
		expect(
			enabledSources({
				columnOrder: ['name', 'custom-margin'],
				columnVisibility: { name: true, 'custom-margin': true },
				customColumns: [
					{
						id: 'custom-margin',
						expression: '(revenue_24h - fees_24h) / volume_24h',
						isValid: true
					}
				],
				sorting: [{ id: 'openInterest', desc: true }],
				activeDatasetMetric: 'earnings_24h',
				filters: { hasOptions: true, aggregatorsVolume24hMin: 1 }
			})
		).toEqual(['protocols', 'volume', 'fees', 'openInterest', 'earnings', 'aggregators', 'options'])
	})

	it('does not load dependencies for hidden or invalid custom columns', () => {
		expect(
			enabledSources({
				columnOrder: ['name', 'custom-hidden'],
				columnVisibility: { name: true, 'custom-hidden': false },
				customColumns: [
					{ id: 'custom-hidden', expression: 'options_volume_24h', isValid: true },
					{ id: 'custom-invalid', expression: 'fees_24h', isValid: false }
				]
			})
		).toEqual(['protocols'])
	})

	it('loads hidden custom-column dependencies when that column remains the active sort', () => {
		expect(
			enabledSources({
				columnOrder: ['name', 'custom-sorted'],
				columnVisibility: { name: true, 'custom-sorted': false },
				customColumns: [{ id: 'custom-sorted', expression: 'options_volume_24h / fees_24h', isValid: true }],
				sorting: [{ id: 'custom-sorted', desc: true }],
				filters: { hasMcapTVLRatio: true, pfRatioMin: 1 }
			})
		).toEqual(['protocols', 'fees', 'options'])
	})
})
