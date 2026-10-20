"use client";
import { useEffect, useRef } from "react";

/** Drop inside a GET filter form: changing any <select> applies the filters immediately (no extra "Apply" click). */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form"); if (!form) return;
    const onChange = (e: Event) => { if ((e.target as HTMLElement).tagName === "SELECT") form.requestSubmit(); };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  return <span ref={ref} hidden />;
}
