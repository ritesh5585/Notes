# 05 — Troubleshooting & Real-Company Issues

> Goal: debug calmly with a method, and know the mistakes teams actually make in production.
> ← [04 Kubernetes](./04-kubernetes.md) · Next → [06 Command cheatsheet](./06-command-cheatsheet.md)

---

## 1. The debugging mindset

Do not retry `docker compose down && up --build` again and again hoping it works. **Find which layer is broken.**

```text
1. Is it running?             docker ps -a
2. Why did it stop/crash?     docker logs <c>   +   exit code
3. Is config present?         docker exec <c> env   /  docker inspect
4. Is the port reachable?     -p mapping? app binds 0.0.0.0?
5. Can containers find each other?  names, same network?
6. Can it reach the DB/service?     ping / wget / psql from inside
7. Is data persisted?         volume mounted? right path?
8. Is it resources?           docker stats  (OOM? CPU?)
```

### Exit codes (read from `docker ps -a` or `inspect`)

| Code | Meaning | Typical cause |
|---|---|---|
| `0` | Finished normally | Main process ended (e.g. script finished) — not a crash |
| `1` | App error | Exception, bad config — read the logs |
| `125/126/127` | Docker/command problem | Bad flag / not executable / **command not found** (wrong `CMD`, missing binary) |
| `137` | Killed (SIGKILL = 128+9) | **Out of memory (OOM)** or `docker kill` |
| `139` | Segfault (128+11) | Native module crash |
| `143` | Terminated (SIGTERM = 128+15) | Normal `docker stop` |

---

## 2. Docker failure catalog

| Symptom | Likely cause | How to confirm | Fix |
|---|---|---|---|
| Container exits immediately | Main process crashed/finished | `docker logs`, exit code | Fix app error; ensure `CMD` runs a long-lived process |
| `port is already allocated` | Host port busy | `netstat`/`lsof` | Change host port or stop other process |
| Page not reachable but container "Up" | Missing `-p`; app bound to `127.0.0.1`; wrong container port | `docker port <c>`; `docker exec <c> netstat -tln` | Add `-p`; bind `0.0.0.0`; correct port |
| `ECONNREFUSED 127.0.0.1:5432` | Used `localhost` from a container | Look at connection string | Use service name `db` |
| `getaddrinfo ENOTFOUND db` | Not on same network / wrong name | `docker network inspect` | Same network; correct service name |
| `password authentication failed` (Postgres) | Password env only applies on **first** init; old volume has old password | Check volume age | Dev: `down -v`; else `ALTER USER` |
| DB empty after restart | No volume or wrong mount path | `docker inspect` → Mounts | Mount named volume at the data dir |
| `no space left on device` | Images/volumes/logs filled disk | `docker system df` | `docker image prune`, log rotation, clean unused |
| `permission denied` on bind mount | UID/GID mismatch (esp. Linux) | `ls -ln` | Match user IDs, `chown`, use named volumes |
| `exec format error` | CPU architecture mismatch (ARM vs amd64) | `docker image inspect` → Architecture | Rebuild with `--platform` |
| `exec: "xyz": executable file not found` | Wrong command / binary missing in slim/alpine image | `docker exec` / read Dockerfile | Install it or fix `CMD` |
| Old code still running | Old image/cached layer, container not recreated | Compare image ID | Rebuild, recreate container (`up -d --build`) |
| Slow build | No `.dockerignore`, bad layer order | "Sending build context" size | Add ignore, reorder, use cache |
| Hot reload doesn't work (Windows) | File events not passed through bind mounts | — | Project in WSL filesystem, or polling env var |
| Container can't reach internet | DNS/VPN/proxy issues | `docker exec <c> wget -qO- https://example.com` | Set DNS, proxy env vars, check VPN |
| Pull fails: `toomanyrequests` | Registry rate limit (anonymous) | Error text | `docker login`, use a mirror/private registry |

---

## 3. Kubernetes failure catalog

First look:

```bash
kubectl get pods -n <ns>                      # status column tells the story
kubectl describe pod <pod> -n <ns>            # read the Events section at the bottom!
kubectl logs <pod> -n <ns>                    # current container
kubectl logs <pod> -n <ns> --previous         # the crashed one
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

| Status | Meaning | Common causes | Fix |
|---|---|---|---|
| `Pending` | Not scheduled yet | No node has enough CPU/memory (requests too big), PVC not bound, node selector/taint | `describe pod` → "FailedScheduling"; lower requests / add nodes / fix PVC |
| `ContainerCreating` (stuck) | Pulling image or mounting volume | Slow pull, volume attach problem, missing ConfigMap/Secret | `describe pod` events |
| `ErrImagePull` / `ImagePullBackOff` | Can't fetch image | Typo in name/tag, private registry without `imagePullSecrets`, **local image not loaded into kind/minikube**, `latest` forces pull | Fix name/tag; create pull secret; `kind load docker-image` |
| `CrashLoopBackOff` | Container starts, crashes, restarts with growing delay | App error, missing env/Secret, wrong DB host, failing liveness probe | `logs --previous`, check env, probes |
| `OOMKilled` (exit 137) | Exceeded memory limit | Leak, limit too low, Node heap > limit | Raise limit / fix leak / tune heap |
| `CreateContainerConfigError` | Config reference broken | Missing Secret/ConfigMap/key name | Create it / fix the name |
| `Running` but `0/1 Ready` | Readiness probe failing | Wrong path/port, app slow to boot, dependency down | Fix probe, increase `initialDelaySeconds`, use startup probe |
| `Evicted` | Node ran out of resources | Memory/disk pressure, no limits set | Set requests/limits, add capacity |
| `Terminating` forever | Finalizer or stuck process | PVC finalizers, node lost | Investigate; last resort `--grace-period=0 --force` |
| Node `NotReady` | kubelet/network/disk problem | Disk full, runtime down | Check node conditions, cloud console |
| Service has no traffic | Selector ≠ labels, Pods not Ready, wrong `targetPort` | `kubectl get endpoints <svc>` is empty | Fix labels/ports/readiness |
| `Ingress` 404/502/504 | No controller, wrong host/path/service name, backend not ready, timeout | Controller logs, `describe ingress` | Fix rules; adjust timeouts |
| HPA shows `<unknown>` | No metrics-server or no CPU requests | `kubectl top pods` fails | Install metrics-server; set requests |
| Rollout stuck | New Pods never become Ready | `rollout status`, `describe` new Pods | `rollout undo`; fix probe/image |

Debug tools:

```bash
kubectl exec -it <pod> -n <ns> -- sh                        # inside the Pod
kubectl run tmp -it --rm --image=busybox -- sh              # throwaway debug Pod (then: wget -qO- http://web.slatex)
kubectl get endpoints web -n slatex                         # which Pod IPs back the Service?
kubectl port-forward svc/web 8080:80 -n slatex              # test Service from laptop
kubectl top pods -n slatex                                  # CPU/memory (needs metrics-server)
kubectl debug -it <pod> --image=busybox --target=web        # ephemeral debug container
```

### Debug order for "users can't reach my app"

```text
User → DNS → Load balancer → Ingress → Service → Endpoints → Pod (Ready?) → Container → App → DB
        ▲ check each hop, outside → inside; stop at the first broken one
```

---

## 4. Issues real companies face

Grouped from beginner to advanced. Each is: **what goes wrong → why → what teams do.**

### A. Image and build problems

| Issue | Why it hurts | Fix |
|---|---|---|
| **`latest` tag in production** | Different servers pull different versions; rollbacks impossible; "nothing changed" but behaviour did | Immutable tags (version/commit SHA), digests |
| **Huge images (1–2 GB)** | Slow deploys, slow autoscaling (new node pulls image for minutes), more CVEs | Multi-stage, slim/alpine/distroless, `.dockerignore`, prune dev deps |
| **Slow CI builds (20+ min)** | Developer wait time, cost | Layer order, BuildKit cache, `--cache-from`, registry cache, monorepo-aware builds |
| **Secrets baked into images** | Anyone with image access (or leaked image) has the secret; layers keep history | Runtime secrets, BuildKit secret mounts, rotate anything leaked, scan images |
| **Unpinned base images** | A surprise upstream change breaks builds on Monday | Pin versions/digests; automate updates with Renovate/Dependabot |
| **Vulnerable base images** | CVEs found weeks after build | Scheduled rebuilds + scanning (Trivy/Scout/Snyk) in CI |
| **ARM/amd64 mismatch** | Dev on Apple Silicon, prod on amd64 → `exec format error` | Multi-arch builds (`buildx`) |

### B. Security problems

| Issue | Why it hurts | Fix |
|---|---|---|
| **Running as root** | Container escape / file damage is easier | `USER` non-root, `runAsNonRoot` in K8s |
| **Privileged containers / `--privileged`** | Nearly full host access | Avoid; add only the specific capability needed |
| **Mounting `/var/run/docker.sock`** | Container controls Docker = root on host | Avoid; use rootless builders (Kaniko, BuildKit) in CI |
| **DB port published to the internet** | Docker bypasses host firewalls (iptables) → exposed Postgres/Redis/Mongo | Bind `127.0.0.1`, private networks, don't publish |
| **Secrets in env visible everywhere** | `docker inspect`, crash dumps, logs, child processes | Mounted secret files, secret managers, limit access |
| **Over-permissive Kubernetes RBAC** | One compromised Pod → whole cluster | Least privilege, per-app ServiceAccounts, no default `cluster-admin` |
| **No NetworkPolicy** | Every Pod can talk to every Pod | Default-deny + explicit allows |
| **K8s Secrets assumed encrypted** | They are base64 | RBAC + encryption at rest + external secret manager |
| **Unscanned third-party images** | Supply-chain risk | Trusted registries, signed images, scanning |

### C. Runtime behaviour problems

| Issue | Why it hurts | Fix |
|---|---|---|
| **No resource requests/limits** | Noisy neighbours, OOM kills of random Pods, bad scheduling | Always set; right-size from metrics |
| **Memory limit vs runtime heap** | Node/JVM allocates more than the limit → OOMKilled | Tune heap (`--max-old-space-size`, JVM container flags) |
| **No health probes** | Traffic to booting/broken Pods; zombie apps never restart | Readiness + liveness (+ startup) |
| **Liveness depends on DB** | DB hiccup → all Pods restart → bigger outage | Liveness = "process alive"; readiness handles dependencies carefully |
| **Bad signal handling / no graceful shutdown** | Requests dropped on every deploy (SIGTERM ignored, `npm start` wrapper) | `CMD ["node","server.js"]`, handle SIGTERM, `terminationGracePeriodSeconds`, `preStop` |
| **Writing state to the container filesystem** | Lost on restart; breaks with multiple replicas (uploads, sessions) | External storage (S3), Redis/DB sessions, volumes where needed |
| **App isn't stateless** | Scaling to N replicas breaks logins/carts | Share state via DB/cache; stateless services |
| **Unbounded logs** | Disk fills (`json-file` driver has no limit by default) | Log rotation (`max-size`, `max-file`), ship logs centrally |
| **Zombie processes / PID 1 issues** | Child processes never reaped | `--init`/tini |
| **Timezone/locale/clock differences** | Wrong timestamps, flaky tests | Use UTC everywhere; set TZ explicitly if needed |
| **DB connection limits** | 50 replicas × 20 connections overwhelms Postgres | Connection pooling (PgBouncer), sensible pool sizes |

### D. Data problems

| Issue | Why it hurts | Fix |
|---|---|---|
| **DB container without volume** | Delete container = lose data | Named volume / managed DB |
| **`down -v` / `volume prune` accidents** | Dev data (or worse) erased | Habits, backups, protect important volumes |
| **No backups / never tested restore** | Backup that doesn't restore is not a backup | Automated backups + restore drills |
| **Running DB in K8s casually** | HA, failover, upgrades are hard | Managed DB or a proper operator |
| **Schema migrations during rolling updates** | Old and new app versions run **together**; breaking schema change crashes old Pods | Backward-compatible migrations (expand → migrate → contract); run migrations as a Job |
| **Environment drift** | Prod DB version ≠ dev DB version | Pin same major version everywhere |

### E. Networking problems

| Issue | Why it hurts | Fix |
|---|---|---|
| **`localhost` confusion** | Works on laptop, fails in containers | Service names; env-based config |
| **Service selector mismatch** | Everything "Running" but no traffic | Check `get endpoints`; consistent labels |
| **Ingress timeouts / body size limits** | Uploads or slow requests fail with 413/504 | Tune controller annotations/config |
| **DNS latency/issues in clusters** | Random slow lookups | CoreDNS tuning, caching, fewer lookups |
| **Cross-environment calls** | Staging accidentally calls prod | Separate networks/namespaces/credentials |

### F. Operations and organisation

| Issue | Why it hurts | Fix |
|---|---|---|
| **Adopting Kubernetes too early** | Complexity and cost outweigh benefits for a small app | Start with PaaS/Compose; migrate when pain is real |
| **`kubectl edit` in production (config drift)** | Cluster differs from git; nobody knows why | GitOps: change via git, cluster syncs |
| **YAML copy-paste sprawl** | Dev/staging/prod diverge | Helm or Kustomize, shared base |
| **Wrong cluster context** | Command meant for dev hits prod | Context in shell prompt, separate credentials, confirmations |
| **Cluster upgrade surprises** | Deprecated APIs removed → manifests break | Read release notes, test in staging, keep manifests current |
| **No observability** | "It's slow" with no data | Metrics, logs, traces, alerts on SLOs |
| **Cost leaks** | Over-requested resources, idle clusters, many load balancers | Right-size, autoscale, one Ingress rather than many LBs, budget alerts |
| **Skills gap / tool sprawl** | Only one person understands the platform | Documentation, golden paths, platform team, training |
| **Docker Desktop licensing** | Larger companies need paid licences | Check terms; alternatives (Podman, Rancher Desktop, Colima) |
| **Rollback not actually possible** | Tags overwritten, old images deleted, DB changed | Immutable tags, retention policy, backward-compatible migrations |

---

## 5. Production-readiness checklist

```text
IMAGE
[ ] Pinned base image, multi-stage, small, scanned
[ ] Non-root user, no secrets inside
[ ] Versioned immutable tag (git SHA)
[ ] .dockerignore present

RUNTIME
[ ] Readiness + liveness (+ startup) probes
[ ] CPU/memory requests, memory limit
[ ] Handles SIGTERM, graceful shutdown
[ ] Stateless (sessions/uploads external)
[ ] Logs to stdout/stderr, centralised, rotated
[ ] ≥2 replicas for important services; PodDisruptionBudget

CONFIG & SECRETS
[ ] Config from env/ConfigMap, same image in every environment
[ ] Secrets from a secret manager or K8s Secrets + RBAC + encryption at rest
[ ] .env never committed

DATA
[ ] Persistent data on volumes or managed DB
[ ] Automated backups + tested restore
[ ] Backward-compatible migrations

NETWORK & SECURITY
[ ] Only the entry point is public; DB not exposed
[ ] TLS at the edge; NetworkPolicy; least-privilege RBAC
[ ] Image + dependency scanning in CI

OPERATIONS
[ ] CI builds → registry → deploy (GitOps if possible)
[ ] Rollback tested
[ ] Dashboards + alerts; runbook for common failures
[ ] Cost monitoring
```

---

## 6. Practice drills (break it on purpose)

| Drill | What you'll learn |
|---|---|
| Change `-p 3000:3000` to a port the app doesn't use | Port mapping vs app port |
| Make the app listen on `127.0.0.1` | Why `0.0.0.0` matters |
| Use `localhost` for the DB inside a container | Container networking |
| Run Postgres without a volume, delete the container | Persistence |
| Set a wrong `POSTGRES_PASSWORD` after first run | Why env applies only at init |
| Set memory limit to `64m` and run a heavy app | OOMKilled / exit 137 |
| Deploy with image tag typo | `ImagePullBackOff` |
| Break the readiness path (`/wrong`) | `0/1 Ready`, traffic stops, rollout stalls |
| Change Service selector label | Empty endpoints |
| Delete a Pod / scale to 0 and back | Self-healing and replicas |
| Deploy bad version then `rollout undo` | Rollback workflow |
