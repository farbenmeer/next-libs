import { buildUrl, formData, urlParams } from "src/encoding";

export interface HttpClientOptions extends Partial<Omit<RequestInit, "headers">> {
  baseUrl?: string;
  headers?: Record<string, string | string[]>;
  query?: Record<string, string | string[] | boolean>;
  contentType?: "json" | "form" | "form-data";
  responseType?: "json" | "text" | "blob" | "arrayBuffer";
}

export interface RequestSpecification {
  url: string | URL;
  method: string;
  data?: unknown;
}

export interface HttpResponse<T> {
  status: number;
  headers: Headers;
  data: T;
  raw: Response;
}

export class HttpClient {

  options: HttpClientOptions;

  constructor(options: HttpClientOptions = {}) {
    this.options = options;
  }

  get<T = unknown>(url: string | URL, config?: HttpClientOptions): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "GET", url }, config);
  }

  post<T = unknown>(url: string | URL, data?: unknown, config?: HttpClientOptions): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "POST", url, data }, config);
  }

  put<T = unknown>(url: string | URL, data?: unknown, config?: HttpClientOptions): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "PUT", url, data }, config);
  }

  delete<T = unknown>(url: string | URL, config?: HttpClientOptions): Promise<HttpResponse<T>> {
    return this.request<T>({ method: "DELETE", url }, config);
  }

  async request<T = unknown>(spec: RequestSpecification, config?: HttpClientOptions): Promise<HttpResponse<T>> {
    const options = this.mergeOptions(config);
    const url = this.mergeUrl(spec, options);

    const { headers = {}, contentType, responseType, baseUrl: _, ...requestInit } = options;
    if (contentType) headers["content-type"] = contentType === "json" ? "application/json" : "application/x-www-form-urlencoded"
    const requestBody = this.prepareBody(spec.data, contentType);

    const response = await fetch(url, {
      method: spec.method,
      ...requestInit,
      headers: [...this.prepareHeaders(headers)],
      body: requestBody,
    });

    let body = undefined;

    if (responseType === "json" || response.headers.get("content-type")?.toLowerCase()?.startsWith("application/json"))
      body = await response.json();
    else if (responseType === "text")
      body = await response.text();
    else if (responseType === "blob")
      body = await response.blob();
    else if (responseType === "arrayBuffer")
      body = await response.arrayBuffer();

    return {
      raw: response,
      data: body,
      headers: response.headers,
      status: response.status,
    };
  }

  prepareBody(body: unknown, contentType?: "form" | "json" | "form-data") {
    if (body == null) return;
    if (contentType === "form") return urlParams(body as never).toString();
    if (contentType === "json") return JSON.stringify(body);
    if (contentType === "form-data") return typeof body === "object" && (body instanceof FormData)
      ? body : formData(body as never);
    return body as any;
  }

  * prepareHeaders(headers: Record<string, string | string[]>): Generator<[string, string]> {
    for (const [key, value] of Object.entries(headers))
      if (!Array.isArray(value)) yield [key, value];
      else for (const val of value)
        yield [key, val];
  }

  mergeOptions(config: HttpClientOptions = {}) {
    const copy = { ...this.options };
    copy.headers = { ...lowercaseKeys(copy.headers ?? {}), ...lowercaseKeys(config.headers ?? {}) };
    copy.query = { ...(copy.query ?? {}), ...(config.query ?? {}) };
    for (const [key, value] of Object.entries(config)) {
      if (key === "headers" || key === "query") continue;
      (copy as any)[key] = value;
    }
    return copy;
  }

  mergeUrl({ url }: RequestSpecification, { query = {}, baseUrl = this.options.baseUrl }: HttpClientOptions) {
    return buildUrl(url, baseUrl, query);
  }
}


function lowercaseKeys<T extends Record<string, unknown>>(obj: T): {
  [Key in keyof T as `${Lowercase<Key & string>}`]: T[Key]
} {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value])) as any;
}
