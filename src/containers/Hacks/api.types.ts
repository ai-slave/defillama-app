export interface IHackApiItem {
	date: number | null
	name: string
	classification: string | null
	technique: string | null
	/** Whole USD, not millions of USD. */
	amount: number | null
	chain: Array<string> | null
	bridgeHack: boolean
	targetType: string | null
	/** Whole USD, not millions of USD. */
	returnedFunds: number | null
	defillamaId: string | null
	language: string | null
	source: string
	parentProtocolId?: string
}
