import * as Ariakit from '@ariakit/react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEditor } from '@tiptap/react'
import Router, { useRouter } from 'next/router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { canManageResearchArticle } from '~/containers/Articles/ArticlesAccessGate'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { useStableCallback } from '~/hooks/useStableCallback'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { InlineStatus, PanelStatus } from '~/ui/Status'
import { TabPanel, Tabs } from '~/ui/Tabs'
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
import type {
	ArticleCalloutTone,
	ArticleChartConfig,
	ArticleClient,
	ArticleEmbedConfig,
	LocalArticleDocument
} from '../types'
import { ARTICLE_SECTION_SLUGS } from '../types'
import { type UploadResult, useImageUpload } from '../upload/useImageUpload'
import { ArticleChartPickerDialog } from './ArticleChartPicker'
import { ArticleCoverImageEditor } from './ArticleCoverImageEditor'
import { ARTICLE_BUBBLE_MENU_KEY, ArticleEditorCanvas } from './ArticleEditorCanvas'
import { useActiveEntityLink, useEditorFlags, type BlockItem, type MarkButton } from './ArticleEditorControls'
import { CoverDetailsDialog } from './ArticleEditorDialogs'
import { ARTICLE_EDITOR_VIEWS, ArticleEditorHeader, type ArticleEditorViewMode } from './ArticleEditorHeader'
import { ArticleEditorPreview } from './ArticleEditorPreview'
import type { PublishResult } from './ArticleEditorTypes'
import {
	articleQueryKey,
	articleWriteKey,
	cacheWrittenArticle,
	slugFromTitle,
	formatArticleDate
} from './ArticleEditorUtils'
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

/**
 * One editor per article. Moving between articles on the same route mounts a fresh editor, so a request an old
 * article started (a save, a publish, a restore) can update that article's cache but never this editor's state.
 */
export function ArticleEditorClient({ articleId }: { articleId?: string }) {
	return <ArticleEditorSession key={articleId ?? 'new'} articleId={articleId} />
}

function ArticleEditorSession({ articleId }: { articleId?: string }) {
	const router = useRouter()
	const routeView = Array.isArray(router.query.view) ? router.query.view[0] : router.query.view
	const { authorizedFetch, isAuthenticated, loaders } = useAuthContext()
	const revalidateLanding = useResearchLandingRevalidation()
	const queryClient = useQueryClient()
	const [article, setArticle] = useState<LocalArticleDocument>(() => createEmptyLocalArticle(new Date().toISOString()))
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
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [confirmDiscard, setConfirmDiscard] = useState(false)
	const coverDetailsDialog = Ariakit.useDialogStore()
	const [saveError, setSaveError] = useState(false)
	const [slugEditing, setSlugEditing] = useState(false)
	const [slugDraft, setSlugDraft] = useState('')
	// Once a publish is tried, the local checks mark their fields from the article as it is now, so a fixed field
	// clears as it is edited. The server's own field errors stay until the next publish.
	const [publishTried, setPublishTried] = useState(false)
	const [serverPublishErrors, setServerPublishErrors] = useState<Record<string, string>>({})
	// `/research/mine` links drafts with `?view=preview`; after the first render the reader's toggle wins. The edit
	// page renders this only once `router.query.id` exists, so the query is already readable here.
	const [viewMode, setViewMode] = useState<ArticleEditorViewMode>(() => (routeView === 'preview' ? 'preview' : 'write'))
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const autoCreatingRef = useRef(false)
	const autoRedirectingRef = useRef(false)
	const hydratedArticleIdRef = useRef<string | null>(null)

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
	const getUpload = useStableCallback(() => uploadInlineImage)
	const getArticleId = useStableCallback(() => article.id)

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
		mutationFn: () => createArticle(createEmptyLocalArticle(new Date().toISOString()), authorizedFetch)
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
		mutationKey: articleWriteKey(articleId),
		mutationFn: ({
			targetArticleId,
			articlePayload
		}: {
			targetArticleId?: string
			articlePayload: LocalArticleDocument
		}) =>
			targetArticleId
				? updateRemoteArticle(targetArticleId, articlePayload, authorizedFetch)
				: createArticle(articlePayload, authorizedFetch),
		onSuccess: (saved) => cacheWrittenArticle(queryClient, saved)
	})
	// A write started on an earlier visit to this article decides what it holds. Until it settles the editor
	// waits instead of opening the older copy, which a later save would send back over the write.
	const isArticleWriteRunning = useIsMutating({ mutationKey: articleWriteKey(articleId) }) > 0
	const isLoading =
		loaders.userLoading ||
		ownedArticleQuery.isLoading ||
		// Only an editor that has not opened its article waits; a new draft has no id on either side.
		(isArticleWriteRunning && article.id !== articleId) ||
		(createArticleMutation.isPending && createError === null)
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
		if (!editor || !ownedArticleQuery.data || isArticleWriteRunning) return
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
	}, [editor, isArticleWriteRunning, ownedArticleQuery.data])

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
			// A server error on a field (`coverImage.caption` belongs to `coverImage`) clears once it is edited.
			setServerPublishErrors((errors) => {
				const kept = Object.entries(errors).filter(([field]) => field.split('.')[0] !== key)
				return kept.length === Object.keys(errors).length ? errors : Object.fromEntries(kept)
			})
			markArticleDirty()
		},
		[markArticleDirty]
	)

	const setClient = useCallback((client: ArticleClient | null) => {
		setArticle((current) => ({ ...current, client }))
	}, [])

	const saveArticle = async (opts: { silent?: boolean } = {}) => {
		// A destroyed editor belongs to an article the reader left. Its late work (an upload that finishes, a save
		// that settles behind newer typing) can still arm an autosave after the unmount cleared the timer, and that
		// save must not send the left article's last render back to the server.
		if (!editor || editor.isDestroyed) return false
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
		const normalized = normalizeLocalArticleDocument(
			{ ...article, contentJson: editor.getJSON() },
			null,
			new Date().toISOString()
		)
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
		setTimeout(() => {
			editor.view.dispatch(editor.state.tr.setMeta(ARTICLE_BUBBLE_MENU_KEY, 'updatePosition'))
			linkInputRef.current?.focus()
		}, 0)
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

	// `href` comes sanitized from the link form; an empty one removes the link.
	const applyLink = (href: string, newTab: boolean) => {
		if (!editor) return
		if (href === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run()
			setLinkEdit(null)
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
		mutationKey: articleWriteKey(articleId),
		mutationFn: ({ articleId: targetArticleId, goLiveAt }: { articleId: string; goLiveAt?: string | null }) =>
			publishArticle(targetArticleId, authorizedFetch, goLiveAt !== undefined ? { goLiveAt } : {}),
		onSuccess: (saved) => cacheWrittenArticle(queryClient, saved)
	})
	const unpublishMutation = useMutation({
		mutationKey: articleWriteKey(articleId),
		mutationFn: (targetArticleId: string) => unpublishArticle(targetArticleId, authorizedFetch),
		onSuccess: (saved) => cacheWrittenArticle(queryClient, saved)
	})
	// A server result replaces the document without an update event. The editor is gone when the reader left
	// the article while the request was out, and a destroyed editor cannot take content.
	const replaceEditorContent = (contentJson: LocalArticleDocument['contentJson']) => {
		if (!editor || editor.isDestroyed) return
		editor.commands.setContent(contentJson, { emitUpdate: false })
	}

	const discardPendingMutation = useMutation({
		mutationKey: articleWriteKey(articleId),
		mutationFn: (targetArticleId: string) => {
			// The discard drops every edit, so an autosave still waiting must not send them back afterwards.
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
				debounceRef.current = null
			}
			return discardPendingEdits(targetArticleId, authorizedFetch).catch((error: unknown) => {
				throw new Error("Couldn't discard the pending changes. Try again.", { cause: error })
			})
		},
		// The editor shows the live version again. An editor the reader already left takes nothing: its state is
		// gone and its tiptap instance destroyed.
		onSuccess: (saved) => {
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setArticle(merged)
			replaceEditorContent(merged.contentJson)
			setSavedAt(merged.updatedAt)
			setIsDirty(false)
			return cacheWrittenArticle(queryClient, saved)
		}
	})
	const deleteArticleMutation = useMutation({
		mutationFn: (targetArticleId: string) =>
			deleteArticle(targetArticleId, authorizedFetch).catch((error: unknown) => {
				throw new Error("Couldn't delete this article. Try again.", { cause: error })
			}),
		onSuccess: () => {
			revalidateLanding()
		}
	})
	const isPublishing = publishMutation.isPending || unpublishMutation.isPending
	// The editor renders on the client only. The scheduled badge and controls follow the clock, so an article whose
	// go-live time passes while it is open stops reading as scheduled.
	const nowSec = useNowSeconds()
	const articleIsScheduled = isScheduled(article, nowSec * 1000)
	const collaborators = useArticleCollaborators({
		articleId: article.id,
		authorizedFetch,
		queryClient,
		setArticle
	})

	const flushPendingSave = useCallback(async () => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
			debounceRef.current = null
			return saveRef.current({ silent: true })
		}
		return isDirty ? saveRef.current({ silent: true }) : true
	}, [isDirty])

	// Reports instead of toasting, so the review sheet can show a failure inside itself.
	const handlePublish = async (opts?: { goLiveAt?: string | null }): Promise<PublishResult> => {
		if (!article.id) return { ok: false, error: 'Save the draft before publishing.' }
		// Rendered at once, so the review sheet can focus the first field a failed publish marks.
		flushSync(() => {
			setPublishTried(true)
			setServerPublishErrors({})
		})
		if (validateLocalArticleForPublish(article).length > 0) return { ok: false, error: null }
		// An explicit `goLiveAt` wins; otherwise publishing a scheduled article
		// clears its schedule and publishing a draft leaves the field untouched.
		const goLiveAt = opts && 'goLiveAt' in opts ? opts.goLiveAt : article.goLiveAt != null ? null : undefined
		const publishPayload = { articleId: article.id, ...(goLiveAt !== undefined ? { goLiveAt } : {}) }
		const publishedMessage = article.status === 'published' ? 'Update published' : 'Published'
		let saved: Awaited<ReturnType<typeof publishArticle>>
		try {
			if (!(await flushPendingSave())) return { ok: false, error: 'Save the latest edits before publishing.' }
			saved = await publishMutation.mutateAsync(publishPayload)
		} catch (error) {
			const validationErrors = publishValidationErrors(error)
			if (validationErrors.length === 0) return { ok: false, error: errorMessageOr(error, 'Failed to publish') }
			flushSync(() => setServerPublishErrors(Object.fromEntries(validationErrors.map((e) => [e.field, e.message]))))
			return { ok: false, error: null }
		}
		const merged = applyPendingToLocalArticle(saved, saved.pending)
		setArticle(merged)
		setSavedAt(merged.updatedAt)
		setPublishTried(false)
		revalidateLanding()
		if (isScheduled(merged, Date.now()))
			return { ok: true, message: `Scheduled for ${formatArticleDate(merged.goLiveAt)}` }
		return { ok: true, message: merged.status === 'published' ? publishedMessage : 'Saved' }
	}

	const openMeta = () => {
		metaDialog.show()
	}

	// The header has no surface of its own: results toast, and missing fields open the review sheet that marks them.
	const publishFromHeader = async () => {
		const result = await handlePublish()
		if (result.ok === true) toast.success(result.message)
		else if (result.error === null) openMeta()
		else toast.error(result.error)
	}

	const handleUnpublish = async () => {
		if (!article.id) return
		try {
			// The result replaces the editor's content, so the edits still waiting for an autosave go first.
			if (!(await flushPendingSave())) {
				toast.error('Save the latest edits before moving to drafts.')
				return
			}
			const saved = await unpublishMutation.mutateAsync(article.id)
			const merged = applyPendingToLocalArticle(saved, saved.pending)
			setArticle(merged)
			replaceEditorContent(merged.contentJson)
			setSavedAt(merged.updatedAt)
			revalidateLanding()
			toast.success('Moved to drafts')
		} catch (error) {
			toast.error(errorMessageOr(error, 'Failed to unpublish'))
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
			if (editor && !editor.isDestroyed) editor.commands.setContent(merged.contentJson, { emitUpdate: false })
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
		const normalized = normalizeLocalArticleDocument({ ...article, contentJson }, article, new Date().toISOString())
		if (normalized.ok === false) return { ...article, contentJson }
		return {
			...normalized.value,
			client: article.client,
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

	if (isLoading) {
		return <ResearchLoader />
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
				<InlineStatus
					variant="error"
					action={
						<Button
							type="button"
							size="sm"
							onClick={createDraft}
							pendingLabel={createArticleMutation.isPending ? 'Retrying…' : null}
						>
							Try again
						</Button>
					}
				>
					{createError}
				</InlineStatus>
			</div>
		)
	}

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
	const publishErrors: Record<string, string> = publishTried
		? {
				...serverPublishErrors,
				...Object.fromEntries(validateLocalArticleForPublish(article).map((e) => [e.field, e.message]))
			}
		: {}
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
	const articleViewHref = article.section
		? `/research/${ARTICLE_SECTION_SLUGS[article.section]}/${article.slug}`
		: '/research'

	return (
		<div
			className={`${styles.root} article-editor-shell relative mx-auto w-full max-w-[760px] animate-fadein px-4 pb-32 sm:px-6`}
		>
			<Tabs<ArticleEditorViewMode> value={viewMode} onValueChange={setViewMode} values={ARTICLE_EDITOR_VIEWS}>
				<ArticleEditorHeader
					article={article}
					articleIsScheduled={articleIsScheduled}
					nowSec={nowSec}
					articleViewHref={articleViewHref}
					beginSlugEdit={beginSlugEdit}
					cancelSlugEdit={cancelSlugEdit}
					commitSlugEdit={commitSlugEdit}
					handleDeleteArticle={() => setConfirmDelete(true)}
					handleDiscardPending={() => setConfirmDiscard(true)}
					handlePublish={() => void publishFromHeader()}
					handleUnpublish={handleUnpublish}
					hasPendingEdits={hasPendingEdits}
					isOwner={isOwner}
					isPublished={isPublished}
					isPublishing={isPublishing}
					onOpenHistory={() => setHistoryOpen(true)}
					onOpenMeta={openMeta}
					pillState={pillState}
					saveArticle={saveArticle}
					savedAt={savedAt}
					setSlugDraft={setSlugDraft}
					slugDraft={slugDraft}
					slugEditing={slugEditing}
				/>

				<TabPanel value="preview" unmountOnHide>
					<ArticleEditorPreview
						article={previewArticle ?? article}
						articleViewHref={articleViewHref}
						isDirty={isDirty}
						onEdit={() => setViewMode('write')}
						readMins={readMins}
						wordCount={wordCount}
					/>
				</TabPanel>
				<TabPanel value="write" unmountOnHide>
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
				</TabPanel>
			</Tabs>

			<ArticleMetaDialog
				article={article}
				articleIsScheduled={articleIsScheduled}
				collaborators={collaborators}
				handlePublish={handlePublish}
				hasPendingEdits={hasPendingEdits}
				isCollaborator={isCollaborator}
				isOwner={isOwner}
				isPublished={isPublished}
				isSaving={isSaving}
				publishErrors={publishErrors}
				saveArticle={saveArticle}
				setClient={setClient}
				store={metaDialog}
				updateArticle={updateArticle}
			/>

			<CoverDetailsDialog
				article={article}
				publishErrors={publishErrors}
				store={coverDetailsDialog}
				updateCoverField={updateCoverField}
			/>

			{confirmDelete && article.id ? (
				<ConfirmActionDialog
					title={isPublished ? 'Delete this article?' : 'Delete this draft?'}
					description={
						article.title ? (
							<>
								<span className="font-medium text-primary">{article.title}</span> will be permanently removed. This
								cannot be undone.
							</>
						) : (
							'This will be permanently removed. This cannot be undone.'
						)
					}
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteArticleMutation}
					variables={article.id}
					onClose={() => setConfirmDelete(false)}
					// A reader who already left must not be pulled back to the list.
					onSuccess={() => void Router.replace('/research')}
				/>
			) : null}

			{confirmDiscard && article.id ? (
				<ConfirmActionDialog
					title="Discard pending changes?"
					description="Your pending edits are removed and the editor shows the live version again. Readers see no change."
					confirmLabel="Discard changes"
					cancelLabel="Keep changes"
					pendingLabel="Discarding…"
					mutation={discardPendingMutation}
					variables={article.id}
					onClose={() => setConfirmDiscard(false)}
					successMessage="Pending changes discarded"
				/>
			) : null}

			{article.id && historyOpen ? (
				<RevisionHistoryDrawer
					onClose={() => setHistoryOpen(false)}
					articleId={article.id}
					authorizedFetch={authorizedFetch}
					saveEdits={flushPendingSave}
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

			<LlamaAIChartPickerDialog dialogStore={llamaaiChartDialog} editor={editor} />

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
