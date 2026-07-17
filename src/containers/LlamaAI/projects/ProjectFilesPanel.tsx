import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { AddTextContentModal } from './AddTextContentModal'
import { GitHubConnectModal } from './GitHubConnectModal'
import { useDeleteProjectFile, useDisconnectSource, useProjectFiles, useProjectSources } from './hooks'
import type { ProjectFile, ProjectSource } from './types'
import { PROJECT_FILE_ACCEPT, useProjectFileUpload } from './useProjectFileUpload'

function formatBytes(bytes: number | string): string {
	const n = Number(bytes ?? 0)
	if (n < 1024) return `${n} B`
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
	if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
	return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

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
	const { handleFiles, isUploading } = useProjectFileUpload(projectId)
	const deleteFile = useDeleteProjectFile(projectId)
	const disconnect = useDisconnectSource(projectId)

	const fileInputRef = useRef<HTMLInputElement>(null)
	const addTextStore = Ariakit.useDialogStore()
	const githubStore = Ariakit.useDialogStore()
	const [isDragging, setIsDragging] = useState(false)

	useEffect(() => {
		if (!autoOpenGitHub || !router.isReady) return
		githubStore.show()
		const query = { ...router.query }
		delete query.connectGithub
		void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
	}, [autoOpenGitHub, githubStore, router])

	const sources = useMemo(() => sourcesQuery.data ?? [], [sourcesQuery.data])
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
	const onDropZoneDrop = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
		const files = Array.from(e.dataTransfer.files)
		void handleFiles(files)
	}

	const onDelete = async (file: ProjectFile) => {
		if (!window.confirm(`Delete ${file.path}?`)) return
		try {
			await deleteFile.mutateAsync(file.id)
			toast.success('File deleted')
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete')
		}
	}

	const onDisconnectSource = async (source: ProjectSource) => {
		if (!window.confirm(`Disconnect ${source.mount_path}?`)) return
		try {
			await disconnect.mutateAsync(source.id)
			toast.success('Source disconnected')
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
		}
	}

	const files = filesQuery.data?.files ?? []
	const githubSources = sources.filter((s) => s.adapter_type === 'github')

	return (
		<section className="flex flex-1 flex-col gap-3">
			<header className="flex items-center justify-between">
				<h3 className="text-[13px] font-semibold text-primary">Files</h3>
				<Ariakit.MenuProvider placement="bottom-end">
					<Ariakit.MenuButton className="flex items-center gap-1.5 rounded-md border border-brand bg-brand/12 px-2 py-1 text-xs font-medium text-brand hover:bg-brand hover:text-ai-white">
						<Icon name="plus" height={12} width={12} />
						Add
					</Ariakit.MenuButton>
					<Ariakit.Menu
						gutter={6}
						className="z-50 min-w-[220px] rounded-md border border-ai-line bg-surface p-1 text-xs shadow-lg"
					>
						<Ariakit.MenuItem
							onClick={onPick}
							className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-ai-surface-muted"
						>
							<Icon name="file-plus" height={14} width={14} />
							Upload from device
						</Ariakit.MenuItem>
						<Ariakit.MenuItem
							onClick={() => addTextStore.show()}
							className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-ai-surface-muted"
						>
							<Icon name="file-text" height={14} width={14} />
							Add text content
						</Ariakit.MenuItem>
						<Ariakit.MenuItem
							onClick={() => githubStore.show()}
							className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-ai-surface-muted"
						>
							<Icon name="github" height={14} width={14} />
							Connect GitHub repo
						</Ariakit.MenuItem>
					</Ariakit.Menu>
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

			<div className="flex flex-col gap-1">
				<div className="flex items-baseline justify-between gap-2 text-[11px] text-ai-tertiary">
					<span>
						{projectBytesLimit
							? `${formatBytes(projectBytesUsed)} / ${formatBytes(projectBytesLimit)} used`
							: `${formatBytes(projectBytesUsed)} used`}
						{projectFileLimit ? ` · ${projectFileCount} / ${projectFileLimit} files` : ` · ${projectFileCount} files`}
					</span>
					{tier === 'free' ? <span className="text-ai-warning">Free tier</span> : null}
				</div>
				{projectBytesLimit ? (
					<div className="h-1 w-full overflow-hidden rounded-full bg-ai-surface-muted">
						<div
							className={`h-full transition-all ${projectPercent > 90 ? 'bg-ai-error-vivid' : 'bg-brand'}`}
							style={{ width: `${projectPercent}%` }}
						/>
					</div>
				) : null}
			</div>

			{githubSources.length > 0 ? (
				<ul className="flex flex-col gap-1">
					{githubSources.map((source) => {
						const owner = String(source.config.owner ?? '')
						const repo = String(source.config.repo ?? '')
						const branch = source.config.branch ? String(source.config.branch) : 'default'
						return (
							<li
								key={source.id}
								className="group flex items-center gap-2 rounded-md border border-ai-line bg-surface px-2.5 py-1.5 text-xs"
							>
								<Icon name="github" height={12} width={12} className="shrink-0 text-ai-tertiary" />
								<span className="min-w-0 flex-1 truncate font-mono">
									{owner}/{repo}
								</span>
								<span className="shrink-0 rounded-sm bg-ai-surface-muted px-1.5 py-0.5 text-[10px] text-ai-tertiary">
									{branch}
								</span>
								<Tooltip
									content="Disconnect"
									render={
										<button
											type="button"
											onClick={() => void onDisconnectSource(source)}
											className="shrink-0 rounded-sm p-1 text-ai-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ai-error-vivid/10 hover:text-ai-error-vivid"
										/>
									}
								>
									<Icon name="trash-2" height={12} width={12} />
								</Tooltip>
							</li>
						)
					})}
				</ul>
			) : null}

			<div
				onDragOver={(e) => {
					e.preventDefault()
					setIsDragging(true)
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={onDropZoneDrop}
				className={`min-h-[120px] flex-1 overflow-auto rounded-md border border-dashed transition-colors ${
					isDragging ? 'border-brand bg-brand/5' : 'border-ai-line'
				}`}
			>
				{filesQuery.isLoading ? (
					<div className="flex h-full items-center justify-center p-4 text-xs text-ai-tertiary">
						<LoadingSpinner size={12} />
					</div>
				) : files.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center text-xs text-ai-tertiary">
						<Icon name="file-plus" height={16} width={16} className="text-ai-muted" />
						<p>Drop files here or use the Add menu.</p>
						<p className="text-[11px]">Markdown, text, code, JSON, CSV. Up to 30 MB per file.</p>
					</div>
				) : (
					<ul className="flex flex-col">
						{files.map((file) => {
							const source = sourceById.get(file.source_id)
							const sourceBadge = source?.adapter_type === 'github' ? 'gh' : 'blob'
							return (
								<li
									key={file.id}
									className="group flex items-center gap-2 border-b border-ai-line px-2.5 py-1.5 text-xs last:border-b-0 hover:bg-ai-surface"
								>
									<Icon name="file-text" height={12} width={12} className="shrink-0 text-ai-tertiary" />
									<span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
									<span className="shrink-0 rounded-sm bg-ai-surface-muted px-1.5 py-0.5 text-[10px] tracking-wide text-ai-tertiary uppercase">
										{sourceBadge}
									</span>
									<span className="shrink-0 text-ai-muted tabular-nums">{formatBytes(file.size)}</span>
									{sourceBadge === 'blob' ? (
										<Tooltip
											content="Delete file"
											render={
												<button
													type="button"
													onClick={() => void onDelete(file)}
													className="shrink-0 rounded-sm p-1 text-ai-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ai-error-vivid/10 hover:text-ai-error-vivid"
												/>
											}
										>
											<Icon name="trash-2" height={12} width={12} />
										</Tooltip>
									) : null}
								</li>
							)
						})}
					</ul>
				)}
			</div>

			{isUploading ? (
				<p className="flex items-center gap-1.5 text-xs text-ai-tertiary">
					<LoadingSpinner size={10} /> Uploading…
				</p>
			) : null}

			<AddTextContentModal dialogStore={addTextStore} projectId={projectId} />
			<GitHubConnectModal dialogStore={githubStore} projectId={projectId} />
		</section>
	)
}
