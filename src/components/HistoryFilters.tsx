import { useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

type Period = 'week' | '7days' | '14days' | '30days' | 'custom';

interface HistoryFiltersProps {
  period: Period;
  onPeriodChange: (p: Period) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCloseCalendar: () => void;
}

export function HistoryFilters({
  period,
  onPeriodChange,
  searchTerm,
  onSearchChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onCloseCalendar,
}: HistoryFiltersProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handleDateClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (selectingStart) {
      onStartDateChange(dateStr);
      onEndDateChange('');
      setSelectingStart(false);
    } else {
      const start = startDate ? new Date(startDate) : null;
      if (start && date < start) {
        onStartDateChange(dateStr);
        onEndDateChange(startDate);
      } else {
        onEndDateChange(dateStr);
      }
      setSelectingStart(true);
      setShowCalendar(false);
      onCloseCalendar();
    }
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) {
      if (startDate && hoveredDate && !selectingStart) {
        const start = new Date(startDate);
        const end = hoveredDate;
        if (start > end) return date >= end && date <= start;
        return date >= start && date <= end;
      }
      return false;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    return date >= start && date <= end;
  };

  const isDateSelected = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dateStr === startDate || dateStr === endDate;
  };

  const formatDisplayDate = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return ` (${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })})`;
    }
    if (startDate) {
      const start = new Date(startDate);
      return ` (${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} - ...)`;
    }
    return '';
  };

  const handlePeriodChange = (p: Period) => {
    onPeriodChange(p);
    if (p !== 'custom') {
      onStartDateChange('');
      onEndDateChange('');
      setShowCalendar(false);
    } else {
      setSelectingStart(true);
      setShowCalendar(true);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher par date ou heure..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-base"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2 relative">
        {(['week', '7days', '14days', '30days', 'custom'] as Period[]).map((p) => (
          <div key={p} className={p === 'custom' ? 'relative' : ''}>
            <button
              onClick={() => handlePeriodChange(p)}
              className={`px-3 sm:px-4 py-2 rounded-xl font-medium transition-all sm:hover:scale-105 touch-manipulation min-h-[40px] text-sm sm:text-base ${
                period === p
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
              }`}
            >
              {p === 'week' ? 'Sem.' : p === '7days' ? '7j' : p === '14days' ? '14j' : p === '30days' ? '30j' : `Perso.${formatDisplayDate()}`}
            </button>

            {p === 'custom' && showCalendar && (
              <div
                ref={calendarRef}
                className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-slate-600 p-4 z-[70] w-72 sm:w-80 max-w-[calc(100vw-32px)]"
              >
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </div>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-600 dark:text-gray-400 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentMonth).map((day, index) => {
                    if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
                    const inRange = isDateInRange(day);
                    const isSelected = isDateSelected(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDateClick(day)}
                        onMouseEnter={() => setHoveredDate(day)}
                        onMouseLeave={() => setHoveredDate(null)}
                        className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-lg'
                            : inRange
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                            : isToday
                            ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
                  <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                    {selectingStart ? 'Sélectionnez la date de début' : 'Sélectionnez la date de fin'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
