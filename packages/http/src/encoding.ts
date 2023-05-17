


export function extendedFlattenedMap(values: Record<string, unknown>, prefix: string = ""): { key: string, value: unknown }[] {
  if (typeof values !== "object" || !values) return [{ key: prefix, value: values }];
  return Object.entries(values).flatMap(([key, value]) => {
    key = prefix ? `${prefix}[${key}]` : key;
    switch (typeof value) {
      case "number":
      case "string":
      case "bigint":
      case "boolean":
        return { key, value };
      case "object":
        if (!value) return { key, value };
        if (Array.isArray(value))
          return value.flatMap((value, index) => extendedFlattenedMap(value, `${key}[${index}]`));
        if (value instanceof Blob || value instanceof ArrayBuffer) return { key, value };
        // todo: support sets and maps
        return extendedFlattenedMap(value as never, key);
    }
    return []; // undefined, unsupported types
  });
}


export function formData(values: Record<string, unknown>) {
  const form = new FormData();
  for (const { key, value } of extendedFlattenedMap(values)) {
    if (!value) continue;
    if (typeof value === "object") {
      if (!value) continue;
      if (value instanceof Blob) form.set(key, value);
      if (value instanceof ArrayBuffer) form.set(key, new Blob([value]));
      throw new Error("Unsupported value");
    }
    form.set(key, String(value));
  }
  return form;
}

export function buildUrl(url: string | URL, base: string | undefined, params: Record<string, unknown>): URL {
  if (typeof url === "string") url = new URL(url, base);
  else url = new URL(url);
  const q = url.searchParams;
  const additional = urlParams(params);
  for (const [key, value] of additional.entries())
    if (!q.has(key)) q.set(key, value);
  return url;
}

export function urlParams(values: Record<string, unknown>) {
  const urlParams = new URLSearchParams();
  for (const { key, value } of extendedFlattenedMap(values)) {
    if (typeof value !== "string") continue;
    urlParams.append(key, value);
  }
  return urlParams;
}
