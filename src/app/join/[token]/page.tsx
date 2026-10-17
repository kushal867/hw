import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { JoinButton } from "@/components/join-button";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Join a semester" };

// The token is validated server-side only when the user confirms; this page reveals nothing about the semester.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getCurrentUser();
  return (
    <AuthShell title="You've been invited" sub="Join your classmates' private semester workspace.">
      {me ? <JoinButton token={token} /> : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Log in or create a free account to accept this invitation.</p>
          <Link className="btn-primary w-full" href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>Log In</Link>
          <Link className="btn-secondary w-full" href={`/signup`}>Create account</Link>
        </div>)}
    </AuthShell>
  );
}
