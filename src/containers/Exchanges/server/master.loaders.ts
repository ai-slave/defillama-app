import { isHttpNotFoundMessage } from '~/server/api/common'
import {
	mapExchangeRanking,
	mapMasterDirectoryOverview,
	mapMasterDirectory,
	mapMasterMetadataOnlyProfile,
	mapMasterMica,
	mapMasterProfile,
	mapMasterRamps,
	mapMasterResearchReport
} from '../master.mappers'
import type { MasterChartPart, MasterExchangeMetadataResponse, MasterExecutionQualityResponse } from '../master.types'
import type {
	ExchangeDirectoryModel,
	ExchangeOverviewChartModel,
	ExchangeProfileModel,
	ExchangeRankingModel,
	ExchangeResearchReportModel,
	MicaVenueModel,
	RampCatalogModel
} from '../models'
import type { ExchangeResearchRange } from '../queryState'
import {
	fetchMasterChartFromNetwork,
	fetchMasterDirectoryFromNetwork,
	fetchMasterExecutionQualityFromNetwork,
	fetchMasterExchangeSeriesFromNetwork,
	fetchMasterExchangeIndexFromNetwork,
	fetchMasterExchangeMetadataFromNetwork,
	fetchMasterMicaFromNetwork,
	fetchMasterRampsFromNetwork,
	fetchMasterQualityRanksFromNetwork,
	fetchMasterRankMethodologyFromNetwork
} from './master.upstream'

export async function loadMasterExchangeDirectory(): Promise<ExchangeDirectoryModel> {
	return (await loadMasterExchangeDirectoryWithExecution()).directory
}

/** For pages that also need the raw execution file (the BTC execution table): one
 *  fetch, one snapshot, instead of the directory and the page fetching it separately. */
export async function loadMasterExchangeDirectoryWithExecution(): Promise<{
	directory: ExchangeDirectoryModel
	execution: MasterExecutionQualityResponse | null
}> {
	// Execution quality is fail-soft: a missing/unreachable file renders the directory
	// without execution columns rather than failing the whole page build.
	const [directory, execution] = await Promise.all([
		fetchMasterDirectoryFromNetwork(),
		fetchMasterExecutionQualityFromNetwork().catch(() => null)
	])
	return { directory: mapMasterDirectory(directory, execution), execution }
}

/** The ranking page: directory rows for names and links, the committed ranks for the
 *  numbers, the catalog for the labels. Ranks and catalog are fail-soft — the page
 *  explains the absence rather than failing the build. */
export async function loadMasterExchangeRanking(): Promise<ExchangeRankingModel | null> {
	const [directory, ranks, methodology] = await Promise.all([
		loadMasterExchangeDirectory(),
		fetchMasterQualityRanksFromNetwork().catch(() => null),
		fetchMasterRankMethodologyFromNetwork().catch(() => null)
	])
	return mapExchangeRanking(directory, ranks, methodology)
}

export async function loadMasterExchangeOverview(range: ExchangeResearchRange): Promise<ExchangeOverviewChartModel> {
	return mapMasterDirectoryOverview(await fetchMasterExchangeSeriesFromNetwork(range))
}

export async function loadMasterMicaVenues(): Promise<Array<MicaVenueModel>> {
	return mapMasterMica(await fetchMasterMicaFromNetwork())
}

export async function loadMasterRampCatalog(): Promise<RampCatalogModel> {
	return mapMasterRamps(await fetchMasterRampsFromNetwork())
}

type ExchangeResearchReports = Record<MasterChartPart, ExchangeResearchReportModel>

export async function loadMasterResearchReports(): Promise<ExchangeResearchReports> {
	const [volume, oi, depth, nvol] = await Promise.all([
		fetchMasterChartFromNetwork('volume', '1y'),
		fetchMasterChartFromNetwork('oi', '1y'),
		fetchMasterChartFromNetwork('depth', '1y'),
		fetchMasterChartFromNetwork('nvol', '1y')
	])
	return {
		volume: mapMasterResearchReport('volume', volume),
		oi: mapMasterResearchReport('oi', oi),
		depth: mapMasterResearchReport('depth', depth),
		nvol: mapMasterResearchReport('nvol', nvol)
	}
}

export class MasterExchangeNotFoundError extends Error {}

export async function loadMasterExchangeProfile(exchange: string): Promise<ExchangeProfileModel> {
	let metadata: MasterExchangeMetadataResponse
	try {
		metadata = await fetchMasterExchangeMetadataFromNetwork(exchange)
	} catch (error) {
		if (isHttpNotFoundMessage(error)) throw new MasterExchangeNotFoundError(exchange)
		throw error
	}
	if (metadata.profile_mode === 'metadata-only') return mapMasterMetadataOnlyProfile(metadata)

	// Execution quality and the quality ranking are fail-soft extras: a missing file
	// renders the profile without its Execution tab / ranking card, never a 500.
	const [index, execution, ranks, methodology] = await Promise.all([
		fetchMasterExchangeIndexFromNetwork(exchange),
		fetchMasterExecutionQualityFromNetwork().catch(() => null),
		fetchMasterQualityRanksFromNetwork().catch(() => null),
		fetchMasterRankMethodologyFromNetwork().catch(() => null)
	])
	// Venue-level normalized volume ships on index.json since 2026-09-21; the directory row
	// is the fallback for a cache written before that, fetched only when needed.
	const directory = index.nvol ? null : await fetchMasterDirectoryFromNetwork().catch(() => null)
	return mapMasterProfile(index, metadata, { execution, ranks, methodology, directory })
}
