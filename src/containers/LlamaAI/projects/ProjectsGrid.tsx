import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useDeferredValue, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { IconTile } from '~/ui/IconTile'
import { RelativeTime } from '~/ui/RelativeTime'
import { SearchField } from '~/ui/SearchField'
import { Select } from '~/ui/Select'
import { EmptyState, InlineStatus, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { CreateProjectModal } from './CreateProjectModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { formatProjectBytes } from './format'
import { useProjectList, useProjectUsage } from './hooks'
import { getProjectTier } from './tier'
import type { ProjectWithStats } from './types'

type SortBy = 'updated' | 'created' | 'name'

const SORT_OPTIONS: Array<{ key: SortBy; name: string }> = [
	{ key: 'updated', name: 'Recently updated' },
	{ key: 'created', name: 'Recently created' },
	{ key: 'name', name: 'Name' }
]
const EMPTY_PROJECTS: Array<ProjectWithStats> = []

export function ProjectsGrid() {
	const router = useRouter()
	const onCreated = (project: { id: string }) => {
		void router.push(`/ai/projects/${project.id}`)
	}
	const { user, hasActiveSubscription, isTrial } = useAuthContext()
	const tier = getProjectTier(user, hasActiveSubscription, isTrial)
	const isLocked = tier === 'free'
	const usage = useProjectUsage(!isLocked)
	const createRef = useRef<HTMLButtonElement>(null)
	const returnFocusRef = useRef<HTMLButtonElement>(null)
	const searchRef = useRef<HTMLInputElement>(null)
	const createStore = Ariakit.useDialogStore()
	const renameStore = Ariakit.useDialogStore()
	const projectList = useProjectList(!isLocked)
	const { data } = projectList
	const [query, setQuery] = useState('')
	// The empty state's Clear search leaves once the search is empty; the search field takes focus.
	const clearSearch = () => {
		setQuery('')
		searchRef.current?.focus()
	}
	const [sortBy, setSortBy] = useState<SortBy>('updated')
	const [projectToRename, setProjectToRename] = useState<ProjectWithStats | null>(null)
	const [projectToDelete, setProjectToDelete] = useState<ProjectWithStats | null>(null)
	const deferredQuery = useDeferredValue(query)
	const allProjects = data ?? EMPTY_PROJECTS

	const visibleProjects = useMemo<Array<ProjectWithStats>>(() => {
		const q = deferredQuery.trim()
		const filtered = q
			? matchSorter(allProjects, q, {
					keys: ['name', 'description'],
					threshold: matchSorter.rankings.CONTAINS
				})
			: allProjects
		const sorted = filtered.toSorted((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name)
			const aDate = sortBy === 'created' ? a.created_at : a.updated_at
			const bDate = sortBy === 'created' ? b.created_at : b.updated_at
			return new Date(bDate).getTime() - new Date(aDate).getTime()
		})
		return sorted
	}, [allProjects, deferredQuery, sortBy])

	if (isLocked) {
		return (
			<EmptyState
				size="lg"
				icon="folder-plus"
				title="Projects are a paid feature"
				headingAs="h1"
				actions={
					<Button as={BasicLink} href="/subscription" size="md" variant="primary">
						Upgrade to enable Projects
					</Button>
				}
			>
				Upload files or connect a GitHub repo, then chat with LlamaAI using that knowledge.
			</EmptyState>
		)
	}

	const projectLimit = usage.data?.limits.projects
	const hasProjectLimit = projectLimit !== null && projectLimit !== undefined
	const reachedProjectCap = hasProjectLimit && allProjects.length >= projectLimit
	const hasProjects = allProjects.length > 0
	const hasSearchQuery = deferredQuery.trim().length > 0
	const createProjectButton = (
		<Tooltip
			content={
				reachedProjectCap ? `Project limit reached (${allProjects.length} / ${projectLimit}).` : 'Create a project'
			}
			render={
				<Ariakit.DialogDisclosure
					store={createStore}
					ref={createRef}
					type="button"
					disabled={reachedProjectCap}
					accessibleWhenDisabled
					render={<Button size="md" variant="primary" />}
				/>
			}
		>
			<Icon name="plus" className="size-3.5" />
			New project
		</Tooltip>
	)

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="heading-sm text-primary">Projects</h1>
					{hasProjects ? (
						<p className="body-sm text-secondary">
							{allProjects.length} project{allProjects.length === 1 ? '' : 's'}
						</p>
					) : null}
				</div>
				{hasProjects ? (
					<div className="flex flex-wrap items-center gap-2">
						{hasProjectLimit ? (
							<span className="body-sm text-secondary tabular-nums">
								{/* The visible reason New project is disabled; its tooltip alone would hide it from touch and keyboard. */}
								{reachedProjectCap
									? `Project limit reached (${allProjects.length} / ${projectLimit})`
									: `${allProjects.length} / ${projectLimit} projects`}
							</span>
						) : null}
						<Select
							heading="Sort"
							allValues={SORT_OPTIONS}
							selectedValues={sortBy}
							setSelectedValues={(value: string) => startTransition(() => setSortBy(value as SortBy))}
							label={
								<>
									<span className="text-secondary">Sort:</span>
									<span>{SORT_OPTIONS.find((option) => option.key === sortBy)!.name}</span>
								</>
							}
							labelType="none"
							variant="filter"
							size="md"
							triggerProps={{ 'aria-label': 'Sort projects' }}
						/>
						{createProjectButton}
					</div>
				) : null}
			</header>

			{hasProjects ? (
				<SearchField
					ref={searchRef}
					label="Search projects"
					value={query}
					onChange={setQuery}
					placeholder="Search projects"
					width="flexible"
				/>
			) : null}

			{/* The same copy as the sidebar's notice for this query. */}
			{queryRefreshFailed(projectList) ? (
				<InlineStatus variant="error" retry={projectList}>
					Couldn&apos;t load projects.
				</InlineStatus>
			) : null}
			{queryReadFailed(projectList) ? (
				<PanelStatus variant="error" retry={projectList}>
					Couldn&apos;t load projects.
				</PanelStatus>
			) : projectList.isLoading ? (
				<PanelLoadingStatus label="Loading projects" />
			) : !hasProjects ? (
				<EmptyState size="lg" icon="folder-plus" title="No projects yet" actions={createProjectButton} framed>
					Create your first project to upload files or connect a GitHub repo.
				</EmptyState>
			) : visibleProjects.length === 0 ? (
				<EmptyState
					size="lg"
					icon="search"
					title={<>No projects match &ldquo;{deferredQuery.trim()}&rdquo;</>}
					actions={
						hasSearchQuery ? (
							<Button type="button" size="md" onClick={clearSearch}>
								Clear search
							</Button>
						) : null
					}
					framed
				/>
			) : (
				<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{visibleProjects.map((p) => (
						<li key={p.id}>
							<Card padding="base" className="group hover-wash-card relative flex size-full flex-col gap-2">
								<header className="flex items-center gap-2">
									<IconTile icon="folder" tone="brand" size="sm" />
									<div className="min-w-0 flex-1">
										<h3 className="truncate label-md text-primary">
											<BasicLink
												href={`/ai/projects/${p.id}`}
												className="after:absolute after:inset-0 after:rounded-lg"
											>
												{p.name}
											</BasicLink>
										</h3>
										<p className="truncate body-sm text-tertiary">
											<RelativeTime value={p.updated_at} prefix="Updated" />
										</p>
									</div>
									<div className="relative z-10 -mr-1 flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 pointer-coarse:opacity-100">
										<Tooltip
											content="Rename project"
											render={
												<Ariakit.DialogDisclosure
													store={renameStore}
													type="button"
													aria-label={`Rename ${p.name}`}
													onClick={() => setProjectToRename(p)}
													render={<Button size="sm" variant="ghost" square />}
												/>
											}
										>
											<Icon name="pencil" className="size-4" />
										</Tooltip>
										<Tooltip
											content="Delete project"
											render={
												<Button
													type="button"
													size="sm"
													variant="ghost"
													square
													aria-label={`Delete ${p.name}`}
													onClick={(e) => {
														returnFocusRef.current = e.currentTarget
														setProjectToDelete(p)
													}}
												/>
											}
										>
											<Icon name="trash-2" className="size-4 text-error" />
										</Tooltip>
									</div>
								</header>
								{p.description ? <p className="line-clamp-2 body-sm text-secondary">{p.description}</p> : null}
								<footer className="mt-auto flex items-center justify-between body-sm text-tertiary tabular-nums">
									<span>
										{p.file_count} file{p.file_count === 1 ? '' : 's'}
									</span>
									<span>{formatProjectBytes(p.total_bytes)}</span>
								</footer>
							</Card>
						</li>
					))}
				</ul>
			)}

			<CreateProjectModal dialogStore={createStore} onCreated={onCreated} />
			<CreateProjectModal key={`rename-${projectToRename?.id}`} dialogStore={renameStore} project={projectToRename} />
			{projectToDelete ? (
				<DeleteProjectModal
					key={projectToDelete.id}
					finalFocus={returnFocusRef}
					project={projectToDelete}
					onClose={() => setProjectToDelete(null)}
					onDeleted={() => {
						// The deleted card takes its Delete button with it; New project stays.
						returnFocusRef.current = createRef.current
					}}
				/>
			) : null}
		</div>
	)
}
