import { Logo, NotConfigured } from "@/components/ui/misc";
import { isConfigured } from "@/lib/env";

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{sub}</p>
          {!isConfigured() && <div className="mb-4"><NotConfigured /></div>}
          {children}
        </div>
      </div>
    </main>
  );
}
