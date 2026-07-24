export interface RaisesApiItem {
	date: number
	name: string
	round: string
	/** USD millions. Normalize before using in app code. */
	amount: number | null
	chains: string[]
	sector: string
	category: string
	categoryGroup: string
	leadInvestors: string[]
	otherInvestors: string[]
	/** USD millions. Normalize before using in app code. */
	valuation: number | string | null
	source?: string
	defillamaId?: string
}

export interface RaisesApiResponse {
	raises: RaisesApiItem[]
}
