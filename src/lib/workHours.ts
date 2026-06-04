/**
 * Horaires de travail variables par jour de la semaine (1.7).
 *
 * Quand `use_custom_schedule` est actif, l'objectif quotidien dépend du jour
 * de la semaine (`work_hours_by_day`, tableau de 7 valeurs Lun→Dim). Sinon on
 * retombe sur la valeur unique `required_work_hours`.
 */
import type { UserPreferences } from './supabase';

// Libellés des jours, dans l'ordre du tableau work_hours_by_day (Lun → Dim).
export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Convertit getDay() (0=Dim..6=Sam) vers notre index (Lun=0..Dim=6). */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Horaire requis (en heures) pour la date donnée, selon les préférences. */
export function getRequiredHoursForDate(
  prefs: Pick<UserPreferences, 'required_work_hours' | 'use_custom_schedule' | 'work_hours_by_day'>,
  date: Date
): number {
  if (prefs.use_custom_schedule && prefs.work_hours_by_day) {
    const v = prefs.work_hours_by_day[weekdayIndex(date)];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return prefs.required_work_hours;
}

/**
 * Y a-t-il une pause de midi pour la date donnée ? (1.7.1)
 * Avec l'horaire personnalisé, chaque jour peut être marqué « sans pause »
 * (journée continue, ex. demi-journée de temps partiel) : dans ce cas la
 * pause déjeuner n'entre plus dans le calcul de l'heure de sortie.
 */
export function hasLunchBreakForDate(
  prefs: Pick<UserPreferences, 'use_custom_schedule' | 'no_lunch_break_by_day'>,
  date: Date
): boolean {
  if (prefs.use_custom_schedule && prefs.no_lunch_break_by_day) {
    return !prefs.no_lunch_break_by_day[weekdayIndex(date)];
  }
  return true;
}
