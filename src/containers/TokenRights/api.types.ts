// Raw shape returned by https://api.llama.fi/token-rights (one entry per protocol)
export interface IRawTokenRightsEntry {
	'Protocol Name': string
	Token: Array<string>
	'Token Type'?: Array<string>
	'Brief description'?: string
	Utility?: string
	'Governance Details (Summary)'?: string
	'Governance Decisions': Array<string>
	'Governance details'?: string
	'Governance Links'?: string
	'Treasury Decisions': Array<string>
	'Treasury Details'?: string
	'Revenue Decisions': Array<string>
	'Revenue Details'?: string
	'Fee Switch Status': string
	'Fee Switch Details'?: string
	'Economic Rights (Summary)'?: string
	Buybacks?: Array<string> | null
	'Buyback Details'?: string
	Dividends: Array<string>
	'Dividends Details'?: string
	Burns: string
	'Burn Details'?: string
	'Economic Links'?: string
	'Value Accrual'?: string
	'Value Accrual Details'?: string
	Fundraising?: Array<string>
	'Raise Details'?: string
	'Associated Entities'?: Array<string>
	'Equity Revenue Capture'?: string
	'Equity Statement'?: string
	'Ownership Links'?: string
	'IP & Brand'?: string
	Domain?: string
	'Foundation Multisigs / Addresses'?: string
	'Latest Treasury / Token Report'?: string
	'Last Updated'?: string
	'DefiLlama ID': string
}
