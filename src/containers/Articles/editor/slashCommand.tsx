import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { matchSorter } from 'match-sorter'
import { SlashCommandPopover, type SlashCommandListHandle } from './SlashCommandList'

export type SlashCommandItem = {
	id: string
	title: string
	description: string
	icon: string
	group: string
	keywords?: Array<string>
	action: (editor: Editor, range: Range) => void
}

const ALL_ITEMS: Array<SlashCommandItem> = [
	{
		id: 'h2',
		title: 'Heading 2',
		description: 'Major section heading',
		icon: 'H2',
		group: 'Structure',
		keywords: ['heading', 'h2', 'section'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
	},
	{
		id: 'h3',
		title: 'Heading 3',
		description: 'Subsection heading',
		icon: 'H3',
		group: 'Structure',
		keywords: ['heading', 'h3', 'subsection'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
	},
	{
		id: 'h4',
		title: 'Heading 4',
		description: 'Minor heading',
		icon: 'H4',
		group: 'Structure',
		keywords: ['heading', 'h4'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run()
	},
	{
		id: 'h5',
		title: 'Heading 5',
		description: 'Sub-minor heading',
		icon: 'H5',
		group: 'Structure',
		keywords: ['heading', 'h5'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 5 }).run()
	},
	{
		id: 'h6',
		title: 'Heading 6',
		description: 'Smallest heading',
		icon: 'H6',
		group: 'Structure',
		keywords: ['heading', 'h6'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 6 }).run()
	},
	{
		id: 'paragraph',
		title: 'Paragraph',
		description: 'Plain body text',
		icon: '¶',
		group: 'Structure',
		keywords: ['paragraph', 'text', 'body'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setNode('paragraph').run()
	},
	{
		id: 'bullet',
		title: 'Bullet list',
		description: 'Unordered list',
		icon: '•',
		group: 'Lists',
		keywords: ['list', 'bullet', 'ul'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run()
	},
	{
		id: 'ordered',
		title: 'Numbered list',
		description: 'Ordered list',
		icon: '1.',
		group: 'Lists',
		keywords: ['list', 'ordered', 'numbered', 'ol'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run()
	},
	{
		id: 'task',
		title: 'Task list',
		description: 'Checklist with checkboxes',
		icon: '☑',
		group: 'Lists',
		keywords: ['task', 'todo', 'checklist', 'check'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run()
	},
	{
		id: 'quote',
		title: 'Blockquote',
		description: 'Pull quote',
		icon: '“',
		group: 'Blocks',
		keywords: ['quote', 'blockquote'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run()
	},
	{
		id: 'code',
		title: 'Code block',
		description: 'Syntax-highlighted code',
		icon: '</>',
		group: 'Blocks',
		keywords: ['code', 'snippet', 'pre'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
	},
	{
		id: 'divider',
		title: 'Divider',
		description: 'Horizontal rule',
		icon: '—',
		group: 'Blocks',
		keywords: ['divider', 'rule', 'hr', 'horizontal'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run()
	},
	{
		id: 'table',
		title: 'Table',
		description: '3×3 grid with header row',
		icon: '⊞',
		group: 'Blocks',
		keywords: ['table', 'grid', 'matrix', 'rows', 'columns'],
		action: (editor, range) =>
			editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
	},
	{
		id: 'embed',
		title: 'Embed',
		description: 'Tweet, YouTube, Medium, Mirror, Substack, or GitHub',
		icon: '◫',
		group: 'Blocks',
		keywords: [
			'embed',
			'twitter',
			'tweet',
			'youtube',
			'video',
			'medium',
			'mirror',
			'substack',
			'github',
			'gist',
			'article'
		],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run()
			document.dispatchEvent(new CustomEvent('article:open-embed-picker'))
		}
	},
	{
		id: 'llamaai-chart',
		title: 'LlamaAI chart',
		description: 'Insert a chart saved from LlamaAI (frozen data snapshot)',
		icon: '🦙',
		group: 'Blocks',
		keywords: ['llamaai', 'llama', 'ai', 'chart', 'saved', 'snapshot'],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run()
			document.dispatchEvent(new CustomEvent('article:open-llamaai-chart-picker'))
		}
	},
	{
		id: 'image',
		title: 'Image',
		description: 'Upload an image from your device',
		icon: 'IMG',
		group: 'Blocks',
		keywords: ['image', 'photo', 'picture', 'upload', 'screenshot'],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run()
			document.dispatchEvent(new CustomEvent('article:trigger-image-upload'))
		}
	},
	{
		id: 'people',
		title: 'People panel',
		description: 'Image + bio cards (moderators, contributors, panelists)',
		icon: '◐',
		group: 'Custom',
		keywords: ['people', 'bio', 'panel', 'moderator', 'interviewee', 'speaker', 'contributor', 'about', 'team'],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run()
			document.dispatchEvent(new CustomEvent('article:open-people-panel-picker'))
		}
	},
	{
		id: 'qa',
		title: 'Q&A pair',
		description: 'A question and answer block for interviews',
		icon: 'Q&A',
		group: 'Custom',
		keywords: ['qa', 'q&a', 'question', 'answer', 'interview', 'transcript', 'conversation'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).insertQAPair().run()
	},
	{
		id: 'callout-note',
		title: 'Callout · Note',
		description: 'Neutral aside',
		icon: 'ⓘ',
		group: 'Custom',
		keywords: ['callout', 'note', 'aside', 'info'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('note').run()
	},
	{
		id: 'callout-data',
		title: 'Callout · Data',
		description: 'Highlight a metric',
		icon: '◆',
		group: 'Custom',
		keywords: ['callout', 'data', 'metric'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('data').run()
	},
	{
		id: 'callout-warning',
		title: 'Callout · Warning',
		description: 'Risk or caveat',
		icon: '!',
		group: 'Custom',
		keywords: ['callout', 'warning', 'risk', 'caveat'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('warning').run()
	},
	{
		id: 'callout-pullquote',
		title: 'Pullquote',
		description: 'Featured quote with rules above and below',
		icon: '"',
		group: 'Custom',
		keywords: ['callout', 'pullquote', 'pull quote', 'highlight', 'quote'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('pullquote').run()
	},
	{
		id: 'callout-bio',
		title: 'Interview bio',
		description: 'Highlighted bio with blue stroke (no quote marks)',
		icon: '◑',
		group: 'Custom',
		keywords: ['bio', 'interview', 'interviewee', 'about', 'profile', 'callout', 'highlight'],
		action: (editor, range) => editor.chain().focus().deleteRange(range).insertCallout('bio').run()
	},
	{
		id: 'citation',
		title: 'Citation',
		description: 'Numbered source reference',
		icon: '[1]',
		group: 'Custom',
		keywords: ['citation', 'cite', 'reference', 'source', 'footnote'],
		action: (editor, range) => {
			const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
			const existing = (text.match(/\[(\d+)\]/g) ?? []).map((m) => Number(m.slice(1, -1)))
			const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertCitation({ id: String(next), label: String(next) })
				.run()
		}
	}
]

function filterItems(query: string): Array<SlashCommandItem> {
	const q = query.trim()
	if (!q) return ALL_ITEMS
	return matchSorter(ALL_ITEMS, q, {
		keys: ['title', 'description', (item) => item.keywords ?? []],
		threshold: matchSorter.rankings.CONTAINS
	})
}

const SLASH_KEY = new PluginKey('articleSlashCommand')

type FloatingHost = {
	mount: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>, items: Array<SlashCommandItem>) => void
	updateProps: (props: SuggestionProps<SlashCommandItem, SlashCommandItem>, items: Array<SlashCommandItem>) => void
	keyDown: (props: SuggestionKeyDownProps) => boolean
	destroy: () => void
}

function createFloatingHost(): FloatingHost {
	let renderer: ReactRenderer<SlashCommandListHandle> | null = null

	return {
		mount(props, items) {
			renderer = new ReactRenderer(SlashCommandPopover, {
				props: {
					editor: props.editor,
					clientRect: props.clientRect,
					dismiss: () => exitSuggestion(props.editor.view, SLASH_KEY),
					items,
					command: (item: SlashCommandItem) => props.command(item)
				},
				editor: props.editor
			})
			document.body.appendChild(renderer.element)
		},
		updateProps(props, items) {
			renderer?.updateProps({
				clientRect: props.clientRect,
				items,
				command: (item: SlashCommandItem) => props.command(item)
			})
		},
		keyDown({ event }) {
			return renderer?.ref?.onKeyDown(event) ?? false
		},
		destroy() {
			renderer?.element.remove()
			renderer?.destroy()
			renderer = null
		}
	}
}

export const ArticleSlashCommand = Extension.create({
	name: 'articleSlashCommand',

	addProseMirrorPlugins() {
		return [
			Suggestion<SlashCommandItem, SlashCommandItem>({
				editor: this.editor,
				pluginKey: SLASH_KEY,
				char: '/',
				startOfLine: true,
				allowSpaces: false,
				items: ({ query }) => filterItems(query),
				command: ({ editor, range, props }) => {
					props.action(editor, range)
				},
				render: () => {
					let host: FloatingHost | null = null

					return {
						onStart: (props) => {
							host = createFloatingHost()
							host.mount(props, props.items)
						},
						onUpdate: (props) => {
							host?.updateProps(props, props.items)
						},
						onKeyDown: (props) => {
							if (props.event.key === 'Tab') {
								exitSuggestion(props.view, SLASH_KEY)
								return false
							}
							if (props.event.key === 'Escape') {
								host?.destroy()
								host = null
								return true
							}
							return host?.keyDown(props) ?? false
						},
						onExit: () => {
							host?.destroy()
							host = null
						}
					}
				}
			})
		]
	}
})
