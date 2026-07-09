export const CORRELATION_TOKEN_PICKER_LIMIT = 20

export interface CorrelationTokenOption {
	id: string
	name: string
	symbol: string
	rank: number
	logo: string
}

export interface CorrelationTokenPickerResponse {
	tokens: CorrelationTokenOption[]
	offset: number
	limit: number
	total: number
	nextOffset: number | null
}
