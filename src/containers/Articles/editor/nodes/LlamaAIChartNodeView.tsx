import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { isChartConfiguration, isChartData, type ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { DeferredChartRenderer } from '~/containers/LlamaAI/components/charts/DeferredChartRenderer'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { InlineStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { useArticleEditable } from '../useArticleEditable'

function CaptionEditor({ caption, onChange }: { caption: string; onChange: (caption: string) => void }) {
	const [draft, setDraft] = useState(caption)
	const ref = useRef<HTMLTextAreaElement | null>(null)
	// The draft restarts from the node's caption when the document changes it (undo, collaboration).
	const [syncedCaption, setSyncedCaption] = useState(caption)
	if (caption !== syncedCaption) {
		setSyncedCaption(caption)
		setDraft(caption)
	}

	useEffect(() => {
		const el = ref.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${el.scrollHeight}px`
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- the textarea is re-measured after every draft renders.
	}, [draft])

	return (
		<textarea
			ref={ref}
			aria-label="Chart caption"
			value={draft}
			rows={1}
			placeholder="Add a caption, e.g. data source and denomination."
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				const next = draft.trim()
				if (next === caption.trim()) return
				onChange(next)
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault()
					e.currentTarget.blur()
				}
			}}
			onMouseDown={(e) => e.stopPropagation()}
			className="w-full resize-none border-b border-dashed border-transparent bg-transparent body-md text-secondary placeholder:text-tertiary hover:border-medium focus:text-primary"
		/>
	)
}

export function LlamaAIChartNodeView({ node, selected, deleteNode, updateAttributes, editor }: NodeViewProps) {
	const isEditable = useArticleEditable(editor)
	const config = isChartConfiguration(node.attrs.chartConfig) ? node.attrs.chartConfig : null
	const chartData = isChartData(node.attrs.chartData) ? node.attrs.chartData : null
	const caption = typeof node.attrs.caption === 'string' ? node.attrs.caption : ''

	// TipTap mounts node views detached from the document and attaches them a beat
	// later; the ECharts components init via document.getElementById, which returns
	// null while detached and never retries. Defer the chart until we're connected.
	const chartHostRef = useRef<HTMLDivElement | null>(null)
	const [attached, setAttached] = useState(false)
	useEffect(() => {
		if (attached) return
		let raf = 0
		const check = () => {
			if (chartHostRef.current?.isConnected) setAttached(true)
			else raf = requestAnimationFrame(check)
		}
		check()
		return () => cancelAnimationFrame(raf)
	}, [attached])

	const handleStyleSave = (updated: ChartConfiguration) => {
		updateAttributes({ chartConfig: updated })
	}

	return (
		<NodeViewWrapper data-llamaai-chart className="group relative my-6 pl-4 sm:pl-6">
			<span
				aria-hidden
				className={`pointer-events-none absolute top-2 bottom-2 left-0 w-px transition-colors duration-150 ${
					selected
						? 'bg-link'
						: 'bg-border-medium group-hover:bg-border-strong group-has-focus-visible:bg-border-strong'
				}`}
			/>

			{isEditable ? (
				// oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- selects the node inside a contenteditable; TipTap owns keyboard navigation there.
				<div
					contentEditable={false}
					onMouseDown={(e) => e.stopPropagation()}
					className={`pointer-events-none absolute -top-2 right-0 left-4 z-10 flex items-center justify-between gap-2 transition-opacity duration-150 sm:left-6 ${
						selected
							? 'opacity-100'
							: 'opacity-0 group-hover:opacity-100 has-focus-visible:opacity-100 pointer-coarse:opacity-100'
					}`}
				>
					<span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xs border border-medium bg-surface px-2 py-1 label-xs tracking-[0.22em] text-tertiary uppercase shadow-raised">
						<Icon name="sparkles" className="size-3 text-link" />
						LlamaAI · {config?.type ?? 'chart'}
					</span>
					<span className="pointer-events-auto flex gap-1 rounded-md bg-surface shadow-raised">
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
								editor.commands.focus()
							}}
						>
							<Icon name="trash-2" className="size-3.5" />
							<span>Remove</span>
						</Button>
					</span>
				</div>
			) : null}

			<div contentEditable={false} ref={chartHostRef}>
				{config && chartData && attached ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" className="min-h-[338px]" />}>
						<DeferredChartRenderer
							charts={[config]}
							chartData={chartData}
							onLocalStyleSave={isEditable ? handleStyleSave : undefined}
						/>
					</Suspense>
				) : config && chartData ? (
					<div className="h-[338px]" />
				) : (
					<InlineStatus variant="error">Invalid LlamaAI chart data — remove this block and re-export it.</InlineStatus>
				)}
				{isEditable ? (
					<CaptionEditor caption={caption} onChange={(next) => updateAttributes({ caption: next })} />
				) : caption ? (
					<p className="body-md text-secondary">{caption}</p>
				) : null}
			</div>
		</NodeViewWrapper>
	)
}
