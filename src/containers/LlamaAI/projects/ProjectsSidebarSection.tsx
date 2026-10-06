import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { useLlamaAIChrome } from '~/containers/LlamaAI/chrome'
import { RetryNotice } from '~/containers/LlamaAI/components/RetryNotice'
import { SIDEBAR_ROW } from '~/containers/LlamaAI/components/sidebar/AgenticSidebar'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { removeStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { queryReadFailed } from '~/utils/query'
import { CreateProjectModal } from './CreateProjectModal'
import { useProjectList } from './hooks'
import { ProjectSidebarRow } from './ProjectSidebarRow'
import { getProjectTier } from './tier'
import type { ProjectWithStats } from './types'

const VISIBLE_LIMIT = 10
const LAST_SELECTED_PROJECT_KEY_PREFIX = 'llamaai:last-selected-project-id'
export const SIDEBAR_PROJECTS_OPEN_KEY = 'llamaai:sidebar-projects-open'
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

const EMPTY_SESSIONS: NonNullable<ProjectsSidebarSectionProps['sessions']> = []

export function ProjectsSidebarSection({
	sessions = EMPTY_SESSIONS,
	currentProjectId,
	currentSessionProjectId,
	currentSessionId,
	restoringSessionId,
	onSessionSelect,
	onDelete
}: ProjectsSidebarSectionProps) {
	const { user, hasActiveSubscription, isTrial } = useAuthContext()
	const storageKey = `${LAST_SELECTED_PROJECT_KEY_PREFIX}:${user?.id ?? 'anonymous'}`
	const expandedProjectId = useStorageItem(storageKey, null)
	const isOpen = useStorageItem(SIDEBAR_PROJECTS_OPEN_KEY, null) === 'true'
	const tier = getProjectTier(user, hasActiveSubscription, isTrial)
	const isLocked = tier === 'free'
	const createStore = Ariakit.useDialogStore()
	const createButtonRef = useRef<HTMLButtonElement>(null)
	const projectList = useProjectList(!isLocked)
	const { data, isFetching, refetch } = projectList
	const failed = queryReadFailed(projectList)
	const projects = data ?? EMPTY_PROJECTS
	const visible = useMemo(() => {
		const next = projects.slice(0, VISIBLE_LIMIT)
		if (!expandedProjectId || next.some((p) => p.id === expandedProjectId)) return next
		const activeProject = projects.find((p) => p.id === expandedProjectId)
		if (!activeProject) return next
		if (next.length < VISIBLE_LIMIT) return [...next, activeProject]
		return [...next.slice(0, VISIBLE_LIMIT - 1), activeProject]
	}, [expandedProjectId, projects])
	const sessionById = useMemo(() => new Map(sessions.map((session) => [session.sessionId, session])), [sessions])

	const router = useRouter()
	const { hideSidebar } = useLlamaAIChrome()
	const isDrawer = useMedia('(max-width: 1023px)')

	useEffect(() => {
		const activeProjectId = currentProjectId ?? currentSessionProjectId
		if (activeProjectId) setStorageItem(storageKey, activeProjectId)
	}, [currentProjectId, currentSessionProjectId, storageKey])

	const onProjectClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
		if (isDrawer) hideSidebar()
	}

	const onCreated = (project: { id: string }) => {
		void router.push(`/ai/projects/${project.id}`)
		if (isDrawer) hideSidebar()
	}

	return (
		<div className="flex flex-col gap-1 px-4">
			<button
				type="button"
				aria-expanded={isOpen}
				onClick={() =>
					isOpen ? removeStorageItem(SIDEBAR_PROJECTS_OPEN_KEY) : setStorageItem(SIDEBAR_PROJECTS_OPEN_KEY, 'true')
				}
				className={`${SIDEBAR_ROW} -mx-2 text-left`}
			>
				<Icon name="folder" height={16} width={16} className="shrink-0" />
				<span className="min-w-0 flex-1 truncate">Projects</span>
				{!isLocked && projects.length > 0 ? (
					<span className="shrink-0 body-sm text-tertiary tabular-nums">{projects.length}</span>
				) : null}
				<Icon
					name={isOpen ? 'chevron-down' : 'chevron-right'}
					height={14}
					width={14}
					aria-hidden="true"
					// The chevron glyph sits inset in its box; pull it out so its tip lines up with the counts above it.
					className="-mr-1 shrink-0 text-tertiary"
				/>
			</button>

			{!isOpen ? null : isLocked ? (
				<Button as={BasicLink} href="/subscription" size="md" className="w-full justify-between">
					<span className="flex items-center gap-1">
						<Icon name="folder-plus" height={14} width={14} />
						Upgrade for projects
					</span>
					<Icon name="chevron-right" height={14} width={14} />
				</Button>
			) : (
				<>
					<Ariakit.DialogDisclosure
						ref={createButtonRef}
						store={createStore}
						type="button"
						className={`${SIDEBAR_ROW} -mx-2 text-left text-secondary not-disabled:not-aria-disabled:hover:text-primary`}
					>
						<Icon name="plus" height={16} width={16} className="shrink-0 text-link" />
						<span className="min-w-0 truncate">New project</span>
					</Ariakit.DialogDisclosure>

					{failed ? (
						<RetryNotice message="Couldn't load projects." retrying={isFetching} onRetry={() => void refetch()} />
					) : null}
					{projectList.isLoading && !failed ? (
						<ul role="status" aria-label="Loading projects" className="flex flex-col">
							{[0, 1, 2].map((i) => (
								<li key={i} className="-mx-2 flex h-8 items-center gap-1.5 px-2 py-1.5">
									<Skeleton className="size-4 shrink-0" />
									<Skeleton className="h-3 flex-1" />
								</li>
							))}
						</ul>
					) : visible.length === 0 ? (
						!failed ? (
							<p className="px-2 py-1.5 body-sm text-tertiary">No projects yet</p>
						) : null
					) : (
						<ul className="flex flex-col">
							{visible.map((project) => (
								<li key={project.id} className="flex flex-col">
									<ProjectSidebarRow
										project={project}
										storageKey={storageKey}
										isExpanded={project.id === expandedProjectId}
										isActive={project.id === currentProjectId}
										isSessionContext={project.id !== currentProjectId && project.id === currentSessionProjectId}
										sessionById={sessionById}
										currentSessionId={currentSessionId}
										restoringSessionId={restoringSessionId}
										onSessionSelect={onSessionSelect}
										onDelete={onDelete}
										onProjectClick={onProjectClick}
										deleteFinalFocus={createButtonRef}
									/>
								</li>
							))}
						</ul>
					)}

					{projects.length > 0 ? (
						<Button
							as={BasicLink}
							href="/ai/projects"
							size="sm"
							variant="ghost"
							onClick={onProjectClick}
							className="-ml-2 self-start"
						>
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
