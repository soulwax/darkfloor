// File: apps/web/src/app/admin/ClusterDiagnosticsPanel.tsx

import {
  type ApiClusterDiagnostics,
  type ApiClusterNodeDiagnostics,
} from "@/app/admin/clusterDiagnostics";
import {
  CircleAlert,
  CircleCheck,
  Link2,
  Loader2,
  RefreshCcw,
} from "lucide-react";

type ClusterDiagnosticsPanelProps = {
  diagnostics: ApiClusterDiagnostics | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void | Promise<void>;
};

function formatNullableValue(value: boolean | number | string | null): string {
  if (value === null) return "n/a";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function getNodeToneClasses(node: ApiClusterNodeDiagnostics): string {
  if (node.state === "unhealthy") {
    return "border-[rgba(242,139,130,0.35)] bg-[rgba(242,139,130,0.08)]";
  }

  if (node.state === "out-of-sync") {
    return "border-[rgba(242,199,97,0.35)] bg-[rgba(242,199,97,0.08)]";
  }

  return "border-[rgba(88,198,177,0.22)] bg-[var(--color-surface)]/80";
}

function getNodeBadgeClasses(node: ApiClusterNodeDiagnostics): string {
  if (node.state === "unhealthy") {
    return "bg-[rgba(242,139,130,0.15)] text-[var(--color-danger)]";
  }

  if (node.state === "out-of-sync") {
    return "bg-[rgba(242,199,97,0.15)] text-[var(--color-warning)]";
  }

  return "bg-[rgba(88,198,177,0.15)] text-[var(--color-success)]";
}

export function ClusterDiagnosticsPanel({
  diagnostics,
  error,
  isLoading,
  onRefresh,
}: ClusterDiagnosticsPanelProps) {
  const nodes = diagnostics?.nodes ?? [];

  return (
    <div className="mb-8 rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/90 via-[var(--color-surface-2)]/85 to-[rgba(88,198,177,0.12)] p-6 shadow-[var(--shadow-lg)]">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm tracking-[0.14em] text-[var(--color-subtext)] uppercase">
            <Link2 className="h-4 w-4 text-[var(--color-accent)]" />
            API Hub Cluster
          </p>
          <p className="mt-1 text-sm text-[var(--color-subtext)]">
            The admin system panel now reads cluster diagnostics from the
            centralized Songbird API hub.
          </p>
        </div>
        <button
          onClick={() => void onRefresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          Refresh cluster diagnostics
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-[rgba(242,139,130,0.35)] bg-[rgba(242,139,130,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      {diagnostics ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--color-subtext)]">
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            hub:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.baseUrl}
            </strong>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            total nodes:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.total}
            </strong>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            healthy nodes:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.healthyCount}
            </strong>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            in-sync nodes:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.inSyncCount}
            </strong>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            local version:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.localVersion ?? "n/a"}
            </strong>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            reference:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.referenceUrl ?? diagnostics.localUrl ?? "n/a"}
            </strong>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-1">
            updated:{" "}
            <strong className="text-[var(--color-text)]">
              {diagnostics.timestamp ?? "n/a"}
            </strong>
          </span>
        </div>
      ) : null}

      {nodes.length === 0 && isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-2xl bg-[var(--color-surface)]/70"
            />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-subtext)]">
          <CircleAlert className="h-4 w-4 text-[var(--color-warning)]" />
          Cluster diagnostics are not available yet.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {nodes.map((node, index) => (
            <div
              key={`${node.url}-${index}`}
              className={`rounded-2xl border p-4 ${getNodeToneClasses(node)}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[var(--color-text)]">
                    {node.url}
                  </p>
                  <p className="break-all font-mono text-[11px] text-[var(--color-muted)]">
                    requested: {node.requestedUrl ?? "n/a"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase ${getNodeBadgeClasses(node)}`}
                >
                  {node.state === "healthy" ? (
                    <CircleCheck className="h-3 w-3" />
                  ) : (
                    <CircleAlert className="h-3 w-3" />
                  )}
                  {node.state}
                </span>
              </div>

              <div className="mb-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3 text-sm text-[var(--color-subtext)]">
                  <p className="mb-2 text-[10px] font-semibold tracking-[0.08em] uppercase">
                    Node identity
                  </p>
                  <div className="grid gap-1">
                    <p>
                      status:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.status}
                      </strong>
                    </p>
                    <p>
                      version:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.version ?? "n/a"}
                      </strong>
                    </p>
                    <p>
                      node env:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.nodeEnv ?? "n/a"}
                      </strong>
                    </p>
                    <p>
                      fetched at:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.fetchedAt ?? "n/a"}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3 text-sm text-[var(--color-subtext)]">
                  <p className="mb-2 text-[10px] font-semibold tracking-[0.08em] uppercase">
                    Diagnostics
                  </p>
                  <div className="grid gap-1">
                    <p>
                      http status:{" "}
                      <strong className="text-[var(--color-text)]">
                        {formatNullableValue(node.httpStatus)}
                      </strong>
                    </p>
                    <p>
                      response time:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.responseTimeMs === null
                          ? "n/a"
                          : `${node.responseTimeMs}ms`}
                      </strong>
                    </p>
                    <p>
                      in sync:{" "}
                      <strong className="text-[var(--color-text)]">
                        {formatNullableValue(node.inSync)}
                      </strong>
                    </p>
                    <p>
                      self:{" "}
                      <strong className="text-[var(--color-text)]">
                        {formatNullableValue(node.isSelf)}
                      </strong>
                    </p>
                    <p>
                      vercel:{" "}
                      <strong className="text-[var(--color-text)]">
                        {formatNullableValue(node.isVercel)}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              {node.error ? (
                <div className="mb-3 rounded-xl border border-[rgba(242,139,130,0.28)] bg-[rgba(242,139,130,0.12)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {node.error}
                </div>
              ) : null}

              {node.publicConfig ? (
                <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-3 text-sm text-[var(--color-subtext)]">
                  <summary className="cursor-pointer list-none font-semibold text-[var(--color-text)]">
                    Public config details
                  </summary>
                  <div className="mt-3 grid gap-2">
                    <p>
                      app.name:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.publicConfig.app.name ?? "n/a"}
                      </strong>
                    </p>
                    <p>
                      app.version:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.publicConfig.app.version ?? "n/a"}
                      </strong>
                    </p>
                    <p>
                      environment.nodeVersion:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.publicConfig.environment.nodeVersion ?? "n/a"}
                      </strong>
                    </p>
                    <p>
                      environment.isNetlify:{" "}
                      <strong className="text-[var(--color-text)]">
                        {formatNullableValue(
                          node.publicConfig.environment.isNetlify,
                        )}
                      </strong>
                    </p>
                    <p>
                      urls.appUrl:{" "}
                      <strong className="break-all text-[var(--color-text)]">
                        {node.publicConfig.urls.appUrl ?? "n/a"}
                      </strong>
                    </p>
                    <p>
                      cors.origins:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.publicConfig.cors.origins.length > 0
                          ? node.publicConfig.cors.origins.join(", ")
                          : "n/a"}
                      </strong>
                    </p>
                    <p>
                      cors.note:{" "}
                      <strong className="text-[var(--color-text)]">
                        {node.publicConfig.cors.note ?? "n/a"}
                      </strong>
                    </p>
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
