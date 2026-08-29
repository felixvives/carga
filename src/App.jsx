import React, { useState, useMemo, useEffect } from "react";
import { useCarga } from "./hooks/useCarga.js";
import { supabase } from "./supabaseClient.js";

// ---- Design tokens ----
const theme = {
  bg: "#16171A",
  surface: "#202226",
  surfaceElevated: "#2A2D33",
  border: "#34373D",
  textPrimary: "#F2F0EC",
  textMuted: "#8B8F97",
  iron: "#C8442D",
  plateBlue: "#3B7EA8",
  plateYellow: "#D6A73B",
  plateGreen: "#4F8F5B",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
`;

const display = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const body = { fontFamily: "'Inter', sans-serif" };

// ---- Plate math: standard lb plates, per side ----
const PLATE_SIZES = [
  { lb: 45, color: theme.iron, r: 22 },
  { lb: 35, color: theme.plateBlue, r: 20 },
  { lb: 25, color: theme.plateYellow, r: 18 },
  { lb: 10, color: theme.plateGreen, r: 15 },
  { lb: 5, color: "#D8D5CC", r: 12 },
  { lb: 2.5, color: "#57595E", r: 9 },
];

function platesForSide(totalWeight, barWeight) {
  let perSide = Math.max(0, (totalWeight - barWeight) / 2);
  const stack = [];
  for (const p of PLATE_SIZES) {
    while (perSide >= p.lb - 0.001) {
      stack.push(p);
      perSide -= p.lb;
    }
  }
  return stack;
}

function Barbell({ weight, barWeight }) {
  const stack = useMemo(() => platesForSide(weight, barWeight), [weight, barWeight]);
  return (
    <div className="flex items-center justify-center" style={{ height: 60 }}>
      <div className="flex items-center" style={{ flexDirection: "row-reverse" }}>
        {stack.map((p, i) => (
          <div key={i} style={{ width: 8, height: p.r * 2, background: p.color, borderRadius: 2, marginRight: 1, border: "1px solid rgba(0,0,0,0.35)" }} title={`${p.lb}lb`} />
        ))}
      </div>
      <div style={{ width: 90, height: 6, background: "#5B5E64", borderRadius: 2 }} />
      <div className="flex items-center">
        {stack.map((p, i) => (
          <div key={i} style={{ width: 8, height: p.r * 2, background: p.color, borderRadius: 2, marginLeft: 1, border: "1px solid rgba(0,0,0,0.35)" }} />
        ))}
      </div>
    </div>
  );
}

function DumbbellViz() {
  const bell = (
    <div className="flex items-center">
      <div style={{ width: 10, height: 22, background: theme.plateBlue, borderRadius: 2 }} />
      <div style={{ width: 22, height: 6, background: "#5B5E64" }} />
      <div style={{ width: 10, height: 22, background: theme.plateBlue, borderRadius: 2 }} />
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-8" style={{ height: 60 }}>
      {bell}
      {bell}
    </div>
  );
}

function KettlebellViz() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ height: 60 }}>
      <div style={{ width: 18, height: 12, border: `4px solid ${theme.plateYellow}`, borderBottom: "none", borderRadius: "9px 9px 0 0" }} />
      <div style={{ width: 38, height: 38, background: theme.plateYellow, borderRadius: "50%", marginTop: -3 }} />
    </div>
  );
}

function PolleyViz({ weight }) {
  const blocks = Math.min(10, Math.max(1, Math.round(weight / 10)));
  return (
    <div className="flex items-center justify-center gap-2" style={{ height: 60 }}>
      <div className="flex flex-col-reverse gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ width: 34, height: 4, background: i < blocks ? theme.plateBlue : theme.surfaceElevated, border: `1px solid ${theme.border}` }} />
        ))}
      </div>
      <div style={{ width: 14, height: 2, background: theme.iron }} />
    </div>
  );
}

function BodyweightViz({ extra, color = theme.plateGreen }) {
  return (
    <div className="flex items-center justify-center gap-4" style={{ height: 60 }}>
      <div className="flex flex-col items-center">
        <div style={{ width: 15, height: 15, borderRadius: "50%", background: color }} />
        <div style={{ width: 32, height: 18, borderRadius: "16px 16px 0 0", background: color, marginTop: 3 }} />
      </div>
      {extra && <div style={{ width: 22, height: 10, background: theme.iron, borderRadius: 2 }} title="lastre" />}
    </div>
  );
}

const EQUIPMENT = [
  { id: "barra", label: "Barra" },
  { id: "mancuernas", label: "Mancuernas" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "polea", label: "Polea" },
  { id: "peso corporal", label: "Peso corporal" },
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function closestExistingName(input, names) {
  const norm = (s) => s.toLowerCase().trim();
  const target = norm(input);
  let best = null, bestDist = Infinity;
  for (const name of names) {
    if (norm(name) === target) return null;
    const dist = levenshtein(target, norm(name));
    const similarity = 1 - dist / Math.max(target.length, norm(name).length);
    if (similarity > 0.55 && dist < bestDist) { best = name; bestDist = dist; }
  }
  return best;
}

function weekInfo(cycleStart) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.floor((Date.now() - cycleStart.getTime()) / msPerDay);
  const weekNumber = Math.floor(daysElapsed / 7) + 1;
  const weekInCycle = ((weekNumber - 1) % 3) + 1;
  const daysUntilChange = 21 - (daysElapsed % 21);
  return { weekInCycle, daysUntilChange };
}

const WEEK_COLOR = { 1: theme.plateGreen, 2: theme.plateYellow, 3: theme.iron };
const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentWeekDates() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function shortDayLabel(label) {
  const m = label.match(/^Día\s*(\d+)/);
  return m ? `D${m[1]}` : label.slice(0, 5);
}

function App() {
  const {
    loading, spaces, exercises, sets, cycleStart,
    addSpace, renameSpace, removeSpace,
    addExercise, removeExercise, updateExerciseMeta,
    addSet, removeSet, updateCycleStart,
  } = useCarga();

  const [activeSpaceId, setActiveSpaceId] = useState(null);
  const [editingRoutine, setEditingRoutine] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [nameSuggestion, setNameSuggestion] = useState(null);

  useEffect(() => {
    if (!activeSpaceId && spaces.length) setActiveSpaceId(spaces[0].id);
  }, [spaces, activeSpaceId]);

  const { weekInCycle, daysUntilChange } = weekInfo(cycleStart);
  const weekDates = useMemo(() => currentWeekDates(), []);
  const loggedDates = useMemo(() => new Set(sets.map((s) => s.logged_at.slice(0, 10))), [sets]);
  const daysTrainedThisWeek = weekDates.filter((d) => loggedDates.has(d)).length;

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const spaceExercises = useMemo(
    () => exercises.filter((e) => e.space_id === activeSpaceId).sort((a, b) => a.position - b.position),
    [exercises, activeSpaceId]
  );

  const setsForExercise = (exId) =>
    sets
      .filter((s) => s.exercise_id === exId)
      .sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
      .map((s) => ({ id: s.id, rounds: s.rounds, reps: s.reps, weight: s.weight, at: new Date(s.logged_at).getTime() }));

  const allExerciseNames = useMemo(() => Array.from(new Set(exercises.map((e) => e.name))), [exercises]);

  const today = todayStr();
  const totalVolumeToday = spaceExercises.reduce(
    (sum, ex) =>
      sum +
      setsForExercise(ex.id)
        .filter((s) => new Date(s.at).toISOString().slice(0, 10) === today)
        .reduce((a, s) => a + s.rounds * s.reps * s.weight, 0),
    0
  );

  const handleAddExerciseSubmit = () => {
    const trimmed = newExName.trim();
    if (!trimmed || !activeSpaceId) return;
    const match = closestExistingName(trimmed, allExerciseNames);
    if (match) { setNameSuggestion(match); return; }
    addExercise(activeSpaceId, trimmed);
    setNewExName("");
  };

  const confirmAddExercise = (name) => {
    addExercise(activeSpaceId, name);
    setNewExName("");
    setNameSuggestion(null);
  };

  const handleAddSpace = async () => {
    const label = `Día ${spaces.length + 1}`;
    const created = await addSpace(label);
    if (created) { setActiveSpaceId(created.id); setEditingRoutine(true); }
  };

  const handleRemoveSpace = (id) => {
    if (spaces.length <= 1) return;
    removeSpace(id);
    if (activeSpaceId === id) {
      const next = spaces.find((s) => s.id !== id) || null;
      setActiveSpaceId(next ? next.id : null);
      setEditingRoutine(false);
    }
  };

  const handleFinishCycle = () => {
    const confirmed = window.confirm(
      "¿Terminar el ciclo actual ahora? Esto reinicia el contador a Semana 1/3 a partir de hoy, sin importar cuánto llevaba corriendo antes."
    );
    if (confirmed) updateCycleStart(new Date());
  };

  if (loading || !activeSpace) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <span style={{ ...mono, color: theme.textMuted, fontSize: 13 }}>cargando...</span>
      </div>
    );
  }

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", ...body, color: theme.textPrimary }}>
      <style>{FONTS}</style>

      <div className="px-5 pt-6 pb-3 sticky top-0 z-10" style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-baseline justify-between">
          <h1 style={{ ...display, fontSize: 34 }}>CARGA</h1>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 8, height: 8, borderRadius: 4, background: WEEK_COLOR[weekInCycle] }} />
              <span style={{ ...mono, fontSize: 11, color: theme.textMuted }}>
                Semana {weekInCycle}/3 · rutina cambia en {daysUntilChange}d
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFinishCycle}
                title="Marcar el ciclo actual como terminado y empezar de nuevo desde hoy"
                style={{ ...mono, fontSize: 10, color: theme.plateBlue, border: `1px solid ${theme.plateBlue}`, borderRadius: 6, padding: "2px 6px" }}
              >
                terminar ciclo
              </button>
              <button onClick={() => supabase.auth.signOut()} style={{ ...mono, fontSize: 10, color: theme.textMuted }}>
                salir
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-4">
          {spaces.map((sp) => (
            <div key={sp.id} className="relative flex-1" style={{ minWidth: 44 }}>
              <button
                onClick={() => { setActiveSpaceId(sp.id); setEditingRoutine(false); }}
                className="w-full py-2 rounded-md text-xs"
                style={{
                  ...mono,
                  background: activeSpaceId === sp.id ? theme.iron : theme.surface,
                  color: activeSpaceId === sp.id ? "#fff" : theme.textMuted,
                  border: `1px solid ${activeSpaceId === sp.id ? theme.iron : theme.border}`,
                }}
              >
                {shortDayLabel(sp.label)}
              </button>
              {spaces.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveSpace(sp.id); }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: theme.surfaceElevated, color: theme.textMuted, fontSize: 10, border: `1px solid ${theme.border}` }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddSpace}
            className="py-2 rounded-md text-xs"
            style={{ ...mono, minWidth: 34, background: "transparent", color: theme.plateBlue, border: `1px dashed ${theme.plateBlue}` }}
          >
            +
          </button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            {weekDates.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <span style={{ ...mono, fontSize: 9, color: theme.textMuted }}>{WEEKDAY_LETTERS[i]}</span>
                <div
                  style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: loggedDates.has(d) ? theme.plateGreen : theme.surfaceElevated,
                    border: `1px solid ${loggedDates.has(d) ? theme.plateGreen : theme.border}`,
                  }}
                />
              </div>
            ))}
          </div>
          <span style={{ ...mono, fontSize: 11, color: theme.textMuted }}>{daysTrainedThisWeek} días esta semana</span>
        </div>
      </div>

      <div className="px-5 py-5 max-w-md mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 style={{ ...display, fontSize: 22 }}>{activeSpace.label}</h2>
            <span style={{ ...mono, fontSize: 11, color: theme.textMuted }}>{totalVolumeToday.toLocaleString()} lb volumen hoy</span>
          </div>
          <button onClick={() => setEditingRoutine((v) => !v)} style={{ ...mono, fontSize: 11, color: theme.plateBlue }}>
            {editingRoutine ? "listo" : "editar rutina"}
          </button>
        </div>

        {editingRoutine && (
          <div className="mb-5 rounded-lg p-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <p style={{ ...mono, fontSize: 10, color: theme.textMuted }} className="mb-1 uppercase">Nombre del espacio</p>
            <input
              key={activeSpaceId}
              defaultValue={activeSpace.label}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed && trimmed !== activeSpace.label) renameSpace(activeSpaceId, trimmed);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              placeholder="Ej: Día 1 - Tren superior"
              className="w-full px-3 py-2 rounded-md text-sm outline-none mb-3"
              style={{ ...display, fontSize: 16, background: theme.bg, border: `1px solid ${theme.plateBlue}`, color: theme.textPrimary }}
            />
            <p style={{ ...mono, fontSize: 10, color: theme.textMuted }} className="mb-2 uppercase">Ejercicios</p>
            <div className="flex flex-col gap-1 mb-3">
              {spaceExercises.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between px-2 py-1.5 rounded" style={{ background: theme.surfaceElevated }}>
                  <span style={{ fontSize: 13 }}>{ex.name}</span>
                  <button onClick={() => removeExercise(ex.id)} style={{ color: theme.textMuted }}>×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newExName}
                onChange={(e) => { setNewExName(e.target.value); setNameSuggestion(null); }}
                placeholder="Agregar ejercicio..."
                list="exercise-catalog"
                className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
                onKeyDown={(e) => e.key === "Enter" && handleAddExerciseSubmit()}
              />
              <datalist id="exercise-catalog">
                {allExerciseNames.map((n) => <option key={n} value={n} />)}
              </datalist>
              <button onClick={handleAddExerciseSubmit} className="px-4 py-2 rounded-md text-sm font-medium" style={{ background: theme.iron, color: "#fff" }}>+</button>
            </div>
            {nameSuggestion && (
              <div className="mt-2 px-3 py-2 rounded-md" style={{ background: theme.surfaceElevated, border: `1px solid ${theme.plateBlue}` }}>
                <p style={{ ...mono, fontSize: 12 }} className="mb-2">
                  ¿Es lo mismo que <span style={{ color: theme.plateBlue }}>"{nameSuggestion}"</span>? Así el historial queda junto.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => confirmAddExercise(nameSuggestion)} className="flex-1 py-1.5 rounded text-xs" style={{ ...mono, background: theme.plateBlue, color: "#fff" }}>
                    Sí, usar ese
                  </button>
                  <button onClick={() => confirmAddExercise(newExName)} className="flex-1 py-1.5 rounded text-xs" style={{ ...mono, background: "transparent", color: theme.textMuted, border: `1px solid ${theme.border}` }}>
                    No, es distinto
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {spaceExercises.map((ex) => {
            const exSets = setsForExercise(ex.id);
            const history = sets
              .filter((s) => s.exercise_name === ex.name && s.exercise_id !== ex.id)
              .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
              .map((s) => ({ rounds: s.rounds, reps: s.reps, weight: s.weight, at: new Date(s.logged_at).getTime() }));

            return (
              <ExerciseCard
                key={ex.id}
                exercise={{ id: ex.id, name: ex.name, equipment: ex.equipment, barWeight: ex.bar_weight, sets: exSets }}
                onAddSet={(rounds, reps, weight) => addSet(ex.id, ex.name, rounds, reps, weight)}
                onRemoveSet={(setId) => removeSet(setId)}
                onMetaChange={(patch) => updateExerciseMeta(ex.id, patch)}
                history={history}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, onAddSet, onRemoveSet, onMetaChange, history = [] }) {
  const [rounds, setRounds] = useState(1);
  const [reps, setReps] = useState(8);
  const [weight, setWeight] = useState(exercise.equipment === "barra" ? exercise.barWeight : 20);
  const [useExtra, setUseExtra] = useState(false);
  const prevBarWeight = React.useRef(exercise.barWeight);

  React.useEffect(() => {
    if (exercise.equipment === "barra" && weight === prevBarWeight.current) {
      setWeight(exercise.barWeight);
    }
    prevBarWeight.current = exercise.barWeight;
  }, [exercise.barWeight, exercise.equipment]);

  const isBodyweight = exercise.equipment === "peso corporal";
  const effectiveWeight = isBodyweight && !useExtra ? 0 : weight;
  const lastWeight = exercise.sets.length ? exercise.sets[exercise.sets.length - 1].weight : effectiveWeight;
  const prev = history[0];
  const trend = prev ? (effectiveWeight > prev.weight ? "up" : effectiveWeight < prev.weight ? "down" : "same") : null;
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("es-CR", { day: "numeric", month: "short" });

  const stepper = (value, setValue, step, min = 0) => (
    <div className="flex items-center" style={{ border: `1px solid ${theme.border}`, borderRadius: 8 }}>
      <button onClick={() => setValue((v) => Math.max(min, v - step))} className="w-7 h-7 flex items-center justify-center" style={{ color: theme.textMuted }}>−</button>
      <span style={{ ...mono, fontSize: 14, width: 30, textAlign: "center" }}>{value}</span>
      <button onClick={() => setValue((v) => v + step)} className="w-7 h-7 flex items-center justify-center" style={{ color: theme.textMuted }}>+</button>
    </div>
  );

  return (
    <div className="rounded-lg p-4" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <h2 style={{ ...display, fontSize: 20 }}>{exercise.name}</h2>
        <span style={{ ...mono, fontSize: 11, color: theme.textMuted }}>{exercise.sets.length} {exercise.sets.length === 1 ? "serie" : "series"}</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {EQUIPMENT.map((eq) => (
          <button
            key={eq.id}
            onClick={() => onMetaChange({ equipment: eq.id })}
            className="py-1.5 px-2 rounded text-xs"
            style={{ ...mono, flex: "1 1 30%", background: exercise.equipment === eq.id ? theme.surfaceElevated : "transparent", color: exercise.equipment === eq.id ? theme.textPrimary : theme.textMuted, border: `1px solid ${exercise.equipment === eq.id ? theme.plateBlue : theme.border}` }}
          >
            {eq.label}
          </button>
        ))}
      </div>

      {exercise.equipment === "barra" && (
        <div className="flex gap-1 mb-1">
          {[45, 35].map((bw) => (
            <button
              key={bw}
              onClick={() => onMetaChange({ barWeight: bw })}
              className="px-2 py-1 rounded text-xs"
              style={{ ...mono, background: exercise.barWeight === bw ? theme.iron : "transparent", color: exercise.barWeight === bw ? "#fff" : theme.textMuted, border: `1px solid ${exercise.barWeight === bw ? theme.iron : theme.border}` }}
            >
              barra {bw}lb
            </button>
          ))}
        </div>
      )}

      {exercise.equipment === "barra" && <Barbell weight={lastWeight} barWeight={exercise.barWeight} />}
      {exercise.equipment === "mancuernas" && <DumbbellViz />}
      {exercise.equipment === "kettlebell" && <KettlebellViz />}
      {exercise.equipment === "polea" && <PolleyViz weight={lastWeight} />}
      {isBodyweight && <BodyweightViz extra={useExtra} />}

      {exercise.sets.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 mt-2">
          {exercise.sets.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: theme.surfaceElevated, ...mono, fontSize: 13 }}>
              <span style={{ color: theme.textMuted }}>{s.rounds > 1 ? `${s.rounds}× ronda` : "ronda"}</span>
              <span>{s.reps} reps {s.weight > 0 ? `× ${s.weight} lb ${exercise.equipment === "mancuernas" ? "c/u" : ""}` : "· peso corporal"}</span>
              <button onClick={() => onRemoveSet(s.id)} style={{ color: theme.textMuted }}>×</button>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mb-3 mt-2 px-2 py-2 rounded" style={{ background: theme.surfaceElevated, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <span style={{ ...mono, fontSize: 9, color: theme.textMuted }} className="uppercase">Historial</span>
            {trend && (
              <span style={{ ...mono, fontSize: 11, color: trend === "up" ? theme.plateGreen : trend === "down" ? theme.iron : theme.textMuted }}>
                {trend === "up" ? `↑ subiste vs ${prev.weight}lb` : trend === "down" ? `↓ bajaste vs ${prev.weight}lb` : `= igual que antes`}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {history.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center justify-between" style={{ ...mono, fontSize: 12, color: theme.textMuted }}>
                <span>{fmtDate(s.at)}</span>
                <span>{s.rounds > 1 ? `${s.rounds}× ` : ""}{s.reps} reps × {s.weight > 0 ? `${s.weight} lb` : "corporal"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isBodyweight && (
        <button onClick={() => setUseExtra((v) => !v)} className="text-xs mb-2" style={{ ...mono, color: useExtra ? theme.iron : theme.textMuted }}>
          {useExtra ? "✓ con lastre" : "+ agregar lastre"}
        </button>
      )}

      <div className="flex items-end justify-between gap-2 mt-3">
        <div>
          <p style={{ ...mono, fontSize: 10, color: theme.textMuted }} className="mb-1 uppercase">Rondas</p>
          {stepper(rounds, setRounds, 1, 1)}
        </div>
        <div>
          <p style={{ ...mono, fontSize: 10, color: theme.textMuted }} className="mb-1 uppercase">Reps</p>
          {stepper(reps, setReps, 1, 0)}
        </div>
        {(!isBodyweight || useExtra) && (
          <div>
            <p style={{ ...mono, fontSize: 10, color: theme.textMuted }} className="mb-1 uppercase">
              {exercise.equipment === "mancuernas" ? "lb c/u" : exercise.equipment === "kettlebell" ? "lb kb" : isBodyweight ? "lb lastre" : "lb total"}
            </p>
            {stepper(weight, setWeight, exercise.equipment === "barra" ? 5 : 2.5, 0)}
          </div>
        )}
      </div>
      <button
        onClick={() => onAddSet(rounds, reps, effectiveWeight)}
        className="w-full mt-3 py-2.5 rounded-md text-sm font-medium"
        style={{ background: theme.iron, color: "#fff" }}
      >
        Registrar {rounds > 1 ? `${rounds} rondas` : "ronda"}
      </button>
    </div>
  );
}

export default App;
