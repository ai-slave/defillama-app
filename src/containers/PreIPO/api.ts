import { PRE_IPO_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	PreIpoCompanyListItem,
	PreIpoCompanySummary,
	PreIpoIntegrations,
	PreIpoRaise,
	PreIpoSnapshot,
	PreIpoValuation
} from './api.types'

const PRE_IPO_COMPANIES_LIST_API = `${PRE_IPO_SERVER_URL}/companies-list`
const PRE_IPO_SUMMARY_API = `${PRE_IPO_SERVER_URL}/summary`
const PRE_IPO_RAISES_API = `${PRE_IPO_SERVER_URL}/raises`
const PRE_IPO_VALUATIONS_API = `${PRE_IPO_SERVER_URL}/valuations`
const PRE_IPO_INTEGRATIONS_API = `${PRE_IPO_SERVER_URL}/integrations`

function createPreIpoCompanyUrl(baseUrl: string, company: string): string {
	const url = new URL(baseUrl)
	url.searchParams.set('company', company)
	return url.toString()
}

export function fetchPreIpoCompanies(): Promise<PreIpoSnapshot<Array<PreIpoCompanyListItem>>> {
	return fetchJson<PreIpoSnapshot<Array<PreIpoCompanyListItem>>>(PRE_IPO_COMPANIES_LIST_API)
}

export function fetchPreIpoCompanySummary(company: string): Promise<PreIpoSnapshot<PreIpoCompanySummary>> {
	return fetchJson<PreIpoSnapshot<PreIpoCompanySummary>>(createPreIpoCompanyUrl(PRE_IPO_SUMMARY_API, company))
}

export function fetchPreIpoRaises(company: string): Promise<PreIpoSnapshot<Array<PreIpoRaise>>> {
	return fetchJson<PreIpoSnapshot<Array<PreIpoRaise>>>(createPreIpoCompanyUrl(PRE_IPO_RAISES_API, company))
}

export function fetchPreIpoValuations(company: string): Promise<PreIpoSnapshot<Array<PreIpoValuation>>> {
	return fetchJson<PreIpoSnapshot<Array<PreIpoValuation>>>(createPreIpoCompanyUrl(PRE_IPO_VALUATIONS_API, company))
}

export function fetchPreIpoIntegrations(company: string): Promise<PreIpoSnapshot<PreIpoIntegrations>> {
	return fetchJson<PreIpoSnapshot<PreIpoIntegrations>>(createPreIpoCompanyUrl(PRE_IPO_INTEGRATIONS_API, company))
}
