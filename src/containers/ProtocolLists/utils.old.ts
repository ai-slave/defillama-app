import { getPercentChange, keepNeededProperties } from '~/utils'
import { isProtocolListTvlKey, type ProtocolLite, type ProtocolsResponse } from './api.types'
import type { IFormattedProtocol } from './protocol-table.types'

interface IFormatProtocolsData {
	chain?: string
	fork?: string
	category?: string
	protocols: ProtocolLite[]
	removeBridges?: boolean
}

function createFormattedProtocol(protocol: ProtocolLite): IFormattedProtocol {
	return {
		name: protocol.name,
		symbol: protocol.symbol,
		logo: protocol.logo,
		url: protocol.url,
		category: protocol.category,
		chains: protocol.chains,
		contributesTvl: protocol.tvl !== null && !protocol.deprecated,
		chainTvls: protocol.chainTvls,
		tvl: protocol.tvl,
		tvlPrevDay: protocol.tvlPrevDay,
		tvlPrevWeek: protocol.tvlPrevWeek,
		tvlPrevMonth: protocol.tvlPrevMonth,
		mcap: protocol.mcap,
		defillamaId: protocol.defillamaId,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		mcaptvl: null,
		extraTvl: {},
		...(protocol.parentProtocol === undefined ? {} : { parentProtocol: protocol.parentProtocol }),
		...(protocol.deprecated === undefined ? {} : { deprecated: protocol.deprecated })
	}
}

export const formatProtocolsData = ({
	chain,
	fork,
	category,
	protocols,
	removeBridges = false
}: IFormatProtocolsData) => {
	const data: IFormattedProtocol[] = []

	for (const protocol of protocols) {
		let toFilter = true

		if (removeBridges) {
			toFilter = toFilter && protocol.category !== 'Bridge'
		}

		if (chain) {
			toFilter = toFilter && protocol.chains.includes(chain)
		}

		if (fork) {
			toFilter = toFilter && (protocol.forkedFrom?.includes(fork) ?? false)
		}

		if (category) {
			toFilter = toFilter && category.toLowerCase() === protocol.category.toLowerCase()
		}

		if (!toFilter) continue

		const p = createFormattedProtocol(protocol)
		if (protocol.deprecated) {
			p.tvl = null
			p.tvlPrevDay = null
			p.tvlPrevWeek = null
			p.tvlPrevMonth = null
			data.push(p)
			continue
		}

		if (chain) {
			const chainTvl = protocol.chainTvls[chain]
			p.tvl = chainTvl?.tvl ?? null
			p.tvlPrevDay = chainTvl?.tvlPrevDay ?? null
			p.tvlPrevWeek = chainTvl?.tvlPrevWeek ?? null
			p.tvlPrevMonth = chainTvl?.tvlPrevMonth ?? null
		}

		const extraTvl: NonNullable<IFormattedProtocol['extraTvl']> = {}
		p.extraTvl = extraTvl
		for (const sectionName in protocol.chainTvls) {
			const sectionTvl = protocol.chainTvls[sectionName]
			if (sectionTvl === undefined) continue

			if (chain) {
				if (sectionName.startsWith(`${chain}-`)) {
					const extraTvlKey = sectionName.slice(chain.length + 1)
					if (isProtocolListTvlKey(extraTvlKey) || extraTvlKey === 'excludeParent') {
						extraTvl[extraTvlKey] = sectionTvl
					}
				}
			} else if (isProtocolListTvlKey(sectionName) || sectionName === 'excludeParent') {
				extraTvl[sectionName] = sectionTvl
			}
		}

		p.change_1d = getPercentChange(p.tvl, p.tvlPrevDay)
		p.change_7d = getPercentChange(p.tvl, p.tvlPrevWeek)
		p.change_1m = getPercentChange(p.tvl, p.tvlPrevMonth)
		if (protocol.mcap != null && p.tvl != null && p.tvl > 0) {
			const ratio = protocol.mcap / p.tvl
			p.mcaptvl = Number.isFinite(ratio) ? ratio : null
		} else {
			p.mcaptvl = null
		}

		data.push(p)
	}

	return data.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
}

export const basicProtocolPropertiesToKeepV1List =
	<K extends keyof ProtocolLite>(propsToKeep: readonly K[]) =>
	({ protocols, chains, parentProtocols }: ProtocolsResponse) => ({
		protocols: protocols.map((protocol) => keepNeededProperties(protocol, propsToKeep)),
		chains,
		parentProtocols
	})
