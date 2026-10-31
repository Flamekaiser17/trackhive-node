# TrackHive: Distributed Delivery Orchestration & Real-time Telemetry Engine 📦 🐝

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Prisma ORM](https://img.shields.io/badge/prisma-5.x-blue.svg)](https://www.prisma.io/)
[![Upstash Redis](https://img.shields.io/badge/redis-Upstash-red.svg)](https://upstash.com/)
[![Supabase PostgreSQL](https://img.shields.io/badge/postgresql-Supabase-emerald.svg)](https://supabase.com/)

**TrackHive** is a high-performance, real-time fleet orchestration engine and delivery coordination platform. Engineered with a pure JavaScript (ES Modules) backend, PostgreSQL (Prisma ORM), Upstash Redis, and Socket.io, it is purpose-built around core distributed systems concepts: **ACID guarantees, distributed locking, geospatial indexing, and decoupled background workers.**

---

## 🏗 System Architecture

TrackHive utilizes a lightweight, event-driven Node.js architecture designed for horizontal scalability, sub-second telemetry propagation, and zero race conditions under concurrent dispatch.

```mermaid
graph TD
    subgraph "Clients & Frontends"
        Admin_UI[Operations Deck / Vite + React]
        Driver_App[Simulated Agents / Mobile Telemetry]
    end

    subgraph "Application Engine (Node.js ESM)"
        Express_API[Express HTTP Server :5000]
        Socket_GW[Socket.io Telemetry Gateway]
        BullMQ_Worker[BullMQ Decoupled Anomaly Worker]
        Lock_Service[Redis Distributed Mutex Service]
        Cache_Service[Multi-Tier Cache Layer]
    end

    subgraph "Data & State Tier"
        Supabase_PG[(Supabase PostgreSQL: ACID Persistent Store)]
        Upstash_Redis[(Upstash Redis: GEO Index, Cache & BullMQ)]
    end

    Driver_App -->|agent:telemetry ws| Socket_GW
    Socket_GW -->|GEOADD & Hash TTL| Upstash_Redis
    Socket_GW -->|fleet:agent_moved| Admin_UI
    Socket_GW -->|speed > 100 km/h| BullMQ_Worker
    BullMQ_Worker -->|Persist Anomaly Log| Supabase_PG

    Admin_UI <-->|REST API| Express_API
    Express_API -->|Read-Through Cache| Cache_Service
    Cache_Service <-->|10s TTL| Upstash_Redis
    Express_API -->|Prisma ORM| Supabase_PG
    Express_API -->|Auto-Assign Lock| Lock_Service
    Lock_Service <-->|SET NX EX| Upstash_Redis
```

### Architectural Highlights
- **Decoupled Telemetry Pipeline:** High-frequency GPS updates are ingested over Socket.io and indexed directly in Redis GEO (`GEOADD`) with hash metadata and a 1-hour TTL, completely shielding PostgreSQL from high-frequency write locks.
- **Race-Condition-Free Dispatch:** Order assignment employs a two-tier protection model:
  1. **Layer 1 — Redis Mutex (`SET NX EX`):** Optimistic distributed lock claimed in `< 1ms`.
  2. **Layer 2 — PostgreSQL ACID Transaction (`prisma.$transaction`):** Atomically re-verifies agent status as `AVAILABLE`, flips the order to `ASSIGNED`, and marks the agent `BUSY`.
- **Decoupled Anomaly Worker:** High-speed violations (> 100 km/h) are offloaded to a BullMQ queue backed by Upstash Redis and processed asynchronously without degrading API latency.

---

## 🛠 Tech Stack

| Component | Technology | Detail |
| :--- | :--- | :--- |
| **Runtime** | Node.js (ES Modules) | Clean, lightweight native ESM architecture |
| **HTTP Framework** | Express 4 | Modular controllers, routes, and middlewares |
| **Real-time Gateway** | Socket.io 4 | Sub-second bidirectional telemetry broadcasting |
| **Database & ORM** | PostgreSQL (Supabase) + Prisma | ACID transaction safety, relational schema, migrations |
| **Cache & State** | Upstash Redis | Geospatial indexing (`GEOADD`/`GEOSEARCH`), Mutex, caching |
| **Task Queue** | BullMQ | Decoupled background anomaly persistence |
| **Frontend UI** | React 19 + Vite + Leaflet | Dark-mode Logistics Operations Deck (CartoDB Dark Matter) |
| **Load Testing** | Autocannon | High-concurrency Node.js benchmark suite |

---

## ⚡ System Architecture & Performance Engineering

TrackHive is engineered for high-throughput logistics and real-time anomaly monitoring, backed by Supabase PostgreSQL, Prisma ORM, and Upstash Redis.

### Key Production Optimizations
* **Multi-Tier Read-Through Caching:** Implemented a Redis caching layer with an in-memory fallback (10-second TTL) for high-frequency admin polling endpoints, paired with automatic cache invalidation on new order ingestion.
* **Composite B-Tree Indexing & Query Projection:** Added targeted Prisma indexes on status, role, agentId, and descending timestamp columns while enforcing selective field projections and a default 50-record pagination limit.
* **Zero-Blocking Health Probes:** Replaced synchronous cloud database and Redis network pings on the health endpoint with passive in-memory connection state tracking.
* **Asynchronous Write Side-Effects:** Offloaded post-order cache invalidation from the critical HTTP write path using Node.js event loop scheduling (`setImmediate`).

### Load Testing Benchmarks (Autocannon)

| Endpoint | Baseline RPS | Optimized RPS | Baseline Avg | Optimized Avg |
| :--- | :--- | :--- | :--- | :--- |
| GET /health | 6.34 | 6,654.67 | 1,425.32 ms | 0.98 ms |
| GET /api/orders | 3.34 | 735.00 | 2,619.60 ms | 7.71 ms |
| GET /api/agents | 5.67 | 4,572.00 | 1,334.77 ms | 1.64 ms |
| GET /api/anomalies | 4.34 | 4,184.00 | 1,551.85 ms | 1.95 ms |
| POST /api/orders | 10.00 | 9.00 | 924.44 ms | 938.63 ms |

* **Tail Latency (p95) Reduction:** Order polling p95 latency dropped from 2,872 ms down to 2.00 ms (over 340x throughput speedup), while agent and anomaly dashboards achieved an 800x throughput increase with 0% error rate under concurrent load.
* **Health Probe Speedup:** Eliminating remote network round-trips reduced p95 probe latency from 2,188 ms to 4.00 ms (~1000x throughput gain).

### Running the Benchmark Suite Locally

```bash
# Terminal 1: Start the API server
npm start

# Terminal 2: Execute the Autocannon load suite
npm run test:load
```

---

## 🚦 Getting Started & Local Setup

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL connection string (e.g. Supabase or local Postgres)
- Redis connection string (e.g. Upstash or local Redis)

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"
REDIS_URL="rediss://default:token@host:6379"
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm install
npx prisma generate
```

### 4. Run Server & Live Simulation
```bash
# Start backend engine (:5000)
npm run dev

# Run telemetry simulation & chaos injection test
npm run simulate

# Run race-condition concurrent dispatch test
node scripts/testConcurrentDispatch.js
```

### 5. Start Frontend Command Center
```bash
cd apps/frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** to access the live CartoDB Operations Deck!

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for details.

---
**Architected by**: [Flamekaiser17](https://github.com/Flamekaiser17)
