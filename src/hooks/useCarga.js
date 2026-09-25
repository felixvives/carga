import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

export function useCarga() {
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState([]); // [{id,label,position}]
  const [exercises, setExercises] = useState([]); // [{id,space_id,name,equipment,bar_weight,position}]
  const [sets, setSets] = useState([]); // [{id,exercise_id,exercise_name,rounds,reps,weight,logged_at}]
  const [cycleStart, setCycleStart] = useState(new Date());

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: spaceRows, error: e1 }, { data: exerciseRows, error: e2 }, { data: setRows, error: e3 }, { data: cycleRows, error: e4 }] =
      await Promise.all([
        supabase.from("spaces").select("*").order("position", { ascending: true }),
        supabase.from("exercises").select("*").order("position", { ascending: true }),
        supabase.from("set_logs").select("*").order("logged_at", { ascending: true }),
        supabase.from("cycle_settings").select("*").limit(1),
      ]);

    if (e1 || e2 || e3 || e4) {
      console.error("Error cargando datos:", e1 || e2 || e3 || e4);
      setLoading(false);
      return;
    }

    let finalSpaces = spaceRows || [];

    // Si es la primera vez y no hay ningún espacio, crear "Día 1" por defecto.
    if (finalSpaces.length === 0) {
      const { data: created, error } = await supabase
        .from("spaces")
        .insert({ label: "Día 1", position: 0 })
        .select()
        .single();
      if (!error && created) finalSpaces = [created];
    }

    let cycleRow = cycleRows && cycleRows[0];
    if (!cycleRow) {
      const { data: created } = await supabase
        .from("cycle_settings")
        .insert({ cycle_start: new Date().toISOString().slice(0, 10), cycle_length_weeks: 3 })
        .select()
        .single();
      cycleRow = created;
    }

    setSpaces(finalSpaces);
    setExercises(exerciseRows || []);
    setSets(setRows || []);
    if (cycleRow) setCycleStart(new Date(cycleRow.cycle_start + "T00:00:00"));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---- Espacios ----
  const addSpace = async (label) => {
    const { data, error } = await supabase
      .from("spaces")
      .insert({ label, position: spaces.length })
      .select()
      .single();
    if (error) return console.error(error);
    setSpaces((s) => [...s, data]);
    return data;
  };

  const renameSpace = async (id, label) => {
    const { error } = await supabase.from("spaces").update({ label }).eq("id", id);
    if (error) return console.error(error);
    setSpaces((s) => s.map((sp) => (sp.id === id ? { ...sp, label } : sp)));
  };

  const removeSpace = async (id) => {
    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) return console.error(error);
    const removedExerciseIds = exercises.filter((e) => e.space_id === id).map((e) => e.id);
    setSpaces((s) => s.filter((sp) => sp.id !== id));
    setExercises((ex) => ex.filter((e) => e.space_id !== id));
    setSets((allSets) => allSets.filter((row) => !removedExerciseIds.includes(row.exercise_id)));
  };

  // ---- Ejercicios ----
  const addExercise = async (spaceId, name, equipment = "barra", barWeight = 45) => {
    const position = exercises.filter((e) => e.space_id === spaceId).length;
    const { data, error } = await supabase
      .from("exercises")
      .insert({ space_id: spaceId, name, equipment, bar_weight: barWeight, position })
      .select()
      .single();
    if (error) return console.error(error);
    setExercises((ex) => [...ex, data]);
    return data;
  };

  const removeExercise = async (id) => {
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) return console.error(error);
    setExercises((ex) => ex.filter((e) => e.id !== id));
    setSets((s) => s.filter((row) => row.exercise_id !== id));
  };

  const updateExerciseMeta = async (id, patch) => {
    const dbPatch = {};
    if ("equipment" in patch) dbPatch.equipment = patch.equipment;
    if ("barWeight" in patch) dbPatch.bar_weight = patch.barWeight;
    const { error } = await supabase.from("exercises").update(dbPatch).eq("id", id);
    if (error) return console.error(error);
    setExercises((ex) => ex.map((e) => (e.id === id ? { ...e, ...dbPatch } : e)));
  };

  // Renombra el ejercicio Y actualiza el nombre denormalizado en sus set_logs ya
  // existentes, para que el historial (que compara por nombre) no se desincronice.
  const renameExercise = async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("exercises").update({ name: trimmed }).eq("id", id);
    if (error) return console.error(error);
    const { error: e2 } = await supabase.from("set_logs").update({ exercise_name: trimmed }).eq("exercise_id", id);
    if (e2) console.error(e2);
    setExercises((ex) => ex.map((e) => (e.id === id ? { ...e, name: trimmed } : e)));
    setSets((s) => s.map((row) => (row.exercise_id === id ? { ...row, exercise_name: trimmed } : row)));
  };

  // Reordena dentro del mismo espacio, moviendo un lugar hacia arriba o abajo,
  // y reasigna posiciones secuenciales para todo el espacio.
  const moveExercise = async (spaceId, exerciseId, direction) => {
    const list = exercises
      .filter((e) => e.space_id === spaceId && !e.archived_at)
      .sort((a, b) => a.position - b.position);
    const idx = list.findIndex((e) => e.id === exerciseId);
    const newIdx = idx + (direction === "up" ? -1 : 1);
    if (idx === -1 || newIdx < 0 || newIdx >= list.length) return;
    const reordered = [...list];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const updates = reordered.map((e, i) => ({ id: e.id, position: i }));
    await Promise.all(updates.map(({ id, position }) => supabase.from("exercises").update({ position }).eq("id", id)));
    setExercises((ex) =>
      ex.map((e) => {
        const found = updates.find((u) => u.id === e.id);
        return found ? { ...e, position: found.position } : e;
      })
    );
  };

  // Saca UN ejercicio de su rutina sin borrar su historial: mismo mecanismo que
  // archiveAllExercises pero para un solo id. Es lo que usa el botón "×" al
  // editar una rutina — a diferencia de removeExercise, esto no borra series.
  const archiveExercise = async (id) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("exercises").update({ archived_at: nowIso }).eq("id", id);
    if (error) return console.error(error);
    setExercises((ex) => ex.map((e) => (e.id === id ? { ...e, archived_at: nowIso } : e)));
  };

  // Archiva todos los ejercicios activos (de todos los espacios): los saca de la
  // rutina visible, pero sus set_logs quedan intactos en la base para siempre —
  // el historial por nombre de ejercicio los sigue encontrando.
  const archiveAllExercises = async () => {
    const activeIds = exercises.filter((e) => !e.archived_at).map((e) => e.id);
    if (activeIds.length === 0) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("exercises").update({ archived_at: nowIso }).in("id", activeIds);
    if (error) return console.error(error);
    setExercises((ex) => ex.map((e) => (activeIds.includes(e.id) ? { ...e, archived_at: nowIso } : e)));
  };

  // ---- Series / rondas ----
  const addSet = async (exerciseId, exerciseName, rounds, reps, weight) => {
    const { data, error } = await supabase
      .from("set_logs")
      .insert({ exercise_id: exerciseId, exercise_name: exerciseName, rounds, reps, weight })
      .select()
      .single();
    if (error) return console.error(error);
    setSets((s) => [...s, data]);
  };

  const removeSet = async (id) => {
    const { error } = await supabase.from("set_logs").delete().eq("id", id);
    if (error) return console.error(error);
    setSets((s) => s.filter((row) => row.id !== id));
  };

  const updateCycleStart = async (date) => {
    const iso = date.toISOString().slice(0, 10);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("cycle_settings")
      .upsert({ user_id: user.id, cycle_start: iso, cycle_length_weeks: 3 });
    if (error) return console.error(error);
    setCycleStart(date);
  };

  return {
    loading,
    spaces,
    exercises,
    sets,
    cycleStart,
    addSpace,
    renameSpace,
    removeSpace,
    addExercise,
    removeExercise,
    archiveExercise,
    updateExerciseMeta,
    renameExercise,
    moveExercise,
    archiveAllExercises,
    addSet,
    removeSet,
    updateCycleStart,
    reload: loadAll,
  };
}
