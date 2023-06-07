type Entry<T, Key extends keyof T = keyof T> = [key: Key, value: T[Key]];
type EntryMap<T, R> = (entry: Entry<T>, index: number, entries: Entry<T>[]) => Entry<R>;
export function entries<T>(obj: T): Entry<T>[] {
  return Object.entries(obj as object) as Entry<T>[];
}

export function fromEntries<T>(entries: Entry<T>[]): T {
  return Object.fromEntries(entries) as T;
}

export function mapEntries<T, R>(obj: T, map: EntryMap<T, R>) {
  return fromEntries(entries(obj).map(map));
}
