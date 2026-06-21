export type ApiMultipartFile = {
  fieldName: string;
  fileName: string;
  mimeType: string;
  base64: string;
};

export type ApiRequestPayload = {
  baseUrl: string;
  path: string;
  method?: string;
  token?: string | null;
  jsonBody?: unknown;
  multipart?: {
    fields: Record<string, string>;
    file: ApiMultipartFile;
  };
};

export type ApiRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

export async function proxyApiRequest(payload: ApiRequestPayload): Promise<ApiRequestResult> {
  const url = `${payload.baseUrl.replace(/\/$/, "")}${payload.path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-StepGo-Client": "desktop",
  };

  if (payload.token) {
    headers.Authorization = `Bearer ${payload.token}`;
  }

  let body: string | FormData | undefined;

  if (payload.multipart) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload.multipart.fields)) {
      form.append(key, value);
    }
    const bytes = Buffer.from(payload.multipart.file.base64, "base64");
    const blob = new Blob([bytes], { type: payload.multipart.file.mimeType });
    form.append(payload.multipart.file.fieldName, blob, payload.multipart.file.fileName);
    body = form;
  } else if (payload.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload.jsonBody);
  }

  try {
    const response = await fetch(url, {
      method: payload.method ?? "GET",
      headers,
      body,
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível conectar ao servidor StepGo";
    return { ok: false, status: 0, data: { error: message } };
  }
}
