export function navigate(path: string): void {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.history.pushState(null, "", `${base}${path}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
