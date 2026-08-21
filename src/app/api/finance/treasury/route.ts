import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { isMissingTable } from "@/lib/missingColumn";

/**
 * Saldos de tesouraria registados à mão.
 *
 * GET  → histórico (mais recente primeiro). O primeiro da lista é o saldo em vigor.
 * POST → regista uma leitura da conta num dia.
 *
 * Enquanto a migração não for aplicada, devolve lista vazia em vez de 500 —
 * o Financeiro continua a funcionar, só sem saldo.
 */

export const dynamic = "force-dynamic";

export interface TreasuryRow {
  id: string;
  balance_date: string;
  amount: number;
  account: string;
  note: string;
  created_by: string;
}

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("treasury_balances")
    .select("id, balance_date, amount, account, note, created_by")
    .order("balance_date", { ascending: false })
    .limit(60);
  if (error) {
    if (isMissingTable(error, "treasury_balances")) {
      return apiOk({ items: [], migracaoEmFalta: true });
    }
    return apiErr(error.message, 400);
  }
  return apiOk({ items: (data ?? []) as TreasuryRow[], migracaoEmFalta: false });
});

export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as { amount?: unknown; balanceDate?: unknown; account?: unknown; note?: unknown };
  const amount = Number(b.amount);
  if (!Number.isFinite(amount)) return apiErr("Indica o saldo em euros.", 400);

  const balanceDate = typeof b.balanceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.balanceDate)
    ? b.balanceDate
    : new Date().toISOString().slice(0, 10);
  // Uma leitura futura não é uma leitura — é uma previsão.
  if (balanceDate > new Date().toISOString().slice(0, 10)) {
    return apiErr("A data do saldo não pode ser no futuro.", 400);
  }

  const linha = {
    id: `tb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    balance_date: balanceDate,
    amount: Math.round(amount * 100) / 100,
    account: typeof b.account === "string" ? b.account.trim().slice(0, 80) : "",
    note: typeof b.note === "string" ? b.note.trim().slice(0, 300) : "",
    created_by: staff.email,
  };

  const { error } = await supabaseAdmin().from("treasury_balances").insert(linha);
  if (error) {
    if (isMissingTable(error, "treasury_balances")) {
      return apiErr("Falta aplicar a migração 20260821100000_treasury_balances.sql.", 503);
    }
    return apiErr(error.message, 400);
  }
  return apiOk(linha, 201);
});
