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
	displayTokens: Array<string>
	fallbackToken: string
}

interface ITokenRightsTokenDetails extends ITokenRightsTokenDisplay {
	tokens: Array<string>
	details: string | null
}

interface ITokenRightsOverview {
	protocolName: string
	tokens: Array<string>
	identityTokens: Array<string>
	tokenTypes: Array<string>
	description: string
	utility: string | null
	utilityItems: Array<string>
	lastUpdated: string | null
	lastUpdatedLabel: string | null
}

interface ITokenRightsGovernance {
	summary: string
	decisionTokens: Array<string>
	decisionTokenDisplay: ITokenRightsTokenDisplay
	details: string | null
	links: Array<ITokenRightsParsedLink>
}

interface ITokenRightsDecisions {
	treasury: ITokenRightsTokenDetails
	revenue: ITokenRightsTokenDetails
}

interface ITokenRightsEconomic {
	summary: string | null
	feeSwitchStatus: string
	feeSwitchDetails: string | null
	links: Array<ITokenRightsParsedLink>
}

interface ITokenRightsValueAccrual {
	primary: string | null
	details: string | null
	buybacks: ITokenRightsTokenDetails
	dividends: ITokenRightsTokenDetails
	burns: { status: string; isActive: boolean; details: string | null }
}

interface ITokenRightsAlignment {
	fundraising: Array<string>
	fundraisingLabel: string | null
	raiseDetails: string | null
	associatedEntities: Array<string>
	equityRevenueCapture: string | null
	equityStatement: string | null
	ipAndBrand: string | null
	domain: string | null
	links: Array<ITokenRightsParsedLink>
}

interface ITokenRightsResources {
	addresses: Array<ITokenRightsParsedAddress>
	reports: Array<ITokenRightsParsedLink>
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
