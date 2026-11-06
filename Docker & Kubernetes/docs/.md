# Docker & Kubernetes --- Practical Engineering Guide

> **From "it works on my machine" to reproducible environments and
> production orchestration.**
>
------------------------------------------------------------------------

## Table of Contents

-   [1. The Problem Docker Solves](#1-the-problem-docker-solves)
-   [2. What Docker Actually Is](#2-what-docker-actually-is)
-   [3. Image vs Container](#3-image-vs-container)
-   [4. How Docker Works](#4-how-docker-works)
-   [5. Install and Verify](#5-install-and-verify)
-   [6. Run Your First Container](#6-run-your-first-container)
-   [7. Dockerfile](#7-dockerfile)
-   [8. Build and Run Flow](#8-build-and-run-flow)
-   [9. Images and Registries](#9-images-and-registries)
-   [10. Container Lifecycle](#10-container-lifecycle)
-   [11. Ports and Port Mapping](#11-ports-and-port-mapping)
-   [12. Environment Variables](#12-environment-variables)
-   [13. Volumes and Persistence](#13-volumes-and-persistence)
-   [14. Docker Networking](#14-docker-networking)
-   [15. Docker Compose](#15-docker-compose)
-   [16. Full-Stack Compose Example](#16-full-stack-compose-example)
-   [17. Docker Debugging](#17-docker-debugging)
-   [18. Common Docker Failures](#18-common-docker-failures)
-   [19. Development vs Production](#19-development-vs-production)
-   [20. Why Kubernetes Exists](#20-why-kubernetes-exists)
-   [21. Docker vs Compose vs
    Kubernetes](#21-docker-vs-compose-vs-kubernetes)
-   [22. Kubernetes Architecture](#22-kubernetes-architecture)
-   [23. Kubernetes Core Objects](#23-kubernetes-core-objects)
-   [24. Deployment Example](#24-deployment-example)
-   [25. Services and Networking](#25-services-and-networking)
-   [26. ConfigMaps and Secrets](#26-configmaps-and-secrets)
-   [27. Storage](#27-storage)
-   [28. Scaling](#28-scaling)
-   [29. Rolling Deployments](#29-rolling-deployments)
-   [30. Kubernetes Debugging](#30-kubernetes-debugging)
-   [31. Essential Command Cheat
    Sheet](#31-essential-command-cheat-sheet)
-   [32. Learning Path](#32-learning-path)
-   [33. Final Mental Models](#33-final-mental-models)

------------------------------------------------------------------------

# 1. The Problem Docker Solves

Before Docker, a typical application depended heavily on the machine it
ran on.

For example:

``` text
Developer A
├── Node.js 20
├── MongoDB installed
├── Redis installed
├── OS-specific configuration
└── environment variables
```

Another developer might have:

``` text
Developer B
├── Node.js 18
├── MongoDB missing
├── different package versions
└── different OS configuration
```

The result:

``` text
“It works on my machine.”
```

The real problem is **environment inconsistency**.

Docker addresses this by packaging an application's runtime environment
into a reproducible image and running it as a container.

### The bigger idea

``` text
Application
    +
Runtime
    +
Dependencies
    +
Configuration
    ↓
Reproducible environment
```

Docker is therefore not primarily a "deployment trick". Its core value
is **environment standardization and process isolation**.

------------------------------------------------------------------------

# 2. What Docker Actually Is

Docker is a platform for building, distributing and running applications
as containers.

A useful mental model:

``` text
Dockerfile
    ↓
Docker Image
    ↓
Docker Container
```

### Container

A container is an isolated process environment in which your application
runs.

It can have its own:

-   filesystem view
-   process tree
-   network namespace
-   environment variables
-   resource limits

But a container is **not a virtual machine**. Containers normally share
the host kernel.

------------------------------------------------------------------------

# 3. Image vs Container

This distinction is fundamental.

  -----------------------------------------------------------------------
  Concept                 Meaning                 Mental model
  ----------------------- ----------------------- -----------------------
  Dockerfile              Build instructions      Recipe

  Image                   Immutable packaged      Blueprint
                          artifact                

  Container               Running instance of an  Actual running
                          image                   machine/process

  Volume                  Persistent data         Storage room

  Network                 Container communication Private network

  Compose                 Multi-container         Application blueprint
                          definition              
  -----------------------------------------------------------------------

One image can create many containers:

``` text
                 node:20-alpine
                       │
             ┌─────────┼─────────┐
             ↓         ↓         ↓
        Container A  Container B  Container C
```

------------------------------------------------------------------------

# 4. How Docker Works

The simplified architecture is:

``` text
Your Terminal
     │
     ▼
Docker CLI
     │
     ▼
Docker Engine
     │
 ┌───┼───────────────┐
 ↓   ↓               ↓
Images Containers  Networks
         │
         ↓
      Volumes
```

When you execute:

``` bash
docker run -p 3000:3000 my-app
```

Docker roughly performs:

``` text
1. Find image
2. Pull it if necessary
3. Create a container
4. Create/configure networking
5. Create the writable container layer
6. Configure environment variables and mounts
7. Start the container's main process
```

The application itself is still just a process running inside that
environment.

------------------------------------------------------------------------

# 5. Install and Verify

Install **Docker Desktop** on Windows or macOS.

Check Docker CLI:

``` bash
docker --version
```

Check Compose:

``` bash
docker compose version
```

Check the Docker Engine:

``` bash
docker info
```

Run the test image:

``` bash
docker run hello-world
```

If that works, the basic Docker installation is operational.

------------------------------------------------------------------------

# 6. Run Your First Container

Start nginx:

``` bash
docker run nginx
```

Docker will pull the image if it does not exist locally.

But nginx is listening inside the container. To expose it to your
machine:

``` bash
docker run --name web -p 8080:80 nginx
```

Now:

``` text
Browser
  │
  │ http://localhost:8080
  ▼
Host port 8080
  │
  │ Docker port mapping
  ▼
Container port 80
  │
  ▼
Nginx
```

Stop it:

``` bash
docker stop web
```

Remove it:

``` bash
docker rm web
```

------------------------------------------------------------------------

# 7. Dockerfile

A `Dockerfile` tells Docker how to build an image.

Example Node.js API:

``` dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

## `FROM`

``` dockerfile
FROM node:20-alpine
```

Starts from an existing Node.js image.

## `WORKDIR`

``` dockerfile
WORKDIR /app
```

Sets the working directory inside the image/container.

## `COPY`

``` dockerfile
COPY package*.json ./
```

Copies package manifests.

Then:

``` dockerfile
RUN npm ci
```

installs dependencies.

Finally:

``` dockerfile
COPY . .
```

copies application source.

## Why copy package files first?

Docker builds images in layers. Dependencies often change less
frequently than source code, so Docker can reuse the dependency layer
during later builds.

``` text
package.json
    ↓
npm ci
    ↓
Dependency layer  ← reusable cache
    ↓
Source code
```

## `EXPOSE`

``` dockerfile
EXPOSE 3000
```

Documents the application's intended container port.

It does **not** publish that port to your host. Publishing is done with
`-p`.

## `CMD`

``` dockerfile
CMD ["npm", "start"]
```

Defines the default process started when the container runs.

------------------------------------------------------------------------

# 8. Build and Run Flow

Build an image:

``` bash
docker build -t my-app:1.0 .
```

Run it:

``` bash
docker run --name my-app -p 3000:3000 my-app:1.0
```

The complete flow:

``` text
Dockerfile
    ↓
docker build
    ↓
Image
    ↓
docker run
    ↓
Container
    ↓
Application process
```

This distinction is important:

> **Build creates an image. Run creates a container from that image.**

------------------------------------------------------------------------

# 9. Images and Registries

List images:

``` bash
docker image ls
```

Pull an image:

``` bash
docker pull node:20-alpine
```

Inspect:

``` bash
docker image inspect my-app:1.0
```

View layers/history:

``` bash
docker history my-app:1.0
```

Tag:

``` bash
docker tag my-app:1.0 username/my-app:1.0
```

Push to a registry:

``` bash
docker push username/my-app:1.0
```

Conceptually:

``` text
Developer
   ↓
docker build
   ↓
Image
   ↓
docker push
   ↓
Container Registry
   ↓
Server / CI / Kubernetes
   ↓
docker pull
```

A registry is the distribution layer for images.

------------------------------------------------------------------------

# 10. Container Lifecycle

List running containers:

``` bash
docker ps
```

List all containers:

``` bash
docker ps -a
```

Stop:

``` bash
docker stop <container>
```

Start an existing stopped container:

``` bash
docker start <container>
```

Restart:

``` bash
docker restart <container>
```

Remove:

``` bash
docker rm <container>
```

Force remove:

``` bash
docker rm -f <container>
```

View logs:

``` bash
docker logs <container>
```

Follow logs:

``` bash
docker logs -f <container>
```

Execute a shell:

``` bash
docker exec -it <container> sh
```

Inspect metadata:

``` bash
docker inspect <container>
```

Check CPU/memory/network usage:

``` bash
docker stats
```

------------------------------------------------------------------------

# 11. Ports and Port Mapping

Suppose your application listens on:

``` text
container:3000
```

To expose it on host port `8080`:

``` bash
docker run -p 8080:3000 my-app
```

Format:

``` text
HOST_PORT:CONTAINER_PORT
```

So:

``` text
localhost:8080
      ↓
container:3000
```

A common beginner mistake is to think:

``` dockerfile
EXPOSE 3000
```

means the browser can automatically access port `3000`.

It does not. You need port publishing:

``` bash
-p 3000:3000
```

------------------------------------------------------------------------

# 12. Environment Variables

Applications commonly need configuration:

``` env
PORT=3000
DATABASE_URL=...
JWT_SECRET=...
REDIS_URL=...
```

Pass variables directly:

``` bash
docker run \
  -e PORT=3000 \
  -e NODE_ENV=production \
  my-app
```

Or from a file:

``` bash
docker run --env-file .env my-app
```

### Important security rule

Do not bake secrets into images:

``` dockerfile
# Avoid this
ENV JWT_SECRET=my-secret
```

Use runtime configuration or a proper secrets-management system.

Also add `.env` to `.gitignore` and `.dockerignore` where appropriate.

------------------------------------------------------------------------

# 13. Volumes and Persistence

Containers are designed to be replaceable.

A database needs data to survive container recreation.

Use a volume:

``` bash
docker volume create postgres-data
```

List:

``` bash
docker volume ls
```

Inspect:

``` bash
docker volume inspect postgres-data
```

Run PostgreSQL:

``` bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:16
```

The flow is:

``` text
Postgres container
       │
       │ writes
       ▼
postgres-data volume
       │
       ▼
Persistent data
```

Mental model:

``` text
Container = compute
Volume    = persistence
```

------------------------------------------------------------------------

# 14. Docker Networking

Containers have isolated networking.

Create a network:

``` bash
docker network create app-network
```

Start MongoDB:

``` bash
docker run -d \
  --name mongo \
  --network app-network \
  mongo
```

Start backend on the same network:

``` bash
docker run -d \
  --name backend \
  --network app-network \
  my-backend
```

The backend can reach MongoDB using its container name:

``` text
mongodb://mongo:27017
```

Why not `localhost`?

Because inside the backend container:

``` text
localhost
   ↓
backend container itself
```

while:

``` text
mongo
   ↓
Docker's network DNS
   ↓
MongoDB container
```

This is a critical mental model.

------------------------------------------------------------------------

# 15. Docker Compose

When an application contains:

``` text
frontend
backend
database
redis
```

manually running each container becomes painful.

Compose lets you define the application as YAML.

Example:

``` yaml
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/app
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres-data:
```

Start:

``` bash
docker compose up
```

Background:

``` bash
docker compose up -d
```

Build and start:

``` bash
docker compose up --build
```

Stop/remove containers and network:

``` bash
docker compose down
```

Also remove Compose-managed volumes:

``` bash
docker compose down -v
```

List services:

``` bash
docker compose ps
```

Logs:

``` bash
docker compose logs
```

Follow one service:

``` bash
docker compose logs -f backend
```

Run a command inside a service container:

``` bash
docker compose exec backend sh
```

### Compose networking

Compose creates a network for the application.

Therefore the backend can use:

``` text
postgresql://postgres:password@db:5432/app
```

and:

``` text
redis://redis:6379
```

The service names become useful DNS names.

------------------------------------------------------------------------

# 16. Full-Stack Compose Example

A typical application:

``` text
                 Browser
                    │
                    ▼
                Frontend
                    │
                    ▼
                Backend API
                 /       \
                ▼         ▼
          PostgreSQL     Redis
```

Example:

``` yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/app
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: app
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres-data:
```

Run:

``` bash
docker compose up --build
```

Request flow:

``` text
Browser
   │
   ▼
localhost:3000
   │
   ▼
frontend container
   │
   ▼
backend container
   │
   ├──► db:5432
   │
   └──► redis:6379
```

------------------------------------------------------------------------

# 17. Docker Debugging

Do not debug Docker by repeatedly doing:

``` bash
docker compose down
 docker compose up --build
```

without understanding the failure.

Use a layered debugging process.

``` text
Is container running?
       ↓
Does process stay alive?
       ↓
Are logs correct?
       ↓
Are environment variables present?
       ↓
Is the port published?
       ↓
Can containers resolve each other?
       ↓
Can the database be reached?
       ↓
Is persistent data mounted?
```

### Commands

``` bash
docker ps
```

``` bash
docker ps -a
```

``` bash
docker logs <container>
```

``` bash
docker logs -f <container>
```

``` bash
docker exec -it <container> sh
```

``` bash
docker inspect <container>
```

``` bash
docker network ls
```

``` bash
docker network inspect <network>
```

``` bash
docker volume ls
```

``` bash
docker stats
```

------------------------------------------------------------------------

# 18. Common Docker Failures

## Port already in use

``` text
Bind failed
```

Find the Windows process:

``` powershell
netstat -ano | findstr :3000
```

Or use another host port:

``` bash
docker run -p 3001:3000 my-app
```

------------------------------------------------------------------------

## Container exits immediately

Check:

``` bash
docker ps -a
```

Then:

``` bash
docker logs <container>
```

Typical causes:

-   application crashed
-   wrong `CMD`
-   missing environment variable
-   dependency failure
-   invalid configuration

------------------------------------------------------------------------

## Database connection fails

If backend and database are separate containers, avoid:

``` text
localhost:5432
```

Use the service/container DNS name:

``` text
db:5432
```

------------------------------------------------------------------------

## Host `node_modules` causes trouble

Use `.dockerignore`:

``` text
node_modules
.git
.env
.next
dist
coverage
```

Install dependencies inside the image rather than copying host-specific
dependencies.

------------------------------------------------------------------------

# 19. Development vs Production

## Development

Optimize for:

-   fast iteration
-   hot reload
-   source visibility
-   easy debugging
-   useful logs

## Production

Optimize for:

-   security
-   reproducibility
-   small images
-   predictable startup
-   non-root execution
-   health checks
-   observability
-   controlled configuration

### Multi-stage build

``` dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

CMD ["node", "dist/server.js"]
```

The builder contains build-time dependencies. The final image contains
only what the application needs to run.

------------------------------------------------------------------------

# 20. Why Kubernetes Exists

Docker is excellent for packaging and running containers.

But imagine:

``` text
1 server
3 containers
```

Then:

``` text
50 servers
200 backend replicas
100 workers
traffic spikes
machines fail
containers crash
new versions deploy every day
```

Managing all of this manually becomes difficult.

Kubernetes is a **container orchestration platform** designed to manage
workloads across a cluster.

It answers questions like:

-   Where should this workload run?
-   How many replicas should exist?
-   What if a Pod crashes?
-   How should traffic reach Pods?
-   How do we roll out a new version?
-   How do we scale?
-   How do we maintain the desired state?

------------------------------------------------------------------------

# 21. Docker vs Compose vs Kubernetes

  -------------------------------------------------------------------------
  Capability               Docker CLI     Docker Compose         Kubernetes
  ---------------- ------------------ ------------------ ------------------
  Build images                    Yes  Uses Docker build      Uses existing
                                                                     images

  Run containers                  Yes                Yes  Yes, through Pods

  Local                         Basic          Excellent      Possible, but
  multi-service                                                       heavy
  development                                            

  Service                       Basic                Yes                Yes
  discovery                                              

  Persistent                  Volumes            Volumes PV/PVC and storage
  storage                                                           classes

  Multi-machine                    No       Not its main                Yes
  cluster                                        purpose 

  Self-healing                Limited            Limited                Yes
  workloads                                              

  Rolling                      Manual            Limited           Built-in
  deployments                                            

  Autoscaling                      No            Limited                Yes

  Scheduling                       No                 No                Yes

  Desired-state                    No            Limited                Yes
  reconciliation                                         
  -------------------------------------------------------------------------

### The progression

``` text
Docker
  ↓
Run one or a few containers

Compose
  ↓
Run a multi-container application together

Kubernetes
  ↓
Operate many workloads across a cluster
```

Kubernetes does not make Dockerfiles obsolete.

The typical flow remains:

``` text
Source
  ↓
Dockerfile
  ↓
Image
  ↓
Container Registry
  ↓
Kubernetes
  ↓
Pods
```

------------------------------------------------------------------------

# 22. Kubernetes Architecture

A simplified cluster:

``` text
                  Kubernetes Cluster
                         │
          ┌──────────────┴──────────────┐
          │                             │
     Control Plane                   Worker Nodes
          │                             │
    ┌─────┼─────┐                ┌─────┴─────┐
    │     │     │                │           │
   API Scheduler Controller      Pod         Pod
  Server         Manager
```

### Control Plane

Coordinates the cluster and stores/serves desired state.

Important components include:

-   API server
-   scheduler
-   controller managers
-   cluster state storage

### Worker Node

Runs workloads through a container runtime and Kubernetes node
components.

------------------------------------------------------------------------

# 23. Kubernetes Core Objects

Start with these:

``` text
Pod
Deployment
Service
ConfigMap
Secret
PersistentVolume
PersistentVolumeClaim
Namespace
```

## Pod

The smallest deployable unit in Kubernetes.

Usually:

``` text
Pod
└── Container
```

A Pod may contain more than one tightly coupled container.

## Deployment

Manages a desired number of replicated Pods.

``` text
Deployment
   │
   ├── Pod
   ├── Pod
   └── Pod
```

If one disappears, the controller works toward restoring the desired
replica count.

## Service

Provides a stable network identity and routes traffic to matching Pods.

``` text
Service
   │
 ┌─┼───────┐
 ▼ ▼       ▼
Pod Pod    Pod
```

## Namespace

Logical isolation/grouping within a cluster.

------------------------------------------------------------------------

# 24. Deployment Example

Create `backend-deployment.yaml`:

``` yaml
apiVersion: apps/v1
kind: Deployment

metadata:
  name: backend

spec:
  replicas: 3

  selector:
    matchLabels:
      app: backend

  template:
    metadata:
      labels:
        app: backend

    spec:
      containers:
        - name: backend
          image: username/backend:1.0
          ports:
            - containerPort: 5000
```

Apply:

``` bash
kubectl apply -f backend-deployment.yaml
```

Check:

``` bash
kubectl get deployments
kubectl get pods
```

More detail:

``` bash
kubectl get pods -o wide
```

Inspect:

``` bash
kubectl describe deployment backend
```

The important idea is **desired state**:

``` text
You declare:
replicas = 3

Kubernetes continuously tries to make reality:
3 healthy replicas
```

------------------------------------------------------------------------

# 25. Services and Networking

Pods can be recreated, so their IP addresses should not be treated as
permanent application endpoints.

Create a Service:

``` yaml
apiVersion: v1
kind: Service

metadata:
  name: backend

spec:
  selector:
    app: backend

  ports:
    - port: 80
      targetPort: 5000
```

Apply:

``` bash
kubectl apply -f backend-service.yaml
```

Now other workloads can use the Service name rather than a Pod IP.

``` text
backend Service
      │
      ├── Pod A
      ├── Pod B
      └── Pod C
```

Useful commands:

``` bash
kubectl get services
```

``` bash
kubectl describe service backend
```

The selector is critical:

``` yaml
selector:
  app: backend
```

must match the Pod labels:

``` yaml
labels:
  app: backend
```

A mismatch can produce a Service with no useful endpoints.

------------------------------------------------------------------------

# 26. ConfigMaps and Secrets

## ConfigMap

For non-secret configuration:

``` yaml
apiVersion: v1
kind: ConfigMap

metadata:
  name: backend-config

data:
  NODE_ENV: production
  LOG_LEVEL: info
```

Create/apply:

``` bash
kubectl apply -f configmap.yaml
```

## Secret

For sensitive values:

``` yaml
apiVersion: v1
kind: Secret

metadata:
  name: backend-secret

type: Opaque

stringData:
  DATABASE_PASSWORD: change-me
```

Apply:

``` bash
kubectl apply -f secret.yaml
```

Important:

> Kubernetes Secrets are not automatically a complete secrets-management
> solution. Production systems should also consider RBAC, encryption at
> rest and dedicated secret-management systems where appropriate.

------------------------------------------------------------------------

# 27. Storage

Pods are replaceable, so persistent application data needs a storage
abstraction.

Common concepts:

``` text
PersistentVolume (PV)
        ▲
        │ bound to
        │
PersistentVolumeClaim (PVC)
        ▲
        │ mounted by
        │
       Pod
```

Mental model:

``` text
Pod = compute
PVC = request for storage
PV  = storage resource
```

In production, databases are often better provided by managed database
services unless there is a strong reason to operate them inside the
cluster.

------------------------------------------------------------------------

# 28. Scaling

Manual scaling:

``` bash
kubectl scale deployment backend --replicas=5
```

Check:

``` bash
kubectl get pods
```

Conceptually:

``` text
Deployment
   │
   ├── Pod 1
   ├── Pod 2
   ├── Pod 3
   ├── Pod 4
   └── Pod 5
```

For automatic scaling, Kubernetes can use a Horizontal Pod Autoscaler
when the cluster has the required metrics infrastructure.

Example:

``` bash
kubectl autoscale deployment backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

Check:

``` bash
kubectl get hpa
```

------------------------------------------------------------------------

# 29. Rolling Deployments

Suppose production currently uses:

``` text
backend:1.0
```

Build and publish:

``` text
backend:2.0
```

Update the Deployment:

``` bash
kubectl set image deployment/backend \
  backend=username/backend:2.0
```

Watch rollout:

``` bash
kubectl rollout status deployment/backend
```

View history:

``` bash
kubectl rollout history deployment/backend
```

Rollback:

``` bash
kubectl rollout undo deployment/backend
```

This is a major orchestration capability: the desired version can change
while Kubernetes manages replacement of old replicas.

------------------------------------------------------------------------

# 30. Kubernetes Debugging

Debug from the outside inward:

``` text
User
 ↓
Load Balancer / Ingress
 ↓
Service
 ↓
Pod
 ↓
Container
 ↓
Application
```

## Check Pods

``` bash
kubectl get pods
```

If you see:

``` text
CrashLoopBackOff
```

check:

``` bash
kubectl logs <pod>
```

and:

``` bash
kubectl describe pod <pod>
```

## Check Deployment

``` bash
kubectl get deployments
kubectl describe deployment backend
```

## Check Service

``` bash
kubectl get services
kubectl describe service backend
```

Check whether selectors match labels.

## Check Events

``` bash
kubectl get events --sort-by=.lastTimestamp
```

Events are especially useful for:

-   image pull failures
-   scheduling failures
-   volume problems
-   readiness/liveness issues

## Execute inside a Pod

``` bash
kubectl exec -it <pod> -- sh
```

## Port forwarding for debugging

``` bash
kubectl port-forward service/backend 8080:80
```

Then access:

``` text
http://localhost:8080
```

------------------------------------------------------------------------

# 31. Essential Command Cheat Sheet

## Docker

``` bash
# Basics
docker --version
docker info

# Images
docker image ls
docker pull nginx
docker build -t my-app:1.0 .
docker image inspect my-app:1.0
docker history my-app:1.0
docker tag my-app:1.0 username/my-app:1.0
docker push username/my-app:1.0

# Containers
docker run nginx
docker run -d --name web -p 8080:80 nginx
docker ps
docker ps -a
docker stop web
docker start web
docker restart web
docker rm web
docker rm -f web

# Debugging
docker logs web
docker logs -f web
docker exec -it web sh
docker inspect web
docker stats

# Networks
docker network ls
docker network create app-network
docker network inspect app-network

# Volumes
docker volume ls
docker volume create app-data
docker volume inspect app-data

# Cleanup - review before using
docker container prune
docker image prune
docker volume prune
docker network prune
```

## Docker Compose

``` bash
docker compose up
docker compose up -d
docker compose up --build
docker compose down
docker compose down -v
docker compose ps
docker compose logs
docker compose logs -f backend
docker compose exec backend sh
docker compose build
docker compose pull
```

## Kubernetes

``` bash
# Cluster
kubectl cluster-info
kubectl get nodes

# Resources
kubectl get pods
kubectl get pods -o wide
kubectl get deployments
kubectl get services
kubectl get all

# Apply/delete
kubectl apply -f app.yaml
kubectl delete -f app.yaml

# Inspect
kubectl describe pod <pod>
kubectl describe deployment <deployment>
kubectl describe service <service>

# Logs
kubectl logs <pod>
kubectl logs -f <pod>

# Shell
kubectl exec -it <pod> -- sh

# Debug network locally
kubectl port-forward service/backend 8080:80

# Scale
kubectl scale deployment backend --replicas=3
kubectl get hpa

# Rollouts
kubectl rollout status deployment/backend
kubectl rollout history deployment/backend
kubectl rollout undo deployment/backend

# Events
kubectl get events --sort-by=.lastTimestamp
```

------------------------------------------------------------------------

# 32. Learning Path

Do not learn Docker/Kubernetes by memorizing commands.

Learn in this order:

``` text
Linux processes
      ↓
Docker image
      ↓
Docker container
      ↓
Dockerfile
      ↓
Ports
      ↓
Networks
      ↓
Volumes
      ↓
Compose
      ↓
Debugging
      ↓
Production images
      ↓
Kubernetes Pod
      ↓
Deployment
      ↓
Service
      ↓
ConfigMap / Secret
      ↓
Storage
      ↓
Scaling
      ↓
Rolling deployment
      ↓
Observability + debugging
```

### Practical project

Build this:

``` text
React frontend
       ↓
Node/Express API
       ↓
PostgreSQL
       ↓
Redis
```

First run it normally.

Then containerize each part.

Then create `docker-compose.yml`.

Then intentionally break things:

-   wrong port
-   wrong database hostname
-   missing environment variable
-   stopped database
-   invalid image tag
-   missing volume

Debug every failure.

Only after that move the backend to Kubernetes.

------------------------------------------------------------------------

# 33. Final Mental Models

## Docker

``` text
Dockerfile
    ↓
docker build
    ↓
Image
    ↓
docker run
    ↓
Container
```

## Compose

``` text
compose.yaml
    ↓
docker compose up
    ↓
Network + Containers + Volumes
    ↓
Application stack
```

## Kubernetes

``` text
Dockerfile
    ↓
Image
    ↓
Registry
    ↓
Kubernetes Deployment
    ↓
Pods
    ↓
Service
    ↓
Users
```

------------------------------------------------------------------------

# The Most Important Difference

### Docker asks:

> **How do I package and run this application consistently?**

### Docker Compose asks:

> **How do I run several related containers together?**

### Kubernetes asks:

> **How do I continuously operate workloads across a cluster while
> maintaining the desired state?**

------------------------------------------------------------------------

# The Engineering Mental Model

Whenever you learn infrastructure, ask three questions.

## 1. What problem existed before this tool?

``` text
Problem → Tool
```

Example:

``` text
Environment mismatch → Docker
Many local services → Compose
Many machines/workloads → Kubernetes
```

## 2. What is the request/data/control flow?

``` text
Input
  ↓
Processing
  ↓
State
  ↓
Output
```

For Docker:

``` text
Dockerfile
  ↓
Image
  ↓
Container
  ↓
Process
```

For Kubernetes:

``` text
YAML desired state
  ↓
API Server
  ↓
Controllers / Scheduler
  ↓
Pods
  ↓
Application
```

## 3. What happens when something fails?

``` text
Port failure
Network failure
Image failure
Process crash
Storage failure
Configuration failure
```

The ability to answer these questions is much more valuable than
memorizing commands.

------------------------------------------------------------------------

# Quick Revision

  Concept      Remember
  ------------ ----------------------------------------------------
  Dockerfile   Build instructions
  Image        Immutable blueprint/artifact
  Container    Running instance/process environment
  Registry     Image distribution/storage
  Volume       Persistent storage
  Network      Container communication
  Compose      Multi-container application definition
  Pod          Kubernetes workload unit
  Deployment   Manages desired Pod replicas/rollouts
  Service      Stable network endpoint for Pods
  ConfigMap    Non-secret configuration
  Secret       Sensitive configuration object
  PVC          Request for persistent storage
  Kubernetes   Cluster orchestration and desired-state management

------------------------------------------------------------------------

# Final Takeaway

Docker is not valuable because you can type:

``` bash
docker run
```

Kubernetes is not valuable because you know:

``` bash
kubectl apply
```

The real skill is understanding **why the tool exists, what abstraction
it provides, how data and control flow through it, and how you debug it
when reality differs from your expectation.**

``` text
Application
    ↓
Environment problem
    ↓
Docker
    ↓
Multi-service problem
    ↓
Compose
    ↓
Cluster-scale problem
    ↓
Kubernetes
```

> **Learn the problem first. Learn the abstraction second. Learn the
> command last.**
