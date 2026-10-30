import { getServices } from "@/lib/server/default-services";
import { InvalidSettingsError } from "@/lib/server/services";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function GET() {
  return Response.json(getServices().settings());
}

export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return badRequest("Body must be JSON");
  try {
    return Response.json(getServices().updateSettings(body));
  } catch (error) {
    if (error instanceof InvalidSettingsError) return badRequest(error.message);
    throw error;
  }
}
