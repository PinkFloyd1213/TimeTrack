import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, WorkSession, UserPreferences } from '../lib/supabase';
import { Clock, LogOut, Play, Pause, Settings as SettingsIcon, Pencil, Trash2, Check, X, Timer, Calculator, History } from 'lucide-react';
import { Settings } from './Settings';
import { Statistics } from './Statistics';
import { EditHistory } from './EditHistory';
import { ConfirmModal } from './ConfirmModal';
import { ChangelogModal } from './ChangelogModal';
import { APP_VERSION } from '../lib/changelog';

export function TimeTracker() {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([]);
  const [allSessions, setAllSessions] = useState<WorkSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [overtimeInput, setOvertimeInput] = useState('');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [notificationSent, setNotificationSent] = useState(false);
  const [lunchBreakNotificationSent, setLunchBreakNotificationSent] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      loadPreferences();
      loadTodaySessions();
      loadAllSessions();
    }
  }, [user]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!preferences?.notifications_enabled) return;

    const checkNotification = () => {
      if (activeSession) {
        const endTime = calculateEndTime();
        if (!endTime) return;

        const now = new Date();
        const timeDiff = endTime.getTime() - now.getTime();
        const minutesUntilEnd = Math.floor(timeDiff / (1000 * 60));

        if (minutesUntilEnd === 5 && !notificationSent) {
          new Notification('⏰ Bientôt l\'heure de partir !', {
            body: 'Tu peux partir dans 5 minutes ! 🎉',
            icon: '/prime-time.png',
            badge: '/prime-time.png'
          });
          setNotificationSent(true);
        }

        if (minutesUntilEnd < 5 || minutesUntilEnd > 6) {
          setNotificationSent(false);
        }
      }

      const lunchTime = getLunchBreakTime();
      if (lunchTime && !lunchTime.isOvertime) {
        const minutesRemaining = Math.floor(lunchTime.remaining);

        if (minutesRemaining === 2 && !lunchBreakNotificationSent) {
          new Notification('☕ Fin de pause bientôt !', {
            body: 'Plus que 2 minutes de pause, il va falloir reprendre ! 💪',
            icon: '/prime-time.png',
            badge: '/prime-time.png'
          });
          setLunchBreakNotificationSent(true);
        }

        if (minutesRemaining < 2 || minutesRemaining > 3) {
          setLunchBreakNotificationSent(false);
        }
      }
    };

    checkNotification();
    const interval = setInterval(checkNotification, 60000);

    return () => clearInterval(interval);
  }, [preferences, activeSession, currentTime, notificationSent, lunchBreakNotificationSent]);

  const loadPreferences = async () => {
    if (!user) return;

    const { data } = await supabase
      .from<UserPreferences>('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences(data);
      setDarkMode(data.dark_mode);
      if (data.last_seen_version !== APP_VERSION) {
        setShowChangelog(true);
      }
    }
  };

  const loadTodaySessions = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from<WorkSession[]>('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('clock_in', { ascending: true });

    if (data) {
      setTodaySessions(data);
      const active = data.find((s) => !s.clock_out);
      setActiveSession(active || null);
    }
  };

  const loadAllSessions = async () => {
    if (!user) return;

    const { data } = await supabase
      .from<WorkSession[]>('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false });

    if (data) {
      setAllSessions(data);
    }
  };

  const clockIn = async () => {
    if (!user) return;

    const now = new Date();
    const { data } = await supabase
      .from('work_sessions')
      .insert({
        user_id: user.id,
        clock_in: now.toISOString(),
        date: now.toISOString().split('T')[0],
        lunch_break_minutes: 0,
        is_lunch_break: false,
      })
      .select()
      .single();

    if (data) {
      await loadTodaySessions();
      await loadAllSessions();
    }
  };

  const clockOut = async () => {
    if (!activeSession) return;

    const now = new Date();
    await supabase
      .from('work_sessions')
      .update({ clock_out: now.toISOString() })
      .eq('id', activeSession.id);

    await loadTodaySessions();
    await loadAllSessions();
  };

  const parseOvertimeInput = (input: string): number => {
    if (!input || input.trim() === '') return 0;

    const trimmed = input.trim().replace(',', '.');

    // Format "X h XX min" ou "X h"
    const hMinMatch = trimmed.match(/^(\d+)\s*h\s*(\d+)\s*min$/i);
    if (hMinMatch) return parseInt(hMinMatch[1]) * 60 + parseInt(hMinMatch[2]);

    const hOnlyMatch = trimmed.match(/^(\d+)\s*h$/i);
    if (hOnlyMatch) return parseInt(hOnlyMatch[1]) * 60;

    // Format "XX min"
    const minOnlyMatch = trimmed.match(/^(\d+)\s*min$/i);
    if (minOnlyMatch) return parseInt(minOnlyMatch[1]);

    if (trimmed.endsWith('h')) {
      const hours = parseFloat(trimmed.slice(0, -1));
      return Math.round(hours * 60);
    }

    const value = parseFloat(trimmed);
    if (isNaN(value)) return 0;

    if (value < 10) {
      return Math.round(value * 60);
    }

    return Math.round(value);
  };

  const formatOvertimeMinutes = (minutes: number): string => {
    if (minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${String(m).padStart(2, '0')} min`;
  };

  const handleOvertimeSave = async () => {
    if (!user || !preferences || !overtimeInput.trim()) return;

    const minutes = parseOvertimeInput(overtimeInput);
    if (minutes < 0) return;

    await supabase
      .from('user_preferences')
      .update({ weekly_overtime_minutes: minutes })
      .eq('user_id', user.id);

    await loadPreferences();
  };

  const calculateWeeklyOvertime = async () => {
    if (!user || !preferences) return;

    setIsDetecting(true);

    const today = new Date();
    const period = preferences.overtime_period || 'week';

    const getPeriodStart = (): string | null => {
      const d = new Date(today);
      if (period === 'week') {
        const dayOfWeek = d.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        d.setDate(d.getDate() + diff);
      } else if (period === 'month') {
        d.setDate(1);
      } else if (period === 'quarter') {
        const month = d.getMonth();
        d.setMonth(Math.floor(month / 3) * 3, 1);
      } else if (period === 'semester') {
        d.setMonth(d.getMonth() < 6 ? 0 : 6, 1);
      } else if (period === 'year') {
        d.setMonth(0, 1);
      } else {
        return null; // lifetime : pas de filtre de début
      }
      d.setHours(0, 0, 0, 0);
      return d.toISOString().split('T')[0];
    };

    const periodStart = getPeriodStart();

    let query = supabase
      .from<WorkSession[]>('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .lt('date', today.toISOString().split('T')[0]);

    if (periodStart) {
      query = query.gte('date', periodStart);
    }

    const { data } = await query;

    if (!data) {
      setTimeout(() => setIsDetecting(false), 800);
      return;
    }

    let totalMinutes = 0;
    data.forEach((session) => {
      if (session.clock_out) {
        const start = new Date(session.clock_in);
        const end = new Date(session.clock_out);
        const sessionMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        totalMinutes += sessionMinutes;
      }
    });

    const daysWorked = new Set(data.map(s => s.date)).size;
    const expectedMinutes = daysWorked * preferences.required_work_hours * 60;
    const overtimeMinutes = Math.max(0, totalMinutes - expectedMinutes);

    setOvertimeInput(formatOvertimeMinutes(Math.round(overtimeMinutes)));
    setTimeout(() => setIsDetecting(false), 800);
  };

  const toggleOvertimeCompensation = async () => {
    if (!user || !preferences) return;

    const newValue = !preferences.use_overtime_compensation;
    await supabase
      .from('user_preferences')
      .update({ use_overtime_compensation: newValue })
      .eq('user_id', user.id);

    await loadPreferences();
  };

  const toggleMinimumEndTime = async () => {
    if (!user || !preferences) return;

    const newValue = !preferences.use_minimum_end_time;
    await supabase
      .from('user_preferences')
      .update({ use_minimum_end_time: newValue })
      .eq('user_id', user.id);

    await loadPreferences();
  };

  const startEditSession = (session: WorkSession) => {
    setEditingSession(session.id);
    setEditClockIn(
      new Date(session.clock_in).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    setEditClockOut(
      session.clock_out
        ? new Date(session.clock_out).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : ''
    );
  };

  const saveEditSession = async (sessionId: string) => {
    const session = todaySessions.find((s) => s.id === sessionId);
    if (!session) return;

    const [inHours, inMinutes] = editClockIn.split(':');
    const clockInDate = new Date(session.clock_in);
    clockInDate.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);

    const updates: { clock_in: string; clock_out?: string } = {
      clock_in: clockInDate.toISOString(),
    };

    if (editClockOut) {
      const [outHours, outMinutes] = editClockOut.split(':');
      const clockOutDate = new Date(session.clock_in);
      clockOutDate.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);
      updates.clock_out = clockOutDate.toISOString();
    }

    await supabase.from('work_sessions').update(updates).eq('id', sessionId);

    setEditingSession(null);
    await loadTodaySessions();
    await loadAllSessions();
  };

  const dismissChangelog = async () => {
    if (!user) return;
    setShowChangelog(false);
    await supabase
      .from('user_preferences')
      .update({ last_seen_version: APP_VERSION })
      .eq('user_id', user.id);
    await loadPreferences();
  };

  const deleteSession = (sessionId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer la session',
      message: 'Voulez-vous vraiment supprimer cette entrée ?',
      onConfirm: async () => {
        await supabase.from('work_sessions').delete().eq('id', sessionId);
        await loadTodaySessions();
        await loadAllSessions();
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const getPlannedFutureMinutes = () => {
    let planned = 0;
    todaySessions.forEach((session) => {
      if (session.clock_out && new Date(session.clock_in) > currentTime) {
        const start = new Date(session.clock_in);
        const end = new Date(session.clock_out);
        planned += (end.getTime() - start.getTime()) / (1000 * 60);
      }
    });
    return planned;
  };

  const calculateWorkTime = () => {
    let totalMinutes = 0;
    let lunchBreakMinutes = 0;

    todaySessions.forEach((session) => {
      if (session.clock_out && new Date(session.clock_in) > currentTime) {
        return;
      }
      const start = new Date(session.clock_in);
      const end = session.clock_out ? new Date(session.clock_out) : currentTime;
      const sessionMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      totalMinutes += sessionMinutes;

      if (session.lunch_break_minutes > 0) {
        lunchBreakMinutes = session.lunch_break_minutes;
      }
    });

    const detectedLunchBreak = detectLunchBreak();
    if (detectedLunchBreak > 0 && lunchBreakMinutes === 0) {
      lunchBreakMinutes = detectedLunchBreak;
    }

    return { totalMinutes, lunchBreakMinutes };
  };

  const detectLunchBreak = () => {
    const pastSessions = todaySessions.filter(
      s => !(s.clock_out && new Date(s.clock_in) > currentTime)
    );
    if (pastSessions.length < 2) return 0;

    let maxBreak = 0;
    for (let i = 0; i < pastSessions.length - 1; i++) {
      const currentEnd = pastSessions[i].clock_out;
      const nextStart = pastSessions[i + 1].clock_in;

      if (currentEnd && nextStart) {
        const breakMinutes =
          (new Date(nextStart).getTime() - new Date(currentEnd).getTime()) / (1000 * 60);
        if (breakMinutes > maxBreak) {
          maxBreak = breakMinutes;
        }
      }
    }

    return maxBreak;
  };

  const getEffectiveLunchBreakMinutes = () => {
    if (!preferences) return 30;

    const defaultBreak = preferences.required_lunch_break_minutes;

    const pastSessions = todaySessions.filter(
      s => !(s.clock_out && new Date(s.clock_in) > currentTime)
    );

    if (!preferences.minimum_end_time || preferences.use_minimum_end_time === false || pastSessions.length === 0) return defaultBreak;

    const firstClockIn = new Date(pastSessions[0].clock_in);
    const [minEndHours, minEndMinutes] = preferences.minimum_end_time.split(':');
    const minEndTime = new Date();
    minEndTime.setHours(parseInt(minEndHours), parseInt(minEndMinutes), 0, 0);

    const availableMinutes = (minEndTime.getTime() - firstClockIn.getTime()) / (1000 * 60);

    let requiredMinutes = preferences.required_work_hours * 60;
    if (preferences.use_overtime_compensation && preferences.weekly_overtime_minutes > 0) {
      requiredMinutes -= preferences.weekly_overtime_minutes;
    }

    const adaptedBreak = availableMinutes - requiredMinutes;
    return Math.max(adaptedBreak, defaultBreak);
  };

  const calculateEndTime = () => {
    if (!preferences || !activeSession) return null;

    const { totalMinutes, lunchBreakMinutes } = calculateWorkTime();
    const plannedMinutes = getPlannedFutureMinutes();
    let requiredMinutes = preferences.required_work_hours * 60;

    if (preferences.use_overtime_compensation && preferences.weekly_overtime_minutes > 0) {
      requiredMinutes -= preferences.weekly_overtime_minutes;
    }

    const detectedBreak = detectLunchBreak();
    let remainingLunchBreak = 0;

    if (detectedBreak === 0 && lunchBreakMinutes === 0) {
      remainingLunchBreak = getEffectiveLunchBreakMinutes();
    }

    const remainingMinutes = requiredMinutes - totalMinutes - plannedMinutes + remainingLunchBreak;
    const endTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000);

    if (preferences.minimum_end_time && preferences.use_minimum_end_time !== false) {
      const [minEndHours, minEndMinutes] = preferences.minimum_end_time.split(':');
      const minEnd = new Date();
      minEnd.setHours(parseInt(minEndHours), parseInt(minEndMinutes), 0, 0);
      if (endTime < minEnd) return minEnd;
    }

    return endTime;
  };

  const getOvertimeMinutes = () => {
    if (!preferences || !activeSession) return null;

    const { totalMinutes } = calculateWorkTime();
    const requiredMinutes = preferences.required_work_hours * 60;

    if (totalMinutes <= requiredMinutes) return null;

    return totalMinutes - requiredMinutes;
  };

  const isOnLunchBreak = () => {
    if (todaySessions.length === 0 || activeSession) return false;

    const { totalMinutes } = calculateWorkTime();
    const plannedMinutes = getPlannedFutureMinutes();
    const requiredMinutes = preferences ? preferences.required_work_hours * 60 : 480;
    const threshold = preferences?.end_of_day_threshold || 0.8;

    if (totalMinutes + plannedMinutes >= requiredMinutes * threshold) {
      return false;
    }

    const lastSession = todaySessions[todaySessions.length - 1];
    return lastSession.clock_out !== null;
  };

  const getLunchBreakTime = () => {
    if (!isOnLunchBreak() || !preferences) return null;

    const lastSession = todaySessions[todaySessions.length - 1];
    const breakStart = new Date(lastSession.clock_out!);
    const elapsedBreakMinutes = (currentTime.getTime() - breakStart.getTime()) / (1000 * 60);
    const effectiveBreakMinutes = getEffectiveLunchBreakMinutes();
    const remainingBreakMinutes = effectiveBreakMinutes - elapsedBreakMinutes;

    return {
      remaining: remainingBreakMinutes,
      overtime: elapsedBreakMinutes - effectiveBreakMinutes,
      isOvertime: remainingBreakMinutes < 0
    };
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins.toString().padStart(2, '0')}min`;
  };

  const { totalMinutes, lunchBreakMinutes } = calculateWorkTime();
  const endTime = calculateEndTime();
  const workProgress = preferences
    ? (totalMinutes / (preferences.required_work_hours * 60)) * 100
    : 0;
  const lunchBreakTime = getLunchBreakTime();
  const overtimeMinutes = getOvertimeMinutes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 sm:p-3 rounded-2xl shadow-lg shrink-0">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent">
                TimeTrack
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm truncate max-w-[140px] sm:max-w-none">
                Bonjour, {user?.username}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowEditHistory(true)}
              className="p-2.5 sm:p-3 bg-white/90 dark:bg-slate-800 backdrop-blur-lg rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl sm:hover:scale-105 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <History className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 sm:p-3 bg-white/90 dark:bg-slate-800 backdrop-blur-lg rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl sm:hover:scale-105 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <SettingsIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              onClick={logout}
              className="p-2.5 sm:p-3 bg-white/90 dark:bg-slate-800 backdrop-blur-lg rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl sm:hover:scale-105 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-lg rounded-3xl shadow-2xl p-5 sm:p-8 mb-6">
          <div className="text-center mb-6 sm:mb-8">
            {lunchBreakTime ? (
              <>
                <div className="text-base sm:text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  {lunchBreakTime.isOvertime ? 'Dépassement de pause' : 'Pause déjeuner en cours'}
                </div>
                <div className={`text-5xl sm:text-7xl font-bold mb-2 bg-gradient-to-r ${
                  lunchBreakTime.isOvertime
                    ? 'from-red-600 via-orange-600 to-red-600 dark:from-red-400 dark:via-orange-400 dark:to-red-400'
                    : 'from-orange-600 via-amber-600 to-orange-600 dark:from-orange-400 dark:via-amber-400 dark:to-orange-400'
                } bg-clip-text text-transparent`}>
                  {lunchBreakTime.isOvertime ? '+' : ''}{formatDuration(Math.abs(lunchBreakTime.isOvertime ? lunchBreakTime.overtime : lunchBreakTime.remaining))}
                </div>
              </>
            ) : overtimeMinutes && activeSession ? (
              <>
                <div className="text-base sm:text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  Heures supplémentaires
                </div>
                <div className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 dark:from-purple-400 dark:via-pink-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
                  +{formatDuration(overtimeMinutes)}
                </div>
              </>
            ) : endTime && activeSession ? (
              <>
                <div className="text-base sm:text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  Heure de sortie estimée
                </div>
                <div className="text-6xl sm:text-7xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-400 dark:via-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mb-2">
                  {formatTime(endTime).slice(0, 5)}
                </div>
              </>
            ) : (
              <>
                <div className="text-base sm:text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  Temps restant
                </div>
                <div className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-gray-600 to-gray-400 dark:from-gray-400 dark:to-gray-500 bg-clip-text text-transparent mb-2">
                  --:--
                </div>
              </>
            )}
            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300 capitalize">
              {currentTime.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          <div className="flex gap-4 mb-6 sm:mb-8 justify-center">
            {!activeSession ? (
              <button
                onClick={clockIn}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl sm:hover:scale-105 active:scale-95 transition-all touch-manipulation"
              >
                <Play className="w-6 h-6" />
                Débuter la journée
              </button>
            ) : (
              <button
                onClick={clockOut}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl sm:hover:scale-105 active:scale-95 transition-all touch-manipulation"
              >
                <Pause className="w-6 h-6" />
                Sortir / Pause
              </button>
            )}
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-r from-blue-500/15 to-purple-500/15 dark:from-blue-500/30 dark:to-purple-500/30 rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 sm:gap-3 md:gap-6">
                <div className="flex flex-col text-center md:text-left">
                  <span className="text-gray-700 dark:text-gray-100 font-medium">
                    Temps travaillé aujourd'hui
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Objectif: {formatDuration((preferences?.required_work_hours || 8) * 60)}
                  </span>
                </div>
                <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent text-center md:text-right">
                  {formatDuration(totalMinutes)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden mt-4 relative">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 transition-all duration-500 rounded-full relative overflow-hidden"
                  style={{ width: `${Math.min(workProgress, 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {lunchBreakMinutes > 0 && (
              <div className="bg-gradient-to-r from-orange-500/15 to-pink-500/15 dark:from-orange-500/30 dark:to-pink-500/30 rounded-2xl p-4 sm:p-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-100 font-medium">
                    Pause déjeuner
                  </span>
                  <span className="text-xl font-bold text-orange-600 dark:text-orange-300">
                    {formatDuration(lunchBreakMinutes)}
                  </span>
                </div>
              </div>
            )}

            <div className={`grid gap-4 sm:gap-6 ${preferences?.minimum_end_time ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              <div className="bg-gradient-to-r from-blue-500/15 to-cyan-500/15 dark:from-blue-500/30 dark:to-cyan-500/30 rounded-2xl p-4 sm:p-6">
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-100 font-medium mb-3">
                  <Timer className={`w-5 h-5 transition-colors duration-300 ${
                    preferences?.use_overtime_compensation
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                  }`} />
                  <span>
                    Heures supplémentaires
                    <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">
                      ({
                        { week: 'semaine', month: 'mois', quarter: 'trimestre', semester: 'semestre', year: 'année', lifetime: 'à vie' }[preferences?.overtime_period || 'week']
                      })
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={overtimeInput}
                    onChange={(e) => setOvertimeInput(e.target.value)}
                    onBlur={handleOvertimeSave}
                    placeholder="Ex: 1 h 30 min ou 45 min"
                    className="flex-1 min-w-0 px-3 sm:px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-base"
                  />
                  <button
                    onClick={calculateWeeklyOvertime}
                    disabled={isDetecting}
                    className="p-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-xl shadow-lg hover:shadow-xl sm:hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <Calculator className={`w-5 h-5 transition-transform duration-500 ${isDetecting ? 'animate-pulse scale-110' : ''}`} />
                  </button>
                  <button
                    onClick={toggleOvertimeCompensation}
                    className={`px-3 sm:px-4 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl sm:hover:scale-105 active:scale-95 transition-all touch-manipulation shrink-0 min-h-[44px] ${
                      preferences?.use_overtime_compensation
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white'
                    }`}
                  >
                    {preferences?.use_overtime_compensation ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {preferences?.minimum_end_time && (
                <div className={`bg-gradient-to-r rounded-2xl p-4 sm:p-6 transition-all ${
                  preferences.use_minimum_end_time !== false
                    ? 'from-teal-500/15 to-cyan-500/15 dark:from-teal-500/30 dark:to-cyan-500/30'
                    : 'from-gray-100/80 to-gray-200/80 dark:from-slate-800/80 dark:to-slate-700/80'
                }`}>
                  <label className="flex items-center gap-2 text-gray-700 dark:text-gray-100 font-medium mb-3">
                    <Clock className={`w-5 h-5 transition-colors duration-300 ${
                      preferences.use_minimum_end_time !== false
                        ? 'text-teal-600 dark:text-teal-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`} />
                    Heure de départ min.
                  </label>
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${
                      preferences.use_minimum_end_time !== false
                        ? 'text-teal-700 dark:text-teal-300'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {preferences.minimum_end_time}
                    </span>
                    <button
                      onClick={toggleMinimumEndTime}
                      className={`px-3 sm:px-4 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl sm:hover:scale-105 active:scale-95 transition-all touch-manipulation min-h-[44px] ${
                        preferences.use_minimum_end_time !== false
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white'
                      }`}
                    >
                      {preferences.use_minimum_end_time !== false ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {todaySessions.length > 0 && (
          <div className="bg-white/90 dark:bg-slate-900 backdrop-blur-lg rounded-3xl shadow-2xl p-4 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6">
              Historique d'aujourd'hui
            </h2>
            <div className="space-y-3">
              {todaySessions.map((session, index) => {
                const isPlannedSession = !!(session.clock_out && new Date(session.clock_in) > currentTime);
                return (
                <div
                  key={session.id}
                  className={`p-4 rounded-xl border-2 ${
                    isPlannedSession
                      ? 'border-amber-200 dark:border-amber-800 border-dashed bg-amber-50/60 dark:bg-amber-900/10'
                      : 'border-transparent bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700'
                  }`}
                >
                  {editingSession === session.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <span className="text-gray-700 dark:text-gray-200 font-medium">
                          Modifier la session
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <input
                          type="time"
                          value={editClockIn}
                          onChange={(e) => setEditClockIn(e.target.value)}
                          className="flex-1 px-3 py-2.5 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 transition-all outline-none text-base"
                        />
                        <span className="text-gray-600 dark:text-gray-300 text-center sm:text-left">→</span>
                        <input
                          type="time"
                          value={editClockOut}
                          onChange={(e) => setEditClockOut(e.target.value)}
                          className="flex-1 px-3 py-2.5 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 transition-all outline-none text-base"
                        />
                      </div>
                      {editClockIn && editClockOut && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Durée: {(() => {
                            const [inHours, inMinutes] = editClockIn.split(':');
                            const [outHours, outMinutes] = editClockOut.split(':');
                            const inTime = new Date();
                            inTime.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);
                            const outTime = new Date();
                            outTime.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);
                            const durationMinutes = (outTime.getTime() - inTime.getTime()) / (1000 * 60);
                            return formatDuration(durationMinutes);
                          })()}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditSession(session.id)}
                          className="flex-1 flex items-center justify-center gap-2 p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">Valider</span>
                        </button>
                        <button
                          onClick={() => setEditingSession(null)}
                          className="flex-1 flex items-center justify-center gap-2 p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                          <span className="text-sm font-medium">Annuler</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {new Date(session.clock_in).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {session.clock_out && (
                              <>
                                {' → '}
                                {new Date(session.clock_out).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </>
                            )}
                            {!session.clock_out && (
                              <span className="ml-2 text-green-600 dark:text-green-300 text-sm">
                                En cours
                              </span>
                            )}
                            {isPlannedSession && (
                              <span className="ml-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                                Planifié
                              </span>
                            )}
                          </div>
                          {session.clock_out && (
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              Durée: {formatDuration(
                                (new Date(session.clock_out).getTime() -
                                  new Date(session.clock_in).getTime()) /
                                  (1000 * 60)
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => startEditSession(session)}
                          className="flex-1 sm:flex-none sm:w-10 sm:h-10 p-2.5 sm:p-0 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all touch-manipulation min-h-[44px] sm:min-h-0 flex items-center justify-center"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="flex-1 sm:flex-none sm:w-10 sm:h-10 p-2.5 sm:p-0 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all touch-manipulation min-h-[44px] sm:min-h-0 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        )}

        {allSessions.length > 0 && preferences && (
          <div className="mt-8">
            <Statistics
              sessions={allSessions}
              requiredWorkHours={preferences.required_work_hours}
            />
          </div>
        )}
      </div>

      {showSettings && (
        <Settings
          onClose={() => {
            setShowSettings(false);
            loadPreferences();
          }}
          initialPreferences={preferences}
        />
      )}

      {showEditHistory && (
        <EditHistory
          onClose={() => setShowEditHistory(false)}
          onUpdate={() => {
            loadTodaySessions();
            loadAllSessions();
          }}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        variant="danger"
      />

      {showChangelog && (
        <ChangelogModal onClose={dismissChangelog} />
      )}

      <footer className="text-center py-6 mt-2 flex items-center justify-center gap-3">
        <button
          onClick={() => setShowChangelog(true)}
          className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
        >
          TimeTrack v{APP_VERSION}
        </button>
        <a
          href="https://github.com/PinkFloyd1213/TimeTrack"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          aria-label="GitHub"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </footer>
    </div>
  );
}
