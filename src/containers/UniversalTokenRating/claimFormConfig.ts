export type ClaimFieldType = 'text' | 'percent' | 'select' | 'months' | 'url'

export type ClaimColumn = {
	key: string
	label: string
	type: ClaimFieldType
	options?: readonly string[]
	placeholder?: string
}

export type ClaimTableSection = {
	id: string
	title: string
	description?: string
	columns: ClaimColumn[]
	initialRows: Record<string, string>[]
}

export type ClaimBlock = {
	id: string
	title: string
	sections: ClaimTableSection[]
	extras?: { mmMonitoringQuestion?: boolean }
}

export const GROUP_CATEGORIES = [
	'Founders & Team',
	'Private Investors',
	'Public Sale',
	'Ecosystem',
	'Treasury',
	'Advisors'
] as const

export const UNLOCK_FREQUENCIES = ['Monthly', 'Quarterly', 'Weekly', 'Daily', 'At TGE'] as const

export const ENGAGEMENT_TYPES = ['Loan + Call Option', 'Retainer + Working Capital', 'Retainer'] as const

export const MARKET_MAKER_OPTIONS = ['Selini', 'Tophash', 'Keyrock', 'GSR', 'Flow Traders', 'Amber Group'] as const

export const EXCHANGE_OPTIONS = ['Binance', 'OKX', 'Coinbase', 'ByBit', 'Bitget', 'Kraken', 'KuCoin', 'Gate'] as const

export const YES_NO = ['Yes', 'No'] as const

export const CLAIM_BLOCKS: ClaimBlock[] = [
	{
		id: 'team',
		title: 'Team & Organizational Structure',
		sections: [
			{
				id: 'insiders',
				title: '1. Insider Identities',
				columns: [
					{ key: 'name', label: 'Name', type: 'text' },
					{ key: 'role', label: 'Role', type: 'text' },
					{ key: 'profile', label: 'LinkedIn, GitHub or X Profile', type: 'url' }
				],
				initialRows: [
					{ name: 'Alice Adams', role: 'CEO', profile: 'http://www.linkedin.com/aslfj' },
					{ name: 'Charles Cox', role: 'CTO', profile: 'http://www.github.com/aslfj' }
				]
			},
			{
				id: 'organizations',
				title: '2. Organizational Structure',
				columns: [
					{ key: 'company', label: 'Company Name', type: 'text' },
					{ key: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
					{ key: 'description', label: 'Description of Company', type: 'text' }
				],
				initialRows: [
					{ company: 'ABC Labs', jurisdiction: 'Deleware, U.S.', description: 'Development Company' },
					{ company: 'DEF Labs', jurisdiction: 'Cayman Islands', description: 'Foundation Company' }
				]
			},
			{
				id: 'wallets',
				title: '3. Anonymized Insider Wallets',
				columns: [
					{ key: 'address', label: 'Wallet Address', type: 'text' },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'owner', label: 'Type of Owner', type: 'text' }
				],
				initialRows: [
					{ address: '0x71C04f009f42c94Db15d97f5a657c917D7dbE193', allocation: '1.05', owner: 'Team Member' },
					{ address: '0x71C04f009f42c94Db15d97f5a657c917D7dbE193', allocation: '0.08', owner: 'Advisor' },
					{ address: '0x71C04f009f42c94Db15d97f5a657c917D7dbE193', allocation: '5.00', owner: 'Treasury of Foundation' }
				]
			}
		]
	},
	{
		id: 'tokenomics',
		title: 'Tokenomics',
		sections: [
			{
				id: 'distribution',
				title: '1. Distribution Schedule',
				columns: [
					{ key: 'group', label: 'Group name', type: 'text' },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'category', label: 'Group category', type: 'select', options: GROUP_CATEGORIES }
				],
				initialRows: [
					{ group: 'Core Contributors', allocation: '20.00', category: 'Founders & Team' },
					{ group: 'Series A', allocation: '15.00', category: 'Private Investors' }
				]
			},
			{
				id: 'vesting',
				title: '2. Vesting Schedule',
				columns: [
					{ key: 'group', label: 'Group Name', type: 'text' },
					{ key: 'unlockTge', label: '% Unlock at TGE', type: 'percent' },
					{ key: 'lockup', label: 'Lock Up Duration', type: 'months' },
					{ key: 'unlockCliff', label: '% Unlock at Init. Cliff', type: 'percent' },
					{ key: 'unlockDuration', label: 'Unlock Duration', type: 'months' },
					{ key: 'frequency', label: 'Unlock Frequency', type: 'select', options: UNLOCK_FREQUENCIES }
				],
				initialRows: [
					{
						group: 'Core Contributors',
						unlockTge: '100',
						lockup: '12',
						unlockCliff: '100',
						unlockDuration: '24',
						frequency: 'Monthly'
					},
					{
						group: 'Series A',
						unlockTge: '100',
						lockup: '12',
						unlockCliff: '8.33',
						unlockDuration: '24',
						frequency: 'Monthly'
					}
				]
			},
			{
				id: 'external',
				title: '3. External Allocations',
				columns: [
					{ key: 'counterparty', label: 'Counterparty Name', type: 'text' },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'category', label: 'Categorization', type: 'text' }
				],
				initialRows: [
					{ counterparty: 'A16Z', allocation: '4.00', category: 'Investor' },
					{ counterparty: 'Binance', allocation: '6.00', category: 'Service Provider' },
					{ counterparty: 'Tetranode', allocation: '0.25', category: 'KOL' }
				]
			},
			{
				id: 'multisig',
				title: '4. Multi-sig Information',
				columns: [
					{ key: 'wallet', label: 'Multisig Wallet', type: 'text' },
					{ key: 'quorum', label: 'Quorum Threshold', type: 'text', placeholder: '4 of 7' },
					{ key: 'signers', label: 'Names of Signers', type: 'text' }
				],
				initialRows: [
					{
						wallet: '0x71C04f009f42c94Db15d97f5a657c917D7dbE193',
						quorum: '4 of 7',
						signers: 'Alice Adams, Bob Brown, Charles Cox, Dana Dole'
					},
					{
						wallet: '0x71C04f009f42c94Db15d97f5a657c917D7dbE193',
						quorum: '3 of 5',
						signers: 'Alice Adams, Bob Brown, Charles Cox, Dana Dole'
					}
				]
			}
		]
	},
	{
		id: 'legal',
		title: 'Legal & Financial',
		sections: [
			{
				id: 'treasury',
				title: '1. Treasury & Cash Flows',
				description:
					"Share financial documentation detailing the project's assets and liabilities, revenue and expenses, and uses of cash.",
				columns: [],
				initialRows: []
			},
			{
				id: 'licenses',
				title: '2. Licenses & Patents',
				columns: [
					{ key: 'name', label: 'Name of License Patent', type: 'text' },
					{ key: 'link', label: 'Link', type: 'url' },
					{ key: 'description', label: 'Description', type: 'text' }
				],
				initialRows: [
					{ name: 'MIT License', link: '', description: "Software license for ABC's core application" },
					{ name: 'VASP License', link: '', description: 'Regulatory license held in 12 U.S. states' }
				]
			}
		]
	},
	{
		id: 'providers',
		title: 'Service Provider Engagements',
		extras: { mmMonitoringQuestion: true },
		sections: [
			{
				id: 'marketMakers',
				title: '1. Market Maker Engagements',
				columns: [
					{ key: 'marketMaker', label: 'Market Maker', type: 'select', options: MARKET_MAKER_OPTIONS },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'engagement', label: 'Engagement Type', type: 'select', options: ENGAGEMENT_TYPES }
				],
				initialRows: [
					{ marketMaker: 'Selini', allocation: '1.50', engagement: 'Loan + Call Option' },
					{ marketMaker: 'Tophash', allocation: '15.00', engagement: 'Retainer + Working Capital' }
				]
			},
			{
				id: 'exchanges',
				title: '2. Exchange Engagements',
				columns: [
					{ key: 'exchange', label: 'Exchange', type: 'select', options: EXCHANGE_OPTIONS },
					{ key: 'commitment', label: 'Commercial Commitment', type: 'select', options: YES_NO },
					{ key: 'details', label: 'Additional Commercial Details', type: 'text' }
				],
				initialRows: [
					{ exchange: 'Binance', commitment: 'Yes', details: '5% Token Allocation, $2M (BNB) Security Deposit' },
					{ exchange: 'OKX', commitment: 'Yes', details: '1% Boost, 0.5% Spot & 0.25% Perps' },
					{ exchange: 'Coinbase', commitment: 'No', details: '' },
					{ exchange: 'ByBit', commitment: 'Yes', details: '0.25% Spot + Perps, $250k Security Deposit' },
					{ exchange: 'Bitget', commitment: 'No', details: '' }
				]
			},
			{
				id: 'auditors',
				title: '3. Auditors',
				columns: [
					{ key: 'auditor', label: 'Auditor', type: 'text' },
					{ key: 'type', label: 'Type', type: 'text' },
					{ key: 'link', label: 'Accessible Link', type: 'url' }
				],
				initialRows: [
					{ auditor: 'Searbit', type: 'Technical', link: 'http://www.whateverlinktoaudithere.com' },
					{ auditor: 'KPMG', type: 'Financial', link: '' }
				]
			}
		]
	}
]
