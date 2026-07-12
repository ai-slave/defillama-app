import type { RawRaise, RawRaisesResponse } from '~/containers/Raises/api.types'

export function findRaisesByDefillamaId(response: RawRaisesResponse, defillamaId: string): RawRaise[] {
	if (!defillamaId) return []
	return response.raises.filter((raise) => raise.defillamaId === defillamaId)
}
