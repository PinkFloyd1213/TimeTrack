import { useState, useEffect } from 'react';
import { WorkSession } from '../lib/supabase';
import { BarChart3, Clock, Coffee, LogIn, LogOut as LogOutIcon, TrendingUp, Calendar } from 'lucide-react';

interface StatisticsProps {
  sessions: WorkSession[];
  requiredWorkHours: number;
}

type Period = 'week' | '7days' | '14days' | '30days';

interface Stats {
  avgArrivalTime: string;
  avgDepartureTime: string;
  avgBreakDuration: number;
  avgWorkDuration: number;
  totalWorkDuration: number;
  daysWorked: number;
  earliestArrival: string;
  latestDeparture: string;
  longestDay: number;
  shortestDay: number;
  dailyStats: Array<{
    date: string;
    arrivalTime: string;
    departureTime: string;
    workDuration: number;
    breakDuration: number;
  }>;
}

export function Statistics({ sessions, requiredWorkHours }: StatisticsProps) {
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    calculateStats();
  }, [sessions, period]);

  const getFilteredSessions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date();

    if (period === 'week') {
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate.setDate(today.getDate() + diff);
    } else if (period === '7days') {
      startDate.setDate(today.getDate() - 6);
    } else if (period === '14days') {
      startDate.setDate(today.getDate() - 13);
    } else if (period === '30days') {
      startDate.setDate(today.getDate() - 29);
    }

    startDate.setHours(0, 0, 0, 0);

    return sessions.filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate >= startDate && sessionDate < today && s.clock_out;
    });
  };

  const calculateStats = () => {
    const filtered = getFilteredSessions();
    if (filtered.length === 0) {
      setStats(null);
      return;
    }

    const sessionsByDate = filtered.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, WorkSession[]>);

    const dailyStats = Object.entries(sessionsByDate).map(([date, sessions]) => {
      const sortedSessions = sessions.sort((a, b) =>
        new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
      );

      const firstSession = sortedSessions[0];
      const lastSession = sortedSessions[sortedSessions.length - 1];

      const clockIn = new Date(firstSession.clock_in);
      const clockOut = lastSession.clock_out ? new Date(lastSession.clock_out) : new Date();

      let totalWorkMinutes = 0;
      let totalBreakMinutes = 0;

      sortedSessions.forEach(session => {
        const start = new Date(session.clock_in);
        const end = session.clock_out ? new Date(session.clock_out) : new Date();
        const sessionMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        totalWorkMinutes += sessionMinutes;
      });

      for (let i = 0; i < sortedSessions.length - 1; i++) {
        const currentEnd = sortedSessions[i].clock_out;
        const nextStart = sortedSessions[i + 1].clock_in;

        if (currentEnd && nextStart) {
          const breakMinutes =
            (new Date(nextStart).getTime() - new Date(currentEnd).getTime()) / (1000 * 60);
          if (breakMinutes > totalBreakMinutes) {
            totalBreakMinutes = breakMinutes;
          }
        }
      }

      return {
        date,
        arrivalTime: clockIn.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        departureTime: clockOut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        workDuration: totalWorkMinutes,
        breakDuration: totalBreakMinutes,
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalMinutes = dailyStats.reduce((sum, s) => sum + s.workDuration, 0);
    const totalBreakMinutes = dailyStats.reduce((sum, s) => sum + s.breakDuration, 0);

    const arrivalTimes = dailyStats.map(s => {
      const [h, m] = s.arrivalTime.split(':').map(Number);
      return h * 60 + m;
    });

    const departureTimes = dailyStats.map(s => {
      const [h, m] = s.departureTime.split(':').map(Number);
      return h * 60 + m;
    });

    const avgArrivalMinutes = arrivalTimes.reduce((a, b) => a + b, 0) / arrivalTimes.length;
    const avgDepartureMinutes = departureTimes.reduce((a, b) => a + b, 0) / departureTimes.length;

    const formatMinutesToTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    setStats({
      avgArrivalTime: formatMinutesToTime(avgArrivalMinutes),
      avgDepartureTime: formatMinutesToTime(avgDepartureMinutes),
      avgBreakDuration: totalBreakMinutes / dailyStats.length,
      avgWorkDuration: totalMinutes / dailyStats.length,
      totalWorkDuration: totalMinutes,
      daysWorked: dailyStats.length,
      earliestArrival: formatMinutesToTime(Math.min(...arrivalTimes)),
      latestDeparture: formatMinutesToTime(Math.max(...departureTimes)),
      longestDay: Math.max(...dailyStats.map(s => s.workDuration)),
      shortestDay: Math.min(...dailyStats.map(s => s.workDuration)),
      dailyStats,
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'week': return 'Semaine actuelle';
      case '7days': return '7 derniers jours';
      case '14days': return '14 derniers jours';
      case '30days': return '30 derniers jours';
    }
  };

  if (!stats) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
            Statistiques
          </h2>
          <div className="flex gap-1.5 sm:gap-2">
            {(['week', '7days', '14days', '30days'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl font-medium transition-all touch-manipulation min-h-[40px] text-sm sm:text-base ${
                  period === p
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                }`}
              >
                {p === 'week' ? 'Sem.' : p === '7days' ? '7j' : p === '14days' ? '14j' : '30j'}
              </button>
            ))}
          </div>
        </div>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Aucune donnée disponible pour cette période
        </div>
      </div>
    );
  }

  const expectedDailyMinutes = requiredWorkHours * 60;

  const minDuration = Math.min(...stats.dailyStats.map(s => s.workDuration));
  const avgDuration = stats.avgWorkDuration;

  const rangeMin = minDuration - 20;
  const rangeMax = rangeMin + ((avgDuration - rangeMin) / 0.8);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
          <span>Statistiques <span className="hidden sm:inline">- {getPeriodLabel()}</span></span>
        </h2>
        <div className="flex gap-1.5 sm:gap-2">
          {(['week', '7days', '14days', '30days'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl font-medium transition-all sm:hover:scale-105 touch-manipulation min-h-[40px] text-sm sm:text-base ${
                period === p
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
              }`}
            >
              {p === 'week' ? 'Sem.' : p === '7days' ? '7j' : p === '14days' ? '14j' : '30j'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <LogIn className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium opacity-90">Arrivée moy.</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold">{stats.avgArrivalTime}</div>
          <div className="text-xs opacity-75 mt-1">Plus tôt: {stats.earliestArrival}</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <LogOutIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium opacity-90">Départ moy.</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold">{stats.avgDepartureTime}</div>
          <div className="text-xs opacity-75 mt-1">Plus tard: {stats.latestDeparture}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium opacity-90">Temps moy.</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold">{formatDuration(stats.avgWorkDuration)}</div>
          <div className="text-xs opacity-75 mt-1">Total: {formatDuration(stats.totalWorkDuration)}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-sm font-medium opacity-90">Pause moy.</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold">{formatDuration(stats.avgBreakDuration)}</div>
          <div className="text-xs opacity-75 mt-1">{stats.daysWorked} jours travaillés</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Temps de travail journalier
          </h3>
          <div className="space-y-3">
            {stats.dailyStats.slice(0, 10).map((day, index) => {
              const normalizedValue = Math.max(0, Math.min(100,
                ((day.workDuration - rangeMin) / (rangeMax - rangeMin)) * 100
              ));
              const isAboveTarget = day.workDuration >= expectedDailyMinutes;

              return (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {formatDuration(day.workDuration)}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAboveTarget
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-600'
                      }`}
                      style={{ width: `${normalizedValue}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-600" />
            Répartition horaire
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Jour le plus long</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatDuration(stats.longestDay)}
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Jour le plus court</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {formatDuration(stats.shortestDay)}
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full"
                  style={{
                    width: `${Math.max(20, ((stats.shortestDay - rangeMin) / (rangeMax - rangeMin)) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Moyenne journalière</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {formatDuration(stats.avgWorkDuration)}
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full"
                  style={{
                    width: `${((stats.avgWorkDuration - rangeMin) / (rangeMax - rangeMin)) * 100}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Horaires d'arrivée et départ
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.avgArrivalTime}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Arrivée moy.
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30 rounded-xl">
                  <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                    {stats.avgDepartureTime}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Départ moy.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
