import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, WorkSession } from '../lib/supabase';
import { X, Calendar, Save, Clock, Plus } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { SessionRow } from './SessionRow';
import { HistoryFilters } from './HistoryFilters';
import { NewEntryModal } from './NewEntryModal';

interface EditHistoryProps {
  onClose: () => void;
  onUpdate: () => void;
  initialSessions?: WorkSession[];
}

type Period = 'week' | '7days' | '14days' | '30days' | 'custom';

interface EditedSession {
  id: string;
  clockIn: string;
  clockOut: string;
}

interface NewEntryForm {
  date: string;
  clockIn: string;
  clockOut: string;
}

function getDateRangeBounds(period: Period, startDate: string, endDate: string): { from: string; to: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === 'custom') {
    if (!startDate && !endDate) return null;
    return {
      from: startDate || '2000-01-01',
      to: endDate || new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  }

  let start = new Date(today);
  if (period === 'week') {
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(today.getDate() + diff);
  } else if (period === '7days') {
    start.setDate(today.getDate() - 7);
  } else if (period === '14days') {
    start.setDate(today.getDate() - 14);
  } else if (period === '30days') {
    start.setDate(today.getDate() - 30);
  }

  return {
    from: start.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

function calcNewEntryDuration(entry: NewEntryForm): string | null {
  if (!entry.clockIn || !entry.clockOut) return null;
  const [inH, inM] = entry.clockIn.split(':');
  const [outH, outM] = entry.clockOut.split(':');
  const inTime = new Date();
  inTime.setHours(parseInt(inH), parseInt(inM), 0, 0);
  const outTime = new Date();
  outTime.setHours(parseInt(outH), parseInt(outM), 0, 0);
  const minutes = (outTime.getTime() - inTime.getTime()) / (1000 * 60);
  if (minutes <= 0) return null;
  return formatDuration(minutes);
}

export function EditHistory({ onClose, onUpdate, initialSessions }: EditHistoryProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkSession[]>(initialSessions || []);
  const [period, setPeriod] = useState<Period>('week');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editedSessions, setEditedSessions] = useState<Map<string, EditedSession>>(new Map());
  const [deletedSessions, setDeletedSessions] = useState<Set<string>>(new Set());
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntry, setNewEntry] = useState<NewEntryForm>({ date: '', clockIn: '', clockOut: '' });
  const [newEntries, setNewEntries] = useState<NewEntryForm[]>([]);
  const [saveError, setSaveError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const hasChanges = editedSessions.size > 0 || deletedSessions.size > 0 || newEntries.length > 0;
  const todayStr = new Date().toISOString().split('T')[0];

  const loadSessions = async (currentPeriod: Period, currentStartDate: string, currentEndDate: string) => {
    if (!user) return;

    const bounds = getDateRangeBounds(currentPeriod, currentStartDate, currentEndDate);

    let query = supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false });

    if (bounds) {
      query = query.gte('date', bounds.from).lte('date', bounds.to);
    }

    const { data } = await query;
    if (data) setSessions(data);
  };

  useEffect(() => {
    if (!initialSessions && user) {
      loadSessions(period, startDate, endDate);
    }
  }, [user, initialSessions, period, startDate, endDate]);

  const filteredSessions = searchTerm
    ? sessions.filter((s) => {
        const searchLower = searchTerm.toLowerCase();
        const dateStr = new Date(s.date).toLocaleDateString('fr-FR');
        const clockInStr = new Date(s.clock_in).toLocaleTimeString('fr-FR');
        const clockOutStr = s.clock_out ? new Date(s.clock_out).toLocaleTimeString('fr-FR') : '';
        return dateStr.includes(searchLower) || clockInStr.includes(searchLower) || clockOutStr.includes(searchLower);
      })
    : sessions;

  const handleEdit = (session: WorkSession) => {
    const clockInTime = new Date(session.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const clockOutTime = session.clock_out
      ? new Date(session.clock_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const newEdited = new Map(editedSessions);
    newEdited.set(session.id, { id: session.id, clockIn: clockInTime, clockOut: clockOutTime });
    setEditedSessions(newEdited);
  };

  const handleCancelEdit = (sessionId: string) => {
    const newEdited = new Map(editedSessions);
    newEdited.delete(sessionId);
    setEditedSessions(newEdited);
  };

  const handleClockInChange = (sessionId: string, value: string) => {
    const newEdited = new Map(editedSessions);
    const current = newEdited.get(sessionId);
    if (current) {
      newEdited.set(sessionId, { ...current, clockIn: value });
      setEditedSessions(newEdited);
    }
  };

  const handleClockOutChange = (sessionId: string, value: string) => {
    const newEdited = new Map(editedSessions);
    const current = newEdited.get(sessionId);
    if (current) {
      newEdited.set(sessionId, { ...current, clockOut: value });
      setEditedSessions(newEdited);
    }
  };

  const handleDelete = (sessionId: string) => {
    const newDeleted = new Set(deletedSessions);
    if (newDeleted.has(sessionId)) {
      newDeleted.delete(sessionId);
    } else {
      newDeleted.add(sessionId);
    }
    setDeletedSessions(newDeleted);
  };

  const handleAddNewEntry = () => {
    if (!newEntry.date || !newEntry.clockIn || !newEntry.clockOut) return;
    setNewEntries(prev => [...prev, newEntry]);
    setNewEntry({ date: '', clockIn: '', clockOut: '' });
    setShowNewEntryModal(false);
  };

  const handleRemoveNewEntry = (index: number) => {
    setNewEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!hasChanges) { onClose(); return; }

    const parts: string[] = [];
    if (editedSessions.size > 0) parts.push(`modifier ${editedSessions.size} session(s)`);
    if (deletedSessions.size > 0) parts.push(`supprimer ${deletedSessions.size} session(s)`);
    if (newEntries.length > 0) parts.push(`ajouter ${newEntries.length} nouvelle(s) entrée(s)`);

    setConfirmModal({
      isOpen: true,
      title: newEntries.length > 0 && editedSessions.size === 0 && deletedSessions.size === 0
        ? "Confirmer l'ajout"
        : 'Confirmer les modifications',
      message: `Vous êtes sur le point de ${parts.join(', ')}. Confirmer ?`,
      onConfirm: async () => {
        setSaveError('');
        try {
          if (deletedSessions.size > 0) {
            const { error } = await supabase
              .from('work_sessions')
              .delete()
              .in('id', [...deletedSessions]);
            if (error) throw error;
          }

          const updates: { id: string; clock_in: string; clock_out?: string }[] = [];
          for (const [sessionId, edited] of editedSessions.entries()) {
            if (deletedSessions.has(sessionId)) continue;
            const session = sessions.find(s => s.id === sessionId);
            if (!session) continue;
            const [inHours, inMinutes] = edited.clockIn.split(':');
            const clockInDate = new Date(session.clock_in);
            clockInDate.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);
            const update: { id: string; clock_in: string; clock_out?: string } = {
              id: sessionId,
              clock_in: clockInDate.toISOString(),
            };
            if (edited.clockOut) {
              const [outHours, outMinutes] = edited.clockOut.split(':');
              const clockOutDate = new Date(session.clock_in);
              clockOutDate.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);
              update.clock_out = clockOutDate.toISOString();
            }
            updates.push(update);
          }

          if (updates.length > 0) {
            const { error } = await supabase
              .from('work_sessions')
              .upsert(updates, { onConflict: 'id' });
            if (error) throw error;
          }

          if (newEntries.length > 0) {
            const inserts = newEntries.map(entry => {
              const [inHours, inMinutes] = entry.clockIn.split(':');
              const [outHours, outMinutes] = entry.clockOut.split(':');
              const clockInDate = new Date(`${entry.date}T00:00:00`);
              clockInDate.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);
              const clockOutDate = new Date(`${entry.date}T00:00:00`);
              clockOutDate.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);
              return {
                user_id: user!.id,
                date: entry.date,
                clock_in: clockInDate.toISOString(),
                clock_out: clockOutDate.toISOString(),
              };
            });
            const { error } = await supabase.from('work_sessions').insert(inserts);
            if (error) throw error;
          }

          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          onUpdate();
          onClose();
        } catch (err) {
          console.error('Save error:', err);
          setSaveError("Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.");
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const groupedSessions = filteredSessions.reduce((acc, session) => {
    if (!acc[session.date]) acc[session.date] = [];
    acc[session.date].push(session);
    return acc;
  }, {} as Record<string, WorkSession[]>);

  Object.keys(groupedSessions).forEach(date => {
    groupedSessions[date].sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
  });

  const sortedDates = Object.keys(groupedSessions).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-5xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex justify-between items-start sm:items-center mb-4 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2 shrink-0">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              <span className="hidden sm:inline">Modifier l'historique</span>
              <span className="sm:hidden">Historique</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewEntry({ date: '', clockIn: '', clockOut: '' });
                  setShowNewEntryModal(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl sm:hover:scale-105 active:scale-95 transition-all text-sm touch-manipulation min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Ajouter une entrée</span>
                <span className="sm:hidden">Ajouter</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          <HistoryFilters
            period={period}
            onPeriodChange={setPeriod}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onCloseCalendar={() => {}}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {saveError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {saveError}
            </div>
          )}

          {newEntries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3">
                Nouvelles entrées à ajouter
              </h3>
              <div className="space-y-2">
                {newEntries.map((entry, index) => {
                  const dur = calcNewEntryDuration(entry);
                  return (
                    <div key={index} className="p-4 rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                          {entry.clockIn} → {entry.clockOut}
                          {dur && <span className="ml-2 text-green-600 dark:text-green-400">({dur})</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveNewEntry(index)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(groupedSessions).length === 0 && newEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Aucune session trouvée pour cette période
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => {
                const daySessions = groupedSessions[date];
                const planned = date >= todayStr;
                const isToday = date === todayStr;
                return (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-5 h-5 ${planned ? 'text-amber-500' : 'text-blue-600'}`} />
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                        {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </h3>
                      {isToday && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          Aujourd'hui
                        </span>
                      )}
                      {!isToday && planned && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          Planifié
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {daySessions.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          isEditing={editedSessions.has(session.id)}
                          isDeleted={deletedSessions.has(session.id)}
                          edited={editedSessions.get(session.id)}
                          isPlanned={session.date >= todayStr}
                          onEdit={handleEdit}
                          onCancelEdit={handleCancelEdit}
                          onClockInChange={handleClockInChange}
                          onClockOutChange={handleClockOutChange}
                          onDelete={handleDelete}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-semibold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-all touch-manipulation min-h-[48px]"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[48px] ${
                hasChanges
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 dark:bg-slate-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-5 h-5" />
              Enregistrer {hasChanges && `(${editedSessions.size + deletedSessions.size + newEntries.length})`}
            </button>
          </div>
        </div>
      </div>

      {showNewEntryModal && (
        <NewEntryModal
          newEntry={newEntry}
          onEntryChange={setNewEntry}
          onAdd={handleAddNewEntry}
          onClose={() => setShowNewEntryModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        variant="warning"
      />
    </div>
  );
}
