# 01 — Docker Basics

> Goal: install Docker, run containers confidently, and **understand every flag you type**.
> ← [README](../README.md) · Next → [02 Dockerfile & images](./02-dockerfile-and-images.md)

---

## 1. Install and verify

**Windows / macOS:** install **Docker Desktop**. On Windows it uses **WSL2** (a Linux layer) — enable it when the installer asks.
**Linux:** install Docker Engine from the official docs.

Verify, step by step (each command tests a different layer):

```bash
docker --version          # Is the CLI installed?
docker compose version    # Is Compose v2 installed? (note: "docker compose", no hyphen)
docker info               # Can the CLI talk to the Docker Engine (daemon)?
docker run hello-world    # Full test: pull image → create container → run → print message
```

| If this fails | It usually means |
|---|---|
| `docker --version` | Docker not installed / not in PATH |
| `docker info` says "cannot connect to the Docker daemon" | Docker Desktop isn't running — start it |
| `hello-world` can't pull | No internet, proxy/VPN, or Docker Hub rate limit |

---

## 2. How Docker works (simple version)

```text
You type a command
      │
      ▼
 Docker CLI  (the `docker` command — just a messenger)
      │  talks over an API
      ▼
 Docker Engine / daemon  (the real worker, runs in background)
      │
 ┌────┼────────────┬────────────┐
 ▼    ▼            ▼            ▼
Images Containers  Networks   Volumes
```

What really happens on `docker run -p 3000:3000 my-app`:

```text
1. CLI sends the request to the daemon
2. Daemon looks for image "my-app" locally
3. Not found? Pull it from the registry (Docker Hub)
4. Create a container (a thin writable layer on top of the image)
5. Attach a network and apply the port mapping
6. Apply env vars, mounts, limits
7. Start the container's main process (e.g. node server.js)
```

> A container lives **as long as its main process lives**. When that process exits, the container stops. This explains most "my container exits immediately" bugs.

---

## 3. Your first container

```bash
docker run --name web -p 8080:80 nginx
```

Open `http://localhost:8080` — nginx's welcome page.

### `docker run` anatomy — every part explained

```text
docker run  [OPTIONS]  IMAGE[:TAG]  [COMMAND]
```

| Piece | Meaning | Why you use it |
|---|---|---|
| `--name web` | Gives the container a readable name | Otherwise Docker invents `quirky_euler`; names make `logs`, `exec`, networking easier |
| `-p 8080:80` | Publish: `HOST_PORT:CONTAINER_PORT` | Containers are isolated; this opens a door from your machine into the container |
| `-d` | Detached: run in background | Otherwise your terminal is stuck showing logs |
| `-it` | `-i` keep stdin open + `-t` give a terminal | Needed for interactive shells (`docker run -it ubuntu bash`) |
| `--rm` | Auto-delete the container when it exits | Great for one-off/test containers; avoids leftovers |
| `-e KEY=value` | Set an environment variable | Pass config (ports, DB URL) at runtime |
| `--env-file .env` | Load many env vars from a file | Cleaner than many `-e` |
| `-v name:/path` | Mount a volume | Make data survive the container |
| `--network net` | Join a network | Let containers find each other by name |
| `--restart unless-stopped` | Restart policy | Recover after crash/reboot |
| `--memory 512m --cpus 1` | Resource limits | Stop one container from eating the whole machine |
| `nginx:1.27` | IMAGE and TAG | **Pin the tag** (don't rely on `latest`) |

Example putting it together:

```bash
docker run -d --name api --rm \
  -p 127.0.0.1:3000:3000 \
  -e NODE_ENV=production \
  --env-file .env \
  --network app-net \
  --memory 512m \
  my-api:1.0
```

Read it like a sentence: *"Run my-api version 1.0 in the background, call it `api`, delete it when it stops, expose port 3000 only to my own machine, give it these env vars, attach it to `app-net`, limit it to 512 MB."*

---

## 4. Container lifecycle

```text
          docker create          docker start
 Image ───────────────▶ Created ─────────────▶ Running ──docker stop──▶ Exited
                                                  │ ▲                      │
                                       docker pause│ │docker unpause       │ docker start
                                                  ▼ │                      ▼
                                                Paused                 (back to Running)

 Exited / Created ──docker rm──▶ Removed (gone, writable layer deleted)
```

| Command | What it does | Note |
|---|---|---|
| `docker ps` | List **running** containers | |
| `docker ps -a` | List **all** (incl. stopped) | Use this when a container "disappeared" — it probably exited |
| `docker stop web` | Ask the main process to stop (SIGTERM, then SIGKILL after 10 s) | Graceful |
| `docker kill web` | Kill immediately (SIGKILL) | Last resort |
| `docker start web` | Start a stopped container | Same container, same writable layer |
| `docker restart web` | Stop + start | |
| `docker rm web` | Delete a **stopped** container | Data in its writable layer is lost! |
| `docker rm -f web` | Stop + delete | |

> **Important:** `docker run` always creates a **new** container. `docker start` revives an **existing** one. Running `docker run` repeatedly with the same `--name` gives "name already in use".

---

## 5. Looking inside containers (your debugging tools)

| Command | Use it when |
|---|---|
| `docker logs web` | See what the app printed (stdout/stderr). **First thing to check** |
| `docker logs -f web` | Follow logs live (like `tail -f`) |
| `docker logs --tail 100 web` | Only the last 100 lines |
| `docker exec -it web sh` | Open a shell **inside** a running container to look around |
| `docker exec web env` | Run one command (here: print env vars) without a shell |
| `docker inspect web` | Full JSON: IP, mounts, env, ports, restart count, exit code |
| `docker stats` | Live CPU/RAM/network per container |
| `docker top web` | Processes inside the container |
| `docker cp web:/app/log.txt .` | Copy a file out (or in) |
| `docker diff web` | What files changed vs the image |

`sh` vs `bash`: slim/alpine images often have only `sh`.

Why `-it` with `exec`? `-i` keeps input open, `-t` allocates a terminal. Without them the shell exits immediately.

---

## 6. Ports — the topic that confuses everyone

### 6.1 Publishing

```text
-p HOST_PORT:CONTAINER_PORT

  Browser ──▶ localhost:8080 ──(Docker maps)──▶ container:80 ──▶ nginx
```

### 6.2 `EXPOSE` is documentation, not a door

```dockerfile
EXPOSE 3000      # "this app listens on 3000" — only a note
```
It does **not** open anything. You still need `-p 3000:3000` (or `ports:` in Compose).

### 6.3 Bind address: who may knock?

```bash
-p 3000:3000                 # = 0.0.0.0:3000  → reachable from your whole network!
-p 127.0.0.1:3000:3000       # only from your own machine
```

> **Security trap:** on Linux servers, a published port can **bypass the host firewall (e.g. ufw)** because Docker edits iptables. A database published as `-p 5432:5432` can become reachable from the internet. For databases use `127.0.0.1:5432:5432` or don't publish at all (other containers reach it over the Docker network).

### 6.4 The "listens on localhost inside the container" bug

If your app does `app.listen(3000, "127.0.0.1")` or a framework defaults to localhost, then inside the container only the container itself can reach it — the port mapping from outside **won't work**.

```text
Wrong:  server binds 127.0.0.1:3000   → "connection refused / empty reply" from host
Right:  server binds 0.0.0.0:3000     → reachable through -p
```
Next.js: set `HOSTNAME=0.0.0.0`. Vite: `--host`. Express: `app.listen(3000, "0.0.0.0")` (or omit the host).

### 6.5 Port already in use

```text
Bind for 0.0.0.0:3000 failed: port is already allocated
```
Cause: something else uses that **host** port. Fix: change the host side (`-p 3001:3000`) or stop the other thing.

```powershell
netstat -ano | findstr :3000      # Windows: find the process ID
```
```bash
lsof -i :3000                     # macOS/Linux
```

---

## 7. Environment variables

Apps need config that changes per environment:

```env
PORT=3000
DATABASE_URL=postgresql://...
GITHUB_TOKEN=...
```

### Ways to provide them

```bash
docker run -e PORT=3000 -e NODE_ENV=production my-app
docker run --env-file .env my-app
```

### Build-time vs run-time (a classic confusion)

| | `ARG` | `ENV` |
|---|---|---|
| Available when | **Build** time only | Build **and** runtime (baked into image) |
| Set with | `--build-arg` | `-e` at run, or `ENV` in Dockerfile |
| Use for | Version numbers, build flags | Non-secret defaults |

### Secrets rule

```dockerfile
ENV JWT_SECRET=my-secret      # ❌ stored in the image forever; anyone with the image can read it
```
- Don't put secrets in the Dockerfile or committed files.
- Pass them at **runtime** (env, secret manager, Kubernetes Secrets).
- Add `.env` to `.gitignore` **and** `.dockerignore`.

### Next.js gotcha
Variables starting with `NEXT_PUBLIC_` are **inlined at build time** into the browser bundle. They are *not* read at container start. If you change them, rebuild the image (or design around it).

---

## 8. Cleaning up (and not destroying your data)

```bash
docker system df          # How much disk do images/containers/volumes use?
docker container prune    # Remove all STOPPED containers
docker image prune        # Remove dangling (untagged) images
docker image prune -a     # Remove ALL unused images
docker volume prune       # Remove volumes not used by any container  ⚠️ deletes data
docker system prune       # Containers + networks + dangling images (volumes NOT included by default)
```

> Before `volume prune` or `compose down -v`, ask: *"Does a volume hold data I care about?"* (database!). Docker will not give a second chance.

---

## 9. Why Docker and not just run the program directly?

| Question | Answer |
|---|---|
| Why not `apt/brew/installer install postgres`? | Version clashes, leftovers, different from production, hard for teammates to reproduce |
| Why not a VM? | VMs are heavy and slow to boot; containers share the kernel and start fast |
| Why not just `npm start` for my app? | Fine for solo dev. Docker matters when others, CI, or servers must run it **identically** |
| Why not Docker alternatives? | **Podman** (daemonless, similar CLI), **containerd/nerdctl** work too; Docker has the biggest ecosystem and docs |

Note: **Docker Desktop's licence** is paid for larger companies (check Docker's current terms). Alternatives: Podman Desktop, Rancher Desktop, Colima.

---

## 10. Common beginner mistakes

| Mistake | Fix |
|---|---|
| Container exits right away | `docker ps -a` → `docker logs <name>`. The main process crashed or finished |
| "name already in use" | `docker rm <name>` or use `docker start` |
| Can't open `localhost:PORT` | Missing `-p`, app bound to `127.0.0.1`, wrong container port |
| Using `latest` tag | Pin versions (`postgres:16`) so builds are repeatable |
| Data vanished | No volume mounted; container was removed |
| Editing files inside a running container | Changes disappear. Change code → rebuild image |
| Running everything as root | Use a non-root `USER` (file 02) |

---

## ✅ Self-check

1. What is the difference between `docker run` and `docker start`?
2. Why does `EXPOSE 3000` not make the app reachable?
3. Why can a published database port be dangerous on a server?
4. Why does `listen("127.0.0.1")` break port mapping?
5. Why must you check `docker ps -a` and not only `docker ps`?

Answers are in [06 cheatsheet](./06-command-cheatsheet.md#answers-to-self-check-questions).
