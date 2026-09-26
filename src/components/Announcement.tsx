import clsx from 'clsx'
import * as React from 'react'
import { Icon } from '~/ui/Icon'
import {
	createAnnouncementDismissalToken,
	dismissAnnouncement,
	isAnnouncementDismissed,
	subscribeToAnnouncementDismissals
} from '~/utils/cookies'

type DismissibleAnnouncementProps = {
	children: React.ReactNode
	announcementId: string
	version: string
	notCancellable?: false
	className?: string
	contentClassName?: string
	dismissButtonClassName?: string
	dismissLabel?: string
}

type PermanentAnnouncementProps = {
	children: React.ReactNode
	notCancellable: true
	className?: string
	contentClassName?: string
	dismissButtonClassName?: string
	dismissLabel?: string
	announcementId?: never
	version?: never
}

type AnnouncementProps = DismissibleAnnouncementProps | PermanentAnnouncementProps

export function Announcement(props: AnnouncementProps) {
	const {
		children,
		notCancellable,
		className,
		contentClassName,
		dismissButtonClassName,
		dismissLabel = 'Close'
	} = props
	const dismissalToken = props.notCancellable
		? null
		: createAnnouncementDismissalToken(props.announcementId, props.version)
	// The cookie is the source of truth, read as an external store: the server and the first client render
	// both report "not dismissed", so the markup matches, and dismissing anywhere updates every banner.
	const isDismissed = React.useSyncExternalStore(
		subscribeToAnnouncementDismissals,
		() => (dismissalToken ? isAnnouncementDismissed(dismissalToken) : false),
		() => false
	)

	if (isDismissed) {
		return null
	}

	const closeAnnouncement = () => {
		if (!dismissalToken) return
		dismissAnnouncement(dismissalToken)
	}

	const wrapperStyle: React.CSSProperties & Record<'--announcement-bg', string> = {
		'--announcement-bg': 'hsl(215deg 79% 51% / 12%)'
	}

	return (
		<div
			className={clsx(
				'flex min-h-[38px] items-center justify-between gap-2 rounded-md p-1.5 text-sm',
				className ?? 'border border-(--announcement-bg) bg-(--announcement-bg)',
				dismissalToken ? `announcement-token--${dismissalToken}` : ''
			)}
			style={wrapperStyle}
		>
			<div className={clsx('flex-1 text-center', contentClassName)}>{children}</div>
			{!notCancellable ? (
				<button
					type="button"
					data-announcement-dismiss
					className={clsx(
						'flex size-6 shrink-0 items-center justify-center self-center rounded-md hover:bg-surface-elevated-1',
						dismissButtonClassName
					)}
					onClick={closeAnnouncement}
				>
					<Icon name="x" height={16} width={16} />
					<span className="sr-only">{dismissLabel}</span>
				</button>
			) : null}
		</div>
	)
}
