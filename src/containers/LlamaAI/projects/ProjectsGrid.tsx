import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, useDeferredValue, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	Input,
	inputStyles,
	searchFieldFlexibleWrapperStyles,
	searchFieldIconStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { CreateProjectModal } from './CreateProjectModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { formatProjectBytes } from './format'
import { useProjectList, useProjectUsage } from './hooks'
import { getProjectTier } from './tier'
import type { ProjectWithStats } from './types'

type SortBy = 'updated' | 'created' | 'name'
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
	const renameRef = useRef<HTMLButtonElement>(null)
	const deleteRef = useRef<HTMLButtonElement>(null)
	const createStore = Ariakit.useDialogStore()
	const renameStore = Ariakit.useDialogStore()
	const deleteStore = Ariakit.useDialogStore()
	const { data, isLoading, error, refetch } = useProjectList(!isLocked)
	const [query, setQuery] = useState('')
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
			<div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center">
				<div className="flex size-16 items-center justify-center rounded-full bg-brand/12">
					<Icon name="folder-plus" height={28} width={28} className="text-brand" />
				</div>
				<div className="flex flex-col gap-2">
					<h1 className="heading-lg text-primary">Projects are a paid feature</h1>
					<p className="max-w-md body-md text-secondary">
						Upload files or connect a GitHub repo, then chat with LlamaAI using that knowledge.
					</p>
				</div>
				<Button as={BasicLink} href="/subscription" size="md" variant="primary">
					Upgrade to enable Projects
				</Button>
			</div>
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
			<Icon name="plus" height={14} width={14} />
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
								{allProjects.length} / {projectLimit} projects
							</span>
						) : null}
						<label className="flex items-center gap-1.5 label-sm text-secondary">
							Sort
							<select
								value={sortBy}
								onChange={(e) => startTransition(() => setSortBy(e.target.value as SortBy))}
								className={inputStyles}
							>
								<option value="updated">Recently updated</option>
								<option value="created">Recently created</option>
								<option value="name">Name</option>
							</select>
						</label>
						{createProjectButton}
					</div>
				) : null}
			</header>

			{hasProjects ? (
				<div className={searchFieldFlexibleWrapperStyles}>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label="Search projects"
						placeholder="Search projects"
						className={`${searchFieldInputPlacementStyles} ${query ? 'pr-9' : ''}`}
					/>
					{query ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							square
							aria-label="Clear project search"
							onClick={() => setQuery('')}
							className="absolute top-0 right-1 bottom-0 my-auto"
						>
							<Icon name="x" height={14} width={14} />
						</Button>
					) : null}
				</div>
			) : null}

			{isLoading ? (
				<div className="flex justify-center py-10">
					<LoadingSpinner size={16} />
				</div>
			) : error ? (
				<div
					role="alert"
					className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-medium py-12 text-center body-md text-secondary"
				>
					<Icon name="alert-triangle" height={24} width={24} className="text-error" />
					<p>Couldn&apos;t load projects.</p>
					<Button type="button" size="md" onClick={() => void refetch()}>
						Retry
					</Button>
				</div>
			) : !hasProjects ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-medium py-12 text-center body-md text-secondary">
					<Icon name="folder-plus" height={28} width={28} className="text-tertiary" />
					<p>Create your first project to upload files or connect a GitHub repo.</p>
					{createProjectButton}
				</div>
			) : visibleProjects.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-medium py-12 text-center body-md text-secondary">
					<Icon name="search" height={24} width={24} className="text-tertiary" />
					<p>No projects match &ldquo;{deferredQuery.trim()}&rdquo;.</p>
					{hasSearchQuery ? (
						<Button type="button" size="md" onClick={() => setQuery('')}>
							Clear search
						</Button>
					) : null}
				</div>
			) : (
				<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{visibleProjects.map((p) => (
						<li key={p.id}>
							<div className="group hover-wash-card relative flex size-full flex-col gap-2 rounded-lg border border-subtle bg-surface p-3 text-left">
								<header className="flex items-center gap-2">
									<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-muted text-link-on-tint">
										<Icon name="folder" height={14} width={14} />
									</div>
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
									<div className="relative z-10 -mr-1 flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
										<Tooltip
											content="Rename project"
											render={
												<Button
													type="button"
													size="sm"
													variant="ghost"
													square
													aria-label={`Rename ${p.name}`}
													onClick={(e) => {
														renameRef.current = e.currentTarget
														setProjectToRename(p)
														renameStore.show()
													}}
												/>
											}
										>
											<Icon name="pencil" height={16} width={16} />
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
														deleteRef.current = e.currentTarget
														setProjectToDelete(p)
														deleteStore.show()
													}}
												/>
											}
										>
											<Icon name="trash-2" height={16} width={16} className="text-error" />
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
							</div>
						</li>
					))}
				</ul>
			)}

			<CreateProjectModal dialogStore={createStore} onCreated={onCreated} />
			<CreateProjectModal
				key={projectToRename?.id}
				finalFocus={renameRef}
				dialogStore={renameStore}
				mode="rename"
				project={projectToRename}
			/>
			<DeleteProjectModal
				key={projectToDelete?.id}
				finalFocus={deleteRef}
				fallbackFocus={createRef}
				dialogStore={deleteStore}
				project={projectToDelete}
				onDeleted={() => setProjectToDelete(null)}
			/>
		</div>
	)
}
