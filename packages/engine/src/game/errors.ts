export type EngineErrorCode =
  | 'NO_BETS'
  | 'UNKNOWN_BET'
  | 'INVALID_STAKE'
  | 'STAKE_BELOW_MIN'
  | 'STAKE_ABOVE_MAX'
  | 'MAIN_BET_REQUIRED'
  | 'INVALID_ODDS'
  | 'BET_NOT_PLACED'
  | 'BET_ALREADY_SETTLED'
  | 'UNSETTLED_BETS'
  | 'NOT_AWAITING_DECISION'
  | 'INVALID_CHOICE'
  | 'ROUND_CLOSED';

/**
 * A rule violation detected by the engine. `code` is stable and meant for
 * programmatic handling (e.g. mapping to a UI message or an API error).
 */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}
