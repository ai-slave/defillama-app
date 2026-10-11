export type ClaimDisclosureSectionId =
	| 'insiderIdentities'
	| 'organizationalStructure'
	| 'insiderWallets'
	| 'tokenomicsGroups'
	| 'externalAllocations'
	| 'multisigWallets'
	| 'licenses'
	| 'marketMakerEngagements'
	| 'exchangeEngagements'
	| 'auditors'

export type ClaimFieldType = 'text' | 'percent' | 'select' | 'months' | 'url' | 'integer'

export type ClaimSelectOption = { value: string; label: string }

export type ClaimColumn = {
	key: string
	label: string
	type: ClaimFieldType
	options?: ReadonlyArray<ClaimSelectOption>
	optionSource?: 'marketMakers' | 'exchanges'
	linkedNameKey?: 'marketMakerName' | 'exchangeName'
	placeholder?: string
}

export type ClaimTableSection = {
	id: ClaimDisclosureSectionId
	title: string
	description?: string
	columns: Array<ClaimColumn>
}

export type ClaimBlock = {
	id: 'team' | 'tokenomics' | 'legal' | 'providers'
	title: string
	documentKey: 'teamOrg' | 'tokenomics' | 'legal' | 'serviceProviders'
	documentDescription?: string
	sections: Array<ClaimTableSection>
	additionalDocumentSection?: {
		key: 'treasuryCashFlows'
		title: string
		description: string
	}
	extras?: { mmMonitoringQuestion?: boolean }
}

const GROUP_CATEGORIES = [
	'Founders & Team',
	'Private Investors',
	'Public Sale',
	'Ecosystem',
	'Treasury',
	'Advisors'
].map((value) => ({ value, label: value }))

const UNLOCK_FREQUENCIES = ['Daily', 'Monthly'].map((value) => ({ value, label: value }))

const ENGAGEMENT_TYPES = ['Loan + Call Option', 'Retainer + Working Capital', 'Retainer'].map((value) => ({
	value,
	label: value
}))

const YES_NO = [
	{ value: 'true', label: 'Yes' },
	{ value: 'false', label: 'No' }
]

export const CLAIM_BLOCKS: Array<ClaimBlock> = [
	{
		id: 'team',
		title: 'Team & organizational structure',
		documentKey: 'teamOrg',
		documentDescription:
			'Upload any additional documentation that provides context on your team’s organizational structure, including core contributor biographies, professional responsibilities, governance processes, legal entity relationships (e.g., Foundation, Association, Labs, or other affiliated entities), and how each entity interacts with the protocol.',
		sections: [
			{
				id: 'insiderIdentities',
				title: '1. Insider identities',
				columns: [
					{ key: 'name', label: 'Name', type: 'text' },
					{ key: 'role', label: 'Role', type: 'text' },
					{ key: 'profileUrl', label: 'LinkedIn, GitHub or X Profile', type: 'url' }
				]
			},
			{
				id: 'organizationalStructure',
				title: '2. Organizational structure',
				columns: [
					{ key: 'companyName', label: 'Company Name', type: 'text' },
					{ key: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
					{ key: 'description', label: 'Description of Company', type: 'text' }
				]
			},
			{
				id: 'insiderWallets',
				title: '3. Anonymized insider wallets',
				columns: [
					{ key: 'walletAddress', label: 'Wallet Address', type: 'text' },
					{ key: 'allocationPct', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'ownerType', label: 'Type of Owner', type: 'text' }
				]
			}
		]
	},
	{
		id: 'tokenomics',
		title: 'Tokenomics',
		documentKey: 'tokenomics',
		sections: [
			{
				id: 'tokenomicsGroups',
				title: '1. Distribution & vesting schedule',
				columns: [
					{ key: 'groupName', label: 'Group Name', type: 'text' },
					{ key: 'allocationPct', label: 'Allocation', type: 'percent' },
					{ key: 'groupCategory', label: 'Group Category', type: 'select', options: GROUP_CATEGORIES },
					{ key: 'tgeUnlockPct', label: 'Unlock at TGE', type: 'percent' },
					{ key: 'lockUpDurationMonths', label: 'Lock-up', type: 'months' },
					{ key: 'cliffUnlockPct', label: 'Unlock at Cliff', type: 'percent' },
					{ key: 'unlockDurationMonths', label: 'Unlock Duration', type: 'months' },
					{ key: 'unlockFrequency', label: 'Frequency', type: 'select', options: UNLOCK_FREQUENCIES }
				]
			},
			{
				id: 'externalAllocations',
				title: '2. External allocations',
				columns: [
					{ key: 'counterpartyName', label: 'Counterparty Name', type: 'text' },
					{ key: 'allocationPct', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'categorization', label: 'Categorization', type: 'text' }
				]
			},
			{
				id: 'multisigWallets',
				title: '3. Multi-sig information',
				columns: [
					{ key: 'walletAddress', label: 'Multisig Wallet', type: 'text' },
					{ key: 'thresholdRequired', label: 'Required Signers', type: 'integer' },
					{ key: 'thresholdTotal', label: 'Total Signers', type: 'integer' },
					{ key: 'signerNames', label: 'Names of Signers', type: 'text' }
				]
			}
		]
	},
	{
		id: 'legal',
		title: 'Legal & financial',
		documentKey: 'legal',
		additionalDocumentSection: {
			key: 'treasuryCashFlows',
			title: '1. Treasury & cash flows',
			description:
				"Share financial documentation detailing the project's assets and liabilities, revenue and expenses, and uses of cash."
		},
		sections: [
			{
				id: 'licenses',
				title: '2. Licenses & patents',
				columns: [
					{ key: 'name', label: 'Name of License or Patent', type: 'text' },
					{ key: 'link', label: 'Link (optional)', type: 'url' },
					{ key: 'description', label: 'Description', type: 'text' }
				]
			}
		]
	},
	{
		id: 'providers',
		title: 'Service provider engagements',
		documentKey: 'serviceProviders',
		extras: { mmMonitoringQuestion: true },
		sections: [
			{
				id: 'marketMakerEngagements',
				title: '1. Market maker engagements',
				columns: [
					{
						key: 'marketMakerId',
						label: 'Market Maker',
						type: 'select',
						optionSource: 'marketMakers',
						linkedNameKey: 'marketMakerName'
					},
					{ key: 'allocationPct', label: 'Allocation (% Total Supply)', type: 'percent' },
					{ key: 'engagementType', label: 'Engagement Type', type: 'select', options: ENGAGEMENT_TYPES }
				]
			},
			{
				id: 'exchangeEngagements',
				title: '2. Exchange engagements',
				columns: [
					{
						key: 'exchangeId',
						label: 'Exchange',
						type: 'select',
						optionSource: 'exchanges',
						linkedNameKey: 'exchangeName'
					},
					{ key: 'commercialCommitment', label: 'Commercial Commitment', type: 'select', options: YES_NO },
					{ key: 'details', label: 'Additional Details (optional)', type: 'text' }
				]
			},
			{
				id: 'auditors',
				title: '3. Auditors',
				columns: [
					{ key: 'name', label: 'Auditor', type: 'text' },
					{ key: 'type', label: 'Type', type: 'text' },
					{ key: 'link', label: 'Accessible Link (optional)', type: 'url' }
				]
			}
		]
	}
]

export const CLAIM_DISCLOSURE_SECTIONS = CLAIM_BLOCKS.flatMap((block) => block.sections)
