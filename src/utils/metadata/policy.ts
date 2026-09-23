import { DIRECT_URL_ENV_NAMES, type DirectUrlEnvName } from '../directApi'

export type MetadataPolicyEnv = Partial<Record<DirectUrlEnvName, string>> & {
	[key: string]: string | boolean | undefined
	API_KEY?: string
	CI?: string | boolean
	NODE_ENV?: string
}

export function shouldWriteMetadataStubsOnFailure(env: MetadataPolicyEnv = process.env): boolean {
	return env.NODE_ENV === 'development'
}

export function shouldSkipMetadataRefresh(env: MetadataPolicyEnv = process.env): boolean {
	return env.NODE_ENV === 'development' && !env.API_KEY && !DIRECT_URL_ENV_NAMES.some((name) => env[name]?.trim())
}
