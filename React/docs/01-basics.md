# 01 · React Basics: The Mental Model

> **Goal:** after this file you can explain *what React is doing* and write small apps without guessing.
> **Next →** [02-hooks.md](./02-hooks.md)

---

## 0. The one loop (remember this, everything else is a detail)

```
User does something (event)
        ↓
State changes
        ↓
React calls your components again (render)
        ↓
React compares old vs new output and updates ONLY the differences in the DOM (commit)
        ↓
Browser paints → user sees result → does something again
```

> *"React sirf state change par react karta hai."*

| Word | Plain meaning | Picture |
|---|---|---|
| Component | Reusable UI piece, a function that returns JSX | LEGO brick |
| JSX | HTML-looking syntax inside JS | Brick's blueprint |
| Props | Read-only inputs from parent | Order slip to a chef |
| State | Component's memory that triggers re-render | Whiteboard in the kitchen |
| Event | User action (click, type) | Customer rings the bell |
| Render | React *calls your function* to ask "what should the UI be now?" | Chef re-reads slip + whiteboard |

---

## 1. Why React exists

Cart count shows in header, product page, cart page. In plain JS you update every place by hand; forget one and the UI contradicts itself.

```js
// Imperative: YOU do the bookkeeping
cart.push(item);
document.querySelector("#header-count").textContent = cart.length;
renderCartPage();          // forgot another place? bug.
```
```jsx
// Declarative: describe the UI for the current data, React syncs it
function Header({ cartCount }) { return <span>Cart: {cartCount}</span>; }
```

**UI = f(state).** Bugs change from "I forgot to update X" to "my description of X was wrong".
> Wrong reasons: "plain JS can't update DOM", "DOM is slow". Real reason: keeping a big changing UI consistent without human bookkeeping.

---

## 2. How an app starts

```
JSX + imports + npm packages → (Vite + Babel/SWC) → plain JS bundle → browser runs → React builds the page
```
- `react` = components, hooks (platform-independent). `react-dom` = talks to the browser DOM.
- CRA is deprecated. Use **Vite** (SPA) or **Next.js / React Router framework mode** (SSR).

```bash
npm create vite@latest my-app -- --template react
cd my-app && npm install && npm run dev
```
```html
<!-- index.html: the only HTML page -->
<div id="root"></div>
```
```jsx
// main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode><App /></StrictMode>
);
```
**SPA** = one HTML page, JS swaps content (no reload). **MPA** = new HTML per page.

---

## 3. Components

A component is a **function that returns JSX** (or `null`).

```jsx
function ProductCard() {
  return (
    <div className="card">
      <h3>Wireless Headphones</h3>
      <p>$59</p>
    </div>
  );
}

<ProductCard><ProductCard />   {/* reuse like an HTML tag */}
```

**Rules**
1. Name starts with **Capital** (lowercase = HTML tag to React).
2. Return **one root** (`<div>` or Fragment `<>…</>`).
3. **Never define a component inside another component**: new function identity each render → React treats it as a new type → state is destroyed.
4. Keep it **pure**: same props/state → same JSX. No mutating outside variables, no fetch, no `Math.random()` in the render body.
5. Classes (`extends React.Component`) = legacy. New code: functions + Hooks.

Component tree (data flows **down**):
```
App
├── Header → Logo, SearchBar, CartIcon
├── ProductGrid → ProductCard × N
└── Footer
```

---

## 4. JSX

JSX is **sugar** for a function call that returns a plain object (a *React element*): `{ type: "h1", props: { className: "title", children: "Hi" } }`. It's a description, not a DOM node.

| HTML | JSX |
|---|---|
| `class` | `className` |
| `for` | `htmlFor` |
| `onclick="..."` | `onClick={fn}` |
| `<img>` | `<img />` (close every tag) |
| `style="color:red"` | `style={{ color: "red" }}` |

`{}` = JavaScript **expression** goes here (no `if`/`for` statements).

```jsx
{isLoggedIn ? <Profile /> : <LoginButton />}      // either/or
{items.length > 0 && <CartBadge />}                // ✅
{items.length && <CartBadge />}                    // ❌ renders "0" when empty
```

### Lists + keys
```jsx
<ul>
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</ul>
```
- `map` (returns elements), not `forEach` (returns nothing).
- `key` = identity across renders. **Stable unique id.** Index only for static lists (never reorder/insert/delete), otherwise state sticks to wrong rows.
- `key` is not a prop; the child can't read it.

---

## 5. Props

Props = inputs, parent → child. Like function parameters.

```jsx
<ProductCard title="Headphones" price={59} inStock />

function ProductCard({ title, price, inStock = true }) {
  return (
    <div>
      <h3>{title}</h3><p>${price}</p>
      {!inStock && <span>Sold out</span>}
    </div>
  );
}
```
**Three laws:** read-only · one-way (parent → child) · can be anything, including **functions**.

### `children` = composition
```jsx
function Card({ children }) { return <div className="card">{children}</div>; }
<Card><h2>Anything here</h2></Card>
```

### Child talks back = lift state up + pass a function
```jsx
function App() {
  const [cart, setCart] = useState([]);
  const addToCart = (p) => setCart(prev => [...prev, p]);   // owner holds data + changer
  return <ProductCard product={p} onAdd={addToCart} />;
}
function ProductCard({ product, onAdd }) {
  return <button onClick={() => onAdd(product)}>Add</button>;
}
```
Put state in the **closest common parent** of everyone who needs it.

### Prop drilling
`App → Layout → Sidebar → Menu → MenuItem` where only `MenuItem` needs `user`. Fix ladder: **composition (`children`) → Context ([07](./07-context-api.md)) → store ([08](./08-zustand.md))**.

| | Props | State |
|---|---|---|
| Owner | parent | the component |
| Can this component change it? | no | yes, via setter |
| Purpose | configure | remember changing data |

---

## 6. Events

```jsx
<button onClick={handleClick}>        // ✅ pass the function
<button onClick={handleClick()}>      // ❌ calls it during render
<button onClick={() => add(id)}>      // ✅ wrap when you need arguments
```
- Handler gets an event: `e.target.value`, `e.preventDefault()` (stop form reload).
- React wraps native events (SyntheticEvent) and uses **event delegation** (one listener at the root).

---

## 7. State (`useState`)

### Why a normal variable fails
```jsx
function Counter() {
  let count = 0;
  return <button onClick={() => { count++; console.log(count); }}>Clicked {count}</button>;
}
// console: 1,2,3 but button shows 0
```
1. React doesn't know the variable changed (no re-render).
2. Even if it re-rendered, the function re-runs and resets `count = 0`.

State lives **outside** the function call (React stores it) and **tells React to re-render**.

```jsx
const [count, setCount] = useState(0);
//     value  setter       initial (used on first render only)
<button onClick={() => setCount(count + 1)}>Clicked {count}</button>
```

### What the setter does
```
setCount(1) → React is told "state changed" → schedules re-render (variable NOT changed now)
→ function runs again, useState returns 1 → new JSX → screen updates
```
**Each render is a snapshot.** `setCount(count+1); console.log(count)` logs the old value.

### Three rules
```jsx
// 1. Depend on previous value → updater function
setCount(c => c + 1); setCount(c => c + 1);          // +2   (count+1 twice = +1)

// 2. Never mutate; create new copies (React compares references)
setUser(u => ({ ...u, age: 22 }));
setItems(p => [...p, item]);                          // add
setItems(p => p.filter(i => i.id !== id));            // remove
setItems(p => p.map(i => i.id === id ? { ...i, done: true } : i));   // update
// ❌ items.push(x); setItems(items);  → same reference, React skips

// 3. Don't store what you can compute
const total = items.reduce((s, i) => s + i.price * i.qty, 0);   // ✅ derived
```
Lazy initial value (expensive init runs once): `useState(() => JSON.parse(localStorage.getItem("x")))`.

### Where should state live?
```
One component uses it          → local useState
Siblings share it              → lift to common parent
Deep tree, changes rarely      → Context (07)
Many unrelated places, frequent → Zustand (08)
Comes from a server            → TanStack Query (05)
Should survive refresh/share   → URL (09)
Computable from other state    → don't store it
```

---

## 8. Rendering: trigger → render → commit

```
1. TRIGGER   state change / parent rendered / context changed
2. RENDER    React calls your functions → new JSX (pure, no DOM touched)
3. COMMIT    React diffs vs previous and applies ONLY differences to the real DOM
            ↓
   Browser paints (not React's job)
```
- **Render ≠ DOM update ≠ paint.**
- Children re-render when the parent renders (default). Props "changing" matters only for `memo` ([10](./10-performance-optimization.md)).
- **Batching:** many `setState` in one event → one re-render.
- **StrictMode (dev only):** runs components/effects twice to expose impure code and missing cleanup.

### Story: "Add to cart" click
```
click → onClick → setCart(...) → schedule render → components re-run
→ diff (reconciliation) → commit: only the badge text changes → paint → effects run
```

---

## 9. Forms: controlled vs uncontrolled

```jsx
// Controlled: React state = single source of truth
const [name, setName] = useState("");
<input value={name} onChange={e => setName(e.target.value)} />

// Uncontrolled: DOM holds value, read via ref when needed
const ref = useRef(null);
<form onSubmit={e => { e.preventDefault(); console.log(ref.current.value); }}>
  <input ref={ref} defaultValue="" />
</form>
```
Real forms: **react-hook-form + zod** → [06](./06-forms-react-hook-form.md).

---

## 10. Mini project (type this from memory later)

```jsx
import { useState } from "react";

export default function Todos() {
  const [text, setText] = useState("");
  const [todos, setTodos] = useState([]);

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setTodos(p => [...p, { id: crypto.randomUUID(), text, done: false }]);
    setText("");
  };
  const toggle = (id) => setTodos(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id) => setTodos(p => p.filter(t => t.id !== id));
  const left = todos.filter(t => !t.done).length;          // derived

  return (
    <form onSubmit={add}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Add todo" />
      <button>Add</button>
      <ul>
        {todos.map(t => (
          <li key={t.id}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
            <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            <button type="button" onClick={() => remove(t.id)}>x</button>
          </li>
        ))}
      </ul>
      <p>{left} left</p>
    </form>
  );
}
```

---

## 11. Glossary

| Term | Meaning |
|---|---|
| React element | Plain object describing UI |
| Reconciliation | Diffing old vs new element trees |
| Virtual DOM | The description tree React diffs (not literally a DOM copy) |
| Lifting state up | Move state to a shared parent |
| Prop drilling | Passing props through components that don't use them |
| Controlled input | Input whose value lives in state |
| Derived state | Value computed from other state during render |
| Hydration | Attaching React to server-rendered HTML |

---

## Official docs
- Learn React: https://react.dev/learn
- Describing the UI: https://react.dev/learn/describing-the-ui
- State as a snapshot: https://react.dev/learn/state-as-a-snapshot
- Queueing updates: https://react.dev/learn/queueing-a-series-of-state-updates
- Updating objects/arrays: https://react.dev/learn/updating-objects-in-state
- Render and commit: https://react.dev/learn/render-and-commit
- Keeping components pure: https://react.dev/learn/keeping-components-pure
- Vite guide: https://vite.dev/guide/

## Takeaway · Mistake · Ask yourself
- **Takeaway:** event → state → render → minimal DOM update. Every concept is one arrow of this loop.
- **Mistake:** reaching for `useEffect`/`useMemo`/global store before asking if props, derived values or local state would do.
- **Ask:** *Who owns this data, and what makes the screen change when it changes?*
