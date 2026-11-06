# 02 — Dockerfile & Images

> Goal: write a good Dockerfile, understand **layers and cache**, ship small and safe images.
> ← [01 Basics](./01-docker-basics.md) · Next → [03 Volumes, networking, Compose](./03-volumes-networking-compose.md)

---

## 1. What is an image, really?

An image is a **stack of read-only layers**. Each Dockerfile instruction (mostly `RUN`, `COPY`, `ADD`) creates a layer.

```text
┌───────────────────────────┐  ← your source code (changes often)
├───────────────────────────┤  ← npm ci result (changes sometimes)
├───────────────────────────┤  ← package.json copy
├───────────────────────────┤  ← Node.js runtime
└───────────────────────────┘  ← base OS (alpine/debian)

At run time Docker adds ONE thin writable layer on top → that's the container.
```

**Why layers?**
1. **Cache:** unchanged layers are reused → fast rebuilds.
2. **Sharing:** 10 images based on `node:22-alpine` store that base only once.
3. **Fast pulls:** only missing layers are downloaded.

---

## 2. A first Dockerfile (Node API)

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t my-api:1.0 .
docker run -d --name my-api -p 3000:3000 my-api:1.0
```

### Reading `docker build -t my-api:1.0 .`

| Part | Meaning |
|---|---|
| `docker build` | Build an image |
| `-t my-api:1.0` | **t**ag = name:version |
| `.` | **Build context**: the folder whose files Docker may `COPY`. It is sent to the daemon, so keep it small (see `.dockerignore`) |
| `-f path/Dockerfile` | Use a Dockerfile with another name/location |
| `--no-cache` | Ignore cache, rebuild everything |
| `--build-arg KEY=val` | Pass an `ARG` |
| `--target runner` | Build only up to a named stage |
| `--platform linux/amd64` | Build for a CPU type |

---

## 3. Every instruction, with why

| Instruction | What it does | Why / notes |
|---|---|---|
| `FROM image:tag` | Start from a base image | Pick a small, official, **pinned** image |
| `WORKDIR /app` | Set (and create) the working folder | Avoids `cd` and long paths |
| `COPY src dest` | Copy files from build context | Prefer `COPY` over `ADD` |
| `ADD` | Like COPY + can fetch URLs / unpack tar | Surprising behaviour — avoid unless you need it |
| `RUN cmd` | Run a command **at build time** and save the result as a layer | Install packages, build the app |
| `ENV K=V` | Env var in image (build + runtime) | Non-secret defaults only |
| `ARG K` | Build-time variable | Not available at runtime |
| `EXPOSE 3000` | Documents the port | Does **not** publish it |
| `USER node` | Run following steps/process as this user | **Do not run as root** |
| `CMD [...]` | Default command when the container starts | Can be overridden at `docker run` |
| `ENTRYPOINT [...]` | Fixed executable; `CMD` becomes its default args | Use for "this image is a tool" |
| `HEALTHCHECK` | Command Docker runs to see if the app is healthy | Enables `healthy/unhealthy` status |
| `VOLUME` | Declares a mount point | Usually better to handle volumes at run time/Compose |

### RUN vs CMD (very common confusion)

```text
RUN  → executes while BUILDING the image   (npm ci, npm run build)
CMD  → executes when the CONTAINER STARTS  (node server.js)
```

### Exec form vs shell form

```dockerfile
CMD ["node", "server.js"]     # exec form  ✅ process = PID 1, receives stop signals
CMD node server.js            # shell form ❌ wrapped in /bin/sh -c; signals may not reach node
```

Why it matters: when you `docker stop`, Docker sends **SIGTERM** to PID 1. If your app isn't PID 1 (or ignores signals), it gets force-killed after 10 s and **in-flight requests are cut**. Also: `CMD ["npm","start"]` adds npm in between, which often doesn't forward signals — prefer `CMD ["node","server.js"]`.

---

## 4. Layer caching — the most useful trick

```dockerfile
COPY package*.json ./     # 1. only the dependency list
RUN npm ci                # 2. install (slow)
COPY . .                  # 3. now copy your code (changes constantly)
```

```text
You edit one source file
      │
      ▼
Layer 1 (package*.json)  unchanged → CACHED
Layer 2 (npm ci)         unchanged → CACHED   ← saves minutes
Layer 3 (COPY . .)       changed   → rebuilt
```

**What if you wrote `COPY . .` first?** Every code edit would invalidate the cache for `npm ci` — slow rebuilds every time.

Rule: **put things that change rarely at the top, things that change often at the bottom.**

---

## 5. `.dockerignore` — don't ship junk

Create `.dockerignore` next to the Dockerfile:

```text
node_modules
.next
dist
coverage
.git
.env
.env.*
Dockerfile
docker-compose*.yml
compose*.yaml
*.log
```

Why:
- **Speed:** a huge build context (`node_modules`, `.git`) is sent on every build.
- **Correctness:** host `node_modules` (Windows binaries) can overwrite the Linux ones installed in the image.
- **Security:** `.env` with secrets must never be copied into an image.

---

## 6. Choosing a base image

| Base | Size | Pros | Cons |
|---|---|---|---|
| `node:22` (Debian) | Large | Most compatible, many tools | Big, more attack surface |
| `node:22-slim` | Medium | Debian, minimal | Fewer tools |
| `node:22-alpine` | **Small** | Tiny | Uses **musl** libc → some native modules (e.g. certain image/crypto libs) behave differently or need extra packages |
| Distroless | Very small | No shell/package manager → safer | Harder to debug (no shell) |

Beginner advice: start with **alpine**; if a native dependency fails, switch to **slim**.

Pin the version: `node:22-alpine` is better than `node:alpine` or `node:latest`. For even stricter reproducibility pin a digest (`node@sha256:…`).

---

## 7. Multi-stage builds — small, safe production images

**Problem:** building an app needs compilers, dev dependencies, source code. Running it needs only the output. If you ship everything, the image is huge and exposes tools an attacker could use.

**Fix:** use several `FROM` stages; copy only results into the final stage.

```dockerfile
# Stage 1: install + build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: run (small)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

```text
builder stage (big, thrown away)  ──copy only dist/──▶  runner stage (small, shipped)
```

### Production Dockerfile for a Next.js app (Slatex-style)

1. In `next.config.ts` enable the small standalone output:

```ts
const nextConfig = { output: "standalone" };
export default nextConfig;
```

2. Dockerfile:

```dockerfile
# 1) install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2) build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) run
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Notes:
- `HOSTNAME=0.0.0.0` makes Next listen on all interfaces (otherwise port mapping may fail).
- If you use **Prisma**, run `npx prisma generate` in the build stage and make sure the right engine/OpenSSL is present on alpine.
- `NEXT_PUBLIC_*` variables are baked at **build** time (`ARG`/`ENV` before `npm run build`).
- Secrets like `GITHUB_TOKEN` are read at **runtime** (`docker run -e`, Compose `env_file`, Kubernetes Secret) — not baked.

---

## 8. Tags, versions and digests

```text
registry/namespace/name : tag
docker.io/library/node  : 22-alpine
ghcr.io/you/slatex      : 1.4.2
```

| Practice | Why |
|---|---|
| Don't deploy `latest` | `latest` moves; today's build ≠ yesterday's. Rollbacks become impossible |
| Tag with a **version or git commit** (`1.4.2`, `sha-3fa9c1e`) | You know exactly what runs; rollback = redeploy old tag |
| Use **digest** for strictest pinning | Tags can be re-pointed; digests can't |

```bash
docker tag my-api:1.0 ghcr.io/you/my-api:1.0   # add another name to the same image
docker image ls                                # list images
docker image inspect my-api:1.0                # metadata
docker history my-api:1.0                      # layers + sizes (find what made it big)
docker image rm my-api:1.0                     # delete image
```

---

## 9. Registries — how images travel

```text
Laptop / CI                 Registry                    Server / Kubernetes
docker build  ──docker push──▶ Docker Hub / GHCR / ECR ──docker pull──▶ docker run / Pod
```

```bash
docker login ghcr.io                        # authenticate
docker tag my-api:1.0 ghcr.io/you/my-api:1.0
docker push ghcr.io/you/my-api:1.0
docker pull ghcr.io/you/my-api:1.0
```

| Registry | Notes |
|---|---|
| Docker Hub | Default; public images; anonymous pull limits exist |
| GitHub Container Registry (GHCR) | Free, integrates with GitHub Actions |
| AWS ECR / GCP Artifact Registry / Azure ACR | Private, integrates with cloud IAM |

Private registry from Kubernetes needs an **imagePullSecret** (file 04).

---

## 10. Image security and size — what companies check

| Check | Why | How |
|---|---|---|
| **Non-root user** | If the app is hacked, root inside a container is much worse | `USER node` / create a user |
| **No secrets in layers** | Layers keep history. `RUN echo $SECRET > f && rm f` still leaves the secret in an earlier layer | Runtime secrets; BuildKit `--mount=type=secret` for build secrets |
| **Small image** | Faster pulls/deploys, fewer vulnerabilities | Multi-stage, alpine/slim, `npm ci --omit=dev` |
| **Pinned base images** | Reproducible builds | Version tags or digests |
| **Scan for vulnerabilities** | Base images and packages have CVEs | `docker scout cves my-api:1.0`, Trivy, Snyk |
| **Update base regularly** | Security patches arrive in new base images | Renovate/Dependabot for `FROM` lines |
| **Health check** | Orchestrator knows if the app works | `HEALTHCHECK` or Kubernetes probes |
| **Read-only filesystem** (advanced) | Attacker can't write files | `--read-only` + tmpfs for temp dirs |
| **Drop capabilities** (advanced) | Fewer Linux privileges | `--cap-drop ALL` |

Example HEALTHCHECK (alpine has `wget`):

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
```

### Node-specific production tips
- Use `NODE_ENV=production`.
- Handle `SIGTERM` for graceful shutdown (close server, finish requests).
- Node may not respect the container's memory limit automatically in old versions — monitor memory; set `--max-old-space-size` if needed.
- Use `docker run --init` (or `tini`) if your app spawns child processes, to avoid zombie processes.

---

## 11. Multi-architecture (Apple Silicon / ARM)

If you build on an M-series Mac (**arm64**) and deploy to a typical cloud VM (**amd64**), the image may fail with `exec format error`.

```bash
docker build --platform linux/amd64 -t my-api:1.0 .
# or build for both:
docker buildx build --platform linux/amd64,linux/arm64 -t you/my-api:1.0 --push .
```

---

## 12. Common build problems

| Symptom | Cause | Fix |
|---|---|---|
| `COPY failed: file not found` | File is outside build context or ignored by `.dockerignore` | Check paths and `.dockerignore` |
| Build very slow / "sending context" is GBs | No `.dockerignore` | Add one |
| `npm ci` fails: lockfile mismatch | `package-lock.json` out of sync | Run `npm install` locally and commit lockfile |
| Native module build error on alpine | musl / missing build tools | Use `-slim`, or `apk add python3 make g++` in the **build** stage |
| App works locally, crashes in container | Missing env vars; host-only paths; localhost binding | Check `docker logs`, env, bind `0.0.0.0` |
| Image is 1.5 GB | Dev deps, build tools, caches shipped | Multi-stage, `--omit=dev`, `.dockerignore` |
| `exec format error` | CPU architecture mismatch | `--platform`, buildx |
| Changes not visible after rebuild | Cached layer / old image running | `--no-cache`, make sure you restarted the container from the new image |

---

## ✅ Self-check

1. Why is `package*.json` copied before the rest of the code?
2. Difference between `RUN` and `CMD`? Between `ARG` and `ENV`?
3. Why is `CMD ["node","server.js"]` better than `CMD node server.js`?
4. Why is deploying `latest` risky?
5. Why does deleting a secret in a later `RUN` not remove it from the image?
6. What problem do multi-stage builds solve?

Answers → [06 cheatsheet](./06-command-cheatsheet.md#answers-to-self-check-questions).
