// js/main.js
import * as storage from './storage.js';
import * as Training from './training.js';

// ─── Default Routine Tasks (from habit list) ─────────────────────────────────
const DEFAULT_TASKS = [
    { name: 'Bett machen',                    points: 5,    unit: 'Durchführung', category: 'routine' },
    { name: 'Kalt Duschen',                   points: 15,   unit: 'Durchführung', category: 'routine' },
    { name: 'Joggen',                         points: 2,    unit: 'Minute',       category: 'routine' },
    { name: 'Aufräumen / Sauber Machen',      points: 1,    unit: 'Minute',       category: 'routine' },
    { name: 'Liegestütze',                    points: 0.5,  unit: 'Stück',        category: 'routine' },
    { name: 'Situps',                         points: 0.2,  unit: 'Stück',        category: 'routine' },
    { name: 'Pull Ups',                       points: 1,    unit: 'Stück',        category: 'routine' },
    { name: 'Schritte',                       points: 0.005,unit: 'Schritt',      category: 'routine' },
    { name: 'An To-Do Punkt arbeiten',        points: 1,    unit: 'Minute',       category: 'routine' },
    { name: 'To-Do Punkt abgehakt',           points: 20,   unit: 'Durchführung', category: 'routine' },
    { name: 'Gitarre lernen',                 points: 1,    unit: 'Minute',       category: 'routine' },
    { name: 'Produktives Arbeiten (Arbeit)',   points: 5,    unit: '30 Minuten',   category: 'routine' },
    { name: 'Sonstiges (sinnvolles) Lernen',  points: 1,    unit: 'Minute',       category: 'routine' },
    { name: 'Psychologielektüre',             points: 2,    unit: 'Minute',       category: 'routine' },
    { name: 'Lesen',                          points: 1,    unit: 'gelesene Seite', category: 'routine' },
    { name: 'Meditieren',                     points: 2,    unit: 'Minute',       category: 'routine' },
    { name: 'Kochen',                         points: 25,   unit: 'Kochgang',     category: 'routine' },
    { name: 'Tagebuch schreiben',             points: 15,   unit: 'Durchführung', category: 'routine' },
];

// ─── App State ────────────────────────────────────────────────────────────────
let tasks = [];
let dailyHistory = {};
let trainingHistory = {};
let customPlans = [];
let currentWorkoutDayId = null;
let pendingTaskId = null; // for quantity modal
const sortableInstances = []; // tracked so we can destroy on re-render

// Escape user-controlled strings before injecting into innerHTML.
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Modal open/close helpers with focus management. Tracks the previously
// focused element so it can be restored on close.
let lastFocusedBeforeModal = null;
function openModal(modalEl) {
    lastFocusedBeforeModal = document.activeElement;
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    const focusable = modalEl.querySelector('input:not([type=hidden]), select, textarea, button');
    if (focusable) focusable.focus();
}
function closeModal(modalEl, form) {
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    if (form) form.reset();
    if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
        lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
}

// Wire the standard "cancel button + backdrop click resets form and closes
// modal" pattern shared by every dialog. Returns the close handler so callers
// can also invoke it after a submit.
function wireModalDismiss(modalEl, { cancelBtn, form, onClose } = {}) {
    const close = () => {
        closeModal(modalEl, form);
        if (onClose) onClose();
    };
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) close(); });
    return close;
}

// Stilkonformer Confirm-Dialog. Returns a Promise<boolean>.
function customConfirm(message, { title = 'Bestätigen', okLabel = 'OK', okClass = 'btn-primary' } = {}) {
    const modalEl = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const titleEl = document.getElementById('confirm-title');
    const okBtn = document.getElementById('btn-confirm-ok');
    const cancelBtn = document.getElementById('btn-confirm-cancel');
    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.className = okClass;
    okBtn.textContent = okLabel;
    return new Promise(resolve => {
        const cleanup = (result) => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            modalEl.removeEventListener('click', onBackdrop);
            closeModal(modalEl);
            resolve(result);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (e) => { if (e.target === modalEl) cleanup(false); };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modalEl.addEventListener('click', onBackdrop);
        openModal(modalEl);
        okBtn.focus();
    });
}

// Plays a brief success animation + (where supported) vibrates the device.
// Tracks the last celebrated day so repeated updates on the same day don't
// re-trigger the animation.
let lastCelebratedDay = null;
function celebrateTargetReached() {
    if (navigator.vibrate) {
        try { navigator.vibrate([60, 40, 120]); } catch (_) { /* no-op */ }
    }
    scoreTodayEl.classList.remove('celebrate');
    // Force reflow so re-adding the class restarts the animation.
    void scoreTodayEl.offsetWidth;
    scoreTodayEl.classList.add('celebrate');
}

// Lightweight toast for surfacing errors (e.g. localStorage quota exceeded).
function showToast(msg, type = 'error') {
    let host = document.getElementById('toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.textContent = msg;
    const bg = type === 'error' ? '#b91c1c' : '#0f766e';
    el.style.cssText = `pointer-events:auto;background:${bg};color:#fff;padding:10px 16px;border-radius:8px;font-size:0.9rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:90vw;`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 6000);
}

// ─── DOM References ───────────────────────────────────────────────────────────
const scoreTodayEl   = document.getElementById('score-today');
const scoreTargetEl  = document.getElementById('score-target');
const scoreProgressEl= document.getElementById('score-progress');
const dashboardMsgEl = document.getElementById('dashboard-message');
const taskListEl     = document.getElementById('task-list');
const currentMonthEl = document.getElementById('current-month');
const logoHome       = document.getElementById('logo-home');
const streakDisplayEl = document.getElementById('streak-display');

const modal         = document.getElementById('add-task-modal');
const btnAddTask    = document.getElementById('btn-add-task');
const btnCancelTask = document.getElementById('btn-cancel-task');
const formAddTask   = document.getElementById('add-task-form');

const editModal         = document.getElementById('edit-task-modal');
const formEditTask      = document.getElementById('edit-task-form');
const btnCancelEditTask = document.getElementById('btn-cancel-edit-task');

const calendarModal    = document.getElementById('calendar-modal');
const btnCalendar      = document.getElementById('btn-calendar');
const btnCloseCalendar = document.getElementById('btn-close-calendar');
const calendarListEl   = document.getElementById('calendar-list');

const mainView          = document.getElementById('main-view');
const trainingSection   = document.getElementById('training-section');
const btnTrainingMenu   = document.getElementById('btn-training-menu');
const btnCloseTraining  = document.getElementById('btn-close-training');
const trainingMenu      = document.getElementById('training-menu');
const workoutView       = document.getElementById('workout-view');
const workoutTitle      = document.getElementById('workout-title');
const workoutDateInput  = document.getElementById('workout-date');
const workoutWarmupInput= document.getElementById('workout-warmup');
const workoutExercisesEl= document.getElementById('workout-exercises');
const btnFinishWorkout  = document.getElementById('btn-finish-workout');
const customPlansContainer = document.getElementById('custom-plans-container');
const btnCreateCustom   = document.getElementById('btn-create-custom');
const customTrainingModal = document.getElementById('custom-training-modal');
const formCustomTraining  = document.getElementById('custom-training-form');
const btnCancelCustom   = document.getElementById('btn-cancel-custom');
const btnAddCustomExercise = document.getElementById('btn-add-custom-exercise');
const customExercisesList  = document.getElementById('custom-exercises-list');

const quantityModal   = document.getElementById('quantity-modal');
const quantityForm    = document.getElementById('quantity-form');
const quantityInput   = document.getElementById('quantity-input');
const quantityTitle   = document.getElementById('quantity-title');
const quantitySubtitle= document.getElementById('quantity-subtitle');
const quantityLabel   = document.getElementById('quantity-label');
const btnCancelQuantity = document.getElementById('btn-cancel-quantity');

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    // Surface localStorage failures (quota exceeded, private mode) to the user
    // instead of silently losing data.
    window.addEventListener('storage-error', e => {
        const { isQuota } = e.detail || {};
        showToast(isQuota
            ? 'Speicher voll – Daten konnten nicht gesichert werden. Bitte alte Einträge exportieren/löschen.'
            : 'Speicher-Fehler – Änderungen wurden evtl. nicht gesichert.');
    });

    tasks          = await storage.get('tasks', []);
    dailyHistory   = await storage.get('dailyHistory', {});
    trainingHistory= await storage.get('trainingHistory', {});
    customPlans    = await storage.get('customPlans', []);

    // Seed default tasks on first run
    if (tasks.length === 0) {
        tasks = DEFAULT_TASKS.map((t, i) => ({ ...t, id: 'default_' + i }));
        await storage.set('tasks', tasks);
    }

    // Initialize global exercise library
    await Training.getExerciseLibrary();

    checkMonthlyReset();
    // Suppress the target-reached animation on initial load if the user is
    // already above the target — they reached it earlier, not just now.
    const initialScore = getTodayScore();
    const initialTarget = calculate7DayAverage();
    if (initialTarget > 0 && initialScore >= initialTarget) {
        lastCelebratedDay = getTodayString();
    }
    updateDashboard();
    renderTasks();
    Training.renderCustomPlansMenu(customPlans, customPlansContainer, async (id) => {
        currentWorkoutDayId = id;
        await Training.openWorkout(id, customPlans, trainingHistory, workoutEls());
    });
    setupEventListeners();
    setupEscapeKeyHandler();

    const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    // Use logical date so the "Saison" label matches what calculate7DayAverage uses
    // (3h offset → day rolls over at 03:00 local time).
    currentMonthEl.textContent = months[getLogicalDate().getMonth()];
}

function workoutEls() {
    return { trainingMenu, workoutView, workoutTitle, workoutDateInput, workoutWarmupInput, workoutWarmupText: document.getElementById('workout-warmup-text'), workoutExercisesEl };
}

// ─── Core Logic ───────────────────────────────────────────────────────────────
export function getLogicalDate(date = new Date()) {
    const d = new Date(date);
    d.setHours(d.getHours() - 3);
    return d;
}

// YYYY-MM-DD key from a Date object. Zero-padded so the lexicographic
// order matches chronological order.
function formatDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTodayString() {
    return formatDateKey(getLogicalDate());
}

// A day counts as "active" if at least one task entry exists. Negative-only days
// (score ≤ 0 from DontDo tasks) still count as activity for streak purposes.
function isDayActive(key) {
    return !!dailyHistory[key]?.tasksDone?.length;
}

function checkMonthlyReset() {
    // We no longer delete dailyHistory. Instead, calculate7DayAverage
    // only considers days within the current month, so the target
    // naturally resets to 0 at the start of each month.
    // The calendar keeps showing all past entries.
}

function calculate7DayAverage() {
    const today = getLogicalDate(); today.setHours(0,0,0,0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let total = 0, count = 0;
    for (let i = 1; i <= 7; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        // Only count days within the current month (monthly reset)
        if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) continue;
        const key = formatDateKey(d);
        if (dailyHistory[key]) { total += dailyHistory[key].score; count++; }
    }
    return count === 0 ? 0 : Math.round(total / count);
}

function getTodayScore() {
    return dailyHistory[getTodayString()]?.score || 0;
}

// Streak = consecutive past active days. "Today" only adds to the count if it
// is itself active — an empty today doesn't break the streak (the user might
// just not have logged anything yet).
function calculateStreak() {
    const today = getLogicalDate(); today.setHours(0,0,0,0);
    const todayStr = getTodayString();
    const startOffset = isDayActive(todayStr) ? 0 : 1;
    let streak = 0;
    for (let i = startOffset; i <= 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (isDayActive(formatDateKey(d))) streak++;
        else break;
    }
    return streak;
}

// ─── Task Operations ──────────────────────────────────────────────────────────
function addTask(name, points, unit, category, isSimple) {
    const task = { id: Date.now().toString(), name, points: parseFloat(points), unit: unit || 'Ausführung', category: category || 'routine', isSimple: !!isSimple };
    tasks.push(task);
    storage.set('tasks', tasks);
    renderTasks();
}

function editTask(id, name, points, unit, category, isSimple) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], name, points: parseFloat(points), unit, category, isSimple: !!isSimple };
    storage.set('tasks', tasks);
    renderTasks();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    storage.set('tasks', tasks);
    renderTasks();
}

function completeTask(taskId, quantity = 1) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const todayStr = getTodayString();
    if (!dailyHistory[todayStr]) dailyHistory[todayStr] = { score: 0, tasksDone: [] };

    const basePts = task.category === 'dontdo' ? -Math.abs(task.points) : task.points;
    const totalPts = parseFloat((basePts * quantity).toFixed(2));
    // Round the running score on store too, otherwise floating-point drift
    // accumulates (e.g. 0.1 + 0.2 → 0.30000000000000004 across many tasks).
    dailyHistory[todayStr].score = parseFloat((dailyHistory[todayStr].score + totalPts).toFixed(2));
    dailyHistory[todayStr].tasksDone.push({
        id: task.id, name: task.name, timestamp: Date.now(),
        points: totalPts,
        unit: quantity !== 1 ? `${quantity}× ${task.unit}` : task.unit
    });
    storage.set('dailyHistory', dailyHistory);

    // Archive ToDo tasks after completion
    if (task.category === 'todo') {
        task.done = true;
        storage.set('tasks', tasks);
    }

    updateDashboard();
    renderTasks();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function updateDashboard() {
    const score = getTodayScore(), target = calculate7DayAverage();
    scoreTodayEl.textContent  = parseFloat(score.toFixed(1));
    scoreTargetEl.textContent = target;
    // Mark negative score in red so it doesn't silently sit at "0" visually.
    scoreTodayEl.classList.toggle('negative', score < 0);
    const pct = target > 0 ? Math.min((Math.max(0,score)/target)*100,100) : (score>0?100:0);
    scoreProgressEl.style.width = `${pct}%`;
    scoreProgressEl.setAttribute('aria-valuenow', Math.round(pct));

    // Streak
    const streak = calculateStreak();
    if (streak >= 2) {
        streakDisplayEl.innerHTML = `<span class="streak-fire">🔥 ${streak} Tage in Folge aktiv!</span>`;
    } else {
        streakDisplayEl.innerHTML = '';
    }

    if (score >= target && target > 0) {
        dashboardMsgEl.textContent = "🔥 Tagesziel erreicht! Stark!";
        dashboardMsgEl.style.color = "var(--success-color)";
        // Celebrate the first crossing of the target each logical day.
        const todayStr = getTodayString();
        if (lastCelebratedDay !== todayStr) {
            lastCelebratedDay = todayStr;
            celebrateTargetReached();
        }
    } else if (score >= target) {
        dashboardMsgEl.textContent = "Sammle Punkte, um einen Durchschnitt aufzubauen.";
        dashboardMsgEl.style.color = "var(--text-muted)";
    } else {
        dashboardMsgEl.textContent = `Noch ${(target - score).toFixed(1)} Punkte bis zum Ziel.`;
        dashboardMsgEl.style.color = "var(--text-muted)";
    }
}

// ─── Drag & Drop State ────────────────────────────────────────────────────────
// Using SortableJS

// ─── Task Rendering (sorted by category, drag-and-drop) ──────────────────────
function renderTasks() {
    // Destroy previous Sortable instances before wiping the DOM to prevent listener leak.
    while (sortableInstances.length) {
        const inst = sortableInstances.pop();
        try { inst.destroy(); } catch (_) { /* already detached */ }
    }
    taskListEl.innerHTML = '';
    const categories = [
        { key: 'todo',    label: '📌 ToDo',    cls: 'todo-header' },
        { key: 'routine', label: '🔁 Routine', cls: 'routine-header' },
        { key: 'dontdo',  label: '🚫 DontDo',  cls: 'dontdo-header' },
    ];

    const todayStr = getTodayString();
    const todayHistory = dailyHistory[todayStr] || { tasksDone: [] };
    const completedTaskIds = todayHistory.tasksDone.map(t => t.id);

    let hasAny = false;
    categories.forEach(cat => {
        const group = tasks.filter(t => (t.category || 'routine') === cat.key);
        if (!group.length) return;
        hasAny = true;

        const header = document.createElement('li');
        header.className = `task-category-header ${cat.cls}`;
        header.textContent = cat.label;
        taskListEl.appendChild(header);

        const listContainer = document.createElement('div');
        listContainer.className = 'task-group-container';
        listContainer.setAttribute('data-category', cat.key);
        taskListEl.appendChild(listContainer);

        group.forEach(task => {
            const isDontDo = cat.key === 'dontdo';
            const sign = isDontDo ? '−' : '+';
            const colorCls = isDontDo ? 'negative' : 'positive';
            const icon = isDontDo ? '✗' : '✓';
            
            let isDone = false;
            if (cat.key === 'todo' && task.done) isDone = true;
            if (task.isSimple && completedTaskIds.includes(task.id)) isDone = true;

            const li = document.createElement('div');
            li.className = `task-item ${cat.key}${isDone ? ' done' : ''}`;
            li.setAttribute('data-task-id', task.id);
            const nameSafe = escapeHtml(task.name);
            const unitSafe = escapeHtml(task.unit);
            const idSafe = escapeHtml(task.id);
            const actionLabel = isDontDo ? `${task.name} als gemacht eintragen (Minuspunkte)` : `${task.name} ausführen`;
            li.innerHTML = `
                <div class="task-info">
                    <h3>${nameSafe}</h3>
                    <span class="task-points ${colorCls}">${sign}${task.points} pro ${unitSafe}</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="btn-edit-task" data-edit-id="${idSafe}" title="Bearbeiten" aria-label="${escapeHtml(task.name)} bearbeiten">✏️</button>
                    ${!isDone ? `<button class="task-action" data-id="${idSafe}" title="Ausführen" aria-label="${escapeHtml(actionLabel)}">${icon}</button>` : '<span style="color:var(--success-color);font-size:1.2rem;" aria-label="erledigt">✔</span>'}
                    <button class="task-action delete-btn" data-delete-id="${idSafe}" title="Löschen" aria-label="${escapeHtml(task.name)} löschen" style="background:transparent;color:var(--text-muted);font-size:0.9rem;">🗑</button>
                </div>`;
            
            listContainer.appendChild(li);
        });

        // Initialize Sortable (instance tracked so it can be destroyed on re-render)
        if (window.Sortable) {
            sortableInstances.push(new Sortable(listContainer, {
                group: cat.key,
                animation: 150,
                delay: 800, // 800ms delay so scrolling works
                delayOnTouchOnly: true, // Only apply delay on touch devices
                onEnd: function (evt) {
                    const itemEl = evt.item;
                    const id = itemEl.getAttribute('data-task-id');
                    
                    // Rebuild tasks array based on new DOM order
                    const newTasksOrder = [];
                    // Keep original tasks order for other categories
                    tasks.forEach(t => {
                        if (t.category !== cat.key && t.category !== (cat.key === 'routine' ? undefined : 'routine')) {
                            newTasksOrder.push(t);
                        }
                    });
                    
                    // Add this category's tasks in new order
                    Array.from(listContainer.children).forEach(child => {
                        const taskId = child.getAttribute('data-task-id');
                        const taskObj = tasks.find(t => t.id === taskId);
                        if (taskObj) newTasksOrder.push(taskObj);
                    });
                    
                    tasks = newTasksOrder;
                    storage.set('tasks', tasks);
                }
            }));
        }
    });

    if (!hasAny) {
        taskListEl.innerHTML = '<li style="text-align:center;color:var(--text-muted);padding:20px;">Keine Aufgaben. Erstelle eine neue!</li>';
    }

    // Action listeners: open quantity modal instead of directly completing
    taskListEl.querySelectorAll('.task-action:not(.delete-btn)').forEach(btn => {
        btn.addEventListener('click', e => {
            const taskId = e.currentTarget.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            if (task.isSimple) {
                completeTask(task.id, 1);
            } else {
                openQuantityModal(task);
            }
        });
    });
    taskListEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            const id = e.currentTarget.getAttribute('data-delete-id');
            const task = tasks.find(t => t.id === id);
            const ok = await customConfirm(
                `"${task?.name ?? 'Aufgabe'}" wirklich löschen?`,
                { okLabel: 'Löschen', okClass: 'btn-primary danger' }
            );
            if (ok) deleteTask(id);
        });
    });
    taskListEl.querySelectorAll('.btn-edit-task').forEach(btn => {
        btn.addEventListener('click', e => openEditModal(e.currentTarget.getAttribute('data-edit-id')));
    });
}

function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('edit-task-id').value       = task.id;
    document.getElementById('edit-task-name').value     = task.name;
    document.getElementById('edit-task-points').value   = task.points;
    document.getElementById('edit-task-unit').value     = task.unit;
    document.getElementById('edit-task-category').value = task.category || 'routine';
    document.getElementById('edit-task-is-simple').checked = !!task.isSimple;
    document.getElementById('edit-group-is-simple').style.display = (task.category || 'routine') === 'routine' ? 'block' : 'none';
    openModal(editModal);
}

function openQuantityModal(task) {
    pendingTaskId = task.id;
    const isDontDo = task.category === 'dontdo';
    quantityTitle.textContent = task.name;
    quantitySubtitle.textContent = isDontDo
        ? `Wie oft hast du das gemacht? (−${task.points} pro ${task.unit})`
        : `Wie viele ${task.unit}? (+${task.points} pro ${task.unit})`;
    quantityLabel.textContent = `Anzahl (${task.unit})`;
    quantityInput.value = '1';
    openModal(quantityModal);
    quantityInput.focus();
    quantityInput.select();
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar() {
    calendarListEl.innerHTML = '';
    // Keys are zero-padded ISO strings (YYYY-MM-DD), so lexicographic order
    // is chronological — no Date parsing needed.
    const dates = Object.keys(dailyHistory).sort((a, b) => b.localeCompare(a));
    if (!dates.length) {
        calendarListEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Noch keine Historie.</div>';
        return;
    }
    dates.forEach(dateStr => {
        const day = dailyHistory[dateStr];
        const d = new Date(dateStr);
        const nice = d.toLocaleDateString('de-DE', {weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
        let tasksHtml = day.tasksDone?.length
            ? '<ul class="history-task-list">' + day.tasksDone.map(t => {
                const s = t.points > 0 ? '+' : '';
                const c = t.points > 0 ? 'var(--success-color)' : 'var(--danger-color)';
                return `<li class="history-task-item"><span>${escapeHtml(t.name)}</span><span style="color:${c}">${s}${t.points} Pkt</span></li>`;
            }).join('') + '</ul>'
            : '<p class="history-task-list">Keine Einträge.</p>';
        const div = document.createElement('div');
        div.className = 'history-day';
        div.innerHTML = `<div class="history-date"><span>${nice}</span><span>Gesamt: ${parseFloat(day.score.toFixed(1))} Pkt</span></div>${tasksHtml}`;
        calendarListEl.appendChild(div);
    });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function goHome() {
    trainingSection.classList.add('hidden');
    calendarModal.classList.add('hidden');
    customTrainingModal.classList.add('hidden');
    // Reset transient modal state so the quantity dialog doesn't reopen with
    // a stale pending task next time.
    quantityModal.classList.add('hidden');
    modal.classList.add('hidden');
    editModal.classList.add('hidden');
    pendingTaskId = null;
    formAddTask.reset();
    formEditTask.reset();
    mainView.classList.remove('hidden');
}

// Close the top-most visible modal on Escape. Iterates in reverse z-stack
// order (last-rendered confirm modal first) so nested confirms close before
// their parent dialogs.
function setupEscapeKeyHandler() {
    const modalIds = ['confirm-modal', 'quantity-modal', 'edit-task-modal', 'add-task-modal', 'custom-training-modal', 'calendar-modal'];
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        for (const id of modalIds) {
            const m = document.getElementById(id);
            if (m && !m.classList.contains('hidden')) {
                // Confirm modal manages its own cleanup via the cancel button.
                if (id === 'confirm-modal') {
                    document.getElementById('btn-confirm-cancel').click();
                } else {
                    closeModal(m);
                    if (id === 'quantity-modal') pendingTaskId = null;
                }
                e.preventDefault();
                return;
            }
        }
    });
}

function setupEventListeners() {
    logoHome.addEventListener('click', goHome);

    // Add Task
    document.getElementById('task-category').addEventListener('change', e => {
        document.getElementById('group-is-simple').style.display = e.target.value === 'routine' ? 'block' : 'none';
    });
    btnAddTask.addEventListener('click', () => {
        document.getElementById('task-category').value = 'routine';
        document.getElementById('group-is-simple').style.display = 'block';
        document.getElementById('task-is-simple').checked = false;
        openModal(modal);
    });
    const closeAdd = wireModalDismiss(modal, { cancelBtn: btnCancelTask, form: formAddTask });
    formAddTask.addEventListener('submit', e => {
        e.preventDefault();
        addTask(
            document.getElementById('task-name').value,
            document.getElementById('task-points').value,
            document.getElementById('task-unit').value,
            document.getElementById('task-category').value,
            document.getElementById('task-is-simple').checked
        );
        closeAdd();
    });

    // Edit Task
    document.getElementById('edit-task-category').addEventListener('change', e => {
        document.getElementById('edit-group-is-simple').style.display = e.target.value === 'routine' ? 'block' : 'none';
    });
    const closeEdit = wireModalDismiss(editModal, { cancelBtn: btnCancelEditTask });
    formEditTask.addEventListener('submit', e => {
        e.preventDefault();
        editTask(
            document.getElementById('edit-task-id').value,
            document.getElementById('edit-task-name').value,
            document.getElementById('edit-task-points').value,
            document.getElementById('edit-task-unit').value,
            document.getElementById('edit-task-category').value,
            document.getElementById('edit-task-is-simple').checked
        );
        closeEdit();
    });

    // Calendar
    btnCalendar.addEventListener('click', () => { renderCalendar(); openModal(calendarModal); });
    wireModalDismiss(calendarModal, { cancelBtn: btnCloseCalendar });

    // Quantity Modal
    const closeQty = wireModalDismiss(quantityModal, { cancelBtn: btnCancelQuantity, onClose: () => { pendingTaskId = null; } });
    quantityForm.addEventListener('submit', e => {
        e.preventDefault();
        if (!pendingTaskId) return;
        const qty = parseFloat(quantityInput.value);
        if (!isFinite(qty) || qty <= 0) {
            showToast('Bitte eine positive Zahl eingeben.');
            quantityInput.focus();
            quantityInput.select();
            return;
        }
        completeTask(pendingTaskId, qty);
        closeQty();
    });

    // Training
    btnTrainingMenu.addEventListener('click', () => {
        mainView.classList.add('hidden');
        trainingSection.classList.remove('hidden');
        trainingMenu.classList.remove('hidden');
        workoutView.classList.add('hidden');
    });
    btnCloseTraining.addEventListener('click', goHome);
    document.querySelectorAll('.btn-training-day').forEach(btn => {
        btn.addEventListener('click', async e => {
            currentWorkoutDayId = e.currentTarget.getAttribute('data-day');
            await Training.openWorkout(currentWorkoutDayId, customPlans, trainingHistory, workoutEls());
        });
    });
    btnFinishWorkout.addEventListener('click', async () => {
        if (!currentWorkoutDayId) return;
        const result = await Training.finishWorkout(currentWorkoutDayId, customPlans, trainingHistory, dailyHistory, workoutEls());
        updateDashboard();
        goHome();
        alert(`Stark! ${result.points.toFixed(1)} Punkte gesammelt! ${result.improvedExercises > 0 ? `(${result.improvedExercises}× Progression 🔥)` : ''}`);
    });

    // Custom Training
    btnCreateCustom.addEventListener('click', () => {
        customExercisesList.innerHTML = '';
        Training.addCustomExerciseRow(customExercisesList);
        openModal(customTrainingModal);
    });
    const closeCustom = wireModalDismiss(customTrainingModal, { cancelBtn: btnCancelCustom, form: formCustomTraining });
    btnAddCustomExercise.addEventListener('click', () => Training.addCustomExerciseRow(customExercisesList));
    formCustomTraining.addEventListener('submit', async e => {
        e.preventDefault();
        const plan = await Training.saveCustomPlan(
            document.getElementById('custom-name').value,
            document.getElementById('custom-factor').value,
            customExercisesList,
            customPlans
        );
        if (!plan) { showToast('Bitte füge mindestens eine Übung hinzu.'); return; }
        Training.renderCustomPlansMenu(customPlans, customPlansContainer, async id => {
            currentWorkoutDayId = id;
            await Training.openWorkout(id, customPlans, trainingHistory, workoutEls());
        });
        closeCustom();
    });
}

document.addEventListener('DOMContentLoaded', init);
