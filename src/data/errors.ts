/** Thrown by a data function when the signed-in person may not see or do something. Pages draw "not allowed". */
export class NotAllowedError extends Error {
  constructor(message = 'Not allowed') {
    super(message);
    this.name = 'NotAllowedError';
  }
}
