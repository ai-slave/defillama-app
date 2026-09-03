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
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
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
		wrap: 'border-link/40 bg-research-tint',
		tone: 'text-link'
	},
	warning: {
		wrap: 'border-callout-border bg-callout-bg text-callout-text dark:text-research-gold',
		tone: 'text-callout-accent dark:text-research-gold'
	},
	pullquote: {
		wrap: 'border-y border-x-0 border-link/30 bg-transparent rounded-none px-2',
		tone: 'text-link'
	},
	bio: {
		wrap: 'border-y-0 border-r-0 border-l-4 rounded-l-none border-link bg-research-tint',
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
	uniqueEntityNames: string[]
	chartLabel: string
	onChange: (caption: string) => void
}) {
	const [draft, setDraft] = useState(config.caption ?? '')
	const ref = useRef<HTMLTextAreaElement | null>(null)

	useEffect(() => {
		setDraft(config.caption ?? '')
	}, [config.caption])

	useEffect(() => {
		const el = ref.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${el.scrollHeight}px`
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
			className="w-full resize-none border-b border-dashed border-transparent bg-transparent text-[13px] leading-snug text-secondary outline-hidden placeholder:text-tertiary/70 hover:border-medium focus:border-link/60 focus:text-primary"
		/>
	)
}

function ChartNodeView({ node, selected, deleteNode, getPos, updateAttributes }: NodeViewProps) {
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
		const out: string[] = []
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
					selected ? 'bg-link' : 'bg-border-medium group-focus-within:bg-tertiary group-hover:bg-tertiary'
				}`}
			/>

			<div
				contentEditable={false}
				onMouseDown={(e) => e.stopPropagation()}
				className={`pointer-events-none absolute -top-2 right-0 left-4 z-10 flex items-center justify-between gap-2 transition-opacity duration-150 sm:left-6 ${
					selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
				}`}
			>
				<span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xs border border-medium bg-surface px-2 py-1 font-jetbrains text-[10px] tracking-[0.22em] text-tertiary uppercase shadow-xs">
					<Icon name="bar-chart-2" className="size-3 text-link" />
					{tagLabel}
				</span>
				<span className="pointer-events-auto flex items-stretch divide-x divide-(--border-medium) overflow-hidden rounded-xs border border-medium bg-surface shadow-xs">
					<button
						type="button"
						title="Edit chart"
						aria-label="Edit chart"
						onMouseDown={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.stopPropagation()
							handleEdit()
						}}
						className="flex items-center gap-1.5 px-2.5 py-1 font-jetbrains text-[10px] tracking-[0.2em] text-secondary uppercase transition-colors hover:bg-research-tint-hover hover:text-link"
					>
						<Icon name="pencil" className="size-3" />
						Edit
					</button>
					<button
						type="button"
						title="Remove chart"
						aria-label="Remove chart"
						onMouseDown={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.stopPropagation()
							deleteNode()
						}}
						className="flex items-center gap-1.5 px-2.5 py-1 font-jetbrains text-[10px] tracking-[0.2em] text-tertiary uppercase transition-colors hover:bg-research-tint-hover hover:text-error"
					>
						<Icon name="trash-2" className="size-3" />
						Remove
					</button>
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

function CalloutNodeView({ node, updateAttributes }: NodeViewProps) {
	const tone = (node.attrs.tone as ArticleCalloutTone) || 'note'
	const styles = calloutToneStyles[tone] ?? calloutToneStyles.note
	return (
		<NodeViewWrapper className={`my-4 rounded-md border p-4 ${styles.wrap}`}>
			<div className="mb-2 flex items-center justify-between gap-2">
				<span className={`text-xs font-medium ${styles.tone}`}>{calloutToneLabels[tone]}</span>
				<div className="flex rounded-sm border border-medium p-0.5">
					{(['note', 'data', 'warning', 'pullquote', 'bio'] as ArticleCalloutTone[]).map((value) => {
						const active = value === tone
						return (
							<button
								key={value}
								type="button"
								onClick={() => updateAttributes({ tone: value })}
								className={`rounded-sm px-2 py-0.5 text-xs transition-colors ${
									active ? 'bg-research-tint text-link' : 'text-tertiary hover:text-primary'
								}`}
							>
								{calloutToneLabels[value]}
							</button>
						)
					})}
				</div>
			</div>
			<NodeViewContent className="article-callout-content min-h-6" />
		</NodeViewWrapper>
	)
}

function CitationNodeView({ node, selected, deleteNode, updateAttributes, editor }: NodeViewProps) {
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
			className={`relative mx-0.5 inline-flex items-center gap-1 rounded-[3px] border align-baseline font-jetbrains text-[10px] leading-none ${
				selected ? 'border-link bg-research-tint' : 'border-medium bg-research-tint/60 text-link'
			}`}
		>
			<button type="button" onClick={() => editable && setOpen((o) => !o)} className="px-1 py-0.5 tracking-wider">
				[{label}]
			</button>
			{selected && editable ? (
				<button
					type="button"
					className="border-l border-medium px-1 py-0.5 text-tertiary hover:text-primary"
					onClick={deleteNode}
					aria-label="Remove citation"
				>
					×
				</button>
			) : null}
			{open && editable ? (
				<div
					ref={popRef}
					contentEditable={false}
					className="absolute top-full left-0 z-50 mt-1 grid w-72 gap-1.5 rounded-md border border-medium bg-surface p-2.5 font-sans shadow-xl"
				>
					<div className="flex items-center gap-1.5">
						<label className="w-12 shrink-0 text-[10px] tracking-wider text-tertiary uppercase">Label</label>
						<input
							value={(node.attrs.label as string) || ''}
							onChange={(e) => updateAttributes({ label: e.target.value, id: e.target.value || node.attrs.id })}
							className="flex-1 rounded-sm border border-medium bg-page px-1.5 py-1 text-xs text-primary focus:border-link focus:outline-hidden"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<label className="w-12 shrink-0 text-[10px] tracking-wider text-tertiary uppercase">URL</label>
						<input
							value={url}
							onChange={(e) => updateAttributes({ url: e.target.value })}
							placeholder="https://…"
							className="flex-1 rounded-sm border border-medium bg-page px-1.5 py-1 text-xs text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
					</div>
					<div className="flex items-center gap-1.5">
						<label className="w-12 shrink-0 text-[10px] tracking-wider text-tertiary uppercase">Title</label>
						<input
							value={title}
							onChange={(e) => updateAttributes({ title: e.target.value })}
							placeholder="Source title"
							className="flex-1 rounded-sm border border-medium bg-page px-1.5 py-1 text-xs text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
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
			uploadRef: imageOptions?.uploadRef ?? null,
			articleIdRef: imageOptions?.articleIdRef ?? null,
			onMissingArticleId: imageOptions?.onMissingArticleId ?? null
		}),
		ArticlePeoplePanel,
		Callout,
		Citation,
		...QABlockNodes
	]
}
