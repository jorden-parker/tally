import { getServices } from "@/lib/server/default-services";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getServices().assignedStories());
}
