export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

/** Bad user input. Screens show `message` next to the form. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
