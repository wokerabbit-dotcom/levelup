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
    tasks          = await storage.get('tasks', []);
    dailyHistory   = await storage.get('dailyHistory', {});
    trainingHistory= await storage.get('trainingHistory', {});
    customPlans    = await storage.get('customPlans', []);

    // Seed default tasks on first run
    if (tasks.length === 0) {
        tasks = DEFAULT_TASKS.map((t, i) => ({ ...t, id: 'default_' + i }));
        await storage.set('tasks', tasks);
    }

    checkMonthlyReset();
    updateDashboard();
    renderTasks();
    Training.renderCustomPlansMenu(customPlans, customPlansContainer, (id) => {
        currentWorkoutDayId = id;
        Training.openWorkout(id, customPlans, trainingHistory, workoutEls());
    });
    setupEventListeners();

    const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    currentMonthEl.textContent = months[new Date().getMonth()];
}

function workoutEls() {
    return { trainingMenu, workoutView, workoutTitle, workoutDateInput, workoutWarmupInput, workoutExercisesEl };
}

// ─── Core Logic ───────────────────────────────────────────────────────────────
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function checkMonthlyReset() {
    // We no longer delete dailyHistory. Instead, calculate7DayAverage
    // only considers days within the current month, so the target
    // naturally resets to 0 at the start of each month.
    // The calendar keeps showing all past entries.
}

function calculate7DayAverage() {
    const today = new Date(); today.setHours(0,0,0,0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let total = 0, count = 0;
    for (let i = 1; i <= 7; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        // Only count days within the current month (monthly reset)
        if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (dailyHistory[key]) { total += dailyHistory[key].score; count++; }
    }
    return count === 0 ? 0 : Math.round(total / count);
}

function getTodayScore() {
    return dailyHistory[getTodayString()]?.score || 0;
}

function calculateStreak() {
    const today = new Date(); today.setHours(0,0,0,0);
    let streak = 0;
    // Check today first
    const todayStr = getTodayString();
    const todayData = dailyHistory[todayStr];
    if (todayData && todayData.score > 0) streak = 1;
    // Then go backwards from yesterday
    for (let i = 1; i <= 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (dailyHistory[key] && dailyHistory[key].score > 0) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

// ─── Task Operations ──────────────────────────────────────────────────────────
function addTask(name, points, unit, category) {
    const task = { id: Date.now().toString(), name, points: parseFloat(points), unit: unit || 'Ausführung', category: category || 'routine' };
    tasks.push(task);
    storage.set('tasks', tasks);
    renderTasks();
}

function editTask(id, name, points, unit, category) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], name, points: parseFloat(points), unit, category };
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
    const totalPts = basePts * quantity;
    dailyHistory[todayStr].score += totalPts;
    dailyHistory[todayStr].tasksDone.push({
        id: task.id, name: task.name, timestamp: Date.now(),
        points: parseFloat(totalPts.toFixed(2)),
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
    const pct = target > 0 ? Math.min((Math.max(0,score)/target)*100,100) : (score>0?100:0);
    scoreProgressEl.style.width = `${pct}%`;

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
    } else if (score >= target) {
        dashboardMsgEl.textContent = "Sammle Punkte, um einen Durchschnitt aufzubauen.";
        dashboardMsgEl.style.color = "var(--text-muted)";
    } else {
        dashboardMsgEl.textContent = `Noch ${(target - score).toFixed(1)} Punkte bis zum Ziel.`;
        dashboardMsgEl.style.color = "var(--text-muted)";
    }
}

// ─── Drag & Drop State ────────────────────────────────────────────────────────
let draggedTaskId = null;
let draggedCategory = null;

// ─── Task Rendering (sorted by category, drag-and-drop) ──────────────────────
function renderTasks() {
    taskListEl.innerHTML = '';
    const categories = [
        { key: 'todo',    label: '📌 ToDo',    cls: 'todo-header' },
        { key: 'routine', label: '🔁 Routine', cls: 'routine-header' },
        { key: 'dontdo',  label: '🚫 DontDo',  cls: 'dontdo-header' },
    ];

    let hasAny = false;
    categories.forEach(cat => {
        const group = tasks.filter(t => (t.category || 'routine') === cat.key);
        if (!group.length) return;
        hasAny = true;

        const header = document.createElement('li');
        header.className = `task-category-header ${cat.cls}`;
        header.textContent = cat.label;
        taskListEl.appendChild(header);

        group.forEach(task => {
            const isDontDo = cat.key === 'dontdo';
            const sign = isDontDo ? '−' : '+';
            const colorCls = isDontDo ? 'negative' : 'positive';
            const icon = isDontDo ? '✗' : '✓';
            const isDone = cat.key === 'todo' && task.done;

            const li = document.createElement('li');
            li.className = `task-item ${cat.key}${isDone ? ' done' : ''}`;
            li.setAttribute('draggable', 'true');
            li.setAttribute('data-task-id', task.id);
            li.setAttribute('data-task-cat', cat.key);
            li.innerHTML = `
                <div class="task-info">
                    <h3>${task.name}</h3>
                    <span class="task-points ${colorCls}">${sign}${task.points} pro ${task.unit}</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="btn-edit-task" data-edit-id="${task.id}" title="Bearbeiten">✏️</button>
                    ${!isDone ? `<button class="task-action" data-id="${task.id}" title="Ausführen">${icon}</button>` : '<span style="color:var(--success-color);font-size:1.2rem;">✔</span>'}
                    <button class="task-action delete-btn" data-delete-id="${task.id}" title="Löschen" style="background:transparent;color:var(--text-muted);font-size:0.9rem;">🗑</button>
                </div>`;

            // Drag events
            li.addEventListener('dragstart', e => {
                draggedTaskId = task.id;
                draggedCategory = cat.key;
                li.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
                draggedTaskId = null;
                draggedCategory = null;
                taskListEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
            li.addEventListener('dragover', e => {
                e.preventDefault();
                const targetCat = li.getAttribute('data-task-cat');
                if (targetCat !== draggedCategory) return;
                e.dataTransfer.dropEffect = 'move';
                li.classList.add('drag-over');
            });
            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over');
            });
            li.addEventListener('drop', e => {
                e.preventDefault();
                li.classList.remove('drag-over');
                const targetId = li.getAttribute('data-task-id');
                const targetCat = li.getAttribute('data-task-cat');
                if (!draggedTaskId || draggedTaskId === targetId || targetCat !== draggedCategory) return;
                reorderTask(draggedTaskId, targetId);
            });

            taskListEl.appendChild(li);
        });
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
            openQuantityModal(task);
        });
    });
    taskListEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            if (confirm('Aufgabe löschen?')) deleteTask(e.currentTarget.getAttribute('data-delete-id'));
        });
    });
    taskListEl.querySelectorAll('.btn-edit-task').forEach(btn => {
        btn.addEventListener('click', e => openEditModal(e.currentTarget.getAttribute('data-edit-id')));
    });
}

function reorderTask(draggedId, targetId) {
    const fromIdx = tasks.findIndex(t => t.id === draggedId);
    const toIdx = tasks.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(toIdx, 0, moved);
    storage.set('tasks', tasks);
    renderTasks();
}

function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('edit-task-id').value       = task.id;
    document.getElementById('edit-task-name').value     = task.name;
    document.getElementById('edit-task-points').value   = task.points;
    document.getElementById('edit-task-unit').value     = task.unit;
    document.getElementById('edit-task-category').value = task.category || 'routine';
    editModal.classList.remove('hidden');
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
    quantityModal.classList.remove('hidden');
    quantityInput.focus();
    quantityInput.select();
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar() {
    calendarListEl.innerHTML = '';
    const dates = Object.keys(dailyHistory).sort((a,b) => new Date(b)-new Date(a));
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
                return `<li class="history-task-item"><span>${t.name}</span><span style="color:${c}">${s}${t.points} Pkt</span></li>`;
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
    mainView.classList.remove('hidden');
}

function setupEventListeners() {
    logoHome.addEventListener('click', goHome);

    // Add Task
    btnAddTask.addEventListener('click', () => modal.classList.remove('hidden'));
    btnCancelTask.addEventListener('click', () => { modal.classList.add('hidden'); formAddTask.reset(); });
    modal.addEventListener('click', e => { if (e.target===modal) { modal.classList.add('hidden'); formAddTask.reset(); } });
    formAddTask.addEventListener('submit', e => {
        e.preventDefault();
        addTask(
            document.getElementById('task-name').value,
            document.getElementById('task-points').value,
            document.getElementById('task-unit').value,
            document.getElementById('task-category').value
        );
        modal.classList.add('hidden'); formAddTask.reset();
    });

    // Edit Task
    btnCancelEditTask.addEventListener('click', () => editModal.classList.add('hidden'));
    editModal.addEventListener('click', e => { if (e.target===editModal) editModal.classList.add('hidden'); });
    formEditTask.addEventListener('submit', e => {
        e.preventDefault();
        editTask(
            document.getElementById('edit-task-id').value,
            document.getElementById('edit-task-name').value,
            document.getElementById('edit-task-points').value,
            document.getElementById('edit-task-unit').value,
            document.getElementById('edit-task-category').value
        );
        editModal.classList.add('hidden');
    });

    // Calendar
    btnCalendar.addEventListener('click', () => { renderCalendar(); calendarModal.classList.remove('hidden'); });
    btnCloseCalendar.addEventListener('click', () => calendarModal.classList.add('hidden'));
    calendarModal.addEventListener('click', e => { if (e.target===calendarModal) calendarModal.classList.add('hidden'); });

    // Quantity Modal
    btnCancelQuantity.addEventListener('click', () => { quantityModal.classList.add('hidden'); pendingTaskId = null; });
    quantityModal.addEventListener('click', e => { if (e.target===quantityModal) { quantityModal.classList.add('hidden'); pendingTaskId = null; } });
    quantityForm.addEventListener('submit', e => {
        e.preventDefault();
        if (!pendingTaskId) return;
        const qty = parseFloat(quantityInput.value) || 1;
        completeTask(pendingTaskId, qty);
        quantityModal.classList.add('hidden');
        pendingTaskId = null;
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
        btn.addEventListener('click', e => {
            currentWorkoutDayId = e.currentTarget.getAttribute('data-day');
            Training.openWorkout(currentWorkoutDayId, customPlans, trainingHistory, workoutEls());
        });
    });
    btnFinishWorkout.addEventListener('click', () => {
        if (!currentWorkoutDayId) return;
        const result = Training.finishWorkout(currentWorkoutDayId, customPlans, trainingHistory, dailyHistory, workoutEls());
        updateDashboard();
        goHome();
        alert(`Stark! ${result.points.toFixed(1)} Punkte gesammelt! ${result.improvedExercises > 0 ? `(${result.improvedExercises}× Progression 🔥)` : ''}`);
    });

    // Custom Training
    btnCreateCustom.addEventListener('click', () => {
        customExercisesList.innerHTML = '';
        Training.addCustomExerciseRow(customExercisesList);
        customTrainingModal.classList.remove('hidden');
    });
    btnCancelCustom.addEventListener('click', () => { customTrainingModal.classList.add('hidden'); formCustomTraining.reset(); });
    btnAddCustomExercise.addEventListener('click', () => Training.addCustomExerciseRow(customExercisesList));
    formCustomTraining.addEventListener('submit', e => {
        e.preventDefault();
        const plan = Training.saveCustomPlan(
            document.getElementById('custom-name').value,
            document.getElementById('custom-factor').value,
            customExercisesList,
            customPlans
        );
        if (!plan) { alert('Bitte füge mindestens eine Übung hinzu.'); return; }
        Training.renderCustomPlansMenu(customPlans, customPlansContainer, id => {
            currentWorkoutDayId = id;
            Training.openWorkout(id, customPlans, trainingHistory, workoutEls());
        });
        customTrainingModal.classList.add('hidden'); formCustomTraining.reset();
    });
}

document.addEventListener('DOMContentLoaded', init);
