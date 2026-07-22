import { describe, expect, it } from 'vitest'
import type { TvlSettingsKey } from '~/contexts/LocalStorage'
import { prepareProtocolsForTable } from '../prepareProtocolsForTable'
import type { IChildProtocol, IProtocol, ProtocolRankingTvlEntry, TVL_TYPES } from '../types'

const entry = (tvl: number): ProtocolRankingTvlEntry => ({
	tvl,
	tvlPrevDay: tvl,
	tvlPrevWeek: tvl,
	tvlPrevMonth: tvl
})

const tvl = (base: number): Record<TVL_TYPES, ProtocolRankingTvlEntry> => ({
	default: entry(base),
	borrowed: entry(0),
	doublecounted: entry(0),
	excludeParent: entry(25),
	govtokens: entry(0),
	liquidstaking: entry(0),
	pool2: entry(0),
	staking: entry(10),
	vesting: entry(0)
})

const child = (name: string): IChildProtocol => ({
	name,
	slug: name.toLowerCase(),
	category: 'Lending',
	tvl: tvl(50),
	tvlChange: null,
	chains: ['Ethereum'],
	mcap: null,
	tokenPrice: null,
	mcaptvl: null,
	strikeTvl: true
})

const settings: Record<TvlSettingsKey, boolean> = {
	borrowed: false,
	doublecounted: false,
	govtokens: false,
	liquidstaking: false,
	pool2: false,
	staking: true,
	vesting: false
}

describe('prepareProtocolsForTable', () => {
	it('applies scoped TVL settings once and suppresses only strike presentation', () => {
		const protocol: IProtocol = {
			...child('Parent'),
			tvl: tvl(100),
			childProtocols: [child('Child')]
		}
		const parentExclude = protocol.tvl?.excludeParent
		const childExclude = protocol.childProtocols?.[0].tvl?.excludeParent

		const [prepared] = prepareProtocolsForTable({
			protocols: [protocol],
			extraTvlsEnabled: settings,
			minTvl: null,
			maxTvl: null,
			suppressTvlStrike: true
		})

		expect(prepared.tvl?.default.tvl).toBe(110)
		expect(prepared.childProtocols?.[0].tvl?.default.tvl).toBe(60)
		expect(prepared.strikeTvl).toBe(false)
		expect(prepared.childProtocols?.[0].strikeTvl).toBe(false)
		expect(prepared.tvl?.excludeParent).toBe(parentExclude)
		expect(prepared.childProtocols?.[0].tvl?.excludeParent).toBe(childExclude)
	})
})
