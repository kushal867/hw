/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export const safeNext = (n: unknown) => (typeof n === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(n) ? n : "/dashboard");
