import { supabase, UserPreferences, WorkSession } from './supabase';

export interface ExportData {
  version: string;
  exported_at: string;
  user: {
    id: string;
    username: string;
    created_at: string;
  };
  preferences: UserPreferences | null;
  work_sessions: WorkSession[];
}

export async function exportUserData(userId: string): Promise<ExportData> {
  const [userResult, prefsResult, sessionsResult] = await Promise.all([
    supabase.from('users').select('id, username, created_at').eq('id', userId).maybeSingle(),
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('work_sessions').select('*').eq('user_id', userId).order('date', { ascending: true }).order('clock_in', { ascending: true }),
  ]);

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    user: userResult.data ?? { id: userId, username: '', created_at: '' },
    preferences: prefsResult.data,
    work_sessions: sessionsResult.data ?? [],
  };
}

export function downloadJSON(data: ExportData, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(sessions: WorkSession[], filename: string) {
  const headers = ['id', 'date', 'clock_in', 'clock_out', 'lunch_break_minutes', 'is_lunch_break', 'created_at'];
  const rows = sessions.map((s) => [
    s.id,
    s.date,
    s.clock_in,
    s.clock_out ?? '',
    s.lunch_break_minutes ?? 0,
    s.is_lunch_break ? 'true' : 'false',
    s.created_at ?? '',
  ]);

  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  success: boolean;
  sessionsImported: number;
  sessionsSkipped: number;
  preferencesRestored: boolean;
  errors: string[];
}

export async function importUserData(userId: string, data: ExportData): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    sessionsImported: 0,
    sessionsSkipped: 0,
    preferencesRestored: false,
    errors: [],
  };

  if (!data.version || !data.work_sessions) {
    result.errors.push('Format de fichier invalide');
    return result;
  }

  if (data.preferences) {
    const { error } = await supabase
      .from('user_preferences')
      .update({
        dark_mode: data.preferences.dark_mode,
        required_work_hours: data.preferences.required_work_hours,
        required_lunch_break_minutes: data.preferences.required_lunch_break_minutes,
        end_of_day_threshold: data.preferences.end_of_day_threshold,
        notifications_enabled: data.preferences.notifications_enabled,
        weekly_overtime_minutes: data.preferences.weekly_overtime_minutes,
        use_overtime_compensation: data.preferences.use_overtime_compensation,
        minimum_end_time: data.preferences.minimum_end_time,
        use_minimum_end_time: data.preferences.use_minimum_end_time,
      })
      .eq('user_id', userId);

    if (!error) {
      result.preferencesRestored = true;
    } else {
      result.errors.push('Erreur lors de la restauration des préférences');
    }
  }

  if (data.work_sessions.length > 0) {
    const { data: existingSessions } = await supabase
      .from('work_sessions')
      .select('date, clock_in')
      .eq('user_id', userId);

    const existingKeys = new Set(
      (existingSessions ?? []).map((s) => `${s.date}_${s.clock_in}`)
    );

    const toInsert = data.work_sessions
      .filter((s) => !existingKeys.has(`${s.date}_${s.clock_in}`))
      .map((s) => ({
        user_id: userId,
        clock_in: s.clock_in,
        clock_out: s.clock_out ?? null,
        lunch_break_minutes: s.lunch_break_minutes ?? 0,
        is_lunch_break: s.is_lunch_break ?? false,
        date: s.date,
      }));

    result.sessionsSkipped = data.work_sessions.length - toInsert.length;

    if (toInsert.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('work_sessions').insert(chunk);
        if (error) {
          result.errors.push(`Erreur lors de l'import (lot ${Math.floor(i / chunkSize) + 1})`);
        } else {
          result.sessionsImported += chunk.length;
        }
      }
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

export function parseImportFile(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch {
        reject(new Error('Fichier JSON invalide'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}
