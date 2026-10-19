/**
 * Media Monitoring & Reputation BI - Global Types
 */

export * from './types/index';

// Backward compatibility aliases
import { User, MediaRecord as StrictMediaRecord } from './types/index';
export type UserRecord = User;

export interface MediaRecord extends StrictMediaRecord {
  categoria?: string;
  alcanceEstimado?: number;
}
