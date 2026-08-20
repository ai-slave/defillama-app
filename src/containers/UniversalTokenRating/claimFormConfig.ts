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
				initialRows: [{}]
			},
			{
				id: 'organizations',
				title: '2. Organizational Structure',
				columns: [
					{ key: 'company', label: 'Company Name', type: 'text' },
					{ key: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
					{ key: 'description', label: 'Description of Company', type: 'text' }
				],
				initialRows: [{}]
			},
			{
				id: 'wallets',
				title: '3. Anonymized Insider Wallets',
				columns: [
					{ key: 'address', label: 'Wallet Address', type: 'text' },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'owner', label: 'Type of Owner', type: 'text' }
				],
				initialRows: [{}]
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
				initialRows: [{}]
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
				initialRows: [{}]
			},
			{
				id: 'external',
				title: '3. External Allocations',
				columns: [
					{ key: 'counterparty', label: 'Counterparty Name', type: 'text' },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'category', label: 'Categorization', type: 'text' }
				],
				initialRows: [{}]
			},
			{
				id: 'multisig',
				title: '4. Multi-sig Information',
				columns: [
					{ key: 'wallet', label: 'Multisig Wallet', type: 'text' },
					{ key: 'quorum', label: 'Quorum Threshold', type: 'text', placeholder: '4 of 7' },
					{ key: 'signers', label: 'Names of Signers', type: 'text' }
				],
				initialRows: [{}]
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
				initialRows: [{}]
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
					{ key: 'marketMaker', label: 'Market Maker', type: 'select', options: [] },
					{ key: 'allocation', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'engagement', label: 'Engagement Type', type: 'select', options: ENGAGEMENT_TYPES }
				],
				initialRows: [{}]
			},
			{
				id: 'exchanges',
				title: '2. Exchange Engagements',
				columns: [
					{ key: 'exchange', label: 'Exchange', type: 'select', options: [] },
					{ key: 'commitment', label: 'Commercial Commitment', type: 'select', options: YES_NO },
					{ key: 'details', label: 'Additional Commercial Details', type: 'text' }
				],
				initialRows: [{}]
			},
			{
				id: 'auditors',
				title: '3. Auditors',
				columns: [
					{ key: 'auditor', label: 'Auditor', type: 'text' },
					{ key: 'type', label: 'Type', type: 'text' },
					{ key: 'link', label: 'Accessible Link', type: 'url' }
				],
				initialRows: [{}]
			}
		]
	}
]
