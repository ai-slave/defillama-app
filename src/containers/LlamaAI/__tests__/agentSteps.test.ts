import { describe, expect, test } from 'vitest'
import {
	appendReasoning,
	completeToolStep,
	reasoningPreview,
	startToolStep,
	stepsForMessage,
	summarizeSteps,
	toolPreview,
	toolStepHasDetails
} from '~/containers/LlamaAI/agentSteps'
import type { AgentStep, ToolExecution } from '~/containers/LlamaAI/types'

const execution = (name: string, tool_call_id: string, extra: Partial<ToolExecution> = {}): ToolExecution => ({
	name,
	tool_call_id,
	executionTimeMs: 40,
	success: true,
	...extra
})

describe('agent steps', () => {
	test('keeps reasoning and tool calls in the order they happened', () => {
		let steps: Array<AgentStep> = []
		steps = appendReasoning(steps, 'Looking at ')
		steps = appendReasoning(steps, 'fees first.')
		steps = startToolStep(steps, {
			name: 'execute_sql',
			params: { query: 'select 1' },
			toolCallId: 'c1'
		})
		steps = startToolStep(steps, {
			name: 'web_search',
			params: { q: 'aave' },
			toolCallId: 'c2',
			isPremium: true
		})
		steps = completeToolStep(steps, execution('web_search', 'c2', { resultCount: 3 }))
		steps = appendReasoning(steps, 'Now the chart.')
		steps = completeToolStep(steps, execution('execute_sql', 'c1'))
		steps = startToolStep(steps, { name: 'generate_chart', params: null, toolCallId: 'c3' })

		expect(steps.map((step) => (step.kind === 'reasoning' ? 'reasoning' : `${step.name}:${step.status}`))).toEqual([
			'reasoning',
			'execute_sql:done',
			'web_search:done',
			'reasoning',
			'generate_chart:running'
		])
		expect(steps[0]).toMatchObject({ kind: 'reasoning', text: 'Looking at fees first.' })
		expect(steps[2]).toMatchObject({
			label: 'Searching the web',
			isPremium: true,
			execution: { resultCount: 3 }
		})
	})

	test('a result updates the row that started it by call id instead of appending a row', () => {
		let steps: Array<AgentStep> = []
		steps = startToolStep(steps, { name: 'execute_sql', params: null, toolCallId: 'a' })
		steps = startToolStep(steps, { name: 'execute_sql', params: null, toolCallId: 'b' })
		steps = completeToolStep(steps, execution('execute_sql', 'a', { success: false, error: 'timeout' }))

		expect(steps).toHaveLength(2)
		expect(steps[0]).toMatchObject({ toolCallId: 'a', status: 'error' })
		expect(steps[1]).toMatchObject({ toolCallId: 'b', status: 'running' })
	})

	test('a result with no call id completes the newest running row of the same tool', () => {
		let steps: Array<AgentStep> = []
		steps = startToolStep(steps, { name: 'web_search', params: null, toolCallId: null })
		steps = startToolStep(steps, { name: 'execute_sql', params: null, toolCallId: null })
		steps = completeToolStep(steps, { name: 'web_search', executionTimeMs: 5, success: true })

		expect(steps.map((step) => step.kind === 'tool' && step.status)).toEqual(['done', 'running'])
	})

	test('a result nobody announced still gets a finished row', () => {
		const steps = completeToolStep([], execution('load_skill', 'z'))
		expect(steps).toEqual([expect.objectContaining({ kind: 'tool', name: 'load_skill', status: 'done', params: null })])
	})

	test('restored messages rebuild rows from persisted reasoning and ordered tool results', () => {
		const steps = stepsForMessage({
			role: 'assistant',
			content: 'Answer',
			thinking: 'Plan the queries.\nThen run them.',
			toolExecutions: [execution('execute_sql', 'q1'), execution('generate_chart', 'q2', { success: false })]
		})
		expect(steps.map((step) => (step.kind === 'reasoning' ? 'reasoning' : `${step.name}:${step.status}`))).toEqual([
			'reasoning',
			'execute_sql:done',
			'generate_chart:error'
		])
		// A message that already carries steps is used as is.
		expect(stepsForMessage({ role: 'assistant', steps })).toBe(steps)
	})

	test('previews a reasoning stretch by its opening words, cut at a word boundary', () => {
		expect(reasoningPreview('Considering accounting tasks. The user wants a ledger.')).toBe(
			'Considering accounting tasks. The user wants a ledger.'
		)
		expect(reasoningPreview('  **Planning** data   queries\nfor the report')).toBe('Planning data queries')
		const long = reasoningPreview(`${'word '.repeat(30)}end`)
		expect(long.endsWith('word…')).toBe(true)
		expect(long.length).toBeLessThanOrEqual(97)
		expect(long).not.toContain('wor…')
	})

	test('summarizes a finished run as a sentence when every tool has a phrase, a count otherwise', () => {
		const tool = (name: string, id: string): AgentStep => ({
			kind: 'tool',
			id,
			toolCallId: id,
			name,
			label: name,
			params: null,
			status: 'done'
		})
		expect(summarizeSteps([])).toBe('Finished')
		expect(summarizeSteps([{ kind: 'reasoning', id: 'r', text: 'x' }])).toBe('Reasoned')
		expect(summarizeSteps([tool('execute_sql', 'a')])).toBe('Queried the database')
		expect(summarizeSteps([tool('execute_sql', 'a'), tool('execute_sql', 'b'), tool('generate_chart', 'c')])).toBe(
			'Queried the database twice and generated a chart'
		)
		expect(
			summarizeSteps([
				tool('web_search', 'a'),
				tool('execute_sql', 'b'),
				tool('execute_sql', 'c'),
				tool('execute_sql', 'd'),
				tool('generate_chart', 'e')
			])
		).toBe('Searched the web, queried the database 3 times and generated a chart')
		expect(summarizeSteps([tool('nansen_pm_trades', 'a'), tool('execute_sql', 'b')])).toBe('Used 2 tools')
		expect(summarizeSteps([tool('nansen_pm_trades', 'a')])).toBe('Used one tool')
	})

	test('previews a tool row by its result once there is one, its arguments until then', () => {
		const running: AgentStep = {
			kind: 'tool',
			id: 't',
			toolCallId: 't',
			name: 'execute_sql',
			label: 'Querying database',
			params: { query: 'select   name\nfrom protocols' },
			status: 'running'
		}
		expect(toolPreview(running, true)).toBe('{"query":"select name from protocols"}')
		expect(
			toolPreview(
				{
					...running,
					status: 'done',
					execution: execution('execute_sql', 't', { resultCount: 1 })
				},
				true
			)
		).toBe('1 result')
		expect(
			toolPreview(
				{
					...running,
					status: 'error',
					execution: execution('execute_sql', 't', { error: 'relation missing' })
				},
				true
			)
		).toBe('relation missing')
		expect(toolPreview({ ...running, params: { q: 'x'.repeat(200) } }, true)).toHaveLength(96)
	})

	test('a tool row opens only when it has arguments or a result worth showing', () => {
		const bare: AgentStep = {
			kind: 'tool',
			id: 't',
			toolCallId: null,
			name: 'load_skill',
			label: 'Loading knowledge',
			params: null,
			status: 'done',
			execution: { name: 'load_skill', executionTimeMs: 5, success: true }
		}
		expect(toolStepHasDetails(bare, true)).toBe(false)
		expect(toolStepHasDetails({ ...bare, params: { skill: 'fees' } }, false)).toBe(false)
		expect(toolStepHasDetails({ ...bare, params: { skill: 'fees' } }, true)).toBe(true)
		expect(toolStepHasDetails({ ...bare, execution: { ...bare.execution!, resultCount: 0 } }, false)).toBe(true)
		expect(toolStepHasDetails({ ...bare, execution: { ...bare.execution!, sqlQuery: 'select 1' } }, false)).toBe(false)
		expect(toolStepHasDetails({ ...bare, execution: { ...bare.execution!, sqlQuery: 'select 1' } }, true)).toBe(true)
	})
})
