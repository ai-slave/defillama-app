import { getDirectUrlEnv } from '~/utils/directApi'

const API_KEY = process.env.API_KEY
const SKIP_BUILD_STATIC_GENERATION_ENV = process.env.SKIP_BUILD_STATIC_GENERATION

export const PRO_API_BASE_URL = 'https://pro-api.llama.fi'
export const COINGECKO_KEY = process.env.CG_KEY
export const SEARCH_API_TOKEN = process.env.NEXT_PUBLIC_SEARCH_API_TOKEN
export const SKIP_BUILD_STATIC_GENERATION =
	SKIP_BUILD_STATIC_GENERATION_ENV !== 'false' && SKIP_BUILD_STATIC_GENERATION_ENV !== '0'
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
export const GOOGLE_WEB_CLIENT_ID =
	process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
	'137607440574-52q46ue3f50ciegcdq6do2h50esah040.apps.googleusercontent.com'

// Base servers
export const AUTH_SERVER = 'https://features.llama.fi'
export const AI_SERVER = process.env.NEXT_PUBLIC_AI_SERVER_URL ?? 'https://ai.llama.fi'
export const FEATURES_SERVER = process.env.NEXT_PUBLIC_FEATURES_SERVER_URL ?? 'https://features.llama.fi'
export const DATASETS_SERVER_URL =
	getDirectUrlEnv('DATASETS_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/datasets` : 'https://defillama-datasets.llama.fi')
export const SERVER_URL =
	getDirectUrlEnv('SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/api` : 'https://api.llama.fi')
export const V2_SERVER_URL = getDirectUrlEnv('V2_SERVER_URL') ?? `${SERVER_URL}/v2`

// Product/domain server roots
export const BRIDGES_SERVER_URL =
	getDirectUrlEnv('BRIDGES_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/bridges` : 'https://bridges.llama.fi')
export const COINS_SERVER_URL =
	getDirectUrlEnv('COINS_SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/coins` : 'https://coins.llama.fi')
export const EQUITIES_SERVER_URL =
	getDirectUrlEnv('EQUITIES_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/equities/v1` : 'https://api.llama.fi/equities/v1')
export const PRE_IPO_SERVER_URL =
	getDirectUrlEnv('PRE_IPO_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/pre-ipo/v1` : 'https://pre-ipo.llama.fi/v1')
export const ETF_SERVER_URL =
	getDirectUrlEnv('ETF_SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/etfs` : 'https://etfs.llama.fi')
export const FDV_SERVER_URL =
	getDirectUrlEnv('FDV_SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/fdv` : 'https://fdv-server.llama.fi')
export const CARDS_SERVER_URL =
	getDirectUrlEnv('CARDS_SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/cards` : 'https://cards.llama.fi')
export const RWA_SERVER_URL =
	getDirectUrlEnv('RWA_SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/rwa` : 'https://api.llama.fi/rwa')
export const RWA_PERPS_SERVER_URL =
	getDirectUrlEnv('RWA_PERPS_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/rwa-perps` : 'https://api.llama.fi/rwa-perps')
export const STABLECOINS_SERVER_URL =
	getDirectUrlEnv('STABLECOINS_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/stablecoins` : 'https://stablecoins.llama.fi')
export const TRADFI_API =
	getDirectUrlEnv('TRADFI_API') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/dat` : 'https://api.llama.fi/dat')
export const YIELDS_SERVER_URL =
	getDirectUrlEnv('YIELDS_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/yields` : 'https://yields.llama.fi')
export const YIELDS_V2_SERVER_URL =
	getDirectUrlEnv('YIELDS_V2_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/yields` : 'https://yields-v2.llama.fi')
export const LIQUIDATIONS_SERVER_URL_V2 =
	getDirectUrlEnv('LIQUIDATIONS_SERVER_URL_V2') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/liquidations` : 'https://api.llama.fi/liquidations')
export const RISK_SERVER_URL =
	getDirectUrlEnv('RISK_SERVER_URL') ?? (API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/risks` : 'https://risks.llama.fi')
export const MARKETS_SERVER_URL =
	getDirectUrlEnv('MARKETS_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/markets` : 'https://markets.llama.fi')
export const VAULT_RISK_SERVER_URL =
	getDirectUrlEnv('VAULT_RISK_SERVER_URL') ??
	(API_KEY ? `${PRO_API_BASE_URL}/${API_KEY}/vault-risk` : 'https://vault-risk.llama.fi')
export const VAULT_RISK_API = `${VAULT_RISK_SERVER_URL}/v1/vault-risks`
export const PROTOCOL_RISK_API = `${VAULT_RISK_SERVER_URL}/v1/protocol-risks`

// Core llama APIs
export const CONFIG_API = `${SERVER_URL}/config`

// Coins
export const COINS_CHART_API = `${COINS_SERVER_URL}/chart`

// FDV/category metadata
export const CATEGORY_INFO_API = `${FDV_SERVER_URL}/info`

// Static assets
export const ICONS_CDN = 'https://icons.llamao.fi/icons'
export const TOTAL_TRACKED_BY_METRIC_API = `${getDirectUrlEnv('SERVER_URL') ?? 'https://api.llama.fi'}/config/smol/appMetadata-totalTrackedByMetric.json`
// The pro token-directory cache can serve truncated JSON; use the public API unless explicitly overridden.
export const TOKEN_DIRECTORY_API = `${getDirectUrlEnv('SERVER_URL') ?? 'https://api.llama.fi'}/config/smol/token.json`

// External services
export const POCKETBASE_URL = 'https://pb.llama.fi'
export const SEARCH_API_URL = 'https://search-core.defillama.com/multi-search'
