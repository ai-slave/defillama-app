import type { IEquitiesCompanyApiItem } from '~/containers/Equities/api.types'
import type { CsvCell } from '~/utils/csvCell'
import {
	formatCompactNumber,
	formatPercent,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	PERCENT_POINTS_TWO_DECIMALS_OPTIONS
} from '~/utils/numberFormat'

type EquitiesCompanyCsvItem = Pick<
	IEquitiesCompanyApiItem,
	| 'ticker'
	| 'name'
	| 'currentPrice'
	| 'marketCap'
	| 'volume'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
	| 'trailingPE'
	| 'dividendYield'
	| 'revenueTTM'
	| 'earningsTTM'
>

export function getEquitiesCompanyCsvRow(item: EquitiesCompanyCsvItem): Array<CsvCell> {
	return [
		item.ticker,
		item.name,
		item.currentPrice,
		item.marketCap,
		item.volume,
		item.priceChangePercentage1d,
		item.priceChangePercentage7d,
		item.priceChangePercentage1m,
		item.trailingPE,
		item.dividendYield,
		item.revenueTTM,
		item.earningsTTM
	]
}

// Volume is a share count, not USD.
export function formatEquitiesVolume(volume: number | undefined): string | null {
	return formatCompactNumber(volume, NUMBER_LOWERCASE_MILLIONS_OPTIONS)
}

// The API already sends dividend yield in percentage points (0.34 means 0.34%).
export function formatEquitiesDividendYield(dividendYield: number | undefined): string {
	return formatPercent(dividendYield, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'
}
