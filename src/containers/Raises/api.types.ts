export interface RaisesApiItem {
	date: number
	name: string
	round: string | null
	/** USD millions. Normalize before using in app code. */
	amount: number | null
	chains: Array<string>
	sector: string | null
	category: string | null
	categoryGroup: string | null
	leadInvestors: Array<string>
	otherInvestors: Array<string>
	/** Freeform Airtable text in USD millions; nonnumeric text remains undisclosed. */
	valuation: string | null
	source: string
	defillamaId?: string
}

export interface RaisesApiResponse {
	raises: Array<RaisesApiItem>
}
