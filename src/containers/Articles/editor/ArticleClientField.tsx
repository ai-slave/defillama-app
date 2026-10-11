import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { ComboboxSelectTrigger } from '~/components/Select/ComboboxSelectTrigger'
import { SelectCheckIcon } from '~/components/Select/SelectCheckIcon'
import { selectTriggerStyles } from '~/components/Select/types'
import { ListLoading } from '~/ui/NoResults'
import { popoverRowWithBorderStyles, popoverSingleSelectCheckStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'
import { listResearchSponsors, setArticleClient } from '../api'
import type { ArticleClient, ArticleClientRelation } from '../types'
import { ARTICLE_CLIENT_RELATION_LABELS } from '../types'
import { MetaFieldHint } from './ArticleMetaFields'

const SPONSORS_QUERY_KEY = ['research', 'admin', 'sponsors'] as const
const NO_CLIENT = ''

type RelationValue = ArticleClientRelation | 'none'

export function ArticleClientField({
	articleId,
	client,
	onSaved
}: {
	articleId: string | undefined
	client: ArticleClient | null
	onSaved: (client: ArticleClient | null) => void
}) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const [listOpen, setListOpen] = useState(false)
	const sponsors = useQuery({
		queryKey: SPONSORS_QUERY_KEY,
		queryFn: () => listResearchSponsors(authorizedFetch),
		enabled: listOpen,
		retry: false
	})
	const save = useMutation({
		mutationFn: (next: { sponsorId: string | null; relation: ArticleClientRelation | null }) =>
			setArticleClient(articleId!, next, authorizedFetch),
		onSuccess: (saved) => {
			onSaved(saved)
			void queryClient.invalidateQueries({ queryKey: SPONSORS_QUERY_KEY })
		}
	})

	const disabled = !articleId || save.isPending
	const relationOptions: ReadonlyArray<SegmentedControlOption<RelationValue>> = [
		{ value: 'none', label: 'None', disabled: disabled || !client },
		{ value: 'sponsored', label: ARTICLE_CLIENT_RELATION_LABELS.sponsored, disabled: disabled || !client },
		{ value: 'collaboration', label: ARTICLE_CLIENT_RELATION_LABELS.collaboration, disabled: disabled || !client }
	]
	const error = save.error
		? httpErrorMessage(save.error, "Couldn't update the client.")
		: queryReadFailed(sponsors)
			? "Couldn't load clients."
			: null

	return (
		<div className="flex flex-col gap-3">
			<Ariakit.ComboboxProvider
				open={listOpen}
				setOpen={setListOpen}
				selectedValue={client?.id ?? NO_CLIENT}
				setSelectedValue={(value) => {
					const next = typeof value === 'string' ? value : NO_CLIENT
					if (next === (client?.id ?? NO_CLIENT)) return
					save.mutate({ sponsorId: next || null, relation: next ? (client?.relation ?? null) : null })
				}}
			>
				<ComboboxSelectTrigger
					aria-label="Article client"
					disabled={disabled}
					className={`${selectTriggerStyles('input', 'md')} w-full justify-between`}
				>
					<span className="truncate">{client?.displayName ?? 'No client'}</span>
					<Ariakit.ComboboxSelectArrow className="shrink-0 text-tertiary" />
				</ComboboxSelectTrigger>
				<ComboboxSurface variant="panel" heading="Client" sameWidth>
					{[{ id: NO_CLIENT, displayName: 'No client' }, ...(sponsors.data ?? [])].map((option) => {
						const selected = (client?.id ?? NO_CLIENT) === option.id
						return (
							<Ariakit.ComboboxItem key={option.id} value={option.id} className={popoverRowWithBorderStyles}>
								<span className="truncate">{option.displayName}</span>
								<span className={popoverSingleSelectCheckStyles(selected)} aria-hidden>
									{selected ? <SelectCheckIcon /> : null}
								</span>
							</Ariakit.ComboboxItem>
						)
					})}
					{sponsors.isPending && listOpen ? <ListLoading label="Loading clients" /> : null}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			<SegmentedControl
				label="Client relation"
				variant="field"
				size="md"
				options={relationOptions}
				value={client?.relation ?? 'none'}
				onValueChange={(relation) => {
					if (!client) return
					save.mutate({ sponsorId: client.id, relation: relation === 'none' ? null : relation })
				}}
			/>
			{error ? (
				<InlineStatus variant="error" retry={save.error ? undefined : sponsors}>
					{error}
				</InlineStatus>
			) : (
				<MetaFieldHint>
					{articleId
						? 'Optional. Saves immediately, no republish needed. Manage the list in Research admin → Clients.'
						: 'Save the draft first to set a client.'}
				</MetaFieldHint>
			)}
		</div>
	)
}
