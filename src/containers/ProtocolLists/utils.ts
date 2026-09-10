import type { IProtocol } from '~/containers/ProtocolRankings/types'
import { getPercentChange } from '~/utils'
import { isProtocolListTvlKey, type ProtocolListAdditiveTvlKey, type ProtocolLiteTvlEntry } from './api.types'
import type { IRecentProtocol } from './types'

interface TvlEntry {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

type TvlEntryKey = keyof TvlEntry
type MutableTvlEntry = Record<TvlEntryKey, number | null>

const TVL_ENTRY_KEYS: Array<TvlEntryKey> = ['tvl', 'tvlPrevDay', 'tvlPrevWeek', 'tvlPrevMonth']
const UNAVAILABLE_TVL_ENTRY: ProtocolLiteTvlEntry = {
	tvl: null,
	tvlPrevDay: null,
	tvlPrevWeek: null,
	tvlPrevMonth: null
}

function getMcapTvl(mcap: number | null, tvl: number | null | undefined): number | null {
	if (mcap == null || tvl == null || tvl <= 0) return null

	// This is derived arithmetic: numeric API fields can still produce non-finite ratios.
	const ratio = mcap / tvl
	return Number.isFinite(ratio) ? ratio : null
}

function isAdditiveTvlKey(tvlKey: string, extraTvlsEnabled: Record<string, boolean>) {
	return !!extraTvlsEnabled[tvlKey] && isProtocolListTvlKey(tvlKey)
}

function addExactTvlEntry(base: MutableTvlEntry, incoming: TvlEntry): void {
	for (const field of TVL_ENTRY_KEYS) {
		const baseValue = base[field]
		const incomingValue = incoming[field]
		base[field] = baseValue == null || incomingValue == null ? null : baseValue + incomingValue
	}
}

function addEnabledExtraTvls({
	base,
	tvlRecord,
	extraTvlsEnabled
}: {
	base: MutableTvlEntry
	tvlRecord: Record<string, TvlEntry | undefined>
	extraTvlsEnabled: Record<string, boolean>
}) {
	for (const tvlKey in tvlRecord) {
		if (!isAdditiveTvlKey(tvlKey, extraTvlsEnabled)) continue

		const entry = tvlRecord[tvlKey]
		if (!entry) continue

		addExactTvlEntry(base, entry)
	}

	return base
}

function mergeSelectedChainEntry(
	current: ProtocolLiteTvlEntry | undefined,
	incoming: ProtocolLiteTvlEntry
): ProtocolLiteTvlEntry {
	if (!current) return { ...incoming }
	return {
		tvl: current.tvl == null || incoming.tvl == null ? null : current.tvl + incoming.tvl,
		tvlPrevDay:
			current.tvlPrevDay == null || incoming.tvlPrevDay == null ? null : current.tvlPrevDay + incoming.tvlPrevDay,
		tvlPrevWeek:
			current.tvlPrevWeek == null || incoming.tvlPrevWeek == null ? null : current.tvlPrevWeek + incoming.tvlPrevWeek,
		tvlPrevMonth:
			current.tvlPrevMonth == null || incoming.tvlPrevMonth == null
				? null
				: current.tvlPrevMonth + incoming.tvlPrevMonth
	}
}

export function scopeRecentProtocolToChains({
	protocol,
	selectedChains
}: {
	protocol: IRecentProtocol
	selectedChains: ReadonlySet<string>
}): IRecentProtocol {
	let base: ProtocolLiteTvlEntry | undefined
	const extraTvl: Partial<Record<ProtocolListAdditiveTvlKey, ProtocolLiteTvlEntry>> = {}

	for (const chainName of protocol.chains) {
		if (!selectedChains.has(chainName.toLowerCase())) continue
		let hasBaseEntry = false

		for (const sectionName in protocol.chainTvls) {
			const entry = protocol.chainTvls[sectionName]
			if (!entry) continue
			if (sectionName.toLowerCase() === chainName.toLowerCase()) {
				hasBaseEntry = true
				base = mergeSelectedChainEntry(base, entry)
				continue
			}

			const chainPrefix = `${chainName}-`
			if (!sectionName.startsWith(chainPrefix)) continue
			const sectionNameWithoutChain = sectionName.slice(chainPrefix.length)
			if (!isProtocolListTvlKey(sectionNameWithoutChain)) continue
			extraTvl[sectionNameWithoutChain] = mergeSelectedChainEntry(extraTvl[sectionNameWithoutChain], entry)
		}

		if (!hasBaseEntry) base = mergeSelectedChainEntry(base, UNAVAILABLE_TVL_ENTRY)
	}

	return {
		...protocol,
		tvl: base?.tvl ?? null,
		tvlPrevDay: base?.tvlPrevDay ?? null,
		tvlPrevWeek: base?.tvlPrevWeek ?? null,
		tvlPrevMonth: base?.tvlPrevMonth ?? null,
		extraTvl
	}
}

/**
 * Apply extraTvl toggles (staking, pool2, borrowed, etc.) to protocol TVL values.
 * `extraTvlsEnabled` comes from `useLocalStorageSettingsManager('tvl')`.
 */
export function applyExtraTvl(
	protocols: ReadonlyArray<IRecentProtocol>,
	extraTvlsEnabled: Record<string, boolean>
): Array<
	IRecentProtocol & {
		change_1d: number | null
		change_7d: number | null
		change_1m: number | null
		mcaptvl: number | null
	}
> {
	return protocols.map((protocol) => {
		const tvlEntry = addEnabledExtraTvls({
			base: {
				tvl: protocol.tvl,
				tvlPrevDay: protocol.tvlPrevDay ?? null,
				tvlPrevWeek: protocol.tvlPrevWeek ?? null,
				tvlPrevMonth: protocol.tvlPrevMonth ?? null
			},
			tvlRecord: protocol.extraTvl,
			extraTvlsEnabled
		})

		let finalTvl = tvlEntry.tvl
		let finalTvlPrevDay = tvlEntry.tvlPrevDay
		let finalTvlPrevWeek = tvlEntry.tvlPrevWeek
		let finalTvlPrevMonth = tvlEntry.tvlPrevMonth

		// Clamp negative values to 0
		if (finalTvl != null && finalTvl < 0) finalTvl = 0
		if (finalTvlPrevDay != null && finalTvlPrevDay < 0) finalTvlPrevDay = 0
		if (finalTvlPrevWeek != null && finalTvlPrevWeek < 0) finalTvlPrevWeek = 0
		if (finalTvlPrevMonth != null && finalTvlPrevMonth < 0) finalTvlPrevMonth = 0

		const mcaptvl = getMcapTvl(protocol.mcap ?? null, finalTvl)

		return {
			...protocol,
			tvl: finalTvl,
			tvlPrevDay: finalTvlPrevDay,
			tvlPrevWeek: finalTvlPrevWeek,
			tvlPrevMonth: finalTvlPrevMonth,
			change_1d: getPercentChange(finalTvl, finalTvlPrevDay),
			change_7d: getPercentChange(finalTvl, finalTvlPrevWeek),
			change_1m: getPercentChange(finalTvl, finalTvlPrevMonth),
			mcaptvl
		}
	})
}

export const applyProtocolTvlSettings = ({
	protocols,
	extraTvlsEnabled,
	minTvl,
	maxTvl
}: {
	protocols: Array<IProtocol>
	extraTvlsEnabled: Record<string, boolean>
	minTvl: number | null
	maxTvl: number | null
}): Array<IProtocol> => {
	const nullTvlEntry: MutableTvlEntry = { tvl: null, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null }
	// Use for..in loop instead of Object.values() for better performance
	let shouldModifyTvl = minTvl !== null || maxTvl !== null
	if (!shouldModifyTvl) {
		for (const key in extraTvlsEnabled) {
			if (extraTvlsEnabled[key] && isProtocolListTvlKey(key)) {
				shouldModifyTvl = true
				break
			}
		}
	}

	if (!shouldModifyTvl) return protocols

	const final: Array<IProtocol> = []
	const passesTvlBounds = (tvl: number | null): boolean => {
		if (minTvl === null && maxTvl === null) return true
		if (tvl === null) return false
		return (minTvl === null || tvl >= minTvl) && (maxTvl === null || tvl <= maxTvl)
	}
	for (const protocol of protocols) {
		if (protocol.tvl == null) {
			if (minTvl === null && maxTvl === null) {
				final.push({ ...protocol })
			}
		} else {
			const strikeTvl = protocol.strikeTvl ?? false
			const defaultTvl: MutableTvlEntry = { ...protocol.tvl.default }

			addEnabledExtraTvls({ base: defaultTvl, tvlRecord: protocol.tvl, extraTvlsEnabled })

			const tvlChange = {
				change1d: getPercentChange(defaultTvl.tvl, defaultTvl.tvlPrevDay),
				change7d: getPercentChange(defaultTvl.tvl, defaultTvl.tvlPrevWeek),
				change1m: getPercentChange(defaultTvl.tvl, defaultTvl.tvlPrevMonth)
			}

			const mcaptvl = getMcapTvl(protocol.mcap, defaultTvl.tvl)

			if (protocol.childProtocols) {
				const childProtocols: IProtocol['childProtocols'] = []
				for (const child of protocol.childProtocols) {
					const childStrikeTvl = child.strikeTvl ?? false
					const childDefaultTvl: MutableTvlEntry = { ...(child.tvl?.default ?? nullTvlEntry) }

					if (child.tvl) {
						addEnabledExtraTvls({ base: childDefaultTvl, tvlRecord: child.tvl, extraTvlsEnabled })
					}

					const childTvlChange = {
						change1d: getPercentChange(childDefaultTvl.tvl, childDefaultTvl.tvlPrevDay),
						change7d: getPercentChange(childDefaultTvl.tvl, childDefaultTvl.tvlPrevWeek),
						change1m: getPercentChange(childDefaultTvl.tvl, childDefaultTvl.tvlPrevMonth)
					}

					const childMcapTvl = getMcapTvl(child.mcap, childDefaultTvl.tvl)

					if (passesTvlBounds(childDefaultTvl.tvl)) {
						childProtocols.push({
							...child,
							strikeTvl: childStrikeTvl,
							tvl: child.tvl == null ? null : { ...child.tvl, default: childDefaultTvl },
							tvlChange: childTvlChange,
							mcaptvl: childMcapTvl
						})
					}
				}
				if (passesTvlBounds(defaultTvl.tvl)) {
					final.push({
						...protocol,
						strikeTvl,
						tvl: { ...protocol.tvl, default: defaultTvl },
						childProtocols,
						tvlChange,
						mcaptvl
					})
				}
			} else if (passesTvlBounds(defaultTvl.tvl)) {
				final.push({
					...protocol,
					strikeTvl,
					tvl: { ...protocol.tvl, default: defaultTvl },
					tvlChange,
					mcaptvl
				})
			}
		}
	}

	return final
}
