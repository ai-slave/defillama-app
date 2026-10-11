import clsx from 'clsx'
import * as React from 'react'
import { Button } from '~/ui/Button'
import { keepFocus, pageContent } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { UmamiEventAttributes } from '~/utils/analytics/umami'
import {
	createAnnouncementDismissalToken,
	dismissAnnouncement,
	isAnnouncementDismissed,
	subscribeToAnnouncementDismissals
} from '~/utils/cookies'

/** Click events for a banner the page measures: its one call to action and its close button. */
export type AnnouncementTracking = { cta: UmamiEventAttributes; dismiss: UmamiEventAttributes }

type DismissibleAnnouncementProps = {
	children: React.ReactNode
	announcementId: string
	version: string
	notCancellable?: false
	className?: string
	contentClassName?: string
	dismissLabel?: string
	/** Sends this event when the reader closes the banner. */
	dismissTracking?: UmamiEventAttributes
}

type PermanentAnnouncementProps = {
	children: React.ReactNode
	notCancellable: true
	className?: string
	contentClassName?: string
	dismissLabel?: string
	announcementId?: never
	version?: never
	dismissTracking?: never
}

const DISMISS_TOKENS = {
	'--text-secondary': 'currentColor',
	'--text-primary': 'currentColor',
	'--bg-hover-row': 'color-mix(in srgb, currentColor 12%, transparent)'
} as React.CSSProperties

type AnnouncementProps = DismissibleAnnouncementProps | PermanentAnnouncementProps

/** The one call to action in a banner (a link or a button): a pill in the banner's own palette. The banner carries its
    `*-announcement-scope` class from src/styles/themes/announcements.css, which sets `--announcement-cta`,
    `--announcement-cta-hover`, `--announcement-cta-text` and `--announcement-cta-ring` from its theme tokens, so every
    banner shares one shape and only the colors change. The fill darkens while held. */
export const announcementCtaStyles =
	'inline-flex min-h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-(--announcement-cta) px-2.5 py-0.5 title-sm text-(--announcement-cta-text) ring-1 ring-(--announcement-cta-ring) hover:bg-(--announcement-cta-hover) focus-visible:bg-(--announcement-cta-hover) active:brightness-90'

export function Announcement(props: AnnouncementProps) {
	const { children, notCancellable, className, contentClassName, dismissLabel = 'Close', dismissTracking } = props
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
				'flex min-h-9 items-center justify-between gap-2 rounded-md p-1.5 body-md',
				className ?? 'border border-(--announcement-bg) bg-(--announcement-bg)',
				dismissalToken ? `announcement-token--${dismissalToken}` : ''
			)}
			style={wrapperStyle}
		>
			<div className={clsx('flex-1 text-center', contentClassName)}>{children}</div>
			{!notCancellable ? (
				// Each banner paints its own text color on its own background, often light on dark, so the close
				// button takes the banner's text color and a wash of it instead of the page's text tiers.
				<span className="contents" style={DISMISS_TOKENS}>
					<Tooltip
						content={dismissLabel}
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								aria-label={dismissLabel}
								{...dismissTracking}
								// The banner leaves with its close button, so the page content takes focus.
								onClick={() => keepFocus(closeAnnouncement, pageContent)}
							/>
						}
					>
						<Icon name="x" className="size-4" />
					</Tooltip>
				</span>
			) : null}
		</div>
	)
}
