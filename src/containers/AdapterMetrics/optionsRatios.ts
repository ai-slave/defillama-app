import type { IProtocol } from './types'

export type OptionsRatioKey = 'notionalToPremium' | 'openInterestToPremium'

const OPTIONS_RATIO_KEYS: ReadonlyArray<OptionsRatioKey> = ['notionalToPremium', 'openInterestToPremium']

// A ratio this many times the median across the page's exchanges gets a warning. With one or two
// exchanges nothing can pass it, since neither value can exceed 3x their median.
export const HIGH_RATIO_MULTIPLE = 3

/** Options ratios divide by premium volume; a zero or missing premium leaves them blank. */
export const getRatio = (value: number | null | undefined, premium: number | null | undefined) =>
	value != null && premium ? value / premium : null

function getRatios(protocol: IProtocol): Record<OptionsRatioKey, number | null> {
	return {
		notionalToPremium: getRatio(protocol.notionalVolume24h, protocol.total24h),
		openInterestToPremium: getRatio(protocol.openInterest, protocol.total24h)
	}
}

function median(values: Array<number>) {
	const sorted = values.toSorted((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	const upper = sorted[middle] ?? 0
	return sorted.length % 2 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2
}

/** Adds notional/premium and OI/premium to each row, flagging ratios far above the page's median exchange. */
export function withOptionsRatios(protocols: ReadonlyArray<IProtocol>): Array<IProtocol> {
	const medians: Partial<Record<OptionsRatioKey, number>> = {}
	for (const key of OPTIONS_RATIO_KEYS) {
		const values = protocols.map((protocol) => getRatios(protocol)[key]).filter((value) => value != null)
		if (values.length > 0) medians[key] = median(values)
	}

	const addRatios = (protocol: IProtocol): IProtocol => {
		const ratios = getRatios(protocol)
		const highRatioMedians: Partial<Record<OptionsRatioKey, number>> = {}
		for (const key of OPTIONS_RATIO_KEYS) {
			const value = ratios[key]
			const medianValue = medians[key]
			if (value != null && medianValue != null && value > medianValue * HIGH_RATIO_MULTIPLE) {
				highRatioMedians[key] = medianValue
			}
		}
		return {
			...protocol,
			...ratios,
			...(Object.keys(highRatioMedians).length > 0 ? { highRatioMedians } : {}),
			...(protocol.childProtocols ? { childProtocols: protocol.childProtocols.map(addRatios) } : {})
		}
	}
	return protocols.map(addRatios)
}
