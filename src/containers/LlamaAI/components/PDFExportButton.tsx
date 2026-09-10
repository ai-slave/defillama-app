import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useState } from 'react'
import toast from 'react-hot-toast'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { menuSurfaceStyles, popoverMenuItemStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { AI_SERVER } from '~/constants'

function formatPdfError(error: unknown): string {
	if (!error) return 'Failed to generate PDF'
	if (typeof error === 'string') return error
	if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
		return (error as any).message
	}
	try {
		return JSON.stringify(error)
	} catch {
		return 'Failed to generate PDF'
	}
}

interface PDFExportButtonProps {
	sessionId: string | null
	messageId?: string | null
	exportType: 'single_message' | 'full_conversation'
	className?: string
}

export function PDFExportButton({ sessionId, messageId, exportType, className }: PDFExportButtonProps) {
	const [isLoading, setIsLoading] = useState(false)
	const { loaders, authorizedFetch, hasActiveSubscription } = useAuthContext()
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })
	const loading = loaders.userLoading || isLoading
	const menu = Ariakit.useMenuStore()

	const handlePDFExport = async (isDark: boolean) => {
		if (loading) return
		if (!sessionId) return

		// A conditional and two coalesces, none of which the compiler can lower inside the try below.
		const trackingContext = {
			theme: isDark ? ('dark' as const) : ('light' as const),
			sessionId: sessionId ?? '',
			messageId: messageId ?? ''
		}

		if (hasActiveSubscription) {
			try {
				setIsLoading(true)

				// Kept nested: a `&&` inside this try/catch is a value block the React Compiler cannot
				// lower, and merging these two stopped the component compiling.
				if (exportType === 'single_message') {
					// oxlint-disable-next-line unicorn/no-lonely-if -- see above
					if (!messageId) {
						toast.error('Unable to export this message. Please try again from a specific message.', {
							id: 'pdf-export'
						})
						setIsLoading(false)
						return
					}
				}

				toast.loading('Generating PDF...', { id: 'pdf-export' })

				const requestBody: any = {
					sessionId,
					exportType,
					options: {
						includeTimestamps: true,
						includeCitations: true,
						paperSize: 'A4',
						isDark
					}
				}

				if (exportType === 'single_message') {
					requestBody.messageId = messageId
				}

				const response = await authorizedFetch(`${AI_SERVER}/export/pdf`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(requestBody)
				})

				if (!response) {
					toast.error('Not authenticated', { id: 'pdf-export' })
					setIsLoading(false)
					return
				}

				const data = await response.json()

				let hasError = false
				if (!response.ok) {
					hasError = true
				}
				if (!data.success) {
					hasError = true
				}

				if (hasError) {
					const pdfErrorMsg = formatPdfError(data.error)
					console.error('PDF export error:', pdfErrorMsg)
					toast.error(pdfErrorMsg, { id: 'pdf-export' })
					setIsLoading(false)
					return
				}

				const pdfResponse = await fetch(data.pdfUrl)
				if (!pdfResponse.ok) {
					toast.error(`Failed to download PDF (${pdfResponse.status})`, { id: 'pdf-export' })
					setIsLoading(false)
					return
				}

				const blob = await pdfResponse.blob()
				const url = window.URL.createObjectURL(blob)
				const a = document.createElement('a')
				const pdfFilename = `llama-ai-export-${Date.now()}.pdf`
				a.href = url
				a.download = pdfFilename
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
				window.URL.revokeObjectURL(url)
				trackUmamiEvent('llamaai-download', {
					kind: 'pdf',
					filename: pdfFilename,
					exportType,
					...trackingContext
				})
				toast.success('PDF downloaded!', { id: 'pdf-export' })
				setIsLoading(false)
			} catch (error) {
				const errorMsg = formatPdfError(error)
				console.error('PDF export error:', error)
				toast.error(errorMsg, { id: 'pdf-export' })
				setIsLoading(false)
			}
		} else {
			setSignupSource('llamaai-pdf')
			subscribeModalStore.show()
		}
	}

	if (!sessionId) return null

	return (
		<>
			<Ariakit.MenuProvider store={menu}>
				<Tooltip
					content="Download PDF"
					render={
						<Ariakit.MenuButton
							store={menu}
							aria-label={isLoading ? 'Exporting PDF' : 'Export PDF options'}
							disabled={loading}
						/>
					}
					className={className ?? buttonStyles({ size: 'md', square: true })}
				>
					{isLoading ? <LoadingSpinner size={16} /> : <Icon name="download-paper" height={16} width={16} />}
				</Tooltip>
				<Ariakit.Menu portal unmountOnHide gutter={8} className={`${menuSurfaceStyles} z-50 min-w-[160px]`}>
					<Ariakit.MenuItem
						data-umami-event="export-pdf"
						data-umami-event-theme="light"
						onClick={() => {
							void handlePDFExport(false)
						}}
						disabled={loading}
						className={`${popoverMenuItemStyles} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
					>
						<Icon name="sun" height={14} width={14} className="shrink-0" />
						Light Mode
					</Ariakit.MenuItem>
					<Ariakit.MenuItem
						data-umami-event="export-pdf"
						data-umami-event-theme="dark"
						onClick={() => {
							void handlePDFExport(true)
						}}
						disabled={loading}
						className={`${popoverMenuItemStyles} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
					>
						<Icon name="moon" height={14} width={14} className="shrink-0" />
						Dark Mode
					</Ariakit.MenuItem>
				</Ariakit.Menu>
			</Ariakit.MenuProvider>
			{shouldRenderModal ? (
				<Suspense fallback={null}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</>
	)
}
