import type { Raise, RaisesResponse } from '~/containers/Raises/model'

export function findRaisesByDefillamaId(response: RaisesResponse, defillamaId: string): Raise[] {
	if (!defillamaId) return []
	return response.raises.filter((raise) => raise.defillamaId === defillamaId)
}
