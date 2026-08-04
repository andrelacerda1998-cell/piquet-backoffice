import { apiOk, withStaff } from "../_lib/handler";
import { searchEntities } from "../_lib/search";

/** GET /api/search?q=... — pesquisa global de entidades (staff only). */
export const GET = withStaff(async (req) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return apiOk(await searchEntities(q));
});
