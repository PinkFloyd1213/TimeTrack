import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, UserPreferences } from '../lib/supabase';
import { exportUserData, downloadJSON, downloadCSV, importUserData, parseImportFile } from '../lib/dataTransfer';
import { X, Moon, Sun, User, Lock, Clock, Coffee, Bell, Trash2, ArrowRightFromLine, Download, Upload, FileJson, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface SettingsProps {
  onClose: () => void;
  initialPreferences: UserPreferences | null;
}

export function Settings({ onClose, initialPreferences }: SettingsProps) {
  const { user, logout } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(initialPreferences);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workHours, setWorkHours] = useState(initialPreferences?.required_work_hours.toString() || '8');
  const [lunchBreak, setLunchBreak] = useState(initialPreferences?.required_lunch_break_minutes.toString() || '30');
  const [endOfDayThreshold, setEndOfDayThreshold] = useState(initialPreferences?.end_of_day_threshold ? (initialPreferences.end_of_day_threshold * 100).toString() : '80');
  const [minimumEndTime, setMinimumEndTime] = useState(initialPreferences?.minimum_end_time || '');
  const [overtimePeriod, setOvertimePeriod] = useState<'week' | 'month' | 'quarter' | 'semester' | 'year' | 'lifetime'>(initialPreferences?.overtime_period || 'week');
  const [darkMode, setDarkMode] = useState(initialPreferences?.dark_mode || false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialPreferences?.notifications_enabled || false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const showSaved = (section: string) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; sessionsImported: number; sessionsSkipped: number; preferencesRestored: boolean; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialPreferences) {
      loadPreferences();
    }
  }, [initialPreferences]);

  const loadPreferences = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences(data);
      setDarkMode(data.dark_mode);
      setNotificationsEnabled(data.notifications_enabled || false);
      setWorkHours(data.required_work_hours.toString());
      setLunchBreak(data.required_lunch_break_minutes.toString());
      setEndOfDayThreshold(data.end_of_day_threshold ? (data.end_of_day_threshold * 100).toString() : '80');
      setMinimumEndTime(data.minimum_end_time || '');
      setOvertimePeriod(data.overtime_period || 'week');
    }
  };

  const updateUsername = async () => {
    if (!user || !newUsername.trim()) {
      setError("Veuillez entrer un nouveau nom d'utilisateur");
      return;
    }

    if (newUsername.trim().length < 2) {
      setError("Le nom d'utilisateur doit contenir au moins 2 caractères");
      return;
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', newUsername.trim())
      .maybeSingle();

    if (existing && existing.id !== user.id) {
      setError("Ce nom d'utilisateur est déjà pris");
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ username: newUsername.trim() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Username update error:', updateError);
      setError("Erreur lors de la mise à jour du nom d'utilisateur");
      return;
    }

    showSaved('username');
    setNewUsername('');
  };

  const updatePassword = async () => {
    if (!user || !newPassword) {
      setError('Veuillez entrer un nouveau mot de passe');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });

    if (authError) {
      setError('Erreur lors de la mise à jour du mot de passe');
      return;
    }

    showSaved('password');
    setNewPassword('');
    setConfirmPassword('');
  };

  const updateWorkPreferences = async () => {
    if (!user || !preferences) return;

    const hours = parseFloat(workHours);
    const minutes = parseInt(lunchBreak);
    const threshold = parseFloat(endOfDayThreshold) / 100;

    if (isNaN(hours) || hours <= 0 || hours > 24) {
      setError('Veuillez entrer un nombre d\'heures valide (0-24)');
      return;
    }

    if (isNaN(minutes) || minutes < 0 || minutes > 240) {
      setError('Veuillez entrer un nombre de minutes valide (0-240)');
      return;
    }

    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      setError('Veuillez entrer un pourcentage valide (0-100)');
      return;
    }

    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({
        required_work_hours: hours,
        required_lunch_break_minutes: minutes,
        end_of_day_threshold: threshold,
        minimum_end_time: minimumEndTime.trim() || null,
        overtime_period: overtimePeriod,
      })
      .eq('user_id', user.id);

    if (updateError) {
      setError('Erreur lors de la mise à jour des préférences');
      return;
    }

    showSaved('work');
    await loadPreferences();
  };

  const toggleDarkMode = async () => {
    if (!user) return;

    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    await supabase
      .from('user_preferences')
      .update({ dark_mode: newDarkMode })
      .eq('user_id', user.id);
  };

  const toggleNotifications = async () => {
    if (!user) return;

    if (!notificationsEnabled) {
      if (!('Notification' in window)) {
        setError('Les notifications ne sont pas supportées par votre navigateur');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setError('Permission de notification refusée');
        return;
      }

      setNotificationsEnabled(true);
      await supabase
        .from('user_preferences')
        .update({ notifications_enabled: true })
        .eq('user_id', user.id);

      setMessage('Notifications activées avec succès !');
    } else {
      setNotificationsEnabled(false);
      await supabase
        .from('user_preferences')
        .update({ notifications_enabled: false })
        .eq('user_id', user.id);

      setMessage('Notifications désactivées');
    }
  };

  const handleExportJSON = async () => {
    if (!user) return;
    setExportLoading(true);
    try {
      const data = await exportUserData(user.id);
      const date = new Date().toISOString().split('T')[0];
      downloadJSON(data, `primetime-export-${date}.json`);
      setMessage('Export JSON téléchargé avec succès');
    } catch {
      setError("Erreur lors de l'export");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!user) return;
    setExportLoading(true);
    try {
      const data = await exportUserData(user.id);
      const date = new Date().toISOString().split('T')[0];
      downloadCSV(data.work_sessions, `primetime-sessions-${date}.csv`);
      setMessage('Export CSV téléchargé avec succès');
    } catch {
      setError("Erreur lors de l'export");
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImportLoading(true);
    setImportResult(null);
    setError('');
    setMessage('');

    try {
      const data = await parseImportFile(file);
      const result = await importUserData(user.id, data);
      setImportResult(result);
      if (result.success) {
        setMessage('Import terminé avec succès');
        await loadPreferences();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteAccount = async () => {
    if (!user) return;

    await supabase.from('work_sessions').delete().eq('user_id', user.id);
    await supabase.from('user_preferences').delete().eq('user_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);

    setMessage('Compte supprimé avec succès');

    setTimeout(() => {
      logout();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 p-5 sm:p-6 rounded-t-3xl flex justify-between items-center z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Paramètres</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 pb-8">
          {message && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
              <div className="flex items-center gap-3">
                {darkMode ? (
                  <Moon className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                ) : (
                  <Sun className="w-6 h-6 text-orange-500" />
                )}
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  Mode sombre
                </span>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative w-16 h-8 rounded-full transition-all ${
                  darkMode
                    ? 'bg-gradient-to-r from-purple-500 to-blue-600'
                    : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                    darkMode ? 'transform translate-x-8' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
              <div className="flex items-center gap-3">
                <Bell className={`w-6 h-6 ${notificationsEnabled ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400'}`} />
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    Notifications
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Alerte 5 min avant la sortie
                  </div>
                </div>
              </div>
              <button
                onClick={toggleNotifications}
                className={`relative w-16 h-8 rounded-full transition-all ${
                  notificationsEnabled
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600'
                    : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                    notificationsEnabled ? 'transform translate-x-8' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-100">
              <User className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Nom d'utilisateur</h3>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Nouveau nom d'utilisateur"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
              />
              <button
                onClick={updateUsername}
                className={`w-full font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  savedSection === 'username'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                }`}
              >
                {savedSection === 'username' ? <><CheckCircle className="w-4 h-4" /> Sauvegardé !</> : "Mettre à jour le nom d'utilisateur"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-100">
              <Lock className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Mot de passe</h3>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
              />
              <button
                onClick={updatePassword}
                className={`w-full font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  savedSection === 'password'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                }`}
              >
                {savedSection === 'password' ? <><CheckCircle className="w-4 h-4" /> Sauvegardé !</> : 'Mettre à jour le mot de passe'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-100">
              <Clock className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Préférences de travail</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-100 mb-2">
                  Heures de travail requises par jour
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={workHours}
                  onChange={(e) => setWorkHours(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-100 mb-2">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    Pause déjeuner obligatoire (minutes)
                  </div>
                </label>
                <input
                  type="number"
                  value={lunchBreak}
                  onChange={(e) => setLunchBreak(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-100 mb-2">
                  Seuil de fin de journée (%)
                </label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={endOfDayThreshold}
                  onChange={(e) => setEndOfDayThreshold(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Pourcentage d'heures travaillées pour considérer la journée terminée
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-100 mb-2">
                  <div className="flex items-center gap-2">
                    <ArrowRightFromLine className="w-4 h-4" />
                    Heure de départ minimum (optionnel)
                  </div>
                </label>
                <input
                  type="time"
                  value={minimumEndTime}
                  onChange={(e) => setMinimumEndTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Vous ne pouvez pas partir avant cette heure. La pause déjeuner recommandée s'adapte automatiquement pour atteindre cet objectif.
                  Laisser vide pour désactiver.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-100 mb-2">
                  Période de calcul des heures supplémentaires
                </label>
                <select
                  value={overtimePeriod}
                  onChange={(e) => setOvertimePeriod(e.target.value as typeof overtimePeriod)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none text-base"
                >
                  <option value="week">Semaine</option>
                  <option value="month">Mois</option>
                  <option value="quarter">Trimestre</option>
                  <option value="semester">Semestre</option>
                  <option value="year">Année</option>
                  <option value="lifetime">À vie</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Définit sur quelle période le bouton de calcul automatique cumule les heures supplémentaires.
                </p>
              </div>
              <button
                onClick={updateWorkPreferences}
                className={`w-full font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  savedSection === 'work'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                }`}
              >
                {savedSection === 'work' ? <><CheckCircle className="w-4 h-4" /> Sauvegardé !</> : 'Mettre à jour les préférences'}
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-8 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-100">
              <Download className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Exporter mes données</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Téléchargez l'intégralité de vos données : préférences et toutes vos sessions de travail.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportJSON}
                disabled={exportLoading}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileJson className="w-4 h-4" />
                )}
                <span>JSON</span>
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exportLoading}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>CSV</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Le JSON contient toutes vos données (préférences + sessions). Le CSV contient uniquement les sessions de travail.
            </p>
          </div>

          <div className="space-y-4 pt-8 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-100">
              <Upload className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Importer des données</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Restaurez vos données depuis un fichier JSON exporté précédemment. Les sessions existantes ne seront pas dupliquées.
            </p>

            {importResult && (
              <div className={`rounded-xl p-4 space-y-2 ${importResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
                <div className={`flex items-center gap-2 font-semibold ${importResult.success ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {importResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {importResult.success ? 'Import réussi' : 'Import terminé avec des avertissements'}
                </div>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                  <li>{importResult.sessionsImported} session(s) importée(s)</li>
                  {importResult.sessionsSkipped > 0 && (
                    <li>{importResult.sessionsSkipped} session(s) ignorée(s) (déjà existantes)</li>
                  )}
                  {importResult.preferencesRestored && (
                    <li>Préférences restaurées</li>
                  )}
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="text-red-600 dark:text-red-400">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {importLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importation en cours...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Choisir un fichier JSON
                </>
              )}
            </button>
          </div>

          <div className="space-y-4 pt-8 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Zone dangereuse</h3>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Supprimer mon compte
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-center">
                  <p className="font-semibold">Êtes-vous sûr ?</p>
                  <p className="text-sm mt-1">Cette action est irréversible. Toutes vos données seront supprimées définitivement.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={deleteAccount}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    Oui, supprimer
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
