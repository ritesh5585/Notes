# 🐳 Docker & Kubernetes Notes

---

## 📚 Documentation map

| # | File | What you learn |
|---|---|---|
| 0 | **README.md** (this file) | Big picture: the problem, Docker vs VM, image vs container, why use it in a project, why Postgres runs in Docker |
| 1 | [`docs/01-docker-basics.md`](./docs/01-docker-basics.md) | Install, first container, `docker run` explained flag by flag, lifecycle, ports, env vars |
| 2 | [`docs/02-dockerfile-and-images.md`](./docs/02-dockerfile-and-images.md) | Dockerfile, layers & cache, multi-stage builds, tags, registries, image security |
| 3 | [`docs/03-volumes-networking-compose.md`](./docs/03-volumes-networking-compose.md) | Volumes, networks, Compose, full project setup (Next.js + Postgres + Redis) |
| 4 | [`docs/04-kubernetes.md`](./docs/04-kubernetes.md) | Why Kubernetes, architecture, objects, deploying your app on a local cluster, scaling, rollouts |
| 5 | [`docs/05-troubleshooting-and-company-issues.md`](./docs/05-troubleshooting-and-company-issues.md) | Debug method, failure catalog, mistakes real companies make |
| 6 | [`docs/06-command-cheatsheet.md`](./docs/06-command-cheatsheet.md) | Every command explained (what it does, when to use it) + interview questions |

---

## 1. The problem Docker solves

Imagine you build a project with Node.js 22, Postgres 16 and Redis 7.

```text
YOUR LAPTOP                     TEAMMATE'S LAPTOP               SERVER
Node 22                         Node 18                         Node 20
Postgres 16                     Postgres not installed          Postgres 14
Windows                         macOS                           Linux
```

Result: **"It works on my machine."**

The real problem is not code. It is **environment mismatch** — different versions, different OS, different config.

### The fix

Package the app **together with its runtime and dependencies**, so it runs the same everywhere:

```text
Your code  +  Node 22  +  libraries  +  config
              ↓
        one reproducible package  (an IMAGE)
              ↓
        runs the same on laptop, CI, server
```

> Docker's real value = **same environment everywhere** + **isolation** (one app can't break another).

---

## 2. What Docker is (and what it is not)

Docker is a tool to **build, ship and run applications as containers**.

A **container** is a normal process on your computer, but wrapped so it:
- sees its **own filesystem**,
- sees its **own processes**,
- has its **own network**,
- can be **limited** in CPU and memory.

### Container vs Virtual Machine

```text
VIRTUAL MACHINE                         CONTAINER
┌─────────┐ ┌─────────┐                 ┌─────────┐ ┌─────────┐
│  App A  │ │  App B  │                 │  App A  │ │  App B  │
│ Guest OS│ │ Guest OS│                 │  libs   │ │  libs   │
└────┬────┘ └────┬────┘                 └────┬────┘ └────┬────┘
     Hypervisor                                Docker Engine
     Host OS                                   Host OS (shared kernel)
     Hardware                                  Hardware
```

| | VM | Container |
|---|---|---|
| Includes its own OS kernel? | Yes (heavy, GBs) | **No** — shares the host kernel (light, MBs) |
| Start time | Minutes | Seconds or less |
| Isolation | Very strong | Good, but weaker (shared kernel) |
| Use for | Full OS, strong isolation | Apps and services |

**How isolation works (just the idea):** Linux gives two features — **namespaces** ("what can this process see?") and **cgroups** ("how much CPU/RAM can it use?"). Docker packages these into a friendly tool.

> **Windows/macOS note:** containers need a Linux kernel. Docker Desktop quietly runs a small Linux VM (WSL2 on Windows). So on your laptop it is "a container inside a hidden Linux VM". On a Linux server there is no VM layer.

---

## 3. The four words you must never mix up

```text
Dockerfile  ──build──▶  Image  ──run──▶  Container
 (recipe)              (packed meal)     (meal being served)
                          │
                       push/pull
                          ▼
                      Registry  (a store for images)
```

| Word | Meaning | Analogy |
|---|---|---|
| **Dockerfile** | Text file of build steps | Recipe |
| **Image** | Read-only packaged result of the build | Frozen packed meal / class in code |
| **Container** | A running instance of an image | The meal being eaten / object in code |
| **Registry** | Server that stores images (Docker Hub, GHCR, ECR) | Supermarket |

One image can start many containers:

```text
                node:22-alpine
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Container A   Container B   Container C
```

**Golden sentence:** *Build creates an image. Run creates a container from that image.*

---

## 4. Why use Docker in a project?

| Benefit | What it means for you |
|---|---|
| **Same environment** | `docker compose up` gives every teammate the same setup in minutes |
| **No installs on your laptop** | No installing Postgres/Redis/Mongo directly — remove the container, everything is gone |
| **Version pinning** | `postgres:16` is exactly Postgres 16 — same as production |
| **Side-by-side versions** | Project A uses Postgres 14, project B uses 16, at the same time |
| **Disposable** | Broke your DB? Delete the volume, start fresh |
| **Easy CI** | The test pipeline starts real Postgres in seconds |
| **Same artifact to production** | The image you tested is the image you deploy |

### When you do NOT need Docker (honest answer)
- A tiny static site or a single script.
- A solo learning project with nothing to install except Node.
- Very simple hosting on a platform that builds your code for you (Vercel, Netlify) — you push code, the platform does the packaging.

Docker earns its place when you have **several moving parts** (app + DB + cache) or **several people/environments**.

---

## 5. Why do people run Postgres in Docker?

Because installing databases directly on a laptop is painful, and Docker makes them a **one-command, disposable, version-pinned** tool.

### What happens without Docker

```text
Install Postgres installer → set up service → set password → port clash with another project
→ different version for project B → uninstall leaves junk → teammate's setup differs
```

### With Docker

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=secret -p 127.0.0.1:5432:5432 \
  -v pgdata:/var/lib/postgresql/data postgres:16
```

One command. Version pinned. Data in a named volume. Remove it any time.

| Reason | Explanation |
|---|---|
| **Parity** | Same version in dev, CI, staging |
| **Speed** | Up in seconds, no installer |
| **Isolation** | Doesn't touch the rest of your computer |
| **Reset** | `docker compose down -v` = clean database |
| **Many versions** | Run Postgres 14 and 16 together on different ports |
| **Onboarding** | New teammate: clone → `docker compose up` |

### ⚠️ But: is it good for production?

A database is **stateful** — it holds your precious data. Containers are designed to be **replaceable**. That mismatch is why advice differs:

| Place | Common choice | Why |
|---|---|---|
| **Local dev / tests / CI** | Postgres **in Docker** | Fast, disposable, identical |
| **Production** | Often a **managed database** (RDS, Cloud SQL, Neon, Supabase) | They handle backups, failover, patching, scaling, monitoring |
| **Production in Docker/K8s** | Possible, but needs volumes, backups, HA, upgrades, an operator | You own all the operations work |

> **Rule of thumb:** Docker for dev/test databases. Managed service for production, unless you have a platform team and a reason to self-host.

**Biggest beginner trap:** running a DB container **without a volume**. Delete the container and the data is gone. Always mount a volume (see file 03).

---

## 6. Docker vs Compose vs Kubernetes — problem first

```text
PROBLEM                                   TOOL
"Package my app so it runs anywhere"      →  Docker
"Run app + DB + Redis together locally"   →  Docker Compose
"Run hundreds of containers on many
 machines, heal, scale, roll updates"     →  Kubernetes
```

| Question | Docker | Compose | Kubernetes |
|---|---|---|---|
| Scope | One container | Several containers, **one machine** | Many containers, **many machines** |
| You describe | Commands | `compose.yaml` | YAML manifests (desired state) |
| Self-healing | Basic restart policy | Basic | **Yes** — replaces failed Pods |
| Scaling | Manual | Manual (`--scale`) | **Built-in** (replicas, autoscaling) |
| Rolling updates | Manual | Limited | **Built-in**, with rollback |
| Complexity | Low | Low–medium | **High** |

Kubernetes does **not replace** Dockerfiles. The pipeline stays:

```text
Source → Dockerfile → Image → Registry → (Compose on a server | Kubernetes) → Users
```

---

## 7. How a real project flows

```text
DEVELOPER LAPTOP
  write code
  docker compose up        ← app + Postgres + Redis, all containers
        │
        ▼ git push
CI PIPELINE (GitHub Actions)
  docker build             ← build image
  run tests (DB in container)
  docker push              ← image goes to registry, tagged with version/commit
        │
        ▼
RUNTIME
  small app:   server pulls image → docker compose up -d
  bigger app:  Kubernetes pulls image → runs Pods → Service → users
```

---

## 8. Learning path

```text
1. Containers vs VMs         (this README)
2. docker run, logs, exec    (01)
3. Dockerfile + layers       (02)
4. Volumes + networks        (03)
5. Compose + full project    (03)
6. Debugging                 (05)
7. Production-grade images   (02)
8. Kubernetes basics         (04)
9. Scaling, probes, rollouts (04)
10. Company-level issues     (05)
```

### Practice project (do this, don't just read)
1. Run your Next.js app normally.
2. Write a Dockerfile for it (file 02).
3. Add Postgres + Redis with Compose (file 03).
4. **Break things on purpose:** wrong port, wrong DB hostname, missing env var, stopped DB, no volume — then fix each (file 05).
5. Only then deploy to a local Kubernetes cluster (file 04).

---

## 9. Three questions to ask about any infrastructure tool

1. **What problem existed before this tool?**
   `Environment mismatch → Docker`, `Many local services → Compose`, `Many machines → Kubernetes`.
2. **How do data and control flow through it?**
   `Dockerfile → image → container → process`.
3. **What happens when it fails, and how do I debug it?**
   Port? Network? Image? Crash? Storage? Config?

---

## 10. Quick revision

| Concept | Remember |
|---|---|
| Dockerfile | Recipe to build an image |
| Image | Read-only package (blueprint) |
| Container | Running instance of an image |
| Registry | Storage/distribution for images |
| Volume | Data that survives the container |
| Network | Lets containers talk by name |
| Compose | Define a multi-container app in one file |
| Pod | Smallest K8s unit (usually one container) |
| Deployment | "Keep N copies of this Pod running; roll updates safely" |
| Service | Stable address in front of Pods |
| ConfigMap / Secret | Config / sensitive config for Pods |
| PVC | A Pod's request for storage |

> **Learn the problem first. Learn the abstraction second. Learn the command last.**

Official starting points: [Docker docs](https://docs.docker.com/) · [Compose docs](https://docs.docker.com/compose/) · [Kubernetes docs](https://kubernetes.io/docs/home/)