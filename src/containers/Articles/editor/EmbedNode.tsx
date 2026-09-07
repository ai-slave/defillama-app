import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { getEmbedProviderLabel } from '../embedProviders'
import type { ArticleEmbedConfig } from '../types'
import { useArticleEditable } from './useArticleEditable'

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		articleEmbed: {
			insertArticleEmbed: (config: ArticleEmbedConfig) => ReturnType
		}
	}
}

function EmbedNodeView({ node, selected, deleteNode, getPos, editor }: NodeViewProps) {
	const isEditable = useArticleEditable(editor)
	const config = node.attrs.config as ArticleEmbedConfig
	const providerLabel = getEmbedProviderLabel(config.provider)
	const handleEdit = () => {
		const pos = typeof getPos === 'function' ? getPos() : null
		if (typeof pos !== 'number') return
		document.dispatchEvent(new CustomEvent('article:edit-embed', { detail: { config, pos } }))
	}
	return (
		<NodeViewWrapper
			data-article-embed
			className={`my-4 overflow-hidden rounded-md border bg-surface ${selected ? 'border-link' : 'border-medium'}`}
		>
			<div className="flex items-start justify-between gap-3 px-4 py-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-xs text-tertiary">
						<span className="shrink-0 rounded-sm border border-medium bg-page px-1.5 py-0.5 font-jetbrains text-[10px] tracking-wider text-secondary uppercase">
							{providerLabel}
						</span>
						<span className="truncate">{config.sourceUrl}</span>
					</div>
					{config.title ? <div className="mt-1 truncate text-sm font-medium text-primary">{config.title}</div> : null}
					{config.caption ? <p className="mt-2 text-sm text-secondary">{config.caption}</p> : null}
				</div>
				{isEditable ? (
					<div
						contentEditable={false}
						className="flex shrink-0 items-center gap-1.5"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							onMouseDown={(e) => {
								e.preventDefault()
								e.stopPropagation()
							}}
							onClick={(e) => {
								e.stopPropagation()
								handleEdit()
							}}
							className="rounded-md border border-medium px-2 py-1 text-xs text-secondary hover:bg-research-tint-hover hover:text-primary"
						>
							Edit
						</button>
						<button
							type="button"
							onMouseDown={(e) => {
								e.preventDefault()
								e.stopPropagation()
							}}
							onClick={(e) => {
								e.stopPropagation()
								deleteNode()
								editor.commands.focus()
							}}
							className="rounded-md border border-medium px-2 py-1 text-xs text-tertiary hover:bg-research-tint-hover hover:text-primary"
						>
							Remove
						</button>
					</div>
				) : null}
			</div>
		</NodeViewWrapper>
	)
}

export const ArticleEmbed = Node.create({
	name: 'articleEmbed',
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
		return [{ tag: 'div[data-article-embed]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-article-embed': 'true',
				'data-config': JSON.stringify(HTMLAttributes.config ?? null)
			})
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(EmbedNodeView)
	},

	addCommands() {
		return {
			insertArticleEmbed:
				(config) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs: { config } })
		}
	}
})
