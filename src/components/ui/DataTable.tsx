"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = "Pesquisar...", className }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-9"
        aria-label="Pesquisar"
      />
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
  hidden?: boolean;
}

/** Ação aplicada às linhas selecionadas (barra de ações em massa). */
export interface BulkAction<T> {
  label: string;
  onClick: (rows: T[]) => void;
  tone?: "default" | "danger";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  /** Ativa a coluna de seleção (checkbox por linha + selecionar tudo). */
  selectable?: boolean;
  /** Ações aplicadas às linhas selecionadas (aparecem numa barra ao selecionar). */
  bulkActions?: BulkAction<T>[];
  /** Botão "Colunas" para mostrar/ocultar colunas (estado interno). */
  columnToggle?: boolean;
}

export function DataTable<T extends object>({
  columns,
  data,
  keyField,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  loading,
  emptyMessage = "Sem dados para apresentar",
  selectable,
  bulkActions,
  columnToggle,
}: DataTableProps<T>) {
  // Visibilidade de colunas (estado interno; arranca de `hidden`).
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.hidden).map((c) => c.key))
  );
  const visibleColumns = columns.filter((c) => !hiddenKeys.has(c.key));

  // Seleção (por valor do keyField).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rowKey = (row: T) => String(row[keyField]);
  const selectedRows = useMemo(() => data.filter((r) => selected.has(rowKey(r))), [data, selected]);
  const allSelected = data.length > 0 && data.every((r) => selected.has(rowKey(r)));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(data.map(rowKey)));
  const toggleRow = (key: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const clearSelection = () => setSelected(new Set());

  // Menu de colunas (fecha ao clicar fora).
  const [colMenu, setColMenu] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colMenu) return;
    const onClick = (e: MouseEvent) => { if (colRef.current && !colRef.current.contains(e.target as Node)) setColMenu(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [colMenu]);

  const totalCols = visibleColumns.length + (selectable ? 1 : 0);

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="animate-pulse p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-subtle rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Barra superior: ações em massa (quando há seleção) + escolher colunas. */}
      {(columnToggle || (selectable && bulkActions && selected.size > 0)) && (
        <div className="flex items-center justify-between gap-3 min-h-[36px]">
          {selectable && bulkActions && selected.size > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
              {bulkActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => a.onClick(selectedRows)}
                  className={cn("text-xs px-2.5 py-1 rounded-md border", a.tone === "danger"
                    ? "border-danger/40 text-danger hover:bg-danger-light"
                    : "border-surface-border hover:bg-surface-muted")}
                >
                  {a.label}
                </button>
              ))}
              <button onClick={clearSelection} className="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Limpar
              </button>
            </div>
          ) : <span />}
          {columnToggle && (
            <div className="relative shrink-0" ref={colRef}>
              <button onClick={() => setColMenu((v) => !v)} className="btn-secondary text-xs py-1.5" aria-haspopup="menu" aria-expanded={colMenu}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Colunas
              </button>
              {colMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-surface border border-surface-border rounded-lg shadow-elevated p-1.5 max-h-72 overflow-y-auto">
                  {columns.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenKeys.has(c.key)}
                        onChange={() => setHiddenKeys((prev) => {
                          const n = new Set(prev); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n;
                        })}
                      />
                      {c.label || <span className="text-text-muted">(sem título)</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted/50">
                {selectable && (
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar tudo" />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left font-medium text-text-secondary whitespace-nowrap",
                      col.sortable && "cursor-pointer select-none hover:text-text-primary",
                      col.className
                    )}
                    onClick={() => col.sortable && onSort?.(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        sortField === col.key
                          ? sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-12 text-center text-text-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const key = rowKey(row);
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-b border-surface-border last:border-0 transition-colors",
                        onRowClick && "cursor-pointer hover:bg-surface-muted/50",
                        selected.has(key) && "bg-piquet/5"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(key)} onChange={() => toggleRow(key)} aria-label="Selecionar linha" />
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td key={col.key} className={cn("px-4 py-3 text-text-primary whitespace-nowrap", col.className)}>
                          {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-2 py-3 text-sm">
      <span className="text-text-secondary">
        {total > 0 ? `${start}–${end} de ${total}` : "0 resultados"}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-surface-muted disabled:opacity-40" aria-label="Primeira página">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-surface-muted disabled:opacity-40" aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 text-text-secondary">{page} / {totalPages || 1}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-surface-muted disabled:opacity-40" aria-label="Página seguinte">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-surface-muted disabled:opacity-40" aria-label="Última página">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ExportButton({ onExport, label = "Exportar" }: { onExport: () => void; label?: string }) {
  return (
    <button onClick={onExport} className="btn-secondary text-sm">
      {label}
    </button>
  );
}
