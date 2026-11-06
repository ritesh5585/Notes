# 04 — Kubernetes (K8s)

> Goal: understand **why** Kubernetes exists, its core objects, and deploy a real app to a local cluster.
> ← [03 Volumes, networking, Compose](./03-volumes-networking-compose.md) · Next → [05 Troubleshooting & company issues](./05-troubleshooting-and-company-issues.md)

---

## 1. Why Kubernetes exists

Docker runs containers. Compose runs a few on **one machine**. Now imagine production:

```text
50 servers · 200 API replicas · 100 workers
traffic spikes at night · a server dies · a container crashes
you deploy new versions 10 times a day
```

Questions nobody wants to answer by hand:

| Problem | Kubernetes answer |
|---|---|
| Which machine should run this container? | **Scheduler** |
| A container crashed — who restarts it? | **Self-healing** |
| A whole server died — what now? | Pods are recreated on other nodes |
| Traffic doubled — add copies | **Scaling** (manual or automatic) |
| Deploy v2 without downtime | **Rolling updates** + rollback |
| How do containers find each other when IPs keep changing? | **Services** + DNS |
| Where do config and secrets go? | **ConfigMaps / Secrets** |
| Where does persistent data live? | **Volumes / PVCs** |

> **Kubernetes = an operating system for a cluster of machines.** You say what you want; it keeps reality matching it.

### When you do NOT need Kubernetes (honest section)
- One app, one server, few users → **Compose on a VM**, or a **PaaS** (Vercel, Render, Railway, Fly.io).
- Small team without an ops person → K8s adds a lot of YAML, concepts and cost.
- "Everybody uses it" is not a reason. Adopt it when you feel **real pain**: many services, many replicas, strict uptime, multiple teams.

Alternatives: AWS **ECS/Fargate**, Google **Cloud Run**, Azure Container Apps, **Nomad**, Docker **Swarm** (largely out of fashion).

---

## 2. The core idea: desired state + reconciliation

```text
YOU (declare):         "I want 3 copies of backend:1.0 running"   ← DESIRED STATE
                                    │ kubectl apply
                                    ▼
                         API Server stores it
                                    │
              ┌─────────────────────▼─────────────────────┐
              │  CONTROLLERS loop forever:                 │
              │    observe actual state  (2 running)       │
              │    compare to desired    (want 3)          │
              │    act                   (start 1 more)    │
              └────────────────────────────────────────────┘
```

This is the biggest mental shift:
- **Docker (imperative):** "Run this container now." (a command)
- **Kubernetes (declarative):** "This is what the world should look like." (a description). K8s works until reality matches.

If a Pod dies, you did nothing wrong and ran no command — the controller notices the difference and fixes it.

---

## 3. Architecture

```text
                       KUBERNETES CLUSTER
 ┌────────────────────────── CONTROL PLANE (the brain) ──────────────────────────┐
 │  API Server ── the front door; everything talks to it                          │
 │  etcd       ── database of the cluster's desired + current state               │
 │  Scheduler  ── picks a node for each new Pod                                    │
 │  Controller Manager ── runs the reconciliation loops (Deployment, Node, ...)    │
 └───────────────────────────────────────┬────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
 ┌──── WORKER NODE ────┐         ┌──── WORKER NODE ────┐         ┌──── WORKER NODE ────┐
 │ kubelet  (agent)    │         │ kubelet             │         │ kubelet             │
 │ kube-proxy (network)│         │ kube-proxy          │         │ kube-proxy          │
 │ container runtime   │         │ container runtime   │         │ container runtime   │
 │ [Pod] [Pod]         │         │ [Pod] [Pod] [Pod]   │         │ [Pod]               │
 └─────────────────────┘         └─────────────────────┘         └─────────────────────┘
```

| Component | Job |
|---|---|
| **API Server** | REST API; `kubectl` talks only to this. Validates and stores objects |
| **etcd** | Key-value store; the source of truth. **Back it up** in self-managed clusters |
| **Scheduler** | Chooses a node based on resource requests, rules, free capacity |
| **Controller Manager** | Many controllers that make actual state match desired state |
| **kubelet** | On each node: starts containers, reports health |
| **kube-proxy** | Makes Services reachable (network rules) |
| **Container runtime** | Actually runs containers (containerd, CRI-O) |

Managed Kubernetes (EKS, GKE, AKS) runs the control plane for you — you manage workloads.

---

## 4. Local setup (practice cluster on your laptop)

You need **kubectl** (the CLI) and a local cluster.

| Option | Good for | Notes |
|---|---|---|
| **Docker Desktop → Settings → Kubernetes → Enable** | Easiest start | One node; uses your local Docker images directly |
| **kind** ("Kubernetes in Docker") | Fast, disposable, CI | Nodes are Docker containers; **load images** with `kind load docker-image` |
| **minikube** | Learning with add-ons | `minikube addons enable metrics-server` etc. |

```bash
kind create cluster --name slatex     # create a cluster
kubectl cluster-info                  # is the API server reachable?
kubectl get nodes                     # should show a Ready node
kubectl config get-contexts           # which cluster is kubectl pointing at?
kubectl config use-context kind-slatex
```

> **Context** = "which cluster am I talking to?" Many incidents happen because someone ran `kubectl delete` against **production** instead of dev. Always check `kubectl config current-context`.

---

## 5. How to read a kubectl command

```text
kubectl  <verb>  <resource>  [name]  [flags]

kubectl  get     pods                 -n slatex  -o wide
kubectl  describe deployment web      -n slatex
kubectl  logs    web-7c9d-xk2          -n slatex  -f
```

| Part | Examples |
|---|---|
| Verb | `get` list, `describe` details+events, `apply` create/update from file, `delete`, `logs`, `exec`, `edit`, `scale`, `rollout`, `port-forward` |
| Resource | `pods`, `deployments`, `services`, `configmaps`, `secrets`, `ingress`, `pvc`, `nodes`, `events` (short: `po`, `deploy`, `svc`) |
| `-n <ns>` | Namespace (default is `default`). `-A` = all namespaces |
| `-o wide/yaml/json` | Output format |
| `-l app=web` | Filter by label |
| `-f file.yaml` | Use a manifest file or folder |
| `--dry-run=client -o yaml` | Generate YAML without creating anything (great for learning) |

Helpful learning tool:
```bash
kubectl explain deployment.spec.strategy        # built-in docs for any field
```

---

## 6. Core objects (what each is and why)

| Object | What it is | Why it exists |
|---|---|---|
| **Pod** | Smallest unit; wraps 1 (sometimes more) containers sharing network/storage | Containers need a place to run |
| **ReplicaSet** | Keeps N identical Pods | (Created for you by a Deployment) |
| **Deployment** | Declares "N replicas of this Pod template" + rolling updates | Self-healing, scaling, safe releases. **Use this for stateless apps** |
| **Service** | Stable name/IP that load-balances to matching Pods | Pod IPs change constantly |
| **Ingress / Gateway** | HTTP routing from outside the cluster (host/path rules, TLS) | One entry point for many Services |
| **ConfigMap** | Non-secret configuration | Separate config from image |
| **Secret** | Sensitive values (base64-encoded, **not encrypted by default**) | Keep passwords out of images/YAML in git |
| **Namespace** | Logical partition of a cluster | Separate teams/environments, apply quotas/permissions |
| **PersistentVolume (PV)** | A piece of storage | The actual disk |
| **PersistentVolumeClaim (PVC)** | A Pod's *request* for storage | Pods ask; the cluster provides |
| **StorageClass** | How to provision storage dynamically | Cloud disks on demand |
| **StatefulSet** | Pods with stable names and their own disks | Databases, queues |
| **Job / CronJob** | Run-to-completion / scheduled tasks | Migrations, reports, cleanups |
| **HPA** | Horizontal Pod Autoscaler | Add/remove Pods based on load |
| **DaemonSet** | One Pod per node | Log/monitoring agents |

```text
Deployment ──manages──▶ ReplicaSet ──creates──▶ Pods ──run──▶ Containers
Service ──selector (labels)──▶ Pods
```

---

## 7. YAML anatomy + labels

Every object has four top-level parts:

```yaml
apiVersion: apps/v1         # which API group/version defines this kind
kind: Deployment            # what type of object
metadata:                   # identity
  name: web
  namespace: slatex
  labels: { app: web }      # tags you invent
spec:                       # the DESIRED state (differs per kind)
  ...
```

### Labels and selectors = how things find each other

```text
Pod labels:         app=web
Service selector:   app=web   → sends traffic to every Pod with this label
Deployment selector: app=web   → manages Pods with this label
```

**If the selector doesn't match the Pod labels, the Service has no endpoints** — the classic "everything is Running but nothing works".

---

## 8. Pods

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello
spec:
  containers:
    - name: hello
      image: nginx:1.27
      ports:
        - containerPort: 80
```

You rarely create bare Pods. A bare Pod that dies **stays dead**. Use a **Deployment** so a controller recreates it.

---

## 9. Deployments — the workhorse

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: slatex
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1            # may create 1 extra Pod during the update
      maxUnavailable: 0      # never drop below desired count
  template:                  # the Pod template
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: slatex:1.0
          ports:
            - containerPort: 3000
```

What you get for free: replacement of dead Pods, scaling, rolling updates, rollback history.

---

## 10. Services — stable networking

Pod IPs are temporary. A Service gives a stable **name** (DNS) and IP.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: slatex
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80          # Service port (what others call)
      targetPort: 3000  # container port inside the Pod
```

| Type | Reachable from | Use |
|---|---|---|
| **ClusterIP** (default) | Inside the cluster only | Internal services, DB, API behind an Ingress |
| **NodePort** | `nodeIP:30000-32767` | Quick tests |
| **LoadBalancer** | Internet via a cloud load balancer | Direct exposure on cloud (costs money per LB) |
| **ExternalName** | Maps to an external DNS name | Point to an outside service |

Inside the cluster, another Pod can call `http://web` (same namespace) or `http://web.slatex.svc.cluster.local`.

### Ingress (HTTP entry point)

```text
Internet ─▶ Load Balancer ─▶ Ingress Controller ─▶ Service ─▶ Pods
```
An Ingress object is just **rules**; you must install an **Ingress controller** (e.g., NGINX-based, Traefik) to act on them. Kubernetes also has the newer **Gateway API** as the evolving standard — check the current status of the controller you choose.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
  namespace: slatex
spec:
  rules:
    - host: slatex.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

---

## 11. Config and Secrets

**Why not bake config into the image?** Same image must run in dev/staging/prod with different settings.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
  namespace: slatex
data:
  NODE_ENV: production
  LOG_LEVEL: info
```

Create a Secret **from the command line** so values don't sit in a git-tracked YAML:

```bash
kubectl create secret generic web-secret -n slatex \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/slatex' \
  --from-literal=GITHUB_TOKEN='ghp_xxx'
```

Use them in the Pod:

```yaml
containers:
  - name: web
    image: slatex:1.0
    envFrom:
      - configMapRef: { name: web-config }
      - secretRef:    { name: web-secret }
```

> ⚠️ A Secret is **base64**, not encryption. Anyone with permission to read Secrets (or the etcd data) can decode it. Real clusters add: RBAC (who can read secrets), **encryption at rest**, and often an external secret manager (Vault, cloud secret managers, External Secrets).

---

## 12. Health probes — critical for real deployments

K8s can't know if your app is *really* working unless you tell it how to check.

| Probe | Question | If it fails |
|---|---|---|
| **Readiness** | "Can you receive traffic now?" | Pod is removed from the Service (no traffic) — **no restart** |
| **Liveness** | "Are you stuck/dead?" | Container is **restarted** |
| **Startup** | "Have you finished booting?" (slow apps) | Delays other probes; kills if it never starts |

```yaml
readinessProbe:
  httpGet: { path: /api/health, port: 3000 }
  initialDelaySeconds: 5
  periodSeconds: 5
livenessProbe:
  httpGet: { path: /api/health, port: 3000 }
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3
```

**Without a readiness probe**, during a rolling update traffic reaches a Pod that is still booting → errors.
**Don't make liveness depend on the database.** If the DB blips, every Pod "fails" liveness → mass restarts → bigger outage.

---

## 13. Resource requests and limits

```yaml
resources:
  requests:            # what the scheduler RESERVES for you
    cpu: 100m          # 100 millicores = 0.1 CPU
    memory: 128Mi
  limits:              # the ceiling
    memory: 256Mi
```

| | Meaning | If exceeded |
|---|---|---|
| **requests** | Used for **scheduling** ("does this node have room?") and autoscaling math | — |
| **limits (memory)** | Hard ceiling | Container is **OOMKilled** (exit 137) |
| **limits (cpu)** | Ceiling | Container is **throttled** (slow), not killed |

**Without requests/limits:** one runaway Pod can starve others (noisy neighbour), the scheduler overpacks nodes, HPA can't compute CPU %. Set them on every workload.

---

## 14. Storage

```text
Pod ──mounts──▶ PVC (claim: "I need 5Gi") ──bound to──▶ PV (actual disk) ◀── StorageClass (creates it on demand)
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
  namespace: slatex
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi
```
Mount in a Pod:
```yaml
volumes:
  - name: data
    persistentVolumeClaim: { claimName: data }
containers:
  - name: app
    volumeMounts:
      - { name: data, mountPath: /var/lib/app }
```

### Should the database run in Kubernetes?

| Option | Verdict |
|---|---|
| **Managed DB** (RDS, Cloud SQL, Neon, Supabase) | **Default choice for production.** Backups, failover, patching handled |
| DB in K8s via **StatefulSet** / an **operator** (CloudNativePG, etc.) | Possible, but you own backups, upgrades, HA, tuning, disaster recovery |
| Plain Deployment with one PVC | OK for dev/learning only |

---

## 15. Scaling

```bash
kubectl scale deployment web --replicas=5 -n slatex     # manual
```

Automatic (HPA) — needs **metrics-server** installed and **CPU requests** set:

```bash
kubectl autoscale deployment web --cpu-percent=70 --min=2 --max=10 -n slatex
kubectl get hpa -n slatex
```
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: web, namespace: slatex }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```
Scaling replicas works only if your app is **stateless** (sessions in Redis/DB, not in memory) — otherwise users hit different Pods and "lose" their session.

---

## 16. Rolling updates and rollback

```bash
kubectl set image deployment/web web=slatex:1.1 -n slatex   # trigger new version
kubectl rollout status deployment/web -n slatex             # watch progress
kubectl rollout history deployment/web -n slatex
kubectl rollout undo deployment/web -n slatex               # roll back!
```

```text
v1 v1 v1   →   v1 v1 v1 v2   →   v1 v1 v2 v2   →   v1 v2 v2 v2   →   v2 v2 v2
                (new Pod must pass readiness before an old one is removed)
```
This is why **readiness probes and versioned tags** matter: safe rollout needs to know when the new Pod is healthy, and rollback needs a known previous version.

---

## 17. Project walkthrough: deploy Slatex to a local cluster

### Prerequisites
- `Dockerfile` from file 02 (Next.js standalone) and a `/api/health` route returning `200`.
- `kind`, `kubectl`, Docker running.

### Step 1 — Folder for manifests
```text
k8s/
├── 00-namespace.yaml
├── 10-configmap.yaml
├── 20-deployment.yaml
└── 30-service.yaml
```

### Step 2 — Manifests

`00-namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: slatex
```

`10-configmap.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
  namespace: slatex
data:
  NODE_ENV: production
```

`20-deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: slatex
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: slatex:1.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef: { name: web-config }
            - secretRef:    { name: web-secret }
          readinessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 5
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 15
            periodSeconds: 10
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits:   { memory: 256Mi }
```

`30-service.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: slatex
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 3000
```

### Step 3 — Build, load, deploy

```bash
# 1. build the image locally
docker build -t slatex:1.0 .

# 2. create cluster and make the image available INSIDE kind
kind create cluster --name slatex
kind load docker-image slatex:1.0 --name slatex

# 3. namespace first, then the secret, then everything else
kubectl apply -f k8s/00-namespace.yaml
kubectl create secret generic web-secret -n slatex \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=GITHUB_TOKEN='ghp_xxx'
kubectl apply -f k8s/

# 4. watch
kubectl get pods -n slatex -w
```

### Step 4 — Open it

```bash
kubectl port-forward svc/web 8080:80 -n slatex
# open http://localhost:8080
```

### Why these specific choices?

| Choice | Reason |
|---|---|
| Tag `1.0`, not `latest` | `latest` defaults to `imagePullPolicy: Always` → kind tries to pull from the internet and fails (`ErrImagePull`) |
| `kind load docker-image` | kind's nodes are separate containers; they don't see your laptop's Docker images automatically |
| `maxUnavailable: 0` + readiness probe | Zero-downtime rollouts |
| Secret created with `kubectl create` | Real values never enter git |
| `port-forward` | Quick local access without Ingress/LoadBalancer |

### Step 5 — Try the superpowers

```bash
kubectl delete pod -l app=web -n slatex        # kill Pods → watch them come back
kubectl scale deployment web --replicas=4 -n slatex
# build slatex:1.1, load it, then:
kubectl set image deployment/web web=slatex:1.1 -n slatex
kubectl rollout status deployment/web -n slatex
kubectl rollout undo deployment/web -n slatex
```

Clean up: `kind delete cluster --name slatex`

---

## 18. Next-level topics (know the names)

| Topic | One line |
|---|---|
| **Namespaces + ResourceQuota** | Separate teams/envs and cap their usage |
| **RBAC** | Who can do what in the cluster (never give everyone `cluster-admin`) |
| **NetworkPolicy** | Firewall rules between Pods (default is "everything can talk to everything") |
| **Helm** | Package manager/templating for K8s YAML (charts, values per environment) |
| **Kustomize** | Overlay-based customization (base + dev/prod patches), built into `kubectl -k` |
| **GitOps (Argo CD / Flux)** | Git is the source of truth; cluster syncs automatically |
| **Observability** | Metrics (Prometheus/Grafana), logs (Loki/ELK), traces (OpenTelemetry) |
| **PodDisruptionBudget** | Keep minimum Pods during maintenance |
| **Affinity / taints** | Control where Pods may run |
| **Security context** | Non-root, read-only FS, drop capabilities |

---

## ✅ Self-check

1. What does "desired state" mean, and who makes reality match it?
2. Why do we use a Deployment instead of a bare Pod?
3. Why can a Service exist with no working endpoints?
4. Difference between readiness and liveness probes?
5. What happens to a container that exceeds its memory limit? Its CPU limit?
6. Why is a Kubernetes Secret not "secure by default"?
7. Why does `kind` need `kind load docker-image`?
8. When would you choose Compose or a PaaS instead of Kubernetes?

Answers → [06 cheatsheet](./06-command-cheatsheet.md#answers-to-self-check-questions).
