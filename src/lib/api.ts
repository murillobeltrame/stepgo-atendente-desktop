import type { AdminInfo, InboxFilter, PendingAttachment, SupportConversation } from "@/types";

let apiBaseUrl = "https://stepgo.com.br";
let authToken: string | null = null;

export function configureApi(baseUrl: string, token: string | null) {
  apiBaseUrl = baseUrl.replace(/\/$/, "");
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Erro ${res.status}`);
  }

  return json;
}

export type LoginResult =
  | { kind: "success"; token: string; admin: AdminInfo }
  | { kind: "two-factor"; pendingToken: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const json = await request<{
    ok?: boolean;
    token?: string;
    admin?: AdminInfo;
    requiresTwoFactor?: boolean;
    pendingToken?: string;
    error?: string;
  }>("/api/admin/desktop/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (json.requiresTwoFactor && json.pendingToken) {
    return { kind: "two-factor", pendingToken: json.pendingToken };
  }

  if (!json.token || !json.admin) {
    throw new Error("Resposta de login inválida");
  }

  return { kind: "success", token: json.token, admin: json.admin };
}

export async function verifyTwoFactor(pendingToken: string, code: string) {
  const json = await request<{ token: string; admin: AdminInfo }>(
    "/api/admin/desktop/login/2fa/verify",
    {
      method: "POST",
      body: JSON.stringify({ pendingToken, code }),
    },
  );
  return json;
}

export async function recoverTwoFactor(pendingToken: string, backupCode: string) {
  const json = await request<{ token: string; admin: AdminInfo }>(
    "/api/admin/desktop/login/2fa/recover",
    {
      method: "POST",
      body: JSON.stringify({ pendingToken, backupCode }),
    },
  );
  return json;
}

export async function fetchInbox(filter: InboxFilter) {
  return request<{
    conversations: SupportConversation[];
    currentAdmin: AdminInfo;
  }>(`/api/admin/support/conversations?filter=${filter}`);
}

export async function fetchConversation(id: string) {
  return request<{
    conversation: SupportConversation;
    currentAdmin: AdminInfo;
  }>(`/api/admin/support/conversations/${id}`);
}

export async function claimConversation(id: string) {
  return request(`/api/admin/support/conversations/${id}/claim`, { method: "POST" });
}

export async function closeConversation(id: string) {
  return request(`/api/admin/support/conversations/${id}/close`, { method: "POST" });
}

export async function sendMessage(
  id: string,
  body: string,
  attachment?: PendingAttachment,
) {
  return request(`/api/admin/support/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body,
      attachment: attachment
        ? {
            url: attachment.url,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
            sizeBytes: attachment.sizeBytes,
          }
        : undefined,
    }),
  });
}

export async function uploadAttachment(file: File, storeSlug: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("storeSlug", storeSlug);
  return request<{ attachment: PendingAttachment }>("/api/admin/support/attachments", {
    method: "POST",
    body: formData,
  });
}
