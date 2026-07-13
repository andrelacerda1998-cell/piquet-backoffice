"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent, formatChangePercent } from "@/lib/formatters";
import type { MetricValue } from "@/types";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface MetricCardProps {
  title: string;
  metric: MetricValue;
  format?: "currency" | "number" | "percent";
  className?: string;
  loading?: boolean;
}

export function MetricCard({ title, metric, format = "number", className, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn("card p-4 animate-pulse", className)}>
        <div className="h-4 w-24 bg-surface-subtle rounded mb-3" />
        <div className="h-8 w-32 bg-surface-subtle rounded mb-2" />
        <div className="h-3 w-16 bg-surface-subtle rounded" />
      </div>
    );
  }

  const formattedValue =
    format === "currency" ? formatCurrency(metric.value) :
    format === "percent" ? formatPercent(metric.value) :
    formatNumber(metric.value);

  const sparkData = (metric.sparkline ?? []).map((v, i) => ({ i, v }));

  return (
    <div className={cn("card p-4 hover:shadow-elevated transition-shadow", className)}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm text-text-secondary font-medium">{title}</p>
        {metric.tooltip && (
          <span title={metric.tooltip} className="text-text-muted cursor-help">
            <Info className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-text-primary mb-2">{formattedValue}</p>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-baseline gap-1">
          <TrendIndicator value={metric.changePercent} trend={metric.trend} />
          <span className="text-[10px] text-text-muted">vs mês ant.</span>
        </span>
        {metric.goal !== undefined && (
          <span className="text-xs text-text-muted">
            Meta: {format === "currency" ? formatCurrency(metric.goal) : formatNumber(metric.goal)}
          </span>
        )}
      </div>
      {sparkData.length > 0 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAB347" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#FAB347" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#E39A1C"
                fill="url(#spark-grad)"
                strokeWidth={1.75}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface TrendIndicatorProps {
  value: number;
  trend: "up" | "down" | "neutral";
  invertColors?: boolean;
}

export function TrendIndicator({ value, trend, invertColors = false }: TrendIndicatorProps) {
  const isPositive = trend === "up";
  const colorClass = trend === "neutral"
    ? "text-text-muted"
    : (isPositive !== invertColors) ? "text-success" : "text-danger";

  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", colorClass)}>
      <Icon className="h-3.5 w-3.5" />
      {formatChangePercent(value)}
    </span>
  );
}

export function GoalProgress({ current, target, label }: { current: number; target: number; label?: string }) {
  const percent = target ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-text-secondary">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-piquet rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-medium text-text-secondary">{formatPercent(percent)}</span>
      </div>
    </div>
  );
}
