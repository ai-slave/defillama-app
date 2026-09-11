import { getToolLabel, TOOL_DONE_PHRASES } from '~/containers/LlamaAI/toolMetadata'
import type { AgentStep, Message, ToolCall, ToolExecution } from '~/containers/LlamaAI/types'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'

const PREVIEW_MAX = 96

/**
 * Append reasoning text to the timeline. Reasoning that follows reasoning extends the open row; after
 * a tool row it starts a new one, which is what puts a fresh "thinking" row between tool calls.
 */
export function appendReasoning(steps: Array<AgentStep>, text: string): Array<AgentStep> {
	const last = steps[steps.length - 1]
	if (last?.kind === 'reasoning') {
		return [...steps.slice(0, -1), { ...last, text: last.text + text }]
	}
	return [...steps, { kind: 'reasoning', id: `reasoning-${steps.length}`, text }]
}

export function startToolStep(steps: Array<AgentStep>, call: ToolCall): Array<AgentStep> {
	return [
		...steps,
		{
			kind: 'tool',
			id: call.toolCallId ?? `tool-${steps.length}`,
			toolCallId: call.toolCallId,
			name: call.name,
			label: getToolLabel(call.name),
			params: call.params,
			...(call.isPremium && { isPremium: true }),
			status: 'running'
		}
	]
}

/**
 * Attach a result to the tool row that started it, matched by call id, or failing that the newest
 * running row for the same tool. A result with no row (a silent call, a restored message) gets its
 * own finished row so nothing the agent did goes missing.
 */
export function completeToolStep(steps: Array<AgentStep>, execution: ToolExecution): Array<AgentStep> {
	let index = -1
	for (let i = steps.length - 1; i >= 0; i--) {
		const step = steps[i]
		if (step.kind !== 'tool' || step.status !== 'running') continue
		if (execution.tool_call_id ? step.toolCallId === execution.tool_call_id : step.name === execution.name) {
			index = i
			break
		}
	}
	const status = execution.success ? 'done' : 'error'
	if (index === -1) {
		return [
			...steps,
			{
				kind: 'tool',
				id: execution.tool_call_id ?? `tool-${steps.length}`,
				toolCallId: execution.tool_call_id ?? null,
				name: execution.name,
				label: getToolLabel(execution.name),
				params: null,
				...(execution.isPremium && { isPremium: true }),
				status,
				execution
			}
		]
	}
	const next = steps.slice()
	next[index] = { ...(steps[index] as Extract<AgentStep, { kind: 'tool' }>), status, execution }
	return next
}

/**
 * Restored messages carry reasoning segments keyed by how many tool results preceded them, and tool
 * results in order. Every result is already finished, so the rows are built directly rather than
 * replayed through the live matching. Older messages carry reasoning as one string, which leads.
 */
export function stepsForMessage(message: Message): Array<AgentStep> {
	if (message.steps) return message.steps
	const steps: Array<AgentStep> = []
	const segments = message.thinkingSegments ?? (message.thinking ? [{ text: message.thinking, toolIndex: 0 }] : [])
	let next = 0
	const pushReasoningBefore = (toolIndex: number) => {
		while (next < segments.length && segments[next].toolIndex <= toolIndex) {
			steps.push({ kind: 'reasoning', id: `reasoning-${next}`, text: segments[next].text })
			next++
		}
	}
	const executions = message.toolExecutions ?? []
	for (const [index, execution] of executions.entries()) {
		pushReasoningBefore(index)
		steps.push({
			kind: 'tool',
			id: execution.tool_call_id ?? `tool-${steps.length}`,
			toolCallId: execution.tool_call_id ?? null,
			name: execution.name,
			label: getToolLabel(execution.name),
			params: null,
			...(execution.isPremium && { isPremium: true }),
			status: execution.success ? 'done' : 'error',
			execution
		})
	}
	pushReasoningBefore(Infinity)
	return steps
}

/** Whether a tool row has anything to show when opened; a bare restored result has not. */
export function toolStepHasDetails(step: Extract<AgentStep, { kind: 'tool' }>, showToolDetails: boolean): boolean {
	if (showToolDetails && step.params && Object.keys(step.params).length > 0) return true
	const { execution } = step
	if (!execution) return false
	if (execution.error || execution.resultCount != null) return true
	return showToolDetails && !!(execution.sqlQuery || execution.resultPreview?.length || execution.toolData)
}

/** The opening words of a reasoning stretch, cut at a word boundary, for the muted text after "Reasoning". */
export function reasoningPreview(text: string): string {
	const line = text
		.replace(/[#*_`]/g, '')
		.trim()
		.split('\n')[0]
		.replace(/\s+/g, ' ')
	if (line.length <= PREVIEW_MAX) return line
	const cut = line.lastIndexOf(' ', PREVIEW_MAX)
	return `${line.slice(0, cut > PREVIEW_MAX / 2 ? cut : PREVIEW_MAX).replace(/[,.;:]$/, '')}…`
}

/**
 * The finished summary line: what the agent did, as a sentence when every tool has a phrase
 * ("Queried the database twice and generated a chart"), a count otherwise.
 */
export function summarizeSteps(steps: Array<AgentStep>): string {
	const counts = new Map<string, number>()
	let reasoned = false
	for (const step of steps) {
		if (step.kind === 'reasoning') reasoned = true
		else counts.set(step.name, (counts.get(step.name) ?? 0) + 1)
	}
	if (counts.size === 0) return reasoned ? 'Reasoned' : 'Finished'
	const phrases: Array<string> = []
	let total = 0
	for (const [name, count] of counts) {
		total += count
		const phrase = getOwnRegistryValue(TOOL_DONE_PHRASES, name)
		if (!phrase) return `Used ${total === 1 && counts.size === 1 ? 'one tool' : `${countAll(counts)} tools`}`
		phrases.push(count === 1 ? phrase : count === 2 ? `${phrase} twice` : `${phrase} ${count} times`)
	}
	const sentence =
		phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`
	return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

function countAll(counts: Map<string, number>): number {
	let total = 0
	for (const count of counts.values()) total += count
	return total
}

/** One muted line after the label: the result once there is one, the arguments until then. */
export function toolPreview(step: Extract<AgentStep, { kind: 'tool' }>, showToolDetails: boolean): string {
	const { execution } = step
	let preview = ''
	if (execution?.error) preview = execution.error
	else if (execution?.resultCount != null)
		preview = `${execution.resultCount} result${execution.resultCount === 1 ? '' : 's'}`
	else if (showToolDetails && execution?.sqlQuery) preview = execution.sqlQuery
	else if (showToolDetails && step.params && Object.keys(step.params).length > 0) preview = JSON.stringify(step.params)
	// One line: JSON escapes newlines and tabs as `\n` and `\t`, so flatten those too.
	preview = preview
		.replace(/\\[nt]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
	return preview.length > PREVIEW_MAX ? `${preview.slice(0, PREVIEW_MAX - 1)}…` : preview
}
