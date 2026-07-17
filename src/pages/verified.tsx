import { NotFoundPage } from '~/components/NotFoundPage'
import VerifiedLanding from '~/containers/AttestationLanding'
import { useAuthContext } from '~/containers/Subscription/auth'

export default function VerifiedPage() {
	const { user, loaders } = useAuthContext()
	const isLlama = user?.flags?.is_llama === true

	if (loaders.userLoading) return null
	if (!isLlama) return <NotFoundPage />

	return <VerifiedLanding />
}
