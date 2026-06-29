// Parsed token-rights types consumed by app UI. Backend response types live in api.types.ts.
export interface ITokenRightsParsedLink {
	label: string
	url: string
}

export interface ITokenRightsParsedAddress {
	label: string | null
	value: string
}

export interface ITokenRightsTokenDisplay {
	displayTokens: string[]
	fallbackToken: string
}

interface ITokenRightsTokenDetails extends ITokenRightsTokenDisplay {
	tokens: string[]
	details: string | null
}

interface ITokenRightsOverview {
	protocolName: string
	tokens: string[]
	identityTokens: string[]
	tokenTypes: string[]
	description: string
	utility: string | null
	utilityItems: string[]
	lastUpdated: string
	lastUpdatedLabel: string
}

interface ITokenRightsGovernance {
	summary: string
	decisionTokens: string[]
	decisionTokenDisplay: ITokenRightsTokenDisplay
	details: string | null
	links: ITokenRightsParsedLink[]
}

interface ITokenRightsDecisions {
	treasury: ITokenRightsTokenDetails
	revenue: ITokenRightsTokenDetails
}

interface ITokenRightsEconomic {
	summary: string | null
	feeSwitchStatus: string
	feeSwitchDetails: string | null
	links: ITokenRightsParsedLink[]
}

interface ITokenRightsValueAccrual {
	primary: string | null
	details: string | null
	buybacks: ITokenRightsTokenDetails
	dividends: ITokenRightsTokenDetails
	burns: { status: string; isActive: boolean; details: string | null }
}

interface ITokenRightsAlignment {
	fundraising: string[]
	fundraisingLabel: string | null
	raiseDetails: string | null
	associatedEntities: string[]
	equityRevenueCapture: string | null
	equityStatement: string | null
	ipAndBrand: string | null
	domain: string | null
	links: ITokenRightsParsedLink[]
}

interface ITokenRightsResources {
	addresses: ITokenRightsParsedAddress[]
	reports: ITokenRightsParsedLink[]
}

export interface ITokenRightsData {
	overview: ITokenRightsOverview
	governance: ITokenRightsGovernance
	decisions: ITokenRightsDecisions
	economic: ITokenRightsEconomic
	valueAccrual: ITokenRightsValueAccrual
	alignment: ITokenRightsAlignment
	resources: ITokenRightsResources
}
