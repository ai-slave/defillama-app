import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'

interface ReturnModalProps {
	isOpen: boolean
	onClose: () => void
	returnUrl: string
}

export function ReturnModal({ isOpen, onClose, returnUrl }: ReturnModalProps) {
	const router = useRouter()

	const handleStayOnPage = () => {
		const { returnUrl: _ignoredReturnUrl, ...nextQuery } = router.query
		void router.replace(
			{
				pathname: router.pathname,
				query: nextQuery
			},
			undefined,
			{ shallow: true }
		)
		onClose()
	}
	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={() => onClose()}>
			<Ariakit.Dialog
				className="dialog gap-0 border border-[#4a4a50]/10 bg-[#131415] p-0 shadow-sub-purple-aura md:max-w-[400px]"
				portal
				unmountOnHide
			>
				<Ariakit.DialogDismiss className="absolute top-3 right-3 z-20 rounded-full p-1 text-tertiary transition-colors hover:bg-gray-700 hover:text-on-brand">
					<Icon name="x" className="size-6" />
				</Ariakit.DialogDismiss>
				<div className="mx-auto max-w-[400px] p-8">
					<h2 className="mb-4 text-center text-2xl font-bold text-on-brand">Welcome Back!</h2>
					<p className="mb-6 text-center text-tertiary">
						Would you like to return to the page you were on before signing in?
					</p>
					<div className="flex flex-col gap-3">
						<BasicLink
							href={returnUrl}
							className="w-full rounded-lg bg-sub-purple-500 px-4 py-3 text-center font-medium text-on-brand transition-colors hover:bg-sub-purple-hover"
						>
							Yes, take me back
						</BasicLink>
						<button
							onClick={handleStayOnPage}
							className="w-full rounded-lg bg-[#22242930] px-4 py-3 font-medium text-on-brand transition-colors hover:bg-sub-line"
						>
							Stay on this page
						</button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
