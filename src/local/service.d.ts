import type { Call, Receipt } from '../../packages/domain/review';
export interface LocalState { calls: Call[]; receipts: Receipt[] }
export function createService(file: string): { load(): Promise<void>; snapshot(): LocalState; dispatch(action: string, input?: Record<string, unknown>): Promise<LocalState> };
