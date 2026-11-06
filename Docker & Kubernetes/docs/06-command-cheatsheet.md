# 06 — Command Cheatsheet, Interview Questions & Answers

> Every command with **what it does** and **when you use it**.
> ← [05 Troubleshooting](./05-troubleshooting-and-company-issues.md) · ← [README](../README.md)

---

## How to read any Docker command

```text
docker  <object>  <action>  [flags]  <target>

docker  container run      -d -p 8080:80  nginx      (long form)
docker                run  -d -p 8080:80  nginx      (short form most people use)
docker  image     ls
docker  network   inspect  app-net
docker  volume    rm       pgdata
```

Objects: `container`, `image`, `network`, `volume`, `compose`, `system`.

---

## 1. Docker — containers

| Command | What it does | Use it when |
|---|---|---|
| `docker run IMAGE` | Create **and** start a container | First start |
| `docker run -d --name n -p H:C IMAGE` | Run in background, named, with a port mapping | Normal usage |
| `docker run -it --rm IMAGE sh` | Interactive shell, deleted on exit | Explore an image |
| `docker ps` | List running containers | Check what's up |
| `docker ps -a` | List all, incl. stopped | A container "vanished" |
| `docker stop n` | Graceful stop (SIGTERM → SIGKILL after 10 s) | Normal shutdown |
| `docker kill n` | Immediate stop | Frozen container |
| `docker start n` | Start an existing stopped container | Resume |
| `docker restart n` | Stop then start | After config change |
| `docker rm n` / `rm -f n` | Delete stopped / force delete | Cleanup |
| `docker logs n` | Print output | **First debugging step** |
| `docker logs -f --tail 100 n` | Follow last 100 lines | Live debugging |
| `docker exec -it n sh` | Shell inside a running container | Inspect files/env/network |
| `docker exec n env` | Run one command | Check env vars |
| `docker inspect n` | Full JSON details | IP, mounts, exit code, env |
| `docker stats` | Live CPU/RAM | Find memory hogs |
| `docker top n` | Processes in container | Check what's running |
| `docker port n` | Show port mappings | "Is my port published?" |
| `docker cp n:/path ./` | Copy files out/in | Grab a log/file |
| `docker diff n` | Files changed vs image | See what the app wrote |
| `docker rename a b` | Rename | Tidy up |
| `docker update --memory 512m n` | Change limits live | Quick fix |

### Useful `docker run` flags

| Flag | Meaning |
|---|---|
| `-d` | Detached (background) |
| `-it` | Interactive + terminal |
| `--rm` | Remove on exit |
| `--name` | Container name |
| `-p H:C` / `-p 127.0.0.1:H:C` | Publish port (optionally only to localhost) |
| `-e K=V` / `--env-file f` | Env vars |
| `-v name:/path` / `-v ./dir:/path` | Named volume / bind mount |
| `--network n` | Join network |
| `--restart unless-stopped` | Auto-restart policy |
| `--memory 512m --cpus 1` | Limits |
| `--user 1000:1000` | Run as a non-root user |
| `--read-only` | Read-only filesystem |
| `--init` | Tiny init process (reaps zombies, forwards signals) |
| `--platform linux/amd64` | Force CPU architecture |
| `--add-host host.docker.internal:host-gateway` | Reach the host from a container on Linux |

---

## 2. Docker — images

| Command | What it does | Use it when |
|---|---|---|
| `docker build -t name:tag .` | Build from the Dockerfile in `.` | After code/Dockerfile changes |
| `docker build -f path/Dockerfile .` | Use another Dockerfile | Multiple Dockerfiles |
| `docker build --no-cache` | Rebuild without cache | Suspect stale layers |
| `docker build --target stage` | Build up to a stage | Test a stage |
| `docker build --build-arg K=V` | Pass `ARG` | Parametrised builds |
| `docker buildx build --platform a,b --push` | Multi-arch build + push | ARM + amd64 |
| `docker image ls` | List images | See sizes/tags |
| `docker pull image:tag` | Download | Prefetch |
| `docker push image:tag` | Upload | Publish to registry |
| `docker tag src dst` | Add another name | Before pushing to a registry |
| `docker history image` | Layers and sizes | Why is it big? |
| `docker image inspect image` | Metadata (arch, env, layers) | Debug |
| `docker image rm image` | Delete | Free space |
| `docker login <registry>` | Authenticate | Private registries |
| `docker scout cves image` | Vulnerability scan (also Trivy/Snyk) | Security checks |
| `docker save -o f.tar image` / `docker load -i f.tar` | Export / import as file | Offline transfer |

---

## 3. Docker — networks and volumes

| Command | What it does |
|---|---|
| `docker network ls` | List networks |
| `docker network create n` | Create a user-defined network (DNS by name) |
| `docker network inspect n` | See attached containers/IPs |
| `docker network connect n c` / `disconnect` | Attach/detach a container |
| `docker volume ls` | List volumes |
| `docker volume create v` | Create a named volume |
| `docker volume inspect v` | Details (driver, mountpoint) |
| `docker volume rm v` | Delete (must be unused) |
| `docker volume prune` | ⚠️ delete all unused volumes |

---

## 4. Docker — cleanup (read before running)

| Command | Removes | Danger |
|---|---|---|
| `docker container prune` | Stopped containers | Low |
| `docker image prune` | Dangling images | Low |
| `docker image prune -a` | All unused images | Medium (re-download later) |
| `docker network prune` | Unused networks | Low |
| `docker volume prune` | Unused volumes | **High — data loss** |
| `docker system prune` | Containers, networks, dangling images (no volumes) | Medium |
| `docker system df` | *Shows* disk usage | Safe |

---

## 5. Docker Compose

| Command | What it does |
|---|---|
| `docker compose up -d` | Create + start everything in background |
| `docker compose up -d --build` | Rebuild images first |
| `docker compose up -d db redis` | Start only these services |
| `docker compose down` | Remove containers + network (keeps volumes) |
| `docker compose down -v` | …and delete volumes ⚠️ |
| `docker compose ps` | Service status |
| `docker compose logs -f web` | Follow logs of one service |
| `docker compose exec web sh` | Shell in a running service |
| `docker compose run --rm web npm test` | One-off command in a fresh container |
| `docker compose restart web` | Restart a service |
| `docker compose stop` / `start` | Stop/start without removing |
| `docker compose build [--no-cache]` | Build images |
| `docker compose pull` | Update images |
| `docker compose config` | Show final resolved YAML (variables filled in) |
| `docker compose -f a.yaml -f b.yaml up` | Merge several files |
| `docker compose --profile debug up` | Include optional profile services |

---

## 6. kubectl

### Cluster & context

| Command | What it does |
|---|---|
| `kubectl cluster-info` | Is the API server reachable? |
| `kubectl get nodes [-o wide]` | Nodes and status |
| `kubectl config get-contexts` | List clusters you can talk to |
| `kubectl config current-context` | **Which cluster am I on?** (check before destructive commands) |
| `kubectl config use-context name` | Switch cluster |
| `kubectl config set-context --current --namespace=slatex` | Set default namespace |

### Create / update / delete

| Command | What it does |
|---|---|
| `kubectl apply -f file.yaml` / `-f dir/` | Create or update from manifests (declarative) |
| `kubectl delete -f file.yaml` | Delete what the file describes |
| `kubectl delete pod name` | Delete a Pod (a Deployment recreates it) |
| `kubectl create namespace x` | Create namespace |
| `kubectl create secret generic s --from-literal=K=V` | Create a Secret |
| `kubectl create configmap c --from-literal=K=V` | Create a ConfigMap |
| `kubectl create deployment web --image=nginx --dry-run=client -o yaml` | **Generate YAML** to learn/start from |
| `kubectl edit deployment web` | Edit live (avoid in production — causes drift) |
| `kubectl label pod p k=v` | Add a label |

### Inspect

| Command | What it does |
|---|---|
| `kubectl get pods\|deploy\|svc\|ingress\|pvc\|all` | List objects |
| `kubectl get pods -n ns -o wide` | More columns (node, IP) |
| `kubectl get pods -A` | All namespaces |
| `kubectl get pods -l app=web` | Filter by label |
| `kubectl get pods -w` | Watch changes live |
| `kubectl get <x> -o yaml` | Full YAML of live object |
| `kubectl describe pod p` | Details + **Events** (read the bottom!) |
| `kubectl get events --sort-by=.lastTimestamp` | Recent cluster events |
| `kubectl get endpoints svc` | Which Pod IPs back a Service |
| `kubectl explain deployment.spec` | Built-in field docs |
| `kubectl api-resources` | All resource types |
| `kubectl top pods\|nodes` | CPU/memory (needs metrics-server) |

### Debug / access

| Command | What it does |
|---|---|
| `kubectl logs p` | Pod logs |
| `kubectl logs p -f` | Follow |
| `kubectl logs p --previous` | Logs of the **crashed** previous container |
| `kubectl logs -l app=web --all-containers` | Logs by label |
| `kubectl exec -it p -- sh` | Shell inside a Pod |
| `kubectl port-forward svc/web 8080:80` | Reach a Service/Pod from your laptop |
| `kubectl run tmp -it --rm --image=busybox -- sh` | Temporary debug Pod |
| `kubectl debug -it p --image=busybox` | Attach an ephemeral debug container |
| `kubectl cp p:/path ./local` | Copy files |

### Scale / release

| Command | What it does |
|---|---|
| `kubectl scale deploy web --replicas=5` | Manual scaling |
| `kubectl autoscale deploy web --cpu-percent=70 --min=2 --max=10` | Create an HPA |
| `kubectl get hpa` | Autoscaler status |
| `kubectl set image deploy/web web=img:2.0` | Roll out a new image |
| `kubectl rollout status deploy/web` | Watch the rollout |
| `kubectl rollout history deploy/web` | Revisions |
| `kubectl rollout undo deploy/web` | **Rollback** |
| `kubectl rollout restart deploy/web` | Restart Pods gradually (e.g. to pick up new Secret) |
| `kubectl diff -f file.yaml` | Preview what `apply` would change |

### Local clusters

```bash
kind create cluster --name slatex          kind delete cluster --name slatex
kind load docker-image slatex:1.0 --name slatex
minikube start                             minikube image load slatex:1.0
```

---

## 7. Interview questions and strong answers

### Docker

**1. What problem does Docker solve?**
Environment inconsistency ("works on my machine"). It packages the app with its runtime and dependencies into an image that runs the same everywhere, with process isolation.

**2. Container vs VM?**
VMs virtualize hardware and each carries a full OS kernel. Containers are isolated processes sharing the host kernel (namespaces for isolation, cgroups for limits) — lighter and faster, with weaker isolation than a VM.

**3. Image vs container?**
An image is a read-only, layered package (blueprint). A container is a running instance of an image with a thin writable layer on top.

**4. What are layers and why do they matter?**
Each Dockerfile step creates a cached, shareable read-only layer. Good ordering (dependencies before source) makes rebuilds fast and pulls small.

**5. CMD vs ENTRYPOINT; RUN vs CMD; ARG vs ENV?**
`RUN` executes at build time; `CMD` is the default command at container start. `ENTRYPOINT` is the fixed executable and `CMD` supplies default arguments. `ARG` exists only at build time; `ENV` persists into the image/runtime.

**6. Why multi-stage builds?**
Build tools and dev dependencies are needed to build, not to run. Copying only artifacts into a final stage gives a smaller, more secure image.

**7. How do containers persist data?**
Volumes (named volumes for databases, bind mounts for dev). The container's writable layer is deleted with the container.

**8. How do containers communicate?**
Via Docker networks. On a user-defined network (Compose creates one) containers resolve each other by name. `localhost` inside a container means itself.

**9. Why run Postgres in Docker?**
Fast, disposable, version-pinned, identical for every developer and CI, no host installation, multiple versions side by side. For production a managed DB is usually preferred because a database needs backups, HA and upgrades that managed services handle.

**10. What does `EXPOSE` do?**
Only documents the port. Publishing requires `-p` or Compose `ports`.

**11. `depends_on` vs healthcheck?**
`depends_on` controls start order only. With `condition: service_healthy` and a healthcheck, a service waits until its dependency is actually ready. Apps should still retry connections.

**12. How do you make an image secure?**
Pinned minimal base, multi-stage, non-root user, no secrets in layers, vulnerability scanning, regular rebuilds, read-only FS and dropped capabilities where possible.

**13. Why not `latest`?**
It's mutable, so builds and deployments aren't reproducible and rollback is unclear. Use versioned/commit tags or digests.

**14. A container exits immediately. What do you do?**
`docker ps -a`, `docker logs`, check exit code, environment, `CMD`, and whether the main process stays in the foreground.

**15. What is the Docker socket risk?**
Mounting `/var/run/docker.sock` lets the container control the Docker daemon, which is effectively root on the host.

### Kubernetes

**16. Why Kubernetes if Docker exists?**
Docker runs containers; Kubernetes operates them across many machines: scheduling, self-healing, scaling, rolling updates, service discovery, config/secrets, storage.

**17. Explain desired state.**
You declare what should exist. Controllers continuously compare actual vs desired state and act to reconcile them.

**18. Pod vs Deployment vs Service?**
Pod = smallest runnable unit. Deployment = keeps N replicas and manages rolling updates. Service = stable address and load balancing to Pods selected by labels.

**19. How does a Service find Pods?**
Label selectors. Matching Pods that are Ready become endpoints.

**20. Readiness vs liveness vs startup probes?**
Readiness gates traffic; liveness restarts stuck containers; startup protects slow booting apps from premature liveness failures.

**21. Requests vs limits?**
Requests drive scheduling and reserved capacity; limits cap usage (memory over limit = OOMKill, CPU over limit = throttling).

**22. How does a rolling update work and how do you roll back?**
New Pods are created gradually and must pass readiness before old ones are removed (`maxSurge`, `maxUnavailable`). Roll back with `kubectl rollout undo`.

**23. ConfigMap vs Secret?**
ConfigMap = non-sensitive config; Secret = sensitive values. Secrets are base64 only — protect with RBAC, encryption at rest, or an external secret manager.

**24. How do you expose an app?**
ClusterIP internally; Ingress/Gateway for HTTP from outside; LoadBalancer or NodePort for direct exposure. Ingress needs a controller.

**25. Where do databases belong?**
Prefer managed databases in production. If self-hosting, use StatefulSets/operators with PVCs, backups and tested restores.

**26. CrashLoopBackOff — how do you debug?**
`kubectl describe pod`, `kubectl logs --previous`, check env/Secrets, probes, resource limits and exit code (137 = OOM).

**27. Pod stuck in Pending?**
`describe pod` → events: insufficient resources, unbound PVC, taints/affinity.

**28. ImagePullBackOff?**
Wrong image/tag, no pull secret for a private registry, or (locally) image not loaded into kind/minikube.

**29. How do you scale automatically?**
HPA based on CPU/memory/custom metrics (needs metrics-server and resource requests); Cluster Autoscaler adds nodes. App must be stateless.

**30. When would you not use Kubernetes?**
Small apps/teams: Compose on a VM, PaaS, or serverless containers are simpler and cheaper.

---

## Answers to self-check questions

### From [01 Docker basics](./01-docker-basics.md)
1. `docker run` creates a **new** container and starts it; `docker start` restarts an **existing** stopped one.
2. `EXPOSE` is documentation only; you must publish with `-p`/`ports`.
3. Docker can bypass host firewalls via iptables, so `-p 5432:5432` may expose the DB publicly.
4. Inside the container `127.0.0.1` is only the container; traffic from outside arrives on another interface, so the app must bind `0.0.0.0`.
5. Stopped/exited containers don't appear in `docker ps`, but their logs and exit code explain failures.

### From [02 Dockerfile & images](./02-dockerfile-and-images.md)
1. So the expensive dependency-install layer stays cached unless dependency files change.
2. `RUN` = build time, `CMD` = container start. `ARG` = build-time only, `ENV` = persists in image/runtime.
3. Exec form makes the app PID 1 so it receives SIGTERM for graceful shutdown; shell form wraps it in `/bin/sh`.
4. `latest` is mutable: different machines/times can get different versions; rollback is unclear.
5. Layers are immutable history; a later `rm` adds a layer on top, but the earlier layer still contains the secret.
6. They keep build tools and dev dependencies out of the final image: smaller, faster, safer.

### From [03 Volumes, networking, Compose](./03-volumes-networking-compose.md)
1. `localhost` inside the web container is itself; use the service name (`db`).
2. `down -v` also deletes named volumes (data).
3. `depends_on` only orders startup. Use a healthcheck + `condition: service_healthy` (and app retries).
4. (a) `localhost:5432` via published port; (b) `db:5432` via service name.
5. So only your own machine can reach it, not the whole network/internet.
6. Fast hot reload and easy debugging for app code, while infrastructure stays reproducible.

### From [04 Kubernetes](./04-kubernetes.md)
1. Desired state is what you declared; controllers continuously reconcile reality to match.
2. A bare Pod isn't recreated if it dies; a Deployment replaces, scales and rolls updates.
3. Selector/labels mismatch or Pods not Ready leaves it with no endpoints.
4. Readiness controls traffic (no restart); liveness restarts the container.
5. Over memory limit → OOMKilled; over CPU limit → throttled.
6. It's only base64-encoded; security depends on RBAC, encryption at rest and secret management.
7. kind nodes are containers with their own image store; local images must be loaded in.
8. When the app is small/simple or the team can't operate K8s: Compose on a VM, PaaS, serverless containers.
