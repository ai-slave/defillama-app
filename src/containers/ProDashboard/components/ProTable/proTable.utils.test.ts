import { describe, expect, it } from 'vitest'
import type { IFormattedProtocol, IParentProtocol } from '~/containers/ProtocolLists/protocol-table.types'
import { formatProtocolsList } from './proTable.utils'

const formattedProtocol = (name: string, overrides: Partial<IFormattedProtocol> = {}): IFormattedProtocol => ({
	name,
	contributesTvl: true,
	tvl: 0,
	tvlPrevDay: 0,
	tvlPrevWeek: 0,
	tvlPrevMonth: 0,
	mcap: 0,
	chainTvls: {},
	change_1d: null,
	change_7d: null,
	change_1m: null,
	mcaptvl: null,
	chains: [],
	logo: null,
	url: '',
	defillamaId: name,
	...overrides
})

const parentProtocol = (id: string, name: string, overrides: Partial<IParentProtocol> = {}): IParentProtocol => ({
	id,
	name,
	url: '',
	description: '',
	logo: '',
	chains: [],
	gecko_id: '',
	cmcId: '',
	mcap: null,
	...overrides
})

describe('formatProtocolsList fee ratios', () => {
	it('uses annualized1y for P/F and P/S instead of deriving ratios from 30d totals', () => {
		const protocols = [
			{
				name: 'Annualized Protocol',
				mcap: 12_000,
				tvl: 100,
				tvlPrevDay: 90,
				tvlPrevWeek: 80,
				tvlPrevMonth: 70,
				chainTvls: {},
				change_1d: null,
				change_7d: null,
				change_1m: null,
				mcaptvl: null,
				chains: ['Base'],
				logo: null,
				url: '',
				defillamaId: 'annualized-protocol'
			}
		] as any

		const result = formatProtocolsList({
			protocols,
			parentProtocols: [],
			extraTvlsEnabled: {},
			feesData: [
				{
					name: 'Annualized Protocol',
					total30d: 3000,
					annualized1y: 60_000,
					revenue30d: 1000,
					revenueAnnualized1y: null
				}
			],
			noSubrows: true
		})

		expect(result[0]).toMatchObject({
			fees_30d: 3000,
			feesAnnualized1y: 60_000,
			pf: 0.2,
			ps: null
		})
	})

	it('keeps parent P/F null when a fee-contributing child is missing annualized1y', () => {
		const protocols = [
			{
				name: 'Child A',
				parentProtocol: 'parent#protocol',
				mcap: 600,
				tvl: 100,
				tvlPrevDay: 90,
				tvlPrevWeek: 80,
				tvlPrevMonth: 70,
				chainTvls: {},
				change_1d: null,
				change_7d: null,
				change_1m: null,
				mcaptvl: null,
				chains: ['Base'],
				logo: null,
				url: '',
				defillamaId: 'child-a'
			},
			{
				name: 'Child B',
				parentProtocol: 'parent#protocol',
				mcap: 400,
				tvl: 200,
				tvlPrevDay: 180,
				tvlPrevWeek: 160,
				tvlPrevMonth: 140,
				chainTvls: {},
				change_1d: null,
				change_7d: null,
				change_1m: null,
				mcaptvl: null,
				chains: ['Base'],
				logo: null,
				url: '',
				defillamaId: 'child-b'
			}
		] as any

		const result = formatProtocolsList({
			protocols,
			parentProtocols: [{ id: 'parent#protocol', name: 'Parent Protocol', chains: ['Base'], mcap: 1000 }] as any,
			extraTvlsEnabled: {},
			feesData: [
				{
					name: 'Child A',
					total30d: 100,
					annualized1y: 600
				},
				{
					name: 'Child B',
					total30d: 200,
					annualized1y: null
				}
			],
			noSubrows: true
		})

		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			name: 'Parent Protocol',
			fees_30d: 300,
			feesAnnualized1y: null,
			pf: null
		})
	})

	it('groups known siblings without dropping solo or unknown-parent protocols', () => {
		const result = formatProtocolsList({
			protocols: [
				formattedProtocol('Child A', { parentProtocol: 'parent#grouped', tvl: 20 }),
				formattedProtocol('Child B', { parentProtocol: 'parent#grouped', tvl: 30 }),
				formattedProtocol('Solo Child', { parentProtocol: 'parent#solo', tvl: 10 }),
				formattedProtocol('Unknown Child', { parentProtocol: 'parent#unknown', tvl: 5 })
			],
			parentProtocols: [
				parentProtocol('parent#grouped', 'Grouped Parent'),
				parentProtocol('parent#solo', 'Solo Parent')
			],
			extraTvlsEnabled: {}
		})

		expect(result.map((row) => row.name)).toEqual(['Grouped Parent', 'Solo Child', 'Unknown Child'])
		const groupedParent = result.find((row) => row.name === 'Grouped Parent')
		expect(groupedParent?.subRows?.map((row) => row.name)).toEqual(['Child A', 'Child B'])
	})

	it('keeps a measured child with an unavailable TVL strict', () => {
		const result = formatProtocolsList({
			protocols: [
				formattedProtocol('Known Child', { parentProtocol: 'parent#exact', tvl: 10 }),
				formattedProtocol('Unknown Child', { parentProtocol: 'parent#exact', tvl: null })
			],
			parentProtocols: [parentProtocol('parent#exact', 'Exact Parent', { mcap: 0 })],
			extraTvlsEnabled: {}
		})

		expect(result).toEqual([expect.objectContaining({ name: 'Exact Parent', tvl: null, mcaptvl: null })])
	})

	it('keeps no-TVL children visible without erasing measured parent TVL', () => {
		const result = formatProtocolsList({
			protocols: [
				formattedProtocol('Known Child', { parentProtocol: 'parent#exact', tvl: 10 }),
				formattedProtocol('Metadata Child', {
					parentProtocol: 'parent#exact',
					contributesTvl: false,
					deprecated: true,
					tvl: null,
					tvlPrevDay: null,
					tvlPrevWeek: null,
					tvlPrevMonth: null
				})
			],
			parentProtocols: [parentProtocol('parent#exact', 'Exact Parent', { mcap: 0 })],
			extraTvlsEnabled: {}
		})

		expect(result).toEqual([
			expect.objectContaining({
				name: 'Exact Parent',
				tvl: 10,
				subRows: expect.arrayContaining([expect.objectContaining({ name: 'Metadata Child', deprecated: true })])
			})
		])
	})

	it('keeps a grouped parent without measured TVL unavailable', () => {
		const result = formatProtocolsList({
			protocols: [
				formattedProtocol('Metadata A', {
					parentProtocol: 'parent#metadata',
					contributesTvl: false,
					tvl: null
				}),
				formattedProtocol('Metadata B', {
					parentProtocol: 'parent#metadata',
					contributesTvl: false,
					tvl: null
				})
			],
			parentProtocols: [parentProtocol('parent#metadata', 'Metadata Parent')],
			extraTvlsEnabled: {}
		})

		expect(result).toEqual([expect.objectContaining({ name: 'Metadata Parent', tvl: null })])
	})

	it('does not reconstruct unavailable legacy Pro base periods from enabled extras', () => {
		const result = formatProtocolsList({
			protocols: [
				formattedProtocol('Unknown Base', {
					tvl: null,
					tvlPrevDay: 10,
					tvlPrevWeek: 10,
					tvlPrevMonth: 10,
					mcap: 100,
					extraTvl: {
						staking: { tvl: 25, tvlPrevDay: null, tvlPrevWeek: 5, tvlPrevMonth: 5 }
					}
				})
			],
			parentProtocols: [],
			extraTvlsEnabled: { staking: true },
			noSubrows: true
		})

		expect(result).toEqual([
			expect.objectContaining({ tvl: null, tvlPrevDay: null, tvlPrevWeek: 15, tvlPrevMonth: 15, mcaptvl: null })
		])
	})
})
