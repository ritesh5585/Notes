# 14 · Interview Bank (Junior → Senior)

> **Prev ←** [13-senior-internals](./13-senior-internals.md) · **Next →** [15-snippets-muscle-memory](./15-snippets-muscle-memory.md)

**How to answer:** definition (1 line) → **why it exists** → trade-off/edge case → tiny example. Seniors get hired for the *reason*, not the definition.

## 0. Topic frequency map
| Level | Topics interviewers actually ask |
|---|---|
| **Always** | props vs state, keys, controlled/uncontrolled, useEffect deps & cleanup, lifting state, conditional/list rendering, virtual DOM, re-render causes |
| **Very likely** | useMemo/useCallback/memo, Context vs store, custom hooks, React Router, forms/validation, fetching + loading/error, lazy/Suspense, debounce/throttle |
| **Mid → Senior** | reconciliation, batching, stale closures, error boundaries, portals, refs, performance profiling, state architecture, auth flow, testing |
| **Senior** | Fiber, render vs commit, lanes/transitions, hooks internals, hydration/SSR/RSC, Compiler, design trade-offs |

---

## Tier 1: Foundations
**What problem does React solve?** Keeping a large changing UI consistent with data. You describe UI as a function of state; React syncs the DOM. (Not "plain JS can't update DOM".)

**Is the Virtual DOM why React is fast?** Partly; oversimplified. It's a lightweight description React diffs, which makes the declarative model affordable. The real win is maintainability/correctness.

**Props vs state?** Props: inputs owned by parent, read-only. State: component-owned memory, changed via setter, triggers re-render.

**Why `key`?** Stable identity across renders so reconciliation can reuse/move/discard the right nodes and keep state attached to the right item.

**Why `map` not `forEach`?** `map` returns an array of elements; `forEach` returns `undefined`.

**Controlled vs uncontrolled?** Controlled: value in React state, `value` + `onChange`. Uncontrolled: DOM holds it, read via ref. Controlled for live validation/dependent fields; uncontrolled (or RHF) for simple/perf.

**What is JSX?** Syntax sugar compiled to `createElement`/`jsx` calls that return plain element objects.

**Why must component names be capitalized?** Lowercase = host/DOM tag, Capital = component reference.

**Why can't components return multiple roots?** A function returns one value; use Fragment.

**Lifting state up?** Move state to the closest common parent and pass data + callbacks down.

**What triggers a re-render?** Own state change, parent render, consumed context change. (Props matter only for memoized components.)

**Does re-render mean DOM update?** No. Render = run function; commit updates only differences.

**Class vs function components?** Functions + Hooks are standard; classes are legacy (still needed for error boundaries).

**Fragment?** Group siblings without extra DOM node.

---

## Tier 2: Hooks & state reasoning
**Why do Hooks have rules?** React stores Hooks as a list by call order; changing order mismaps stored values.

**`useEffect` dependency array?** The set of reactive values the effect reads. React re-runs the effect when any changes (`Object.is`). It's a correctness contract, not an optimization.

**Why does `useEffect` loop forever?** It updates state that's in its own deps (directly or via a new object/function each render).

**Cleanup function?** Runs before the next setup and on unmount: remove listeners, clear timers, abort requests.

**Why does `setCount(count + 1)` ×3 add 1?** Same snapshot. Use `setCount(c => c + 1)`: updater functions queue and run in order.

**Why is state immutable?** Change detection by reference; enables bail-outs, memoization, time-travel; mutating keeps the same reference so React skips.

**Stale closure?** A function captured an older render's values. Fix: updater form, correct deps, ref for latest value.

**`useRef` vs `useState`?** Ref doesn't trigger renders, persists across renders; use for DOM nodes/timers/previous values.

**`useMemo` vs `useCallback`?** Value vs function; `useCallback(fn, d) ≈ useMemo(() => fn, d)`.

**Why isn't `useMemo` automatically good?** Overhead; pays off only for expensive work or reference stability that something compares.

**Why does a memoized child re-render?** Inline object/array/function props change by reference; or it consumes context; or children prop changes.

**`useEffect` vs `useLayoutEffect`?** Layout: after DOM mutation, before paint, blocks paint (measure/adjust). Effect: after paint (usually).

**`useReducer` vs `useState`?** Reducer for many related transitions/complex logic; testable pure function.

**Custom hook?** `use…` function composing Hooks to reuse logic; each call has isolated state.

**What is `useId` for?** Stable SSR-safe ids for label/input; not list keys.

**`useTransition` vs `useDeferredValue`?** Wrap the update vs wrap the value; both lower urgency of heavy renders.

**What does `useSyncExternalStore` do?** Subscribes to external stores with consistent snapshots, avoiding tearing.

---

## Tier 3: Architecture, data, and tools
**Context vs Zustand/Redux?** Context is delivery, no selectors, all consumers re-render on value change. Stores give selector subscriptions, tooling, usage outside React.

**Why does Context re-render everything?** Consumers re-render when Provider `value` reference changes. Memoize value, split contexts by update frequency.

**Does `memo` stop context updates?** No.

**Zustand vs Context?** No Provider, selectors, `getState()` outside React, persist/devtools middleware; Context for DI/theme/subtree.

**How do you avoid prop drilling?** Composition (`children`) → Context → store.

**Where does auth state live?** Global (many unrelated consumers: header, routes, API layer). Token storage is a separate threat-model decision (httpOnly cookie vs localStorage). Route guards are UX; server enforces.

**fetch vs Axios?** Axios: auto JSON, throws on 4xx/5xx, interceptors, instances, timeouts, progress. `fetch` suffices for simple cases (check `res.ok`).

**How do you handle 401 + refresh with Axios?** Response interceptor: on 401 (not retried, not auth endpoint) → single-flight refresh promise shared by concurrent failures → retry original once → on failure logout.

**Why a service layer / 4-layer architecture?** Single place for endpoints, components ignorant of HTTP, testability, small change blast radius.

**Server state vs client state?** Server owns server state; you hold a cacheable stale-able copy → TanStack Query (cache, dedupe, invalidate). Client state = UI/cart/theme.

**Why TanStack Query over `useEffect` fetch?** Caching, dedupe, retries, cancellation, refetch on focus, pagination, optimistic updates, no race bugs.

**How do you handle forms at scale?** RHF + zod: uncontrolled registration → fewer renders; schema validation; `Controller` for custom inputs; `setError` for server errors; `useFieldArray` for lists.

**Why RHF re-renders less?** Values live outside React state; Proxy-based `formState` subscribes only to what you read.

**Debounce vs throttle?** Debounce: run once after events stop. Throttle: at most once per interval. Search → debounce; scroll/resize → throttle/rAF/IntersectionObserver.

**Debounce vs `useDeferredValue`?** Debounce reduces *how often* work runs (incl. API calls). Deferred value reduces *urgency* of a render; request count unchanged.

**How do you debounce in React correctly?** Debounce the **value** with `useDebounce` (or keep the debounced fn stable via ref/useMemo), clean up timers, keep the input itself instant, abort stale requests.

**Code splitting?** `lazy` + `Suspense` per route/heavy widget; analyze the bundle.

**How would you optimize 10,000 rows?** DOM size is the bottleneck: paginate server-side or virtualize; memoized rows with stable props; lazy images; measure.

**Where would you put URL state?** Search, filters, page, tab → search params (shareable, refresh-safe, back button).

**Protected routes secure?** No, UX only; server enforces authz on every request.

**Error boundary limits?** Doesn't catch event-handler errors, async errors, SSR, or its own errors.

**Why portals?** Escape overflow/z-index/transform; React-tree event bubbling and context still work.

**HOC vs hooks vs render props?** Hooks are the default for logic reuse; HOCs/render props for wrapping/headless cases; compound components for flexible UI APIs.

**Testing approach?** Testing Library: behavior via roles/labels, `userEvent`, `findBy` for async, MSW for network, `renderHook` for hooks.

---

## Tier 4: Internals
**Reconciliation?** Comparing new element tree with previous to compute minimal DOM changes using heuristics: different type → replace; same type → update; keys identify list items. O(n).

**What is Fiber?** React's unit of work/data structure: a linked-list tree of fibers turning recursive rendering into a pausable, resumable loop → prioritization and interruption.

**Why linked list over recursion?** Recursion state is on the JS call stack (can't pause). A pointer-based loop can yield and resume.

**`current` vs `workInProgress`?** Double buffering: screen tree vs draft; flip pointer at commit; abandoning a draft is invisible.

**Render vs commit phase?** Render: pure, may be interrupted (transitions), no DOM change. Commit: synchronous, mutates DOM, layout effects, then passive effects after paint.

**When do `useEffect` and `useLayoutEffect` run?** Layout: after DOM mutation, before paint. Passive: after paint, but flushed before paint after discrete events like clicks (React 18).

**How do Hooks work internally?** Linked list on `fiber.memoizedState`, one node per call in order; dispatcher switches between mount and update behavior.

**What is batching and what changed in 18?** Multiple updates in a tick → one render. 18 batches everywhere (promises, timeouts, native handlers).

**What are lanes?** Bitmask priorities on updates; React renders highest-priority pending lane first; starved work expires up.

**What does `useTransition` do?** Gives updates a low-priority transition lane: time-sliced, interruptible; urgent updates preempt. Doesn't speed up work.

**How does Suspense work?** Component throws a promise during render; nearest boundary shows fallback and retries when resolved. In transitions, old UI stays.

**Why can't `memo` stop Context renders?** Context propagation marks consumer fibers for update independent of props.

**What is hydration/mismatch?** Attaching React to server HTML; mismatch when first client render differs (dates, random, window checks).

**What are Server Components?** Server-only components that ship no JS; interactivity lives in `"use client"` components.

**StrictMode?** Dev-only double invocation to expose impurity and missing cleanup.

**React Compiler?** Build-time auto-memoization; doesn't fix architecture issues; requires following Rules of React.

---

## Tier 5: Senior scenarios (answer out loud first)
**500 components re-render when a sidebar toggles: investigate.**
1) Profile a production build with "why did this render". 2) Identify reason per component (state/parent/context/hook). 3) Context → memoize value, split. 4) Parent cascade → move state down, `children`, `memo` + stable props. 5) Store → select primitives/`useShallow`. 6) Re-profile; revert changes that didn't help.

**Typing in search lags.** Colocate input state; debounce committed value; abort stale requests; `useDeferredValue`/`useTransition` for heavy list; memo rows; virtualize if big.

**Design state for a multi-step checkout.** Form state local to the flow (one RHF `useForm` + `FormProvider`, or scoped reducer); cart in global store; **server owns prices/totals**; step in URL for back button; validate per step with `trigger`; submit once with double-submit protection and idempotency key.

**Teammate wraps everything in `useCallback`.** Only useful when something downstream compares identity (memo child, deps). Otherwise overhead and noise. Measure first or adopt the Compiler.

**After logout the old user's cart flashes.** Logout didn't clear store, query cache, persisted storage; in-flight requests repopulate. Cancel and clear all.

**Effect runs twice in dev.** StrictMode remount simulation; make effects resilient with cleanup.

**Structure a large React project.** Feature folders; 4 layers; TanStack Query for server state; Zustand for client-global; URL for navigation state; error + Suspense boundaries per route/widget; measure with Profiler.

**Design loading/error/caching for a listing page with 50k users.** Query cache (`staleTime`), `keepPreviousData` pagination, skeleton/error/empty states, retries with backoff, abort on param change, prefetch next page, CDN caching on server, error boundary per route.

**"React re-renders too much": argue both sides.** Re-renders are cheap by design and are the model that keeps UI correct; premature memoization costs complexity. But unbounded renders in big trees hurt INP. Decide by measuring (Profiler, long tasks).

**Frontend system design prompts:** infinite-scroll feed, autocomplete/typeahead, chat UI with optimistic send, dashboard with live updates, e-commerce checkout, notification/toast system, design-system component library. Cover: data model, state ownership, API contract & pagination, caching, loading/error/empty, a11y, perf, testing, failure modes.

---

## Tier 6: Machine-coding round (what's evaluated)
Build in 45-60 min: **state shape · component split · correctness · edge cases · a11y · clean code**.
Common tasks: Todo (CRUD, filter) · Counter with history/undo · Accordion · Tabs · Modal (portal, Esc, focus) · Star rating · Autocomplete (debounce + abort + keyboard nav) · Infinite scroll (IntersectionObserver) · Pagination · Stopwatch/Timer (cleanup) · Progress bar/stepper · Nested comments (recursion) · Image carousel · File explorer (recursive tree) · Form with validation · Tic-tac-toe · Debounce/throttle/`useFetch`/`usePrevious` implementations.
Checklist before saying "done": empty state, error state, loading state, keyboard, cleanup, no mutation, stable keys.

## Official docs for revision
- React Learn: https://react.dev/learn · Reference: https://react.dev/reference/react
- Rules of React: https://react.dev/reference/rules
- Common interview-prone pages: https://react.dev/learn/you-might-not-need-an-effect · https://react.dev/learn/preserving-and-resetting-state · https://react.dev/learn/render-and-commit

## Takeaway · Mistake · Ask yourself
- **Takeaway:** every strong answer = definition + reason + trade-off + example.
- **Mistake:** reciting definitions without the *why* or the failure mode.
- **Ask:** *Can I explain this to a mid-level dev in 60 seconds without jargon?*
