"use client";
import { ErrorState } from "@/components/ui/misc";
export default function Error({ reset }: { reset: () => void }) {
  return <div className="space-y-3"><ErrorState /><button className="btn-secondary" onClick={reset}>Try again</button></div>;
}
