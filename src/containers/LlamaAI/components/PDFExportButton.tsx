import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { AI_SERVER } from '~/constants'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const TOAST_ID = 'pdf-export'

export function PDFExportButton({
	sessionId,
	messageId,
	className
}: {
	sessionId: string
	messageId: string
	className: string
}) {
	const { loaders, authorizedFetch, hasActiveSubscription } = useAuthContext()
	const subscribeModalStore = Ariakit.useDialogStore()
	const menu = Ariakit.useMenuStore()
	const pdfExport = useMutation({
		mutationFn: async (isDark: boolean) => {
			toast.loading('Generating PDF...', { id: TOAST_ID })
			const response = await authorizedFetch(`${AI_SERVER}/export/pdf`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					exportType: 'single_message',
					messageId,
					options: { includeTimestamps: true, includeCitations: true, paperSize: 'A4', isDark }
				})
			})
			const data: { success?: boolean; pdfUrl: string; error?: string } = await response.json()
			if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate PDF')
			const pdfResponse = await fetch(data.pdfUrl)
			if (!pdfResponse.ok) throw new Error(`Failed to download PDF (${pdfResponse.status})`)
			const url = URL.createObjectURL(await pdfResponse.blob())
			const a = document.createElement('a')
			a.href = url
			a.download = `llama-ai-export-${Date.now()}.pdf`
			document.body.appendChild(a)
			a.click()
			a.remove()
			URL.revokeObjectURL(url)
			trackUmamiEvent('llamaai-download', {
				kind: 'pdf',
				filename: a.download,
				exportType: 'single_message',
				theme: isDark ? 'dark' : 'light',
				sessionId,
				messageId
			})
		},
		onSuccess: () => toast.success('PDF downloaded!', { id: TOAST_ID }),
		onError: (error) => toast.error(error.message, { id: TOAST_ID })
	})
	const loading = loaders.userLoading || pdfExport.isPending

	const exportPdf = (isDark: boolean) => {
		if (loading) return
		if (hasActiveSubscription) {
			pdfExport.mutate(isDark)
			return
		}
		setSignupSource('llamaai-pdf')
		subscribeModalStore.show()
	}

	return (
		<>
			<Ariakit.MenuProvider store={menu}>
				<Tooltip
					content="Download PDF"
					render={
						<Ariakit.MenuButton
							store={menu}
							aria-label={pdfExport.isPending ? 'Exporting PDF' : 'Export PDF options'}
							// Focusable while the export runs, so focus stays on the control instead of falling to the page.
							disabled={loading}
							accessibleWhenDisabled
						/>
					}
					className={className}
				>
					{pdfExport.isPending ? <LoadingSpinner size={16} /> : <Icon name="download-paper" height={16} width={16} />}
				</Tooltip>
				<MenuSurface variant="actions" className="w-44">
					<MenuItem
						data-umami-event="export-pdf"
						data-umami-event-theme="light"
						onClick={() => exportPdf(false)}
						disabled={loading}
						className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
					>
						<Icon name="sun" height={14} width={14} className="shrink-0" />
						Light mode
					</MenuItem>
					<MenuItem
						data-umami-event="export-pdf"
						data-umami-event-theme="dark"
						onClick={() => exportPdf(true)}
						disabled={loading}
						className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
					>
						<Icon name="moon" height={14} width={14} className="shrink-0" />
						Dark mode
					</MenuItem>
				</MenuSurface>
			</Ariakit.MenuProvider>
			<LazySubscribeProModal dialogStore={subscribeModalStore} />
		</>
	)
}
