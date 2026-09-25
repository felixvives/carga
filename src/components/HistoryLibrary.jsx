import React, { useMemo, useState } from "react";

// Tokens duplicados a propósito (mismo patrón que AuthGate.jsx): este
// componente no depende de App.jsx, así que lleva su propia copia de la
// paleta en vez de importar desde ahí.
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

const display = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

const EQUIPMENT_LABEL = {
  barra: "Barra",
  mancuernas: "Mancuernas",
  kettlebell: "Kettlebell",
  polea: "Polea",
  "peso corporal": "Peso corporal",
};

const fmtDate = (ts) => new Date(ts).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });

// Junta TODAS las series alguna vez registradas (de cualquier espacio, ciclo
// vigente o ya archivado) agrupadas por nombre de ejercicio — misma lógica de
// comparación por nombre que ya usa el historial dentro de cada tarjeta.
function buildExerciseHistory(sets, exercises) {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const groups = new Map();

  for (const s of sets) {
    const key = s.exercise_name;
    if (!groups.has(key)) groups.set(key, []);
    const owningEx = exerciseById.get(s.exercise_id);
    groups.get(key).push({
      id: s.id,
      rounds: s.rounds,
      reps: s.reps,
      weight: s.weight,
      at: new Date(s.logged_at).getTime(),
      equipment: owningEx?.equipment || "barra",
    });
  }

  const list = [];
  for (const [name, entries] of groups) {
    entries.sort((a, b) => b.at - a.at); // más reciente primero
    const maxWeight = Math.max(...entries.map((e) => e.weight));
    list.push({
      name,
      entries,
      lastEntry: entries[0],
      maxWeight,
      totalSets: entries.length,
    });
  }
  list.sort((a, b) => b.lastEntry.at - a.lastEntry.at);
  return list;
}

function ExerciseHistoryCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { name, entries, lastEntry, maxWeight, totalSets } = item;

  const prevEntry = entries[1];
  const trend = prevEntry
    ? lastEntry.weight > prevEntry.weight
      ? "up"
      : lastEntry.weight < prevEntry.weight
      ? "down"
      : "same"
    : null;

  const fmtWeight = (e) =>
    e.weight > 0 ? `${e.weight} lb${e.equipment === "mancuernas" ? " c/u" : ""}` : "corporal";

  const visibleEntries = expanded ? entries : entries.slice(0, 1);

  return (
    <div className="rounded-lg p-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
      <div className="flex items-center justify-between mb-1">
        <h3 style={{ ...display, fontSize: 18 }}>{name}</h3>
        <span style={{ ...mono, fontSize: 10, color: theme.textMuted }}>
          {totalSets} {totalSets === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span style={{ ...mono, fontSize: 10, color: theme.plateBlue, border: `1px solid ${theme.plateBlue}`, borderRadius: 4, padding: "1px 5px" }}>
          {EQUIPMENT_LABEL[lastEntry.equipment] || lastEntry.equipment}
        </span>
        {maxWeight > 0 && (
          <span style={{ ...mono, fontSize: 10, color: theme.iron, border: `1px solid ${theme.iron}`, borderRadius: 4, padding: "1px 5px" }}>
            PR {maxWeight} lb
          </span>
        )}
        {trend && (
          <span style={{ ...mono, fontSize: 11, color: trend === "up" ? theme.plateGreen : trend === "down" ? theme.iron : theme.textMuted }}>
            {trend === "up" ? `↑ subiste vs ${prevEntry.weight}lb` : trend === "down" ? `↓ bajaste vs ${prevEntry.weight}lb` : "= igual que la vez anterior"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {visibleEntries.map((e) => (
          <div key={e.id} className="flex items-center justify-between" style={{ ...mono, fontSize: 12, color: theme.textMuted }}>
            <span>{fmtDate(e.at)}</span>
            <span style={{ color: theme.textPrimary }}>
              {e.rounds > 1 ? `${e.rounds}× ` : ""}{e.reps} reps × {fmtWeight(e)}
            </span>
          </div>
        ))}
      </div>

      {entries.length > 1 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2"
          style={{ ...mono, fontSize: 10, color: theme.plateBlue }}
        >
          {expanded ? "ver menos" : `ver historial completo (${entries.length})`}
        </button>
      )}
    </div>
  );
}

export default function HistoryLibrary({ sets, exercises, onClose }) {
  const [query, setQuery] = useState("");

  const history = useMemo(() => buildExerciseHistory(sets, exercises), [sets, exercises]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) => h.name.toLowerCase().includes(q));
  }, [history, query]);

  return (
    <div className="px-5 py-5 max-w-md mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <h2 style={{ ...display, fontSize: 22, color: theme.textPrimary }}>Historial</h2>
        <button onClick={onClose} style={{ ...mono, fontSize: 11, color: theme.plateBlue }}>
          ← volver
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ejercicio..."
        className="w-full px-3 py-2 rounded-md text-sm outline-none mb-4"
        style={{ background: theme.surfaceElevated, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
      />

      {history.length === 0 && (
        <div className="text-center py-10 rounded-lg" style={{ border: `1px dashed ${theme.border}`, color: theme.textMuted }}>
          <p style={{ fontSize: 14 }}>Todavía no registraste ninguna serie. En cuanto lo hagas, va a aparecer acá.</p>
        </div>
      )}

      {history.length > 0 && filtered.length === 0 && (
        <p style={{ ...mono, fontSize: 12, color: theme.textMuted }}>Ningún ejercicio coincide con "{query}".</p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <ExerciseHistoryCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}
