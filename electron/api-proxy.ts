import { net } from "electron";
import type { ClientRequest, IncomingMessage } from "electron";

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

function friendlyNetworkError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return "Não foi possível encontrar o servidor. Verifique a URL em Configurações.";
  }
  if (lower.includes("cert") || lower.includes("ssl") || lower.includes("tls")) {
    return "Falha na conexão segura com o servidor. Verifique se a URL usa https:// corretamente.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "O servidor demorou para responder. Tente novamente.";
  }
  if (lower === "fetch failed" || lower.includes("network")) {
    return "Não foi possível conectar ao servidor StepGo. Verifique sua internet e a URL do servidor.";
  }

  return message;
}

function buildMultipartBody(
  fields: Record<string, string>,
  file: ApiMultipartFile,
): { body: Buffer; boundary: string } {
  const boundary = `----StepGoForm${Date.now().toString(36)}`;
  const chunks: Buffer[] = [];

  const appendText = (text: string) => {
    chunks.push(Buffer.from(text, "utf8"));
  };

  for (const [name, value] of Object.entries(fields)) {
    appendText(`--${boundary}\r\n`);
    appendText(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    appendText(`${value}\r\n`);
  }

  const fileBuffer = Buffer.from(file.base64, "base64");
  appendText(`--${boundary}\r\n`);
  appendText(
    `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n`,
  );
  appendText(`Content-Type: ${file.mimeType}\r\n\r\n`);
  chunks.push(fileBuffer);
  appendText(`\r\n--${boundary}--\r\n`);

  return { body: Buffer.concat(chunks), boundary };
}

function readResponseBody(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    response.on("error", reject);
  });
}

function sendNetRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: Buffer,
): Promise<ApiRequestResult> {
  return new Promise((resolve) => {
    let request: ClientRequest;

    try {
      request = net.request({ method, url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "URL inválida";
      resolve({ ok: false, status: 0, data: { error: friendlyNetworkError(message) } });
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value);
    }

    request.on("response", (response) => {
      void readResponseBody(response)
        .then((text) => {
          let data: unknown = {};
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = { error: text || "Resposta inválida do servidor" };
          }

          const status = response.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            data,
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Erro ao ler resposta";
          resolve({ ok: false, status: 0, data: { error: friendlyNetworkError(message) } });
        });
    });

    request.on("error", (error) => {
      resolve({ ok: false, status: 0, data: { error: friendlyNetworkError(error.message) } });
    });

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

export async function proxyApiRequest(payload: ApiRequestPayload): Promise<ApiRequestResult> {
  const url = `${payload.baseUrl.replace(/\/$/, "")}${payload.path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-StepGo-Client": "desktop",
    "User-Agent": "StepGo-Atendente-Desktop/1.0",
  };

  if (payload.token) {
    headers.Authorization = `Bearer ${payload.token}`;
  }

  let body: Buffer | undefined;

  if (payload.multipart) {
    const multipart = buildMultipartBody(payload.multipart.fields, payload.multipart.file);
    headers["Content-Type"] = `multipart/form-data; boundary=${multipart.boundary}`;
    body = multipart.body;
  } else if (payload.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = Buffer.from(JSON.stringify(payload.jsonBody), "utf8");
  }

  return sendNetRequest(url, payload.method ?? "GET", headers, body);
}
