import type { IEquitiesCompanyApiItem } from '~/containers/Equities/api.types'
import type { CsvCell } from '~/utils/csvCell'
import { formatCompactNumber, formatPercent } from '~/utils/numberFormat'

export function formatEquitiesCompanyVolume(value: number | null): string | null {
	return formatCompactNumber(value, {
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})
}

export function formatEquitiesCompanyDividendYield(value: number | null): string {
	return value == null
		? '—'
		: formatPercent(value, {
				input: 'percent',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
				useGrouping: false
			})
}

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
