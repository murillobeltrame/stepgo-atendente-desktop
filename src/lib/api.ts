import type { AdminInfo, InboxFilter, PendingAttachment, SupportConversation } from "@/types";

let apiBaseUrl = "https://nivesistemas.com.br";
let authToken: string | null = null;

export function configureApi(baseUrl: string, token: string | null) {
  apiBaseUrl = baseUrl.replace(/\/$/, "");
  authToken = token;
}

type JsonRequestInit = {
  method?: string;
  jsonBody?: unknown;
};

async function request<T>(path: string, init?: JsonRequestInit): Promise<T> {
  const result = await window.stepgoDesktop.apiRequest({
    baseUrl: apiBaseUrl,
    path,
    method: init?.method,
    token: authToken,
    jsonBody: init?.jsonBody,
  });

  const json = result.data as T & { error?: string };

  if (!result.ok) {
    if (result.status === 0) {
      throw new Error(
        (json.error as string | undefined) ??
          "Não foi possível conectar ao servidor. Verifique a URL em Configurações e sua internet.",
      );
    }
    throw new Error((json.error as string | undefined) ?? `Erro ${result.status}`);
  }

  return json;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  }>("/api/admin/login", {
    method: "POST",
    jsonBody: { email, password },
  });

  if (json.requiresTwoFactor && json.pendingToken) {
    return { kind: "two-factor", pendingToken: json.pendingToken };
  }

  if (!json.token || !json.admin) {
    throw new Error(
      "O servidor não retornou a sessão do desktop. Atualize o site StepGo para a versão mais recente.",
    );
  }

  return { kind: "success", token: json.token, admin: json.admin };
}

export async function verifyTwoFactor(pendingToken: string, code: string) {
  const json = await request<{ token?: string; admin?: AdminInfo; error?: string }>(
    "/api/admin/login/2fa/verify",
    {
      method: "POST",
      jsonBody: { pendingToken, code },
    },
  );

  if (!json.token || !json.admin) {
    throw new Error(json.error ?? "Resposta de verificação inválida");
  }

  return { token: json.token, admin: json.admin };
}

export async function recoverTwoFactor(pendingToken: string, backupCode: string) {
  const json = await request<{ token?: string; admin?: AdminInfo; error?: string }>(
    "/api/admin/login/2fa/recover",
    {
      method: "POST",
      jsonBody: { pendingToken, backupCode },
    },
  );

  if (!json.token || !json.admin) {
    throw new Error(json.error ?? "Resposta de recuperação inválida");
  }

  return { token: json.token, admin: json.admin };
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
    jsonBody: {
      body,
      attachment: attachment
        ? {
            url: attachment.url,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
            sizeBytes: attachment.sizeBytes,
          }
        : undefined,
    },
  });
}

export async function uploadAttachment(file: File, storeSlug: string) {
  const result = await window.stepgoDesktop.apiRequest({
    baseUrl: apiBaseUrl,
    path: "/api/admin/support/attachments",
    method: "POST",
    token: authToken,
    multipart: {
      fields: { storeSlug },
      file: {
        fieldName: "file",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: await fileToBase64(file),
      },
    },
  });

  const json = result.data as { attachment?: PendingAttachment; error?: string };
  if (!result.ok || !json.attachment) {
    throw new Error(json.error ?? "Falha ao enviar arquivo");
  }

  return { attachment: json.attachment };
}
