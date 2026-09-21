import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'
import { DeleteSessionDialog, SessionListFocusContext } from '~/containers/LlamaAI/components/DeleteSessionDialog'
import { ImageUpload } from '~/containers/LlamaAI/components/input/ImageUpload'
import { PastedContentModal } from '~/containers/LlamaAI/components/PastedContentModal'
import { UploadSelectionNotice } from '~/containers/LlamaAI/components/UploadSelectionNotice'
import { useClearUnseenCompletion } from '~/containers/LlamaAI/hooks/useClearUnseenCompletion'
import { useDeleteSession } from '~/containers/LlamaAI/hooks/useDeleteSession'
import { toSubmittedAttachments, useImageUpload } from '~/containers/LlamaAI/hooks/useImageUpload'
import { usePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import type { OutgoingAttachment } from '~/containers/LlamaAI/mutationProtocol'
import type { ChatSession } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { LoadingIndicator } from '~/ui/Status'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { useFileDropTarget } from '../components/FileDrop'
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
		images?: Array<OutgoingAttachment>
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
	useFileDropTarget('Attach files to message', imageUpload.addDroppedFiles, tab === 'chats' && !!project.data)
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
		if (!el || tab !== 'chats' || project.isLoading) return
		if (!prompt) {
			el.style.height = ''
			return
		}
		el.style.height = 'auto'
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`
	}, [prompt, tab, project.isLoading])

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
			<div role="status" className="flex h-full items-center justify-center gap-2 body-sm text-secondary">
				<LoadingSpinner size={14} /> Loading project…
			</div>
		)
	}

	if (!project.data) {
		const notFound =
			project.error instanceof LlamaAITransportError && (project.error.status === 403 || project.error.status === 404)
		return (
			<div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
				<p role="alert" className="label-md text-error">
					{notFound ? 'Project not found' : 'Project unavailable'}
				</p>
				<p className="text-xs text-secondary">
					{notFound
						? 'This project does not exist or you do not have access to it.'
						: project.error instanceof Error
							? project.error.message
							: 'Failed to load project'}
				</p>
				{notFound ? null : (
					<Button type="button" size="md" onClick={() => void project.refetch()} disabled={project.isFetching}>
						{project.isFetching ? <LoadingSpinner size={12} /> : null}
						{project.isFetching ? 'Retrying…' : 'Try again'}
					</Button>
				)}
				<Button as={BasicLink} href="/ai/projects" size="sm" variant="ghost">
					Back to projects
				</Button>
			</div>
		)
	}

	const handleSubmit = async () => {
		const trimmed = prompt.trim()
		const imagesToSend = [...imageUpload.selectedImages]
		if ((!trimmed && imagesToSend.length === 0) || isStreaming) return
		if (imageUpload.uploadMessage) return
		const images = imagesToSend.length > 0 ? await toSubmittedAttachments(imagesToSend) : undefined
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
			<div className="size-full overflow-y-auto overscroll-contain px-4 pt-4 pb-8 sm:px-6">
				<div className="mx-auto flex w-full max-w-[760px] flex-col">
					<header className="flex items-center justify-between gap-3 pb-2">
						<Button size="sm" variant="ghost" as={BasicLink} href="/ai/projects" className="-ml-2">
							<Icon name="chevron-left" height={14} width={14} />
							All projects
						</Button>
						<div className="flex items-center gap-1">
							<Ariakit.MenuProvider placement="bottom-end">
								<Ariakit.MenuButton
									ref={projectMenuRef}
									aria-label={`Actions for ${project.data.name}`}
									render={<Button size="md" variant="ghost" square />}
								>
									<Icon name="ellipsis" height={16} width={16} />
								</Ariakit.MenuButton>
								<MenuSurface variant="actions" gutter={6} className="z-50 w-52">
									<MenuItem onClick={renameStore.show}>Rename project</MenuItem>
									<MenuItem onClick={deleteStore.show} className="text-error!">
										Delete project
									</MenuItem>
								</MenuSurface>
							</Ariakit.MenuProvider>
						</div>
					</header>

					<div className="flex items-center gap-2 pb-2">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link-on-tint">
							<Icon name="folder" height={16} width={16} />
						</div>
						<div className="min-w-0 flex-1">
							<h1 className="truncate heading-sm text-primary">{project.data.name}</h1>
							{project.data.description ? (
								<p className="mt-1 line-clamp-1 body-sm text-secondary">{project.data.description}</p>
							) : null}
						</div>
					</div>

					<Tabs value={tab} onValueChange={setTab} values={projectTabs}>
						<Ariakit.TabList aria-label="Project sections" className={tabTrackStyles}>
							{projectTabs.map((id) => (
								<Tab key={id} type="button" value={id} render={<TabLink as="button" />}>
									{id === 'chats' ? 'Chats' : 'Sources'}
								</Tab>
							))}
						</Ariakit.TabList>

						<TabPanel value="sources" hidden={tab !== 'sources'} className="flex flex-col gap-4 pt-4">
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
										key={projectId}
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
						<TabPanel value="chats" hidden={tab !== 'chats'} className="pt-4">
							<form
								onSubmit={(e) => {
									e.preventDefault()
									void handleSubmit()
								}}
								className="relative mb-4"
							>
								<div className={imageUpload.selectedImages.length > 0 ? 'mb-2' : ''}>
									<UploadSelectionNotice
										feedback={imageUpload.selectionFeedback}
										onDismiss={imageUpload.dismissSelectionFeedback}
									/>
									<ImageUpload
										retryUpload={imageUpload.retryUpload}
										uploadMessage={imageUpload.uploadMessage}
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
								<div className="group/composer flex items-end gap-2 rounded-lg border border-medium bg-page p-1.5 focus-within:border-brand">
									<AddSourcesMenu
										projectId={projectId}
										onAddPhotosFiles={imageUpload.openFilePicker}
										trigger={
											<Button
												type="button"
												size="md"
												variant="ghost"
												square
												aria-label="Add files"
												className="self-end!"
											>
												<Icon name="plus" height={16} width={16} />
											</Button>
										}
									/>
									<textarea
										ref={textareaRef}
										value={prompt}
										onChange={(e) => setPrompt(e.target.value)}
										onKeyDown={handleKey}
										onPaste={handlePaste}
										rows={1}
										aria-label={`New chat in ${project.data.name}`}
										placeholder="New chat in this project…"
										className="block min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-6 text-primary placeholder:text-tertiary focus:outline-hidden"
									/>
									<button
										type="submit"
										disabled={
											!!imageUpload.uploadMessage ||
											(!prompt.trim() && imageUpload.selectedImages.length === 0) ||
											isStreaming
										}
										aria-label="Send message"
										className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand focus-visible:focus-ring-on-brand enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<Icon name="arrow-up" height={16} width={16} />
									</button>
								</div>
							</form>
							<section>
								{projectSessions.error ? (
									<div role="alert" className="mb-3 flex flex-wrap items-center gap-2 body-sm text-error">
										<p>Couldn&apos;t load chats.</p>
										<Button
											type="button"
											size="sm"
											disabled={projectSessions.isFetching}
											onClick={() => void projectSessions.refetch()}
										>
											{projectSessions.isFetching ? <LoadingSpinner size={12} /> : null}
											{projectSessions.isFetching ? 'Retrying…' : 'Retry chats'}
										</Button>
									</div>
								) : null}
								{projectSessions.isLoading ? (
									<div role="status" aria-live="polite" className="flex justify-center py-8">
										<LoadingIndicator label="Loading chats" />
									</div>
								) : sessions.length === 0 ? (
									!projectSessions.error ? (
										<div className="flex flex-col gap-1 py-4 text-center">
											<h2 className="label-md text-primary">No chats yet</h2>
											<p className="body-sm text-secondary">
												Start a chat above. LlamaAI uses this project&apos;s instructions and files in every
												conversation.
											</p>
										</div>
									) : null
								) : (
									<ul className="flex flex-col">
										{sessions.map((session) => (
											<ProjectSessionItem
												key={session.sessionId}
												session={session}
												projectId={projectId}
												onSelect={() => handlePickSession(session)}
												onDelete={() => handleDeleteSession(session)}
												isDeleting={deleteSession.isPending && deleteSession.variables?.sessionId === session.sessionId}
											/>
										))}
									</ul>
								)}
							</section>
						</TabPanel>
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
									if (projectMenuRef.current?.isConnected) sessionDeleteStore.hide()
								})
								.catch((error) => {
									if (!sessionDeleteStore.getState().contentElement?.isConnected) toast.error(error.message)
								})
						}}
					/>
					<CreateProjectModal
						key={`rename-${projectId}`}
						finalFocus={projectMenuRef}
						dialogStore={renameStore}
						mode="rename"
						project={project.data}
					/>
					<DeleteProjectModal
						key={`delete-${projectId}`}
						finalFocus={projectMenuRef}
						dialogStore={deleteStore}
						project={project.data}
						onDeleted={() => {
							if (projectMenuRef.current?.isConnected) void router.push('/ai/projects')
						}}
					/>
				</div>
			</div>
		</SessionListFocusContext.Provider>
	)
}
