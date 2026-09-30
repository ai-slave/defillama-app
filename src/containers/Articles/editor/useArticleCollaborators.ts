import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import {
	addCollaborator,
	ArticleApiError,
	listCollaborators,
	removeCollaborator,
	transferOwnership,
	updateCollaborator
} from '../api'
import { applyPendingToLocalArticle } from '../document'
import type { LocalArticleDocument } from '../types'
import { articleWriteKey, cacheWrittenArticle } from './ArticleEditorUtils'

type AuthorizedFetch = (url: string, options?: RequestInit) => Promise<Response | null>

type UseArticleCollaboratorsArgs = {
	articleId: string | undefined
	authorizedFetch: AuthorizedFetch
	queryClient: QueryClient
	setArticle: Dispatch<SetStateAction<LocalArticleDocument>>
}

export function useArticleCollaborators({
	articleId,
	authorizedFetch,
	queryClient,
	setArticle
}: UseArticleCollaboratorsArgs) {
	const [collaboratorEmail, setCollaboratorEmail] = useState('')
	const collaboratorsQueryKey = useMemo(() => ['research', 'article-collaborators', articleId] as const, [articleId])
	const collaboratorsQuery = useQuery({
		queryKey: collaboratorsQueryKey,
		queryFn: async () => {
			try {
				return await listCollaborators(articleId!, authorizedFetch)
			} catch (error) {
				if (error instanceof ArticleApiError && error.status === 403) return []
				throw error
			}
		},
		enabled: !!articleId,
		retry: false
	})
	const collaborators = collaboratorsQuery.data ?? []
	const collaboratorsLoading = collaboratorsQuery.isLoading
	const addCollaboratorMutation = useMutation({
		mutationFn: ({ targetArticleId, email }: { targetArticleId: string; email: string }) =>
			addCollaborator(targetArticleId, email, authorizedFetch),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey })
		}
	})
	const removeCollaboratorMutation = useMutation({
		mutationFn: ({ targetArticleId, pbUserId }: { targetArticleId: string; pbUserId: string }) =>
			removeCollaborator(targetArticleId, pbUserId, authorizedFetch),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey })
		}
	})
	const updateCollaboratorMutation = useMutation({
		mutationFn: ({
			targetArticleId,
			pbUserId,
			hidden
		}: {
			targetArticleId: string
			pbUserId: string
			hidden: boolean
		}) => updateCollaborator(targetArticleId, pbUserId, { hidden }, authorizedFetch),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey })
		}
	})
	const transferOwnershipMutation = useMutation({
		mutationKey: articleWriteKey(articleId),
		mutationFn: ({ targetArticleId, pbUserId }: { targetArticleId: string; pbUserId: string }) =>
			transferOwnership(targetArticleId, { pbUserId }, authorizedFetch),
		onSuccess: async (updated) => {
			void queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey })
			await cacheWrittenArticle(queryClient, updated)
		}
	})

	// Each action resolves to its failure message, or null. The sheet decides where it shows: inline while the
	// sheet is on screen, a toast once the reader has left it.
	const handleAddCollaborator = async (): Promise<string | null> => {
		if (!articleId) return null
		const email = collaboratorEmail.trim()
		if (!email) return 'Enter an email address'
		try {
			// The new row in the authors list confirms it.
			await addCollaboratorMutation.mutateAsync({ targetArticleId: articleId, email })
			setCollaboratorEmail('')
			return null
		} catch (error) {
			return error instanceof Error ? error.message : 'Failed to add co-author'
		}
	}

	const handleRemoveCollaborator = async (pbUserId: string): Promise<string | null> => {
		if (!articleId) return null
		try {
			await removeCollaboratorMutation.mutateAsync({ targetArticleId: articleId, pbUserId })
			return null
		} catch {
			return "Couldn't remove this co-author. Try again."
		}
	}

	const handleToggleHidden = async (pbUserId: string, nextHidden: boolean): Promise<string | null> => {
		if (!articleId) return null
		try {
			await updateCollaboratorMutation.mutateAsync({ targetArticleId: articleId, pbUserId, hidden: nextHidden })
			return null
		} catch {
			return "Couldn't update this co-author. Try again."
		}
	}

	// The confirm dialog shows the failure; on success the authors list shows the new owner.
	const handleTransferOwnership = async (pbUserId: string) => {
		if (!articleId) return false
		try {
			const updated = await transferOwnershipMutation.mutateAsync({ targetArticleId: articleId, pbUserId })
			setArticle(applyPendingToLocalArticle(updated, updated.pending))
			return true
		} catch {
			return false
		}
	}

	return {
		collaboratorAdding: addCollaboratorMutation.isPending,
		collaboratorRemovingId: removeCollaboratorMutation.isPending ? removeCollaboratorMutation.variables.pbUserId : null,
		collaboratorUpdatingId: updateCollaboratorMutation.isPending ? updateCollaboratorMutation.variables.pbUserId : null,
		collaboratorEmail,
		collaborators,
		collaboratorsLoadFailed: collaboratorsQuery.isError,
		collaboratorsLoading,
		handleAddCollaborator,
		handleRemoveCollaborator,
		handleToggleHidden,
		handleTransferOwnership,
		resetTransferOwnership: transferOwnershipMutation.reset,
		retryCollaborators: collaboratorsQuery.refetch,
		setCollaboratorEmail,
		transferOwnershipFailed: transferOwnershipMutation.isError,
		transferringOwnership: transferOwnershipMutation.isPending
	}
}
