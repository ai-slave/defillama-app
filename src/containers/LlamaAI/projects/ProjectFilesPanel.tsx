import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { UploadTile } from '~/ui/UploadTile'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { useFileDropTarget } from '../components/FileDrop'
import { UploadSelectionNotice } from '../components/UploadSelectionNotice'
import { AddTextContentModal } from './AddTextContentModal'
import { formatProjectBytes } from './format'
import { GitHubConnectModal } from './GitHubConnectModal'
import { useDeleteProjectFile, useDisconnectSource, useProjectFiles, useProjectSources } from './hooks'
import { ProjectSourceDeleteDialog } from './ProjectSourceDeleteDialog'
import type { ProjectSource } from './types'
import { PROJECT_FILE_ACCEPT, useProjectFileUpload } from './useProjectFileUpload'

const EMPTY_PROJECT_SOURCES: Array<ProjectSource> = []

interface ProjectFilesPanelProps {
	projectId: string
	autoOpenGitHub?: boolean
	projectBytesUsed: number
	projectBytesLimit: number | null
	projectFileCount: number
	projectFileLimit: number | null
	tier: 'free' | 'trial' | 'paid' | 'llama'
}

export function ProjectFilesPanel({
	projectId,
	autoOpenGitHub = false,
	projectBytesUsed,
	projectBytesLimit,
	projectFileCount,
	projectFileLimit,
	tier
}: ProjectFilesPanelProps) {
	const filesQuery = useProjectFiles(projectId)
	const router = useRouter()
	const sourcesQuery = useProjectSources(projectId)
	const { handleFiles, isUploading, feedback, dismissFeedback } = useProjectFileUpload(projectId)
	const deleteFile = useDeleteProjectFile(projectId)
	const disconnect = useDisconnectSource(projectId)

	const addButtonRef = useRef<HTMLButtonElement>(null)
	const [deleteTarget, setDeleteTarget] = useState<{
		kind: 'file' | 'source'
		id: string
		name: string
		trigger: HTMLButtonElement
	} | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const addTextStore = Ariakit.useDialogStore()
	const githubStore = Ariakit.useDialogStore()

	useEffect(() => {
		if (!autoOpenGitHub || !router.isReady) return
		githubStore.show()
		const query = { ...router.query }
		delete query.connectGithub
		void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
	}, [autoOpenGitHub, githubStore, router])

	const sources = sourcesQuery.data ?? EMPTY_PROJECT_SOURCES
	const sourceById = useMemo(() => {
		const map = new Map<string, ProjectSource>()
		for (const s of sources) map.set(s.id, s)
		return map
	}, [sources])

	const projectPercent =
		projectBytesLimit === null || projectBytesLimit === 0
			? 0
			: Math.min(100, (projectBytesUsed / projectBytesLimit) * 100)

	const onPick = () => fileInputRef.current?.click()
	useFileDropTarget('Add files to project', (files) => void handleFiles(files), !isUploading)

	const files = filesQuery.data?.files ?? []
	const githubSources = sources.filter((s) => s.adapter_type === 'github')
	// The notice also sits above files it kept, so a failed refresh counts too.
	const filesFailed = queryReadFailed(filesQuery) || queryRefreshFailed(filesQuery)
	const isInitialLoading = !filesFailed && (filesQuery.isLoading || (sourcesQuery.isLoading && files.length === 0))

	const fileErrorNotice = filesFailed ? (
		<InlineStatus variant="error" retry={filesQuery}>
			Couldn&apos;t load files.
		</InlineStatus>
	) : null

	return (
		<section className="flex flex-1 flex-col gap-3">
			<header className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="label-md text-primary">Files</h3>
					{sourcesQuery.isLoading && files.length > 0 ? (
						<span role="status" aria-label="Loading connected sources">
							<LoadingSpinner size={14} />
						</span>
					) : null}
				</div>
				<Ariakit.MenuProvider placement="bottom-end">
					<Ariakit.MenuButton
						ref={addButtonRef}
						aria-label="Add project source"
						disabled={isUploading}
						render={<Button size="sm" variant="outline" />}
					>
						<Icon name="plus" className="size-3.5" />
						Add sources
					</Ariakit.MenuButton>
					<MenuSurface variant="actions" gutter={6} className="w-60">
						<MenuItem onClick={onPick}>
							<Icon name="file-plus" className="size-3.5" />
							Upload from device
						</MenuItem>
						<MenuItem onClick={() => addTextStore.show()}>
							<Icon name="file-text" className="size-3.5" />
							Add text content
						</MenuItem>
						<MenuItem onClick={() => githubStore.show()}>
							<Icon name="github" className="size-3.5" />
							Connect GitHub repo
						</MenuItem>
					</MenuSurface>
				</Ariakit.MenuProvider>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept={PROJECT_FILE_ACCEPT}
					hidden
					onChange={(e) => {
						const list = e.target.files ? Array.from(e.target.files) : []
						void handleFiles(list)
						if (fileInputRef.current) fileInputRef.current.value = ''
					}}
				/>
			</header>

			<UploadSelectionNotice feedback={feedback} onDismiss={dismissFeedback} />
			{queryReadFailed(sourcesQuery) || queryRefreshFailed(sourcesQuery) ? (
				<InlineStatus variant="error" retry={sourcesQuery}>
					Couldn&apos;t load connected sources.
				</InlineStatus>
			) : null}
			{githubSources.length > 0 ? (
				<ul className="flex flex-col gap-1">
					{githubSources.map((source) => {
						const owner = String(source.config.owner ?? '')
						const repo = String(source.config.repo ?? '')
						const branch = source.config.branch ? String(source.config.branch) : 'default'
						return (
							<li
								key={source.id}
								className="group flex items-center gap-2 rounded-md border border-subtle bg-surface px-2.5 py-1.5 body-sm text-primary"
							>
								<Icon name="github" className="size-3.5 shrink-0 text-secondary" />
								<span className="min-w-0 flex-1 truncate mono-sm">
									{owner}/{repo}
								</span>
								<span className="shrink-0 rounded-sm bg-surface-elevated-1 px-1.5 py-0.5 label-xs text-secondary">
									{branch}
								</span>
								<Tooltip
									content="Disconnect"
									render={
										<Button
											type="button"
											size="sm"
											variant="ghostDestructive"
											square
											aria-label={`Disconnect ${source.mount_path}`}
											onClick={(event) => {
												setDeleteTarget({
													kind: 'source',
													id: source.id,
													name: source.mount_path,
													trigger: event.currentTarget
												})
											}}
											className="shrink-0"
										/>
									}
								>
									<Icon name="trash-2" className="size-4" />
								</Tooltip>
							</li>
						)
					})}
				</ul>
			) : null}

			{files.length > 0 ? fileErrorNotice : null}
			{isInitialLoading || files.length === 0 ? (
				<div className="relative">
					{/* The tile stays in layout, hidden, while files load or fail, so the storage row below never moves. The
					    upload it starts keeps focus on it. */}
					<UploadTile
						shape="wide"
						icon="file-plus"
						label="Drop files here or choose files"
						hint="Markdown, text, code, JSON, CSV. Up to 100 MB per file."
						pendingLabel="Uploading…"
						pending={isUploading}
						onClick={onPick}
						disabled={isInitialLoading || filesFailed}
						aria-hidden={isInitialLoading || filesFailed || undefined}
						className={isInitialLoading || filesFailed ? 'invisible' : undefined}
					/>
					{fileErrorNotice ? (
						<div className="absolute inset-0 flex items-center justify-center p-3">{fileErrorNotice}</div>
					) : isInitialLoading ? (
						<div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center p-4">
							<LoadingIndicator label={filesQuery.isLoading ? 'Loading files' : 'Loading connected sources'} />
						</div>
					) : null}
				</div>
			) : (
				<div className="min-h-32 flex-1 overflow-auto rounded-md border border-dashed border-medium">
					<ul className="flex flex-col">
						{files.map((file) => {
							const source = sourceById.get(file.source_id)
							return (
								<li
									key={file.id}
									className="group flex items-center gap-2 border-b border-subtle px-2.5 py-1.5 body-sm text-primary last:border-b-0 not-disabled:not-aria-disabled:hover:bg-hover-row"
								>
									<Icon name="file-text" className="size-3.5 shrink-0 text-secondary" />
									<span title={file.path} className="min-w-0 flex-1 truncate mono-sm">
										{file.path}
									</span>
									{source ? (
										<span className="shrink-0 rounded-sm bg-surface-elevated-1 px-1.5 py-0.5 body-sm text-secondary">
											{source.adapter_type === 'github' ? 'GitHub' : 'Uploaded'}
										</span>
									) : null}
									<span className="shrink-0 text-tertiary tabular-nums">{formatProjectBytes(file.size)}</span>
									{source?.adapter_type === 'blob' ? (
										<Tooltip
											content="Delete file"
											render={
												<Button
													type="button"
													size="sm"
													variant="ghostDestructive"
													square
													aria-label={`Delete ${file.path}`}
													onClick={(event) => {
														setDeleteTarget({
															kind: 'file',
															id: file.id,
															name: file.path,
															trigger: event.currentTarget
														})
													}}
													className="shrink-0"
												/>
											}
										>
											<Icon name="trash-2" className="size-4" />
										</Tooltip>
									) : null}
								</li>
							)
						})}
					</ul>
				</div>
			)}

			{isUploading ? (
				<p role="status" className="flex items-center gap-1.5 body-sm text-secondary">
					<LoadingSpinner size={12} /> Uploading…
				</p>
			) : null}

			<div className="flex flex-col gap-1">
				<div className="flex items-baseline justify-between gap-2 body-sm text-secondary">
					<span>
						{projectBytesLimit
							? `${formatProjectBytes(projectBytesUsed)} / ${formatProjectBytes(projectBytesLimit)} used`
							: `${formatProjectBytes(projectBytesUsed)} used`}
						{projectFileLimit ? ` · ${projectFileCount} / ${projectFileLimit} files` : ` · ${projectFileCount} files`}
					</span>
					{tier === 'free' ? <span className="shrink-0 text-warning">Free tier</span> : null}
				</div>
				{projectBytesLimit ? (
					<div
						role="progressbar"
						aria-label="Project storage usage"
						aria-valuemin={0}
						aria-valuemax={projectBytesLimit}
						aria-valuenow={projectBytesUsed}
						className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated-2"
					>
						<div
							className={`h-full motion-safe:transition-[width] ${projectPercent > 90 ? 'bg-error' : 'bg-brand'}`}
							style={{ width: `${projectPercent}%` }}
						/>
					</div>
				) : null}
			</div>

			<AddTextContentModal dialogStore={addTextStore} projectId={projectId} finalFocus={addButtonRef} />
			<GitHubConnectModal dialogStore={githubStore} projectId={projectId} finalFocus={addButtonRef} />
			{deleteTarget ? (
				<ProjectSourceDeleteDialog
					target={deleteTarget}
					mutation={deleteTarget.kind === 'file' ? deleteFile : disconnect}
					fallbackFocus={addButtonRef}
					onClose={() => setDeleteTarget(null)}
				/>
			) : null}
		</section>
	)
}
