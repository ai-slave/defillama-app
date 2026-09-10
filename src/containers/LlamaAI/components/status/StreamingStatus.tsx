import { useMemo, useState } from 'react'
import { LLAMA_AI_ANIMATION_SRC } from '~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads'
import { formatTime } from '~/containers/LlamaAI/components/status/time'
import {
	TodoChecklistPanel,
	deriveTodosFromToolExecutions
} from '~/containers/LlamaAI/components/status/TodoChecklistPanel'
import { useCurrentSecond } from '~/containers/LlamaAI/components/status/useCurrentSecond'
import { useHackerMode } from '~/containers/LlamaAI/components/status/useHackerMode'
import type { RecoveryState } from '~/containers/LlamaAI/streamState'
import { getToolLabel } from '~/containers/LlamaAI/toolMetadata'
import type { SpawnAgentStatus } from '~/containers/LlamaAI/types'

export { TodoChecklistPanel, deriveTodosFromToolExecutions, useHackerMode }

export function SpawnProgressCard({
	agents,
	startTime,
	isResearchMode,
	recovery,
	onReconnect,
	indentForActiveTodo
}: {
	agents: Map<string, SpawnAgentStatus>
	startTime: number
	isResearchMode?: boolean
	recovery?: RecoveryState
	onReconnect?: () => void
	indentForActiveTodo?: boolean
}) {
	const currentSecond = useCurrentSecond()
	const elapsed = startTime ? Math.max(0, currentSecond - Math.floor(startTime / 1000)) : 0
	const [isExpanded, setIsExpanded] = useState(true)

	const agentList = useMemo(() => [...agents.values()], [agents])
	const completed = agentList.filter((agent) => agent.status === 'completed').length
	const total = agentList.length

	return (
		<section
			className={`flex flex-col gap-2 rounded-lg border border-ai-line bg-surface p-2 sm:p-3 ${indentForActiveTodo ? 'ml-4 border-l-2' : ''}`}
			aria-label={isResearchMode ? 'Parallel research progress' : 'Herd work progress'}
		>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 text-left sm:gap-3"
			>
				<img src={LLAMA_AI_ANIMATION_SRC} alt="" className="size-6 shrink-0" loading="eager" fetchPriority="high" />

				<p className="m-0 flex-1 truncate text-xs text-ai-tertiary sm:text-sm">
					{isResearchMode ? <>Researching in parallel&hellip;</> : <>Working in herd&hellip;</>}
				</p>

				<p className="m-0 flex shrink-0 items-center gap-1 rounded-sm bg-ai-hover px-1.5 py-0.5 text-[10px] text-ai-tertiary sm:text-xs">
					{completed}/{total} done
				</p>

				<time className="flex shrink-0 items-center gap-1 rounded-sm bg-ai-hover px-1.5 py-0.5 font-mono text-[10px] text-ai-tertiary tabular-nums sm:text-xs">
					{formatTime(elapsed)}
				</time>

				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="hidden shrink-0 text-ai-tertiary sm:block"
				>
					{isExpanded ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
				</svg>
			</button>

			{isExpanded ? (
				<ul className="flex flex-col gap-1 border-t border-ai-line pt-2">
					{agentList.map((agent) => (
						<li key={agent.id} className="flex items-center gap-2 pl-1">
							{agent.status === 'completed' ? (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="shrink-0 text-ai-success-vivid"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
							) : agent.status === 'error' ? (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="shrink-0 text-ai-error-vivid"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							) : (
								<span className="size-1.5 shrink-0 animate-pulse rounded-full bg-brand" />
							)}
							<p className="m-0 text-xs text-ai-tertiary">
								{agent.id}
								{agent.status === 'tool_call' && agent.tool ? (
									<span className="opacity-60"> - {getToolLabel(agent.tool)}</span>
								) : null}
								{agent.status === 'completed' ? (
									<span className="opacity-60">
										{' '}
										- Complete
										{agent.toolCount != null || agent.chartCount != null ? ' (' : ''}
										{agent.toolCount != null ? `${agent.toolCount} tools` : ''}
										{agent.toolCount != null && agent.chartCount != null ? ', ' : ''}
										{agent.chartCount != null ? `${agent.chartCount} charts` : ''}
										{agent.toolCount != null || agent.chartCount != null ? ')' : ''}
									</span>
								) : null}
								{agent.status === 'started' || agent.status === 'thinking' ? (
									<span className="opacity-60">
										{' '}
										- {agent.status === 'thinking' ? <>Thinking&hellip;</> : <>Starting&hellip;</>}
									</span>
								) : null}
								{agent.status === 'error' ? <span className="opacity-60"> - Error</span> : null}
							</p>
						</li>
					))}
				</ul>
			) : null}

			{recovery?.status === 'reconnecting' ? (
				<div className="flex items-center gap-2 border-t border-ai-warning-soft pt-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="shrink-0 animate-spin text-ai-warning-bright"
					>
						<path d="M21 12a9 9 0 1 1-6.219-8.56" />
					</svg>
					<p className="m-0 flex-1 text-xs text-ai-warning-strong">
						Connection lost. Reconnecting{recovery.attemptCount > 0 ? ` (attempt ${recovery.attemptCount})` : ''}
						&hellip;
					</p>
					{onReconnect ? (
						<button
							type="button"
							onClick={onReconnect}
							className="shrink-0 rounded-md bg-ai-warning-soft px-2.5 py-1 text-xs font-medium text-ai-warning-strong hover:bg-ai-warning"
						>
							Reconnect now
						</button>
					) : null}
				</div>
			) : null}
		</section>
	)
}
