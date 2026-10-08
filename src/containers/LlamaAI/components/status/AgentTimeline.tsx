import { useEffect, useRef, useState } from 'react'
import { reasoningPreview, summarizeSteps, toolPreview, toolStepHasDetails } from '~/containers/LlamaAI/agentSteps'
import {
	CODE_BLOCK,
	DATA_TABLE,
	DATA_TABLE_CELL,
	DATA_TABLE_HEAD,
	DATA_TABLE_WRAPPER
} from '~/containers/LlamaAI/components/codeBlockStyles'
import { ToolDataView } from '~/containers/LlamaAI/components/messages/ToolDataView'
import {
	LLAMA_AI_ANIMATION_SRC,
	LLAMA_AI_HACKER_ANIMATION_SRC
} from '~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads'
import { useCurrentSecond } from '~/containers/LlamaAI/components/status/useCurrentSecond'
import { useHackerMode } from '~/containers/LlamaAI/components/status/useHackerMode'
import { getToolLabel, TOOL_ICONS, TOOL_TONE_CLASS } from '~/containers/LlamaAI/toolMetadata'
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
const FALLBACK_ICON = { icon: 'sparkles', tone: 'neutral' } as const
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

	return <span className="mono-sm text-tertiary tabular-nums">{elapsed}s</span>
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
			height={14}
			width={14}
			className={`shrink-0 text-tertiary duration-150 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}
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

	let failed = 0
	for (const step of steps) {
		if (step.kind !== 'tool' || !step.execution) continue
		if (!step.execution.success) failed++
	}
	const last = steps[steps.length - 1]
	const showTrailingThinking = streaming && (!last || (last.kind === 'tool' && last.status !== 'running'))
	const text = hackerMode ? 'font-mono text-ai-terminal drop-shadow-ai-terminal' : 'text-secondary'
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
			<section className={`flex gap-3 ${indent ? 'border-l-2 border-subtle pl-4' : ''}`} aria-label="LlamaAI progress">
				{/* Rows stream too fast to announce; the phase is the one sentence worth hearing. */}
				<p role="status" aria-live="polite" className="sr-only">
					{phrase}
				</p>
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
						className={`flex w-full items-center gap-2 text-left label-md ${text}`}
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
			className={`flex flex-col gap-1.5 ${indent ? 'border-l-2 border-subtle pl-4' : ''}`}
			aria-label="LlamaAI steps"
		>
			<p role="status" className="sr-only">
				{summarizeSteps(steps)}
			</p>
			<button
				type="button"
				onClick={() => setToggled(!expanded)}
				aria-expanded={expanded}
				className={`flex w-full items-center gap-2 rounded-md py-1 text-left label-sm not-disabled:not-aria-disabled:hover:bg-hover-row ${text}`}
			>
				<Icon
					name="check"
					height={12}
					width={12}
					className={`shrink-0 ${failed > 0 ? 'text-warning' : 'text-success'}`}
				/>
				<span className="min-w-0 flex-1 truncate">{summarizeSteps(steps)}</span>
				{failed > 0 ? <span className="shrink-0 body-sm text-warning">{failed} failed</span> : null}

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
	const muted = hackerMode ? 'text-ai-terminal-dim' : 'text-tertiary'

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
						<Icon name="layers" height={14} width={14} className="shrink-0 text-tertiary motion-safe:animate-pulse" />
						<span className={`body-sm ${muted}`}>Optimizing context memory&hellip;</span>
					</div>
				</li>
			) : null}
			{factCheckPhase ? (
				<li className="overflow-clip">
					<div className="flex items-center gap-2 py-0.5 motion-safe:animate-ai-step-enter">
						<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
						<span className={`body-sm ${muted}`}>{FACT_CHECK_LABELS[factCheckPhase]}&hellip;</span>
					</div>
				</li>
			) : null}
			{agents.map((agent) => (
				<li key={agent.id} className="overflow-clip">
					<div className="flex items-center gap-2 py-0.5 motion-safe:animate-ai-step-enter">
						{agent.status === 'completed' ? (
							<Icon name="check" height={14} width={14} className="shrink-0 text-success" />
						) : agent.status === 'error' ? (
							<Icon name="x" height={14} width={14} className="shrink-0 text-error" />
						) : (
							<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
						)}
						<span className={`truncate body-sm ${muted}`}>
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
					<div className={`flex items-center gap-2 py-0.5 body-sm motion-safe:animate-ai-step-enter ${muted}`}>
						<span className="size-1.5 shrink-0 rounded-full bg-border-strong" />
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
					className="flex items-center gap-2 py-0.5 text-left label-sm"
				>
					<span
						className={`size-1.5 shrink-0 rounded-full ${live ? 'bg-brand motion-safe:animate-pulse' : 'bg-border-strong'}`}
					/>
					<span className="flex min-w-0 flex-1 items-baseline gap-1">
						<span className={`shrink-0 font-semibold ${hackerMode ? 'text-ai-terminal' : 'text-secondary'}`}>
							Reasoning
						</span>
						{open ? null : (
							<span className={`truncate ${hackerMode ? 'text-ai-terminal-dim' : 'text-tertiary'}`}>
								: {reasoningPreview(step.text)}
							</span>
						)}
					</span>
					<Chevron open={open} />
				</button>
				{open ? (
					<div
						className={`mt-0.5 mb-1 ml-3.5 border-l border-subtle pl-3 mono-sm whitespace-pre-wrap ${
							hackerMode ? 'text-ai-terminal-dim' : 'text-tertiary'
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
	const preview = toolPreview(step, showToolDetails)
	const { execution } = step
	const hasDetails = toolStepHasDetails(step, showToolDetails)
	const parsedCost = execution?.costUsd ? parseFloat(execution.costUsd) : NaN
	// Reasoning and tool rows share one uncarded row; only an opened row's details get a block.
	const row = (
		<>
			{hasDetails ? <Chevron open={open} /> : <span className="w-3 shrink-0" />}
			{step.status === 'running' ? (
				<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
			) : step.status === 'done' ? (
				<Icon name="check" height={14} width={14} className="shrink-0 text-success" />
			) : (
				<Icon name="x" height={14} width={14} className="shrink-0 text-error" />
			)}
			<Icon
				name={meta.icon as never}
				height={14}
				width={14}
				className={`shrink-0 ${hackerMode ? 'text-ai-terminal' : TOOL_TONE_CLASS[meta.tone]}`}
			/>
			<span className="flex min-w-0 flex-1 items-baseline gap-1">
				<span className={`shrink-0 font-semibold ${hackerMode ? 'text-ai-terminal' : 'text-secondary'}`}>
					{step.label}
				</span>
				{preview ? (
					<span className={`truncate mono-sm ${hackerMode ? 'text-ai-terminal-dim' : 'text-tertiary'}`}>
						: {preview}
					</span>
				) : null}
			</span>
			{step.isPremium || execution?.costUsd ? (
				<span className="shrink-0 rounded-full bg-warning-tint px-1.5 py-px label-xs text-warning">
					Premium{Number.isFinite(parsedCost) ? ` ${formatStepCost(parsedCost)}` : ''}
				</span>
			) : null}
			<span className="shrink-0 mono-sm text-tertiary tabular-nums">
				{step.status === 'running'
					? 'running'
					: execution
						? formatStepDuration(execution.executionTimeMs)
						: 'completed'}
			</span>
		</>
	)

	return (
		<li className="overflow-clip">
			<div className="flex flex-col motion-safe:animate-ai-step-enter">
				{hasDetails ? (
					<button
						type="button"
						onClick={() => setOpen(!open)}
						aria-expanded={open}
						className="flex w-full items-center gap-2 rounded-md py-0.5 text-left label-sm not-disabled:not-aria-disabled:hover:bg-hover-row"
					>
						{row}
					</button>
				) : (
					<div className="flex w-full items-center gap-2 py-0.5 body-sm">{row}</div>
				)}
				{open && hasDetails ? (
					<div
						className={`mt-1 mb-1 ml-3.5 flex flex-col gap-1.5 rounded-lg border p-2 select-text ${
							hackerMode ? 'theme-dark border-ai-terminal-muted bg-surface' : 'border-subtle bg-surface'
						}`}
					>
						{showToolDetails && step.params && Object.keys(step.params).length > 0 ? (
							<pre className={CODE_BLOCK}>{JSON.stringify(step.params, null, 2)}</pre>
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
			{execution.error ? (
				<p role="alert" className="m-0 body-sm text-error">
					{execution.error}
				</p>
			) : null}
			{execution.resultCount != null ? (
				<p className="m-0 body-sm text-tertiary">{execution.resultCount} results</p>
			) : null}
			{showToolDetails && execution.sqlQuery ? <pre className={CODE_BLOCK}>{execution.sqlQuery}</pre> : null}
			{showToolDetails && execution.resultPreview && execution.resultPreview.length > 0 ? (
				<div className={DATA_TABLE_WRAPPER}>
					<table className={DATA_TABLE}>
						<thead>
							<tr>
								{Object.keys(execution.resultPreview[0]).map((column) => (
									<th key={column} className={DATA_TABLE_HEAD}>
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{keyedRows(execution.resultPreview).map(({ key, row }) => (
								<tr key={key}>
									{Object.entries(row).map(([column, value]) => (
										<td key={column} className={DATA_TABLE_CELL}>
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
