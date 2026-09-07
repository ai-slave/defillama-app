import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { isChartConfiguration, isChartData, type ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { DeferredChartRenderer } from '~/containers/LlamaAI/components/charts/DeferredChartRenderer'
import { Icon } from '~/ui/Icon'
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
			className="w-full resize-none border-b border-dashed border-transparent bg-transparent text-[13px] leading-snug text-secondary outline-hidden placeholder:text-tertiary/70 hover:border-medium focus:border-link/60 focus:text-primary"
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
					selected ? 'bg-link' : 'bg-border-medium group-focus-within:bg-tertiary group-hover:bg-tertiary'
				}`}
			/>

			{isEditable ? (
				<div
					contentEditable={false}
					onMouseDown={(e) => e.stopPropagation()}
					className={`pointer-events-none absolute -top-2 right-0 left-4 z-10 flex items-center justify-between gap-2 transition-opacity duration-150 sm:left-6 ${
						selected
							? 'opacity-100'
							: 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100'
					}`}
				>
					<span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xs border border-medium bg-surface px-2 py-1 font-jetbrains text-[10px] tracking-[0.22em] text-tertiary uppercase shadow-xs">
						<Icon name="sparkles" className="size-3 text-link" />
						LlamaAI · {config?.type ?? 'chart'}
					</span>
					<span className="pointer-events-auto flex items-stretch divide-x divide-(--border-medium) overflow-hidden rounded-xs border border-medium bg-surface shadow-xs">
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
								editor.commands.focus()
							}}
							className="flex items-center gap-1.5 px-2.5 py-1 font-jetbrains text-[10px] tracking-[0.2em] text-tertiary uppercase transition-colors hover:bg-(--legacy-link-hover-bg) hover:text-error"
						>
							<Icon name="trash-2" className="size-3" />
							Remove
						</button>
					</span>
				</div>
			) : null}

			<div contentEditable={false} ref={chartHostRef}>
				{config && chartData && attached ? (
					<Suspense fallback={<div className="h-[338px]" />}>
						<DeferredChartRenderer
							charts={[config]}
							chartData={chartData}
							onLocalStyleSave={isEditable ? handleStyleSave : undefined}
						/>
					</Suspense>
				) : config && chartData ? (
					<div className="h-[338px]" />
				) : (
					<div className="flex items-center justify-center rounded-md border border-dashed border-medium py-10 text-sm text-tertiary">
						Invalid LlamaAI chart data — remove this block and re-export it.
					</div>
				)}
				{isEditable ? (
					<CaptionEditor caption={caption} onChange={(next) => updateAttributes({ caption: next })} />
				) : caption ? (
					<p className="text-[13px] leading-snug text-secondary">{caption}</p>
				) : null}
			</div>
		</NodeViewWrapper>
	)
}
