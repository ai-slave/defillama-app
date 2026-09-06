import { describe, expect, test } from 'vitest'
import type { ChartConfiguration } from '../chartTypes'
import { parseMessageToRenderModel } from '../renderModel'
import type { Message } from '../types'

const chart = {
	id: 'chart-1',
	type: 'line',
	title: 'TVL',
	description: '',
	axes: { x: { field: 'date', label: 'Date', type: 'time' }, yAxes: [] },
	series: [],
	dataTransformation: { timeField: 'date', metrics: [] }
} satisfies ChartConfiguration

describe('parseMessageToRenderModel', () => {
	test('keeps a durable chart artifact ref attached to the rendered chart block', () => {
		const artifactRef = {
			artifactId: 'artifact-1',
			versionId: 'version-1',
			status: 'live' as const,
			containsPremium: false,
			estimatedMaxCostUsd: 0
		}
		const message = {
			id: 'message-1',
			role: 'assistant',
			content: '<!-- LLAMA_ARTIFACT:CHART:chart-1 -->',
			charts: [{ charts: [chart], chartData: { 'chart-1': [] }, artifactRefs: { 'chart-1': artifactRef } }]
		} as Message

		expect(parseMessageToRenderModel(message).artifactsById.get('chart-1')).toMatchObject({ artifactRef })
	})
})
