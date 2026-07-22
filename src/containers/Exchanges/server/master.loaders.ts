import { isHttpNotFoundMessage } from '~/server/api/common'
import {
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
	ExchangeProfileModel,
	ExchangeResearchReportModel,
	MicaVenueModel
} from '../models'
import {
	fetchMasterChartFromNetwork,
	fetchMasterDirectoryFromNetwork,
	fetchMasterExchangeIndexFromNetwork,
	fetchMasterExchangeMetadataFromNetwork,
	fetchMasterMicaFromNetwork
} from './master.upstream'

export async function loadMasterExchangeDirectory(): Promise<ExchangeDirectoryModel> {
	return mapMasterDirectory(await fetchMasterDirectoryFromNetwork())
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

	return mapMasterProfile(await fetchMasterExchangeIndexFromNetwork(exchange), metadata)
}
