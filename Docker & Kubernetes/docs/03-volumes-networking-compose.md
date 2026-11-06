# 03 — Volumes, Networking, Compose & a Full Project Setup

> Goal: persist data, make containers talk to each other, run a whole app with one command.
> ← [02 Dockerfile & images](./02-dockerfile-and-images.md) · Next → [04 Kubernetes](./04-kubernetes.md)

---

# Part 1 — Volumes (data that survives)

## 1.1 The problem

A container's own filesystem is **temporary**. Remove the container and everything written inside is gone.

```text
docker rm pg   →   writable layer deleted   →   your database files: GONE
```

Containers are meant to be **replaceable**. Data must live **outside** them.

```text
Container = compute (can be thrown away)
Volume    = persistence (kept)
```

## 1.2 Three ways to store data

| Type | What it is | Use for |
|---|---|---|
| **Named volume** | Managed by Docker (`pgdata`) | **Databases**, anything persistent. Portable, safest default |
| **Bind mount** | A folder from your computer mapped into the container | **Development** (live code), config files |
| **tmpfs** | In memory only | Temporary/secret scratch data |

```bash
# named volume
docker run -v pgdata:/var/lib/postgresql/data postgres:16

# bind mount (host path : container path)
docker run -v "$(pwd)":/app my-app          # macOS/Linux
docker run -v "${PWD}:/app" my-app          # PowerShell

# read-only mount (:ro)
docker run -v "$(pwd)/nginx.conf":/etc/nginx/nginx.conf:ro nginx
```

## 1.3 Volume commands

```bash
docker volume create pgdata        # create
docker volume ls                   # list
docker volume inspect pgdata       # where/how it's stored, which driver
docker volume rm pgdata            # delete (must not be in use)
docker volume prune                # delete all unused volumes ⚠️
```

## 1.4 Practical rules

- **Database → named volume. Always.**
- **Dev code → bind mount** (edit on your laptop, container sees it instantly).
- `docker compose down` keeps volumes. `docker compose down -v` **deletes them** — that is how people accidentally erase their dev DB.
- On Windows, bind-mounting a project from `C:\...` into a Linux container can be **slow** and file-watching (hot reload) may not trigger. Keep the project inside the **WSL2 filesystem** (e.g. `~/projects`) or enable polling (`WATCHPACK_POLLING=true`).
- Volumes live inside Docker's storage (inside the VM on Desktop). To back up, use the database's own tool (`pg_dump`).

---

# Part 2 — Networking (how containers talk)

## 2.1 Containers are isolated by default

Each container has its own network namespace. Inside a container:

```text
localhost  =  THE CONTAINER ITSELF  (not your laptop, not other containers)
```

This is the single most important networking fact.

## 2.2 The Docker network and name-based DNS

Put containers on the **same user-defined network** and Docker gives you **DNS by name**:

```bash
docker network create app-net

docker run -d --name db      --network app-net -e POSTGRES_PASSWORD=pw postgres:16
docker run -d --name backend --network app-net my-backend
```

Inside `backend`:

```text
✅ postgresql://postgres:pw@db:5432/app        ("db" = the other container's name)
❌ postgresql://postgres:pw@localhost:5432/app (localhost = backend itself → connection refused)
```

```text
┌──────────── app-net ────────────┐
│  backend ──── db:5432 ──▶ db    │   containers find each other by NAME
└─────────────────────────────────┘
        ▲
        │ -p 3000:3000  (only what you publish is reachable from your laptop)
     Browser
```

**Compose creates such a network automatically**, and each *service name* becomes a hostname.

## 2.3 Two different port numbers

```text
-p 8080:80
    │    └── container port (inside Docker network; other containers use THIS)
    └─────── host port (only for things OUTSIDE Docker, like your browser)
```

Container-to-container traffic **never** uses the host port. `backend → db:5432` always uses 5432, no matter what you published.

## 2.4 Where is my DB? Connection string cheat table

| Who connects | To what | Use host |
|---|---|---|
| App running **on your laptop** | Postgres in Docker (published port) | `localhost:5432` |
| App running **in a container** (same Compose) | Postgres container | `db:5432` (service name) |
| Container → something on your laptop | Laptop service | `host.docker.internal` (Docker Desktop) |
| Another machine | Your server | Server IP/DNS + published port (be careful!) |

## 2.5 Network commands

```bash
docker network ls
docker network inspect app-net      # which containers, which IPs
docker network connect app-net web  # attach a running container
docker exec -it backend sh          # then: ping db   |   wget -qO- http://db:8080
```

## 2.6 Isolating tiers (good practice)

```yaml
services:
  web:   { networks: [frontend, backend] }
  api:   { networks: [backend, data] }
  db:    { networks: [data] }          # web cannot reach db directly
networks: { frontend: {}, backend: {}, data: {} }
```
A compromised web container still can't talk to the database network.

---

# Part 3 — Docker Compose

## 3.1 Why Compose?

Without it you'd type 3–4 long `docker run` commands in the right order, with the right network, ports and volumes. Compose lets you **describe the whole app in one YAML file** and run it with one command.

```text
compose.yaml  ──docker compose up──▶  network + volumes + all containers
```

Use `compose.yaml` (preferred name; `docker-compose.yml` also works). You do **not** need the old `version:` line.

## 3.2 Anatomy

```yaml
services:                   # each entry = one container (type)
  web:
    build: .                # build from a Dockerfile…
    # image: nginx:1.27     # …or use a ready image
    ports:
      - "3000:3000"         # HOST:CONTAINER
    environment:
      NODE_ENV: production
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:                    # declares named volumes
  pgdata:
```

| Key | Meaning |
|---|---|
| `build` | Where the Dockerfile is (`.` or `./backend`) |
| `image` | Image to pull/use (also the name given to a built image) |
| `ports` | Publish ports |
| `environment` / `env_file` | Runtime config |
| `volumes` | Mounts (named or bind) |
| `depends_on` | Start order |
| `healthcheck` | How to know the service is truly ready |
| `restart` | `no`, `always`, `on-failure`, `unless-stopped` |
| `networks` | Custom networks |
| `profiles` | Optional services (e.g. `debug` tools) |

## 3.3 `depends_on` is NOT "wait until ready"

```yaml
depends_on: [db]     # only means "start db first". Postgres may still be booting!
```
Your app may start, try to connect to a DB that isn't accepting connections yet, and crash.

Fix with a **healthcheck**:

```yaml
db:
  image: postgres:16
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d slatex"]
    interval: 5s
    timeout: 3s
    retries: 10

web:
  depends_on:
    db:
      condition: service_healthy     # wait until the healthcheck passes
```
Also make your app **retry DB connections** — databases restart in real life too.

## 3.4 Variables and secrets in Compose

```text
.env                       (same folder as compose.yaml; NOT committed)
  POSTGRES_PASSWORD=change-me-locally
```
```yaml
environment:
  DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/slatex   # ${} filled from .env or shell
```
- Commit a **`.env.example`** (names without real values). Never commit `.env`.
- Real production secrets: secret manager / orchestrator secrets, not a file in git.

## 3.5 Compose commands (what each does)

| Command | What it does |
|---|---|
| `docker compose up` | Create network/volumes/containers and start (logs in your terminal) |
| `docker compose up -d` | Same, in the background |
| `docker compose up -d --build` | Rebuild images first (use after Dockerfile/dependency changes) |
| `docker compose down` | Stop and remove containers + network (volumes **kept**) |
| `docker compose down -v` | …and **delete volumes** ⚠️ |
| `docker compose ps` | Status of services |
| `docker compose logs -f web` | Follow one service's logs |
| `docker compose exec web sh` | Shell inside a running service |
| `docker compose run --rm web npm test` | One-off container for a command |
| `docker compose restart web` | Restart a service |
| `docker compose stop` / `start` | Stop/start without removing |
| `docker compose build --no-cache` | Rebuild from scratch |
| `docker compose pull` | Update images |
| `docker compose config` | Show the final merged config — great for debugging YAML/variables |

---

# Part 4 — Full project setup: Next.js + PostgreSQL + Redis

```text
Browser ──▶ web (Next.js :3000) ──┬──▶ db (Postgres :5432) ── volume pgdata
                                  └──▶ redis (:6379)
```

## 4.1 Files in your repo

```text
slatex/
├── Dockerfile              (from file 02)
├── .dockerignore
├── compose.yaml
├── compose.override.yaml   (optional: dev tweaks, auto-loaded)
├── .env                    (local, ignored by git)
└── .env.example            (committed)
```

`.env.example`:
```env
POSTGRES_PASSWORD=
GITHUB_TOKEN=
```

## 4.2 `compose.yaml`

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/slatex
      REDIS_URL: redis://redis:6379
      GITHUB_TOKEN: ${GITHUB_TOKEN}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: slatex
    ports:
      - "127.0.0.1:5432:5432"     # only your laptop can reach it (handy for DB tools)
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d slatex"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  pgdata:
```

Run it:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f web
```

> Postgres 18+ images changed their recommended data path. If you move to a newer major version, check the official `postgres` image page for the correct volume mount path before reusing this file.

## 4.3 The most practical dev setup: app on host, dependencies in Docker

Most teams **don't** run the app in a container while coding. They run only the DB and cache in Docker, and the app with `npm run dev` (fast hot reload, easy debugging).

```bash
docker compose up -d db redis        # start only these two
npm run dev                          # app on your laptop
```
`.env.local` (for the app on your laptop):
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/slatex
REDIS_URL=redis://localhost:6379
```
(`redis` isn't published in the file above — add `ports: ["127.0.0.1:6379:6379"]` to the redis service if the host app needs it.)

Why: container for infrastructure, native process for code you edit all day.

## 4.4 Dev file overrides (when you do want the app in a container)

`compose.override.yaml` is loaded automatically on top of `compose.yaml`:

```yaml
services:
  web:
    build:
      target: deps              # (if your Dockerfile has a dev-friendly stage)
    command: npm run dev
    volumes:
      - .:/app                  # live code
      - /app/node_modules       # keep container's own node_modules
    environment:
      WATCHPACK_POLLING: "true" # hot reload on Windows bind mounts
```
For production use only the base file: `docker compose -f compose.yaml up -d`.

## 4.5 Working with the database container

```bash
docker compose exec db psql -U postgres -d slatex          # SQL shell
docker compose exec db pg_dump -U postgres slatex > backup.sql   # backup (Git Bash/macOS/Linux)
docker compose exec -T db psql -U postgres -d slatex < backup.sql # restore
```
Auto-run SQL on **first** start: put `.sql` files in `/docker-entrypoint-initdb.d/` (mounted as a volume). It runs only when the data directory is empty.

Reset the DB completely:
```bash
docker compose down -v      # deletes pgdata
docker compose up -d
```

## 4.6 Dev vs production

| | Development | Production |
|---|---|---|
| Goal | Speed, debugging | Safety, reproducibility |
| App | Host or bind-mount + hot reload | Built image, no source mount |
| DB | Container + volume | Usually **managed DB** |
| Ports | Published for tools (`127.0.0.1`) | Only the entry point (reverse proxy / LB) |
| Secrets | `.env` (ignored by git) | Secret manager / orchestrator secrets |
| Images | Tag `dev`, big OK | Versioned, small, scanned, non-root |
| Logs | Console | Centralized, with rotation |

---

# Part 5 — Compose troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| App says `ECONNREFUSED 127.0.0.1:5432` | Using `localhost` from inside container | Use `db:5432` |
| App starts before DB ready, crashes | `depends_on` without health | Add healthcheck + `service_healthy`, add retry in app |
| `password authentication failed` | `POSTGRES_PASSWORD` only applies at **first** init; volume already holds old password | `docker compose down -v` (dev) or change the password in Postgres |
| Changes in code not showing | Image not rebuilt / no bind mount | `up -d --build` or use dev override |
| Port already allocated | Host port used | Change host side of `ports:` |
| `${VAR}` blank | `.env` missing/misnamed or wrong folder | `docker compose config` to see resolved values |
| Container keeps restarting | App crash loop | `docker compose logs --tail 50 web` |
| DB data disappeared | `down -v` or no volume | Use named volume; avoid `-v` |

---

## ✅ Self-check

1. Why does `localhost` not reach the DB container from the web container?
2. What does `down -v` do that `down` doesn't?
3. Why isn't `depends_on` enough? What replaces it?
4. Which host do you use for Postgres from (a) your laptop app, (b) a container?
5. Why bind the DB port to `127.0.0.1`?
6. Why do many teams run only the DB/cache in Docker during development?

Answers → [06 cheatsheet](./06-command-cheatsheet.md#answers-to-self-check-questions).
