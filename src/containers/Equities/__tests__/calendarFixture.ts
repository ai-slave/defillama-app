import type { IEquitiesEarningsCalendarApiItem } from '../api.types'
import type { IEquitiesCalendarCompany, IEquitiesCalendarRow } from '../types'

export function makeEvent(overrides: Partial<IEquitiesEarningsCalendarApiItem> = {}): IEquitiesEarningsCalendarApiItem {
	return {
		ticker: 'TEST',
		date_status: 'estimated',
		report_date: '2026-10-27',
		report_time: 'unknown',
		max_drift_days: 7,
		fiscal_year: 2026,
		fiscal_period: 'Q3',
		event_key: '2026-Q3',
		cik: '123456',
		accession_number: '0000123456-26-123456',
		...overrides
	}
}

export function makeCompany(overrides: Partial<IEquitiesCalendarCompany> = {}): IEquitiesCalendarCompany {
	return {
		ticker: 'TEST',
		name: 'Test Corporation',
		marketCap: 1_000_000_000,
		sector: 'Technology',
		sectorSlug: 'technology',
		country: 'US',
		...overrides
	}
}

export function makeRow(overrides: Partial<IEquitiesCalendarRow> = {}): IEquitiesCalendarRow {
	return {
		...makeEvent(),
		name: 'Test Corporation',
		marketCap: 1_000_000_000,
		sector: 'Technology',
		sectorSlug: 'technology',
		country: 'US',
		href: '/equities/TEST:US',
		...overrides
	}
}
