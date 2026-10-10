import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { focusRegionOnLeave, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { EmptyState, InlineStatus, PanelLoadingStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { useFileDropTarget } from '../components/FileDrop'
import { ComposerFrame } from '../components/input/ComposerFrame'
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

const EMPTY_SESSION_LIST: NonNullable<ProjectLandingProps['sessionList']> = []

export function ProjectLanding({
	projectId,
	tier,
	initialTab = 'chats',
	sessionList = EMPTY_SESSION_LIST,
	onSubmit,
	isStreaming,
	onPickSession,
	enterToSend
}: ProjectLandingProps) {
	const router = useRouter()
	const usage = useProjectUsage()
	const project = useProjectDetail(projectId)
	const projectSessions = useProjectSessions(projectId)
	// The error sits above the chats it kept, so a failed refresh counts too.
	const sessionsFailed = queryReadFailed(projectSessions) || queryRefreshFailed(projectSessions)
	const projectMenuRef = useRef<HTMLButtonElement>(null)
	const renameStore = Ariakit.useDialogStore()
	const [confirmDelete, setConfirmDelete] = useState(false)
	const clearUnseenCompletion = useClearUnseenCompletion()
	const deleteSession = useDeleteSession()
	// The chat a confirmation would delete, and the next chat's Delete button, which takes focus once it is gone.
	const [sessionToDelete, setSessionToDelete] = useState<{
		session: (typeof sessions)[number]
		next: HTMLElement | null | undefined
	} | null>(null)
	// Where that confirmation returns focus: the Delete button that opened it, or after a deletion, the next chat.
	const deleteFocusRef = useRef<HTMLElement | null>(null)
	const tab = initialTab
	const [prompt, setPrompt] = usePromptDraft(`project:${projectId}`)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const imageUpload = useImageUpload()
	useFileDropTarget('Attach files to message', imageUpload.addDroppedFiles, tab === 'chats' && !!project.data)
	const shiftHeldRef = useRef(false)
	// While a send is on its way, a second Enter cannot send it twice and the field holds the text being sent. A send
	// whose attachments could not be read stops there, keeps the draft and says why.
	const [send, setSend] = useState<'idle' | 'sending' | 'readFailed'>('idle')
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

	if (project.isLoading && !queryReadFailed(project)) {
		return <PanelLoadingStatus label="Loading project" />
	}

	if (!project.data) {
		if (
			project.error instanceof LlamaAITransportError &&
			(project.error.status === 403 || project.error.status === 404)
		) {
			return (
				<EmptyState
					size="lg"
					headingAs="h1"
					title="Project not found"
					actions={
						<Button as={BasicLink} href="/ai/projects" size="md">
							Back to projects
						</Button>
					}
				>
					This project does not exist or you do not have access to it.
				</EmptyState>
			)
		}
		return (
			<div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
				<InlineStatus
					variant="error"
					action={
						<Button
							ref={focusRegionOnLeave}
							variant="secondary"
							size="sm"
							pendingLabel="Retrying…"
							pending={project.isFetching}
							onClick={() => void project.refetch()}
						>
							Try again
						</Button>
					}
				>
					Couldn&rsquo;t load this project.
				</InlineStatus>
				<span className="label-sm">
					<Button as={BasicLink} href="/ai/projects" variant="link">
						Back to projects
					</Button>
				</span>
			</div>
		)
	}

	const handleSubmit = async () => {
		const trimmed = prompt.trim()
		const imagesToSend = [...imageUpload.selectedImages]
		if ((!trimmed && imagesToSend.length === 0) || isStreaming || send === 'sending') return
		if (imageUpload.uploadMessage) return
		setSend('sending')
		// null: an attachment could not be read; the draft and attachments stay for another try.
		const images = imagesToSend.length > 0 ? await toSubmittedAttachments(imagesToSend).catch(() => null) : undefined
		if (images === null) {
			setSend('readFailed')
			return
		}
		const accepted = await Promise.resolve(onSubmit(trimmed, undefined, images))
		setSend('idle')
		if (accepted === false) return
		setPrompt('')
		imageUpload.clearImages()
	}

	const handlePickSession = (session: (typeof sessions)[number]) => {
		if (session.hasUnseenCompletion) clearUnseenCompletion(session.sessionId, projectId)
		onPickSession(session.sessionId)
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
					<header className="flex items-center justify-between gap-3 pb-2 label-sm">
						<Button variant="link" as={BasicLink} href="/ai/projects">
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
								<MenuSurface variant="actions" gutter={6} className="w-52">
									<MenuItem onClick={renameStore.show}>Rename project</MenuItem>
									<MenuItem destructive onClick={() => setConfirmDelete(true)}>
										Delete project
									</MenuItem>
								</MenuSurface>
							</Ariakit.MenuProvider>
						</div>
					</header>

					<div className="flex items-center gap-2 pb-2">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link">
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
								noValidate
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
								<ComposerFrame layout="row" className="group/composer">
									<AddSourcesMenu
										projectId={projectId}
										onAddPhotosFiles={imageUpload.openFilePicker}
										trigger={
											<Tooltip
												content="Add files"
												render={
													<Button
														type="button"
														size="md"
														variant="ghost"
														square
														aria-label="Add files"
														className="self-end!"
													/>
												}
											>
												<Icon name="plus" height={16} width={16} />
											</Tooltip>
										}
									/>
									<textarea
										ref={textareaRef}
										value={prompt}
										onChange={(e) => setPrompt(e.target.value)}
										onKeyDown={handleKey}
										onPaste={handlePaste}
										readOnly={send === 'sending'}
										rows={1}
										aria-label={`New chat in ${project.data.name}`}
										placeholder="New chat in this project…"
										className="block min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1 body-lg text-primary placeholder:text-tertiary focus:outline-hidden"
									/>
									<Button
										type="submit"
										variant="primary"
										size="md"
										square
										// Sending clears the prompt and starts a stream, which disables the button that was pressed.
										disabled={
											!!imageUpload.uploadMessage ||
											(!prompt.trim() && imageUpload.selectedImages.length === 0) ||
											isStreaming
										}
										accessibleWhenDisabled
										pendingLabel="Sending…"
										pending={send === 'sending'}
										aria-label="Send message"
									>
										<Icon name="arrow-up" height={16} width={16} />
									</Button>
								</ComposerFrame>
								{send === 'readFailed' ? (
									<div className="mt-2">
										<InlineStatus variant="error">
											Couldn&apos;t read an attachment. Remove it or attach it again, then send.
										</InlineStatus>
									</div>
								) : null}
							</form>
							<section>
								{sessionsFailed ? (
									<div className="mb-3">
										<InlineStatus
											variant="error"
											action={
												<Button
													ref={focusRegionOnLeave}
													variant="secondary"
													size="sm"
													pendingLabel="Retrying…"
													pending={projectSessions.isFetching}
													onClick={() => void projectSessions.refetch()}
												>
													Try again
												</Button>
											}
										>
											Couldn&apos;t load chats.
										</InlineStatus>
									</div>
								) : null}
								{projectSessions.isLoading && !sessionsFailed ? (
									<SurfaceBodyLoadingStatus label="Loading chats" className="min-h-24" />
								) : sessions.length === 0 ? (
									!sessionsFailed ? (
										<EmptyState size="md" title="No chats yet" framed>
											Start a chat above. LlamaAI uses this project&apos;s instructions and files in every conversation.
										</EmptyState>
									) : null
								) : (
									<ul className="flex flex-col">
										{sessions.map((session) => (
											<ProjectSessionItem
												key={session.sessionId}
												session={session}
												projectId={projectId}
												onSelect={() => handlePickSession(session)}
												onDelete={(trigger) => {
													deleteFocusRef.current = trigger
													setSessionToDelete({ session, next: neighbourRowControl(trigger.closest('li')!, trigger) })
												}}
											/>
										))}
									</ul>
								)}
							</section>
						</TabPanel>
					</Tabs>

					{sessionToDelete ? (
						<DeleteSessionDialog
							title={`Delete “${sessionToDelete.session.title}”?`}
							mutation={deleteSession}
							variables={{ sessionId: sessionToDelete.session.sessionId, projectId }}
							onClose={() => setSessionToDelete(null)}
							onSuccess={() => {
								deleteFocusRef.current = sessionToDelete.next ?? projectMenuRef.current
							}}
							finalFocus={deleteFocusRef}
						/>
					) : null}
					<CreateProjectModal
						key={`rename-${projectId}`}
						finalFocus={projectMenuRef}
						dialogStore={renameStore}
						project={project.data}
					/>
					{confirmDelete ? (
						<DeleteProjectModal
							key={projectId}
							finalFocus={projectMenuRef}
							project={project.data}
							onClose={() => setConfirmDelete(false)}
							onDeleted={() => {
								if (projectMenuRef.current?.isConnected) void router.push('/ai/projects')
							}}
						/>
					) : null}
				</div>
			</div>
		</SessionListFocusContext.Provider>
	)
}
