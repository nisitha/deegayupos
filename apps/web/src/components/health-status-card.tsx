'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { healthApi } from '@/lib/api-client';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

export function HealthStatusCard() {
  const [latency, setLatency] = React.useState<number | null>(null);

  const {
    data: response,
    error,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const startTime = performance.now();
      const res = await healthApi.checkHealth();
      const duration = Math.round(performance.now() - startTime);
      setLatency(duration);
      return res;
    },
    refetchInterval: 15000,
  });

  const healthData = response?.data;
  const isOnline = Boolean(response?.success && healthData?.status === 'ok');

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  return (
    <Card className="w-full max-w-3xl border-cyan-500/20 bg-gradient-to-b from-[#0E1524] to-[#080C14]">
      <CardHeader className="border-b border-obsidian-border/60 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-emerald-500' : isLoading ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                />
              </span>
              <CardTitle className="text-xl flex items-center gap-2">
                Core API Gateway Telemetry
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              Live operational health verification connecting to{' '}
              <code className="text-cyan-400 text-xs px-1.5 py-0.5 rounded bg-obsidian-muted border border-obsidian-border">
                apps/api
              </code>{' '}
              via <code className="text-xs text-slate-300">/api/v1/health</code>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <Badge variant="warning" className="gap-1 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Connecting...
              </Badge>
            ) : isOnline ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                API Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                API Unreachable
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {isLoading && !healthData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
            <p className="text-slate-300 text-sm font-medium">
              Handshaking with PixelCraft POS Backend...
            </p>
            <p className="text-xs text-slate-500">
              Querying endpoint at http://localhost:4000/api/v1/health
            </p>
          </div>
        ) : isOnline && healthData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg border border-obsidian-border bg-obsidian-muted/50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  Service
                </div>
                <div className="text-sm font-semibold text-white truncate">
                  {healthData.service}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  v{healthData.version} ({healthData.environment})
                </div>
              </div>

              <div className="rounded-lg border border-obsidian-border bg-obsidian-muted/50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Database className="h-3.5 w-3.5 text-indigo-400" />
                  PostgreSQL
                </div>
                <div className="text-sm font-semibold text-white">
                  {healthData.database?.status === 'connected' ? (
                    <span className="text-emerald-400">Connected</span>
                  ) : (
                    <span className="text-amber-400">Standby</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {healthData.database?.latencyMs !== undefined
                    ? `${healthData.database.latencyMs} ms ping`
                    : 'Prisma RLS'}
                </div>
              </div>

              <div className="rounded-lg border border-obsidian-border bg-obsidian-muted/50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  Latency
                </div>
                <div className="text-sm font-semibold text-emerald-300">
                  {latency !== null ? `${latency} ms` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">HTTP Roundtrip</div>
              </div>

              <div className="rounded-lg border border-obsidian-border bg-obsidian-muted/50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  Uptime
                </div>
                <div className="text-sm font-semibold text-white">
                  {formatUptime(healthData.uptime)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Continuous process</div>
              </div>

              <div className="rounded-lg border border-obsidian-border bg-obsidian-muted/50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  Runtime
                </div>
                <div className="text-sm font-semibold text-white">{healthData.nodeVersion}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Node.js Engine</div>
              </div>
            </div>

            {healthData.memoryUsage && (
              <div className="rounded-lg border border-obsidian-border/80 bg-obsidian/60 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-cyan-400" />
                    Memory Allocation Telemetry
                  </span>
                  <span className="text-[11px] text-slate-500">
                    RSS: {healthData.memoryUsage.rssMb} MB
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-obsidian-surface border border-obsidian-border">
                    <span className="text-slate-400 block text-[10px]">Heap Used</span>
                    <span className="font-mono text-cyan-300 font-semibold">
                      {healthData.memoryUsage.heapUsedMb} MB
                    </span>
                  </div>
                  <div className="p-2 rounded bg-obsidian-surface border border-obsidian-border">
                    <span className="text-slate-400 block text-[10px]">Heap Total</span>
                    <span className="font-mono text-slate-200">
                      {healthData.memoryUsage.heapTotalMb} MB
                    </span>
                  </div>
                  <div className="p-2 rounded bg-obsidian-surface border border-obsidian-border">
                    <span className="text-slate-400 block text-[10px]">RSS Memory</span>
                    <span className="font-mono text-slate-200">
                      {healthData.memoryUsage.rssMb} MB
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>
                Timestamp: <code className="text-slate-300 font-mono">{healthData.timestamp}</code>
              </span>
              <span>Checked at: {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-300">
                  Unable to connect to PixelCraft POS API Gateway
                </p>
                <p className="text-xs text-red-300/80 mt-1">
                  {error instanceof Error ? error.message : 'Connection refused at localhost:4000'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-obsidian-border bg-obsidian/40 p-4 text-xs space-y-2">
              <p className="font-semibold text-slate-300">To launch the API service:</p>
              <pre className="p-2.5 rounded bg-black/60 font-mono text-cyan-400 border border-obsidian-border select-all">
                pnpm --filter @pixelcraft/api dev
              </pre>
              <p className="text-slate-400">
                Or launch all monorepo workspaces concurrently from the root directory:
              </p>
              <pre className="p-2.5 rounded bg-black/60 font-mono text-cyan-400 border border-obsidian-border select-all">
                pnpm dev
              </pre>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Recheck Status'}
          </Button>

          <a href="http://localhost:4000/api/v1/health" target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-400">
              <Activity className="h-3 w-3" />
              Raw JSON
              <ExternalLink className="h-2.5 w-2.5" />
            </Button>
          </a>
        </div>

        <a href="http://localhost:4000/api/docs" target="_blank" rel="noreferrer">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 text-xs border-cyan-500/30 text-cyan-300 hover:text-white"
          >
            <span>Swagger / OpenAPI Docs</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </a>
      </CardFooter>
    </Card>
  );
}
