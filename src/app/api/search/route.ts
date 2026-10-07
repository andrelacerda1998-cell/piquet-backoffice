import { apiOk, withStaff } from "../_lib/handler";
import { searchEntities, resultadosVisiveis } from "../_lib/search";

/** GET /api/search?q=... — pesquisa global de entidades (staff only). */
export const GET = withStaff(async (req, { staff }) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const { results } = await searchEntities(q);
  // Cada perfil só vê o tipo de registo que o seu ecrã lhe mostra.
  return apiOk({ results: resultadosVisiveis(staff.role, results) });
});
