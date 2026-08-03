import { EventEmitter } from 'node:events'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import type { NextApiRequest, NextApiResponse } from 'next'
import { vi } from 'vitest'

export interface MockNextApiRequestOptions {
	body?: unknown
	headers?: NextApiRequest['headers']
	method?: string
	query?: NextApiRequest['query']
}

class MockNextApiRequest extends IncomingMessage implements NextApiRequest {
	body: unknown
	cookies: NextApiRequest['cookies'] = {}
	env: NextApiRequest['env'] = {}
	query: NextApiRequest['query']

	constructor(options: MockNextApiRequestOptions) {
		super(new Socket())
		this.body = options.body
		this.headers = options.headers ?? {}
		this.method = options.method
		this.query = options.query ?? {}
	}
}

export function createMockNextApiRequest(options: MockNextApiRequestOptions = {}): NextApiRequest {
	return new MockNextApiRequest(options)
}

export type MockNextApiResponse = NextApiResponse & {
	setHeader: ReturnType<typeof vi.fn>
	hasHeader: ReturnType<typeof vi.fn>
	status: ReturnType<typeof vi.fn>
	json: ReturnType<typeof vi.fn>
	send: ReturnType<typeof vi.fn>
	revalidate: ReturnType<typeof vi.fn>
	write: ReturnType<typeof vi.fn>
	end: ReturnType<typeof vi.fn>
}

export function createMockNextApiResponse(): MockNextApiResponse {
	const headers = new Map<string, unknown>()
	const events = new EventEmitter()
	const res = {
		statusCode: 200,
		setHeader: vi.fn(),
		hasHeader: vi.fn(),
		status: vi.fn(),
		json: vi.fn(),
		send: vi.fn(),
		revalidate: vi.fn(),
		write: vi.fn(),
		end: vi.fn(),
		on: events.on.bind(events),
		once: events.once.bind(events),
		off: events.off.bind(events),
		emit: events.emit.bind(events)
	} as unknown as MockNextApiResponse

	res.setHeader.mockImplementation((name: string, value: unknown) => {
		headers.set(name.toLowerCase(), value)
		return res
	})
	res.hasHeader.mockImplementation((name: string) => headers.has(name.toLowerCase()))
	res.status.mockImplementation((statusCode: number) => {
		res.statusCode = statusCode
		return res
	})
	res.json.mockReturnValue(res)
	res.send.mockReturnValue(res)
	res.revalidate.mockResolvedValue(undefined)
	res.write.mockReturnValue(true)
	res.end.mockReturnValue(res)

	return res
}
