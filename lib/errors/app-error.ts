export const ERROR_CODES = {
  DATA_VALIDATION_ERROR: 'DATA_VALIDATION_ERROR',
  NOTE_PARSING_FAILED: 'NOTE_PARSING_FAILED',
  HARDWARE_NOT_FOUND: 'HARDWARE_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface AppErrorParams {
  message: string;
  code: ErrorCode;
}

export class AppError extends Error {
  public readonly code: ErrorCode;

  constructor(params: AppErrorParams) {
    super(params.message);
    this.code = params.code;
    this.name = 'AppError';
  }
}
