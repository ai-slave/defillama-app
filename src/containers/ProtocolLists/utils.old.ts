import { TVL_SETTINGS_KEYS_SET } from '~/contexts/LocalStorage'
import { getPercentChange, keepNeededProperties } from '~/utils'
import type { ProtocolLite, ProtocolsResponse } from './api.types'
import type { IFormattedProtocol } from './protocol-table.types'

interface IFormatProtocolsData {
	chain?: string
	oracle?: string
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
		...(protocol.oracles === undefined ? {} : { oracles: protocol.oracles }),
		...(protocol.oraclesByChain === undefined ? {} : { oraclesByChain: protocol.oraclesByChain }),
		...(protocol.deprecated === undefined ? {} : { deprecated: protocol.deprecated })
	}
}

export const formatProtocolsData = ({
	chain,
	oracle,
	fork,
	category,
	protocols = [],
	removeBridges = false
}: IFormatProtocolsData) => {
	const data: IFormattedProtocol[] = []

	for (const protocol of protocols) {
		let toFilter = true

		if (removeBridges) {
			toFilter = toFilter && protocol?.category !== 'Bridge'
		}

		if (chain) {
			toFilter = toFilter && (protocol.chains?.includes(chain) ?? false)
		}

		if (oracle) {
			if (protocol.oraclesByChain) {
				toFilter =
					toFilter &&
					(chain
						? (protocol.oraclesByChain[chain]?.includes(oracle) ?? false)
						: Object.values(protocol.oraclesByChain).flat().includes(oracle))
			} else if (protocol.oracles) {
				toFilter = toFilter && protocol.oracles.includes(oracle)
			} else {
				toFilter = false
			}
		}

		if (fork) {
			toFilter = toFilter && (protocol.forkedFrom?.includes(fork) ?? false)
		}

		if (category) {
			toFilter = toFilter && category.toLowerCase() === (protocol.category?.toLowerCase() ?? '')
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
			p.tvl = protocol.chainTvls[chain]?.tvl ?? 0
			p.tvlPrevDay = protocol.chainTvls[chain]?.tvlPrevDay ?? null
			p.tvlPrevWeek = protocol.chainTvls[chain]?.tvlPrevWeek ?? null
			p.tvlPrevMonth = protocol.chainTvls[chain]?.tvlPrevMonth ?? null
		} else if (oracle && protocol.oraclesByChain) {
			p.tvl = 0
			p.tvlPrevDay = 0
			p.tvlPrevWeek = 0
			p.tvlPrevMonth = 0

			for (const oracleChain in protocol.oraclesByChain) {
				if (protocol.oraclesByChain[oracleChain]?.includes(oracle)) {
					p.tvl += protocol.chainTvls[oracleChain]?.tvl ?? 0
					p.tvlPrevDay += protocol.chainTvls[oracleChain]?.tvlPrevDay ?? 0
					p.tvlPrevWeek += protocol.chainTvls[oracleChain]?.tvlPrevWeek ?? 0
					p.tvlPrevMonth += protocol.chainTvls[oracleChain]?.tvlPrevMonth ?? 0
				}
			}
		}

		const extraTvl: NonNullable<IFormattedProtocol['extraTvl']> = {}
		p.extraTvl = extraTvl
		const filteredChains: string[] = []
		if (oracle && protocol.oraclesByChain) {
			for (const chainName in protocol.oraclesByChain) {
				if (protocol.oraclesByChain[chainName]?.includes(oracle)) {
					filteredChains.push(chainName)
				}
			}
			p.chains = filteredChains
		}

		for (const sectionName in protocol.chainTvls) {
			const sectionTvl = protocol.chainTvls[sectionName]
			if (sectionTvl === undefined) continue

			if (chain) {
				if (sectionName.startsWith(`${chain}-`)) {
					const extraTvlKey = sectionName.slice(chain.length + 1)
					if (extraTvlKey) extraTvl[extraTvlKey] = sectionTvl
				}
			} else if (oracle && protocol.oraclesByChain) {
				const separatorIndex = sectionName.indexOf('-')
				if (separatorIndex <= 0) continue
				const chainKey = sectionName.slice(0, separatorIndex)
				const extraTvlKey = sectionName.slice(separatorIndex + 1)
				if (!extraTvlKey || !protocol.oraclesByChain[chainKey]?.includes(oracle)) continue

				const aggregate = extraTvl[extraTvlKey] ?? {
					tvl: 0,
					tvlPrevDay: 0,
					tvlPrevWeek: 0,
					tvlPrevMonth: 0
				}
				aggregate.tvl += sectionTvl.tvl
				aggregate.tvlPrevDay = (aggregate.tvlPrevDay ?? 0) + (sectionTvl.tvlPrevDay ?? 0)
				aggregate.tvlPrevWeek = (aggregate.tvlPrevWeek ?? 0) + (sectionTvl.tvlPrevWeek ?? 0)
				aggregate.tvlPrevMonth = (aggregate.tvlPrevMonth ?? 0) + (sectionTvl.tvlPrevMonth ?? 0)
				extraTvl[extraTvlKey] = aggregate
			} else if (TVL_SETTINGS_KEYS_SET.has(sectionName) || sectionName === 'excludeParent') {
				extraTvl[sectionName] = sectionTvl
			}
		}

		p.change_1d = getPercentChange(p.tvl, p.tvlPrevDay)
		p.change_7d = getPercentChange(p.tvl, p.tvlPrevWeek)
		p.change_1m = getPercentChange(p.tvl, p.tvlPrevMonth)
		p.mcaptvl = protocol.mcap != null && p.tvl != null ? protocol.mcap / p.tvl : null

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
