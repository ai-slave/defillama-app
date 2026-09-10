import * as Ariakit from '@ariakit/react'
import Router from 'next/router'
import { useEffect, useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { RetryNotice } from '~/containers/LlamaAI/components/RetryNotice'
import { AgenticSessionItem } from '~/containers/LlamaAI/components/sidebar/AgenticSessionItem'
import { SIDEBAR_ROW } from '~/containers/LlamaAI/components/sidebar/AgenticSidebar'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { useLlamaAINavigate } from '~/contexts/LlamaAINavigate'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { CreateProjectModal } from './CreateProjectModal'
import { useProjectList, useProjectSessions } from './hooks'
import { orderVisibleProjectSessions } from './sessionOrdering'
import { getProjectTier } from './tier'
import type { ProjectWithStats } from './types'

const VISIBLE_LIMIT = 10
const NESTED_SESSIONS_LIMIT = 5
const LAST_SELECTED_PROJECT_KEY_PREFIX = 'llamaai:last-selected-project-id'
const EMPTY_PROJECTS: Array<ProjectWithStats> = []

interface ProjectsSidebarSectionProps {
	sessions?: Array<ChatSession>
	currentProjectId?: string | null
	currentSessionProjectId?: string | null
	currentSessionId?: string | null
	restoringSessionId?: string | null
	onSessionSelect: (sessionId: string) => void
	onDelete: (sessionId: string, projectId?: string | null) => Promise<void>
}

const goTo = (path: string) => {
	void Router.push(path)
}

export function ProjectsSidebarSection({
	sessions = [],
	currentProjectId,
	currentSessionProjectId,
	currentSessionId,
	restoringSessionId,
	onSessionSelect,
	onDelete
}: ProjectsSidebarSectionProps) {
	const { user, hasActiveSubscription, isTrial } = useAuthContext()
	const storageKey = `${LAST_SELECTED_PROJECT_KEY_PREFIX}:${user?.id ?? 'anonymous'}`
	const storedProjectId = useStorageItem(storageKey, null)
	const tier = getProjectTier(user, hasActiveSubscription, isTrial)
	const isLocked = tier === 'free'
	const createStore = Ariakit.useDialogStore()
	const { data, isLoading, error, isFetching, refetch } = useProjectList(!isLocked)
	const expandedProjectId = currentProjectId ?? currentSessionProjectId ?? storedProjectId
	const projectSessions = useProjectSessions(isLocked ? null : expandedProjectId)
	const projects = data ?? EMPTY_PROJECTS
	const visible = useMemo(() => {
		const next = projects.slice(0, VISIBLE_LIMIT)
		if (!expandedProjectId || next.some((p) => p.id === expandedProjectId)) return next
		const activeProject = projects.find((p) => p.id === expandedProjectId)
		if (!activeProject) return next
		if (next.length < VISIBLE_LIMIT) return [...next, activeProject]
		return [...next.slice(0, VISIBLE_LIMIT - 1), activeProject]
	}, [expandedProjectId, projects])
	const hasOverflow = projects.length > VISIBLE_LIMIT
	const activeProjectSessions = projectSessions.data
	const sessionById = useMemo(() => new Map(sessions.map((session) => [session.sessionId, session])), [sessions])
	const visibleProjectSessions = useMemo(
		() => orderVisibleProjectSessions(activeProjectSessions, currentSessionId ?? null, NESTED_SESSIONS_LIMIT),
		[activeProjectSessions, currentSessionId]
	)

	const navigate = useLlamaAINavigate()
	const { hideSidebar } = useLlamaAIChrome()
	const isDrawer = useMedia('(max-width: 1023px)')

	useEffect(() => {
		const activeProjectId = currentProjectId ?? currentSessionProjectId
		if (activeProjectId) setStorageItem(storageKey, activeProjectId)
	}, [currentProjectId, currentSessionProjectId, storageKey])

	const goToProject = (projectId: string) => {
		setStorageItem(storageKey, projectId)
		void navigate.toProject(projectId)
		// On mobile the sidebar is a slide-over drawer; close it on navigation so the
		// project page isn't left covered — matching the chat-tap behavior in AgenticSessionItem.
		if (isDrawer) hideSidebar()
	}

	const onCreated = (project: { id: string }) => {
		setStorageItem(storageKey, project.id)
		goToProject(project.id)
	}

	const toSidebarSession = (session: (typeof visibleProjectSessions)[number], projectId: string): ChatSession => {
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
			projectId
		}
	}

	return (
		<div className="flex flex-col gap-1 px-4">
			<div className="flex min-h-6 items-center justify-between pt-1">
				<h2 className="label-sm text-secondary">Projects</h2>
				<Button type="button" size="sm" variant="ghost" onClick={() => goTo('/ai/projects')} className="-mr-2">
					View all
				</Button>
			</div>

			{isLocked ? (
				<Button type="button" size="md" onClick={() => goTo('/subscription')} className="w-full justify-between">
					<span className="flex items-center gap-1">
						<Icon name="folder-plus" height={14} width={14} />
						Upgrade for projects
					</span>
					<Icon name="chevron-right" height={14} width={14} />
				</Button>
			) : (
				<>
					<Ariakit.DialogDisclosure
						store={createStore}
						type="button"
						className={`${SIDEBAR_ROW} -mx-2 text-left text-secondary not-disabled:not-aria-disabled:hover:text-primary`}
					>
						<Icon name="plus" height={16} width={16} className="shrink-0 text-link" />
						<span className="min-w-0 truncate">New project</span>
					</Ariakit.DialogDisclosure>

					{error ? (
						<RetryNotice message="Couldn't load projects." retrying={isFetching} onRetry={() => void refetch()} />
					) : null}
					{isLoading ? (
						<ul role="status" aria-label="Loading projects" className="flex flex-col">
							{[0, 1, 2].map((i) => (
								<li key={i} className="-mx-2 flex h-8 items-center gap-1.5 px-2 py-1.5">
									<Skeleton className="size-4 shrink-0" />
									<Skeleton className="h-3 flex-1" />
								</li>
							))}
						</ul>
					) : visible.length === 0 ? (
						!error ? (
							<p className="px-2 py-1.5 body-sm text-tertiary">No projects yet</p>
						) : null
					) : (
						<ul className="flex flex-col">
							{visible.map((p) => {
								const isActive = p.id === currentProjectId
								const isSessionContext = !isActive && p.id === currentSessionProjectId
								const isExpanded = p.id === expandedProjectId
								const nestedSessions = isExpanded ? visibleProjectSessions : []
								return (
									<li key={p.id} className="flex flex-col">
										<button
											type="button"
											onClick={() => goToProject(p.id)}
											data-active={isActive}
											className={`${SIDEBAR_ROW} -mx-2 text-left ${isSessionContext ? 'font-medium text-link' : ''}`}
										>
											<Icon
												name="folder"
												height={16}
												width={16}
												aria-hidden="true"
												className={`shrink-0 ${isActive || isSessionContext ? '' : 'text-secondary'}`}
											/>
											<span className="min-w-0 flex-1 truncate">{p.name}</span>
										</button>
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
										{isExpanded && nestedSessions.length > 0 ? (
											<ul className="mt-0.5 mb-1 ml-0.5 flex flex-col border-l border-subtle pl-3">
												{nestedSessions.map((s) => {
													const sidebarSession = toSidebarSession(s, p.id)
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
												{(activeProjectSessions?.length ?? 0) > nestedSessions.length ? (
													<li>
														<Button
															type="button"
															size="sm"
															variant="ghost"
															onClick={() => {
																goToProject(p.id)
																if (isDrawer) hideSidebar()
															}}
														>
															Show more
														</Button>
													</li>
												) : null}
											</ul>
										) : null}
									</li>
								)
							})}
						</ul>
					)}

					{hasOverflow ? (
						<Button type="button" size="sm" variant="ghost" onClick={() => goTo('/ai/projects')} className="self-start">
							All projects ({projects.length})
							<Icon name="arrow-right" height={14} width={14} />
						</Button>
					) : null}
				</>
			)}

			<CreateProjectModal dialogStore={createStore} onCreated={onCreated} />
		</div>
	)
}
