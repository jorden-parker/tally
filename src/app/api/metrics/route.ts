import { isRange } from "@/lib/metrics/summary";
import { getServices } from "@/lib/server/default-services";

export const dynamic = "force-dynamic";

const DEFAULT_RANGE = "week";

export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get("range") ?? DEFAULT_RANGE;
  if (!isRange(range)) {
    return Response.json({ error: `Unknown range: ${range}` }, { status: 400 });
  }
  return Response.json(getServices().summary(range));
}
