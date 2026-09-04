// Raw shape returned by https://api.llama.fi/token-rights (one entry per protocol)
export interface IRawTokenRightsEntry {
	'Protocol Name': string
	Token: string[]
	'Token Type'?: string[]
	'Brief description'?: string
	Utility?: string
	'Governance Details (Summary)'?: string
	'Governance Decisions': string[]
	'Governance details'?: string
	'Governance Links'?: string
	'Treasury Decisions': string[]
	'Treasury Details'?: string
	'Revenue Decisions': string[]
	'Revenue Details'?: string
	'Fee Switch Status': string
	'Fee Switch Details'?: string
	'Economic Rights (Summary)'?: string
	Buybacks?: string[] | null
	'Buyback Details'?: string
	Dividends: string[]
	'Dividends Details'?: string
	Burns: string
	'Burn Details'?: string
	'Economic Links'?: string
	'Value Accrual'?: string
	'Value Accrual Details'?: string
	Fundraising?: string[]
	'Raise Details'?: string
	'Associated Entities'?: string[]
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
