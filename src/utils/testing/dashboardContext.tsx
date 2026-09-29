import * as Ariakit from '@ariakit/react'
import type { ContextType, ReactNode } from 'react'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { DashboardMode } from '~/containers/ProDashboard/dashboardTypes'
import { ProDashboardContexts as C } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext, StreamItemReadinessContext } from '~/containers/ProDashboard/queries'

type Value<K extends keyof typeof C> = NonNullable<ContextType<(typeof C)[K]>>

export type DashboardTestState = {
	mode?: DashboardMode
	items?: Array<DashboardItemConfig>
	time?: Partial<Value<'Time'>>
	catalog?: Partial<Value<'Catalog'>>
	permissions?: Partial<Value<'Permissions'>>
	dashboard?: Partial<Value<'Dashboard'>>
	editorActions?: Partial<Value<'EditorActions'>>
	streamProgress?: Partial<Value<'StreamProgress'>>
	variables?: Partial<Value<'Variables'>>
	annotations?: Partial<Value<'Annotations'>>
	history?: Partial<Value<'History'>>
	ui?: Partial<Value<'UI'>>
	save?: Partial<Value<'Save'>>
	streamDone?: boolean
	readyItemIds?: ReadonlySet<string> | null
	proxyAuthToken?: string | null
}

const noop = () => {}
// Tests pass only the fields a component reads; the rest stay absent on purpose.
const cast = <T,>(value: object) => value as T
const EMPTY_MAP = new Map()

/**
 * Supplies dashboard state to consumers as plain values, without the real provider's
 * loading, stream, and saving. Data fields default to an empty dashboard the reader owns
 * and edits. Dashboard and editor actions exist only when the test passes them, so a
 * component calling an action the test did not expect fails loudly.
 */
export function DashboardTestProvider({ children, ...state }: DashboardTestState & { children: ReactNode }) {
	const createDashboardDialogStore = Ariakit.useDialogStore()
	const mode = state.mode ?? 'edit'
	const items = state.items ?? []
	return (
		<C.Mode.Provider value={{ mode }}>
			<StreamDoneContext.Provider value={state.streamDone ?? true}>
				<StreamItemReadinessContext.Provider value={state.readyItemIds ?? null}>
					<ProxyAuthTokenContext.Provider value={state.proxyAuthToken ?? null}>
						<C.Save.Provider value={state.save ? cast<Value<'Save'>>(state.save) : null}>
							<C.Time.Provider
								value={{
									timePeriod: '365d',
									customTimePeriod: null,
									setTimePeriod: noop,
									setCustomTimePeriod: noop,
									...state.time
								}}
							>
								<C.Catalog.Provider
									value={{
										protocols: [],
										chains: [],
										protocolsLoading: false,
										protocolCatalog: { status: 'ready' },
										getChainInfo: () => undefined,
										getProtocolInfo: () => undefined,
										parentMapping: EMPTY_MAP,
										protocolBySlug: EMPTY_MAP,
										protocolRelations: { protocolsBySlug: EMPTY_MAP, childrenByParentId: EMPTY_MAP },
										...state.catalog
									}}
								>
									<C.Permissions.Provider
										value={{
											isReadOnly: false,
											dashboardOwnerId: null,
											hideDuplicateButton: false,
											reason: null,
											role: 'owner',
											canEdit: true,
											canDelete: true,
											canMove: true,
											team: null,
											...state.permissions
										}}
									>
										<C.Dashboard.Provider
											value={cast<Value<'Dashboard'>>({
												dashboardId: null,
												currentDashboard: null,
												dashboardName: 'My Dashboard',
												dashboardVisibility: 'private',
												dashboardTags: [],
												dashboardDescription: '',
												isLoadingDashboard: false,
												streamHasResolved: true,
												loadError: null,
												canUndo: false,
												...state.dashboard
											})}
										>
											<C.EditorActions.Provider value={cast<Value<'EditorActions'>>({ ...state.editorActions })}>
												<C.ItemsState.Provider value={{ items }}>
													<C.StreamProgress.Provider
														value={{
															readyCount: 0,
															totalCount: 0,
															isStreaming: false,
															isDone: true,
															error: null,
															...state.streamProgress
														}}
													>
														<C.Variables.Provider
															value={cast<Value<'Variables'>>({
																variables: [],
																overrides: {},
																values: {},
																catalog: null,
																resolvedItems: items,
																unavailableByItemId: EMPTY_MAP,
																candidates: [],
																canEditVariables: false,
																...state.variables
															})}
														>
															<C.Annotations.Provider
																value={{ annotations: [], setAnnotations: noop, ...state.annotations }}
															>
																<C.History.Provider
																	value={{
																		canUndo: false,
																		canRedo: false,
																		undoEntry: null,
																		undo: () => false,
																		redo: () => false,
																		...state.history
																	}}
																>
																	<C.UI.Provider
																		value={{
																			createDashboardDialogStore,
																			showGenerateDashboardModal: false,
																			setShowGenerateDashboardModal: noop,
																			showIterateDashboardModal: false,
																			setShowIterateDashboardModal: noop,
																			...state.ui
																		}}
																	>
																		{children}
																	</C.UI.Provider>
																</C.History.Provider>
															</C.Annotations.Provider>
														</C.Variables.Provider>
													</C.StreamProgress.Provider>
												</C.ItemsState.Provider>
											</C.EditorActions.Provider>
										</C.Dashboard.Provider>
									</C.Permissions.Provider>
								</C.Catalog.Provider>
							</C.Time.Provider>
						</C.Save.Provider>
					</ProxyAuthTokenContext.Provider>
				</StreamItemReadinessContext.Provider>
			</StreamDoneContext.Provider>
		</C.Mode.Provider>
	)
}
