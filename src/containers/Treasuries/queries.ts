import { fetchEntities, fetchTreasuries } from './api'
import type { RawTreasuriesResponse, RawTreasuryProtocol } from './api.types'
import type { INetProjectTreasury, ITreasuryRow } from './types'

const TREASURY_NAME_SUFFIX = ' (treasury)'
const TREASURY_SLUG_SUFFIX = '-(treasury)'

function removeTerminalSuffix(value: string, suffix: string): string {
	return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value
}

function transformTreasury(treasury: RawTreasuryProtocol, linkProtocol: boolean): ITreasuryRow {
	const name = removeTerminalSuffix(treasury.name, TREASURY_NAME_SUFFIX)

	return {
		name,
		logo: treasury.logo,
		protocolHref: linkProtocol
			? `/protocol/${removeTerminalSuffix(treasury.slug, TREASURY_SLUG_SUFFIX)}?treasury=true&tvl=false`
			: null,
		tokenBreakdowns: treasury.tokenBreakdowns,
		coreTvl: treasury.tvl,
		totalTvl: treasury.tvl + (treasury.chainTvls.OwnTokens ?? 0),
		mcap: treasury.mcap
	}
}

export function buildTreasuryRows(treasuries: RawTreasuriesResponse, linkProtocols: boolean): ITreasuryRow[] {
	const rows: ITreasuryRow[] = []
	for (const treasury of treasuries) rows.push(transformTreasury(treasury, linkProtocols))
	rows.sort((a, b) => b.coreTvl - a.coreTvl)
	return rows
}

export async function getTreasuryPageData(): Promise<ITreasuryRow[]> {
	return buildTreasuryRows(await fetchTreasuries(), true)
}

export async function getEntitiesPageData(): Promise<ITreasuryRow[]> {
	return buildTreasuryRows(await fetchEntities(), false)
}

export function buildNetProjectTreasuryRows(treasuries: RawTreasuriesResponse): INetProjectTreasury[] {
	const protocols: INetProjectTreasury[] = []
	for (const treasury of treasuries) {
		const { stablecoins, majors, others } = treasury.tokenBreakdowns
		const netTreasury = stablecoins + majors + others
		if (netTreasury <= 0) continue
		protocols.push({
			name: removeTerminalSuffix(treasury.name, TREASURY_NAME_SUFFIX),
			logo: treasury.logo,
			slug: removeTerminalSuffix(treasury.slug, TREASURY_SLUG_SUFFIX),
			netTreasury
		})
	}
	protocols.sort((a, b) => b.netTreasury - a.netTreasury)

	return protocols
}

export async function getNetProjectTreasuryData(): Promise<INetProjectTreasury[]> {
	return buildNetProjectTreasuryRows(await fetchTreasuries())
}
