/**
 * Client API PHP.
 *
 * Expose une interface query-builder utilisée dans l'app :
 *   api.from('table').select().eq().order().maybeSingle()
 *   api.auth.getSession/signOut/updateUser
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

// ─── Mapping table → endpoint PHP ───────────────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  work_sessions:    `${API_BASE}/sessions.php`,
  users:            `${API_BASE}/users.php`,
  user_preferences: `${API_BASE}/preferences.php`,
};

// ─── Types internes ──────────────────────────────────────────────────────────

type FilterOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
interface Filter { col: string; op: FilterOp; val: unknown }
interface Order  { col: string; ascending: boolean }

type ApiResult<T = unknown> = Promise<{ data: T | null; error: unknown }>;

// ─── Query Builder ───────────────────────────────────────────────────────────

class QueryBuilder<T = unknown> {
  private _table:       string;
  private _action:      string  = 'select';
  private _columns:     string  = '*';
  private _filters:     Filter[] = [];
  private _orders:      Order[]  = [];
  private _data:        unknown  = null;
  private _returnData:  boolean  = false;
  private _single:      boolean  = false;
  private _maybeSingle: boolean  = false;

  constructor(table: string) { this._table = table; }

  // ── Opérations ───────────────────────────────────────────────────────────

  select(cols = '*') {
    if (this._action === 'insert' || this._action === 'update') {
      // insert().select() → retourner la donnée insérée
      this._returnData = true;
      this._columns    = cols;
    } else {
      this._action  = 'select';
      this._columns = cols;
    }
    return this as unknown as QueryBuilder<T>;
  }

  insert(data: unknown) {
    this._action = 'insert';
    this._data   = data;
    return this as unknown as QueryBuilder<T>;
  }

  update(data: unknown) {
    this._action = 'update';
    this._data   = data;
    return this as unknown as QueryBuilder<T>;
  }

  delete() {
    this._action = 'delete';
    return this as unknown as QueryBuilder<T>;
  }

  upsert(data: unknown, _opts?: { onConflict?: string }) {
    this._action = 'upsert';
    this._data   = data;
    return this as unknown as QueryBuilder<T>;
  }

  // ── Filtres ──────────────────────────────────────────────────────────────

  eq(col: string, val: unknown) {
    this._filters.push({ col, op: 'eq', val });
    return this as unknown as QueryBuilder<T>;
  }

  gt(col: string, val: unknown) {
    this._filters.push({ col, op: 'gt', val });
    return this as unknown as QueryBuilder<T>;
  }

  gte(col: string, val: unknown) {
    this._filters.push({ col, op: 'gte', val });
    return this as unknown as QueryBuilder<T>;
  }

  lt(col: string, val: unknown) {
    this._filters.push({ col, op: 'lt', val });
    return this as unknown as QueryBuilder<T>;
  }

  lte(col: string, val: unknown) {
    this._filters.push({ col, op: 'lte', val });
    return this as unknown as QueryBuilder<T>;
  }

  in(col: string, vals: unknown[]) {
    this._filters.push({ col, op: 'in', val: vals });
    return this as unknown as QueryBuilder<T>;
  }

  // ── Tri ──────────────────────────────────────────────────────────────────

  order(col: string, opts?: { ascending?: boolean }) {
    this._orders.push({ col, ascending: opts?.ascending ?? true });
    return this as unknown as QueryBuilder<T>;
  }

  // ── Terminaisons ─────────────────────────────────────────────────────────

  single(): ApiResult<T> {
    this._single = true;
    return this._execute<T>();
  }

  maybeSingle(): ApiResult<T> {
    this._maybeSingle = true;
    return this._execute<T>();
  }

  // Permet d'await directement le builder (ex : await supabase.from(...).update(...).eq(...))
  then<R>(
    resolve: (result: { data: T | null; error: unknown }) => R,
    reject?: (err: unknown) => R
  ): Promise<R> {
    return this._execute<T>().then(resolve, reject);
  }

  // ── Exécution ────────────────────────────────────────────────────────────

  private async _execute<U = T>(): ApiResult<U> {
    const endpoint = ENDPOINTS[this._table];
    if (!endpoint) {
      console.error(`[api-client] Table inconnue : ${this._table}`);
      return { data: null, error: `Table inconnue : ${this._table}` };
    }

    const body = {
      action:       this._action,
      columns:      this._columns,
      filters:      this._filters,
      orders:       this._orders,
      data:         this._data,
      single:       this._single,
      maybe_single: this._maybeSingle,
      return_data:  this._returnData,
    };

    try {
      const resp = await fetch(endpoint, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(body),
      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        return { data: null, error: json.error ?? `Erreur HTTP ${resp.status}` };
      }

      return { data: (json.data ?? null) as U | null, error: null };
    } catch (err) {
      console.error('[api-client] Erreur réseau :', err);
      return { data: null, error: err };
    }
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authRequest(action: string, params: Record<string, unknown> = {}) {
  const resp = await fetch(`${API_BASE}/auth.php`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify({ action, ...params }),
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, json };
}

const auth = {
  /** Récupère la session courante (depuis le cookie PHP). */
  async getSession() {
    const { json } = await authRequest('session');
    const user = json.data ?? null;
    return { data: { session: user ? { user: { id: user.id as string } } : null } };
  },

  async signOut() {
    await authRequest('logout');
  },

  async updateUser({ password }: { password: string }) {
    const { ok, json } = await authRequest('update_password', { password });
    return { error: ok ? null : (json.error ?? 'Erreur') };
  },
};

// ─── Client principal exporté ────────────────────────────────────────────────

export const supabase = {
  from<T = unknown>(table: string) {
    return new QueryBuilder<T>(table);
  },
  auth,
};

// ─── Helpers Auth directs (utilisés par AuthContext) ─────────────────────────

export async function apiLogin(username: string, password: string) {
  const { ok, json } = await authRequest('login', { username, password });
  if (!ok) return { success: false as const, error: json.error as string };
  return { success: true as const, user: json.data as { id: string; username: string; created_at: string } };
}

export async function apiRegister(username: string, password: string) {
  const { ok, json } = await authRequest('register', { username, password });
  if (!ok) return { success: false as const, error: json.error as string };
  return { success: true as const, user: json.data as { id: string; username: string; created_at: string } };
}

export async function apiLogout() {
  await authRequest('logout');
}

export async function apiGetSession(): Promise<{ id: string; username: string; created_at: string } | null> {
  const { json } = await authRequest('session');
  return json.data ?? null;
}
