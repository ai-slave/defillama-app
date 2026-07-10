import * as Ariakit from '@ariakit/react'
import Router from 'next/router'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '~/components/Icon'
import { DragOverlay, ImageUpload } from '~/containers/LlamaAI/components/input/ImageUpload'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { useClearUnseenCompletion } from '~/containers/LlamaAI/hooks/useClearUnseenCompletion'
import { fileToBase64, useImageUpload } from '~/containers/LlamaAI/hooks/useImageUpload'
import { useSessionMutations } from '~/containers/LlamaAI/hooks/useSessionMutations'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { AddSourcesMenu } from './AddSourcesMenu'
import { CreateProjectModal } from './CreateProjectModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { useProjectDetail, useProjectSessions, useProjectUsage } from './hooks'
import { ProjectFilesPanel } from './ProjectFilesPanel'
import { ProjectInstructionsEditor } from './ProjectInstructionsEditor'
import type { ProjectTier } from './types'

// Match PromptInput: text pastes above this length collapse into a file chip instead of flooding the field.
const PASTE_TO_FILE_THRESHOLD = 1500

function relativeTime(iso: string | null): string {
	if (!iso) return ''
	const t = new Date(iso).getTime()
	const diff = Date.now() - t
	const minutes = Math.floor(diff / 60_000)
	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 30) return `${days}d ago`
	return new Date(iso).toLocaleDateString()
}

interface ProjectLandingProps {
	projectId: string
	tier: ProjectTier
	initialTab?: 'chats' | 'sources'
	sessionList?: ChatSession[]
	onSubmit: (
		prompt: string,
		preResolvedEntities?: Array<{ term: string; slug: string; type?: string }>,
		images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>
	) => void | Promise<void>
	isStreaming: boolean
	onPickSession: (sessionId: string) => void
	enterToSend: boolean
}

export function ProjectLanding({
	projectId,
	tier,
	initialTab = 'chats',
	sessionList = [],
	onSubmit,
	isStreaming,
	onPickSession,
	enterToSend
}: ProjectLandingProps) {
	const router = useRouter()
	const usage = useProjectUsage()
	const project = useProjectDetail(projectId)
	const projectSessions = useProjectSessions(projectId)
	const renameStore = Ariakit.useDialogStore()
	const deleteStore = Ariakit.useDialogStore()
	const clearUnseenCompletion = useClearUnseenCompletion()
	const { deleteSession, updateSessionTitle, isDeletingSession, isUpdatingTitle } = useSessionMutations()
	const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
	const [actingSessionId, setActingSessionId] = useState<string | null>(null)
	const tab = initialTab
	const [prompt, setPrompt] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const imageUpload = useImageUpload()
	const shiftHeldRef = useRef(false)
	const sessionById = useMemo(() => new Map(sessionList.map((session) => [session.sessionId, session])), [sessionList])
	const sessions = useMemo(
		() =>
			(projectSessions.data ?? []).map((session) => ({
				...session,
				hasUnseenCompletion: session.hasUnseenCompletion ?? sessionById.get(session.sessionId)?.hasUnseenCompletion
			})),
		[projectSessions.data, sessionById]
	)

	useEffect(() => {
		const el = textareaRef.current
		if (!el) return
		if (!prompt) {
			el.style.height = '20px'
			return
		}
		el.style.height = 'auto'
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`
	}, [prompt])

	// Track Shift so a held Shift+paste bypasses the paste-to-file collapse, matching PromptInput.
	useEffect(() => {
		const onDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftHeldRef.current = true
		}
		const onUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') shiftHeldRef.current = false
		}
		const onBlur = () => {
			shiftHeldRef.current = false
		}
		window.addEventListener('keydown', onDown)
		window.addEventListener('keyup', onUp)
		window.addEventListener('blur', onBlur)
		return () => {
			window.removeEventListener('keydown', onDown)
			window.removeEventListener('keyup', onUp)
			window.removeEventListener('blur', onBlur)
		}
	}, [])

	if (project.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<LoadingSpinner size={14} />
			</div>
		)
	}

	if (project.error || !project.data) {
		return (
			<div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
				<p className="text-sm font-medium">Project unavailable</p>
				<p className="text-xs text-[#666] dark:text-[#919296]">
					{project.error instanceof Error ? project.error.message : 'Failed to load project'}
				</p>
				<button
					type="button"
					onClick={() => void Router.push('/ai/projects')}
					className="rounded-md border border-[#e6e6e6] px-3 py-1.5 text-xs hover:bg-[#f0f0f0] dark:border-[#222324] dark:hover:bg-[#222324]"
				>
					Back to projects
				</button>
			</div>
		)
	}

	const handleSubmit = async () => {
		const trimmed = prompt.trim()
		const imagesToSend = [...imageUpload.selectedImages]
		if ((!trimmed && imagesToSend.length === 0) || isStreaming) return
		const images = imagesToSend.length
			? await Promise.all(
					imagesToSend.map(({ file, isPasted }) =>
						fileToBase64(file).then((data) => ({
							data,
							mimeType: file.type,
							filename: file.name,
							...(isPasted ? { isPasted: true } : {})
						}))
					)
				)
			: undefined
		await Promise.resolve(onSubmit(trimmed, undefined, images))
		setPrompt('')
		imageUpload.clearImages()
	}

	const handlePickSession = (session: (typeof sessions)[number]) => {
		if (session.hasUnseenCompletion) clearUnseenCompletion(session.sessionId, projectId)
		onPickSession(session.sessionId)
	}

	const handleRenameSubmit = async (e: React.FormEvent<HTMLFormElement>, session: (typeof sessions)[number]) => {
		e.preventDefault()
		const input = e.currentTarget.elements.namedItem('newTitle') as HTMLInputElement | null
		const next = input?.value.trim() ?? ''
		if (!next || next === session.title) {
			setRenamingSessionId(null)
			return
		}
		setActingSessionId(session.sessionId)
		try {
			await updateSessionTitle({ sessionId: session.sessionId, title: next, projectId })
			setRenamingSessionId(null)
		} catch (err) {
			console.error('Failed to rename session:', err)
		} finally {
			setActingSessionId(null)
		}
	}

	const handleDeleteSession = async (session: (typeof sessions)[number]) => {
		if (!window.confirm('Are you sure you want to delete this chat?')) return
		setActingSessionId(session.sessionId)
		try {
			await deleteSession(session.sessionId, projectId)
		} catch (err) {
			console.error('Failed to delete session:', err)
		} finally {
			setActingSessionId(null)
		}
	}

	const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && e.shiftKey !== enterToSend && !e.nativeEvent.isComposing) {
			e.preventDefault()
			void handleSubmit()
		}
	}

	const handlePaste = (e: React.ClipboardEvent) => {
		const data = e.clipboardData
		if (!data) return

		const hasFile = Array.from(data.items).some((item) => item.kind === 'file')
		if (hasFile) {
			imageUpload.handlePaste(e)
			return
		}

		const text = data.getData('text/plain')
		if (!text || text.length < PASTE_TO_FILE_THRESHOLD || shiftHeldRef.current) return

		if (imageUpload.addPastedText(text)) {
			e.preventDefault()
		}
	}

	const setTab = (nextTab: 'chats' | 'sources') => {
		if (nextTab === tab) return
		const query = { ...router.query }
		if (nextTab === 'sources') {
			query.tab = 'sources'
		} else {
			delete query.tab
		}
		void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
	}

	const projectBytesLimit = usage.data?.limits.project_bytes ?? null
	const projectFileLimit = usage.data?.limits.project_files ?? null
	const projectBytesUsed = project.data.total_bytes ?? 0
	const projectFileCount = project.data.file_count ?? 0
	const connectGithubQuery = router.query.connectGithub
	const connectGithubValue = Array.isArray(connectGithubQuery) ? connectGithubQuery[0] : connectGithubQuery

	return (
		<div className="size-full overflow-y-auto overscroll-contain px-6 pt-6 pb-16">
			<div className="mx-auto flex w-full max-w-[760px] flex-col">
				<header className="flex items-center justify-between gap-3 pb-6">
					<button
						type="button"
						onClick={() => void Router.push('/ai/projects')}
						className="-ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#666] transition-colors hover:bg-[#f0f0f0] hover:text-[#1a1a1a] dark:text-[#919296] dark:hover:bg-[#1c1d1e] dark:hover:text-white"
					>
						<Icon name="chevron-left" height={14} width={14} />
						All projects
					</button>
					<div className="flex items-center gap-1">
						<Ariakit.MenuProvider placement="bottom-end">
							<Ariakit.MenuButton className="rounded-md p-1.5 text-[#666] transition-colors hover:bg-[#f0f0f0] dark:text-[#919296] dark:hover:bg-[#1c1d1e]">
								<Icon name="ellipsis" height={16} width={16} />
							</Ariakit.MenuButton>
							<Ariakit.Menu
								gutter={6}
								className="z-50 min-w-[200px] rounded-lg border border-[#e6e6e6] bg-(--legacy-cards-bg) p-1 text-sm shadow-xl dark:border-[#222324]"
							>
								<Ariakit.MenuItem
									onClick={renameStore.show}
									className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-[#f0f0f0] dark:hover:bg-[#1c1d1e]"
								>
									Rename project
								</Ariakit.MenuItem>
								<Ariakit.MenuItem
									onClick={deleteStore.show}
									className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
								>
									Delete project
								</Ariakit.MenuItem>
							</Ariakit.Menu>
						</Ariakit.MenuProvider>
					</div>
				</header>

				<div className="flex items-center gap-3 pb-5">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-(--legacy-old-blue)/20 to-(--legacy-old-blue)/5 ring-1 ring-(--legacy-old-blue)/30 ring-inset">
						<Icon name="folder-plus" height={15} width={15} className="text-(--legacy-old-blue)" />
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-2xl leading-tight font-semibold tracking-tight">{project.data.name}</h1>
						{project.data.description ? (
							<p className="mt-1 line-clamp-1 text-[13px] text-[#666] dark:text-[#919296]">
								{project.data.description}
							</p>
						) : null}
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault()
						void handleSubmit()
					}}
					onDragEnter={imageUpload.handleDragEnter}
					onDragLeave={imageUpload.handleDragLeave}
					onDragOver={(e) => e.preventDefault()}
					onDrop={imageUpload.handleDrop}
					className="relative mb-5"
				>
					<DragOverlay isDragging={imageUpload.isDragging} />
					<div className={imageUpload.selectedImages.length > 0 ? 'mb-2' : ''}>
						<ImageUpload
							selectedImages={imageUpload.selectedImages}
							previewImage={imageUpload.previewImage}
							setPreviewImage={imageUpload.setPreviewImage}
							openPastedPreview={imageUpload.setPastedPreview}
							removeImage={imageUpload.removeImage}
							fileInputRef={imageUpload.fileInputRef}
							handleImageSelect={imageUpload.handleImageSelect}
						/>
					</div>
					<PastedContentModal preview={imageUpload.pastedPreview} onClose={() => imageUpload.setPastedPreview(null)} />
					<div className="group/composer flex items-center gap-2.5 rounded-3xl border border-[#e6e6e6] bg-(--legacy-cards-bg) py-2 pr-2 pl-3 shadow-sm transition-all focus-within:border-(--legacy-old-blue)/60 focus-within:shadow-md dark:border-[#222324] dark:bg-[#161718] dark:focus-within:border-(--legacy-old-blue)/60">
						<AddSourcesMenu
							projectId={projectId}
							onAddPhotosFiles={imageUpload.openFilePicker}
							trigger={
								<button
									type="button"
									aria-label="Add files"
									className="-ml-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[#666] transition-colors hover:bg-[#f0f0f0] hover:text-(--legacy-old-blue) dark:text-[#919296] dark:hover:bg-[#1c1d1e]"
								>
									<Icon name="plus" height={15} width={15} />
								</button>
							}
						/>
						<textarea
							ref={textareaRef}
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							onKeyDown={handleKey}
							onPaste={handlePaste}
							rows={1}
							placeholder={`New chat in ${project.data.name}`}
							className="block flex-1 resize-none self-center bg-transparent text-[13px] leading-5 text-inherit placeholder:text-[#999] focus:outline-none dark:placeholder:text-[#555]"
							style={{ height: 20 }}
						/>
						<button
							type="submit"
							disabled={(!prompt.trim() && imageUpload.selectedImages.length === 0) || isStreaming}
							aria-label="Send message"
							className="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--legacy-old-blue) text-white transition-all hover:scale-105 hover:bg-(--legacy-old-blue)/90 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-30"
						>
							<Icon name="arrow-up" height={13} width={13} />
						</button>
					</div>
				</form>

				<div role="tablist" className="flex items-center gap-1 border-b border-[#e6e6e6] dark:border-[#222324]">
					{(['chats', 'sources'] as const).map((id, index) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							onClick={() => setTab(id)}
							className={`relative py-2 text-xs font-medium capitalize transition-colors focus:outline-none ${index === 0 ? 'pr-2 pl-0' : 'px-2'} ${
								tab === id
									? 'text-(--legacy-old-blue)'
									: 'text-[#666] hover:text-[#1a1a1a] dark:text-[#919296] dark:hover:text-white'
							}`}
						>
							{id}
							{tab === id ? (
								<span
									className={`absolute -bottom-px h-0.5 rounded-full bg-(--legacy-old-blue) ${index === 0 ? 'right-2 left-0' : 'inset-x-2'}`}
								/>
							) : null}
						</button>
					))}
				</div>

				<div className="pt-4">
					{tab === 'chats' ? (
						<section>
							{projectSessions.isLoading ? (
								<div className="flex justify-center py-8">
									<LoadingSpinner size={12} />
								</div>
							) : sessions.length === 0 ? (
								<p className="py-10 text-center text-sm text-[#999] dark:text-[#555]">
									Start a chat above to keep conversations organized in this project.
								</p>
							) : (
								<ul className="flex flex-col">
									{sessions.map((s) => {
										const isRenaming = renamingSessionId === s.sessionId
										const isActing = actingSessionId === s.sessionId
										const isBusy = isActing && (isDeletingSession || isUpdatingTitle)
										if (isRenaming) {
											return (
												<li key={s.sessionId}>
													<form
														onSubmit={(e) => void handleRenameSubmit(e, s)}
														className="group/row -mx-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-lg bg-[#f6f6f7] px-2 py-1 dark:bg-[#161718]"
													>
														<input
															type="text"
															name="newTitle"
															defaultValue={s.title}
															autoFocus
															disabled={isBusy}
															onFocus={(e) => e.currentTarget.select()}
															onKeyDown={(e) => {
																if (e.key === 'Escape') {
																	e.preventDefault()
																	setRenamingSessionId(null)
																}
															}}
															className="min-w-0 flex-1 bg-transparent p-1 text-[13px] text-inherit focus:outline-none"
														/>
														<button
															type="submit"
															disabled={isBusy}
															className="flex size-7 items-center justify-center rounded-md bg-(--legacy-old-blue) text-white disabled:opacity-60"
															aria-label="Save title"
														>
															{isBusy ? <LoadingSpinner size={12} /> : <Icon name="check" height={13} width={13} />}
														</button>
														<button
															type="button"
															onClick={() => setRenamingSessionId(null)}
															disabled={isBusy}
															className="flex size-7 items-center justify-center rounded-md bg-red-500/15 text-red-600 disabled:opacity-60 dark:text-red-400"
															aria-label="Cancel rename"
														>
															<Icon name="x" height={13} width={13} />
														</button>
													</form>
												</li>
											)
										}
										return (
											<li key={s.sessionId}>
												<div className="group/row relative -mx-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-lg pr-1 transition-colors focus-within:bg-[#f6f6f7] hover:bg-[#f6f6f7] dark:focus-within:bg-[#161718] dark:hover:bg-[#161718]">
													<button
														type="button"
														onClick={() => handlePickSession(s)}
														disabled={isBusy}
														className="flex min-w-0 flex-1 items-center gap-1.5 p-2 text-left disabled:opacity-60"
													>
														{s.hasUnseenCompletion ? (
															<Tooltip content="New response ready">
																<span
																	className="size-1.5 shrink-0 rounded-full bg-(--legacy-old-blue)"
																	aria-label="Unseen completion"
																/>
															</Tooltip>
														) : null}
														<span className="min-w-0 flex-1 truncate text-[13px]">{s.title || 'Untitled chat'}</span>
													</button>
													<span className="shrink-0 text-xs text-[#999] tabular-nums group-focus-within/row:hidden group-hover/row:hidden dark:text-[#555]">
														{relativeTime(s.lastActivity ?? s.createdAt)}
													</span>
													<div className="hidden shrink-0 items-center gap-0.5 group-focus-within/row:flex group-hover/row:flex">
														<Tooltip
															content="Rename chat"
															render={
																<button
																	type="button"
																	aria-label={`Rename ${s.title || 'chat'}`}
																	disabled={isBusy}
																	onClick={(e) => {
																		e.stopPropagation()
																		setRenamingSessionId(s.sessionId)
																	}}
																/>
															}
															className="flex size-7 items-center justify-center rounded-md text-[#999] transition-colors hover:bg-(--legacy-old-blue) hover:text-white focus-visible:bg-(--legacy-old-blue) focus-visible:text-white disabled:opacity-50 dark:text-[#666]"
														>
															<Icon name="pencil" height={13} width={13} />
														</Tooltip>
														<Tooltip
															content="Delete chat"
															render={
																<button
																	type="button"
																	aria-label={`Delete ${s.title || 'chat'}`}
																	disabled={isBusy}
																	onClick={(e) => {
																		e.stopPropagation()
																		void handleDeleteSession(s)
																	}}
																/>
															}
															className="flex size-7 items-center justify-center rounded-md text-[#999] transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:bg-red-500/10 focus-visible:text-red-600 disabled:opacity-50 dark:text-[#666] dark:hover:text-red-400 dark:focus-visible:text-red-400"
														>
															{isBusy && isDeletingSession ? (
																<LoadingSpinner size={12} />
															) : (
																<Icon name="trash-2" height={13} width={13} />
															)}
														</Tooltip>
													</div>
												</div>
											</li>
										)
									})}
								</ul>
							)}
						</section>
					) : (
						<section className="flex flex-col gap-6">
							<ProjectInstructionsEditor projectId={projectId} value={project.data.custom_instructions} />
							<ProjectFilesPanel
								projectId={projectId}
								autoOpenGitHub={connectGithubValue === '1'}
								projectBytesUsed={projectBytesUsed}
								projectBytesLimit={projectBytesLimit}
								projectFileCount={projectFileCount}
								projectFileLimit={projectFileLimit}
								tier={tier}
							/>
						</section>
					)}
				</div>

				<CreateProjectModal dialogStore={renameStore} mode="rename" project={project.data} />
				<DeleteProjectModal
					dialogStore={deleteStore}
					project={project.data}
					onDeleted={() => void Router.push('/ai/projects')}
				/>
			</div>
		</div>
	)
}
