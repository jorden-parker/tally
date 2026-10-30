import { getServices } from "@/lib/server/default-services";

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(await getServices().sync());
}
