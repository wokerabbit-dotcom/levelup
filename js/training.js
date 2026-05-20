// js/training.js
import * as storage from './storage.js';

// ─── Built-in Plans ───────────────────────────────────────────────────────────
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

// ─── Exercise Library (global pool) ──────────────────────────────────────────
// Each entry: { id, name, sets, targetReps, description }
// This is seeded from BUILT_IN_PLANS and grows when users create custom exercises.

export async function getExerciseLibrary() {
    let lib = await storage.get('exerciseLibrary', null);
    if (!lib) {
        lib = {};
        // Seed from built-in plans
        Object.values(BUILT_IN_PLANS).forEach(plan => {
            plan.exercises.forEach(ex => {
                lib[ex.id] = { id: ex.id, name: ex.name, sets: ex.sets, targetReps: ex.targetReps, description: '', isAssisted: false };
            });
        });
        await storage.set('exerciseLibrary', lib);
    } else {
        // Backfill isAssisted on legacy entries that predate the flag.
        let mutated = false;
        for (const id in lib) {
            if (lib[id] && typeof lib[id].isAssisted !== 'boolean') {
                lib[id].isAssisted = false;
                mutated = true;
            }
        }
        if (mutated) await storage.set('exerciseLibrary', lib);
    }
    return lib;
}

export async function saveExerciseToLibrary(exercise) {
    const lib = await getExerciseLibrary();
    lib[exercise.id] = {
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        targetReps: exercise.targetReps,
        description: exercise.description || '',
        isAssisted: !!exercise.isAssisted,
    };
    await storage.set('exerciseLibrary', lib);
    return lib;
}

// Toggle the assistive flag on an existing exercise. Used by the in-card
// checkbox so the change persists without reopening the workout.
export async function setExerciseAssisted(exId, isAssisted) {
    const lib = await getExerciseLibrary();
    if (!lib[exId]) return lib;
    lib[exId].isAssisted = !!isAssisted;
    await storage.set('exerciseLibrary', lib);
    return lib;
}

// ─── Per-Exercise Last Values ────────────────────────────────────────────────
// Stored as: { [exerciseId]: { sets: [ {kg, reps}, ... ], comment: '' } }
export async function getExerciseLastValues() {
    return await storage.get('exerciseLastValues', {});
}

export async function saveExerciseLastValues(exId, setsData, comment) {
    const vals = await getExerciseLastValues();
    vals[exId] = { sets: setsData, comment: comment || '' };
    await storage.set('exerciseLastValues', vals);
}

// ─── Plan Overrides (exercise swaps per plan) ────────────────────────────────
// Stored as: { [planId]: { [slotIndex]: exerciseId } }
export async function getPlanOverrides() {
    return await storage.get('planOverrides', {});
}

export async function savePlanOverride(planId, slotIndex, exerciseId) {
    const overrides = await getPlanOverrides();
    if (!overrides[planId]) overrides[planId] = {};
    overrides[planId][slotIndex] = exerciseId;
    await storage.set('planOverrides', overrides);
}

// ─── Workout Drafts (autosave during a workout) ──────────────────────────────
// Stored as: { [planId]: { dateStr, savedAt, warmup, warmupText, sets: { [exId]: [{kg, reps}, ...] }, comments: { [exId]: str }, descriptions: { [exId]: str } } }
// A draft is cleared after a successful finishWorkout. If the user reloads
// mid-workout (or the SW updates), openWorkout restores the draft.
export async function getWorkoutDraft(planId) {
    const all = await storage.get('workoutDrafts', {});
    return all[planId] || null;
}

export async function saveWorkoutDraft(planId, draft) {
    const all = await storage.get('workoutDrafts', {});
    all[planId] = { ...draft, savedAt: Date.now() };
    await storage.set('workoutDrafts', all);
}

export async function clearWorkoutDraft(planId) {
    const all = await storage.get('workoutDrafts', {});
    if (!(planId in all)) return;
    delete all[planId];
    await storage.set('workoutDrafts', all);
}

// Reads the current workout DOM and serializes it into a draft object.
// Lives near the storage helpers so the schema stays in one place.
function snapshotWorkoutDraft(els) {
    const { workoutDateInput, workoutWarmupInput, workoutWarmupText, workoutExercisesEl } = els;
    const draft = {
        dateStr: workoutDateInput.value,
        warmup: workoutWarmupInput.checked,
        warmupText: workoutWarmupText.value,
        sets: {},
        comments: {},
        descriptions: {},
    };
    workoutExercisesEl.querySelectorAll('.exercise-card').forEach(card => {
        const setContainer = card.querySelector('.exercise-sets');
        if (!setContainer) return;
        const exId = setContainer.getAttribute('data-ex-id');
        const sets = [];
        setContainer.querySelectorAll('.set-row').forEach(row => {
            const kgRaw = row.querySelector('.set-kg').value;
            const repsRaw = row.querySelector('.set-reps').value;
            sets.push({ kg: kgRaw, reps: repsRaw });
        });
        draft.sets[exId] = sets;
        const commentEl = card.querySelector('.exercise-comment');
        const descEl = card.querySelector('.exercise-description');
        if (commentEl) draft.comments[exId] = commentEl.value;
        if (descEl) draft.descriptions[exId] = descEl.value;
    });
    return draft;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

export async function getResolvedPlan(id, customPlans) {
    let basePlan = BUILT_IN_PLANS[id] || customPlans.find(p => p.id === id);
    if (!basePlan) return null;
    let plan = JSON.parse(JSON.stringify(basePlan));
    
    if (BUILT_IN_PLANS[id]) {
        const modified = await storage.get('modifiedBuiltInPlans', {});
        if (modified[id]) {
            plan.exercises = modified[id];
            return plan;
        }
    } else {
        const p = customPlans.find(p => p.id === id);
        if (p) plan = JSON.parse(JSON.stringify(p));
    }
    
    // Apply legacy overrides if no modified array
    const overrides = await storage.get('planOverrides', {});
    const planOverrides = overrides[id] || {};
    plan.exercises = plan.exercises.map((ex, i) => {
        return planOverrides[i] ? { ...ex, id: planOverrides[i] } : ex;
    });
    return plan;
}

export async function savePlanExercises(planId, exercises, customPlans) {
    if (BUILT_IN_PLANS[planId]) {
        const modified = await storage.get('modifiedBuiltInPlans', {});
        modified[planId] = exercises;
        await storage.set('modifiedBuiltInPlans', modified);
    } else {
        const idx = customPlans.findIndex(p => p.id === planId);
        if (idx !== -1) {
            customPlans[idx].exercises = exercises;
            await storage.set('customPlans', customPlans);
        }
    }
}

// Renders the custom-plan list. `onDelete(planId)` is optional; when provided,
// each plan row gets a 🗑 button that calls it after a stilkonform confirm.
export function renderCustomPlansMenu(customPlans, container, onSelect, onDelete) {
    container.innerHTML = '';
    customPlans.forEach(plan => {
        const row = document.createElement('div');
        row.className = 'custom-plan-row';
        const safeName = String(plan.name ?? '').replace(/[<>&"']/g, c => (
            { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]
        ));
        row.innerHTML = `
            <button type="button" class="btn-training-day">
                ${safeName}
                <span style="font-size:0.8rem;color:var(--text-muted);display:block;margin-top:5px;">${plan.exercises.length} Übungen (Faktor: ${plan.factor})</span>
            </button>
            ${onDelete ? `<button type="button" class="btn-custom-plan-action danger" title="Plan löschen" aria-label="Plan ${safeName} löschen">🗑</button>` : ''}
        `;
        row.querySelector('.btn-training-day').addEventListener('click', () => onSelect(plan.id));
        if (onDelete) {
            row.querySelector('.btn-custom-plan-action.danger').addEventListener('click', () => onDelete(plan.id));
        }
        container.appendChild(row);
    });
}

// ─── Open Workout (with dropdown swap, description, comment) ─────────────────
export async function openWorkout(dayId, customPlans, trainingHistory, els) {
    const plan = await getResolvedPlan(dayId, customPlans);
    const { trainingMenu, workoutView, workoutTitle, workoutDateInput, workoutWarmupInput, workoutWarmupText, workoutExercisesEl } = els;

    trainingMenu.classList.add('hidden');
    workoutView.classList.remove('hidden');
    workoutTitle.textContent = plan.name;

    const d = new Date();
    d.setHours(d.getHours() - 3);
    const todayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    workoutDateInput.value = todayKey;
    // Prevent future-dated workouts entirely.
    workoutDateInput.max = todayKey;
    workoutWarmupInput.checked = false;
    workoutWarmupText.value = await storage.get('warmupText', "Stepper/Fahrrad/Ruderergometer + World's greatest Stretch, Open Book, Handwalks, Gelenke, Prayer Stretch, Shoulder Blades.");
    workoutExercisesEl.innerHTML = '';

    const exerciseLib = await getExerciseLibrary();
    const lastValues = await getExerciseLastValues();

    // Training history for deload/increase logic (per-plan)
    const hist = trainingHistory[dayId];
    const lastWorkout = hist && hist.length > 0 ? hist[hist.length - 1] : null;

    plan.exercises.forEach((exItem, slotIndex) => {
        const activeExId = exItem.id;
        const libEntry = exerciseLib[activeExId];
        const ex = libEntry ? { ...exItem, id: libEntry.id, name: libEntry.name, sets: exItem.sets || libEntry.sets, targetReps: exItem.targetReps || libEntry.targetReps, description: libEntry.description || '', isAssisted: !!libEntry.isAssisted } : exItem;
        const isAssisted = !!ex.isAssisted;

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

        // Get last values — prefer per-exercise global store, fallback to plan history
        const exLastValues = lastValues[ex.id];
        const lastComment = exLastValues?.comment || '';

        const kgLabel = isAssisted ? 'Assist (kg)' : 'kg';
        const setsHtml = Array.from({ length: setsCount }).map((_, i) => {
            // Try global last values first, then plan history
            const globalLastSet = exLastValues?.sets?.[i];
            const histLastSet = lastWorkout?.exercises?.[ex.id]?.[i];
            const lastSet = globalLastSet || histLastSet;
            const lastKg = lastSet?.kg || '';
            const lastReps = lastSet?.reps || '';
            // Progression suggestion: more weight for normal, less assist for assistive.
            let suggestKg = lastKg;
            if (isIncrease && lastKg !== '' && Number.isFinite(parseFloat(lastKg))) {
                const v = parseFloat(lastKg);
                suggestKg = isAssisted
                    ? Math.max(0, Math.round(v * 0.95 * 2) / 2)
                    : Math.round(v * 1.05 * 2) / 2;
            }
            return `<div class="set-row">
                <span class="set-number">${i+1}.</span>
                <input type="number" class="set-input set-reps" placeholder="Wdh (z.B. ${lastReps||targetReps})" value="">
                <input type="number" step="0.5" class="set-input set-kg" placeholder="${kgLabel} (z.B. ${lastKg||0})" value="${suggestKg}">
            </div>`;
        }).join('');

        // Build dropdown options from exercise library
        const libEntries = Object.values(exerciseLib).sort((a,b) => a.name.localeCompare(b.name));
        const optionsHtml = libEntries.map(le =>
            `<option value="${le.id}" ${le.id === ex.id ? 'selected' : ''}>${le.name}</option>`
        ).join('');

        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.setAttribute('data-is-deload', isDeload ? 'true' : 'false');
        div.setAttribute('data-slot-index', slotIndex);
        div.innerHTML = `
            <div class="exercise-header">
                <div class="exercise-select-wrapper">
                    <select class="exercise-dropdown" data-slot-index="${slotIndex}" data-original-id="${ex.id}">
                        ${optionsHtml}
                        <option value="__new__">＋ Neue Übung anlegen...</option>
                    </select>
                </div>
                <div style="display:flex; align-items:center; gap: 8px;">
                    <span class="exercise-target">${setsCount} Sätze x ${ex.targetReps} Wdh</span>
                    <button class="btn-remove-ex-slot" data-slot="${slotIndex}" style="background:transparent;border:none;color:var(--danger-color);font-size:1.1rem;cursor:pointer;padding:0;" title="Übung entfernen">🗑</button>
                </div>
            </div>
            ${hintsHtml}
            ${isAssisted ? `<div class="assist-hint">⚖️ Gegengewicht-Übung — weniger Assist-kg bringt mehr Punkte.</div>` : ''}
            <div class="exercise-meta-section">
                <details class="exercise-details">
                    <summary class="exercise-details-summary">📋 Beschreibung & Notizen</summary>
                    <div class="exercise-details-content">
                        <div class="exercise-meta-field">
                            <label>Beschreibung / Video-Link</label>
                            <textarea class="exercise-description" placeholder="z.B. YouTube-Link oder Ausführungshinweise..." rows="2">${ex.description || ''}</textarea>
                        </div>
                        <div class="exercise-meta-field">
                            <label>Kommentar / Notizen</label>
                            <textarea class="exercise-comment" placeholder="z.B. 'Grip etwas breiter', 'Schulter zwickt'..." rows="2">${lastComment}</textarea>
                        </div>
                        <div class="exercise-meta-field">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; text-transform:none; letter-spacing:0;">
                                <input type="checkbox" class="exercise-assist-toggle" ${isAssisted ? 'checked' : ''} style="width:18px; height:18px;">
                                <span>Gegengewicht-Übung (z. B. Dips/Klimmzüge an der Assist-Maschine)</span>
                            </label>
                        </div>
                    </div>
                </details>
            </div>
            <div class="exercise-sets" data-ex-id="${ex.id}" data-target-sets="${ex.sets}" data-target-reps="${targetReps}" data-is-assisted="${isAssisted ? 'true' : 'false'}">
                ${setsHtml}
            </div>`;
        workoutExercisesEl.appendChild(div);

        // ─── Dropdown change handler ─────────────────────────────────────
        const dropdown = div.querySelector('.exercise-dropdown');
        dropdown.addEventListener('change', async (e) => {
            const selectedId = e.target.value;
            if (selectedId === '__new__') {
                showNewExerciseModal(dayId, slotIndex, dropdown, exerciseLib, customPlans, trainingHistory, els);
                return;
            }
            plan.exercises[slotIndex] = { ...plan.exercises[slotIndex], id: selectedId };
            await savePlanExercises(dayId, plan.exercises, customPlans);
            await openWorkout(dayId, customPlans, trainingHistory, els);
        });

        div.querySelector('.btn-remove-ex-slot').addEventListener('click', async () => {
            if (confirm('Diese Übung aus dem Plan entfernen?')) {
                plan.exercises.splice(slotIndex, 1);
                await savePlanExercises(dayId, plan.exercises, customPlans);
                await openWorkout(dayId, customPlans, trainingHistory, els);
            }
        });

        // Persist the assistive flag on toggle and re-render so the kg
        // placeholder / hint banner update immediately.
        const assistToggle = div.querySelector('.exercise-assist-toggle');
        if (assistToggle) {
            assistToggle.addEventListener('change', async (e) => {
                await setExerciseAssisted(ex.id, e.target.checked);
                await openWorkout(dayId, customPlans, trainingHistory, els);
            });
        }
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-secondary';
    addBtn.style.cssText = 'width: 100%; margin-top: 15px; border-style: dashed; font-size: 0.9rem;';
    addBtn.textContent = '+ Übung hinzufügen';
    addBtn.addEventListener('click', async () => {
        showNewExerciseModal(dayId, plan.exercises.length, null, exerciseLib, customPlans, trainingHistory, els);
    });
    workoutExercisesEl.appendChild(addBtn);

    if (window.Sortable) {
        new Sortable(workoutExercisesEl, {
            animation: 150,
            draggable: '.exercise-card',
            delay: 800, // 800ms delay for touch
            delayOnTouchOnly: true,
            onEnd: async function () {
                const newExercises = [];
                Array.from(workoutExercisesEl.querySelectorAll('.exercise-card')).forEach(card => {
                    const slot = parseInt(card.getAttribute('data-slot-index'));
                    newExercises.push(plan.exercises[slot]);
                });
                await savePlanExercises(dayId, newExercises, customPlans);
                await openWorkout(dayId, customPlans, trainingHistory, els);
            }
        });
    }

    // ─── Draft restore + autosave ────────────────────────────────────────
    // Restore previous draft for this plan (if any). The draft wins over
    // last-values / lastWorkout suggestions because it represents the user's
    // current, unfinished workout.
    const draft = await getWorkoutDraft(dayId);
    if (draft) {
        if (draft.dateStr && draft.dateStr <= todayKey) workoutDateInput.value = draft.dateStr;
        if (typeof draft.warmup === 'boolean') workoutWarmupInput.checked = draft.warmup;
        if (typeof draft.warmupText === 'string') workoutWarmupText.value = draft.warmupText;
        workoutExercisesEl.querySelectorAll('.exercise-card').forEach(card => {
            const setContainer = card.querySelector('.exercise-sets');
            if (!setContainer) return;
            const exId = setContainer.getAttribute('data-ex-id');
            const draftSets = draft.sets?.[exId];
            if (Array.isArray(draftSets)) {
                setContainer.querySelectorAll('.set-row').forEach((row, i) => {
                    const ds = draftSets[i];
                    if (!ds) return;
                    // Empty strings are valid (the user might have cleared the
                    // pre-filled kg from a previous workout intentionally).
                    if (ds.kg !== undefined) row.querySelector('.set-kg').value = ds.kg;
                    if (ds.reps !== undefined) row.querySelector('.set-reps').value = ds.reps;
                });
            }
            const commentEl = card.querySelector('.exercise-comment');
            const descEl = card.querySelector('.exercise-description');
            if (commentEl && draft.comments && exId in draft.comments) commentEl.value = draft.comments[exId];
            if (descEl && draft.descriptions && exId in draft.descriptions) descEl.value = draft.descriptions[exId];
        });
        showDraftStatus(els, `Entwurf wiederhergestellt (${formatDraftTime(draft.savedAt)})`);
    }

    // Debounced autosave on any input/change in the workout view. 400 ms is
    // long enough to batch fast typing on the comment field, short enough
    // to feel responsive on the set inputs.
    let saveTimer = null;
    let saveSeq = 0;
    const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            const mySeq = ++saveSeq;
            const snap = snapshotWorkoutDraft(els);
            await saveWorkoutDraft(dayId, snap);
            // Skip the status flash if a newer save kicked off in the meantime.
            if (mySeq === saveSeq) showDraftStatus(els, '💾 Entwurf gespeichert');
        }, 400);
    };
    const events = ['input', 'change'];
    [workoutDateInput, workoutWarmupInput, workoutWarmupText].forEach(el => {
        events.forEach(ev => el.addEventListener(ev, scheduleSave));
    });
    workoutExercisesEl.addEventListener('input', scheduleSave);
    workoutExercisesEl.addEventListener('change', scheduleSave);
}

// Brief inline status line below the workout title. Lazily created so we
// don't have to touch index.html for every minor surface.
function showDraftStatus(els, msg) {
    const { workoutView } = els;
    let el = workoutView.querySelector('.workout-draft-status');
    if (!el) {
        el = document.createElement('div');
        el.className = 'workout-draft-status';
        // Anchor right under the workout title.
        const title = workoutView.querySelector('#workout-title');
        if (title && title.parentNode) {
            title.parentNode.insertBefore(el, title.nextSibling);
        } else {
            workoutView.prepend(el);
        }
    }
    el.textContent = msg;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
}

function formatDraftTime(ts) {
    if (!ts) return '';
    const diffSec = Math.round((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'gerade eben';
    if (diffSec < 3600) return `vor ${Math.round(diffSec / 60)} min`;
    const d = new Date(ts);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── New Exercise Inline Modal ───────────────────────────────────────────────
function showNewExerciseModal(dayId, slotIndex, dropdown, exerciseLib, customPlans, trainingHistory, els) {
    // Remove any existing modal
    const existingModal = document.getElementById('new-exercise-inline-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'new-exercise-inline-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content glass-panel" style="max-width:380px;">
            <h2>Neue Übung anlegen</h2>
            <form id="new-exercise-inline-form">
                <div class="input-group">
                    <label>Name der Übung</label>
                    <input type="text" id="new-ex-name" required placeholder="z.B. Arnold Press">
                </div>
                <div class="input-group">
                    <label>Sätze</label>
                    <input type="number" id="new-ex-sets" required min="1" max="10" value="3">
                </div>
                <div class="input-group">
                    <label>Ziel-Wiederholungen</label>
                    <input type="number" id="new-ex-reps" required min="1" value="12">
                </div>
                <div class="input-group">
                    <label>Beschreibung (optional)</label>
                    <textarea id="new-ex-desc" rows="2" placeholder="z.B. Video-Link oder Ausführungshinweise..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" id="btn-cancel-new-ex" class="btn-secondary">Abbrechen</button>
                    <button type="submit" class="btn-primary">Anlegen & auswählen</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(modal);

    const form = modal.querySelector('#new-exercise-inline-form');
    const btnCancel = modal.querySelector('#btn-cancel-new-ex');

    btnCancel.addEventListener('click', () => {
        modal.remove();
        if (dropdown) {
            const setsContainer = dropdown.closest('.exercise-card').querySelector('.exercise-sets');
            dropdown.value = setsContainer.getAttribute('data-ex-id');
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (dropdown) {
                const setsContainer = dropdown.closest('.exercise-card').querySelector('.exercise-sets');
                dropdown.value = setsContainer.getAttribute('data-ex-id');
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-ex-name').value.trim();
        const sets = parseInt(document.getElementById('new-ex-sets').value) || 3;
        const reps = parseInt(document.getElementById('new-ex-reps').value) || 12;
        const desc = document.getElementById('new-ex-desc').value.trim();

        if (!name) return;

        const newId = 'ex_' + Date.now();
        const newExercise = { id: newId, name, sets, targetReps: reps, description: desc };
        await saveExerciseToLibrary(newExercise);
        
        const plan = await getResolvedPlan(dayId, customPlans);
        if (slotIndex >= plan.exercises.length) {
            plan.exercises.push({ id: newId, name, sets, targetReps: reps });
        } else {
            plan.exercises[slotIndex] = { ...plan.exercises[slotIndex], id: newId };
        }
        await savePlanExercises(dayId, plan.exercises, customPlans);
        
        modal.remove();
        await openWorkout(dayId, customPlans, trainingHistory, els);
    });
}

// ─── Finish Workout ──────────────────────────────────────────────────────────
export async function finishWorkout(dayId, customPlans, trainingHistory, dailyHistory, els) {
    const plan = await getResolvedPlan(dayId, customPlans);
    const { workoutDateInput, workoutWarmupInput, workoutWarmupText, workoutExercisesEl } = els;
    // Clamp the workout date to today (logical-date offset) so users can't
    // backdate into the future via DevTools / form manipulation.
    const now = new Date(); now.setHours(now.getHours() - 3);
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    let dateStr = workoutDateInput.value;
    if (!dateStr || dateStr > todayKey) dateStr = todayKey;
    const factor = plan.factor || 50;

    const hist = trainingHistory[dayId];
    const lastWorkout = hist && hist.length > 0 ? hist[hist.length - 1] : null;

    let points = workoutWarmupInput.checked ? 20 : 0;
    
    // Save warmup text
    await storage.set('warmupText', workoutWarmupText.value);
    let improvedExercises = 0;
    const newWorkoutData = { date: dateStr, exercises: {}, states: {} };

    const savePromises = [];

    workoutExercisesEl.querySelectorAll('.exercise-card').forEach(card => {
        const setContainer = card.querySelector('.exercise-sets');
        const exId = setContainer.getAttribute('data-ex-id');
        const targetSets = parseInt(setContainer.getAttribute('data-target-sets'));
        const targetReps = parseInt(setContainer.getAttribute('data-target-reps'));
        const wasDeloadUI = card.getAttribute('data-is-deload') === 'true';
        const isAssisted = setContainer.getAttribute('data-is-assisted') === 'true';

        // Get comment and description
        const commentEl = card.querySelector('.exercise-comment');
        const descEl = card.querySelector('.exercise-description');
        const comment = commentEl ? commentEl.value.trim() : '';
        const description = descEl ? descEl.value.trim() : '';

        newWorkoutData.exercises[exId] = [];
        let curVolume = 0, lastVolume = 0, achievedAll = true, setsDone = 0;
        const setsData = [];

        setContainer.querySelectorAll('.set-row').forEach((row, idx) => {
            const kg = parseFloat(row.querySelector('.set-kg').value) || 0;
            const reps = parseInt(row.querySelector('.set-reps').value) || 0;
            if (reps > 0) setsDone++;
            if (reps < targetReps) achievedAll = false;
            newWorkoutData.exercises[exId].push({ kg, reps });
            setsData.push({ kg, reps });
            // Assistive exercises (dips/pull-ups on assist machine): the kg
            // input is the *assist* load, so less of it means a harder set.
            // Flip the kg term in both the points formula and the volume
            // metric used for progression detection. The volume offset
            // `factor - kg` keeps values comparable across kg ranges and
            // strictly positive as long as assist ≤ factor.
            const effPoints = isAssisted ? (-kg) : kg;
            points += reps * (1 + (effPoints / factor));
            if (isAssisted) {
                curVolume += Math.max(0, factor - kg) * reps;
                const lset = lastWorkout?.exercises?.[exId]?.[idx];
                if (lset) lastVolume += Math.max(0, factor - (lset.kg || 0)) * lset.reps;
            } else {
                curVolume += (kg > 0 ? kg : 1) * reps;
                const lset = lastWorkout?.exercises?.[exId]?.[idx];
                if (lset) lastVolume += (lset.kg > 0 ? lset.kg : 1) * lset.reps;
            }
        });

        if (setsDone < targetSets && !wasDeloadUI) achievedAll = false;
        newWorkoutData.states[exId] = { achievedTarget: achievedAll && !wasDeloadUI, wasDeload: wasDeloadUI };
        if (lastWorkout && curVolume > lastVolume && curVolume > 0 && !wasDeloadUI) improvedExercises++;

        // Save per-exercise last values globally
        savePromises.push(saveExerciseLastValues(exId, setsData, comment));

        // Save description to library if changed
        if (description) {
            savePromises.push((async () => {
                const lib = await getExerciseLibrary();
                if (lib[exId]) {
                    lib[exId].description = description;
                    await storage.set('exerciseLibrary', lib);
                }
            })());
        }
    });

    points += improvedExercises * 20;

    if (!trainingHistory[dayId]) trainingHistory[dayId] = [];
    trainingHistory[dayId].push(newWorkoutData);
    await storage.set('trainingHistory', trainingHistory);

    if (!dailyHistory[dateStr]) dailyHistory[dateStr] = { score: 0, tasksDone: [] };
    dailyHistory[dateStr].score += points;
    dailyHistory[dateStr].tasksDone.push({
        id: 'workout_' + Date.now(),
        name: `🏋️ ${plan.name}`,
        timestamp: Date.now(),
        points: parseFloat(points.toFixed(1)),
        unit: improvedExercises > 0 ? `(${improvedExercises} Progressionen! 🔥)` : 'Basis'
    });
    await storage.set('dailyHistory', dailyHistory);

    // Wait for all save promises
    await Promise.all(savePromises);

    // Workout is committed → discard the autosave draft for this plan.
    await clearWorkoutDraft(dayId);

    return { points, improvedExercises };
}

// ─── Custom Plan Helpers ─────────────────────────────────────────────────────
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

export async function saveCustomPlan(name, factor, exercisesList, customPlans) {
    const exercises = [];
    const rows = exercisesList.querySelectorAll('.custom-exercise-row');
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const n = row.querySelector('.cx-name').value.trim();
        const s = parseInt(row.querySelector('.cx-sets').value);
        const r = parseInt(row.querySelector('.cx-reps').value);
        if (n && s && r) {
            const exId = 'cx_' + Date.now() + '_' + i;
            exercises.push({ id: exId, name: n, sets: s, targetReps: r });
            // Also add to global exercise library
            await saveExerciseToLibrary({ id: exId, name: n, sets: s, targetReps: r, description: '' });
        }
    }
    if (!exercises.length) return null;
    const plan = { id: 'custom_' + Date.now(), name, factor: parseInt(factor) || 50, exercises };
    customPlans.push(plan);
    await storage.set('customPlans', customPlans);
    return plan;
}
