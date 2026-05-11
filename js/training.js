// js/training.js
import * as storage from './storage.js';

export const BUILT_IN_PLANS = {
    brust: {
        id: 'brust', name: 'Brust (Schulter, Trizeps)', factor: 50,
        exercises: [
            { id: 'lh_schraeg', name: 'LH Schrägbankdrücken', sets: 4, targetReps: 8 },
            { id: 'kh_flach', name: 'KH Flachbankdrücken', sets: 4, targetReps: 8 },
            { id: 'kabel_flys', name: 'Kabelzug Flys', sets: 3, targetReps: 12 },
            { id: 'lh_schulter', name: 'LH Schulterdrücken', sets: 4, targetReps: 8 },
            { id: 'kh_seitheben', name: 'KH Seitheben / Kabelzug', sets: 3, targetReps: 12 },
            { id: 'dips', name: 'Dips', sets: 3, targetReps: 8 },
            { id: 'kh_french', name: 'KH French Press', sets: 3, targetReps: 12 },
            { id: 'trizeps_kabel', name: 'Trizeps am Kabel', sets: 3, targetReps: 12 }
        ]
    },
    beine: {
        id: 'beine', name: 'Beine (Waden, Bauch)', factor: 50,
        exercises: [
            { id: 'kniebeugen', name: 'Kniebeugen', sets: 4, targetReps: 8 },
            { id: 'beinpresse', name: 'Beinpresse', sets: 4, targetReps: 8 },
            { id: 'beinstrecker', name: 'Beinstrecker', sets: 3, targetReps: 12 },
            { id: 'beinbeuger', name: 'Beinbeuger', sets: 3, targetReps: 12 },
            { id: 'waden_stehend', name: 'Wadenheben stehend', sets: 3, targetReps: 12 },
            { id: 'waden_sitzend', name: 'Wadenheben sitzend', sets: 3, targetReps: 12 },
            { id: 'haengend_beine', name: 'Hängend Beine Heben', sets: 4, targetReps: 12 },
            { id: 'sit_up', name: 'Sit up', sets: 4, targetReps: 12 },
            { id: 'mountain_climber', name: 'Slow Mountain Climber', sets: 4, targetReps: 12 }
        ]
    },
    ruecken: {
        id: 'ruecken', name: 'Rücken (Schulter hinten, Bizeps)', factor: 50,
        exercises: [
            { id: 'lat_breit', name: 'Latziehen breiter Griff zur Brust', sets: 4, targetReps: 8 },
            { id: 'lat_eng', name: 'Latziehen enger Griff', sets: 3, targetReps: 12 },
            { id: 'lh_rudern', name: 'LH Rudern Untergriff', sets: 4, targetReps: 8 },
            { id: 'rudern_kabel', name: 'Rudern sitzend am Kabel', sets: 3, targetReps: 12 },
            { id: 'lh_nacken', name: 'LH Nackenheben', sets: 4, targetReps: 8 },
            { id: 'kh_seitheben_vorgebeugt', name: 'KH Seitheben vorgebeugt', sets: 3, targetReps: 8 },
            { id: 'lh_curls_eng', name: 'LH Curls mit engem Griff', sets: 3, targetReps: 12 },
            { id: 'scott_curls', name: 'Scott-Curls SZ Stange', sets: 3, targetReps: 12 },
            { id: 'kh_hammer', name: 'KH Hammer Curls', sets: 3, targetReps: 12 }
        ]
    }
};

export function getPlan(id, customPlans) {
    if (BUILT_IN_PLANS[id]) return BUILT_IN_PLANS[id];
    return customPlans.find(p => p.id === id);
}

export function renderCustomPlansMenu(customPlans, container, onSelect) {
    container.innerHTML = '';
    customPlans.forEach(plan => {
        const btn = document.createElement('button');
        btn.className = 'btn-training-day';
        btn.innerHTML = `${plan.name}<span style="font-size:0.8rem;color:var(--text-muted);display:block;margin-top:5px;">${plan.exercises.length} Übungen (Faktor: ${plan.factor})</span>`;
        btn.addEventListener('click', () => onSelect(plan.id));
        container.appendChild(btn);
    });
}

export function openWorkout(dayId, customPlans, trainingHistory, els) {
    const plan = getPlan(dayId, customPlans);
    const { trainingMenu, workoutView, workoutTitle, workoutDateInput, workoutWarmupInput, workoutExercisesEl } = els;

    trainingMenu.classList.add('hidden');
    workoutView.classList.remove('hidden');
    workoutTitle.textContent = plan.name;

    const d = new Date();
    workoutDateInput.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    workoutWarmupInput.checked = false;
    workoutExercisesEl.innerHTML = '';

    const hist = trainingHistory[dayId];
    const lastWorkout = hist && hist.length > 0 ? hist[hist.length - 1] : null;

    plan.exercises.forEach(ex => {
        const targetReps = parseInt(ex.targetReps) || 8;
        let isDeload = false, isIncrease = false;

        if (lastWorkout?.states?.[ex.id]) {
            const s = lastWorkout.states[ex.id];
            if (s.achievedTarget && !s.wasDeload) isDeload = true;
            else if (s.wasDeload) isIncrease = true;
        }

        const setsCount = isDeload ? 2 : ex.sets;
        let hintsHtml = '';
        if (isDeload) hintsHtml = `<div class="deload-hint">🚨 <strong>Deload fällig!</strong> Nur <strong>2 Sätze × ${targetReps} Wdh</strong>, gleiches Gewicht.</div>`;
        else if (isIncrease) hintsHtml = `<div class="increase-hint">🔥 <strong>Zeit für mehr!</strong> Versuch +5% Gewicht für ${ex.sets}×${targetReps}.</div>`;

        const setsHtml = Array.from({ length: setsCount }).map((_, i) => {
            const lastSet = lastWorkout?.exercises?.[ex.id]?.[i];
            const lastKg = lastSet?.kg || '';
            const lastReps = lastSet?.reps || '';
            const suggestKg = isIncrease && lastKg > 0 ? Math.round(lastKg * 1.05 * 2) / 2 : lastKg;
            return `<div class="set-row">
                <span class="set-number">${i+1}.</span>
                <input type="number" step="0.5" class="set-input set-kg" placeholder="kg (alt: ${lastKg||'–'})" value="${suggestKg}">
                <input type="number" class="set-input set-reps" placeholder="Wdh (Ziel: ${lastReps||targetReps})">
            </div>`;
        }).join('');

        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.setAttribute('data-is-deload', isDeload ? 'true' : 'false');
        div.innerHTML = `
            <div class="exercise-header">
                <span class="exercise-title">${ex.name}</span>
                <span class="exercise-target">${setsCount}×${ex.targetReps} Wdh</span>
            </div>
            ${hintsHtml}
            <p class="placeholder-hint">Werte vom letzten Mal sind als Platzhalter hinterlegt.</p>
            <div class="exercise-sets" data-ex-id="${ex.id}" data-target-sets="${ex.sets}" data-target-reps="${targetReps}">
                ${setsHtml}
            </div>`;
        workoutExercisesEl.appendChild(div);
    });
}

export function finishWorkout(dayId, customPlans, trainingHistory, dailyHistory, els) {
    const plan = getPlan(dayId, customPlans);
    const { workoutDateInput, workoutWarmupInput, workoutExercisesEl } = els;
    const dateStr = workoutDateInput.value;
    const factor = plan.factor || 50;

    const hist = trainingHistory[dayId];
    const lastWorkout = hist && hist.length > 0 ? hist[hist.length - 1] : null;

    let points = workoutWarmupInput.checked ? 10 : 0;
    let improvedExercises = 0;
    const newWorkoutData = { date: dateStr, exercises: {}, states: {} };

    workoutExercisesEl.querySelectorAll('.exercise-card').forEach(card => {
        const setContainer = card.querySelector('.exercise-sets');
        const exId = setContainer.getAttribute('data-ex-id');
        const targetSets = parseInt(setContainer.getAttribute('data-target-sets'));
        const targetReps = parseInt(setContainer.getAttribute('data-target-reps'));
        const wasDeloadUI = card.getAttribute('data-is-deload') === 'true';

        newWorkoutData.exercises[exId] = [];
        let curVolume = 0, lastVolume = 0, achievedAll = true, setsDone = 0;

        setContainer.querySelectorAll('.set-row').forEach((row, idx) => {
            const kg = parseFloat(row.querySelector('.set-kg').value) || 0;
            const reps = parseInt(row.querySelector('.set-reps').value) || 0;
            if (reps > 0) setsDone++;
            if (reps < targetReps) achievedAll = false;
            newWorkoutData.exercises[exId].push({ kg, reps });
            points += reps * (1 + (kg / factor));
            curVolume += (kg > 0 ? kg : 1) * reps;
            const lset = lastWorkout?.exercises?.[exId]?.[idx];
            if (lset) lastVolume += (lset.kg > 0 ? lset.kg : 1) * lset.reps;
        });

        if (setsDone < targetSets && !wasDeloadUI) achievedAll = false;
        newWorkoutData.states[exId] = { achievedTarget: achievedAll && !wasDeloadUI, wasDeload: wasDeloadUI };
        if (lastWorkout && curVolume > lastVolume && curVolume > 0 && !wasDeloadUI) improvedExercises++;
    });

    points += improvedExercises * 20;

    if (!trainingHistory[dayId]) trainingHistory[dayId] = [];
    trainingHistory[dayId].push(newWorkoutData);
    storage.set('trainingHistory', trainingHistory);

    if (!dailyHistory[dateStr]) dailyHistory[dateStr] = { score: 0, tasksDone: [] };
    dailyHistory[dateStr].score += points;
    dailyHistory[dateStr].tasksDone.push({
        id: 'workout_' + Date.now(),
        name: `🏋️ ${plan.name}`,
        timestamp: Date.now(),
        points: parseFloat(points.toFixed(1)),
        unit: improvedExercises > 0 ? `(${improvedExercises} Progressionen! 🔥)` : 'Basis'
    });
    storage.set('dailyHistory', dailyHistory);

    return { points, improvedExercises };
}

export function addCustomExerciseRow(container) {
    const row = document.createElement('div');
    row.className = 'custom-exercise-row';
    row.innerHTML = `
        <input type="text" placeholder="Name (z.B. Curls)" class="cx-name" required>
        <input type="number" placeholder="Sätze" class="cx-sets small-input" required min="1" max="10" value="3">
        <input type="number" placeholder="Wdh" class="cx-reps small-input" required min="1" value="12">
        <button type="button" class="btn-remove-ex">✕</button>`;
    row.querySelector('.btn-remove-ex').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

export function saveCustomPlan(name, factor, exercisesList, customPlans) {
    const exercises = [];
    exercisesList.querySelectorAll('.custom-exercise-row').forEach((row, i) => {
        const n = row.querySelector('.cx-name').value;
        const s = parseInt(row.querySelector('.cx-sets').value);
        const r = parseInt(row.querySelector('.cx-reps').value);
        if (n && s && r) exercises.push({ id: 'cx_' + Date.now() + '_' + i, name: n, sets: s, targetReps: r });
    });
    if (!exercises.length) return null;
    const plan = { id: 'custom_' + Date.now(), name, factor: parseInt(factor) || 50, exercises };
    customPlans.push(plan);
    storage.set('customPlans', customPlans);
    return plan;
}
