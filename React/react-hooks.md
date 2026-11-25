# React Hooks --- Deep Dive README

A practical, beginner-friendly guide to React Hooks: what they do, how
React uses them during rendering, when to use them, when **not** to use
them, optimization patterns, common mistakes, and mental models.

------------------------------------------------------------------------

## Table of Contents

1.  [What Are Hooks?](#what-are-hooks)
2.  [The React Render Model](#the-react-render-model)
3.  [Rules of Hooks](#rules-of-hooks)
4.  [`useState`](#usestate)
5.  [`useEffect`](#useeffect)
6.  [Dependency Arrays](#dependency-arrays)
7.  [Effect Cleanup](#effect-cleanup)
8.  [`useRef`](#useref)
9.  [`useMemo`](#usememo)
10. [`useCallback`](#usecallback)
11. [`useContext`](#usecontext)
12. [`useReducer`](#usereducer)
13. [`useLayoutEffect`](#uselayouteffect)
14. [`useId`](#useid)
15. [`useTransition`](#usetransition)
16. [`useDeferredValue`](#usedeferredvalue)
17. [`useImperativeHandle`](#useimperativehandle)
18. [`useDebugValue`](#usedebugvalue)
19. [`useSyncExternalStore`](#usesyncexternalstore)
20. [`useInsertionEffect`](#useinsertioneffect)
21. [Hook Comparison](#hook-comparison)
22. [Optimization Guide](#optimization-guide)
23. [Common Mistakes](#common-mistakes)
24. [How to Debug Hooks](#how-to-debug-hooks)
25. [Learning Order](#learning-order)
26. [Mental Model](#mental-model)

------------------------------------------------------------------------

# What Are Hooks?

Hooks are functions provided by React that allow function components to
use React features such as:

-   State
-   Effects
-   Refs
-   Context
-   Reducers
-   Memoization
-   Concurrent rendering features
-   External store subscriptions

Examples:

``` jsx
useState()
useEffect()
useRef()
useMemo()
useCallback()
```

The important thing is to avoid memorizing Hooks as isolated APIs.

Instead, understand the problem each Hook solves.

  Hook                     Think of it as
  ------------------------ -----------------------------------------------
  `useState`               React-managed component memory
  `useEffect`              Synchronization with an external system
  `useRef`                 A persistent mutable box
  `useMemo`                Cached calculation/value
  `useCallback`            Cached function reference
  `useContext`             Shared data access
  `useReducer`             State machine / centralized state transitions
  `useLayoutEffect`        Synchronous DOM/layout effect
  `useId`                  Stable React-generated identifier
  `useTransition`          Mark an update as non-urgent
  `useDeferredValue`       Let a value update at lower priority
  `useImperativeHandle`    Customize an exposed ref API
  `useDebugValue`          Label custom hooks in DevTools
  `useSyncExternalStore`   Safely subscribe to external stores
  `useInsertionEffect`     Library-level style insertion timing

------------------------------------------------------------------------

# The React Render Model

Before learning Hooks, understand this:

``` text
User action
    ↓
State update
    ↓
React schedules an update
    ↓
Component function runs again
    ↓
New JSX is calculated
    ↓
React compares old and new output
    ↓
DOM is updated where necessary
    ↓
Effects are synchronized
```

Example:

``` jsx
function Counter() {
    const [count, setCount] = useState(0);

    return (
        <button onClick={() => setCount(count + 1)}>
            {count}
        </button>
    );
}
```

Initial render:

``` text
count = 0
```

Click:

``` text
setCount(1)
   ↓
React schedules update
   ↓
Counter() runs again
   ↓
count = 1
   ↓
React updates button text
```

### Important

A component function running again does **not** mean the entire DOM is
recreated from scratch.

React calculates the next UI and commits only necessary DOM changes.

------------------------------------------------------------------------

# Rules of Hooks

Hooks have strict usage rules.

## Rule 1: Call Hooks at the top level

Correct:

``` jsx
function Component() {
    const [count, setCount] = useState(0);

    if (count > 5) {
        // normal JavaScript logic
    }
}
```

Incorrect:

``` jsx
function Component() {
    if (condition) {
        const [count, setCount] = useState(0);
    }
}
```

## Rule 2: Do not call Hooks inside loops

``` jsx
// ❌
for (let i = 0; i < 10; i++) {
    useState(0);
}
```

## Rule 3: Do not call Hooks inside nested functions

``` jsx
// ❌
function handleClick() {
    useState(0);
}
```

## Why?

React needs Hook calls to occur in a consistent order.

Conceptually:

``` text
Render 1

Hook #1 → useState
Hook #2 → useEffect
Hook #3 → useRef


Render 2

Hook #1 → useState
Hook #2 → useEffect
Hook #3 → useRef
```

If you conditionally insert a Hook:

``` text
Render 1

Hook #1 → useState
Hook #2 → useEffect


Render 2

Hook #1 → useState
Hook #2 → useState   ← React's expected order is broken
Hook #3 → useEffect
```

That is why Hooks must have stable call order.

------------------------------------------------------------------------

# `useState`

## What problem does it solve?

`useState` gives a component state that persists across renders.

``` jsx
const [count, setCount] = useState(0);
```

It gives:

``` text
count
  ↓
current state value

setCount
  ↓
request a state update
```

------------------------------------------------------------------------

## Basic example

``` jsx
function Counter() {
    const [count, setCount] = useState(0);

    return (
        <div>
            <p>{count}</p>

            <button onClick={() => {
                setCount(count + 1);
            }}>
                Increase
            </button>
        </div>
    );
}
```

Flow:

``` text
Initial render
    ↓
count = 0
    ↓
User clicks
    ↓
setCount(1)
    ↓
React schedules render
    ↓
Component runs again
    ↓
count = 1
    ↓
UI updates
```

------------------------------------------------------------------------

## Functional state updates

When the new state depends on previous state, prefer:

``` jsx
setCount(prev => prev + 1);
```

instead of:

``` jsx
setCount(count + 1);
```

This becomes especially important when multiple updates are queued.

Example:

``` jsx
setCount(prev => prev + 1);
setCount(prev => prev + 1);
setCount(prev => prev + 1);
```

Conceptually:

``` text
0 → 1 → 2 → 3
```

------------------------------------------------------------------------

## Objects in state

State updates should replace the object rather than mutate it.

``` jsx
const [user, setUser] = useState({
    name: "Ritesh",
    age: 21
});
```

Update:

``` jsx
setUser(prev => ({
    ...prev,
    age: 22
}));
```

Avoid:

``` jsx
// ❌
user.age = 22;
setUser(user);
```

The second approach mutates existing state and can create subtle bugs.

------------------------------------------------------------------------

## Arrays in state

Correct:

``` jsx
setItems(prev => [...prev, newItem]);
```

Remove:

``` jsx
setItems(prev =>
    prev.filter(item => item.id !== id)
);
```

Update:

``` jsx
setItems(prev =>
    prev.map(item =>
        item.id === id
            ? { ...item, completed: true }
            : item
    )
);
```

------------------------------------------------------------------------

## Where should `useState` be used?

Good uses:

-   Form fields
-   Modal open/close state
-   Tabs
-   Selected item
-   Loading state
-   Error state
-   UI preferences
-   Local component state

Example:

``` jsx
const [isOpen, setIsOpen] = useState(false);
```

------------------------------------------------------------------------

## Where should you NOT use `useState`?

Do not create state for every variable.

Bad:

``` jsx
const [fullName, setFullName] = useState("");
```

if `fullName` can simply be derived:

``` jsx
const fullName = `${firstName} ${lastName}`;
```

State should represent information that needs to persist and whose
changes should affect rendering.

------------------------------------------------------------------------

## Optimization with `useState`

Do not store redundant state.

Bad:

``` text
firstName
lastName
fullName
```

Better:

``` text
firstName
lastName
```

and derive:

``` js
const fullName = firstName + " " + lastName;
```

Fewer state variables means fewer synchronization bugs.

------------------------------------------------------------------------

# `useEffect`

## What problem does it solve?

`useEffect` is for synchronizing a component with an external system.

Examples:

-   API requests
-   WebSocket connections
-   Browser event listeners
-   Timers
-   Subscriptions
-   Third-party libraries
-   External browser APIs

Mental model:

``` text
React state/UI
     ↓
External system
     ↑
   Effect
```

------------------------------------------------------------------------

## Basic example

``` jsx
useEffect(() => {
    console.log("Effect ran");
});
```

Without dependencies, it runs after every completed render where the
effect is applicable.

------------------------------------------------------------------------

# Dependency Array

The dependency array is one of the most important concepts in React.

## No dependency array

``` jsx
useEffect(() => {
    console.log("effect");
});
```

Conceptually:

``` text
Render → Effect
Render → Effect
Render → Effect
```

Use this carefully.

------------------------------------------------------------------------

## Empty dependency array

``` jsx
useEffect(() => {
    console.log("effect");
}, []);
```

This means the effect has no reactive dependencies.

It is commonly used for setup associated with the component's lifetime.

However, in development Strict Mode, React may run setup/cleanup more
than once to expose effects that are not resilient to re-running.

Do not use "runs exactly once" as your fundamental mental model.

Think:

> "This effect does not depend on changing reactive values."

------------------------------------------------------------------------

## Dependency array with values

``` jsx
useEffect(() => {
    fetchUser(userId);
}, [userId]);
```

If:

``` text
userId = 10
```

and then remains:

``` text
userId = 10
```

the effect does not need to re-synchronize because of that dependency.

If:

``` text
10 → 20
```

React re-synchronizes the effect.

------------------------------------------------------------------------

# Why Dependencies Matter

Consider:

``` jsx
function User({ userId }) {

    useEffect(() => {
        fetch(`/api/users/${userId}`);
    }, [userId]);

}
```

The effect uses `userId`.

Therefore `userId` is a dependency.

General rule:

> If an effect reads a reactive value from the component, the effect
> usually needs to account for that value as a dependency.

This is why the React Hooks lint rules are useful.

------------------------------------------------------------------------

# Cleanup

Effects can return a cleanup function.

``` jsx
useEffect(() => {

    const handler = () => {
        console.log(window.innerWidth);
    };

    window.addEventListener("resize", handler);

    return () => {
        window.removeEventListener("resize", handler);
    };

}, []);
```

Think:

``` text
Effect setup
    ↓
External resource exists
    ↓
Dependency changes OR component is removed
    ↓
Cleanup
    ↓
New setup if required
```

------------------------------------------------------------------------

# Effect cleanup example: timer

``` jsx
useEffect(() => {

    const timer = setInterval(() => {
        console.log("tick");
    }, 1000);

    return () => {
        clearInterval(timer);
    };

}, []);
```

Without cleanup:

``` text
Component mounts
    ↓
timer created

Component removed
    ↓
timer still exists
    ↓
memory/resource leak
```

------------------------------------------------------------------------

# Effect cleanup example: WebSocket

``` jsx
useEffect(() => {

    const socket = new WebSocket(
        `wss://example.com/rooms/${roomId}`
    );

    socket.onmessage = message => {
        console.log(message.data);
    };

    return () => {
        socket.close();
    };

}, [roomId]);
```

When `roomId` changes:

``` text
old room
   ↓
cleanup
   ↓
close old socket
   ↓
new room
   ↓
create new socket
```

------------------------------------------------------------------------

# What NOT to use `useEffect` for

A very common mistake is using effects for ordinary calculations.

Bad:

``` jsx
useEffect(() => {
    setFullName(firstName + " " + lastName);
}, [firstName, lastName]);
```

Better:

``` jsx
const fullName = firstName + " " + lastName;
```

Why?

Because `fullName` is derived data, not synchronization with an external
system.

------------------------------------------------------------------------

# API requests and `useEffect`

A simple example:

``` jsx
function Products() {

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function loadProducts() {

            try {
                const response = await fetch("/api/products");
                const data = await response.json();

                setProducts(data);
            } finally {
                setLoading(false);
            }
        }

        loadProducts();

    }, []);

    if (loading) {
        return <p>Loading...</p>;
    }

    return (
        <ul>
            {products.map(product => (
                <li key={product.id}>
                    {product.name}
                </li>
            ))}
        </ul>
    );
}
```

At scale, however, data fetching often belongs in a dedicated
data-fetching library/framework rather than manually building every
concern around `useEffect`.

------------------------------------------------------------------------

# `useRef`

## What problem does it solve?

`useRef` gives you a persistent mutable object:

``` jsx
const ref = useRef(initialValue);
```

The object looks like:

``` js
{
    current: initialValue
}
```

React preserves that ref object between renders.

------------------------------------------------------------------------

## Most important difference

``` text
useState
    ↓
change value
    ↓
re-render

useRef
    ↓
change .current
    ↓
NO re-render
```

------------------------------------------------------------------------

# DOM reference

``` jsx
function SearchBox() {

    const inputRef = useRef(null);

    function focusInput() {
        inputRef.current.focus();
    }

    return (
        <>
            <input ref={inputRef} />

            <button onClick={focusInput}>
                Focus
            </button>
        </>
    );
}
```

Flow:

``` text
React renders input
    ↓
ref attached
    ↓
inputRef.current = DOM node
    ↓
button click
    ↓
inputRef.current.focus()
```

------------------------------------------------------------------------

# Store mutable values

Example:

``` jsx
const timerRef = useRef(null);
```

Then:

``` jsx
timerRef.current = setInterval(...);
```

The timer ID persists without causing rendering.

------------------------------------------------------------------------

# Previous value pattern

``` jsx
function Component({ value }) {

    const previousValue = useRef();

    useEffect(() => {
        previousValue.current = value;
    }, [value]);

    return (
        <div>
            Current: {value}
            Previous: {previousValue.current}
        </div>
    );
}
```

------------------------------------------------------------------------

# When should you use `useRef`?

Good:

-   DOM elements
-   Timer IDs
-   WebSocket instances
-   Mutable third-party objects
-   Previous values
-   Values that must persist but don't belong in UI

Do not use it as a replacement for state when the UI must update.

Bad:

``` jsx
const count = useRef(0);

count.current++;
```

if the UI needs to display the new count immediately.

Use:

``` jsx
const [count, setCount] = useState(0);
```

------------------------------------------------------------------------

# `useMemo`

## What problem does it solve?

`useMemo` caches the result of a calculation.

``` jsx
const result = useMemo(() => {
    return expensiveCalculation(data);
}, [data]);
```

Mental model:

> Remember this VALUE until dependencies change.

------------------------------------------------------------------------

## Example

``` jsx
const filteredProducts = useMemo(() => {

    return products.filter(product =>
        product.category === category
    );

}, [products, category]);
```

If neither dependency changes, React can reuse the previously calculated
value.

------------------------------------------------------------------------

# `useMemo` is NOT automatically good

Do not do:

``` jsx
const name = useMemo(() => {
    return firstName + lastName;
}, [firstName, lastName]);
```

for a trivial calculation.

You have added:

-   dependency tracking
-   extra code
-   mental overhead

for almost no performance benefit.

------------------------------------------------------------------------

# When should `useMemo` be used?

Good candidates:

-   Expensive filtering
-   Large sorting operations
-   Expensive calculations
-   Expensive derived data
-   Maintaining stable object identity when that identity matters

Example:

``` jsx
const sortedProducts = useMemo(() => {
    return [...products].sort(compareProducts);
}, [products]);
```

------------------------------------------------------------------------

# `useCallback`

## What problem does it solve?

Functions are JavaScript objects.

On every render:

``` jsx
const handleClick = () => {
    console.log("click");
};
```

creates a new function reference.

Conceptually:

``` text
Render 1 → function A
Render 2 → function B
Render 3 → function C
```

`useCallback` can preserve the reference:

``` jsx
const handleClick = useCallback(() => {
    console.log("click");
}, []);
```

Mental model:

> Remember this FUNCTION until dependencies change.

------------------------------------------------------------------------

# Why function identity matters

Consider:

``` jsx
const Child = memo(function Child({ onClick }) {
    return <button onClick={onClick}>Click</button>;
});
```

Parent:

``` jsx
function Parent() {

    const handleClick = () => {
        console.log("clicked");
    };

    return <Child onClick={handleClick} />;
}
```

Every parent render creates a new `handleClick`.

Therefore:

``` text
old function !== new function
```

The memoized child may render again because its prop changed by
reference.

Using:

``` jsx
const handleClick = useCallback(() => {
    console.log("clicked");
}, []);
```

can stabilize the callback reference.

------------------------------------------------------------------------

# `useMemo` vs `useCallback`

  Hook            Remembers
  --------------- -----------
  `useMemo`       Value
  `useCallback`   Function

Think:

``` text
useMemo
calculate → remember result

useCallback
create function → remember function
```

Conceptually:

``` jsx
useCallback(fn, deps)
```

is similar to:

``` jsx
useMemo(() => fn, deps)
```

------------------------------------------------------------------------

# When NOT to use `useCallback`

Don't wrap every function:

``` jsx
const add = useCallback(() => {
    setCount(c => c + 1);
}, []);
```

This is not automatically an optimization.

Use it when:

-   A memoized child receives the callback
-   Function identity is part of another dependency relationship
-   A profiler shows the callback identity is contributing to
    unnecessary work
-   A stable callback is required by an integration

Optimization should solve an observed or well-understood problem.

------------------------------------------------------------------------

# `useContext`

## What problem does it solve?

Context allows data to be shared with descendant components without
manually passing props through every intermediate component.

Without Context:

``` text
App
 ↓ user
Navbar
 ↓ user
Menu
 ↓ user
Avatar
```

With Context:

``` text
Provider
   ↓
Context
   ↓
Avatar
```

------------------------------------------------------------------------

## Example

Create context:

``` jsx
const UserContext = createContext(null);
```

Provider:

``` jsx
function App() {

    const user = {
        name: "Ritesh"
    };

    return (
        <UserContext.Provider value={user}>
            <Dashboard />
        </UserContext.Provider>
    );
}
```

Consume:

``` jsx
function Avatar() {

    const user = useContext(UserContext);

    return <p>{user.name}</p>;
}
```

------------------------------------------------------------------------

# When should Context be used?

Good:

-   Theme
-   Locale
-   Auth/session information
-   App-level configuration
-   Shared state for a bounded subtree

Do not automatically put everything in Context.

Context can cause many consumers to re-render when the provider value
changes.

For complex global state, consider:

-   Reducer + Context
-   External state libraries
-   Server-state/data-fetching libraries
-   More localized component state

------------------------------------------------------------------------

# `useReducer`

## What problem does it solve?

`useReducer` is useful when state transitions become complex.

``` jsx
const [state, dispatch] = useReducer(
    reducer,
    initialState
);
```

The architecture is:

``` text
UI
 ↓
dispatch(action)
 ↓
reducer
 ↓
new state
 ↓
render
```

------------------------------------------------------------------------

## Example

``` jsx
const initialState = {
    count: 0
};

function reducer(state, action) {

    switch (action.type) {

        case "increment":
            return {
                ...state,
                count: state.count + 1
            };

        case "decrement":
            return {
                ...state,
                count: state.count - 1
            };

        default:
            return state;
    }
}
```

Component:

``` jsx
function Counter() {

    const [state, dispatch] =
        useReducer(reducer, initialState);

    return (
        <>
            <p>{state.count}</p>

            <button
                onClick={() =>
                    dispatch({ type: "increment" })
                }
            >
                +
            </button>

            <button
                onClick={() =>
                    dispatch({ type: "decrement" })
                }
            >
                -
            </button>
        </>
    );
}
```

------------------------------------------------------------------------

# When should `useReducer` be used?

Good:

``` text
Many related state variables
Many state transitions
Complex business rules
Forms with many transitions
Wizards
Shopping carts
Complex UI state
```

Avoid it when:

``` text
const [isOpen, setIsOpen] = useState(false);
```

is enough.

Do not introduce a reducer just to make simple state look sophisticated.

------------------------------------------------------------------------

# `useLayoutEffect`

`useLayoutEffect` has similar semantics to `useEffect`, but it runs
synchronously after DOM mutations and before the browser paints.

Roughly:

``` text
Render
 ↓
DOM mutation
 ↓
useLayoutEffect
 ↓
Browser paint
 ↓
useEffect
```

Use it when you need to measure or synchronously adjust layout before
the user sees the result.

Example:

``` jsx
const boxRef = useRef(null);

useLayoutEffect(() => {

    const height = boxRef.current.offsetHeight;

    console.log(height);

}, []);
```

------------------------------------------------------------------------

# When should you NOT use `useLayoutEffect`?

Most effects should be `useEffect`.

Avoid unnecessary layout effects because they can delay painting.

Use:

``` text
useEffect
```

by default.

Use:

``` text
useLayoutEffect
```

when timing before paint is actually required.

------------------------------------------------------------------------

# `useId`

`useId` generates a stable unique ID that is useful for accessibility
relationships.

``` jsx
function EmailField() {

    const id = useId();

    return (
        <>
            <label htmlFor={id}>
                Email
            </label>

            <input id={id} />
        </>
    );
}
```

This connects:

``` text
label.htmlFor
      ↓
input.id
```

Do not use `useId` for:

-   Database IDs
-   Primary keys
-   Random IDs for business data
-   IDs that must come from your backend

------------------------------------------------------------------------

# `useTransition`

`useTransition` lets you mark updates as non-urgent.

``` jsx
const [isPending, startTransition] = useTransition();
```

Example:

``` jsx
function Search() {

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);

    const [isPending, startTransition] =
        useTransition();

    function handleChange(event) {

        const value = event.target.value;

        setQuery(value);

        startTransition(() => {
            setResults(searchLargeDataset(value));
        });
    }

    return (
        <>
            <input
                value={query}
                onChange={handleChange}
            />

            {isPending && <p>Updating...</p>}

            <Results results={results} />
        </>
    );
}
```

Mental model:

``` text
Urgent
 ↓
Input should remain responsive

Non-urgent
 ↓
Large result update
```

This is not the same as making the calculation itself faster.

It changes update priority.

------------------------------------------------------------------------

# `useDeferredValue`

`useDeferredValue` lets a value "lag behind" so expensive rendering can
be deprioritized.

``` jsx
const deferredQuery = useDeferredValue(query);
```

Example:

``` jsx
function Search({ query }) {

    const deferredQuery = useDeferredValue(query);

    return (
        <Results query={deferredQuery} />
    );
}
```

Mental model:

``` text
query
 ↓
updates immediately

deferredQuery
 ↓
may update later
```

Useful when:

-   Input must stay responsive
-   Rendering results is expensive
-   You want React to prioritize urgent UI work

------------------------------------------------------------------------

# `useImperativeHandle`

This is an advanced Hook.

It customizes what a parent can access through a ref.

Example:

``` jsx
const Input = forwardRef(function Input(props, ref) {

    const inputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus() {
            inputRef.current.focus();
        }
    }));

    return <input ref={inputRef} />;
});
```

Parent:

``` jsx
function Parent() {

    const inputRef = useRef(null);

    return (
        <>
            <Input ref={inputRef} />

            <button onClick={() => {
                inputRef.current.focus();
            }}>
                Focus
            </button>
        </>
    );
}
```

The parent gets the API:

``` text
inputRef.current.focus()
```

rather than necessarily receiving the raw DOM node.

Use this sparingly.

React generally encourages declarative data flow.

------------------------------------------------------------------------

# `useDebugValue`

This Hook is mainly useful when building custom Hooks.

``` jsx
function useOnlineStatus() {

    const isOnline = ...;

    useDebugValue(
        isOnline ? "Online" : "Offline"
    );

    return isOnline;
}
```

It helps React DevTools display useful information about custom Hook
state.

You generally don't need it in ordinary application components.

------------------------------------------------------------------------

# `useSyncExternalStore`

This Hook is designed for subscribing to data stores that exist outside
React.

Example use cases:

``` text
External state store
Browser APIs
Third-party state systems
Libraries that maintain their own state
```

Conceptually:

``` text
External store
      ↓
subscribe()
      ↓
React
      ↓
component render
```

A simplified shape:

``` jsx
const value = useSyncExternalStore(
    subscribe,
    getSnapshot
);
```

This is primarily useful when integrating external stores with React's
rendering model.

Most application developers won't need to call it directly unless
implementing or integrating state infrastructure.

------------------------------------------------------------------------

# `useInsertionEffect`

This is primarily intended for library authors, particularly CSS-in-JS
libraries that need to insert styles at a very specific point in React's
commit process.

You usually should not use it for ordinary application logic.

If you're building a normal React application:

``` text
Prefer useEffect
or
useLayoutEffect when layout timing requires it
```

`useInsertionEffect` is a specialized tool.

------------------------------------------------------------------------

# Hook Comparison

  ---------------------------------------------------------------------------
  Hook                     Main job               Causes render when changed?
  ------------------------ --------------------- ----------------------------
  `useState`               Component state                                Yes

  `useEffect`              External                     Effect itself doesn't
                           synchronization                    directly render

  `useRef`                 Persistent mutable                              No
                           value                 

  `useMemo`                Cache calculation                 No direct render

  `useCallback`            Cache function                    No direct render
                           reference             

  `useContext`             Read context           Consumer can re-render when
                                                              context changes

  `useReducer`             Complex state                                  Yes
                           transitions           

  `useLayoutEffect`        Pre-paint effect             Effect itself doesn't
                                                              directly render

  `useId`                  Stable ID                                       No

  `useTransition`          Mark updates            State updates still render
                           non-urgent            

  `useDeferredValue`       Defer a value         Causes relevant rendering as
                                                                value updates

  `useImperativeHandle`    Customize ref API           Depends on surrounding
                                                          ref/render behavior

  `useDebugValue`          DevTools label                                  No

  `useSyncExternalStore`   External store          Yes, when snapshot changes
                           subscription          

  `useInsertionEffect`     Style insertion                   No direct render
                           timing                
  ---------------------------------------------------------------------------

------------------------------------------------------------------------

# Optimization Guide

Optimization should follow this order:

``` text
1. Make it correct
        ↓
2. Measure the problem
        ↓
3. Identify the bottleneck
        ↓
4. Optimize the bottleneck
        ↓
5. Measure again
```

Do not begin with:

``` text
"useMemo everywhere"
"useCallback everywhere"
```

------------------------------------------------------------------------

## Optimization #1: Avoid unnecessary state

Bad:

``` jsx
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);
const [total, setTotal] = useState(0);
```

if `count` and `total` can be derived from `items`.

Better:

``` jsx
const [items, setItems] = useState([]);

const count = items.length;

const total = items.reduce(
    (sum, item) => sum + item.price,
    0
);
```

------------------------------------------------------------------------

## Optimization #2: Avoid unnecessary Effects

Effects create synchronization complexity.

Before writing:

``` jsx
useEffect(...)
```

ask:

``` text
What external system am I synchronizing with?
```

If the answer is:

``` text
"Nothing"
```

you may not need an effect.

------------------------------------------------------------------------

## Optimization #3: Memoize expensive calculations

``` jsx
const filtered = useMemo(() => {
    return hugeList.filter(expensiveFilter);
}, [hugeList, filter]);
```

But first determine whether the calculation is actually expensive.

------------------------------------------------------------------------

## Optimization #4: Stable callbacks

Use:

``` jsx
const handleDelete = useCallback(() => {
    deleteItem(id);
}, [id]);
```

when stable function identity matters.

Especially useful with:

``` jsx
const Child = memo(...);
```

But `useCallback` alone does not make a component fast.

------------------------------------------------------------------------

## Optimization #5: Memoized components

``` jsx
const ProductCard = memo(function ProductCard({
    product,
    onSelect
}) {
    // ...
});
```

Now React can skip rendering the child when its props are considered
unchanged.

This becomes much more useful when:

``` text
Parent renders frequently
+
Child is expensive
+
Child props remain stable
```

------------------------------------------------------------------------

# `useMemo` + `useCallback` + `memo`

These three are often used together.

``` text
Parent
   │
   ├── useMemo → stable calculated value
   │
   ├── useCallback → stable function
   │
   ↓
React.memo Child
```

Example:

``` jsx
function Parent({ products }) {

    const visibleProducts = useMemo(() => {
        return filterProducts(products);
    }, [products]);

    const handleSelect = useCallback((id) => {
        console.log(id);
    }, []);

    return (
        <ProductList
            products={visibleProducts}
            onSelect={handleSelect}
        />
    );
}
```

This only makes sense if the child and surrounding workload benefit from
stable references.

------------------------------------------------------------------------

# Reference Equality

This is critical for understanding optimization.

Primitive:

``` js
10 === 10 // true
```

Object:

``` js
{} === {} // false
```

Arrays:

``` js
[] === [] // false
```

Functions:

``` js
(() => {}) === (() => {}) // false
```

So:

``` jsx
const obj = {
    name: "Ritesh"
};
```

creates a new object when that code runs during a render.

That is why memoization can matter when object identity is used for
comparison.

------------------------------------------------------------------------

# Common Mistake: `useEffect` Infinite Loop

Example:

``` jsx
const [count, setCount] = useState(0);

useEffect(() => {
    setCount(count + 1);
}, [count]);
```

Flow:

``` text
count = 0
 ↓
effect
 ↓
setCount(1)
 ↓
render
 ↓
count changed
 ↓
effect
 ↓
setCount(2)
 ↓
render
 ↓
...
```

The problem isn't "useEffect is broken."

The problem is:

``` text
effect changes its own dependency
```

Sometimes this is intentional, but often it signals incorrect
synchronization design.

------------------------------------------------------------------------

# Common Mistake: Object Dependency

``` jsx
const options = {
    roomId
};

useEffect(() => {
    connect(options);
}, [options]);
```

Because `options` is created during rendering, its reference can change
on every render.

That can cause repeated effect synchronization.

Often better:

``` jsx
useEffect(() => {

    const options = {
        roomId
    };

    connect(options);

}, [roomId]);
```

Now the effect depends on the actual reactive value it needs.

------------------------------------------------------------------------

# Common Mistake: Stale Closures

Consider:

``` jsx
function Counter() {

    const [count, setCount] = useState(0);

    function logCount() {
        console.log(count);
    }

    // ...
}
```

Each render creates a new function that "sees" the values from that
render.

This is called a closure.

For example:

``` text
Render 1
count = 0
logCount sees 0

Render 2
count = 1
new logCount sees 1
```

This becomes important with:

-   Effects
-   Timers
-   Event listeners
-   Callbacks
-   Async operations

------------------------------------------------------------------------

# Common Mistake: Missing Dependencies

Bad:

``` jsx
useEffect(() => {
    fetchUser(userId);
}, []);
```

The effect uses:

``` text
userId
```

but the dependency list says:

``` text
no dependencies
```

That can cause the effect to keep using an old value when `userId`
changes.

Think about effects as synchronization relationships.

------------------------------------------------------------------------

# Common Mistake: Using Ref for UI State

Bad:

``` jsx
const isOpen = useRef(false);

function open() {
    isOpen.current = true;
}
```

If the UI needs to respond:

``` jsx
{isOpen.current && <Modal />}
```

changing `.current` won't cause a render.

Use:

``` jsx
const [isOpen, setIsOpen] = useState(false);
```

------------------------------------------------------------------------

# Common Mistake: Using State for Everything

Don't do:

``` jsx
const [inputRef, setInputRef] = useState(null);
```

when you need a DOM reference.

Use:

``` jsx
const inputRef = useRef(null);
```

------------------------------------------------------------------------

# Common Mistake: Memoizing Everything

Bad mindset:

``` text
Every calculation → useMemo
Every function → useCallback
Every component → memo
```

Better:

``` text
Is there a real performance problem?
        ↓
What causes it?
        ↓
What is expensive?
        ↓
What identity changes unnecessarily?
        ↓
Choose the smallest optimization.
```

------------------------------------------------------------------------

# How to Debug Hooks

When something goes wrong, don't randomly add Hooks.

Follow the data.

## Step 1: Identify the render

Add:

``` jsx
console.log("Component rendered");
```

Ask:

``` text
Why did this component render?
```

------------------------------------------------------------------------

## Step 2: Inspect state

``` jsx
console.log({
    count,
    user,
    selectedId
});
```

Ask:

``` text
Which value changed?
```

------------------------------------------------------------------------

## Step 3: Inspect effect dependencies

``` jsx
useEffect(() => {
    console.log("effect");
}, [userId, filter]);
```

Ask:

``` text
Which dependency changed?
```

------------------------------------------------------------------------

## Step 4: Check object/function identity

For objects:

``` js
console.log(previous === current);
```

For callbacks:

``` js
console.log(previousCallback === currentCallback);
```

If identity changes unexpectedly, investigate:

``` text
new object?
new array?
new function?
```

------------------------------------------------------------------------

## Step 5: Check cleanup

If an effect behaves strangely:

``` jsx
useEffect(() => {

    console.log("setup");

    return () => {
        console.log("cleanup");
    };

}, [dependency]);
```

You can visualize:

``` text
setup
cleanup
setup
cleanup
```

This often immediately reveals effect lifecycle problems.

------------------------------------------------------------------------

# Hooks at Different Scales

## Small application

``` text
useState
useEffect
useRef
```

may handle most needs.

------------------------------------------------------------------------

## Medium application

You may add:

``` text
useContext
useReducer
useMemo
useCallback
```

plus dedicated data-fetching/state libraries.

------------------------------------------------------------------------

## Large application

You need to think beyond Hooks:

``` text
Component state
       +
Context
       +
Reducers
       +
External stores
       +
Server state
       +
Caching
       +
Rendering performance
       +
Network architecture
       +
Component boundaries
```

Hooks are only one layer of the system.

------------------------------------------------------------------------

# A Practical Ecommerce Example

Imagine an ecommerce product page:

``` text
ProductPage
│
├── product state
│
├── quantity state
│
├── selected variant
│
├── API synchronization
│
├── image DOM reference
│
├── calculated total
│
└── add-to-cart callback
```

Possible Hook choices:

``` jsx
const [product, setProduct] = useState(null);

const [quantity, setQuantity] = useState(1);

const [variant, setVariant] = useState(null);

const imageRef = useRef(null);

const total = useMemo(() => {
    return (product?.price ?? 0) * quantity;
}, [product, quantity]);

const addToCart = useCallback(() => {
    // add product
}, [product, quantity, variant]);

useEffect(() => {
    // synchronize with product API
}, [productId]);
```

Now understand the architecture:

``` text
                    ProductPage
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       useState       useEffect       useRef
          │              │              │
       UI state      API sync        DOM access
          │
          ↓
       useMemo
          │
     derived value
          │
          ↓
     useCallback
          │
     stable handler
          │
          ↓
          UI
```

This is the correct way to think about Hooks.

------------------------------------------------------------------------

# Custom Hooks

Once you understand Hooks, you can create your own.

A custom Hook is just a function whose name starts with `use` and which
can compose Hooks.

Example:

``` jsx
function useOnlineStatus() {

    const [isOnline, setIsOnline] =
        useState(navigator.onLine);

    useEffect(() => {

        function handleOnline() {
            setIsOnline(true);
        }

        function handleOffline() {
            setIsOnline(false);
        }

        window.addEventListener(
            "online",
            handleOnline
        );

        window.addEventListener(
            "offline",
            handleOffline
        );

        return () => {
            window.removeEventListener(
                "online",
                handleOnline
            );

            window.removeEventListener(
                "offline",
                handleOffline
            );
        };

    }, []);

    return isOnline;
}
```

Use it:

``` jsx
function Status() {

    const isOnline = useOnlineStatus();

    return (
        <p>
            {isOnline ? "Online" : "Offline"}
        </p>
    );
}
```

Architecture:

``` text
Component
   ↓
Custom Hook
   ↓
useState + useEffect
   ↓
Browser events
```

Custom Hooks are mainly about **reusing stateful logic**, not sharing
state itself.

------------------------------------------------------------------------

# Hook Decision Tree

When you need something, ask:

``` text
Do I need a value to persist between renders?
        │
        ├── No → normal variable
        │
        └── Yes
             │
             ├── Should changing it update UI?
             │       │
             │       ├── Yes → useState / useReducer
             │       │
             │       └── No → useRef
             │
             └── Is it derived from other values?
                     │
                     ├── Cheap → calculate normally
                     │
                     └── Expensive → consider useMemo
```

For an external system:

``` text
Do I need to synchronize with something outside React?
        │
        ├── Yes → useEffect
        │
        └── No → probably don't need an Effect
```

For functions:

``` text
Does function identity matter?
        │
        ├── Yes → consider useCallback
        │
        └── No → normal function
```

For shared state:

``` text
Do many descendants need the same value?
        │
        ├── Yes → consider Context
        │
        └── No → keep state local
```

For complex state:

``` text
Many related transitions?
        │
        ├── Yes → useReducer
        │
        └── No → useState
```

------------------------------------------------------------------------

# Learning Order

Do not learn Hooks in random order.

Follow this sequence:

``` text
1. React rendering
        ↓
2. useState
        ↓
3. Re-rendering
        ↓
4. useEffect
        ↓
5. Dependency arrays
        ↓
6. Cleanup
        ↓
7. Closures
        ↓
8. useRef
        ↓
9. useContext
        ↓
10. useReducer
        ↓
11. Reference equality
        ↓
12. React.memo
        ↓
13. useMemo
        ↓
14. useCallback
        ↓
15. useTransition
        ↓
16. useDeferredValue
        ↓
17. Advanced Hooks
        ↓
18. Custom Hooks
```

Do not jump directly to:

``` text
useMemo
useCallback
```

if you don't understand rendering and reference equality.

Otherwise you'll memorize optimization patterns without understanding
why they work.

------------------------------------------------------------------------

# Interview Cheat Sheet

## `useState`

> Allows a component to store state that persists across renders.
> Updating state schedules a re-render.

## `useEffect`

> Synchronizes a component with external systems. Dependencies determine
> when React needs to re-synchronize it, and cleanup reverses the setup.

## `useRef`

> Stores a mutable value that persists across renders without causing a
> re-render when changed.

## `useMemo`

> Caches a calculated value between renders until its dependencies
> change.

## `useCallback`

> Caches a function reference between renders until its dependencies
> change.

## `useContext`

> Reads a value from a Context provider without passing it through
> intermediate components.

## `useReducer`

> Manages state through explicit actions and a reducer, making complex
> state transitions easier to organize.

## `useLayoutEffect`

> Runs an effect synchronously after DOM mutations but before the
> browser paints.

## `useId`

> Generates stable unique IDs useful for associating related DOM
> elements such as labels and inputs.

## `useTransition`

> Marks state updates as non-urgent so React can prioritize more urgent
> interactions.

## `useDeferredValue`

> Lets a value update at lower priority so urgent UI work can remain
> responsive.

------------------------------------------------------------------------

# The Most Important Mental Model

Do not memorize:

``` text
useState = state
useEffect = API
useRef = DOM
useMemo = optimization
useCallback = optimization
```

That's too shallow.

Instead:

``` text
                  React
                    │
                    ↓
                RENDER
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
       STATE       REF      CONTEXT
          │
          ↓
         JSX
          │
          ↓
        COMMIT
          │
          ↓
      External sync
          │
          ↓
       EFFECTS
```

And think about each Hook as a different question:

``` text
useState
"React, remember this UI state."

useReducer
"React, manage these state transitions through actions."

useRef
"React, remember this mutable value without rendering."

useEffect
"React, synchronize this component with the outside world."

useMemo
"React, remember this calculated value."

useCallback
"React, remember this function."

useContext
"React, give me shared data from above."

useLayoutEffect
"React, I need this effect before paint."

useTransition
"React, this update can wait."

useDeferredValue
"React, this value doesn't need to update urgently."

useId
"React, give me a stable identifier."
```

------------------------------------------------------------------------

# Final Mental Model

The most useful React Hook model is:

``` text
                    USER
                     │
                     ↓
                  ACTION
                     │
                     ↓
              STATE UPDATE
                     │
                     ↓
                RE-RENDER
                     │
             ┌───────┴───────┐
             ↓               ↓
        COMPONENT          HOOKS
          LOGIC              │
             │          ┌────┼─────┐
             │          ↓    ↓     ↓
             │        state ref  memo
             │
             ↓
             JSX
             │
             ↓
           COMMIT
             │
             ↓
        Browser UI
             │
             ↓
         useEffect
             │
             ↓
      External systems
```

If you can trace **data → render → state update → re-render → effect →
cleanup**, you understand React Hooks.

If you only remember Hook definitions, you don't yet understand them.

The next level is to build a small React application and deliberately
use `useState`, `useEffect`, `useRef`, `useMemo`, and `useCallback`,
then debug why each one runs. That is where the concepts become real.
