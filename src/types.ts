
export type ValueProvider<T> = (key: string) => Promise<T> | T
