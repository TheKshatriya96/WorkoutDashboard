(function () {
  const DEFAULT_SETTINGS = {
    soundEnabled: true,
    soundType: 'short-beep',
    volume: 0.55,
    vibrationEnabled: true,
    notificationsEnabled: false,
    autoStartRest: true,
    syncEnabled: false,
    timezone: 'Asia/Kolkata'
  };

  const DAY_MS = 24 * 60 * 60 * 1000;

  function uid(prefix) {
    const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${value}`;
  }

  function todayKey(date = new Date()) {
    return date.toLocaleDateString('en-CA');
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function sortByDate(records, key, direction = 'asc') {
    return records.sort((a, b) => {
      const result = new Date(a[key]).getTime() - new Date(b[key]).getTime();
      return direction === 'asc' ? result : -result;
    });
  }

  async function queueChange(storeName, operation, record) {
    const now = nowIso();
    await WorkoutDB.put('syncQueue', {
      id: uid('sync'),
      storeName,
      operation,
      recordId: record.id,
      payload: record,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      attempts: 0
    });
  }

  async function getSettings() {
    const stored = await WorkoutDB.get('settings', 'user-preferences');
    return { ...DEFAULT_SETTINGS, ...(stored?.value || {}) };
  }

  async function saveSettings(settings) {
    const merged = { ...await getSettings(), ...settings };
    await WorkoutDB.put('settings', { key: 'user-preferences', value: merged, updatedAt: nowIso() });
    return merged;
  }

  async function getCustomSound() {
    return WorkoutDB.get('customSounds', 'completion-sound');
  }

  async function saveCustomSound(file) {
    const record = {
      id: 'completion-sound',
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      updatedAt: nowIso()
    };
    await WorkoutDB.put('customSounds', record);
    await saveSettings({ soundType: 'custom' });
    return record;
  }

  async function removeCustomSound() {
    await WorkoutDB.remove('customSounds', 'completion-sound');
    await saveSettings({ soundType: 'short-beep' });
  }

  async function getTodaySession(workoutDay) {
    const sessions = await WorkoutDB.getByIndex('workoutSessions', 'workoutDay', workoutDay);
    const today = todayKey();
    return sortByDate(sessions, 'startedAt', 'desc')
      .find(session => session.localDate === today && session.status !== 'completed');
  }

  async function startOrResumeSession(workoutDay) {
    const existing = await getTodaySession(workoutDay);
    if (existing) return existing;

    const now = nowIso();
    const session = {
      id: uid(`session-${todayKey()}-${workoutDay}`),
      workoutDay,
      startedAt: now,
      completedAt: null,
      status: 'active',
      totalSets: 0,
      totalReps: 0,
      skippedExerciseIds: [],
      notes: '',
      localDate: todayKey(),
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };
    await WorkoutDB.put('workoutSessions', session);
    await queueChange('workoutSessions', 'upsert', session);
    return session;
  }

  async function updateSessionTotals(sessionId) {
    const session = await WorkoutDB.get('workoutSessions', sessionId);
    if (!session) return null;
    const sets = await WorkoutDB.getByIndex('setLogs', 'sessionId', sessionId);
    const totalReps = sets.reduce((sum, set) => sum + Number(set.reps || 0), 0);
    const updated = { ...session, totalSets: sets.length, totalReps, updatedAt: nowIso(), syncStatus: 'pending' };
    await WorkoutDB.put('workoutSessions', updated);
    await queueChange('workoutSessions', 'upsert', updated);
    return updated;
  }

  async function logSet({ session, workoutDay, exercise, setNumber, reps }) {
    const now = nowIso();
    const id = `${session.id}:${exercise.id}:${setNumber}`;
    const record = {
      id,
      sessionId: session.id,
      workoutDay,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber,
      reps: Number(reps),
      completedAt: now,
      prescribedRestSeconds: exercise.restSeconds,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };
    await WorkoutDB.put('setLogs', record);
    await queueChange('setLogs', 'upsert', record);
    await updateSessionTotals(session.id);
    return record;
  }

  async function getSessionSets(sessionId) {
    return sortByDate(await WorkoutDB.getByIndex('setLogs', 'sessionId', sessionId), 'completedAt');
  }

  async function getExerciseSets(sessionId, exerciseId) {
    const sets = await getSessionSets(sessionId);
    return sets.filter(set => set.exerciseId === exerciseId).sort((a, b) => a.setNumber - b.setNumber);
  }

  async function getLatestPreviousSets(exerciseId, currentSessionId) {
    const all = await WorkoutDB.getByIndex('setLogs', 'exerciseId', exerciseId);
    const previous = all
      .filter(set => set.sessionId !== currentSessionId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    if (!previous.length) return [];
    const sessionId = previous[0].sessionId;
    return previous.filter(set => set.sessionId === sessionId).sort((a, b) => a.setNumber - b.setNumber);
  }

  async function undoLastSet(sessionId, exerciseId) {
    const sets = await getExerciseSets(sessionId, exerciseId);
    const last = sets[sets.length - 1];
    if (!last) return null;
    await WorkoutDB.remove('setLogs', last.id);
    await queueChange('setLogs', 'delete', last);
    await updateSessionTotals(sessionId);
    return last;
  }

  async function updateSetReps(id, reps) {
    const record = await WorkoutDB.get('setLogs', id);
    if (!record) return null;
    const updated = { ...record, reps: Number(reps), updatedAt: nowIso(), syncStatus: 'pending' };
    await WorkoutDB.put('setLogs', updated);
    await queueChange('setLogs', 'upsert', updated);
    await updateSessionTotals(updated.sessionId);
    return updated;
  }

  async function markExerciseSkipped(sessionId, exerciseId) {
    const session = await WorkoutDB.get('workoutSessions', sessionId);
    if (!session) return null;
    const skippedExerciseIds = Array.from(new Set([...(session.skippedExerciseIds || []), exerciseId]));
    const updated = { ...session, skippedExerciseIds, updatedAt: nowIso(), syncStatus: 'pending' };
    await WorkoutDB.put('workoutSessions', updated);
    await queueChange('workoutSessions', 'upsert', updated);
    return updated;
  }

  async function finishSession(sessionId, notes = '') {
    const session = await updateSessionTotals(sessionId);
    if (!session) return null;
    const updated = { ...session, status: 'completed', notes, completedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' };
    await WorkoutDB.put('workoutSessions', updated);
    await queueChange('workoutSessions', 'upsert', updated);
    return updated;
  }

  async function getWorkoutHistory() {
    return sortByDate(await WorkoutDB.getAll('workoutSessions'), 'startedAt', 'desc');
  }

  async function addWeightLog({ weightKg, recordedAt, note }) {
    const now = nowIso();
    const record = {
      id: uid('weight'),
      weightKg: Number(weightKg),
      recordedAt: new Date(recordedAt).toISOString(),
      note: note || '',
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };
    await WorkoutDB.put('weightLogs', record);
    await queueChange('weightLogs', 'upsert', record);
    return record;
  }

  async function updateWeightLog(id, changes) {
    const record = await WorkoutDB.get('weightLogs', id);
    if (!record) return null;
    const updated = {
      ...record,
      ...changes,
      weightKg: Number(changes.weightKg ?? record.weightKg),
      recordedAt: changes.recordedAt ? new Date(changes.recordedAt).toISOString() : record.recordedAt,
      updatedAt: nowIso(),
      syncStatus: 'pending'
    };
    await WorkoutDB.put('weightLogs', updated);
    await queueChange('weightLogs', 'upsert', updated);
    return updated;
  }

  async function deleteWeightLog(id) {
    const record = await WorkoutDB.get('weightLogs', id);
    if (!record) return null;
    await WorkoutDB.remove('weightLogs', id);
    await queueChange('weightLogs', 'delete', record);
    return record;
  }

  async function getWeightLogs() {
    return sortByDate(await WorkoutDB.getAll('weightLogs'), 'recordedAt', 'desc');
  }

  async function exportBackup() {
    return WorkoutDB.exportAll();
  }

  function validateBackup(data) {
    if (!data || typeof data !== 'object') return { valid: false, reason: 'The selected file is not a JSON object.' };
    const expectedArrays = ['workoutSessions', 'setLogs', 'weightLogs'];
    for (const name of expectedArrays) {
      if (!Array.isArray(data[name])) return { valid: false, reason: `Missing ${name} array.` };
    }
    return {
      valid: true,
      counts: {
        sessions: data.workoutSessions.length,
        sets: data.setLogs.length,
        weights: data.weightLogs.length
      }
    };
  }

  async function importBackup(data) {
    const validation = validateBackup(data);
    if (!validation.valid) throw new Error(validation.reason);
    await WorkoutDB.importAll(data);
    return validation.counts;
  }

  function recordsToCsv(records, columns) {
    const escape = value => {
      const text = value == null ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [
      columns.map(column => column.label).join(','),
      ...records.map(record => columns.map(column => escape(record[column.key])).join(','))
    ].join('\n');
  }

  async function clearLocalData() {
    await WorkoutDB.clearAll();
  }

  async function getSyncQueue() {
    return WorkoutDB.getByIndex('syncQueue', 'status', 'pending');
  }

  window.StorageAdapter = {
    DAY_MS,
    uid,
    todayKey,
    getSettings,
    saveSettings,
    getCustomSound,
    saveCustomSound,
    removeCustomSound,
    startOrResumeSession,
    getTodaySession,
    logSet,
    getSessionSets,
    getExerciseSets,
    getLatestPreviousSets,
    undoLastSet,
    updateSetReps,
    markExerciseSkipped,
    finishSession,
    getWorkoutHistory,
    addWeightLog,
    updateWeightLog,
    deleteWeightLog,
    getWeightLogs,
    exportBackup,
    validateBackup,
    importBackup,
    recordsToCsv,
    clearLocalData,
    getSyncQueue
  };
})();
