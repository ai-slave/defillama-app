export const MAX_VISIBLE_CHAINS = 30

export function boundBridgeChainSelection(current: string[], values: string[]): string[] {
	if (values.length <= MAX_VISIBLE_CHAINS) return values
	const addedValues = values.filter((value) => !current.includes(value))
	if (addedValues.length === 1) {
		const added = addedValues[0]
		return [...values.filter((value) => value !== added).slice(0, MAX_VISIBLE_CHAINS - 1), added]
	}
	return values.slice(0, MAX_VISIBLE_CHAINS)
}
