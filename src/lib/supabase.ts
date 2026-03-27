/**
 * Supabase remplacé par notre client PHP local.
 * Ré-export transparent : tous les composants continuent d'importer depuis ici.
 */
export { supabase } from './api-client';

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  dark_mode: boolean;
  notifications_enabled: boolean;
  required_work_hours: number;
  required_lunch_break_minutes: number;
  end_of_day_threshold: number;
  weekly_overtime_minutes: number;
  use_overtime_compensation: boolean;
  minimum_end_time: string | null;
  use_minimum_end_time: boolean;
  last_seen_version: string | null;
  overtime_period: 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'lifetime';
  updated_at: string;
}

export interface WorkSession {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  lunch_break_minutes: number;
  is_lunch_break: boolean;
  date: string;
  created_at: string;
}
