import { createPortal } from 'react-dom'
import { useIsClient } from '~/hooks/useIsClient'
import { type DialogSize, dialogSurfaceStyles, dialogWidthStyles } from '~/ui/Dialog'
import { tw } from '~/ui/tw'
import { SkeletonShimmer } from '../components/ProCardSkeleton'

const SHEET_SURFACE = tw`fixed top-0 right-0 bottom-0 z-50 flex h-full w-full max-w-6xl animate-pro-fade-in flex-col gap-3 overflow-hidden border-l border-pro-cards-border bg-pro-cards-bg p-3 shadow-dialog pro-dashboard md:p-4`

const BACKDROP = tw`fixed inset-0 z-50 animate-pro-fade-in bg-screen-dim`

const BLOCK = tw`rounded-sm bg-pro-text-tertiary/15`

const BODY_ROWS = ['w-full', 'w-5/6', 'w-2/3']

type ProDialogFallbackProps = {
	width?: DialogSize
	sheet?: boolean
}

function BodyRows() {
	return (
		<>
			{BODY_ROWS.map((row) => (
				<div key={row} className={`h-4 ${BLOCK} ${row}`} />
			))}
			<SkeletonShimmer />
		</>
	)
}

export function ProDialogFallback({ width = 'sm', sheet = false }: ProDialogFallbackProps) {
	const isClient = useIsClient()
	if (!isClient) return null

	const surface = sheet ? (
		<div aria-busy="true" data-enter className={SHEET_SURFACE} data-testid="pro-dialog-fallback">
			<div className="relative flex min-h-8 items-center justify-between overflow-hidden">
				<div className={`h-7 w-48 max-w-full ${BLOCK}`} />
				<div className={`size-8 ${BLOCK}`} />
				<SkeletonShimmer />
			</div>
			<div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
				<BodyRows />
			</div>
			<span role="status" className="sr-only">
				Loading dialog
			</span>
		</div>
	) : (
		<div
			aria-busy="true"
			data-enter
			className={`${dialogSurfaceStyles} ${dialogWidthStyles[width]} animate-pro-fade-in pro-dashboard`}
			data-testid="pro-dialog-fallback"
		>
			{/* The shape of the dialog that loads: DialogHeader's row with its ×, then a p-4 body. */}
			<div className="relative flex items-center justify-between gap-3 overflow-hidden border-b border-subtle px-4 py-3">
				<div className={`h-5 w-44 max-w-full ${BLOCK}`} />
				<div className={`size-8 ${BLOCK}`} />
				<SkeletonShimmer />
			</div>
			<div className="relative flex flex-1 flex-col gap-3 overflow-hidden p-4">
				<BodyRows />
			</div>
			<span role="status" className="sr-only">
				Loading dialog
			</span>
		</div>
	)

	return createPortal(
		sheet ? (
			surface
		) : (
			<>
				<div aria-hidden="true" className={BACKDROP} />
				{surface}
			</>
		),
		document.body
	)
}
