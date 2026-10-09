# LlamaAI

`AgenticChat` in `index.tsx` coordinates the session, its requests and route changes. Surfaces render from a `ConversationViewModel`: `ChatSurface` chooses landing or conversation, `ConversationView` renders the thread, and `MessageBubble` renders a message through `renderModel.ts`.

## Where the work goes

| To do this                               | Use                                                                                          | Example                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Send a prompt, edit, resume or replay    | `runAgenticRequest`; attach to a running execution only through `useChatExecutionOwner`      | `hooks/useChatExecutionOwner.ts`         |
| Run a latest-wins side request           | Its own `AbortScope`, so it never takes stream ownership                                     | restore, pagination                      |
| Add an SSE event                         | Parse it in `fetchAgenticResponse.ts`, consume it through the guarded `streamCallbacks.ts`   | `fact_check_citations`                   |
| Commit an assistant message              | `StreamAccumulator` → `buildAssistantMessage`; reducer state is only the live snapshot       | `streamState.ts`                         |
| Show a persisted or shared message       | API shape → `Message` in `messageMappers.ts`, message → blocks in `renderModel.ts`           | `parseMessageToRenderModel`              |
| Accept a chart or dashboard payload      | Normalize it in `chartPayloads.ts`; family behavior in `utils/chartAdapters/*`               | `utils/chartAdapter.ts` stays the facade |
| Call an authenticated JSON endpoint      | `llamaAIRequest` in `api/transport.ts`                                                       | `api/telegram.ts`, `projects/api.ts`     |
| Strip a report marker                    | `utils/reportMarkers.ts`                                                                     | `stripBeforeReportStart`                 |
| Set the prompt mode                      | `AgenticAnswerMode`; `quick` is left out of the request body, other modes go as `mode`       | `types.ts`                               |
| Key a project query                      | `projects/queryKeys.ts`                                                                      | `projectSessionsKey`                     |
| Create, move, rename or delete a session | `hooks/useSessionMutations.ts`, which updates the global and project session caches          | moving a chat into a project             |
| Link Telegram or Slack                   | `useIntegrationLink` / `useSlackIntegrationLink`; components read derived state, never poll  | `components/SlackIntegrationRow.tsx`     |
| Show status in the thread                | `ChatStatusLine`                                                                             | `components/status/ChatStatusLine.tsx`   |
| Show state that blocks the next prompt   | `ComposerTray`; the composer box holds the draft only                                        | failed prompt, full queue, context limit |
| Draw the box around a prompt             | `ComposerFrame` (`row` or `stack`; `gold` on the /ai landing), never a hand-built border     | `components/input/ComposerFrame.tsx`     |
| Pick a color                             | A `semantics.css` token; `--ai-*` only for the exceptions in `src/styles/themes/llamaai.css` | gold welcome action                      |

## Checks a table can't express

### Execution and queue

- `ExecutionCoordinator` serializes a session's execution intents and invalidates stale callbacks before aborting their requests.
- Session open and tab return call `resumeIfRunning`; a dropped stream calls `recoverExecution`. Do not add a third attach path.
- A prompt starts only when `isChatBusy()` is false. It reads the stream store and the coordinator's `runningIntent()` synchronously, so never mirror either in a ref.
- A prompt operation runs until the response body closes, after `done`. A resume or queue check that finds no work does not block a prompt; the prompt replaces it.
- A stream that closes without `done` is a temporary connectivity failure unless the request was aborted.
- Prompt and edit mutations carry a stable `clientMutationId`; reusing it reattaches or reconciles instead of starting duplicate work.
- A held queue attach is not streaming. The chat enters `streaming` when the preamble naming the queued execution arrives, and a hold that drops before then retries silently.
- While a queued prompt waits, the composer and follow-up actions add to the queue, and a branch switch leaves the hold attached.
- Conversation follow-up buttons use the selected composer mode for immediate and queued requests. Suggested-question attribution must not override that mode: research-plan confirmations need Research mode too. Follow-ups do not include a pending text quote.
- A project chat sends `projectId` with every request.

### Duels

- A duel belongs to the execution whose stream delivered `duel_start` and ends when any other execution streams. The stream callbacks read each stream's opening `message_id` to tell.
- A prompt ends the duel on submit, because a refused prompt stays in the thread. A refused edit rolls back, and its duel stays open.
- The arms' status derives from `isStreaming`, which is right only while the duel's own execution streams.
- Duel answers never enter message history. Ending a duel without a vote restores the answer the server kept through `utils/abandonedDuel.ts`, with an error line under the prompt if that load fails.
- A confirmed Stop keeps the duel on screen; the server saves the stopped run as arm A's answer.
- A prompt or a new execution's `message_id` supersedes a branch switch that is still loading, such as a vote's.

### Deep links and sharing

- `/ai/chat?prompt=...` never runs on page load; `DeepLinkPromptModal` asks first, signed in or out.
- `/ai/chat/<session>?prompt=...` fills the composer after restore and waits for Send; only `?prompt` leaves the URL.
- `?shareToken` stays in the URL until the first request in that chat carries it.
- The one prompt that sends by itself is one a reader typed on a shared chat before signing in.
- Fork paths convert raw strings to the branded `SessionId` and `ShareToken` from `ids.ts` at the boundary.

### Fact-check

- `fact_check_citations` stores references on the accumulator and dispatches `SET_CITATIONS`; the committed message keeps them in `Message.citations`.
- `rehypeCitationMarkers` turns markers into `fact-check-pill` elements, which `CitationPill` renders. Keep `fact-check-pill` in `components/markdown/sanitizeConfig.ts`, or verified markers disappear.
- `processUnifiedCitations` rewrites markers for plain-text consumers outside the chat renderer.
- `FACT_CHECKED_REQUIRES_SUBSCRIPTION` keeps its own limit copy, separate from the research limit.

### Data contracts

- Persisted restore, shared restore and live commit all become the domain `Message` before anything renders.
- The backend owns the dashboard chart data shape. Normalize it at the boundary, then render or fail visibly; never drop entries in render code.
- Keep `adaptChartData`, `adaptCandlestickData` and `AdaptedChartData` stable.

### Streaming answers

- Order: `ChatMarkdownRenderer` → `useStreamReveal` → `markdownSegments`, which parses through the `remarkIncremental` cache, applies `repairLists`, runs `mendStreamingMarkdown` while the text is unfinished, then runs rehype per top-level segment. Each stage's rules sit in its header.
- `useChatScroll` follows content growth.
- A pipeline change keeps `components/markdown/__tests__/markdownSegments.test.tsx` green: every streamed prefix renders the same HTML as `ReactMarkdown`.

### Transport

- HTTP carries commands and one SSE stream carries an execution. A session-wide feed may only replace the execution stream and REST recovery, never run beside them, because two event owners make ordering ambiguous.

### UI

- Project pages use `heading-sm` titles, 16px top padding and 16px between sections; breadcrumb and title rows use 8px gaps. Tabs use `TabLink` through the Ariakit `Tab` render prop.
- Prose fields use `Textarea`, compact inputs `Input`; both use 16px text below `sm`. Textarea height follows content.
- The sidebar header holds actions only: the toggles, the Chat | Terminal switch and New chat. Alerts and Projects form one row list under it, and History starts on spacing, not a divider. The switch is a `SegmentedControl` with `variant="mode"`, so New chat stays the only brand-colored control; the rail stacks the same switch as icons. It renders only for accounts with the terminal, and never in the open sidebar below `lg`, where the terminal does not open.
- The sidebar Alerts row, with its count, is the one standing entry to the Alerts modal. The composer and landing hold no Alerts button; alerts are created by asking in chat, and contextual entries (tips, alert cards, token pages) may open the modal. Sidebar icons stay neutral.
- Sidebar projects get a 16px folder icon; chat rows stay text-only. Chat title rows are `body-md`, at least 36px high on desktop and 44px below `sm`.
- Row actions use the shared 32px icon button with 16px icons; sidebar navigation icons are 16px with a 6px gap.
- Onboarding follows the active theme with overlay surfaces and shared buttons, keeping the gold welcome action and bronze accents.
- Hover, focus, selection and theme changes are immediate. Honor reduced motion for entrances, transforms, generated-image reveals and decorative effects.
