import { useMemo } from 'react'
import type { TodoItem } from '~/containers/LlamaAI/types'

const TODO_STATUS_ORDER: Record<TodoItem['status'], number> = {
	in_progress: 0,
	pending: 1,
	completed: 2,
	cancelled: 3
}

function TodoStatusIcon({ status, animated = true }: { status: TodoItem['status']; animated?: boolean }) {
	if (status === 'completed') {
		return (
			<span
				aria-hidden="true"
				className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-ai-success-vivid bg-ai-success-vivid text-[10px] font-bold text-ai-white"
			>
				✓
			</span>
		)
	}
	if (status === 'in_progress') {
		return (
			<span
				aria-hidden="true"
				className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-brand"
			>
				<span className={`size-1.5 rounded-full bg-brand ${animated ? 'animate-pulse' : ''}`} />
			</span>
		)
	}
	if (status === 'cancelled') {
		return (
			<span
				aria-hidden="true"
				className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-ai-line text-[10px] text-ai-muted line-through"
			>
				✕
			</span>
		)
	}
	return (
		<span
			aria-hidden="true"
			className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-ai-line"
		/>
	)
}

export function TodoChecklistPanel({
	todos,
	isLive = false,
	interrupted = false
}: {
	todos: TodoItem[]
	startTime?: number
	isLive?: boolean
	interrupted?: boolean
}) {
	const orderedTodos = useMemo(() => {
		const seen = new Set<string>()
		const out: TodoItem[] = []
		for (const item of todos) {
			if (seen.has(item.id)) continue
			seen.add(item.id)
			out.push(item)
		}
		return out
	}, [todos])
	if (orderedTodos.length === 0) return null
	const completed = orderedTodos.filter((t) => t.status === 'completed').length
	const total = orderedTodos.filter((t) => t.status !== 'cancelled').length
	return (
		<section
			className="flex flex-col gap-1.5 rounded-lg border border-ai-line bg-surface p-2 sm:p-2.5"
			aria-label="Progress"
		>
			<div className="flex items-center gap-2 px-0.5">
				<span aria-hidden="true" className="text-sm">
					📋
				</span>
				<p className="m-0 flex-1 truncate text-xs font-medium text-ai-secondary sm:text-sm">Progress</p>
				{interrupted ? (
					<p className="m-0 shrink-0 rounded-sm bg-ai-error-vivid/10 px-1.5 py-0.5 text-[10px] text-ai-error sm:text-xs">
						stopped early
					</p>
				) : null}
				<p className="m-0 shrink-0 rounded-sm bg-ai-hover px-1.5 py-0.5 text-[10px] text-ai-tertiary sm:text-xs">
					{completed}/{total} done
				</p>
			</div>
			<ul className="flex flex-col gap-1">
				{orderedTodos.map((todo) => {
					const isActive = todo.status === 'in_progress'
					const isCompleted = todo.status === 'completed'
					const isCancelled = todo.status === 'cancelled'
					return (
						<li key={todo.id} className="flex items-start gap-2 p-0.5">
							<span className="mt-0.5">
								<TodoStatusIcon status={todo.status} animated={isLive} />
							</span>
							<p
								className={`m-0 flex-1 text-xs leading-[1.45] sm:text-sm ${
									isActive
										? 'font-medium text-ai-secondary dark:text-ai-landing-text-strong'
										: isCompleted
											? 'text-ai-muted line-through'
											: isCancelled
												? 'text-ai-secondary line-through dark:text-ai-muted'
												: 'text-ai-tertiary'
								}`}
							>
								{todo.content}
							</p>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

export function deriveTodosFromToolExecutions(
	toolExecutions: Array<{ name?: string; success?: boolean; error?: string; toolData?: unknown }> | undefined
): TodoItem[] {
	if (!toolExecutions || toolExecutions.length === 0) return []
	for (let i = toolExecutions.length - 1; i >= 0; i--) {
		const exec = toolExecutions[i]
		if (exec?.name !== 'todo') continue
		if (exec.success !== true || exec.error) continue
		const data = exec.toolData as { todos?: unknown } | undefined
		if (!data || !Array.isArray(data.todos)) continue
		const valid: TodoItem[] = []
		for (const raw of data.todos) {
			if (!raw || typeof raw !== 'object') continue
			const item = raw as Partial<TodoItem>
			if (!item.id || !item.content || !item.status) continue
			if (TODO_STATUS_ORDER[item.status as TodoItem['status']] === undefined) continue
			valid.push({
				id: String(item.id),
				content: String(item.content),
				status: item.status as TodoItem['status']
			})
		}
		return valid
	}
	return []
}
