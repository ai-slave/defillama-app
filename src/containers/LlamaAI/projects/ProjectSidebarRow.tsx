import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BasicLink } from '~/components/Link'
import { RetryNotice } from '~/containers/LlamaAI/components/RetryNotice'
import { AgenticSessionItem } from '~/containers/LlamaAI/components/sidebar/AgenticSessionItem'
import { SIDEBAR_ROW_SURFACE } from '~/containers/LlamaAI/components/sidebar/AgenticSidebar'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { removeStorageItem, setStorageItem } from '~/contexts/localStorageStore'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Skeleton } from '~/ui/Skeleton'
import { CreateProjectModal } from './CreateProjectModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { useProjectSessions } from './hooks'
import { orderVisibleProjectSessions } from './sessionOrdering'
import type { ProjectWithStats } from './types'

interface ProjectSidebarRowProps {
	project: ProjectWithStats
	storageKey: string
	isExpanded: boolean
	isActive: boolean
	isSessionContext: boolean
	sessionById: Map<string, ChatSession>
	currentSessionId?: string | null
	restoringSessionId?: string | null
	onSessionSelect: (sessionId: string) => void
	onDelete: (sessionId: string, projectId?: string | null) => Promise<void>
	onProjectClick: React.MouseEventHandler<HTMLAnchorElement>
	deleteFinalFocus: React.RefObject<HTMLButtonElement | null>
}

export function ProjectSidebarRow({
	project,
	storageKey,
	isExpanded,
	isActive,
	isSessionContext,
	sessionById,
	currentSessionId,
	restoringSessionId,
	onSessionSelect,
	onDelete,
	onProjectClick,
	deleteFinalFocus
}: ProjectSidebarRowProps) {
	const renameStore = Ariakit.useDialogStore()
	const deleteStore = Ariakit.useDialogStore()
	const projectMenuRef = useRef<HTMLButtonElement>(null)
	const isActiveRef = useRef(isActive)
	useLayoutEffect(() => {
		isActiveRef.current = isActive
	}, [isActive])
	const router = useRouter()
	const projectSessions = useProjectSessions(isExpanded ? project.id : null)
	const activeProjectSessions = projectSessions.data
	const visibleProjectSessions = useMemo(
		() => orderVisibleProjectSessions(activeProjectSessions, currentSessionId ?? null, 5),
		[activeProjectSessions, currentSessionId]
	)
	const toSidebarSession = (session: (typeof visibleProjectSessions)[number]): ChatSession => {
		const sessionListEntry = sessionById.get(session.sessionId)
		return {
			sessionId: session.sessionId,
			title: session.title || 'Untitled chat',
			createdAt: session.createdAt,
			lastActivity: session.lastActivity ?? session.createdAt,
			isActive: session.sessionId === currentSessionId,
			isPinned: session.isPinned,
			pinnedAt: session.pinnedAt ?? undefined,
			isPublic: session.isPublic,
			shareToken: session.shareToken ?? undefined,
			hasUnseenCompletion: session.hasUnseenCompletion ?? sessionListEntry?.hasUnseenCompletion,
			projectId: project.id
		}
	}

	return (
		<>
			<div
				data-active={isActive}
				className={`${SIDEBAR_ROW_SURFACE} group/project -mr-2 -ml-4 ${isSessionContext ? 'font-medium text-link' : ''}`}
			>
				<button
					type="button"
					aria-expanded={isExpanded}
					onClick={() => (isExpanded ? removeStorageItem(storageKey) : setStorageItem(storageKey, project.id))}
					className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left hover:bg-hover-row focus-visible:bg-hover-row"
				>
					<Icon
						name={isExpanded ? 'chevron-down' : 'chevron-right'}
						height={14}
						width={14}
						aria-hidden="true"
						className={`-mr-1 shrink-0 text-secondary ${isExpanded ? '' : 'lg:opacity-0 lg:group-focus-within/project:opacity-100 lg:group-hover/project:opacity-100'}`}
					/>
					<Icon
						name="folder"
						height={16}
						width={16}
						aria-hidden="true"
						className={`shrink-0 ${isActive || isSessionContext ? '' : 'text-secondary'}`}
					/>
					<span className="min-w-0 flex-1 truncate">{project.name}</span>
				</button>
				<span className="flex items-center has-aria-expanded:opacity-100 lg:opacity-0 lg:group-focus-within/project:opacity-100 lg:group-hover/project:opacity-100">
					<Button
						as={BasicLink}
						href={`/ai/projects/${project.id}`}
						onClick={onProjectClick}
						aria-label={`New chat in ${project.name}`}
						title={`New chat in ${project.name}`}
						size="sm"
						variant="ghost"
						square
					>
						<Icon name="square-pen" height={16} width={16} aria-hidden="true" />
					</Button>
					<Ariakit.MenuProvider>
						<Ariakit.MenuButton
							aria-label={`Actions for project ${project.name}`}
							ref={projectMenuRef}
							render={<Button type="button" size="sm" variant="ghost" square />}
						>
							<Icon name="ellipsis" height={16} width={16} />
						</Ariakit.MenuButton>
						<MenuSurface variant="actions" aria-label={`Actions for project ${project.name}`}>
							<MenuItem onClick={renameStore.show} className="border-b border-subtle">
								<Icon name="pencil" height={14} width={14} />
								Rename project
							</MenuItem>
							<MenuItem onClick={deleteStore.show} className="text-error!">
								<Icon name="trash-2" height={14} width={14} />
								Delete project
							</MenuItem>
						</MenuSurface>
					</Ariakit.MenuProvider>
				</span>
			</div>
			{isExpanded && projectSessions.error ? (
				<RetryNotice
					message="Couldn't load project chats."
					retrying={projectSessions.isFetching}
					onRetry={() => void projectSessions.refetch()}
				/>
			) : null}
			{isExpanded && projectSessions.isLoading ? (
				<div role="status" aria-label="Loading project chats" className="py-2">
					<Skeleton className="h-3 w-full" />
				</div>
			) : null}
			{isExpanded && visibleProjectSessions.length > 0 ? (
				<ul className="mt-0.5 mb-1 ml-0.5 flex flex-col border-l border-subtle pl-3">
					{visibleProjectSessions.map((s) => {
						const sidebarSession = toSidebarSession(s)
						return (
							<li key={s.sessionId}>
								<AgenticSessionItem
									session={sidebarSession}
									isActive={sidebarSession.sessionId === currentSessionId}
									onSessionSelect={onSessionSelect}
									onDelete={onDelete}
									isRestoring={restoringSessionId === sidebarSession.sessionId}
								/>
							</li>
						)
					})}
					{(activeProjectSessions?.length ?? 0) > visibleProjectSessions.length ? (
						<li>
							<Button
								as={BasicLink}
								href={`/ai/projects/${project.id}`}
								size="sm"
								variant="ghost"
								onClick={onProjectClick}
							>
								Show more
							</Button>
						</li>
					) : null}
				</ul>
			) : null}
			<CreateProjectModal dialogStore={renameStore} mode="rename" project={project} finalFocus={projectMenuRef} />
			<DeleteProjectModal
				dialogStore={deleteStore}
				project={project}
				finalFocus={deleteFinalFocus}
				onDeleted={() => {
					// A completed deletion must not replace a chat opened while the request was running.
					if (isActiveRef.current) void router.push('/ai/projects')
				}}
			/>
		</>
	)
}
