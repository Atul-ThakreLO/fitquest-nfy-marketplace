# Prompt Addendum — Docker Dev Services (DB + Cache)

> **Cursor/Windsurf/Antigravity instruction**: This is an addendum to `04-BACKEND-API.md`. Before building the backend, set up Docker-based development services. Only the database and cache run in Docker — the backend API and frontend run natively on the host machine with Bun and Node respectively.

---

## What runs where

```
Docker (containers)        Host machine (native)
─────────────────────      ──────────────────────────
PostgreSQL 16              Bun + Elysia API  (apps/api)
Redis 7                    Next.js frontend  (apps/web)
                           Foundry / forge   (packages/contracts)
```

---

## File to create: `docker-compose.dev.yml` (at monorepo root)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: territory_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: territory
      POSTGRES_PASSWORD: territory_dev
      POSTGRES_DB: territory_nft
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U territory -d territory_nft"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: territory_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

---

## Where Redis is used in the backend

Add Redis caching in `apps/api/` for these two things only — do not over-cache:

**1. Active listings cache** — The Graph queries are slow. Cache the result of `getActiveListings()` in Redis with a 30-second TTL. Invalidate on any `Listed`, `Sold`, or `Cancelled` event received.

**2. Region → NFT lookup cache** — `GET /game/region/:id` is called by the mobile game on every map render. Cache each region's resolved data (tokenId, imageUrl) with a 5-minute TTL. Invalidate when a `MintJob` for that region completes.

Install the Redis client:
```bash
bun add ioredis
```

Create `apps/api/src/lib/redis.ts`:

```typescript
import Redis from 'ioredis'
import config from '../config'

export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => console.error('Redis error:', err))

// Generic typed helpers
export async function getCache<T>(key: string): Promise<T | null> {
  const val = await redis.get(key)
  return val ? (JSON.parse(val) as T) : null
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key)
}
```

Add to `config.ts`:
```typescript
redisUrl: Bun.env.REDIS_URL ?? 'redis://localhost:6379',
```

---

## `.env` additions (`apps/api/.env`)

Add only these two lines — they map directly to what `docker-compose.dev.yml` creates:

```env
DATABASE_URL=postgresql://territory:territory_dev@localhost:5432/territory_nft
REDIS_URL=redis://localhost:6379
```

> Private keys and keystore config are handled separately in `04c-KEYSTORE-SECURITY.md` — do not add them here.

---

## `package.json` scripts (monorepo root)

Add these to the root `package.json`:

```json
{
  "scripts": {
    "services:up":     "docker compose -f docker-compose.dev.yml up -d",
    "services:down":   "docker compose -f docker-compose.dev.yml down",
    "services:reset":  "docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d",
    "services:logs":   "docker compose -f docker-compose.dev.yml logs -f",
    "services:status": "docker compose -f docker-compose.dev.yml ps",
    "db:migrate":      "cd apps/api && bunx prisma migrate dev",
    "db:migrate:prod": "cd apps/api && bunx prisma migrate deploy",
    "db:reset":        "cd apps/api && bunx prisma migrate reset --force",
    "db:studio":       "cd apps/api && bunx prisma studio",
    "db:generate":     "cd apps/api && bunx prisma generate",
    "setup":           "bun install && bun run services:up && bun run db:migrate && bun run db:generate",
    "dev":             "bun run services:up && turbo run dev",
    "dev:api":         "bun run services:up && turbo run dev --filter=api",
    "dev:web":         "turbo run dev --filter=web",
    "build":           "turbo run build",
    "stop":            "bun run services:down"
  }
}
```

---

## When to run what — complete reference

### First time ever (fresh clone)

```bash
bun run setup
```

This single command does everything in the right order:
1. Installs all dependencies across the monorepo
2. Starts Postgres + Redis in Docker
3. Runs Prisma migrations (creates all tables)
4. Generates Prisma client types

### Every day when you start working

```bash
bun run dev
```

Starts Docker services (skips if already running) then starts both API and web frontend. Ports:
- `http://localhost:3000` → web marketplace
- `http://localhost:3001` → backend API
- `http://localhost:3001/docs` → auto-generated API docs (Swagger UI)

### When you're done for the day

```bash
bun run stop
```

Stops Docker containers (data is preserved in volumes — nothing is lost).

### Working on backend only (faster startup)

```bash
bun run dev:api
```

### Working on frontend only (no Docker needed)

```bash
bun run dev:web
```

### After pulling new code from git (schema may have changed)

```bash
bun install           # in case new packages were added
bun run db:migrate    # apply any new migrations
bun run db:generate   # regenerate Prisma client
bun run dev
```

### Wipe everything and start fresh (nuclear option)

```bash
bun run services:reset    # destroys Docker volumes (all DB data gone)
bun run db:migrate        # recreates tables from scratch
bun run dev
```

### Check if Docker services are running

```bash
bun run services:status
```

Output shows container name, status (Up/Exit), and ports. Both should show `Up` and `healthy`.

### View Docker logs (if something is broken)

```bash
bun run services:logs
# Ctrl+C to stop following
```

---

## `.gitignore` additions

```gitignore
# Docker volumes (never commit these)
postgres_data/
redis_data/
```

---

## Prisma migration flow

After `services:up`, run migrations:

```bash
bun run db:migrate
# Enter a migration name when prompted, e.g.: "init"
```

To reset the DB during development (wipes all data, re-runs migrations):
```bash
bun run services:reset
bun run db:migrate
```

To browse the DB visually:
```bash
bun run db:studio
# Opens Prisma Studio at http://localhost:5555
```

---

## Prerequisites check

Before running, verify Docker is installed:
```bash
docker --version        # Docker 24+ required
docker compose version  # v2 required (note: no hyphen in v2)
```

If `docker compose` (v2) is not available but `docker-compose` (v1) is, replace all script commands with `docker-compose` (hyphenated).
