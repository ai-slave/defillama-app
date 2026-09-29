import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEditor } from '@tiptap/react'
import Router, { useRouter } from 'next/router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { canManageResearchArticle } from '~/containers/Articles/ArticlesAccessGate'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { InlineStatus, PanelStatus } from '~/ui/Status'
import { formatDateTime, formatRelativeTime } from '~/utils/dateFormat'
import {
	ArticleApiError,
	createArticle,
	deleteArticle,
	discardPendingEdits,
	getOwnedArticle,
	publishArticle,
	unpublishArticle,
	updateArticle as updateRemoteArticle
} from '../api'
import { isScheduled } from '../articleSchedule'
import styles from '../ArticleStyles.module.css'
import { validateArticleChartConfig } from '../chartAdapters'
import {
	applyPendingToLocalArticle,
	createEmptyLocalArticle,
	isDraftPlaceholderSlug,
	normalizeLocalArticleDocument,
	validateLocalArticleForPublish
} from '../document'
import { ResearchLoader } from '../ResearchLoader'
import type { ArticleCalloutTone, ArticleChartConfig, ArticleEmbedConfig, LocalArticleDocument } from '../types'
import { ARTICLE_SECTION_SLUGS } from '../types'
import { type UploadResult, useImageUpload } from '../upload/useImageUpload'
import { ArticleChartPickerDialog } from './ArticleChartPicker'
import { ArticleCoverImageEditor } from './ArticleCoverImageEditor'
import { ArticleEditorCanvas } from './ArticleEditorCanvas'
import { useActiveEntityLink, useEditorFlags, type BlockItem, type MarkButton } from './ArticleEditorControls'
import { CoverDetailsDialog, DeleteArticleDialog } from './ArticleEditorDialogs'
import { ArticleEditorHeader, type ArticleEditorViewMode } from './ArticleEditorHeader'
import { ArticleEditorPreview } from './ArticleEditorPreview'
import { articleQueryKey, sanitizeLinkHref, slugFromTitle, useTicker, formatArticleDate } from './ArticleEditorUtils'
import { ArticleMetaDialog } from './ArticleMetaDialog'
import { ArticleTitleFields } from './ArticleTitleFields'
import { EmbedPicker } from './EmbedPicker'
import { createArticleEditorExtensions } from './extensions'
import { LlamaAIChartPickerDialog } from './LlamaAIChartPicker'
import { triggerInlineImagePicker, type ArticleImageUploadFn } from './nodes/ArticleImage'
import type { ArticlePeoplePanelConfig } from './peoplePanel'
import { PeoplePanelDialog } from './PeoplePanelDialog'
import { RevisionHistoryDrawer } from './RevisionHistoryDrawer'
import { useArticleCollaborators } from './useArticleCollaborators'
import { useEditorEventCallback } from './useEditorEventCallback'

/** The pending revision's timestamp wins whenever a draft edit is unpublished. */
function latestArticleUpdatedAt(article: Pick<LocalArticleDocument, 'pendingUpdatedAt' | 'updatedAt'>) {
	return article.pendingUpdatedAt ?? article.updatedAt
}

/** A non-Error reason gets the caller's fallback rather than being stringified. */
function errorMessageOr(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback
}

function publishValidationErrors(error: unknown) {
	if (!(error instanceof ArticleApiError)) return []
	return error.validationErrors ?? []
}

export function ArticleEditorClient({ articleId }: { articleId?: string }) {
	const router = useRouter()
	const routeView = Array.isArray(router.query.view) ? router.query.view[0] : router.query.view
	const { authorizedFetch, isAuthenticated, loaders } = useAuthContext()
	const revalidateLanding = useResearchLandingRevalidation()
	const queryClient = useQueryClient()
	const [article, setArticle] = useState<LocalArticleDocument>(() => createEmptyLocalArticle())
	const [isDirty, setIsDirty] = useState(false)
	// A save response may acknowledge an older draft while the user keeps typing.
	const draftRevisionRef = useRef(0)
	const saveInFlightRef = useRef(false)
	const [savedAt, setSavedAt] = useState<string | null>(null)
	const [wordCount, setWordCount] = useState(0)
	const [linkEdit, setLinkEdit] = useState<{ url: string; newTab: boolean } | null>(null)
	const linkInputRef = useRef<HTMLInputElement | null>(null)
	// Autosave and the save shortcut re-enter saveArticle, which itself schedules
	// the next autosave, so this mirror is the one latest-value ref left: a stable
	// callback cannot close the cycle without referencing itself.
	const saveRef = useRef<(opts?: { silent?: boolean }) => Promise<boolean>>(async () => false)
	const [editingChart, setEditingChart] = useState<{ config: ArticleChartConfig; pos: number } | null>(null)
	const [editingEmbed, setEditingEmbed] = useState<{ config: ArticleEmbedConfig; pos: number } | null>(null)
	const [editingPanel, setEditingPanel] = useState<{ config: ArticlePeoplePanelConfig; pos: number } | null>(null)
	// Closing a dialog by any means (button, Escape, backdrop) drops what it was editing.
	const chartDialog = Ariakit.useDialogStore({
		setOpen: (open) => {
			if (!open) setEditingChart(null)
		}
	})
	const llamaaiChartDialog = Ariakit.useDialogStore()
	const embedDialog = Ariakit.useDialogStore({
		setOpen: (open) => {
			if (!open) setEditingEmbed(null)
		}
	})
	const peoplePanelDialog = Ariakit.useDialogStore({
		setOpen: (open) => {
			if (!open) setEditingPanel(null)
		}
	})
	const metaDialog = Ariakit.useDialogStore()
	const deleteDialog = Ariakit.useDialogStore()
	const coverDetailsDialog = Ariakit.useDialogStore()
	const [saveError, setSaveError] = useState(false)
	const [slugEditing, setSlugEditing] = useState(false)
	const [slugDraft, setSlugDraft] = useState('')
	const [publishErrors, setPublishErrors] = useState<Record<string, string>>({})
	const [viewMode, setViewMode] = useState<ArticleEditorViewMode>('write')
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const autoCreatingRef = useRef(false)
	const autoRedirectingRef = useRef(false)
	const hydratedArticleIdRef = useRef<string | null>(null)
	const routeViewModeHandledRef = useRef<string | null>(null)

	const { uploadFile: uploadInlineImageRaw } = useImageUpload({
		scope: 'article-inline',
		articleId: article.id ?? null
	})
	const { uploadWithToast: uploadCoverImage, isUploading: isUploadingCover } = useImageUpload({
		scope: 'article-cover',
		articleId: article.id ?? null
	})
	const coverFileInputRef = useRef<HTMLInputElement>(null)

	const uploadInlineImage = useCallback<ArticleImageUploadFn>(
		(file: File): Promise<UploadResult> => {
			return toast.promise(uploadInlineImageRaw(file), {
				loading: 'Uploading image…',
				success: 'Image inserted',
				error: (err) => (err instanceof Error ? err.message : 'Upload failed')
			})
		},
		[uploadInlineImageRaw]
	)

	// Keep tiptap's plugins stable while their event handlers follow the committed article.
	const getUpload = useEditorEventCallback(() => uploadInlineImage)
	const getArticleId = useEditorEventCallback(() => article.id)

	const extensions = useMemo(
		() =>
			createArticleEditorExtensions({
				getUpload,
				getArticleId,
				onMissingArticleId: () => toast.error('Save the draft first to attach images')
			}),
		[getUpload, getArticleId]
	)

	const scheduleAutosave = useCallback(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)
		if (!getArticleId()) return
		debounceRef.current = setTimeout(() => {
			debounceRef.current = null
			void saveRef.current({ silent: true })
		}, 1500)
	}, [getArticleId])

	useTicker()

	const editor = useEditor({
		extensions,
		content: article.contentJson,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				role: 'textbox',
				'aria-label': 'Article body',
				'aria-multiline': 'true',
				class:
					'article-editor-prose prose prose-neutral dark:prose-invert max-w-none focus:outline-hidden prose-a:text-link prose-headings:tracking-tight prose-headings:font-semibold min-h-[60vh] py-10 break-words [overflow-wrap:anywhere]'
			}
		},
		onUpdate: ({ editor: instance }) => {
			const text = instance.getText()
			setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
			draftRevisionRef.current += 1
			setIsDirty(true)
			scheduleAutosave()
		}
	})

	const flags = useEditorFlags(editor)
	const activeEntity = useActiveEntityLink(editor)
	const ownedArticleQueryKey = articleQueryKey(articleId)
	const ownedArticleQuery = useQuery({
		queryKey: ownedArticleQueryKey,
		queryFn: () => getOwnedArticle(articleId!, authorizedFetch),
		enabled: !!editor && !loaders.userLoading && isAuthenticated && !!articleId,
		retry: false,
		refetchOnWindowFocus: false
	})
	const createArticleMutation = useMutation({
		mutationFn: () => createArticle(createEmptyLocalArticle(), authorizedFetch)
	})
	const { mutate: createArticleMutate } = createArticleMutation
	// The mutation forgets its error when a retry starts, so the page keeps the last one: the retry then waits in
	// its Try again button with the message still shown, instead of dropping back to the page loader.
	const [createError, setCreateError] = useState<string | null>(null)
	// The redirect into the new draft belongs to the mutate call, not the mutation: a reader who
	// confirmed the "save in progress" prompt and left must not be pulled back into the editor.
	const createDraft = useCallback(() => {
		createArticleMutate(undefined, {
			onError: (error) => setCreateError(errorMessageOr(error, 'Failed to create draft')),
			onSuccess: (saved) => {
				autoRedirectingRef.current = true
				void Router.replace(`/research/edit/${saved.id}`)
			}
		})
	}, [createArticleMutate])
	const saveArticleMutation = useMutation({
		mutationFn: ({
			targetArticleId,
			articlePayload
		}: {
			targetArticleId?: string
			articlePayload: LocalArticleDocument
		}) =>
			targetArticleId
				? updateRemoteArticle(targetArticleId, articlePayload, authorizedFetch)
				: createArticle(articlePayload, authorizedFetch)
	})
	const setOwnedArticleCache = (saved: LocalArticleDocument) => {
		if (saved.id) queryClient.setQueryData(articleQueryKey(saved.id), saved)
	}
	const isLoading =
		loaders.userLoading || ownedArticleQuery.isLoading || (createArticleMutation.isPending && createError === null)
	const isSaving = saveArticleMutation.isPending

	useEffect(() => {
		if (!editor) return
		if (loaders.userLoading) return
		if (!isAuthenticated) {
			return
		}
		if (!articleId) {
			// One automatic attempt per visit; after a failure the reader retries with Try again.
			if (autoCreatingRef.current) return
			autoCreatingRef.current = true
			createDraft()
		}
	}, [articleId, createDraft, editor, isAuthenticated, loaders.userLoading])

	useEffect(() => {
		// A different route article must hydrate again even if its query data was already applied once.
		hydratedArticleIdRef.current = null
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- the route article id is the reset trigger.
	}, [articleId])

	useEffect(() => {
		if (!editor || !ownedArticleQuery.data) return
		if (hydratedArticleIdRef.current === ownedArticleQuery.data.id) return
		hydratedArticleIdRef.current = ownedArticleQuery.data.id
		const merged = applyPendingToLocalArticle(ownedArticleQuery.data, ownedArticleQuery.data.pending)
		setArticle(merged)
		queueMicrotask(() => {
			if (editor.isDestroyed) return
			editor.commands.setContent(merged.contentJson, { emitUpdate: false })
		})
		setIsDirty(false)
		setSaveError(false)
		const text = merged.plainText || ''
		setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
		setSavedAt(latestArticleUpdatedAt(merged))
	}, [editor, ownedArticleQuery.data])

	const markArticleDirty = useCallback(() => {
		draftRevisionRef.current += 1
		setIsDirty(true)
		scheduleAutosave()
	}, [scheduleAutosave])

	const updateArticle = useCallback(
		<K extends keyof LocalArticleDocument>(key: K, value: LocalArticleDocument[K]) => {
			setArticle((current) => ({
				...current,
				[key]: value,
				...(key === 'title' && isDraftPlaceholderSlug(current.slug) ? { slug: slugFromTitle(String(value)) } : {})
			}))
			markArticleDirty()
		},
		[markArticleDirty]
	)

	const saveArticle = async (opts: { silent?: boolean } = {}) => {
		if (!editor) return false
		// An edit route saves only its own loaded article; saving before it loads would create an unrelated draft.
		if (articleId && !article.id) return false
		if (!isAuthenticated) {
			if (!opts.silent) toast.error('Please sign in to save research')
			return false
		}
		if (saveInFlightRef.current) return false
		const savedRevision = draftRevisionRef.current
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
			debounceRef.current = null
		}
		// Validation runs before the request so a malformed document reports
		// itself instead of arriving in the catch below as a fake save failure.
		const normalized = normalizeLocalArticleDocument({ ...article, contentJson: editor.getJSON() })
		if (normalized.ok === false) {
			setSaveError(true)
			if (!opts.silent) toast.error(normalized.error)
			return false
		}
		if (!opts.silent) setSaveError(false)
		saveInFlightRef.current = true
		let didSave = false
		try {
			const saved = await saveArticleMutation.mutateAsync({
				targetArticleId: article.id,
				articlePayload: normalized.value
			})
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setOwnedArticleCache(saved)
			setSavedAt(latestArticleUpdatedAt(merged))
			setSaveError(false)
			if (savedRevision === draftRevisionRef.current) {
				setArticle(merged)
				if (!article.id) {
					void router.replace(`/research/edit/${saved.id}`)
				}
				setIsDirty(false)
				didSave = true
			} else {
				// The user edited while the request was in flight, so keep their
				// newer draft and let the next autosave carry it.
				scheduleAutosave()
			}
		} catch (error) {
			setSaveError(true)
			if (!opts.silent) toast.error(errorMessageOr(error, 'Failed to save research'))
		}
		saveInFlightRef.current = false
		return didSave
	}

	const openLinkEditor = useCallback(() => {
		if (!editor) return
		const attrs = editor.getAttributes('link')
		const previous = (attrs.href as string | undefined) ?? ''
		const previousTarget = attrs.target as string | undefined
		setLinkEdit({ url: previous, newTab: previousTarget !== '_self' })
		setTimeout(() => linkInputRef.current?.focus(), 0)
	}, [editor])

	const handleLinkRail = useCallback(() => {
		if (!editor) return
		const { from, to } = editor.state.selection
		if (from === to) {
			const placeholder = 'link'
			editor
				.chain()
				.focus()
				.insertContent(placeholder)
				.setTextSelection({ from, to: from + placeholder.length })
				.run()
		}
		openLinkEditor()
	}, [editor, openLinkEditor])

	const applyLink = (raw: string, newTab: boolean) => {
		if (!editor) return
		const url = raw.trim()
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run()
			setLinkEdit(null)
			return
		}
		const href = sanitizeLinkHref(url)
		if (!href) {
			toast.error('That link is not allowed')
			return
		}
		editor
			.chain()
			.focus()
			.extendMarkRange('link')
			.setLink({ href, target: newTab ? '_blank' : '_self' })
			.run()
		setLinkEdit(null)
	}

	const unsetActiveEntityLink = useCallback(() => {
		if (!editor) return
		editor.chain().focus().extendMarkRange('entityLink').unsetEntityLink().run()
	}, [editor])

	const activeEntityRoute = activeEntity?.route
	const openActiveEntityLink = useCallback(() => {
		if (!activeEntityRoute) return
		window.open(activeEntityRoute, '_blank', 'noopener,noreferrer')
	}, [activeEntityRoute])

	const changeActiveEntityLink = useCallback(() => {
		if (!editor) return
		const label = activeEntity?.label ?? ''
		editor.chain().focus().extendMarkRange('entityLink').deleteSelection().insertContent(` @${label}`).run()
	}, [editor, activeEntity?.label])

	const beginSlugEdit = useCallback(() => {
		setSlugDraft(article.slug)
		setSlugEditing(true)
	}, [article.slug])

	const cancelSlugEdit = useCallback(() => {
		setSlugEditing(false)
	}, [])

	const commitSlugEdit = useCallback(() => {
		const next = slugFromTitle(slugDraft)
		if (!next || next === article.slug) {
			setSlugEditing(false)
			return
		}
		updateArticle('slug', next)
		setSlugEditing(false)
	}, [slugDraft, article.slug, updateArticle])

	// saveArticle is rebuilt every render, so the mirror is refreshed after every commit.
	useLayoutEffect(() => {
		saveRef.current = saveArticle
	})

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
				event.preventDefault()
				saveRef.current()
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [])

	useEffect(() => {
		if (!isDirty) return
		const handler = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', handler)
		return () => window.removeEventListener('beforeunload', handler)
	}, [isDirty])

	useEffect(() => {
		const hasInflight = () => isSaving || createArticleMutation.isPending
		const handler = (nextUrl: string) => {
			if (nextUrl === router.asPath) return
			if (autoRedirectingRef.current) {
				autoRedirectingRef.current = false
				return
			}
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
				debounceRef.current = null
				void saveRef.current({ silent: true })
			}
			if (!isDirty && !hasInflight()) return
			const message = hasInflight()
				? 'A save is still in progress. Leave anyway?'
				: 'You have unsaved changes. Leave anyway?'
			if (typeof window !== 'undefined' && !window.confirm(message)) {
				router.events.emit('routeChangeError', new Error('routeChange aborted'), nextUrl, { shallow: false })
				throw new Error('routeChange aborted to preserve unsaved changes')
			}
		}
		router.events.on('routeChangeStart', handler)
		return () => router.events.off('routeChangeStart', handler)
	}, [isDirty, isSaving, createArticleMutation.isPending, router])

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [])

	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<{ config: ArticleChartConfig; pos: number }>).detail
			if (!detail) return
			const normalized = validateArticleChartConfig(detail.config)
			if (!normalized) return
			setEditingChart({ config: normalized, pos: detail.pos })
			chartDialog.show()
		}
		document.addEventListener('article:edit-chart', handler)
		return () => document.removeEventListener('article:edit-chart', handler)
	}, [chartDialog])

	useEffect(() => {
		const editHandler = (event: Event) => {
			const detail = (event as CustomEvent<{ config: ArticleEmbedConfig; pos: number }>).detail
			if (!detail) return
			setEditingEmbed({ config: detail.config, pos: detail.pos })
			embedDialog.show()
		}
		const openHandler = () => {
			setEditingEmbed(null)
			embedDialog.show()
		}
		document.addEventListener('article:edit-embed', editHandler)
		document.addEventListener('article:open-embed-picker', openHandler)
		return () => {
			document.removeEventListener('article:edit-embed', editHandler)
			document.removeEventListener('article:open-embed-picker', openHandler)
		}
	}, [embedDialog])

	useEffect(() => {
		const handler = () => llamaaiChartDialog.show()
		document.addEventListener('article:open-llamaai-chart-picker', handler)
		return () => document.removeEventListener('article:open-llamaai-chart-picker', handler)
	}, [llamaaiChartDialog])

	useEffect(() => {
		const handler = () => {
			if (!editor) return
			if (!getArticleId()) {
				toast.error('Save the draft first to attach images')
				return
			}
			void triggerInlineImagePicker(editor, getUpload)
		}
		document.addEventListener('article:trigger-image-upload', handler)
		return () => document.removeEventListener('article:trigger-image-upload', handler)
	}, [editor, getArticleId, getUpload])

	useEffect(() => {
		const editHandler = (event: Event) => {
			const detail = (event as CustomEvent<{ config: ArticlePeoplePanelConfig | null; pos: number }>).detail
			if (!detail || typeof detail.pos !== 'number') return
			setEditingPanel(detail.config ? { config: detail.config, pos: detail.pos } : null)
			peoplePanelDialog.show()
		}
		const openHandler = () => {
			setEditingPanel(null)
			peoplePanelDialog.show()
		}
		document.addEventListener('article:edit-people-panel', editHandler)
		document.addEventListener('article:open-people-panel-picker', openHandler)
		return () => {
			document.removeEventListener('article:edit-people-panel', editHandler)
			document.removeEventListener('article:open-people-panel-picker', openHandler)
		}
	}, [peoplePanelDialog])

	const handleChartSubmit = useCallback(
		(config: ArticleChartConfig) => {
			if (!editor) return
			if (editingChart) {
				const tr = editor.state.tr.setNodeMarkup(editingChart.pos, undefined, { config })
				editor.view.dispatch(tr)
				setEditingChart(null)
			} else {
				editor.chain().focus().insertDefillamaChart(config).run()
			}
		},
		[editor, editingChart]
	)

	const handleEmbedSubmit = useCallback(
		(config: ArticleEmbedConfig) => {
			if (!editor) return
			if (editingEmbed) {
				const tr = editor.state.tr.setNodeMarkup(editingEmbed.pos, undefined, { config })
				editor.view.dispatch(tr)
				setEditingEmbed(null)
			} else {
				editor.chain().focus().insertArticleEmbed(config).run()
			}
		},
		[editor, editingEmbed]
	)

	const handlePeoplePanelSubmit = useCallback(
		(config: ArticlePeoplePanelConfig) => {
			if (!editor) return
			if (editingPanel) {
				editor.chain().focus().updatePeoplePanel({ pos: editingPanel.pos, config }).run()
				setEditingPanel(null)
			} else {
				editor.chain().focus().insertPeoplePanel(config).run()
			}
		},
		[editor, editingPanel]
	)

	const [historyOpen, setHistoryOpen] = useState(false)
	const publishMutation = useMutation({
		mutationFn: ({ articleId: targetArticleId, goLiveAt }: { articleId: string; goLiveAt?: string | null }) =>
			publishArticle(targetArticleId, authorizedFetch, goLiveAt !== undefined ? { goLiveAt } : {}),
		onSuccess: (saved) => setOwnedArticleCache(saved)
	})
	const unpublishMutation = useMutation({
		mutationFn: (targetArticleId: string) => unpublishArticle(targetArticleId, authorizedFetch),
		onSuccess: (saved) => setOwnedArticleCache(saved)
	})
	const discardPendingMutation = useMutation({
		mutationFn: (targetArticleId: string) => discardPendingEdits(targetArticleId, authorizedFetch),
		onSuccess: (saved) => setOwnedArticleCache(saved)
	})
	const deleteArticleMutation = useMutation({
		mutationFn: (targetArticleId: string) => deleteArticle(targetArticleId, authorizedFetch),
		onSuccess: () => {
			revalidateLanding()
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : 'Failed to delete')
		}
	})
	const isPublishing = publishMutation.isPending || unpublishMutation.isPending
	const articleIsScheduled = isScheduled(article)
	const isDiscarding = discardPendingMutation.isPending
	const {
		collaboratorAdding,
		collaboratorEmail,
		collaboratorError,
		collaborators,
		collaboratorsLoadError,
		collaboratorsLoading,
		handleAddCollaborator,
		handleRemoveCollaborator,
		handleToggleHidden,
		handleTransferOwnership,
		setCollaboratorEmail,
		setCollaboratorError
	} = useArticleCollaborators({
		articleId: article.id,
		authorizedFetch,
		queryClient,
		setArticle,
		setOwnedArticleCache
	})

	const flushPendingSave = useCallback(async () => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
			debounceRef.current = null
			return saveRef.current({ silent: true })
		}
		return isDirty ? saveRef.current({ silent: true }) : true
	}, [isDirty])

	const handlePublish = async (opts?: { goLiveAt?: string | null }): Promise<boolean> => {
		if (!article.id) {
			toast.error('Save the draft before publishing')
			return false
		}
		const localErrors = validateLocalArticleForPublish(article)
		if (localErrors.length > 0) {
			setPublishErrors(Object.fromEntries(localErrors.map((e) => [e.field, e.message])))
			toast.error('Fix required fields before publishing')
			return false
		}
		setPublishErrors({})
		// An explicit `goLiveAt` wins; otherwise publishing a scheduled article
		// clears its schedule and publishing a draft leaves the field untouched.
		const goLiveAt = opts && 'goLiveAt' in opts ? opts.goLiveAt : article.goLiveAt != null ? null : undefined
		const publishPayload = { articleId: article.id, ...(goLiveAt !== undefined ? { goLiveAt } : {}) }
		const publishedMessage = article.status === 'published' ? 'Update published' : 'Published'
		try {
			if (!(await flushPendingSave())) {
				toast.error('Save the latest edits before publishing.')
				return false
			}
			const saved = await publishMutation.mutateAsync(publishPayload)
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setArticle(merged)
			setSavedAt(merged.updatedAt)
			revalidateLanding()
			if (isScheduled(merged)) {
				toast.success(`Scheduled for ${formatArticleDate(merged.goLiveAt)}`)
			} else if (merged.status === 'published') {
				toast.success(publishedMessage)
			} else {
				toast.success('Saved')
			}
			return true
		} catch (error) {
			const validationErrors = publishValidationErrors(error)
			if (validationErrors.length > 0) {
				setPublishErrors(Object.fromEntries(validationErrors.map((e) => [e.field, e.message])))
			}
			toast.error(errorMessageOr(error, 'Failed to publish'))
			return false
		}
	}

	const handleUnpublish = async () => {
		if (!article.id) return
		try {
			const saved = await unpublishMutation.mutateAsync(article.id)
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setArticle(merged)
			if (editor) editor.commands.setContent(merged.contentJson, { emitUpdate: false })
			setSavedAt(merged.updatedAt)
			revalidateLanding()
			toast.success('Moved to drafts')
		} catch (error) {
			toast.error(errorMessageOr(error, 'Failed to unpublish'))
		}
	}

	const handleDiscardPending = async () => {
		if (!article.id) return
		if (!confirm('Discard pending changes? The live version will not be modified.')) return
		try {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
				debounceRef.current = null
			}
			const saved = await discardPendingMutation.mutateAsync(article.id)
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setArticle(merged)
			if (editor) editor.commands.setContent(merged.contentJson, { emitUpdate: false })
			setSavedAt(merged.updatedAt)
			setIsDirty(false)
			toast.success('Pending changes discarded')
		} catch (error) {
			toast.error(errorMessageOr(error, 'Failed to discard changes'))
		}
	}

	const handleRevisionRestored = useCallback(
		(saved: LocalArticleDocument) => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
				debounceRef.current = null
			}
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setArticle(merged)
			if (editor) editor.commands.setContent(merged.contentJson, { emitUpdate: false })
			setSavedAt(latestArticleUpdatedAt(merged))
			setIsDirty(false)
			setSaveError(false)
		},
		[editor]
	)

	const handleCoverFile = async (file: File | null | undefined) => {
		if (!file) return
		// Settled through `then` rather than try/catch, so the input is cleared on every path. A `finally`
		// would do that too, but the compiler cannot lower one; an early `return` inside a `try` would
		// skip the clear and leave the same file unpickable.
		const upload = await uploadCoverImage(file).then(
			(value) => ({ ok: true as const, value }),
			() => ({ ok: false as const, value: undefined })
		)
		// Metadata can change while the replacement image uploads, and the reader may have moved on.
		if (upload.ok && getArticleId() === article.id) {
			setArticle((current) => ({
				...current,
				coverImage: {
					...current.coverImage,
					url: upload.value.url,
					alt: current.coverImage?.alt || current.title
				}
			}))
			markArticleDirty()
		}
		if (coverFileInputRef.current) coverFileInputRef.current.value = ''
	}

	const openCoverPicker = () => coverFileInputRef.current?.click()

	const updateCoverField = (key: 'headline' | 'caption' | 'credit' | 'copyright', value: string) => {
		if (!article.coverImage) return
		updateArticle('coverImage', {
			...article.coverImage,
			[key]: value
		})
	}

	const handleDeleteArticle = () => {
		if (!article.id) return
		deleteDialog.show()
	}

	const confirmDeleteArticle = () => {
		if (!article.id) return
		deleteArticleMutation.mutate(article.id, {
			onSuccess: () => void Router.replace('/research'),
			onSettled: () => deleteDialog.hide()
		})
	}

	const isOwner = canManageResearchArticle(article)
	const isCollaborator = article.viewerRole === 'collaborator'

	const insertCallout = (tone: ArticleCalloutTone) => editor?.chain().focus().insertCallout(tone).run()

	const insertCitation = () => {
		if (!editor) return
		const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
		const existing = (text.match(/\[(\d+)\]/g) ?? []).map((m) => Number(m.slice(1, -1)))
		const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
		editor
			.chain()
			.focus()
			.insertCitation({ id: String(next), label: String(next) })
			.run()
	}

	const buildPreviewArticle = useCallback((): LocalArticleDocument => {
		const contentJson = editor && !editor.isDestroyed ? editor.getJSON() : article.contentJson
		const normalized = normalizeLocalArticleDocument({ ...article, contentJson }, article)
		if (normalized.ok === false) return { ...article, contentJson }
		return {
			...normalized.value,
			coAuthors: article.coAuthors,
			editorialTagMetadata: article.editorialTagMetadata,
			pending: article.pending,
			pendingActorPbUserId: article.pendingActorPbUserId,
			pendingUpdatedAt: article.pendingUpdatedAt,
			viewerRole: article.viewerRole
		}
	}, [article, editor])

	const chartDialogOpen = Ariakit.useStoreState(chartDialog, 'open')
	const embedDialogOpen = Ariakit.useStoreState(embedDialog, 'open')
	const peoplePanelDialogOpen = Ariakit.useStoreState(peoplePanelDialog, 'open')

	// The preview is the current draft rendered as an article; it exists only while previewing.
	const previewArticle = useMemo(
		() => (viewMode === 'preview' ? buildPreviewArticle() : null),
		[buildPreviewArticle, viewMode]
	)
	const handleViewModeChange = useCallback((mode: ArticleEditorViewMode) => setViewMode(mode), [])

	useEffect(() => {
		if (!router.isReady) return
		const routeMode: ArticleEditorViewMode = routeView === 'preview' ? 'preview' : 'write'
		const routeModeKey = `${articleId ?? 'new'}:${routeMode}`
		if (routeViewModeHandledRef.current === routeModeKey) return
		routeViewModeHandledRef.current = routeModeKey
		// oxlint-disable-next-line react/set-state-in-effect -- the route query is only readable once router.isReady, which Next.js documents as effect-only.
		setViewMode(routeMode)
	}, [articleId, routeView, router.isReady])

	if (isLoading) {
		return <ResearchLoader />
	}

	if (!isAuthenticated) {
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-medium bg-surface p-6">
				<h1 className="text-xl font-semibold text-primary">Sign in to write research</h1>
				<p className="text-sm text-secondary">
					Article drafts, revisions, and author profiles are saved to your DefiLlama account.
				</p>
				<SignInModal
					text="Sign in"
					className="mr-auto rounded-md bg-link px-3 py-2 text-sm font-medium text-on-brand"
				/>
			</div>
		)
	}

	// Without the article there is nothing to edit: an editor here would save as an unrelated new draft.
	// A failed background refetch keeps the loaded article on screen.
	if (ownedArticleQuery.isLoadingError) {
		return (
			<div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
				<PanelStatus variant="error">{errorMessageOr(ownedArticleQuery.error, 'Failed to load research')}</PanelStatus>
			</div>
		)
	}

	if (!article.id && createError) {
		return (
			<div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
				<InlineStatus variant="error">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span>{createError}</span>
						<Button
							type="button"
							size="sm"
							onClick={createDraft}
							pendingLabel={createArticleMutation.isPending ? 'Retrying…' : null}
						>
							Try again
						</Button>
					</div>
				</InlineStatus>
			</div>
		)
	}

	const savedLabel = savedAt ? formatRelativeTime(savedAt) : null
	const savedExactLabel = savedAt ? formatDateTime(savedAt, { timeZone: 'local' }) : null
	const readMins = Math.max(1, Math.ceil(wordCount / 220))

	const markButtons: Array<MarkButton> = editor
		? [
				{
					name: 'bold',
					label: 'Bold',
					icon: 'bold',
					isActive: () => flags.bold,
					toggle: () => editor.chain().focus().toggleBold().run()
				},
				{
					name: 'italic',
					label: 'Italic',
					icon: 'italic',
					isActive: () => flags.italic,
					toggle: () => editor.chain().focus().toggleItalic().run()
				},
				{
					name: 'underline',
					label: 'Underline',
					icon: 'underline',
					isActive: () => flags.underline,
					toggle: () => editor.chain().focus().toggleUnderline().run()
				},
				{
					name: 'strike',
					label: 'Strikethrough',
					icon: 'strike',
					isActive: () => flags.strike,
					toggle: () => editor.chain().focus().toggleStrike().run()
				},
				{
					name: 'code',
					label: 'Inline code',
					icon: 'code',
					isActive: () => flags.code,
					toggle: () => editor.chain().focus().toggleCode().run()
				},
				{
					name: 'highlight',
					label: 'Highlight',
					icon: 'highlight',
					isActive: () => flags.highlight,
					toggle: () => editor.chain().focus().toggleHighlight().run()
				}
			]
		: []

	const blockItems: Array<BlockItem> = editor
		? [
				{ label: 'Heading 2', hint: 'H2', run: () => editor.chain().focus().setNode('heading', { level: 2 }).run() },
				{ label: 'Heading 3', hint: 'H3', run: () => editor.chain().focus().setNode('heading', { level: 3 }).run() },
				{ label: 'Bullet list', hint: '•', run: () => editor.chain().focus().toggleBulletList().run() },
				{ label: 'Numbered list', hint: '1.', run: () => editor.chain().focus().toggleOrderedList().run() },
				{ label: 'Quote', hint: '"', run: () => editor.chain().focus().toggleBlockquote().run() },
				{ label: 'Code block', hint: '{ }', run: () => editor.chain().focus().toggleCodeBlock().run() }
			]
		: []

	const isPublished = article.status === 'published'
	const hasPendingEdits = isPublished && article.pending != null
	const pillState: 'saving' | 'saved' | 'unsaved' | 'error' | 'idle' = isSaving
		? 'saving'
		: saveError
			? 'error'
			: isDirty
				? 'unsaved'
				: savedAt
					? 'saved'
					: 'idle'
	const pillLabel = (() => {
		switch (pillState) {
			case 'saving':
				return 'Saving…'
			case 'saved':
				return savedLabel ? `Saved ${savedLabel}` : 'Saved'
			case 'unsaved':
				return 'Unsaved'
			case 'error':
				return 'Offline — typing locally'
			default:
				return 'Ready'
		}
	})()
	const pillDot = (() => {
		switch (pillState) {
			case 'saving':
				return 'bg-secondary animate-pulse'
			case 'saved':
				return 'bg-success'
			case 'unsaved':
				return 'bg-warning'
			case 'error':
				return 'bg-error'
			default:
				return 'bg-tertiary/50'
		}
	})()
	const articleViewHref = article.section
		? `/research/${ARTICLE_SECTION_SLUGS[article.section]}/${article.slug}`
		: '/research'

	return (
		<div
			className={`${styles.root} article-editor-shell relative mx-auto w-full max-w-[760px] animate-fadein px-4 pb-32 sm:px-6`}
		>
			<ArticleEditorHeader
				article={article}
				articleIsScheduled={articleIsScheduled}
				articleViewHref={articleViewHref}
				beginSlugEdit={beginSlugEdit}
				cancelSlugEdit={cancelSlugEdit}
				commitSlugEdit={commitSlugEdit}
				deletePending={deleteArticleMutation.isPending}
				handleDeleteArticle={handleDeleteArticle}
				handleDiscardPending={handleDiscardPending}
				handlePublish={handlePublish}
				handleUnpublish={handleUnpublish}
				hasPendingEdits={hasPendingEdits}
				isDiscarding={isDiscarding}
				isOwner={isOwner}
				isPublished={isPublished}
				isPublishing={isPublishing}
				onOpenHistory={() => setHistoryOpen(true)}
				onOpenMeta={() => metaDialog.show()}
				pillDot={pillDot}
				pillLabel={pillLabel}
				pillState={pillState}
				saveArticle={saveArticle}
				savedLabel={savedLabel}
				savedExactLabel={savedExactLabel}
				setSlugDraft={setSlugDraft}
				slugDraft={slugDraft}
				slugEditing={slugEditing}
				viewMode={viewMode}
				onViewModeChange={handleViewModeChange}
			/>

			{viewMode === 'preview' ? (
				<ArticleEditorPreview
					article={previewArticle ?? article}
					articleViewHref={articleViewHref}
					isDirty={isDirty}
					onEdit={() => handleViewModeChange('write')}
					readMins={readMins}
					wordCount={wordCount}
				/>
			) : (
				<>
					<ArticleTitleFields article={article} updateArticle={updateArticle} />

					<ArticleCoverImageEditor
						article={article}
						coverFileInputRef={coverFileInputRef}
						handleCoverFile={handleCoverFile}
						isUploadingCover={isUploadingCover}
						onOpenCoverDetails={() => coverDetailsDialog.show()}
						openCoverPicker={openCoverPicker}
						publishError={publishErrors.coverImage}
						updateArticle={updateArticle}
					/>

					<ArticleEditorCanvas
						activeEntity={activeEntity}
						applyLink={applyLink}
						blockItems={blockItems}
						changeActiveEntityLink={changeActiveEntityLink}
						editor={editor}
						flags={flags}
						handleLinkRail={handleLinkRail}
						insertCallout={insertCallout}
						insertCitation={insertCitation}
						linkEdit={linkEdit}
						linkInputRef={linkInputRef}
						markButtons={markButtons}
						onOpenChartPicker={() => chartDialog.show()}
						onOpenEmbedPicker={() => {
							setEditingEmbed(null)
							embedDialog.show()
						}}
						openActiveEntityLink={openActiveEntityLink}
						openLinkEditor={openLinkEditor}
						readMins={readMins}
						setLinkEdit={setLinkEdit}
						unsetActiveEntityLink={unsetActiveEntityLink}
						wordCount={wordCount}
					/>
				</>
			)}

			<ArticleMetaDialog
				article={article}
				articleIsScheduled={articleIsScheduled}
				collaboratorAdding={collaboratorAdding}
				collaboratorEmail={collaboratorEmail}
				collaboratorError={collaboratorError}
				collaborators={collaborators}
				collaboratorsLoadError={collaboratorsLoadError}
				collaboratorsLoading={collaboratorsLoading}
				handleAddCollaborator={handleAddCollaborator}
				handlePublish={handlePublish}
				handleRemoveCollaborator={handleRemoveCollaborator}
				handleToggleHidden={handleToggleHidden}
				handleTransferOwnership={handleTransferOwnership}
				hasPendingEdits={hasPendingEdits}
				isCollaborator={isCollaborator}
				isDiscarding={isDiscarding}
				isOwner={isOwner}
				isPublished={isPublished}
				isPublishing={isPublishing}
				isSaving={isSaving}
				publishErrors={publishErrors}
				saveArticle={saveArticle}
				setCollaboratorEmail={setCollaboratorEmail}
				setCollaboratorError={setCollaboratorError}
				store={metaDialog}
				updateArticle={updateArticle}
			/>

			<CoverDetailsDialog
				article={article}
				publishErrors={publishErrors}
				store={coverDetailsDialog}
				updateCoverField={updateCoverField}
			/>

			<DeleteArticleDialog
				confirmDeleteArticle={confirmDeleteArticle}
				isPending={deleteArticleMutation.isPending}
				isPublished={isPublished}
				store={deleteDialog}
				title={article.title}
			/>

			{article.id && historyOpen ? (
				<RevisionHistoryDrawer
					key={article.id}
					onClose={() => setHistoryOpen(false)}
					articleId={article.id}
					authorizedFetch={authorizedFetch}
					onRestored={handleRevisionRestored}
				/>
			) : null}

			{chartDialogOpen ? (
				<ArticleChartPickerDialog
					key={editingChart ? `edit-chart-${editingChart.pos}` : 'new-chart'}
					store={chartDialog}
					initialConfig={editingChart?.config ?? null}
					onInsert={handleChartSubmit}
				/>
			) : null}

			<LlamaAIChartPickerDialog key={article.id} dialogStore={llamaaiChartDialog} editor={editor} />

			{embedDialogOpen ? (
				<EmbedPicker
					key={editingEmbed ? `edit-embed-${editingEmbed.pos}` : 'new-embed'}
					store={embedDialog}
					initialConfig={editingEmbed?.config ?? null}
					onInsert={handleEmbedSubmit}
				/>
			) : null}

			{peoplePanelDialogOpen ? (
				<PeoplePanelDialog
					key={editingPanel ? `edit-people-panel-${editingPanel.pos}` : 'new-people-panel'}
					store={peoplePanelDialog}
					articleId={article.id ?? null}
					initialConfig={editingPanel?.config ?? null}
					onSubmit={handlePeoplePanelSubmit}
				/>
			) : null}
		</div>
	)
}
