# PixelCraft POS - Monorepo Foundation (Phase 01)

> **Enterprise-Grade Multi-Tenant SaaS Platform**  
> Domain: [pos.pixelcraftlk.com](https://pos.pixelcraftlk.com)  
> Organization: **PixelCraft LK**

---

## 🏗️ Architecture & Topology

```
pixelcraft-pos/
├── apps/
│   ├── api/                     # NestJS Backend API Gateway (Port 4000)
│   │   ├── src/
│   │   │   ├── common/          # Filters, Interceptors, Pipes, Response DTOs
│   │   │   │   ├── dto/         # Swagger & Envelope DTOs (ApiResponse, HealthCheck)
│   │   │   │   ├── filters/     # AllExceptionsFilter (Standardized JSON errors)
│   │   │   │   ├── interceptors/# TransformResponseInterceptor (Standard envelope)
│   │   │   │   └── pipes/       # GlobalValidationPipe (Strict validation)
│   │   │   ├── modules/
│   │   │   │   └── health/      # HealthModule (/api/v1/health telemetry)
│   │   │   ├── app.module.ts
│   │   │   └── main.ts          # Prefix (/api/v1), CORS, Swagger (/api/docs)
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── web/                     # Next.js 15 Web Application (Port 3000)
│       ├── src/
│       │   ├── app/             # App Router with Obsidian dark theme tokens
│       │   │   ├── layout.tsx   # Font optimization & Query provider
│       │   │   ├── page.tsx     # Diagnostic healthcheck test page
│       │   │   └── globals.css  # Obsidian dark palette styling
│       │   ├── components/
│       │   │   ├── ui/          # shadcn/ui baseline (Button, Card, Badge)
│       │   │   ├── health-status-card.tsx # Real-time API telemetry widget
│       │   │   └── providers.tsx# TanStack Query client shell
│       │   └── lib/
│       │       ├── api-client.ts# Standardized Axios API wrapper
│       │       └── utils.ts     # shadcn cn utility helper
│       ├── .env.example
│       └── package.json
│
├── packages/
│   ├── config/                  # Shared base configurations
│   │   ├── tsconfig.base.json   # Strict TypeScript base configuration
│   │   ├── eslint/base.js       # Reusable ESLint baseline rules
│   │   └── prettier/index.js    # Prettier configuration
│   ├── types/                   # Shared TypeScript definitions
│   │   └── src/
│   │       ├── api.ts           # ApiResponse<T>, ApiError, HealthCheckData
│   │       ├── tenant.ts        # TenantContext, TenantId, Multi-tenant types
│   │       └── index.ts
│   └── validation/              # Shared Zod validation utilities
│       └── src/
│           ├── common.ts        # UUID, Pagination, Tenant ID schemas
│           ├── health.ts        # HealthCheck Zod validation schemas
│           └── index.ts
│
├── package.json                 # Unified monorepo scripts & Turborepo orchestration
├── pnpm-workspace.yaml          # PNPM workspaces configuration
├── turbo.json                   # Turborepo task pipeline
├── eslint.config.mjs            # Flat ESLint configuration
├── .prettierrc                  # Prettier formatting standard
├── .gitignore
└── .env.example                 # Root environment variable schema
```

---

## ⚡ Quick Start

### 1. Requirements

- **Node.js**: `v20+` or `v24+` (Active LTS)
- **Package Manager**: `pnpm v10+` or `v12+`

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Environment Variables

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 4. Run Both Applications in Development Mode

```bash
pnpm dev
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Gateway**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **OpenAPI / Swagger Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **Health Telemetry**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

---

## 🛠️ Unified Monorepo CLI Commands

| Command             | Action                                                               |
| :------------------ | :------------------------------------------------------------------- |
| `pnpm dev`          | Starts all applications concurrently with live reloading             |
| `pnpm build`        | Compiles all packages and applications through Turborepo             |
| `pnpm lint`         | Runs ESLint verification across all workspaces with zero warnings    |
| `pnpm typecheck`    | Strict TypeScript compilation check across all workspaces            |
| `pnpm format`       | Formats the codebase using Prettier                                  |
| `pnpm format:check` | Verifies codebase conformity against Prettier guidelines             |
| `pnpm clean`        | Cleans all build artifacts (`dist`, `.next`, `tsconfig.tsbuildinfo`) |
| `pnpm clean:all`    | Cleans build artifacts and `node_modules` across all workspaces      |

---

## 📋 Standard API Response Envelopes

### Success Envelope

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "PixelCraft POS API",
    "version": "1.0.0",
    "environment": "development",
    "uptime": 124.5,
    "timestamp": "2026-11-08T15:45:30.311Z",
    "nodeVersion": "v24.19.0",
    "memoryUsage": {
      "rssMb": 75.66,
      "heapTotalMb": 26.05,
      "heapUsedMb": 23.92
    }
  },
  "timestamp": "2026-11-08T15:45:30.310Z",
  "path": "/api/v1/health"
}
```

### Standardized Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Cannot GET /api/v1/nonexistent",
    "statusCode": 404,
    "timestamp": "2026-11-08T15:45:40.066Z",
    "path": "/api/v1/nonexistent"
  },
  "timestamp": "2026-11-08T15:45:40.066Z",
  "path": "/api/v1/nonexistent"
}
```

---

## 🎨 Design Tokens & Obsidian Dark Theme

The web frontend implements custom obsidian dark theme tokens configured in `tailwind.config.ts`:

- **Background**: Deep Obsidian `#080C14`
- **Surface & Cards**: `#0E1422` with border `#1F2C44`
- **Brand Accents**: Electric Cyan `#06B6D4`, Emerald Mint `#10B981`, Electric Violet `#8B5CF6`
- **Typography**: Inter (Google Fonts via Next.js Font Optimization)
- **Component Primitives**: shadcn/ui baseline with Lucide React iconography
