import { Mark, mergeAttributes, Node } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { validateArticleChartConfig } from '../chartAdapters'
import { getArticleEntityRoute } from '../entityLinks'
import { ArticleChartBlock } from '../renderer/ArticleChartBlock'
import type { ArticleCalloutTone, ArticleChartConfig, ArticleEntityType } from '../types'
import { ArticleEmbed } from './EmbedNode'
import { ArticleEntitySuggestion } from './entitySuggestion'
import { ArticleImage, type ArticleImageOptions } from './nodes/ArticleImage'
import { ArticlePeoplePanel } from './nodes/ArticlePeoplePanel'
import { LlamaAIChart } from './nodes/LlamaAIChart'
import { QABlockNodes } from './nodes/QABlock'
import { ArticleSlashCommand } from './slashCommand'

const lowlight = createLowlight(common)

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		entityLink: {
			setEntityLink: (attrs: {
				entityType: ArticleEntityType
				slug: string
				label?: string
				route?: string
			}) => ReturnType
			unsetEntityLink: () => ReturnType
		}
		defillamaChart: {
			insertDefillamaChart: (config: ArticleChartConfig) => ReturnType
		}
		callout: {
			insertCallout: (tone: ArticleCalloutTone) => ReturnType
		}
		citation: {
			insertCitation: (attrs: { id: string; label?: string; url?: string; title?: string }) => ReturnType
		}
	}
}

const calloutToneStyles: Record<ArticleCalloutTone, { wrap: string; tone: string }> = {
	note: {
		wrap: 'border-medium bg-surface',
		tone: 'text-tertiary'
	},
	data: {
		wrap: 'border-brand-muted bg-brand-tint',
		tone: 'text-link'
	},
	warning: {
		wrap: 'border-warning-muted bg-warning-faint text-primary',
		tone: 'text-warning'
	},
	pullquote: {
		wrap: 'border-y border-x-0 border-brand-muted bg-transparent rounded-none px-2',
		tone: 'text-link'
	},
	bio: {
		wrap: 'border-y-0 border-r-0 border-l-4 rounded-l-none border-link bg-brand-tint',
		tone: 'text-link'
	}
}

const calloutToneLabels: Record<ArticleCalloutTone, string> = {
	note: 'Note',
	data: 'Data',
	warning: 'Warning',
	pullquote: 'Pullquote',
	bio: 'Interview Bio'
}

const calloutToneDefaults: Record<ArticleCalloutTone, string> = {
	note: 'Add context or caveats here.',
	data: 'Add context or caveats here.',
	warning: 'Add context or caveats here.',
	pullquote: 'Add context or caveats here.',
	bio: 'Write a short bio for the interviewee here.'
}

function ChartCaptionEditor({
	config,
	uniqueEntityNames,
	chartLabel,
	onChange
}: {
	config: ArticleChartConfig
	uniqueEntityNames: Array<string>
	chartLabel: string
	onChange: (caption: string) => void
}) {
	const [draft, setDraft] = useState(config.caption ?? '')
	const ref = useRef<HTMLTextAreaElement | null>(null)
	// The draft restarts from the node's caption when the document changes it (undo, collaboration).
	const [syncedCaption, setSyncedCaption] = useState(config.caption)
	if (config.caption !== syncedCaption) {
		setSyncedCaption(config.caption)
		setDraft(config.caption ?? '')
	}

	useEffect(() => {
		const el = ref.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${el.scrollHeight}px`
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- the textarea is re-measured after every draft renders.
	}, [draft])

	const placeholder = `${uniqueEntityNames.join(' vs ') || 'Entity'} ${chartLabel.toLowerCase() || 'chart'}, USD-denominated.`

	return (
		<textarea
			ref={ref}
			value={draft}
			rows={1}
			placeholder={placeholder}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				const next = draft.trim()
				if (next === (config.caption ?? '').trim()) return
				onChange(next)
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault()
					;(e.target as HTMLTextAreaElement).blur()
				}
			}}
			onMouseDown={(e) => e.stopPropagation()}
			className="w-full resize-none border-b border-dashed border-transparent bg-transparent body-md text-secondary placeholder:text-tertiary hover:border-medium focus:text-primary"
		/>
	)
}

function ChartNodeView({ node, selected, deleteNode, getPos, updateAttributes, editor }: NodeViewProps) {
	const rawConfig = node.attrs.config as ArticleChartConfig
	const config = validateArticleChartConfig(rawConfig) ?? rawConfig

	const handleEdit = () => {
		const pos = typeof getPos === 'function' ? getPos() : null
		if (typeof pos !== 'number') return
		document.dispatchEvent(new CustomEvent('article:edit-chart', { detail: { config, pos } }))
	}

	const handleCaptionChange = (caption: string) => {
		updateAttributes({ config: { ...config, caption: caption || undefined } })
	}

	const seriesCount = config.series?.length ?? 0
	const chartTypeSet = new Set(config.series?.map((s) => s.chartType) ?? [])
	const uniqueEntityNames = useMemo(() => {
		const seen = new Set<string>()
		const out: Array<string> = []
		for (const s of config.series ?? []) {
			const key = `${s.entityType}:${s.slug}`
			if (seen.has(key)) continue
			seen.add(key)
			out.push(s.name)
		}
		return out
	}, [config.series])
	const chartLabel = [...chartTypeSet].join(' / ')
	const tagLabel =
		seriesCount === 0
			? 'Empty chart'
			: seriesCount === 1
				? `${config.series[0].entityType} · ${chartLabel}`
				: `${seriesCount} series · ${chartLabel}`

	return (
		<NodeViewWrapper data-article-chart className="group relative my-6 pl-4 sm:pl-6">
			<span
				aria-hidden
				className={`pointer-events-none absolute top-2 bottom-2 left-0 w-px transition-colors duration-150 ${
					selected ? 'bg-link' : 'bg-border-medium group-focus-within:bg-border-strong group-hover:bg-border-strong'
				}`}
			/>

			{/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- selects the node inside a contenteditable; TipTap owns keyboard navigation there. */}
			<div
				contentEditable={false}
				onMouseDown={(e) => e.stopPropagation()}
				className={`pointer-events-none absolute -top-2 right-0 left-4 z-10 flex items-center justify-between gap-2 transition-opacity duration-150 sm:left-6 ${
					selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
				}`}
			>
				<span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xs border border-medium bg-surface px-2 py-1 label-xs tracking-[0.22em] text-tertiary uppercase shadow-raised">
					<Icon name="bar-chart-2" className="size-3 text-link" />
					{tagLabel}
				</span>
				<span className="pointer-events-auto flex gap-1 rounded-md bg-surface shadow-raised">
					<Button
						type="button"
						variant="secondary"
						size="sm"
						aria-label="Edit chart"
						// Keeps the editor's selection on the node while the button is pressed.
						onMouseDown={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.stopPropagation()
							handleEdit()
						}}
					>
						<Icon name="pencil" className="size-3.5" />
						<span>Edit</span>
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						aria-label="Remove chart"
						// Keeps the editor's selection on the node while the button is pressed.
						onMouseDown={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.stopPropagation()
							deleteNode()
							// The button leaves with the node; the editor takes focus back at the deletion point.
							editor.commands.focus()
						}}
					>
						<Icon name="trash-2" className="size-3.5" />
						<span>Remove</span>
					</Button>
				</span>
			</div>

			<div
				contentEditable={false}
				onClickCapture={(e) => {
					const target = e.target as HTMLElement | null
					if (target && target.closest('a')) {
						e.preventDefault()
						e.stopPropagation()
					}
				}}
				className="relative"
			>
				<ArticleChartBlock
					config={config}
					captionSlot={
						<ChartCaptionEditor
							config={config}
							uniqueEntityNames={uniqueEntityNames}
							chartLabel={chartLabel}
							onChange={handleCaptionChange}
						/>
					}
				/>
			</div>
		</NodeViewWrapper>
	)
}

const CALLOUT_TONE_OPTIONS = (['note', 'data', 'warning', 'pullquote', 'bio'] as Array<ArticleCalloutTone>).map(
	(value) => ({ value, label: calloutToneLabels[value] })
)

function CalloutNodeView({ node, updateAttributes }: NodeViewProps) {
	const tone = (node.attrs.tone as ArticleCalloutTone) || 'note'
	const styles = calloutToneStyles[tone] ?? calloutToneStyles.note
	return (
		<NodeViewWrapper className={`my-4 rounded-md border p-4 ${styles.wrap}`}>
			<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
				<span className={`label-sm ${styles.tone}`}>{calloutToneLabels[tone]}</span>
				<SegmentedControl
					label="Callout tone"
					variant="chips"
					size="sm"
					options={CALLOUT_TONE_OPTIONS}
					value={tone}
					onValueChange={(value) => updateAttributes({ tone: value })}
					contentEditable={false}
				/>
			</div>
			<NodeViewContent className="article-callout-content min-h-6" />
		</NodeViewWrapper>
	)
}

function CitationNodeView({ node, selected, deleteNode, updateAttributes, editor }: NodeViewProps) {
	const fieldId = useId()
	const label = node.attrs.label || node.attrs.id
	const url = (node.attrs.url as string) || ''
	const title = (node.attrs.title as string) || ''
	const [open, setOpen] = useState(false)
	const popRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!open) return
		const handler = (event: MouseEvent) => {
			const target = event.target as unknown as globalThis.Node | null
			if (popRef.current && target && !popRef.current.contains(target)) setOpen(false)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open])

	const editable = editor?.isEditable !== false
	return (
		<NodeViewWrapper
			as="span"
			className={`relative mx-0.5 inline-flex items-center gap-1 rounded-[3px] border bg-brand-muted align-baseline mono-sm text-link ${
				selected ? 'border-brand' : 'border-medium'
			}`}
		>
			<button
				type="button"
				aria-expanded={open && editable}
				onClick={() => editable && setOpen((o) => !o)}
				className="px-1 py-0.5 tracking-wider"
			>
				[{label}]
			</button>
			{selected && editable ? (
				<button
					type="button"
					className="border-l border-medium px-1 py-0.5 text-tertiary hover:text-primary"
					onClick={() => {
						deleteNode()
						// The button leaves with the citation; the editor takes focus back at the deletion point.
						editor.commands.focus()
					}}
					aria-label="Remove citation"
				>
					×
				</button>
			) : null}
			{open && editable ? (
				<div
					ref={popRef}
					contentEditable={false}
					className="absolute top-full left-0 z-50 mt-1 grid w-72 gap-1.5 rounded-md border border-medium bg-overlay p-2.5 font-sans shadow-overlay"
				>
					<div className="flex items-center gap-1.5">
						<label
							htmlFor={`${fieldId}-label`}
							className="w-12 shrink-0 label-xs tracking-wider text-tertiary uppercase"
						>
							Label
						</label>
						<Input
							id={`${fieldId}-label`}
							value={(node.attrs.label as string) || ''}
							onChange={(e) => updateAttributes({ label: e.target.value, id: e.target.value || node.attrs.id })}
							variant="code"
							className="min-w-0 flex-1"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<label htmlFor={`${fieldId}-url`} className="w-12 shrink-0 label-xs tracking-wider text-tertiary uppercase">
							URL
						</label>
						<Input
							id={`${fieldId}-url`}
							value={url}
							onChange={(e) => updateAttributes({ url: e.target.value })}
							placeholder="https://…"
							variant="code"
							className="min-w-0 flex-1"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<label
							htmlFor={`${fieldId}-title`}
							className="w-12 shrink-0 label-xs tracking-wider text-tertiary uppercase"
						>
							Title
						</label>
						<Input
							id={`${fieldId}-title`}
							value={title}
							onChange={(e) => updateAttributes({ title: e.target.value })}
							placeholder="Source title"
							className="min-w-0 flex-1"
						/>
					</div>
				</div>
			) : null}
		</NodeViewWrapper>
	)
}

export const EntityLink = Mark.create({
	name: 'entityLink',
	priority: 1000,
	keepOnSplit: false,
	excludes: 'link',
	inclusive: false,

	addAttributes() {
		return {
			entityType: { default: null },
			slug: { default: null },
			label: { default: null, rendered: false },
			route: { default: null, rendered: false },
			snapshot: { default: null, rendered: false }
		}
	},

	parseHTML() {
		return [{ tag: 'a[data-article-entity-link]' }]
	},

	renderHTML({ HTMLAttributes }) {
		const { entityType, slug, route, label, snapshot, ...rest } = HTMLAttributes as Record<string, unknown>
		void label
		void snapshot
		const href =
			(route as string) ||
			(entityType && slug ? getArticleEntityRoute(entityType as ArticleEntityType, slug as string) : undefined)
		return [
			'a',
			mergeAttributes(rest, {
				href,
				target: '_blank',
				rel: 'noopener noreferrer',
				'data-article-entity-link': 'true',
				'data-entity-type': entityType,
				'data-entity-slug': slug
			}),
			0
		]
	},

	addCommands() {
		return {
			setEntityLink:
				(attrs) =>
				({ commands }) => {
					const route = attrs.route || getArticleEntityRoute(attrs.entityType, attrs.slug)
					return commands.setMark(this.name, { ...attrs, route })
				},
			unsetEntityLink:
				() =>
				({ commands }) =>
					commands.unsetMark(this.name)
		}
	}
})

export const DefillamaChart = Node.create({
	name: 'defillamaChart',
	group: 'block',
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			config: { default: null }
		}
	},

	parseHTML() {
		return [{ tag: 'div[data-defillama-chart]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-defillama-chart': 'true',
				'data-config': JSON.stringify(HTMLAttributes.config ?? null)
			})
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(ChartNodeView)
	},

	addCommands() {
		return {
			insertDefillamaChart:
				(config) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs: { config } })
		}
	}
})

export const Callout = Node.create({
	name: 'callout',
	group: 'block',
	content: 'block+',
	defining: true,

	addAttributes() {
		return {
			tone: { default: 'note' }
		}
	},

	parseHTML() {
		return [{ tag: 'aside[data-article-callout]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return ['aside', mergeAttributes(HTMLAttributes, { 'data-article-callout': 'true' }), 0]
	},

	addNodeView() {
		return ReactNodeViewRenderer(CalloutNodeView)
	},

	addCommands() {
		return {
			insertCallout:
				(tone) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: { tone },
						content: [{ type: 'paragraph', content: [{ type: 'text', text: calloutToneDefaults[tone] }] }]
					})
		}
	}
})

export const Citation = Node.create({
	name: 'citation',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,

	addAttributes() {
		return {
			id: { default: null },
			label: { default: null },
			url: { default: null },
			title: { default: null }
		}
	},

	parseHTML() {
		return [{ tag: 'span[data-article-citation]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return ['span', mergeAttributes(HTMLAttributes, { 'data-article-citation': 'true' })]
	},

	addNodeView() {
		return ReactNodeViewRenderer(CitationNodeView)
	},

	addCommands() {
		return {
			insertCitation:
				(attrs) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs: { label: attrs.label || attrs.id, ...attrs } })
		}
	}
})

export function createArticleEditorExtensions(imageOptions?: Partial<ArticleImageOptions>) {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3, 4, 5, 6] },
			link: false,
			codeBlock: false
		}),
		Link.extend({
			addAttributes() {
				const parent = this.parent?.() ?? {}
				return {
					...parent,
					target: {
						default: '_blank',
						parseHTML: (el) => {
							const value = el.getAttribute('target')
							return value === '_self' ? '_self' : '_blank'
						},
						renderHTML: (attrs) => {
							const target = attrs.target === '_self' ? '_self' : '_blank'
							if (target === '_self') return {}
							return { target: '_blank', rel: 'noreferrer noopener' }
						}
					}
				}
			}
		}).configure({
			openOnClick: false,
			autolink: true,
			defaultProtocol: 'https'
		}),
		Highlight.configure({ multicolor: false }),
		TaskList,
		TaskItem.configure({ nested: true }),
		Table.configure({ resizable: true, cellMinWidth: 80, HTMLAttributes: { 'data-article-table': 'true' } }),
		TableRow,
		TableHeader,
		TableCell,
		CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
		Placeholder.configure({
			placeholder: ({ node }) => {
				if (node.type.name === 'heading') return 'Section heading'
				if (node.type.name === 'qaQuestion') return 'Ask the next question…'
				return "Write research, cite sources, link data, or insert a chart. Press '/' for commands."
			}
		}),
		EntityLink,
		ArticleEntitySuggestion,
		ArticleSlashCommand,
		DefillamaChart,
		LlamaAIChart,
		ArticleEmbed,
		ArticleImage.configure({
			getUpload: imageOptions?.getUpload ?? null,
			getArticleId: imageOptions?.getArticleId ?? null,
			onMissingArticleId: imageOptions?.onMissingArticleId ?? null
		}),
		ArticlePeoplePanel,
		Callout,
		Citation,
		...QABlockNodes
	]
}
