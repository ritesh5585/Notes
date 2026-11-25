# 09 · Routing (React Router)

> **Prev ←** [08-zustand](./08-zustand.md) · **Next →** [10-performance-optimization](./10-performance-optimization.md)

**Routing** = show different components for different URLs **without a page reload**. The router listens to URL changes (History API) and renders the matching route.
> React Router v7 is current; it exports from `react-router` (`react-router-dom` still re-exports). Check https://reactrouter.com for your version.

```bash
npm i react-router-dom
```

## 1. Setup
```jsx
import { BrowserRouter, Routes, Route, Link, NavLink, Outlet, Navigate } from "react-router-dom";

<BrowserRouter>
  <Routes>
    <Route element={<Layout />}>                    {/* layout route: renders <Outlet/> */}
      <Route index element={<Home />} />
      <Route path="products" element={<Products />} />
      <Route path="products/:id" element={<ProductDetails />} />
      <Route element={<Protected />}>               {/* guard as a layout route */}
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
      </Route>
      <Route path="login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
</BrowserRouter>

function Layout() {
  return (<><Header /><main><Outlet /></main><Footer /></>);   // child route renders here
}
```

## 2. Hooks and components cheat sheet
| Need | Tool |
|---|---|
| Navigate without reload | `<Link to="/cart">` (not `<a>`) |
| Active link styling | `<NavLink className={({isActive}) => …}>` |
| Read `/products/:id` | `const { id } = useParams()` |
| Navigate after logic/click | `const navigate = useNavigate(); navigate("/x")` |
| Redirect during render | `<Navigate to="/login" replace />` |
| Read/write `?q=phone&page=2` | `const [params, setParams] = useSearchParams()` |
| Current location / state passed | `useLocation()` |
| Render nested child route | `<Outlet />` |

**Memory trick:** `useNavigate` → *user did something*. `<Navigate />` → *a condition became true during render*.

## 3. URL state (search, filters, pagination)
```jsx
const [params, setParams] = useSearchParams();
const q = params.get("q") ?? "";
const page = Number(params.get("page") ?? 1);
const onSearch = (value) => setParams({ q: value, page: 1 });    // reset page when filters change
```
Why URL state: **shareable, bookmarkable, survives refresh, back button works**.

## 4. Protected route (UX gate)
```jsx
function Protected() {
  const { isAuth, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;                         // avoid flash-redirect on refresh
  if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

// after login:
const navigate = useNavigate(); const from = useLocation().state?.from?.pathname ?? "/";
navigate(from, { replace: true });
```
**Hard truth:** a protected route is **UX, not security**. The JS bundle is public; **the server must enforce authorization** on every request. Role checks (RBAC) are another UX layer + server enforcement.

## 5. Code splitting per route
```jsx
import { lazy, Suspense } from "react";
const Checkout = lazy(() => import("./pages/Checkout"));

<Route path="checkout" element={<Suspense fallback={<Spinner />}><Checkout /></Suspense>} />
```
Split **per route** first; it's the highest-leverage split.

## 6. Errors, 404, scroll
- `path="*"` = 404 page. Handle "product not found" (API 404) inside the page too.
- Wrap route elements with an Error Boundary ([12](./12-patterns-and-components.md)). Data routers have `errorElement`.
- Scroll restoration on navigation is not automatic in library mode; add `<ScrollRestoration />` (data routers) or scroll to top in an effect on `pathname`.

## 7. Modes (so you can read the docs)
| Mode | API | Gives you |
|---|---|---|
| Library / declarative | `<BrowserRouter><Routes>` | Just matching + navigation |
| Data | `createBrowserRouter` + `RouterProvider` | `loader`, `action`, `errorElement`, pending UI |
| Framework | Vite plugin | SSR, file routes, type-safe routes (Remix successor) |

If you already use TanStack Query, library mode is usually enough.

## Official docs
- React Router: https://reactrouter.com · Tutorial: https://reactrouter.com/start/library/installation
- Routing concepts: https://reactrouter.com/start/library/routing
- useSearchParams: https://reactrouter.com/api/hooks/useSearchParams · useNavigate: https://reactrouter.com/api/hooks/useNavigate
- History API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/History_API
- lazy: https://react.dev/reference/react/lazy

## Takeaway · Mistake · Ask yourself
- **Takeaway:** put anything that should survive refresh or be shareable in the URL.
- **Mistake:** treating a client route guard as security.
- **Ask:** *If someone calls the API directly, what stops them?*
