import {
	NON_WORD_SLASH_REGEX,
	NON_WORD_SLASH_DOT_REGEX,
	LEADING_DASH_REGEX,
	TRAILING_DASH_REGEX
} from './regex-constants'

let redis: import('ioredis').Redis | null = null
let redisConnection: Promise<import('ioredis').Redis | null> | null = null
// Setting REDIS_URL is the only deployment switch; `next dev` never connects even if one is set.
const REDIS_URL = process.env.NODE_ENV === 'development' ? undefined : process.env.REDIS_URL

if (typeof window === 'undefined' && REDIS_URL) {
	redisConnection = import('ioredis')
		.then((Redis) => {
			console.log('[cache] [connecting to redis]')

			try {
				redis = new Redis.default(REDIS_URL)
				redis.on('connect', () => console.log('[cache] [redis] connected'))
				redis.on('error', () => console.log('[cache] [redis error]'))
				return redis
			} catch {
				console.log('[cache] [redis connection error]')
				return null
			}
		})
		.catch(() => {
			console.log('[cache] [redis import error]')
			return null
		})
}

const getRedisClient = async () => redis ?? (redisConnection ? await redisConnection : null)

export const sluggify = (input: string) => {
	const slug = decodeURIComponent(input).toLowerCase().replace(NON_WORD_SLASH_REGEX, '-')
	return slug.replace(LEADING_DASH_REGEX, '').replace(TRAILING_DASH_REGEX, '')
}

export const sluggifyProtocol = (input: string) => {
	const slug = decodeURIComponent(input).toLowerCase().replace(NON_WORD_SLASH_DOT_REGEX, '-')
	return slug.replace(LEADING_DASH_REGEX, '').replace(TRAILING_DASH_REGEX, '')
}

/**
 * RedisCacheObject is the object stored in Redis
 *
 * @property {string} Body - base64 encoded string of the content via Buffer.toString('base64')
 * @property {string} ContentType - the content type of the content, e.g. image/jpeg, text/html, etc.
 */
type RedisCacheObject = {
	Body: string
	ContentType: string
	StatusCode?: number
	StatusText?: string
}

export type RedisCachePayload = {
	Key: string
	Body: Buffer
	ContentType: string
	StatusCode?: number
	StatusText?: string
}

export const setCache = async (payload: RedisCachePayload, ttl?: string | number) => {
	const client = await getRedisClient()
	if (!client) {
		return false
	}

	try {
		const cacheObject: RedisCacheObject = {
			Body: payload.Body.toString('base64'),
			ContentType: payload.ContentType,
			...(payload.StatusCode ? { StatusCode: payload.StatusCode } : {}),
			...(payload.StatusText ? { StatusText: payload.StatusText } : {})
		}
		if (ttl) {
			await client.set(payload.Key, JSON.stringify(cacheObject), 'EX', ttl)
		} else {
			await client.set(payload.Key, JSON.stringify(cacheObject))
		}
		return true
	} catch (error) {
		console.log('[error] [cache] [failed to set]', payload.Key)
		console.log(error)
		return false
	}
}

// Atomically retain an immutable blob without shortening an export's longer lease.
const retainImmutableCacheScript = `
local remaining = redis.call('PTTL', KEYS[1])
local required = tonumber(ARGV[2]) * 1000
if remaining == -2 then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', required)
elseif remaining >= 0 and remaining < required then
  redis.call('PEXPIRE', KEYS[1], required)
end
return 1
`

export const setImmutableCache = async (payload: RedisCachePayload, ttlSeconds: number): Promise<boolean> => {
	const client = await getRedisClient()
	if (!client) return false
	try {
		const cacheObject: RedisCacheObject = {
			Body: payload.Body.toString('base64'),
			ContentType: payload.ContentType,
			...(payload.StatusCode ? { StatusCode: payload.StatusCode } : {}),
			...(payload.StatusText ? { StatusText: payload.StatusText } : {})
		}
		await client.eval(retainImmutableCacheScript, 1, payload.Key, JSON.stringify(cacheObject), ttlSeconds)
		return true
	} catch (error) {
		console.log('[error] [cache] [failed to retain]', payload.Key)
		console.log(error)
		return false
	}
}

export const setPageBuildTimes = async (pageUrl: string, cacheObject: unknown) => {
	const client = await getRedisClient()
	if (!client) {
		return false
	}

	try {
		await client.hset('page_build_times', pageUrl, JSON.stringify(cacheObject))
		return true
	} catch (error) {
		console.log('[error] [cache] [failed to set]', cacheObject)
		console.log(error)
		return false
	}
}
export const getCache = async (Key: string) => {
	const client = await getRedisClient()
	if (!client) {
		return null
	}

	try {
		const res = await client.get(Key)
		if (res === null) {
			return null
		}
		const cacheObject: RedisCacheObject = JSON.parse(res)
		const payload = {
			Key,
			Body: Buffer.from(cacheObject.Body, 'base64'),
			ContentType: cacheObject.ContentType,
			...(cacheObject.StatusCode ? { StatusCode: cacheObject.StatusCode } : {}),
			...(cacheObject.StatusText ? { StatusText: cacheObject.StatusText } : {})
		}
		return payload
	} catch (error) {
		console.log('[error] [cache] [failed to get]', Key)
		console.log(error)
		return null
	}
}
export const setObjectCache = async (key: string, data: unknown, ttl = 3600) => {
	const client = await getRedisClient()
	if (!client) {
		return false
	}

	try {
		await client.set(key, JSON.stringify(data), 'EX', ttl)
		return true
	} catch (error) {
		console.log('[error] [cache] [failed to set]', key)
		console.log(error)
		return false
	}
}

export const getObjectCache = async <T = unknown>(key: string): Promise<T | null> => {
	const client = await getRedisClient()
	if (!client) {
		return null
	}

	try {
		const res = await client.get(key)
		if (!res) return null
		const parsed: unknown = JSON.parse(res)
		return parsed as T
	} catch (error) {
		console.log('[error] [cache] [failed to get]', key)
		console.log(error)
		return null
	}
}
