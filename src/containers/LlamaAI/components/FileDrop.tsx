import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react'

interface FileDropTarget {
	label: string
	onDrop: (files: Array<File>) => void
}

interface FileDropContextValue {
	register: (target: FileDropTarget) => () => void
	// Label of the registered target while a file drag is in progress, null otherwise.
	activeLabel: string | null
}

export const FileDropContext = createContext<FileDropContextValue | null>(null)

// Registers the one surface that receives files dropped anywhere in the window while it is enabled.
export function useFileDropTarget(label: string, onDrop: (files: Array<File>) => void, enabled: boolean) {
	const register = useContext(FileDropContext)?.register
	const drop = useEffectEvent(onDrop)
	useEffect(() => {
		if (!register || !enabled) return
		return register({ label, onDrop: (files) => drop(files) })
	}, [register, label, enabled])
}

// Rendered inside the positioned chat panel; names the destination while a file drag is in progress.
export function FileDropOverlay() {
	const label = useContext(FileDropContext)?.activeLabel ?? null
	if (label === null) return null
	return (
		<div
			role="status"
			className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand bg-brand-tint text-primary backdrop-blur-[2px]"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="none">
				<path
					d="M6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				<path
					d="M18 6L18 21M18 21L22.5 16.5M18 21L13.5 16.5"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span className="body-md">{label}</span>
		</div>
	)
}

function hasFiles(event: DragEvent) {
	return event.dataTransfer?.types.includes('Files') ?? false
}

export function FileDropProvider({ children }: { children: ReactNode }) {
	// A stack, not a single slot: a hidden tab panel and the visible composer are both mounted, so
	// unregistering the top target has to uncover the one under it.
	const targets = useRef<Array<FileDropTarget>>([])
	const depth = useRef(0)
	const [activeLabel, setActiveLabel] = useState<string | null>(null)
	const register = useCallback((next: FileDropTarget) => {
		targets.current.push(next)
		return () => {
			targets.current = targets.current.filter((entry) => entry !== next)
		}
	}, [])

	useEffect(() => {
		const target = () => targets.current.at(-1) ?? null
		const reset = () => {
			depth.current = 0
			setActiveLabel(null)
		}
		const onDragEnter = (event: DragEvent) => {
			if (!hasFiles(event)) return
			event.preventDefault()
			depth.current += 1
			setActiveLabel(target()?.label ?? null)
		}
		const onDragOver = (event: DragEvent) => {
			if (!hasFiles(event)) return
			// Claiming dragover everywhere stops the browser from opening a file dropped outside the composer.
			event.preventDefault()
			event.dataTransfer!.dropEffect = target() ? 'copy' : 'none'
			setActiveLabel(target()?.label ?? null)
		}
		const onDragLeave = (event: DragEvent) => {
			if (!hasFiles(event)) return
			depth.current -= 1
			if (depth.current <= 0) reset()
		}
		const onDrop = (event: DragEvent) => {
			if (!hasFiles(event)) return
			event.preventDefault()
			reset()
			const files = Array.from(event.dataTransfer!.files)
			if (files.length > 0) target()?.onDrop(files)
		}
		document.addEventListener('dragenter', onDragEnter)
		document.addEventListener('dragover', onDragOver)
		document.addEventListener('dragleave', onDragLeave)
		document.addEventListener('drop', onDrop)
		window.addEventListener('dragend', reset)
		window.addEventListener('blur', reset)
		return () => {
			document.removeEventListener('dragenter', onDragEnter)
			document.removeEventListener('dragover', onDragOver)
			document.removeEventListener('dragleave', onDragLeave)
			document.removeEventListener('drop', onDrop)
			window.removeEventListener('dragend', reset)
			window.removeEventListener('blur', reset)
		}
	}, [])

	const value = useMemo(() => ({ register, activeLabel }), [register, activeLabel])
	return <FileDropContext.Provider value={value}>{children}</FileDropContext.Provider>
}
