import { NotFoundPage } from '~/components/NotFoundPage'
import AttestationLanding from '~/containers/AttestationLanding'
import { useAuthContext } from '~/containers/Subscription/auth'

export default function AttestationPage() {
	const { user, loaders } = useAuthContext()
	const isLlama = user?.flags?.is_llama === true

	if (loaders.userLoading) return null
	if (!isLlama) return <NotFoundPage />

	return <AttestationLanding />
}
