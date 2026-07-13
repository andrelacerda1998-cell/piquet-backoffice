"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Sector,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { EmptyState } from "@/components/ui/States";
import { BarChart3 } from "lucide-react";

// Paleta categórica coerente com a identidade quente da Piquet (artefacto):
// dourado em destaque + acentos terrosos (verde, teal, terracota) e neutros creme.
const COLORS = ["#FAB347", "#1F9D6B", "#3E7C8C", "#D6503B", "#E39A1C", "#8A6FB0", "#6E675E", "#C9C3BA"];

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ title, subtitle, children, className, action }: ChartCardProps) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = formatter ?? formatNumber;
  return (
    <div className="bg-surface border border-surface-border rounded-lg shadow-elevated p-3 text-sm">
      <p className="font-medium text-text-primary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-text-secondary">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

interface LineChartProps {
  data: Array<{ name: string; value?: number; [key: string]: string | number | undefined }>;
  dataKey?: string;
  height?: number;
  currency?: boolean;
  lines?: Array<{ key: string; color: string; name: string }>;
}

export function LineChartComponent({ data, dataKey = "value", height = 280, currency, lines }: LineChartProps) {
  if (!data.length) return <EmptyState title="Sem dados" icon={BarChart3} />;

  const lineConfigs = lines ?? [{ key: dataKey, color: COLORS[0], name: "Valor" }];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} stroke="rgb(var(--text-muted))" />
        <YAxis tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} stroke="rgb(var(--text-muted))" tickFormatter={currency ? (v) => `${(v / 1000).toFixed(0)}k` : undefined} />
        <Tooltip content={<ChartTooltip formatter={currency ? formatCurrency : formatNumber} />} />
        <Legend />
        {lineConfigs.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={false} name={l.name} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarChartComponent({ data, dataKey = "value", height = 280, currency, bars }: {
  data: Array<Record<string, string | number | undefined>>;
  dataKey?: string;
  height?: number;
  currency?: boolean;
  bars?: Array<{ key: string; color: string; name: string }>;
}) {
  if (!data.length) return <EmptyState title="Sem dados" icon={BarChart3} />;

  const barConfigs = bars ?? [{ key: dataKey, color: COLORS[0], name: "Valor" }];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} stroke="rgb(var(--text-muted))" />
        <YAxis tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} stroke="rgb(var(--text-muted))" tickFormatter={currency ? (v) => `${(v / 1000).toFixed(0)}k` : undefined} />
        <Tooltip content={<ChartTooltip formatter={currency ? formatCurrency : formatNumber} />} />
        <Legend />
        {barConfigs.map((b) => (
          <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[4, 4, 0, 0]} name={b.name} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaChartComponent({ data, dataKey = "value", height = 280, currency, color = COLORS[0] }: {
  data: Array<{ name: string; value?: number }>;
  dataKey?: string;
  height?: number;
  currency?: boolean;
  color?: string;
}) {
  if (!data.length) return <EmptyState title="Sem dados" icon={BarChart3} />;

  const gradientId = `area-grad-${dataKey}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} stroke="rgb(var(--text-muted))" />
        <YAxis tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} stroke="rgb(var(--text-muted))" />
        <Tooltip content={<ChartTooltip formatter={currency ? formatCurrency : formatNumber} />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ActiveSlice(props: unknown) {
  const p = props as { cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number; fill: string };
  return (
    <g>
      <Sector cx={p.cx} cy={p.cy} innerRadius={p.innerRadius} outerRadius={p.outerRadius + 5} startAngle={p.startAngle} endAngle={p.endAngle} fill={p.fill} cornerRadius={4} />
      <Sector cx={p.cx} cy={p.cy} innerRadius={p.outerRadius + 7} outerRadius={p.outerRadius + 9} startAngle={p.startAngle} endAngle={p.endAngle} fill={p.fill} opacity={0.35} />
    </g>
  );
}

export function DonutChartComponent({ data, height = 280, centerLabel, currency }: {
  data: Array<{ name: string; value?: number }>;
  height?: number;
  centerLabel?: string;
  currency?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!data.length) return <EmptyState title="Sem dados" icon={BarChart3} />;

  const total = data.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const fmt = currency ? formatCurrency : formatNumber;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  const centerVal = active !== null ? (data[active].value ?? 0) : total;
  const centerTxt = active !== null ? data[active].name : (centerLabel ?? "Total");

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
      <div className="w-full sm:w-1/2 shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={2}
              cornerRadius={4}
              dataKey="value"
              stroke="none"
              activeIndex={active ?? undefined}
              activeShape={ActiveSlice}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={active === null || active === i ? 1 : 0.32} />
              ))}
              <Label
                position="center"
                content={() => (
                  <g>
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-text-primary" style={{ fontSize: 20, fontWeight: 700 }}>
                      {fmt(centerVal)}
                    </text>
                    <text x="50%" y="46%" dy={20} textAnchor="middle" dominantBaseline="middle" className="fill-text-secondary" style={{ fontSize: 11 }}>
                      {centerTxt.length > 16 ? centerTxt.slice(0, 15) + "…" : centerTxt}
                    </text>
                  </g>
                )}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda rica */}
      <ul className="w-full sm:w-1/2 space-y-0.5 max-h-[280px] overflow-y-auto pr-1">
        {data.map((d, i) => (
          <li
            key={i}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-default",
              active === i ? "bg-surface-muted" : "hover:bg-surface-muted/60"
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="flex-1 truncate text-text-secondary">{d.name}</span>
            <span className="font-semibold text-text-primary tabular-nums">{fmt(d.value ?? 0)}</span>
            <span className="w-10 text-right text-xs text-text-muted tabular-nums">{pct(d.value ?? 0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FunnelChartComponent({ data }: {
  data: Array<{ name: string; count: number; conversionRate?: number }>;
  height?: number;
}) {
  if (!data.length) return <EmptyState title="Sem dados" icon={BarChart3} />;

  return (
    <div className="space-y-2">
      {data.map((step, i) => (
        <div key={step.name} className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-text-primary">{step.name}</span>
            <span className="text-sm text-text-secondary">{formatNumber(step.count)}</span>
          </div>
          <div className="h-8 bg-surface-subtle rounded-lg overflow-hidden">
            <div
              className="h-full bg-piquet rounded-lg flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max(10, (step.count / (data[0]?.count || 1)) * 100)}%` }}
            >
              {step.conversionRate !== undefined && (
                <span className="text-xs font-medium text-text-primary">{step.conversionRate.toFixed(1)}%</span>
              )}
            </div>
          </div>
          {i < data.length - 1 && step.conversionRate !== undefined && (
            <p className="text-xs text-text-muted mt-0.5 ml-1">
              Abandono: {((1 - (data[i + 1]?.count ?? 0) / (step.count || 1)) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function CashFlowChart({ data, height = 300 }: {
  data: number[];
  height?: number;
}) {
  const chartData = data.map((value, i) => ({ name: `D${i + 1}`, value }));
  const hasNegative = data.some((v) => v < 0);
  const stroke = hasNegative ? "#D6503B" : "#FAB347";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="cashflow-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} interval={Math.floor(data.length / 6)} />
        <YAxis tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          fill="url(#cashflow-grad)"
          strokeWidth={2.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HeatMapGrid({ data }: { data: Array<{ name: string; value: number; ratio?: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {data.map((item) => {
        const intensity = item.value / max;
        return (
          <div
            key={item.name}
            className="rounded-lg p-3 text-center transition-colors"
            style={{ backgroundColor: `rgba(250, 187, 91, ${0.15 + intensity * 0.75})` }}
          >
            <p className="text-sm font-medium text-text-primary">{item.name}</p>
            <p className="text-lg font-bold">{formatNumber(item.value)}</p>
            {item.ratio !== undefined && (
              <p className="text-xs text-text-secondary">Rácio: {item.ratio.toFixed(1)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { COLORS };
