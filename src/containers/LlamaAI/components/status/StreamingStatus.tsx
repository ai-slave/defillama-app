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
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

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
			className={`flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-2 sm:p-3 ${indentForActiveTodo ? 'ml-4 border-l-2' : ''}`}
			aria-label={isResearchMode ? 'Parallel research progress' : 'Herd work progress'}
		>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				aria-expanded={isExpanded}
				className="flex items-center gap-2 text-left sm:gap-3"
			>
				<img src={LLAMA_AI_ANIMATION_SRC} alt="" className="size-6 shrink-0" loading="eager" fetchPriority="high" />

				<p className="m-0 flex-1 truncate body-sm text-tertiary sm:body-md">
					{isResearchMode ? <>Researching in parallel&hellip;</> : <>Working in herd&hellip;</>}
				</p>

				<p className="m-0 flex shrink-0 items-center gap-1 rounded-sm bg-surface-elevated-2 px-1.5 py-0.5 body-sm text-tertiary">
					{completed}/{total} done
				</p>

				{/* Out of the button's name, so a screen reader is not re-read the name every second. */}
				<time
					aria-hidden
					className="flex shrink-0 items-center gap-1 rounded-sm bg-surface-elevated-2 px-1.5 py-0.5 mono-sm text-tertiary tabular-nums"
				>
					{formatTime(elapsed)}
				</time>

				<Icon
					name="chevron-right"
					height={14}
					width={14}
					className={`hidden shrink-0 text-tertiary duration-150 motion-safe:transition-transform sm:block ${isExpanded ? 'rotate-90' : ''}`}
				/>
			</button>

			{isExpanded ? (
				<ul className="flex flex-col gap-1 border-t border-subtle pt-2">
					{agentList.map((agent) => (
						<li key={agent.id} className="flex items-center gap-2 pl-1">
							{agent.status === 'completed' ? (
								<Icon name="check" height={14} width={14} className="shrink-0 text-success" />
							) : agent.status === 'error' ? (
								<Icon name="x" height={14} width={14} className="shrink-0 text-error" />
							) : (
								<span className="size-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
							)}
							<p className="m-0 body-sm text-tertiary">
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
				<div role="status" aria-live="polite" className="flex items-center gap-2 border-t border-subtle pt-2">
					<LoadingSpinner size={14} />
					<p className="m-0 flex-1 body-sm text-secondary">
						Connection lost. Reconnecting{recovery.attemptCount > 0 ? ` (attempt ${recovery.attemptCount})` : ''}
						&hellip;
					</p>
					{onReconnect ? (
						<Button type="button" size="sm" onClick={onReconnect}>
							Reconnect now
						</Button>
					) : null}
				</div>
			) : null}
		</section>
	)
}
