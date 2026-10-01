(function () {
  const state = {
    configured: false,
    status: 'Local only',
    accessToken: null,
    userId: null
  };

  function config() {
    return window.SUPABASE_CONFIG || {};
  }

  function isConfigured() {
    const cfg = config();
    return Boolean(cfg.url && cfg.anonKey);
  }

  function setStatus(status) {
    state.status = status;
    document.dispatchEvent(new CustomEvent('sync-status-change', { detail: status }));
  }

  function headers(extra = {}) {
    const cfg = config();
    return {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${state.accessToken || cfg.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
      ...extra
    };
  }

  async function init() {
    state.configured = isConfigured();
    const stored = await WorkoutDB.get('settings', 'supabase-session');
    state.accessToken = stored?.value?.accessToken || null;
    state.userId = stored?.value?.userId || null;

    if (!state.configured) {
      setStatus(navigator.onLine ? 'Local only' : 'Offline');
      return state;
    }

    setStatus(state.accessToken ? 'Synced' : 'Supabase ready');
    if (state.accessToken && navigator.onLine) syncPendingChanges();
    return state;
  }

  async function sendMagicLink(email) {
    if (!isConfigured()) throw new Error('Supabase is not configured.');
    setStatus('Sending login link');
    const cfg = config();
    const response = await fetch(`${cfg.url}/auth/v1/otp`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        email,
        create_user: true,
        options: { email_redirect_to: location.href.split('#')[0] }
      })
    });
    if (!response.ok) throw new Error('Could not send the magic link.');
    setStatus('Check email');
  }

  async function captureAuthFromUrl() {
    if (!location.hash.includes('access_token=')) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get('access_token');
    if (!accessToken) return false;

    state.accessToken = accessToken;
    const userResponse = await fetch(`${config().url}/auth/v1/user`, { headers: headers() });
    if (userResponse.ok) {
      const user = await userResponse.json();
      state.userId = user.id;
    }

    await WorkoutDB.put('settings', {
      key: 'supabase-session',
      value: { accessToken: state.accessToken, userId: state.userId },
      updatedAt: new Date().toISOString()
    });

    history.replaceState(null, document.title, location.pathname + location.search);
    setStatus('Synced');
    await syncPendingChanges();
    return true;
  }

  function tableForStore(storeName) {
    return {
      workoutSessions: 'workout_sessions',
      setLogs: 'set_logs',
      weightLogs: 'weight_logs',
      settings: 'user_settings'
    }[storeName];
  }

  function remotePayload(storeName, record) {
    if (!state.userId) return null;
    if (storeName === 'workoutSessions') {
      return {
        id: record.id,
        user_id: state.userId,
        workout_day: record.workoutDay,
        started_at: record.startedAt,
        completed_at: record.completedAt,
        status: record.status,
        total_sets: record.totalSets,
        total_reps: record.totalReps,
        notes: record.notes || '',
        created_at: record.createdAt,
        updated_at: record.updatedAt
      };
    }
    if (storeName === 'setLogs') {
      return {
        id: record.id,
        user_id: state.userId,
        session_id: record.sessionId,
        workout_day: record.workoutDay,
        exercise_id: record.exerciseId,
        exercise_name: record.exerciseName,
        set_number: record.setNumber,
        reps: record.reps,
        prescribed_rest_seconds: record.prescribedRestSeconds,
        completed_at: record.completedAt,
        created_at: record.createdAt,
        updated_at: record.updatedAt
      };
    }
    if (storeName === 'weightLogs') {
      return {
        id: record.id,
        user_id: state.userId,
        weight_kg: record.weightKg,
        recorded_at: record.recordedAt,
        note: record.note || '',
        created_at: record.createdAt,
        updated_at: record.updatedAt
      };
    }
    return null;
  }

  async function markQueueItem(item, status, errorMessage = '') {
    await WorkoutDB.put('syncQueue', {
      ...item,
      status,
      attempts: Number(item.attempts || 0) + 1,
      errorMessage,
      updatedAt: new Date().toISOString()
    });
  }

  async function syncPendingChanges() {
    if (!isConfigured() || !state.accessToken) {
      setStatus(navigator.onLine ? 'Local only' : 'Offline');
      return;
    }
    if (!navigator.onLine) {
      setStatus('Offline');
      return;
    }

    const queue = await StorageAdapter.getSyncQueue();
    if (!queue.length) {
      setStatus('Synced');
      return;
    }

    setStatus('Syncing');
    for (const item of queue) {
      const table = tableForStore(item.storeName);
      const payload = remotePayload(item.storeName, item.payload);
      if (!table || !payload) {
        await markQueueItem(item, 'ignored');
        continue;
      }

      try {
        let response;
        if (item.operation === 'delete') {
          response = await fetch(`${config().url}/rest/v1/${table}?id=eq.${encodeURIComponent(item.recordId)}`, {
            method: 'DELETE',
            headers: headers()
          });
        } else {
          response = await fetch(`${config().url}/rest/v1/${table}?on_conflict=id`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(payload)
          });
        }
        if (!response.ok) throw new Error(await response.text());
        await markQueueItem(item, 'synced');
      } catch (error) {
        await markQueueItem(item, 'error', error.message);
        setStatus('Sync error');
        return;
      }
    }

    setStatus('Synced');
  }

  window.addEventListener('online', () => {
    setStatus(isConfigured() ? 'Syncing' : 'Local only');
    syncPendingChanges();
  });
  window.addEventListener('offline', () => setStatus('Offline'));

  window.SupabaseSync = {
    state,
    init,
    captureAuthFromUrl,
    sendMagicLink,
    syncPendingChanges
  };
})();
