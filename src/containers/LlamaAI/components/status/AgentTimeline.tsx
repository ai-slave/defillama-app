import { useEffect, useRef, useState } from 'react'
import { reasoningPreview, summarizeSteps, toolPreview, toolStepHasDetails } from '~/containers/LlamaAI/agentSteps'
import { ToolDataView } from '~/containers/LlamaAI/components/messages/ToolDataView'
import {
	LLAMA_AI_ANIMATION_SRC,
	LLAMA_AI_HACKER_ANIMATION_SRC
} from '~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads'
import { useCurrentSecond } from '~/containers/LlamaAI/components/status/useCurrentSecond'
import { useHackerMode } from '~/containers/LlamaAI/components/status/useHackerMode'
import { getToolLabel, TOOL_ICONS } from '~/containers/LlamaAI/toolMetadata'
import type { AgentStep, SpawnAgentStatus, ToolExecution } from '~/containers/LlamaAI/types'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { Icon } from '~/ui/Icon'
import { formatNumber, formatUsd } from '~/utils/numberFormat'

type ToolStep = Extract<AgentStep, { kind: 'tool' }>
type FactCheckPhase = 'drafting' | 'verifying' | 'finalizing' | null | undefined

const FACT_CHECK_LABELS = {
	drafting: 'Drafting answer',
	verifying: 'Checking claims',
	finalizing: 'Preparing verified answer'
}
const FALLBACK_ICON = { icon: 'sparkles', color: '#919296' }
// A return scroll toward a moving bottom rarely lands exactly on it; this close counts as being there.
const FOLLOW_THRESHOLD_PX = 48

const formatStepDuration = (ms: number): string => {
	if (ms < 1000) return `${ms}ms`
	if (ms < 60_000) return `${formatNumber(ms / 1000, { maximumFractionDigits: 1 })}s`
	const m = Math.floor(ms / 60_000)
	const s = Math.floor((ms % 60_000) / 1000)
	return `${m}m ${s}s`
}

const formatStepCost = (usd: number): string => {
	const fractionDigits = usd < 0.01 ? 3 : 2
	return formatUsd(usd, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
}

// The server reports when the run started in its first event; until then there is nothing to count.
export function ElapsedTimeLabel({ startedAt }: { startedAt?: number }) {
	const currentSecond = useCurrentSecond()
	if (!startedAt) return null
	const elapsed = Math.max(0, currentSecond - Math.floor(startedAt / 1000))

	return <span className="font-mono text-xs text-ai-muted tabular-nums">{elapsed}s</span>
}

function Caret() {
	return (
		<span
			aria-hidden
			className="ml-0.5 inline-block h-[1em] w-0.5 bg-brand align-[-0.15em] motion-safe:animate-pulse"
		/>
	)
}

function Chevron({ open }: { open: boolean }) {
	return (
		<Icon
			name="chevron-right"
			height={12}
			width={12}
			className={`shrink-0 text-ai-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
		/>
	)
}

/**
 * What the agent did, as one ordered timeline: reasoning rows and tool rows interleaved as they
 * happened, with a tool row moving from running to done in place when its result lands.
 *
 * While a run is active the rows are simply there, under a header with the llama, a fixed phrase and
 * the elapsed time; the header collapses them for anyone who wants it quiet. Once finished the block
 * folds to one sentence of what happened, and that sentence is the disclosure. The same component
 * renders the live status above a draft, a duel arm's draft and the finished message. Compaction,
 * fact-check phases and herd agents are rows in the same list rather than separate blocks. Raw tool
 * names never appear in the default view.
 */
export function AgentTimeline({
	steps,
	streaming,
	executionStartedAt,
	isCompacting,
	factCheckPhase,
	spawnProgress,
	showToolDetails = false,
	indent = false
}: {
	steps: Array<AgentStep>
	streaming: boolean
	executionStartedAt?: number
	isCompacting?: boolean
	factCheckPhase?: FactCheckPhase
	spawnProgress?: Map<string, SpawnAgentStatus>
	showToolDetails?: boolean
	indent?: boolean
}) {
	const hackerMode = useHackerMode()
	// Open while it runs, folded once done; the reader's own toggle wins after that.
	const [toggled, setToggled] = useState<boolean | null>(null)
	const expanded = toggled ?? streaming
	const agents = spawnProgress ? [...spawnProgress.values()] : []
	const hasRows = steps.length > 0 || agents.length > 0 || !!isCompacting || !!factCheckPhase
	if (!streaming && !hasRows) return null

	let totalMs = 0
	let totalCost = 0
	let failed = 0
	for (const step of steps) {
		if (step.kind !== 'tool' || !step.execution) continue
		totalMs += step.execution.executionTimeMs
		if (!step.execution.success) failed++
		const cost = step.execution.costUsd ? parseFloat(step.execution.costUsd) : NaN
		if (Number.isFinite(cost)) totalCost += cost
	}
	const last = steps[steps.length - 1]
	const showTrailingThinking = streaming && (!last || (last.kind === 'tool' && last.status !== 'running'))
	const text = hackerMode ? 'font-mono text-ai-terminal drop-shadow-ai-terminal' : 'text-ai-secondary'
	const rows = expanded ? (
		<TimelineRows
			steps={steps}
			streaming={streaming}
			agents={agents}
			isCompacting={isCompacting}
			factCheckPhase={factCheckPhase}
			showTrailingThinking={showTrailingThinking}
			showToolDetails={showToolDetails}
			hackerMode={hackerMode}
		/>
	) : null

	if (streaming) {
		const phrase = hackerMode
			? '> infiltrating mainframe'
			: isCompacting
				? 'Optimizing context memory'
				: factCheckPhase
					? FACT_CHECK_LABELS[factCheckPhase]
					: 'LlamaAI is working'
		return (
			<section className={`flex gap-3 ${indent ? 'border-l-2 border-ai-line pl-4' : ''}`} aria-label="LlamaAI progress">
				{/* Mounted once per run, not per step, so the animation does not restart. */}
				<img
					src={hackerMode ? LLAMA_AI_HACKER_ANIMATION_SRC : LLAMA_AI_ANIMATION_SRC}
					alt=""
					className={`size-11 shrink-0 ${hackerMode ? 'rounded-lg drop-shadow-ai-terminal' : ''}`}
					loading="eager"
					fetchPriority="high"
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
					<button
						type="button"
						onClick={() => setToggled(!expanded)}
						aria-expanded={expanded}
						aria-label={expanded ? 'Hide steps' : 'Show steps'}
						className={`flex w-full items-center gap-2 text-left text-sm font-semibold ${text}`}
					>
						<span className="min-w-0 flex-1 truncate">{phrase}&hellip;</span>
						<ElapsedTimeLabel startedAt={executionStartedAt} />
						<Chevron open={expanded} />
					</button>
					{rows}
				</div>
			</section>
		)
	}

	return (
		<section
			className={`flex flex-col gap-1.5 ${indent ? 'border-l-2 border-ai-line pl-4' : ''}`}
			aria-label="LlamaAI steps"
		>
			<button
				type="button"
				onClick={() => setToggled(!expanded)}
				aria-expanded={expanded}
				className={`flex w-full items-center gap-2 rounded-md py-1 text-left text-xs hover:bg-ai-hover-faint ${text}`}
			>
				<Icon
					name="check"
					height={12}
					width={12}
					className={`shrink-0 ${failed > 0 ? 'text-ai-warning' : 'text-ai-success-vivid'}`}
				/>
				<span className="min-w-0 flex-1 truncate">{summarizeSteps(steps)}</span>
				{failed > 0 ? <span className="shrink-0 text-[10px] text-ai-warning">{failed} failed</span> : null}
				{totalMs > 0 ? (
					<span className="shrink-0 font-mono text-[10px] text-ai-muted tabular-nums">
						{formatStepDuration(totalMs)}
						{totalCost > 0 ? ` · ${formatStepCost(totalCost)}` : ''}
					</span>
				) : null}
				<Chevron open={expanded} />
			</button>
			{rows}
		</section>
	)
}

function TimelineRows({
	steps,
	streaming,
	agents,
	isCompacting,
	factCheckPhase,
	showTrailingThinking,
	showToolDetails,
	hackerMode
}: {
	steps: Array<AgentStep>
	streaming: boolean
	agents: Array<SpawnAgentStatus>
	isCompacting?: boolean
	factCheckPhase?: FactCheckPhase
	showTrailingThinking: boolean
	showToolDetails: boolean
	hackerMode: boolean
}) {
	const listRef = useRef<HTMLOListElement>(null)
	// Rows clip their entrance: the 4px rise runs on a wrapper inside the row, so it never becomes
	// overflow of this list and never flashes its scrollbar.
	// One scrolling surface for the whole timeline, reasoning text included, with one follow policy:
	// follow the end while streaming until the reader scrolls up, resume when they come back near it.
	// Only the reader's own scrolls decide that. The follow pin below marks its own scroll event so it
	// is skipped, and a clamp from shrinking content lands at the bottom, where it reads as following.
	const scroll = useRef({ follow: true, pinning: false, lastTop: 0 })
	useEffect(() => {
		const list = listRef.current
		if (!list || !streaming || !scroll.current.follow) return
		const before = list.scrollTop
		list.scrollTop = list.scrollHeight
		if (list.scrollTop !== before) scroll.current.pinning = true
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- steps is the trigger: follow the end when a row is added or grows.
	}, [steps, streaming])

	// The row being written is open; it collapses to its preview as soon as any later row arrives.
	const last = steps[steps.length - 1]
	const liveReasoning = streaming && last?.kind === 'reasoning' ? last.id : undefined
	const muted = hackerMode ? 'text-ai-terminal/70' : 'text-ai-tertiary'

	return (
		<ol
			ref={listRef}
			onScroll={() => {
				const list = listRef.current
				if (!list) return
				const state = scroll.current
				const top = list.scrollTop
				const movedUp = top < state.lastTop
				state.lastTop = top
				if (state.pinning) {
					state.pinning = false
					return
				}
				const distance = list.scrollHeight - list.clientHeight - top
				if (distance <= FOLLOW_THRESHOLD_PX) state.follow = true
				else if (movedUp) state.follow = false
			}}
			className="flex max-h-80 [scrollbar-gutter:stable] flex-col gap-1 overflow-y-auto pl-1"
		>
			{steps.map((step) =>
				step.kind === 'reasoning' ? (
					<ReasoningRow key={step.id} step={step} live={step.id === liveReasoning} hackerMode={hackerMode} />
				) : (
					<ToolRow key={step.id} step={step} showToolDetails={showToolDetails} hackerMode={hackerMode} />
				)
			)}
			{isCompacting ? (
				<li className="overflow-clip">
					<div className="flex items-center gap-2 py-0.5 motion-safe:animate-ai-step-enter">
						<Icon name="layers" height={12} width={12} className="shrink-0 text-ai-muted motion-safe:animate-pulse" />
						<span className={`text-xs ${muted}`}>Optimizing context memory&hellip;</span>
					</div>
				</li>
			) : null}
			{factCheckPhase ? (
				<li className="overflow-clip">
					<div className="flex items-center gap-2 py-0.5 motion-safe:animate-ai-step-enter">
						<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
						<span className={`text-xs ${muted}`}>{FACT_CHECK_LABELS[factCheckPhase]}&hellip;</span>
					</div>
				</li>
			) : null}
			{agents.map((agent) => (
				<li key={agent.id} className="overflow-clip">
					<div className="flex items-center gap-2 py-0.5 motion-safe:animate-ai-step-enter">
						{agent.status === 'completed' ? (
							<Icon name="check" height={12} width={12} className="shrink-0 text-ai-success-vivid" />
						) : agent.status === 'error' ? (
							<Icon name="x" height={12} width={12} className="shrink-0 text-ai-error-vivid" />
						) : (
							<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
						)}
						<span className={`truncate text-xs ${muted}`}>
							{agent.id}
							{agent.status === 'tool_call' && agent.tool ? ` — ${getToolLabel(agent.tool)}` : ''}
							{agent.status === 'thinking' ? ' — Thinking…' : ''}
							{agent.status === 'completed' ? ' — Done' : ''}
						</span>
					</div>
				</li>
			))}
			{showTrailingThinking ? (
				<li className="overflow-clip">
					<div className={`flex items-center gap-2 py-0.5 text-xs motion-safe:animate-ai-step-enter ${muted}`}>
						<span className="size-1.5 shrink-0 rounded-full bg-ai-muted" />
						<span>
							Thinking&hellip;
							<Caret />
						</span>
					</div>
				</li>
			) : null}
		</ol>
	)
}

function ReasoningRow({
	step,
	live,
	hackerMode
}: {
	step: Extract<AgentStep, { kind: 'reasoning' }>
	live: boolean
	hackerMode: boolean
}) {
	// Open while it is the row being written; the reader's own toggle wins after that.
	const [toggled, setToggled] = useState<boolean | null>(null)
	const open = toggled ?? live

	return (
		<li className="overflow-clip">
			<div className="flex flex-col motion-safe:animate-ai-step-enter">
				<button
					type="button"
					onClick={() => setToggled(!open)}
					aria-expanded={open}
					className="flex items-center gap-2 py-0.5 text-left text-xs"
				>
					<span
						className={`size-1.5 shrink-0 rounded-full ${live ? 'bg-brand motion-safe:animate-pulse' : 'bg-ai-muted'}`}
					/>
					<span className="flex min-w-0 flex-1 items-baseline gap-1">
						<span className={`shrink-0 font-semibold ${hackerMode ? 'text-ai-terminal' : 'text-ai-secondary'}`}>
							Reasoning
						</span>
						{open ? null : (
							<span className={`truncate ${hackerMode ? 'text-ai-terminal/60' : 'text-ai-muted'}`}>
								: {reasoningPreview(step.text)}
							</span>
						)}
					</span>
					<Chevron open={open} />
				</button>
				{open ? (
					<div
						className={`mt-0.5 mb-1 ml-3.5 border-l border-ai-line pl-3 font-mono text-xs leading-relaxed whitespace-pre-wrap ${
							hackerMode ? 'text-ai-terminal/80' : 'text-ai-tertiary'
						}`}
					>
						{step.text}
						{live ? <Caret /> : null}
					</div>
				) : null}
			</div>
		</li>
	)
}

function ToolRow({
	step,
	showToolDetails,
	hackerMode
}: {
	step: ToolStep
	showToolDetails: boolean
	hackerMode: boolean
}) {
	const [open, setOpen] = useState(false)
	const meta = getOwnRegistryValue(TOOL_ICONS, step.name) || FALLBACK_ICON
	const preview = toolPreview(step)
	const { execution } = step
	const hasDetails = toolStepHasDetails(step, showToolDetails)
	const parsedCost = execution?.costUsd ? parseFloat(execution.costUsd) : NaN

	return (
		<li
			className={`overflow-clip rounded-md border ${
				hackerMode ? 'border-ai-terminal/20 bg-ai-ink' : 'border-ai-line bg-ai-surface-card'
			}`}
		>
			<div className="flex flex-col motion-safe:animate-ai-step-enter">
				<button
					type="button"
					onClick={() => hasDetails && setOpen(!open)}
					aria-expanded={hasDetails ? open : undefined}
					className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${hasDetails ? '' : 'cursor-default'}`}
				>
					{hasDetails ? <Chevron open={open} /> : <span className="w-3 shrink-0" />}
					{step.status === 'running' ? (
						<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
					) : step.status === 'done' ? (
						<Icon name="check" height={12} width={12} className="shrink-0 text-ai-success-vivid" />
					) : (
						<Icon name="x" height={12} width={12} className="shrink-0 text-ai-error-vivid" />
					)}
					<Icon name={meta.icon as never} height={12} width={12} className="shrink-0" style={{ color: meta.color }} />
					<span className="flex min-w-0 flex-1 items-baseline gap-1">
						<span className={`shrink-0 font-semibold ${hackerMode ? 'text-ai-terminal' : 'text-ai-secondary'}`}>
							{step.label}
						</span>
						{preview ? (
							<span className={`truncate font-mono ${hackerMode ? 'text-ai-terminal/60' : 'text-ai-muted'}`}>
								: {preview}
							</span>
						) : null}
					</span>
					{step.isPremium || execution?.costUsd ? (
						<span className="shrink-0 rounded-full bg-ai-warning-soft px-1.5 py-px text-[9px] font-medium text-ai-warning">
							Premium{Number.isFinite(parsedCost) ? ` ${formatStepCost(parsedCost)}` : ''}
						</span>
					) : null}
					<span className="shrink-0 font-mono text-[10px] text-ai-muted tabular-nums">
						{step.status === 'running'
							? 'running'
							: execution
								? formatStepDuration(execution.executionTimeMs)
								: 'completed'}
					</span>
				</button>
				{open && hasDetails ? (
					<div className="flex flex-col gap-1 border-t border-ai-line px-2 py-1.5 select-text">
						{step.params && Object.keys(step.params).length > 0 ? (
							<pre className="m-0 overflow-x-auto rounded-sm bg-ai-surface p-1.5 font-mono text-[10px] text-ai-secondary">
								{JSON.stringify(step.params, null, 2)}
							</pre>
						) : null}
						{execution ? <ToolExecutionDetails execution={execution} showToolDetails={showToolDetails} /> : null}
					</div>
				) : null}
			</div>
		</li>
	)
}

// Preview rows have no ids; number repeats so equal rows still get distinct keys.
function keyedRows(rows: Array<Record<string, unknown>>) {
	const seen = new Map<string, number>()
	return rows.map((row) => {
		const base = Object.values(row).join(' ')
		const count = seen.get(base) ?? 0
		seen.set(base, count + 1)
		return { key: count === 0 ? base : `${base}#${count}`, row }
	})
}

function ToolExecutionDetails({ execution, showToolDetails }: { execution: ToolExecution; showToolDetails: boolean }) {
	return (
		<>
			{execution.error ? <p className="m-0 text-[10px] text-ai-error-vivid/80">{execution.error}</p> : null}
			{execution.resultCount != null ? (
				<p className="m-0 text-[10px] text-ai-muted">{execution.resultCount} results</p>
			) : null}
			{showToolDetails && execution.sqlQuery ? (
				<pre className="m-0 overflow-x-auto rounded-sm border border-ai-line bg-ai-surface p-1.5 font-mono text-[10px] text-ai-secondary">
					{execution.sqlQuery}
				</pre>
			) : null}
			{showToolDetails && execution.resultPreview && execution.resultPreview.length > 0 ? (
				<div className="overflow-x-auto rounded-sm border border-ai-line bg-ai-surface p-1">
					<table className="text-[10px]">
						<thead>
							<tr>
								{Object.keys(execution.resultPreview[0]).map((column) => (
									<th key={column} className="px-1.5 py-0.5 text-left font-medium text-ai-tertiary">
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{keyedRows(execution.resultPreview).map(({ key, row }) => (
								<tr key={key}>
									{Object.entries(row).map(([column, value]) => (
										<td key={column} className="px-1.5 py-0.5 text-ai-secondary">
											{String(value ?? '')}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
			{showToolDetails && execution.toolData ? <ToolDataView name={execution.name} data={execution.toolData} /> : null}
		</>
	)
}
