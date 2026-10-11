import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { ListLoading, NoResults } from '~/ui/NoResults'
import { NestedDrawerHeader, MenuItem, MenuSeparator, MenuSurface } from '~/ui/PopoverSurface'
import { ErrorLine } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
import { useMoveSessionToProject, useProjectList } from './hooks'

interface MoveToProjectMenuItemProps {
	sessionId: string
	currentProjectId?: string | null
}

export function MoveToProjectMenuItem({ sessionId, currentProjectId = null }: MoveToProjectMenuItemProps) {
	const menu = Ariakit.useMenuStore()
	const projects = useProjectList()
	const move = useMoveSessionToProject()
	const failed = queryReadFailed(projects)

	const onMove = (projectId: string | null) => {
		if (projectId === currentProjectId) return
		// Feedback lives on the mutation: choosing a destination closes this menu, and its unmountOnHide
		// would drop a callback passed here before the request settles.
		move.mutate({ sessionId, projectId, previousProjectId: currentProjectId })
	}

	return (
		<Ariakit.MenuProvider store={menu}>
			<MenuItem render={<Ariakit.MenuButton />}>
				<Icon name="folder-plus" className="size-3.5 shrink-0" />
				<span className="flex-1 text-left">Move to project</span>
				<Icon name="chevron-right" className="size-3.5 shrink-0 text-tertiary" />
			</MenuItem>
			<MenuSurface variant="nested" composite={false} aria-label="Move to project" gutter={4}>
				<NestedDrawerHeader
					title="Move to project"
					backLabel="Back to session actions"
					onBack={menu.hide}
					closeLabel="Close session menus"
					onClose={menu.hideAll}
				/>
				{failed ? (
					<ErrorLine inset="menuRow">Couldn&apos;t load your projects.</ErrorLine>
				) : projects.isLoading ? (
					// Only the first load: a background refetch keeps the rows still instead of pushing them down.
					<ListLoading label="Loading projects" />
				) : !projects.data?.length ? (
					<NoResults>No projects yet</NoResults>
				) : null}
				<Ariakit.MenuList store={menu} aria-label="Project destinations">
					{failed ? (
						<MenuItem
							hideOnClick={false}
							disabled={projects.isFetching}
							accessibleWhenDisabled
							onClick={() => void projects.refetch()}
						>
							{projects.isFetching ? 'Retrying…' : 'Try again'}
						</MenuItem>
					) : projects.data ? (
						<>
							{projects.data.map((p) => {
								const isCurrentProject = p.id === currentProjectId
								return (
									<MenuItem key={p.id} onClick={() => void onMove(p.id)} disabled={isCurrentProject || move.isPending}>
										<Icon name={isCurrentProject ? 'check' : 'folder'} className="size-3.5 shrink-0 opacity-70" />
										<span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
									</MenuItem>
								)
							})}
							{currentProjectId ? (
								<>
									<MenuSeparator />
									<MenuItem onClick={() => void onMove(null)} disabled={move.isPending}>
										<Icon name="x" className="size-3.5 shrink-0 opacity-70" />
										<span className="min-w-0 flex-1 truncate text-left">Remove from project</span>
									</MenuItem>
								</>
							) : null}
						</>
					) : null}
				</Ariakit.MenuList>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
