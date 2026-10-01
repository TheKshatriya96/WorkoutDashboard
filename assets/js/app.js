const workouts = window.WORKOUTS;
const diets = window.DIETS;
const dayOrder = window.WORKOUT_DAYS;

const state = {
  activeDay: defaultWorkoutDay(),
  exerciseIndex: 0,
  activeDiet: 'veg',
  settings: null,
  activeSession: null,
  timer: null,
  timerInterval: null,
  audioContext: null,
  audioUnlocked: false,
  completingSet: false
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function defaultWorkoutDay() {
  const day = new Date().getDay();
  return ({0:'saturday',1:'monday',2:'tuesday',3:'tuesday',4:'thursday',5:'thursday',6:'saturday'})[day];
}

function currentWorkout() {
  return workouts[state.activeDay];
}

function currentExercise() {
  return currentWorkout().exercises[state.exerciseIndex];
}

function localDateTimeValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, '0');
  const secs = String(safe % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatLocal(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: state.settings?.timezone || 'Asia/Kolkata'
  }).format(new Date(iso));
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), 2200);
}

async function init() {
  await WorkoutDB.openDb();
  await loadOptionalConfig();
  state.settings = await StorageAdapter.getSettings();
  await SupabaseSync.init();
  await SupabaseSync.captureAuthFromUrl();
  await restoreTimer();

  bindGlobalEvents();
  renderDays();
  await renderExercise();
  renderDiet();
  await renderProgress();
  renderSettings();
  registerServiceWorker();
}

async function loadOptionalConfig() {
  try {
    const response = await fetch('assets/js/config.js', { cache: 'no-store' });
    if (!response.ok) return;
    const source = await response.text();
    new Function(source)();
  } catch (error) {
    window.SUPABASE_CONFIG = null;
  }
}

function bindGlobalEvents() {
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('click', handleWorkoutActions);
  document.addEventListener('sync-status-change', event => $('#sync-status').textContent = event.detail);

  $('#settings-open').addEventListener('click', () => $('#settings-dialog').showModal());
  $('#settings-close').addEventListener('click', () => $('#settings-dialog').close());

  document.querySelectorAll('.main-tab').forEach(tab => tab.addEventListener('click', async () => {
    document.querySelectorAll('.main-tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    $(`#${tab.dataset.view}-view`).classList.add('active');
    if (tab.dataset.view === 'workout') await renderExercise();
    if (tab.dataset.view === 'diet') renderDiet();
    if (tab.dataset.view === 'progress') await renderProgress();
  }));

  document.querySelectorAll('.diet-option').forEach(button => button.addEventListener('click', () => {
    state.activeDiet = button.dataset.diet;
    document.querySelectorAll('.diet-option').forEach(item => item.classList.toggle('active', item === button));
    renderDiet();
  }));

  document.addEventListener('keydown', event => {
    if (!$('#workout-view').classList.contains('active')) return;
    if (event.key === 'ArrowRight') move(1);
    if (event.key === 'ArrowLeft') move(-1);
  });
}

function renderDays() {
  const rail = $('#day-rail');
  rail.innerHTML = dayOrder.map(day => `<button class="day-chip ${day === state.activeDay ? 'active' : ''}" data-day="${day}">${workouts[day].label} · ${workouts[day].title}</button>`).join('');
  rail.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
    state.activeDay = button.dataset.day;
    state.exerciseIndex = 0;
    state.activeSession = await StorageAdapter.getTodaySession(state.activeDay);
    renderDays();
    await renderExercise('next');
  }));
  rail.querySelector('.active')?.scrollIntoView({inline:'center', block:'nearest'});
}

async function ensureSession() {
  state.activeSession = await StorageAdapter.startOrResumeSession(state.activeDay);
  return state.activeSession;
}

async function readSession() {
  state.activeSession = await StorageAdapter.getTodaySession(state.activeDay);
  return state.activeSession;
}

async function renderExercise(direction = 'next') {
  const stage = $('#exercise-stage');
  const workout = currentWorkout();
  const exercise = currentExercise();
  const session = await readSession();
  const sets = session ? await StorageAdapter.getExerciseSets(session.id, exercise.id) : [];
  const previous = session ? await StorageAdapter.getLatestPreviousSets(exercise.id, session.id) : await latestAnyPreviousSets(exercise.id);
  const completed = sets.length;
  const nextSet = Math.min(completed + 1, exercise.sets);
  const defaultReps = Math.max(exercise.repMin, Math.min(exercise.repMax, previous[nextSet - 1]?.reps || exercise.repMax));
  document.documentElement.style.setProperty('--accent', workout.color);

  stage.innerHTML = `
    <article class="exercise-card ${direction === 'prev' ? 'enter-prev' : 'enter-next'}">
      <div class="pose-stack">
        <div class="pose" data-pose="A"><img src="${exercise.images.a}" alt="${exercise.name} starting position" onerror="this.outerHTML='<div class=&quot;placeholder&quot;>Add Form A Image</div>'"></div>
        <div class="pose" data-pose="B"><img src="${exercise.images.b}" alt="${exercise.name} finishing position" onerror="this.outerHTML='<div class=&quot;placeholder&quot;>Add Form B Image</div>'"></div>
      </div>
      <div class="exercise-copy">
        <div class="exercise-kicker"><span>${workout.label} · ${workout.title}</span><span>${state.exerciseIndex + 1} / ${workout.exercises.length}</span></div>
        <h1>${exercise.name}</h1>
        <div class="dose">${exerciseDoseText(exercise)} · Rest ${exercise.restSeconds}s</div>
        <div class="cue">${exercise.cue}</div>
        <div class="set-tracker">
          <div class="tracker-top">
            <div><strong>Set ${Math.min(nextSet, exercise.sets)} of ${exercise.sets}</strong><span>Target: ${repTargetText(exercise)}</span></div>
            <div class="previous">${previous.length ? `Previous: ${previous.map(set => `${set.reps}`).join(', ')} reps` : 'Previous: no saved workout yet'}</div>
          </div>
          <div class="rep-stepper">
            <button id="rep-minus" aria-label="Decrease reps">−</button>
            <output id="rep-value">${defaultReps}</output>
            <button id="rep-plus" aria-label="Increase reps">+</button>
            <span>reps</span>
          </div>
          <button class="complete-set" id="complete-set" ${completed >= exercise.sets ? 'disabled' : ''}>${completed >= exercise.sets ? 'Exercise complete' : 'Complete Set'}</button>
          <div class="set-chips">${renderSetChips(exercise, sets)}</div>
          <div class="tracker-actions">
            <button id="undo-set" ${sets.length ? '' : 'disabled'}>Undo last set</button>
            <button id="skip-exercise">Skip exercise</button>
            <button id="finish-workout">Finish workout</button>
          </div>
        </div>
      </div>
      <div class="controls">
        <button class="round-btn" id="prev" aria-label="Previous exercise">←</button>
        <button class="round-btn primary" id="next" aria-label="Next exercise">→</button>
      </div>
    </article>`;

  bindExerciseEvents(stage, exercise);
}

async function latestAnyPreviousSets(exerciseId) {
  const all = await WorkoutDB.getByIndex('setLogs', 'exerciseId', exerciseId);
  const latest = all.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  if (!latest) return [];
  return all.filter(set => set.sessionId === latest.sessionId).sort((a, b) => a.setNumber - b.setNumber);
}

function renderSetChips(exercise, sets) {
  return Array.from({ length: exercise.sets }, (_, index) => {
    const set = sets[index];
    if (set) return `<button class="set-chip done" data-edit-set="${set.id}" aria-label="Edit set ${index + 1}">✓ Set ${index + 1} · ${set.reps} reps</button>`;
    return `<span class="set-chip">○ Set ${index + 1}</span>`;
  }).join('');
}

function bindExerciseEvents(stage, exercise) {
  $('#prev', stage).onclick = () => move(-1);
  $('#next', stage).onclick = () => move(1);

  let reps = Number($('#rep-value', stage).value || $('#rep-value', stage).textContent);
  $('#rep-minus', stage).onclick = () => {
    reps = Math.max(0, reps - 1);
    $('#rep-value', stage).textContent = reps;
  };
  $('#rep-plus', stage).onclick = () => {
    reps += 1;
    $('#rep-value', stage).textContent = reps;
  };

  let startX = 0;
  stage.ontouchstart = event => startX = event.changedTouches[0].clientX;
  stage.ontouchend = event => {
    const distance = event.changedTouches[0].clientX - startX;
    if (Math.abs(distance) > 55) move(distance < 0 ? 1 : -1);
  };
}

async function handleWorkoutActions(event) {
  const completeButton = event.target.closest('#complete-set');
  const undoButton = event.target.closest('#undo-set');
  const skipButton = event.target.closest('#skip-exercise');
  const finishButton = event.target.closest('#finish-workout');
  const editButton = event.target.closest('[data-edit-set]');

  if (!completeButton && !undoButton && !skipButton && !finishButton && !editButton) return;
  if (!$('#workout-view').classList.contains('active')) return;

  event.preventDefault();
  const exercise = currentExercise();

  if (completeButton) {
    if (state.completingSet || completeButton.disabled) return;
    state.completingSet = true;
    completeButton.disabled = true;
    const reps = Number($('#rep-value')?.textContent || exercise.repMax);
    const session = await ensureSession();
    const sets = await StorageAdapter.getExerciseSets(session.id, exercise.id);
    if (sets.length >= exercise.sets) {
      state.completingSet = false;
      await renderExercise();
      return;
    }
    const setNumber = sets.length + 1;
    await StorageAdapter.logSet({ session, workoutDay: state.activeDay, exercise, setNumber, reps });
    await SupabaseSync.syncPendingChanges();
    feedback('set-complete');
    toast(`Set ${setNumber} saved`);
    if (setNumber < exercise.sets && state.settings.autoStartRest) startRestTimer(exercise, setNumber + 1);
    state.completingSet = false;
    await renderExercise();
  }

  if (undoButton && !undoButton.disabled) {
    const session = await readSession();
    if (!session) return;
    await StorageAdapter.undoLastSet(session.id, exercise.id);
    await SupabaseSync.syncPendingChanges();
    toast('Last set removed');
    await renderExercise();
  }

  if (skipButton) {
    const session = await ensureSession();
    await StorageAdapter.markExerciseSkipped(session.id, exercise.id);
    toast('Exercise skipped for this session');
    await move(1);
  }

  if (finishButton) {
    const session = await readSession();
    if (!session) return toast('Log at least one set first');
    await StorageAdapter.finishSession(session.id);
    await SupabaseSync.syncPendingChanges();
    state.activeSession = null;
    toast('Workout finished');
    await renderExercise();
    await renderProgress();
  }

  if (editButton) {
    const set = await WorkoutDB.get('setLogs', editButton.dataset.editSet);
    const value = prompt('Edit reps for this set', set.reps);
    if (value == null) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 200) return toast('Enter a realistic rep count');
    await StorageAdapter.updateSetReps(set.id, parsed);
    await SupabaseSync.syncPendingChanges();
    toast('Set updated');
    await renderExercise();
  }
}

async function move(step) {
  const length = currentWorkout().exercises.length;
  state.exerciseIndex = (state.exerciseIndex + step + length) % length;
  await renderExercise(step < 0 ? 'prev' : 'next');
}

function startRestTimer(exercise, nextSetNumber) {
  const timer = {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    nextSetNumber,
    durationSeconds: exercise.restSeconds,
    endsAt: Date.now() + exercise.restSeconds * 1000,
    paused: false,
    remainingWhenPaused: null
  };
  saveTimer(timer);
  runTimer();
}

async function saveTimer(timer) {
  state.timer = timer;
  await StorageAdapter.saveSettings({ activeTimer: timer });
}

async function clearTimer() {
  clearInterval(state.timerInterval);
  state.timer = null;
  await StorageAdapter.saveSettings({ activeTimer: null });
  $('#rest-timer').classList.add('hidden');
}

async function restoreTimer() {
  const settings = await StorageAdapter.getSettings();
  state.timer = settings.activeTimer || null;
  if (state.timer) runTimer();
}

function runTimer() {
  clearInterval(state.timerInterval);
  renderTimer();
  state.timerInterval = setInterval(renderTimer, 500);
}

async function renderTimer() {
  const timerNode = $('#rest-timer');
  const timer = state.timer;
  if (!timer) {
    timerNode.classList.add('hidden');
    return;
  }

  const remaining = timer.paused ? timer.remainingWhenPaused : Math.ceil((timer.endsAt - Date.now()) / 1000);
  const done = remaining <= 0 && !timer.paused;
  const progress = done ? 100 : Math.min(100, Math.max(0, ((timer.durationSeconds - remaining) / timer.durationSeconds) * 100));

  timerNode.classList.remove('hidden');
  timerNode.innerHTML = `
    <div class="timer-main">
      <div><span>Next set ${timer.nextSetNumber}</span><strong>${timer.exerciseName}</strong></div>
      <output>${done ? '00:00' : formatTime(remaining)}</output>
    </div>
    <div class="timer-bar"><span style="width:${progress}%"></span></div>
    <div class="timer-actions">
      <button id="timer-pause">${timer.paused ? 'Resume' : 'Pause'}</button>
      <button id="timer-minus">-15 sec</button>
      <button id="timer-plus">+15 sec</button>
      <button id="timer-skip">Skip rest</button>
    </div>
    ${done ? '<div class="timer-ready">Start your next set</div>' : ''}`;

  $('#timer-pause').onclick = async () => {
    const current = state.timer;
    if (current.paused) {
      current.endsAt = Date.now() + current.remainingWhenPaused * 1000;
      current.paused = false;
      current.remainingWhenPaused = null;
    } else {
      current.remainingWhenPaused = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
      current.paused = true;
    }
    await saveTimer(current);
    renderTimer();
  };
  $('#timer-minus').onclick = () => adjustTimer(-15);
  $('#timer-plus').onclick = () => adjustTimer(15);
  $('#timer-skip').onclick = clearTimer;

  if (done && !timer.notified) {
    timer.notified = true;
    await saveTimer(timer);
    feedback('timer-complete');
    notify('Rest complete', `Start ${timer.exerciseName} set ${timer.nextSetNumber}.`);
  }
}

async function adjustTimer(seconds) {
  const timer = state.timer;
  if (!timer) return;
  if (timer.paused) timer.remainingWhenPaused = Math.max(0, timer.remainingWhenPaused + seconds);
  else timer.endsAt += seconds * 1000;
  await saveTimer(timer);
  renderTimer();
}

function renderDiet() {
  const diet = diets[state.activeDiet];
  document.documentElement.style.setProperty('--accent', '#c8ff3d');
  $('#diet-content').innerHTML = `
    <div class="macro-strip">${diet.totals.map(item => `<div class="macro"><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join('')}</div>
    <div class="meal-list">${diet.meals.map((meal, index) => `
      <details class="meal" ${index === 0 ? 'open' : ''}>
        <summary><div class="meal-time">${meal[0]}</div><div><h3>${meal[1]}</h3><div class="meal-preview">${meal[2]}</div></div><div class="meal-cals">${meal[3]}<small>kcal</small></div></summary>
        <div class="meal-body"><ul><li>${meal[4]}</li><li>${meal[5]}</li></ul></div>
      </details>`).join('')}</div>
    <p class="note">${diet.note}</p>`;
}

async function renderProgress() {
  const [weights, history] = await Promise.all([StorageAdapter.getWeightLogs(), StorageAdapter.getWorkoutHistory()]);
  const chronological = [...weights].reverse();
  const latest = weights[0];
  const starting = chronological[0];
  const sevenDay = averageSince(weights, 7);
  const change = latest && starting ? latest.weightKg - starting.weightKg : 0;

  $('#progress-content').innerHTML = `
    <div class="stat-grid">
      <div class="stat"><span>Current</span><strong>${latest ? latest.weightKg.toFixed(1) : '--'} kg</strong></div>
      <div class="stat"><span>Starting</span><strong>${starting ? starting.weightKg.toFixed(1) : '--'} kg</strong></div>
      <div class="stat"><span>Change</span><strong>${latest && starting ? `${change >= 0 ? '+' : ''}${change.toFixed(1)} kg` : '--'}</strong></div>
      <div class="stat"><span>7-day average</span><strong>${sevenDay ? `${sevenDay.toFixed(1)} kg` : '--'}</strong></div>
    </div>
    <div class="progress-grid">
      <section class="tool-panel">
        <h2>Weight entry</h2>
        <form id="weight-form" class="compact-form">
          <input name="weightKg" type="number" min="20" max="250" step="0.1" placeholder="Weight kg" required />
          <input name="recordedAt" type="datetime-local" value="${localDateTimeValue()}" required />
          <input name="note" type="text" placeholder="Note optional" />
          <button>Add weight</button>
        </form>
        <div class="chart">${renderWeightChart(chronological.slice(-30))}</div>
      </section>
      <section class="tool-panel">
        <h2>Data management</h2>
        <div class="button-stack">
          <button id="export-json">Export all JSON</button>
          <button id="export-sets-csv">Export sets CSV</button>
          <button id="export-weight-csv">Export weight CSV</button>
          <label class="file-button">Import JSON backup<input id="import-json" type="file" accept="application/json,.json" /></label>
          <button class="danger" id="clear-data">Clear local data</button>
        </div>
      </section>
    </div>
    <div class="history-grid">
      <section class="tool-panel"><h2>Weight history</h2><div class="history-list">${renderWeightList(weights)}</div></section>
      <section class="tool-panel"><h2>Workout history</h2><div class="history-list">${renderWorkoutList(history)}</div></section>
    </div>`;

  bindProgressEvents(weights, history);
}

function averageSince(weights, days) {
  const cutoff = Date.now() - days * StorageAdapter.DAY_MS;
  const values = weights.filter(record => new Date(record.recordedAt).getTime() >= cutoff);
  if (!values.length) return null;
  return values.reduce((sum, record) => sum + record.weightKg, 0) / values.length;
}

function renderWeightChart(records) {
  if (records.length < 2) return '<div class="empty-state">Add at least two weights to draw the 30-day trend.</div>';
  const width = 320;
  const height = 120;
  const weights = records.map(record => record.weightKg);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const points = records.map((record, index) => {
    const x = (index / (records.length - 1)) * width;
    const y = height - ((record.weightKg - min) / (max - min)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="30-day weight trend"><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

function renderWeightList(weights) {
  if (!weights.length) return '<div class="empty-state">No weights yet.</div>';
  return weights.map(record => `
    <article class="history-item">
      <div><strong>${record.weightKg.toFixed(1)} kg</strong><span>${formatLocal(record.recordedAt)}${record.note ? ` · ${record.note}` : ''}</span></div>
      <div class="mini-actions">
        <button data-edit-weight="${record.id}">Edit</button>
        <button data-delete-weight="${record.id}">Delete</button>
      </div>
    </article>`).join('');
}

function renderWorkoutList(history) {
  if (!history.length) return '<div class="empty-state">No workouts logged yet.</div>';
  return history.map(session => {
    const duration = session.completedAt ? Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 60000) : 'Active';
    return `
      <details class="history-item workout-history" data-session="${session.id}">
        <summary><div><strong>${formatLocal(session.startedAt)}</strong><span>${session.workoutDay} · ${session.totalSets} sets · ${session.totalReps} reps · ${duration}${Number.isFinite(duration) ? ' min' : ''}</span></div></summary>
        <div class="session-sets">Open to load sets.</div>
      </details>`;
  }).join('');
}

function bindProgressEvents(weights) {
  $('#weight-form').onsubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weightKg = Number(form.get('weightKg'));
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 250) return toast('Enter a realistic weight');
    await StorageAdapter.addWeightLog({
      weightKg,
      recordedAt: form.get('recordedAt'),
      note: form.get('note')
    });
    await SupabaseSync.syncPendingChanges();
    toast('Weight saved');
    await renderProgress();
  };

  document.querySelectorAll('[data-edit-weight]').forEach(button => button.onclick = async () => {
    const record = weights.find(item => item.id === button.dataset.editWeight);
    const value = prompt('Edit weight in kg', record.weightKg);
    if (value == null) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 20 || parsed > 250) return toast('Enter a realistic weight');
    await StorageAdapter.updateWeightLog(record.id, { weightKg: parsed });
    await SupabaseSync.syncPendingChanges();
    await renderProgress();
  });

  document.querySelectorAll('[data-delete-weight]').forEach(button => button.onclick = async () => {
    if (!confirm('Delete this weight entry?')) return;
    await StorageAdapter.deleteWeightLog(button.dataset.deleteWeight);
    await SupabaseSync.syncPendingChanges();
    await renderProgress();
  });

  document.querySelectorAll('.workout-history').forEach(details => details.ontoggle = async () => {
    if (!details.open || details.dataset.loaded) return;
    const sets = await StorageAdapter.getSessionSets(details.dataset.session);
    $('.session-sets', details).innerHTML = sets.length ? sets.map(set => `<div class="set-row">${set.exerciseName} · Set ${set.setNumber} · ${set.reps} reps</div>`).join('') : 'No sets recorded.';
    details.dataset.loaded = '1';
  });

  $('#export-json').onclick = async () => downloadFile('workout-dashboard-backup.json', JSON.stringify(await StorageAdapter.exportBackup(), null, 2), 'application/json');
  $('#export-sets-csv').onclick = async () => {
    const sets = await WorkoutDB.getAll('setLogs');
    downloadFile('workout-sets.csv', StorageAdapter.recordsToCsv(sets, [
      { key:'sessionId', label:'session_id' },
      { key:'workoutDay', label:'workout_day' },
      { key:'exerciseId', label:'exercise_id' },
      { key:'exerciseName', label:'exercise_name' },
      { key:'setNumber', label:'set_number' },
      { key:'reps', label:'reps' },
      { key:'completedAt', label:'completed_at' },
      { key:'prescribedRestSeconds', label:'prescribed_rest_seconds' }
    ]), 'text/csv');
  };
  $('#export-weight-csv').onclick = async () => {
    const logs = await WorkoutDB.getAll('weightLogs');
    downloadFile('weight-history.csv', StorageAdapter.recordsToCsv(logs, [
      { key:'id', label:'id' },
      { key:'weightKg', label:'weight_kg' },
      { key:'recordedAt', label:'recorded_at' },
      { key:'note', label:'note' }
    ]), 'text/csv');
  };
  $('#import-json').onchange = importBackupFile;
  $('#clear-data').onclick = async () => {
    if (!confirm('Export a backup first. Clear all local IndexedDB data now?')) return;
    await StorageAdapter.clearLocalData();
    location.reload();
  };
}

async function importBackupFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  const validation = StorageAdapter.validateBackup(data);
  if (!validation.valid) return toast(validation.reason);
  const message = `Import ${validation.counts.sessions} sessions, ${validation.counts.sets} sets and ${validation.counts.weights} weight records?`;
  if (!confirm(message)) return;
  await StorageAdapter.importBackup(data);
  toast('Backup imported');
  await renderProgress();
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderSettings() {
  $('#setting-sound').checked = state.settings.soundEnabled;
  $('#setting-vibration').checked = state.settings.vibrationEnabled;
  $('#setting-autorest').checked = state.settings.autoStartRest;
  $('#setting-notifications').checked = state.settings.notificationsEnabled;
  $('#setting-sound-type').value = state.settings.soundType;
  $('#setting-volume').value = state.settings.volume;

  ['sound', 'vibration', 'autorest', 'notifications'].forEach(name => {
    $(`#setting-${name}`).onchange = saveSettingsFromPanel;
  });
  $('#setting-sound-type').onchange = saveSettingsFromPanel;
  $('#setting-volume').oninput = saveSettingsFromPanel;
  $('#preview-sound').onclick = () => playSound('set-complete');
  $('#reset-sound').onclick = async () => {
    await StorageAdapter.removeCustomSound();
    state.settings = await StorageAdapter.getSettings();
    renderSettings();
    toast('Sound reset');
  };
  $('#custom-sound').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!/\.(mp3|wav|m4a|ogg)$/i.test(file.name) && !file.type.startsWith('audio/')) return toast('Choose an MP3, WAV, M4A or OGG file');
    await StorageAdapter.saveCustomSound(file);
    state.settings = await StorageAdapter.getSettings();
    renderSettings();
    toast('Custom sound saved');
  };
  $('#enable-notifications').onclick = enableNotifications;
  $('#supabase-login').onsubmit = async event => {
    event.preventDefault();
    const email = $('#supabase-email').value.trim();
    if (!email) return;
    try {
      await SupabaseSync.sendMagicLink(email);
      toast('Magic link sent');
    } catch (error) {
      toast(error.message);
    }
  };
}

async function saveSettingsFromPanel() {
  state.settings = await StorageAdapter.saveSettings({
    soundEnabled: $('#setting-sound').checked,
    vibrationEnabled: $('#setting-vibration').checked,
    autoStartRest: $('#setting-autorest').checked,
    notificationsEnabled: $('#setting-notifications').checked && 'Notification' in window && Notification.permission === 'granted',
    soundType: $('#setting-sound-type').value,
    volume: Number($('#setting-volume').value)
  });
}

async function enableNotifications() {
  if (!('Notification' in window)) return toast('Browser notifications are not supported here');
  const permission = await Notification.requestPermission();
  state.settings = await StorageAdapter.saveSettings({ notificationsEnabled: permission === 'granted' });
  renderSettings();
  toast(permission === 'granted' ? 'Notifications enabled' : 'Notifications not enabled');
}

function notify(title, body) {
  if (!state.settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: 'assets/icons/icon.svg' });
}

function unlockAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  state.audioContext = state.audioContext || new (window.AudioContext || window.webkitAudioContext)();
  state.audioContext.resume?.();
  state.audioUnlocked = true;
}

function feedback(kind) {
  if (state.settings.vibrationEnabled && 'vibrate' in navigator) navigator.vibrate(kind === 'timer-complete' ? [80, 50, 80] : 50);
  playSound(kind);
}

async function playSound(kind) {
  if (!state.settings.soundEnabled || state.settings.soundType === 'off') return;
  unlockAudio();
  if (state.settings.soundType === 'custom') {
    const custom = await StorageAdapter.getCustomSound();
    if (!custom?.blob) return;
    const audio = new Audio(URL.createObjectURL(custom.blob));
    audio.volume = state.settings.volume;
    audio.play().catch(() => {});
    return;
  }
  playBuiltInSound(state.settings.soundType, kind);
}

function playBuiltInSound(type, kind) {
  const ctx = state.audioContext;
  if (!ctx) return;
  const volume = state.settings.volume;
  const patterns = {
    'short-beep': [[660, 0, 0.12]],
    'double-beep': [[660, 0, 0.1], [880, 0.16, 0.1]],
    chime: [[523, 0, 0.16], [784, 0.14, 0.24]],
    'round-bell': [[440, 0, 0.12], [440, 0.2, 0.12], [440, 0.4, 0.18]]
  };
  const chosen = patterns[type] || patterns['short-beep'];
  chosen.forEach(([freq, delay, length]) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = kind === 'timer-complete' ? freq * 1.15 : freq;
    oscillator.type = type === 'round-bell' ? 'square' : 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.25), ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + length);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + length + 0.03);
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:/.test(location.protocol)) return;
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

init().catch(error => {
  console.error(error);
  toast('Dashboard could not start. Check the console.');
});
