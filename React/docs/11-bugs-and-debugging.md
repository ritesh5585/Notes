# 11 · Bug Catalog & Debugging Method

> **Prev ←** [10-performance](./10-performance-optimization.md) · **Next →** [12-patterns-and-components](./12-patterns-and-components.md)

## 1. Debugging method
```
SYMPTOM → HYPOTHESIS → EVIDENCE → ROOT CAUSE → FIX → VERIFY
```
Don't add a Hook hoping it works. **Trace the chain** `event → state update → render → commit → effect → cleanup` and find the broken link.

**The one question for re-render bugs: "Which reference changed?"**

```js
10 === 10                  // true  (primitives compare by value)
{} === {}                  // false (objects compare by reference)
(() => {}) === (() => {})  // false
```
Where React compares by `Object.is`:
| Where | If reference changed |
|---|---|
| `setState(next)` vs current | same ref → may skip render |
| `React.memo` props | any changed → child renders |
| Hook deps array | any changed → effect/memo re-runs |
| Context `value` | changed → all consumers render |
| Zustand/store selector result | changed → component renders |

**Toolkit**
- React DevTools **Components**: live props/state/hooks/context.
- **Profiler**: what rendered, how long, why.
- "Highlight updates when components render."
- `console.log("render")` at top of component; log in effect **setup and cleanup**.
- `console.log(prev === next)` for identity.
- **Network tab**: is the request sent? what returned? **Performance tab**: long tasks (>50 ms).

## 2. Symptom → Cause → Fix

### "I changed state but UI didn't update"
```jsx
items.push(x); setItems(items);          // ❌ same reference
setItems(prev => [...prev, x]);          // ✅
```
### "Counter only goes up by 1"
`setCount(count+1)` ×2 uses the same snapshot → `setCount(c => c + 1)`.

### "Effect runs forever"
```jsx
useEffect(() => { setCount(count + 1); }, [count]);   // writes its own trigger
```
Also: object/array/function in deps recreated each render → depend on primitives, build the object inside the effect.

### "Effect uses an old value" (stale closure)
```jsx
useEffect(() => { fetchUser(userId); }, []);    // userId missing → captured first value forever
```
Include `userId`. Trust `exhaustive-deps`. Snapshot rule: each render's functions close over **that render's** values.
```jsx
function handleClick() {
  setCount(count + 1);
  setTimeout(() => alert(count), 3000);   // alerts the count of THIS render
}
```
### "Fires twice in dev"
StrictMode: setup → cleanup → setup. Fix the cleanup; don't remove StrictMode.

### "Old search results overwrite new ones" (race)
Abort or ignore stale responses ([05](./05-axios-and-data-fetching.md)).

### "Typing lags the whole page"
Input state lives in a parent that renders a big list. Colocate; debounce; transition; memo rows ([10](./10-performance-optimization.md)).

### "Theme toggle re-renders everything"
Inline Provider `value` or one giant context. `useMemo` the value, split contexts ([07](./07-context-api.md)).

### "State resets when it shouldn't"
Component defined **inside** another component → new type each render → state wiped. Define at module level.

### "State doesn't reset when it should"
Same type at same position keeps state. Force reset: `<ProfileForm key={userId} />`.

### "Inputs show text in wrong rows after delete"
`key={index}` on stateful rows. Use stable ids.

### "Rendered more hooks than previous render"
Conditional Hook. Hooks at top; put the condition inside/after them.

### "`{count && <Badge/>}` prints 0"
`{count > 0 && <Badge/>}`.

### "Memoized child still re-renders"
Inline `{}`/`()=>{}` props, or it also reads context, or parent passes new array from `.map/.filter`.

### "Hydration mismatch"
Server HTML ≠ client first render: `Date.now()`, `Math.random()`, `window`/`localStorage` in render, locale formatting. Render same thing first, then update in an effect.

### "Cannot update state on unmounted component / leaks"
Missing cleanup (timers, listeners, requests). Return a cleanup.

### "After logout, previous user's data flashes"
Logout didn't clear store, query cache, persisted storage, and in-flight requests.

## 3. Re-render cheat sheet
| Why did it re-render? | Fix, cheapest first |
|---|---|
| Own state changed, only part of UI needs it | Split component; move state down |
| Parent rendered, props identical | `memo`; `children` pattern; move state down |
| Parent rendered, props changed by reference | Hoist constants; `useCallback`/`useMemo`; pass primitives |
| Context value changed | Memoize value; split contexts; use a store with selectors |
| Store selector returns new reference | Select primitives; `useShallow`/`createSelector` |
| Unstable key (`Math.random()`) | Stable ids |
| Effect sets state in a loop | Remove effect; fix deps; derive instead |
| It *should* render but is slow | Cheaper render; virtualize; lower priority (transition) |

## 4. Worked scenarios
**Cart badge wrong after remove**
1. Hypothesis: state mutated or two sources of truth. 2. Evidence: Components tab → `items` right, `count` (separate state) stale. 3. Root: `count` stored separately. 4. Fix: derive from `items`. 5. Verify add/remove/clear.

**Product page fetches forever**
1. Hypothesis: effect re-triggers itself. 2. Evidence: Network shows a request every ~50 ms; deps contain an object built each render. 3. Root: `[filters]` where `filters = { category }`. 4. Fix: depend on `category` / memoize. 5. Verify single request.

**Whole app re-renders on theme toggle**
1. Hypothesis: context value is new each Provider render. 2. Evidence: Profiler "Context changed"; `value === prev` is false. 3. Root: `value={{ theme, setTheme }}`. 4. Fix: `useMemo` + split contexts.

**Click freezes UI 400 ms**
Performance tab → long task → what ran inside. Levers: **reduce work**, **split work**, **lower priority**.

## 5. Quick checklist
1. Is it rendering at all? (log in component)
2. Which state/props changed?
3. Which effect deps changed, and should they?
4. Identity check `prev === next`.
5. Cleanup check: log setup + cleanup order.
6. Network: sent? response? cancelled?

## Official docs
- React DevTools: https://react.dev/learn/react-developer-tools
- Keeping components pure: https://react.dev/learn/keeping-components-pure
- Preserving and resetting state: https://react.dev/learn/preserving-and-resetting-state
- Synchronizing with Effects (cleanup, StrictMode): https://react.dev/learn/synchronizing-with-effects
- Chrome DevTools Performance: https://developer.chrome.com/docs/devtools/performance
- Hydration errors: https://react.dev/reference/react-dom/client/hydrateRoot

## Takeaway · Mistake · Ask yourself
- **Takeaway:** most bugs = wrong owner of state, stale closure, or changed reference.
- **Mistake:** patching the symptom (add `useMemo`, add `useEffect`) without locating the broken arrow.
- **Ask:** *What caused this render, and which reference changed?*
