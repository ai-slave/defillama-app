import { isHttpNotFoundMessage } from '~/server/api/common'
import {
	mapMasterDirectoryOverview,
	mapMasterDirectory,
	mapMasterMetadataOnlyProfile,
	mapMasterMica,
	mapMasterProfile,
	mapMasterResearchReport
} from '../master.mappers'
import { MASTER_CHART_PARTS, type MasterChartPart } from '../master.types'
import type { MasterExchangeMetadataResponse } from '../master.types'
import type {
	ExchangeDirectoryModel,
	ExchangeOverviewChartModel,
	ExchangeProfileModel,
	ExchangeResearchReportModel,
	MicaVenueModel
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
	fetchMasterQualityRanksFromNetwork,
	fetchMasterRankMethodologyFromNetwork
} from './master.upstream'

export async function loadMasterExchangeDirectory(): Promise<ExchangeDirectoryModel> {
	// Execution quality is fail-soft: a missing/unreachable file renders the directory
	// without execution columns rather than failing the whole page build.
	const [directory, execution] = await Promise.all([
		fetchMasterDirectoryFromNetwork(),
		fetchMasterExecutionQualityFromNetwork().catch(() => null)
	])
	return mapMasterDirectory(directory, execution)
}

export async function loadMasterExchangeOverview(range: ExchangeResearchRange): Promise<ExchangeOverviewChartModel> {
	return mapMasterDirectoryOverview(await fetchMasterExchangeSeriesFromNetwork(range))
}

export async function loadMasterMicaVenues(): Promise<MicaVenueModel[]> {
	return mapMasterMica(await fetchMasterMicaFromNetwork())
}

type ExchangeResearchReports = Record<MasterChartPart, ExchangeResearchReportModel>

export async function loadMasterResearchReports(): Promise<ExchangeResearchReports> {
	const [volume, oi, depth, nvol] = await Promise.all(
		MASTER_CHART_PARTS.map((part) => fetchMasterChartFromNetwork(part, '1y'))
	)
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
	return mapMasterProfile(index, metadata, { execution, ranks, methodology })
}
