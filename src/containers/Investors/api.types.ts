/** Decimal value serialized by an upstream API, for example `"0.03125"`. */
export type ApiNumericString = string

/** UTC calendar date returned by IR chart APIs, for example `"2026-07-18"`. */
export type ApiDate = string

/** UTC calendar month returned by monthly IR charts, for example `"2026-07"`. */
export type ApiMonth = string

/** A chart axis value that is either a UTC day (`"2026-07-18"`) or month (`"2026-07"`). */
export type ApiDateOrMonth = ApiDate | ApiMonth

/** ISO-8601 timestamp with an explicit UTC offset, for example `"2026-07-18T00:00:00+00:00"`. */
export type ApiIsoTimestamp = string

/** Unix timestamp in seconds serialized as a decimal string, for example `"1784332800"`. */
export type ApiUnixSecondsString = string

/** Unix timestamp in milliseconds serialized as a decimal string, for example `"1784332800000"`. */
export type ApiUnixMillisecondsString = string

/** Unix timestamp in seconds. Convert to milliseconds before passing it to ECharts. */
export type ApiUnixSeconds = number

/** Unix timestamp in milliseconds, as returned by Hyperliquid's HTTP and websocket APIs. */
export type ApiUnixMilliseconds = number

/**
 * Read JSON without allowing `Response.json()`'s `any` return type to leak through the app.
 * `T` must be the audited wire contract for the endpoint; normalization and chart builders
 * should accept that wire type directly. This is a static boundary, not runtime validation.
 */
export async function readInvestorApiJson<T>(response: Response): Promise<T> {
	const payload: unknown = await response.json()
	return payload as T
}
