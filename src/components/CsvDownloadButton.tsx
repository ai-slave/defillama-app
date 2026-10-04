import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { type ReactNode, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { TrialCsvLimitModal } from '~/containers/Subscription/shared/TrialCsvLimitModal'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { slug } from '~/utils'
import { downloadCSV } from '~/utils/download'

interface CSVDownloadButtonProps {
	// Common props
	className?: string
	size?: 'sm' | 'md'
	replaceClassName?: boolean
	smol?: boolean
	children?: ReactNode
	free?: boolean
	disabled?: boolean
}

export type CsvPayload = { filename: string; rows: Array<Array<string | number | boolean | null | undefined>> }
export type PrepareCsv = () => CsvPayload | Promise<CsvPayload>

// Option 1: With prepareCsv
interface CSVDownloadButtonWithPrepareCsv extends CSVDownloadButtonProps {
	prepareCsv: PrepareCsv
	onClick?: never
	isLoading?: never
}

// Option 2: With onClick and isLoading
interface CSVDownloadButtonWithOnClick extends CSVDownloadButtonProps {
	onClick: () => void | Promise<void>
	isLoading: boolean
	prepareCsv?: never
}

// Union type
type CSVDownloadButtonPropsUnion = CSVDownloadButtonWithPrepareCsv | CSVDownloadButtonWithOnClick

function normalizeCsvFilename(filename: string): string {
	const trimmed = filename.trim()
	const baseName = trimmed.toLowerCase().endsWith('.csv') ? trimmed.slice(0, -4) : trimmed
	const normalizedBaseName = slug(baseName)
	return `${normalizedBaseName || 'data'}.csv`
}

export async function downloadPreparedCsv(prepareCsv: PrepareCsv) {
	const { filename, rows } = await prepareCsv()
	downloadCSV(normalizeCsvFilename(filename), rows, { addTimestamp: false })
}

export const CSV_DOWNLOAD_ERROR = 'Couldn’t complete the CSV export. Please try again.'

// Export state stays local; access dialogs only decide whether it may start.
export function useCsvDownload(free = false) {
	const { isAuthenticated, loaders, hasActiveSubscription, isTrial } = useAuthContext()
	const subscriptionDialog = Ariakit.useDialogStore()
	const trialDialog = Ariakit.useDialogStore()
	const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
	const userLoading = !!loaders?.userLoading

	const requestDownload = (action: () => void | Promise<void>, onError?: () => void) => {
		if (userLoading || status === 'pending') return
		if (free || (isAuthenticated && hasActiveSubscription && !isTrial)) {
			setStatus('pending')
			void Promise.resolve()
				.then(action)
				.then(
					() => setStatus('idle'),
					() => {
						setStatus('error')
						if (onError) onError()
						else toast.error(CSV_DOWNLOAD_ERROR)
					}
				)
		} else if (isTrial) {
			trialDialog.show()
		} else {
			setSignupSource('csv')
			subscriptionDialog.show()
		}
	}

	const clearError = () => setStatus((current) => (current === 'error' ? 'idle' : current))

	return { status, requestDownload, clearError, subscriptionDialog, trialDialog, userLoading }
}

export function CsvDownloadDialogs({ controller }: { controller: ReturnType<typeof useCsvDownload> }) {
	const trialOpen = Ariakit.useStoreState(controller.trialDialog, 'open')
	return (
		<>
			<LazySubscribeProModal dialogStore={controller.subscriptionDialog} />
			{trialOpen ? <TrialCsvLimitModal isOpen onClose={controller.trialDialog.hide} /> : null}
		</>
	)
}

// use children to pass in the text
export function CSVDownloadButton(props: CSVDownloadButtonPropsUnion) {
	const {
		className,
		replaceClassName,
		smol,
		children,
		free,
		disabled = false,
		size = 'sm',
		prepareCsv,
		onClick
	} = props
	const csv = useCsvDownload(free)
	const isLoading = csv.userLoading || props.isLoading || csv.status === 'pending'
	const isClient = useIsClient()
	const router = useRouter()
	const buttonContent = (
		<>
			{!isLoading || !isClient ? (
				<Icon name="download-paper" className="size-3.5 shrink-0" />
			) : (
				<LoadingSpinner size={14} />
			)}

			{children || (
				<span className="truncate">{csv.status === 'pending' ? 'Preparing…' : smol ? '.csv' : 'Download .csv'}</span>
			)}
		</>
	)

	const handleButtonClick = () => {
		if (disabled || isLoading) return
		csv.requestDownload(async () => {
			if (prepareCsv) {
				await downloadPreparedCsv(prepareCsv)
			} else {
				await onClick()
			}
		})
	}

	return (
		<>
			{replaceClassName ? (
				// A caller that styles the control itself (a menu row) gets the behaviour without Button's look.
				<Ariakit.Button
					type="button"
					data-umami-event="export-csv"
					data-umami-event-page={router.pathname}
					className={`${className ?? ''} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
					onClick={handleButtonClick}
					disabled={disabled || !isClient || isLoading}
					accessibleWhenDisabled={csv.status === 'pending' || props.isLoading}
				>
					{buttonContent}
				</Ariakit.Button>
			) : (
				<Button
					size={size}
					data-umami-event="export-csv"
					data-umami-event-page={router.pathname}
					className={className}
					onClick={handleButtonClick}
					disabled={disabled || !isClient || isLoading}
					accessibleWhenDisabled={csv.status === 'pending' || props.isLoading}
				>
					{buttonContent}
				</Button>
			)}
			<span role="status" className="sr-only">
				{csv.status === 'pending' ? 'Preparing CSV download' : ''}
			</span>
			<CsvDownloadDialogs controller={csv} />
		</>
	)
}
