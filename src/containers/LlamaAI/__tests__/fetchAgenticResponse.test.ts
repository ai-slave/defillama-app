import { describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import {
	AgenticExecutionChangedError,
	attachAgenticStream,
	fetchAgenticResponse,
	parseSSEStream,
	stopAgenticExecution,
	type AgenticSSECallbacks
} from '~/containers/LlamaAI/fetchAgenticResponse'
import { createAgenticMutationEnvelope } from '~/containers/LlamaAI/mutationProtocol'

type MockFetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>
type MockFetchSpy = ReturnType<typeof vi.fn<MockFetch>>

const chartConfig: ChartConfiguration = {
	id: 'chart-1',
	type: 'line',
	title: 'TVL',
	description: 'TVL over time',
	axes: {
		x: { field: 'timestamp', label: 'Date', type: 'time' },
		yAxes: [{ id: 'left', fields: ['tvl'], label: 'TVL', position: 'left' }]
	},
	series: [
		{
			name: 'TVL',
			type: 'line',
			yAxisId: 'left',
			metricClass: 'stock',
			dataMapping: { xField: 'timestamp', yField: 'tvl' },
			styling: {}
		}
	],
	dataTransformation: { timeField: 'timestamp', metrics: ['tvl'] }
}

function encodeSseEvents(events: Array<string>) {
	return events.map((event) => `data: ${event}\n\n`).join('')
}

function sseReader(...events: Array<string>) {
	const encoder = new TextEncoder()
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(encodeSseEvents(events)))
			controller.close()
		}
	})
	return stream.getReader()
}

function sseResponse(events: Array<string>, init?: ResponseInit) {
	return new Response(encodeSseEvents(events), {
		...init,
		headers: {
			'Content-Type': 'text/event-stream; cursor=v2',
			...init?.headers
		}
	})
}

function jsonResponse(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers
		}
	})
}

function readRequestBody(fetchSpy: MockFetchSpy) {
	const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
	if (!init || typeof init.body !== 'string') throw new Error('Expected JSON request body')
	return JSON.parse(init.body) as Record<string, unknown>
}

function callbacks(): AgenticSSECallbacks {
	return {
		onToken: vi.fn(),
		onCharts: vi.fn(),
		onGeneratedImages: vi.fn(),
		onProgress: vi.fn(),
		onSpawnProgress: vi.fn(),
		onSessionId: vi.fn(),
		onCitations: vi.fn(),
		onCsvExport: vi.fn(),
		onMdExport: vi.fn(),
		onAlertProposed: vi.fn(),
		onDashboard: vi.fn(),
		onToolExecution: vi.fn(),
		onTodos: vi.fn(),
		onMessageMetadata: vi.fn(),
		onThinking: vi.fn(),
		onCompaction: vi.fn(),
		onTitle: vi.fn(),
		onMessageId: vi.fn(),
		onUserMessageId: vi.fn(),
		onQueueUpdated: vi.fn(),
		onSiblingInfo: vi.fn(),
		onTokenLimit: vi.fn(),
		onContextWarning: vi.fn(),
		onError: vi.fn(),
		onDone: vi.fn()
	}
}

describe('parseSSEStream', () => {
	test('dispatches event sequences and follows the backend replay cursor', async () => {
		const cb = callbacks()
		const eventCounter = { count: 0 }

		const result = await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'session', sessionId: 'session-1', startedAt: 123, streamCursor: 0 }),
				JSON.stringify({ type: 'response_chunk', content: 'hello<bill />', streamCursor: 1 }),
				JSON.stringify({ type: 'charts', charts: [], chartData: { rows: [] }, streamCursor: 2 }),
				JSON.stringify({ type: 'citations', citations: ['https://example.com'], streamCursor: 3 }),
				JSON.stringify({ type: 'tool_execution', name: 'search', success: true, streamCursor: 4 }),
				JSON.stringify({
					type: 'dashboard',
					dashboard_id: 'dash-1',
					dashboardConfig: { dashboardName: 'Dash', items: [] },
					streamCursor: 5
				}),
				JSON.stringify({ type: 'done', streamCursor: 6 })
			),
			cb,
			undefined,
			eventCounter
		)

		expect(result).toEqual({ sawDone: true })
		expect(eventCounter.count).toBe(6)
		expect(cb.onSessionId).toHaveBeenCalledWith('session-1', 123)
		expect(cb.onToken).toHaveBeenCalledWith('hello')
		expect(cb.onCharts).toHaveBeenCalledWith([], { rows: [] })
		expect(cb.onCitations).toHaveBeenCalledWith(['https://example.com'])
		expect(cb.onToolExecution).toHaveBeenCalledWith({ type: 'tool_execution', name: 'search', success: true })
		expect(cb.onDashboard).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'dash-1', dashboardName: 'Dash', items: [] })
		)
		expect(cb.onDone).toHaveBeenCalledOnce()
	})

	test('reports streams that end without done', async () => {
		const cb = callbacks()

		const result = await parseSSEStream(sseReader(JSON.stringify({ type: 'response_chunk', content: 'partial' })), cb)

		expect(result).toEqual({ sawDone: false })
		expect(cb.onToken).toHaveBeenCalledWith('partial')
		expect(cb.onDone).not.toHaveBeenCalled()
	})

	test('applies queue wait snapshots without advancing the execution replay cursor', async () => {
		const cb = callbacks()
		const eventCounter = { count: 4 }

		const result = await parseSSEStream(
			sseReader(
				JSON.stringify({
					type: 'queue_wait_ended',
					reason: 'paused',
					sessionId: 'session-1',
					revision: 3,
					queue: []
				})
			),
			cb,
			undefined,
			eventCounter
		)

		expect(result).toEqual({ sawDone: false, queueWaitEndReason: 'paused' })
		expect(eventCounter.count).toBe(4)
		expect(cb.onQueueUpdated).toHaveBeenCalledWith({ sessionId: 'session-1', revision: 3, queue: [] })
	})

	test('does not advance the replay cursor for unindexed preamble events', async () => {
		const cb = callbacks()
		const eventCounter = { count: 4 }

		await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'session', sessionId: 'session-1', startedAt: 123 }),
				JSON.stringify({ type: 'message_id', messageId: 'message-1' })
			),
			cb,
			undefined,
			eventCounter
		)

		expect(eventCounter.count).toBe(4)
	})

	test('uses local event counting for legacy streams without authoritative cursors', async () => {
		const cb = callbacks()
		const eventCounter = { count: 2 }
		const fetchFn = vi.fn<MockFetch>(async () =>
			sseResponse(
				[JSON.stringify({ type: 'response_chunk', content: 'continued' }), JSON.stringify({ type: 'done' })],
				{ headers: { 'Content-Type': 'text/event-stream' } }
			)
		)

		await fetchAgenticResponse({
			mutation: {
				clientMutationId: 'mutation-1',
				message: 'continue',
				sessionId: 'session-1',
				enablePremiumTools: false
			},
			callbacks: cb,
			fetchFn: fetchFn as unknown as typeof fetch,
			eventCounter
		})

		expect(eventCounter.count).toBe(4)
	})

	test('passes queue revision and fired-item identity to the coordinator', async () => {
		const cb = callbacks()
		const queued = {
			id: 'queue-1',
			state: 'firing',
			message: 'follow up',
			researchMode: false,
			client: 'web',
			queuedAt: 'now'
		}

		await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'queue_updated', sessionId: 'session-1', revision: 12, queue: [queued] }),
				JSON.stringify({ type: 'user_message_id', messageId: 'message-1', queueItemId: 'queue-1' })
			),
			cb
		)

		expect(cb.onQueueUpdated).toHaveBeenCalledWith({
			sessionId: 'session-1',
			revision: 12,
			queue: [queued]
		})
		expect(cb.onUserMessageId).toHaveBeenCalledWith('message-1', 'queue-1')
	})

	test('preserves editing queue items from the stream snapshot', async () => {
		const cb = callbacks()
		const editing = {
			id: 'queue-1',
			state: 'editing',
			message: 'follow up',
			researchMode: false,
			client: 'web',
			queuedAt: 'now',
			editLeaseId: 'lease-1',
			editExpiresAt: 'later'
		}

		await parseSSEStream(
			sseReader(JSON.stringify({ type: 'queue_updated', sessionId: 'session-1', revision: 13, queue: [editing] })),
			cb
		)

		expect(cb.onQueueUpdated).toHaveBeenCalledWith({
			sessionId: 'session-1',
			revision: 13,
			queue: [editing]
		})
	})

	test('preserves nested dashboard chart payloads', async () => {
		const cb = callbacks()
		const chartData = {
			'chart-1': {
				config: chartConfig,
				data: [{ timestamp: 1, tvl: 100 }],
				toolChain: [{ name: 'generate_chart' }]
			}
		}
		const artifactOutcomes = [
			{
				itemId: 'item-1',
				chartRef: 'chart-1',
				artifactId: 'artifact-1',
				versionId: 'version-1',
				status: 'live',
				containsPremium: true,
				estimatedMaxCostUsd: 0.025
			}
		]

		await parseSSEStream(
			sseReader(
				JSON.stringify({
					type: 'dashboard',
					content: {
						dashboard_id: 'dash-1',
						dashboardConfig: {
							dashboardName: 'Nested dashboard',
							items: [{ id: 'item-1', kind: 'llamaai-chart', chartRef: 'chart-1', title: 'TVL' }]
						},
						chartData,
						artifactOutcomes
					}
				})
			),
			cb
		)

		expect(cb.onDashboard).toHaveBeenCalledWith({
			id: 'dash-1',
			dashboardName: 'Nested dashboard',
			items: [{ id: 'item-1', kind: 'llamaai-chart', chartRef: 'chart-1', title: 'TVL' }],
			chartData,
			artifactOutcomes
		})
	})

	test('normalizes malformed optional SSE fields instead of aborting the stream', async () => {
		const cb = callbacks()

		const result = await parseSSEStream(
			sseReader(
				JSON.stringify({ type: 'response_chunk', content: 123 }),
				JSON.stringify({
					type: 'charts',
					charts: [chartConfig, { id: 'bad' }],
					chartData: [{ timestamp: 1, tvl: 100 }]
				}),
				JSON.stringify({ type: 'generated_images' }),
				JSON.stringify({ type: 'csv_export', exports: {} }),
				JSON.stringify({ type: 'md_export', exports: null }),
				JSON.stringify({ type: 'citations' }),
				JSON.stringify({ type: 'todo_snapshot' }),
				JSON.stringify({
					type: 'alert_proposed',
					content: {
						alertId: 'alert-1',
						title: 'Fee alert',
						alertIntent: { deliveryChannel: 'slack', slackTeamId: 'T1', slackChannelName: 'alerts' }
					}
				}),
				JSON.stringify({
					type: 'dashboard',
					dashboardConfig: {},
					chartData: {
						'chart-1': {
							config: chartConfig,
							data: [{ timestamp: 1, tvl: 100 }],
							toolChain: 'legacy-bad-tool-chain'
						},
						malformed: { config: { id: 'bad' }, data: [{ timestamp: 2, tvl: 200 }] }
					}
				}),
				JSON.stringify({ type: 'done' })
			),
			cb
		)

		expect(result).toEqual({ sawDone: true })
		expect(cb.onToken).not.toHaveBeenCalled()
		expect(cb.onCharts).toHaveBeenCalledWith([chartConfig], { 'chart-1': [{ timestamp: 1, tvl: 100 }] })
		expect(cb.onGeneratedImages).toHaveBeenCalledWith([])
		expect(cb.onCsvExport).toHaveBeenCalledWith([])
		expect(cb.onMdExport).toHaveBeenCalledWith([])
		expect(cb.onCitations).toHaveBeenCalledWith([])
		expect(cb.onTodos).toHaveBeenCalledWith([])
		expect(cb.onAlertProposed).toHaveBeenCalledWith({
			alertId: 'alert-1',
			title: 'Fee alert',
			alertIntent: {
				frequency: 'daily',
				hour: 9,
				timezone: 'UTC',
				dayOfWeek: undefined,
				deliveryChannel: 'slack',
				slackTeamId: 'T1',
				slackTeamName: null,
				slackChannelId: null,
				slackChannelName: 'alerts'
			},
			schedule_expression: '',
			next_run_at: ''
		})
		expect(cb.onDashboard).toHaveBeenCalledWith(
			expect.objectContaining({
				id: expect.stringMatching(/^dashboard_Dashboard__[a-f0-9]{16}$/),
				dashboardName: 'Dashboard',
				items: [],
				chartData: {
					'chart-1': {
						config: chartConfig,
						data: [{ timestamp: 1, tvl: 100 }],
						toolChain: []
					}
				}
			})
		)
	})

	test('uses dashboard item identity, not item count, for fallback ids', async () => {
		const cb = callbacks()

		await parseSSEStream(
			sseReader(
				JSON.stringify({
					type: 'dashboard',
					dashboardConfig: {
						dashboardName: 'Dash',
						items: [{ kind: 'llamaai-chart', chartRef: 'chart-1', title: 'TVL' }]
					}
				}),
				JSON.stringify({
					type: 'dashboard',
					dashboardConfig: {
						dashboardName: 'Dash',
						items: [{ kind: 'llamaai-chart', chartRef: 'chart-2', title: 'Fees' }]
					}
				})
			),
			cb
		)

		const ids = vi.mocked(cb.onDashboard!).mock.calls.map(([dashboard]) => dashboard.id)
		expect(ids).toHaveLength(2)
		expect(ids[0]).not.toBe(ids[1])
	})
})

describe('fetchAgenticResponse', () => {
	test('captures a mutation envelope independently from mutable composer inputs', () => {
		const entities = [{ term: 'Ethereum', slug: 'ethereum', type: 'chain' }]
		const pageContext = { entitySlug: 'ethereum', entityType: 'chain' as const, route: '/chain/ethereum' }
		const mutation = createAgenticMutationEnvelope({
			clientMutationId: 'mutation-1',
			message: 'Question',
			sessionId: 'session-1',
			mode: 'quick',
			enablePremiumTools: false,
			entities,
			pageContext
		})

		entities[0]!.term = 'Changed'
		pageContext.route = '/changed'

		expect(mutation.entities?.[0]?.term).toBe('Ethereum')
		expect(mutation.pageContext?.route).toBe('/chain/ethereum')
		expect(mutation).not.toHaveProperty('mode')
	})

	test('preserves safe chart artifact refs from the stream for direct save', async () => {
		const cb = callbacks()
		await parseSSEStream(
			sseReader(
				JSON.stringify({
					type: 'charts',
					charts: [chartConfig],
					chartData: { 'chart-1': [{ timestamp: 1, tvl: 100 }] },
					artifactRefs: {
						'chart-1': {
							artifactId: 'artifact-1',
							versionId: 'version-1',
							status: 'live',
							containsPremium: true,
							estimatedMaxCostUsd: 0.005
						}
					}
				})
			),
			cb
		)
		expect(cb.onCharts).toHaveBeenCalledWith(
			[chartConfig],
			{ 'chart-1': [{ timestamp: 1, tvl: 100 }] },
			{
				'chart-1': {
					artifactId: 'artifact-1',
					versionId: 'version-1',
					status: 'live',
					containsPremium: true,
					estimatedMaxCostUsd: 0.005
				}
			}
		)
	})

	test('posts the agentic request and dispatches the streamed response contract', async () => {
		const cb = callbacks()
		const eventCounter = { count: 0 }
		const fetchFn = vi.fn<MockFetch>(async () =>
			sseResponse([
				JSON.stringify({ type: 'session', sessionId: 'session-1', startedAt: 123, streamCursor: 0 }),
				JSON.stringify({ type: 'response_chunk', content: 'hello<bill />', streamCursor: 1 }),
				JSON.stringify({
					type: 'charts',
					charts: [chartConfig],
					chartData: {
						'chart-1': [{ timestamp: 1, tvl: 100 }],
						'chart-2': [{ timestamp: 2, tvl: 200 }]
					},
					streamCursor: 2
				}),
				JSON.stringify({
					type: 'dashboard',
					dashboard_id: 'dash-1',
					dashboardConfig: {
						dashboardName: 'Protocol dashboard',
						items: [{ kind: 'llamaai-chart', chartRef: 'chart-1', title: 'TVL' }],
						timePeriod: '30d',
						sourceDashboardId: 'source-1'
					},
					chartData: {
						'chart-1': {
							config: chartConfig,
							data: [{ timestamp: 1, tvl: 100 }],
							toolChain: [{ name: 'generate_chart' }]
						}
					},
					streamCursor: 3
				}),
				JSON.stringify({ type: 'citations', citations: ['https://example.com'], streamCursor: 4 }),
				JSON.stringify({ type: 'tool_execution', name: 'search', success: true, streamCursor: 5 }),
				JSON.stringify({ type: 'done', streamCursor: 6 })
			])
		)

		await fetchAgenticResponse({
			mutation: {
				clientMutationId: 'mutation-1',
				message: 'Build a chart',
				sessionId: 'session-1',
				mode: 'research',
				enablePremiumTools: true,
				entities: [{ term: 'Ethereum', slug: 'ethereum', type: 'chain' }],
				pageContext: { entitySlug: 'ethereum', entityType: 'chain', route: '/chain/ethereum' },
				isSuggestedQuestion: true,
				model: 'gpt-5',
				effort: 'high',
				shareToken: 'share-1',
				editMessageId: 'message-1',
				projectId: 'project-1',
				timezone: 'UTC'
			},
			callbacks: cb,
			fetchFn: fetchFn as unknown as typeof fetch,
			eventCounter
		})

		expect(fetchFn).toHaveBeenCalledOnce()
		expect(fetchFn.mock.calls[0]?.[0]).toBe(`${AI_SERVER}/agentic`)
		const init = fetchFn.mock.calls[0]?.[1] as RequestInit
		expect(init.method).toBe('POST')
		expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
		const body = readRequestBody(fetchFn)
		expect(body).toMatchObject({
			clientMutationId: 'mutation-1',
			message: 'Build a chart',
			stream: true,
			sessionId: 'session-1',
			mode: 'research',
			enablePremiumTools: true,
			entities: [{ term: 'Ethereum', slug: 'ethereum', type: 'chain' }],
			pageContext: { entitySlug: 'ethereum', entityType: 'chain', route: '/chain/ethereum' },
			isSuggestedQuestion: true,
			model: 'gpt-5',
			effort: 'high',
			shareToken: 'share-1',
			editMessageId: 'message-1',
			projectId: 'project-1'
		})
		expect(typeof body.timezone).toBe('string')
		expect(body).not.toHaveProperty('images')
		expect(body).not.toHaveProperty('blockedSkills')

		expect(eventCounter.count).toBe(6)
		expect(cb.onSessionId).toHaveBeenCalledWith('session-1', 123)
		expect(cb.onToken).toHaveBeenCalledWith('hello')
		expect(cb.onCharts).toHaveBeenCalledWith([chartConfig], {
			'chart-1': [{ timestamp: 1, tvl: 100 }],
			'chart-2': [{ timestamp: 2, tvl: 200 }]
		})
		expect(cb.onDashboard).toHaveBeenCalledWith({
			id: 'dash-1',
			dashboardName: 'Protocol dashboard',
			items: [{ kind: 'llamaai-chart', chartRef: 'chart-1', title: 'TVL' }],
			timePeriod: '30d',
			sourceDashboardId: 'source-1',
			chartData: {
				'chart-1': {
					config: chartConfig,
					data: [{ timestamp: 1, tvl: 100 }],
					toolChain: [{ name: 'generate_chart' }]
				}
			}
		})
		expect(cb.onCitations).toHaveBeenCalledWith(['https://example.com'])
		expect(cb.onToolExecution).toHaveBeenCalledWith({ type: 'tool_execution', name: 'search', success: true })
		expect(cb.onDone).toHaveBeenCalledOnce()
	})

	test('turns a successful stream without done into a reconnectable failure unless aborted', async () => {
		const cb = callbacks()
		const fetchFn = vi.fn<MockFetch>(async () =>
			sseResponse([JSON.stringify({ type: 'response_chunk', content: 'partial' })])
		)

		await expect(
			fetchAgenticResponse({
				mutation: {
					clientMutationId: 'mutation-1',
					message: 'Continue',
					sessionId: 'session-1',
					enablePremiumTools: false
				},
				callbacks: cb,
				fetchFn: fetchFn as unknown as typeof fetch
			})
		).rejects.toThrow('Stream ended without done event')

		expect(cb.onToken).toHaveBeenCalledWith('partial')
		expect(cb.onDone).not.toHaveBeenCalled()

		const aborted = new AbortController()
		aborted.abort()
		await expect(
			fetchAgenticResponse({
				mutation: {
					clientMutationId: 'mutation-1',
					message: 'Continue',
					sessionId: 'session-1',
					enablePremiumTools: false
				},
				callbacks: callbacks(),
				abortSignal: aborted.signal,
				fetchFn: fetchFn as unknown as typeof fetch
			})
		).resolves.toBeUndefined()
	})

	test('preserves backend limit error details', async () => {
		const freeLimitFetch = vi.fn<MockFetch>(async () =>
			jsonResponse(
				{
					code: 'FREE_DAILY_LIMIT',
					content: 'Daily free limit reached',
					upgradeUrl: 'https://defillama.com/pro',
					details: { period: 'daily', limit: 5, resetTime: '2026-05-24T00:00:00.000Z' }
				},
				{ status: 403 }
			)
		)

		await expect(
			fetchAgenticResponse({
				mutation: {
					clientMutationId: 'mutation-1',
					message: 'Question',
					sessionId: 'session-1',
					enablePremiumTools: false
				},
				callbacks: callbacks(),
				fetchFn: freeLimitFetch as unknown as typeof fetch
			})
		).rejects.toMatchObject({
			message: 'Daily free limit reached',
			code: 'FREE_DAILY_LIMIT',
			upgradeUrl: 'https://defillama.com/pro',
			details: { period: 'daily', limit: 5, resetTime: '2026-05-24T00:00:00.000Z' }
		})

		const usageLimitFetch = vi.fn<MockFetch>(async () =>
			jsonResponse(
				{
					code: 'USAGE_LIMIT_EXCEEDED',
					content: 'Usage limit reached',
					details: { period: 'monthly', limit: 100, resetTime: null }
				},
				{ status: 403 }
			)
		)

		await expect(
			fetchAgenticResponse({
				mutation: {
					clientMutationId: 'mutation-1',
					message: 'Question',
					sessionId: 'session-1',
					enablePremiumTools: false
				},
				callbacks: callbacks(),
				fetchFn: usageLimitFetch as unknown as typeof fetch
			})
		).rejects.toMatchObject({
			message: 'Usage limit reached',
			code: 'USAGE_LIMIT_EXCEEDED',
			details: { period: 'monthly', limit: 100, resetTime: null }
		})
	})

	test('returns typed mutation reconciliation details', async () => {
		const fetchFn = vi.fn<MockFetch>(async () =>
			jsonResponse(
				{
					code: 'MUTATION_RECONCILE',
					status: 'running',
					sessionId: 'canonical-session',
					executionId: 'execution-1'
				},
				{ status: 409 }
			)
		)

		await expect(
			fetchAgenticResponse({
				mutation: {
					clientMutationId: 'mutation-1',
					message: 'Question',
					sessionId: 'optimistic-session',
					enablePremiumTools: false
				},
				callbacks: callbacks(),
				fetchFn: fetchFn as unknown as typeof fetch
			})
		).rejects.toMatchObject({
			name: 'AgenticMutationReconcileError',
			status: 'running',
			sessionId: 'canonical-session',
			executionId: 'execution-1'
		})
	})

	test('automatically retries a pending mutation with the same envelope', async () => {
		const fetchFn = vi
			.fn<MockFetch>()
			.mockResolvedValueOnce(
				jsonResponse(
					{
						code: 'MUTATION_RECONCILE',
						status: 'pending',
						sessionId: 'canonical-session',
						retryAfterMs: 0
					},
					{ status: 409 }
				)
			)
			.mockResolvedValueOnce(sseResponse([JSON.stringify({ type: 'done' })]))
		const mutation = {
			clientMutationId: 'mutation-1',
			message: 'Question',
			sessionId: 'optimistic-session',
			enablePremiumTools: false
		}

		await fetchAgenticResponse({
			mutation,
			callbacks: callbacks(),
			fetchFn: fetchFn as unknown as typeof fetch
		})

		expect(fetchFn).toHaveBeenCalledTimes(2)
		expect(readRequestBody(fetchFn)).toMatchObject(mutation)
		expect(fetchFn.mock.calls[1]?.[1]?.body).toBe(fetchFn.mock.calls[0]?.[1]?.body)
	})

	test('returns pending to the UI when automatic reconciliation reaches its limit', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(0)
		const fetchFn = vi.fn<MockFetch>(async () =>
			jsonResponse(
				{
					code: 'MUTATION_RECONCILE',
					status: 'pending',
					sessionId: 'canonical-session',
					retryAfterMs: 5000
				},
				{ status: 409 }
			)
		)
		const request = fetchAgenticResponse({
			mutation: {
				clientMutationId: 'mutation-1',
				message: 'Question',
				sessionId: 'optimistic-session',
				enablePremiumTools: false
			},
			callbacks: callbacks(),
			fetchFn: fetchFn as unknown as typeof fetch
		})
		const outcome = expect(request).rejects.toMatchObject({
			name: 'AgenticMutationReconcileError',
			status: 'pending',
			sessionId: 'canonical-session'
		})

		try {
			await vi.advanceTimersByTimeAsync(35_000)
			await outcome
		} finally {
			vi.useRealTimers()
		}
	})

	test('distinguishes a held wait ending from a dropped execution stream', async () => {
		const expiredFetch = vi.fn<MockFetch>(async () =>
			sseResponse([
				JSON.stringify({
					type: 'queue_wait_ended',
					reason: 'timeout',
					sessionId: 'session-1',
					revision: 1,
					queue: []
				})
			])
		)
		const expiredCallbacks = callbacks()
		await expect(
			attachAgenticStream({
				sessionId: 'session-1',
				callbacks: expiredCallbacks,
				fetchFn: expiredFetch as unknown as typeof fetch,
				waitMs: 90_000
			})
		).resolves.toBe('timeout')
		expect(expiredCallbacks.onQueueUpdated).toHaveBeenCalledWith({
			sessionId: 'session-1',
			revision: 1,
			queue: []
		})

		const droppedFetch = vi.fn<MockFetch>(async () =>
			sseResponse([JSON.stringify({ type: 'response_chunk', content: 'partial' })])
		)
		await expect(
			attachAgenticStream({
				sessionId: 'session-1',
				callbacks: callbacks(),
				fetchFn: droppedFetch as unknown as typeof fetch,
				waitMs: 90_000
			})
		).rejects.toThrow('Stream ended without done event')

		const missingFetch = vi.fn<MockFetch>(async () => new Response('missing', { status: 404 }))
		await expect(
			attachAgenticStream({
				sessionId: 'session-1',
				callbacks: callbacks(),
				fetchFn: missingFetch as unknown as typeof fetch,
				waitMs: 90_000
			})
		).resolves.toBe('not_found')
	})

	test('pins replay to the discovered execution identity', async () => {
		const execution = {
			cursor: 0,
			hasResult: false,
			messageId: 'message-2',
			startedAt: 123,
			status: 'running' as const
		}
		const fetchFn = vi.fn<MockFetch>(async () =>
			jsonResponse({ error: 'execution_changed', execution }, { status: 409 })
		)

		await expect(
			attachAgenticStream({
				sessionId: 'session-1',
				expectedMessageId: 'message-1',
				callbacks: callbacks(),
				fetchFn: fetchFn as unknown as typeof fetch,
				waitMs: 90_000
			})
		).rejects.toEqual(new AgenticExecutionChangedError(execution))
		expect(fetchFn.mock.calls[0]?.[0]).toContain('expectedMessageId=message-1')
	})

	test('requires the terminal queue snapshot before confirming Stop', async () => {
		const snapshot = { sessionId: 'session-1', revision: 2, queue: [] }
		const confirmedFetch = vi.fn<MockFetch>(async () => jsonResponse({ stopped: true, active: false, snapshot }))
		await expect(stopAgenticExecution('session-1', confirmedFetch as unknown as typeof fetch)).resolves.toEqual({
			stopped: true,
			active: false,
			snapshot
		})

		const incompleteFetch = vi.fn<MockFetch>(async () => jsonResponse({ stopped: true, active: false }))
		await expect(stopAgenticExecution('session-1', incompleteFetch as unknown as typeof fetch)).rejects.toThrow(
			'Invalid stop response'
		)
	})
})
