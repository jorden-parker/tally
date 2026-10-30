import { getServices } from "@/lib/server/default-services";
import { parseDayRange } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = parseDayRange(searchParams.get("from"), searchParams.get("to"));
  if (period === null) {
    return Response.json(
      { error: "Choose a from date on or before the to date." },
      { status: 400 },
    );
  }
  return Response.json(getServices().work(period));
}
