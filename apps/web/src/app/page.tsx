import {
  Boxes,
  Check,
  Code2,
  Database,
  Globe,
  Layers,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthStatusCard } from '@/components/health-status-card';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080C14]">
      {/* Background radial gradient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent blur-3xl" />

      {/* Navigation Header */}
      <header className="relative border-b border-obsidian-border/80 bg-obsidian-surface/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-obsidian-glow">
              <Boxes className="h-5 w-5 text-obsidian" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight text-lg">
                PixelCraft <span className="text-cyan-400">POS</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-mono">
                pos.pixelcraftlk.com
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="cyan" className="gap-1.5 hidden sm:inline-flex">
              <Sparkles className="h-3 w-3" />
              Phase 01: Project Foundation
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px] text-slate-400">
              pnpm Monorepo
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Enterprise Multi-Tenant SaaS Engine
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            PixelCraft{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              POS Monorepo
            </span>{' '}
            Foundation
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Production-ready monorepo architecture engineered for high concurrency, multi-tenant
            isolation, and unified type contracts across microservices and web client.
          </p>
        </div>

        {/* Live API Health Check Diagnostic Widget */}
        <div className="flex justify-center">
          <HealthStatusCard />
        </div>

        {/* Workspace Topology Architecture Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              Monorepo Workspace Topology
            </h2>
            <span className="text-xs text-slate-500 font-mono">5 Workspaces Integrated</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Apps/Web */}
            <Card className="hover:border-cyan-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <Badge variant="cyan">apps/web</Badge>
                </div>
                <CardTitle className="text-base mt-2">Next.js 15 Web Application</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <p>
                  Modern React 19 App Router with Tailwind CSS, shadcn/ui baseline, TanStack Query
                  shell, and Obsidian Dark theme design tokens.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    App Router
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    TanStack Query
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Tailwind CSS
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Apps/API */}
            <Card className="hover:border-cyan-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <Badge variant="success">apps/api</Badge>
                </div>
                <CardTitle className="text-base mt-2">NestJS Backend Gateway</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <p>
                  Modular architecture with global prefix{' '}
                  <code className="text-cyan-300">/api/v1</code>, Swagger OpenAPI docs, validation
                  pipe, and uniform exception filters.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Modular NestJS
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Swagger / OpenAPI
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Health Endpoint
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Packages/Types */}
            <Card className="hover:border-cyan-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Code2 className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary">packages/types</Badge>
                </div>
                <CardTitle className="text-base mt-2">Shared Type Contracts</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <p>
                  Unified TypeScript contracts defining API response envelopes (
                  <code className="text-purple-300">ApiResponse&lt;T&gt;</code>), multi-tenant
                  contexts, and diagnostics.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Strict Typing
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Response Envelopes
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Tenant Types
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Packages/Validation */}
            <Card className="hover:border-cyan-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <Badge variant="warning">packages/validation</Badge>
                </div>
                <CardTitle className="text-base mt-2">Shared Zod Validation</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <p>
                  Zero-duplication schema validation using Zod for client-side forms and API request
                  payloads.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Zod 3.x
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Common Schemas
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Health Schemas
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Packages/Config */}
            <Card className="hover:border-cyan-500/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary">packages/config</Badge>
                </div>
                <CardTitle className="text-base mt-2">Shared Tooling & Configs</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <p>
                  Strict base <code className="text-blue-300">tsconfig.base.json</code>, unified
                  Prettier configurations, and ESLint rule suites enforcing code quality.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    strict: true
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    Prettier Config
                  </span>
                  <span className="px-2 py-0.5 rounded bg-obsidian-muted text-[10px] text-slate-300">
                    ESLint Presets
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Unified Developer CLI */}
            <Card className="hover:border-cyan-500/40 transition-colors bg-gradient-to-br from-[#0E1524] to-[#0A0E18]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <Badge variant="outline">Turborepo</Badge>
                </div>
                <CardTitle className="text-base mt-2">Unified Monorepo Scripts</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="h-3 w-3 text-emerald-400" /> pnpm dev
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="h-3 w-3 text-emerald-400" /> pnpm build
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="h-3 w-3 text-emerald-400" /> pnpm typecheck
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Check className="h-3 w-3 text-emerald-400" /> pnpm clean
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-obsidian-border/80 bg-obsidian-surface/40 py-6 text-center text-xs text-slate-500">
        <p>
          PixelCraft POS &copy; {new Date().getFullYear()} PixelCraft LK. Enterprise Multi-Tenant
          SaaS Platform.
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Domain: pos.pixelcraftlk.com | Architected for High Availability & Scale
        </p>
      </footer>
    </div>
  );
}
