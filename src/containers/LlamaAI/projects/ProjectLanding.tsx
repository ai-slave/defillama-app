import * as Ariakit from '@ariakit/react'
import Router, { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { DeleteSessionDialog, SessionListFocusContext } from '~/containers/LlamaAI/components/DeleteSessionDialog'
import { DragOverlay, ImageUpload } from '~/containers/LlamaAI/components/input/ImageUpload'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { useClearUnseenCompletion } from '~/containers/LlamaAI/hooks/useClearUnseenCompletion'
import { useDeleteSession } from '~/containers/LlamaAI/hooks/useDeleteSession'
import { fileToBase64, useImageUpload } from '~/containers/LlamaAI/hooks/useImageUpload'
import { usePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { AddSourcesMenu } from './AddSourcesMenu'
import { CreateProjectModal } from './CreateProjectModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { useProjectDetail, useProjectSessions, useProjectUsage } from './hooks'
import { ProjectFilesPanel } from './ProjectFilesPanel'
import { ProjectInstructionsEditor } from './ProjectInstructionsEditor'
import { ProjectSessionItem } from './ProjectSessionItem'
import type { ProjectTier } from './types'

// Match PromptInput: text pastes above this length collapse into a file chip instead of flooding the field.
const PASTE_TO_FILE_THRESHOLD = 1500
const projectTabs = ['chats', 'sources'] as const

interface ProjectLandingProps {
	projectId: string
	tier: ProjectTier
	initialTab?: 'chats' | 'sources'
	sessionList?: Array<ChatSession>
	onSubmit: (
		prompt: string,
		preResolvedEntities?: Array<{ term: string; slug: string; type?: string }>,
		images?: Array<{ data: string; mimeType: string; filename?: string; isPasted?: boolean }>
	) => void | Promise<void> | boolean
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
	const projectMenuRef = useRef<HTMLButtonElement>(null)
	const renameStore = Ariakit.useDialogStore()
	const deleteStore = Ariakit.useDialogStore()
	const clearUnseenCompletion = useClearUnseenCompletion()
	const deleteSession = useDeleteSession()
	const sessionDeleteStore = Ariakit.useDialogStore()
	const [sessionToDelete, setSessionToDelete] = useState<(typeof sessions)[number] | null>(null)
	const tab = initialTab
	const [prompt, setPrompt] = usePromptDraft(`project:${projectId}`)
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
				<p className="text-xs text-ai-tertiary">
					{project.error instanceof Error ? project.error.message : 'Failed to load project'}
				</p>
				<button
					type="button"
					onClick={() => void Router.push('/ai/projects')}
					className="rounded-md border border-ai-line px-3 py-1.5 text-xs hover:bg-ai-surface-muted"
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
		const images =
			imagesToSend.length > 0
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
		const accepted = await Promise.resolve(onSubmit(trimmed, undefined, images))
		if (accepted === false) return
		setPrompt('')
		imageUpload.clearImages()
	}

	const handlePickSession = (session: (typeof sessions)[number]) => {
		if (session.hasUnseenCompletion) clearUnseenCompletion(session.sessionId, projectId)
		onPickSession(session.sessionId)
	}

	const handleDeleteSession = (session: (typeof sessions)[number]) => {
		deleteSession.reset()
		setSessionToDelete(session)
		sessionDeleteStore.show()
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
		<SessionListFocusContext.Provider value={projectMenuRef}>
			<div className="size-full overflow-y-auto overscroll-contain px-6 pt-6 pb-16">
				<div className="mx-auto flex w-full max-w-[760px] flex-col">
					<header className="flex items-center justify-between gap-3 pb-6">
						<button
							type="button"
							onClick={() => void Router.push('/ai/projects')}
							className="-ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-ai-primary"
						>
							<Icon name="chevron-left" height={14} width={14} />
							All projects
						</button>
						<div className="flex items-center gap-1">
							<Ariakit.MenuProvider placement="bottom-end">
								<Ariakit.MenuButton
									ref={projectMenuRef}
									aria-label={`Actions for ${project.data.name}`}
									className="rounded-md p-1.5 text-ai-tertiary transition-colors hover:bg-ai-surface-muted"
								>
									<Icon name="ellipsis" height={16} width={16} />
								</Ariakit.MenuButton>
								<Ariakit.Menu
									gutter={6}
									className="z-50 min-w-[200px] rounded-lg border border-ai-line bg-surface p-1 text-sm shadow-xl"
								>
									<Ariakit.MenuItem
										onClick={renameStore.show}
										className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-ai-surface-muted"
									>
										Rename project
									</Ariakit.MenuItem>
									<Ariakit.MenuItem
										onClick={deleteStore.show}
										className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-ai-error transition-colors hover:bg-ai-error-vivid/10"
									>
										Delete project
									</Ariakit.MenuItem>
								</Ariakit.Menu>
							</Ariakit.MenuProvider>
						</div>
					</header>

					<div className="flex items-center gap-3 pb-5">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand/20 to-brand/5 ring-1 ring-brand/30 ring-inset">
							<Icon name="folder-plus" height={15} width={15} className="text-brand" />
						</div>
						<div className="min-w-0 flex-1">
							<h1 className="truncate text-2xl leading-tight font-semibold tracking-tight">{project.data.name}</h1>
							{project.data.description ? (
								<p className="mt-1 line-clamp-1 text-[13px] text-ai-tertiary">{project.data.description}</p>
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
						<PastedContentModal
							preview={imageUpload.pastedPreview}
							onClose={() => imageUpload.setPastedPreview(null)}
						/>
						<div className="group/composer flex items-center gap-2.5 rounded-3xl border border-ai-line bg-surface py-2 pr-2 pl-3 shadow-sm transition-all focus-within:border-brand/60 focus-within:shadow-md dark:bg-ai-surface dark:focus-within:border-brand/60">
							<AddSourcesMenu
								projectId={projectId}
								onAddPhotosFiles={imageUpload.openFilePicker}
								trigger={
									<button
										type="button"
										aria-label="Add files"
										className="-ml-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-brand"
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
								className="block flex-1 resize-none self-center bg-transparent text-[13px] leading-5 text-inherit placeholder:text-ai-muted focus:outline-hidden"
								style={{ height: 20 }}
							/>
							<button
								type="submit"
								disabled={(!prompt.trim() && imageUpload.selectedImages.length === 0) || isStreaming}
								aria-label="Send message"
								className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-ai-white transition-all hover:scale-105 hover:bg-brand/90 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-30"
							>
								<Icon name="arrow-up" height={13} width={13} />
							</button>
						</div>
					</form>

					<Tabs value={tab} onValueChange={setTab} values={projectTabs}>
						<Ariakit.TabList aria-label="Project sections" className="flex items-center gap-1 border-b border-ai-line">
							{projectTabs.map((id, index) => (
								<Tab
									key={id}
									type="button"
									value={id}
									className={`relative py-2 text-xs font-medium capitalize transition-colors focus-visible:focus-ring ${index === 0 ? 'pr-2 pl-0' : 'px-2'} ${
										tab === id ? 'text-brand' : 'text-ai-tertiary hover:text-ai-primary'
									}`}
								>
									{id}
									{tab === id ? (
										<span
											className={`absolute -bottom-px h-0.5 rounded-full bg-brand ${index === 0 ? 'right-2 left-0' : 'inset-x-2'}`}
										/>
									) : null}
								</Tab>
							))}
						</Ariakit.TabList>

						<TabPanel value="sources" className="flex flex-col gap-6 pt-4">
							<div>
								<ProjectInstructionsEditor
									key={projectId}
									projectId={projectId}
									value={project.data.custom_instructions}
								/>
							</div>
							{tab === 'sources' ? (
								<section>
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
							) : null}
						</TabPanel>
						{tab === 'chats' ? (
							<TabPanel value="chats" className="pt-4">
								<section>
									{projectSessions.isLoading ? (
										<div className="flex justify-center py-8">
											<LoadingSpinner size={12} />
										</div>
									) : sessions.length === 0 ? (
										<p className="py-10 text-center text-sm text-ai-muted">
											Start a chat above to keep conversations organized in this project.
										</p>
									) : (
										<ul className="flex flex-col">
											{sessions.map((session) => (
												<ProjectSessionItem
													key={session.sessionId}
													session={session}
													projectId={projectId}
													onSelect={() => handlePickSession(session)}
													onDelete={() => handleDeleteSession(session)}
													isDeleting={
														deleteSession.isPending && deleteSession.variables?.sessionId === session.sessionId
													}
												/>
											))}
										</ul>
									)}
								</section>
							</TabPanel>
						) : null}
					</Tabs>

					<DeleteSessionDialog
						store={sessionDeleteStore}
						title={`Delete “${sessionToDelete?.title ?? 'chat'}”?`}
						pending={deleteSession.isPending}
						error={deleteSession.error}
						onConfirm={() => {
							if (!sessionToDelete || deleteSession.isPending) return
							void deleteSession
								.mutateAsync({ sessionId: sessionToDelete.sessionId, projectId })
								.then(() => {
									if (Router.query.id === projectId) sessionDeleteStore.hide()
								})
								.catch((error) => {
									if (!sessionDeleteStore.getState().contentElement?.isConnected) toast.error(error.message)
								})
						}}
					/>
					<CreateProjectModal
						key={projectId}
						finalFocus={projectMenuRef}
						dialogStore={renameStore}
						mode="rename"
						project={project.data}
					/>
					<DeleteProjectModal
						key={projectId}
						finalFocus={projectMenuRef}
						dialogStore={deleteStore}
						project={project.data}
						onDeleted={() => {
							if (Router.query.id === projectId) void Router.push('/ai/projects')
						}}
					/>
				</div>
			</div>
		</SessionListFocusContext.Provider>
	)
}
