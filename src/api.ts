import { create } from "zustand";
type User = { id: string; name: string; email: string; role: string };
export const useSession = create<{
  token: string;
  user: User | null;
  ready: boolean;
  set: (token: string, user: User | null) => void;
}>((set) => ({
  token: "",
  user: null,
  ready: false,
  set: (token, user) => set({ token, user, ready: true }),
}));
let refreshPromise: Promise<boolean> | null = null;
export async function refreshSession() {
  if (!refreshPromise)
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          useSession.getState().set("", null);
          return false;
        }
        const data = await res.json();
        useSession.getState().set(data.token, data.user);
        return true;
      })
      .catch(() => {
        useSession.getState().set("", null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(!(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${useSession.getState().token}`,
      ...init.headers,
    },
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return api(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
