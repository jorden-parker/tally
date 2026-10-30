export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { issueAccessToken } = await import("@/lib/access-token");
  console.log(`Open Tally at http://127.0.0.1:4488/?token=${issueAccessToken()}`);
}
