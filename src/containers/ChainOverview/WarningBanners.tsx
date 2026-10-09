import { InlineStatus } from '~/ui/Status'

const VARIANT = { rug: 'error', alert: 'warning', low: 'info' } as const

/** Notices the data attaches to a chain or protocol page (a rug pull, an exploit, a renamed site), most severe first
    as the data orders them. */
export function WarningBanners({
	banners,
	entityName
}: {
	banners: ReadonlyArray<{ message: string; level: keyof typeof VARIANT }> | null | undefined
	entityName: string
}) {
	return banners?.map((banner) => (
		<InlineStatus key={`${banner.message}-${banner.level}-${entityName}`} variant={VARIANT[banner.level]}>
			{banner.message}
		</InlineStatus>
	))
}
