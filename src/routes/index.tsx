import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { KeelApp } from "@/components/keel/app";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { isPending } = useCurrentUserState();
  if (isPending) return <DeskSkeleton />;
  return (
    <SignInGate fallback={<DeskLock />}>
      <KeelApp />
    </SignInGate>
  );
}

function DeskSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-fg">
      <h1 className="text-2xl font-medium tracking-tight">MCM Delta Hedger</h1>
      <p className="mt-2 text-sm text-muted">Checking session…</p>
      <div className="mt-6 h-10 w-48 animate-pulse rounded-md bg-surface-2" />
    </div>
  );
}

function DeskLock() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm space-y-5">
        <div className="h-10 w-1 rounded-full bg-border" />
        <div>
          <h1 className="text-2xl font-medium tracking-tight">MCM Delta Hedger</h1>
          <p className="mt-2 text-sm text-muted">
            Session lock. Sign in — keys and delta controls stay on your account only.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              variant="secondary"
              className="w-full"
              onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
      </div>
    </main>
  );
}
