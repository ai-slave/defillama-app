const FORGD_HOST = process.env.FORGD_API_URL ?? 'https://dev.quant.api.forgd.com'
export const FORGD_PUBLIC_API_BASE = `${FORGD_HOST}/api/v1/public`
export const MM_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600'
export const MM_RESULT_TTL_MS = 5 * 60 * 1000
