import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

const CITIES = ["Lisboa", "Amadora", "Loures", "Odivelas", "Sintra", "Cascais"];
const SUPPLY_STATUS = ["aprovado", "ativo", "disponivel"];

/** GET /api/technicians/coverage — procura (serviços) vs oferta (técnicos) por cidade. */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const [svc, tech] = await Promise.all([
    admin.from("services").select("city"),
    admin.from("technicians").select("city, status"),
  ]);
  if (svc.error) throw new Error(svc.error.message);
  if (tech.error) throw new Error(tech.error.message);

  const services = (svc.data ?? []) as { city: string | null }[];
  const technicians = (tech.data ?? []) as { city: string | null; status: string }[];

  return apiOk(
    CITIES.map((city) => {
      const demand = services.filter((s) => s.city === city).length;
      const supply = technicians.filter((t) => t.city === city && SUPPLY_STATUS.includes(t.status)).length;
      return { name: city, procura: demand, oferta: supply, ratio: supply ? demand / supply : demand };
    })
  );
});
