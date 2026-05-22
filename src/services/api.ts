import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const TOKEN_KEY = "crf_jwt";
const extra = Constants.expoConfig?.extra || {};
const API_URL = String(extra.apiUrl || "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);

export async function setToken(t: string | null) {
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function hasToken(): Promise<boolean> {
  return Boolean(await getToken());
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const tok = await getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const r = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    await setToken(null);
    throw new Error("Não autenticado");
  }
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return undefined as any;
  return r.json();
}

export const api = {
  login: async (email: string, password: string) => {
    await setToken(null);
    return request<{ token: string; user: any }>("POST", "/auth/login", {
      email,
      password,
    });
  },
  me: () => request<any>("GET", "/auth/me"),
  listUsers: () => request<any[]>("GET", "/auth/users"),
  createUser: (data: any) => request<any>("POST", "/auth/users", data),
  updateUser: (id: string, data: any) => request<any>("PUT", `/auth/users/${id}`, data),
  deleteUser: (id: string) => request<any>("DELETE", `/auth/users/${id}`),
  listSessions: () => request<any[]>("GET", "/auth/sessions"),
  sync: (since: string | null, push: any) =>
    request<{ now: string; pull: any; syncMap?: any[] }>("POST", "/sync", {
      since,
      push,
    }),
};
