import type { RawTreasuriesResponse } from '~/containers/Treasuries/api.types'

export function findTreasuryById(
	treasuries: RawTreasuriesResponse,
	treasuryId: string
): RawTreasuriesResponse[number] | null {
	if (!treasuryId) return null
	return treasuries.find((treasury) => treasury.id === treasuryId) ?? null
}
