import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  return false;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return new Response("unauthorized", { status: 401 });
  }
  const runtime = await import("@/lib/hedge/runtime.server");
  const result = await runtime.cronSweep();
  return Response.json(result);
}

export const Route = createFileRoute("/api/hedge/cron")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
