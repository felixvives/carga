# CARGA

App personal de tracking de gimnasio — espacios de rutina flexibles, ciclo de 3 semanas,
implementos (barra/mancuernas/kettlebell/polea/peso corporal), rondas con peso variable,
historial por ejercicio. Persistencia con Supabase.

## Setup

1. **Creá un proyecto en [supabase.com](https://supabase.com)** (free tier alcanza de sobra
   para uso de una persona).

2. **Corré el schema**: abrí el SQL Editor de tu proyecto y pegá el contenido de
   `supabase/schema.sql`. Esto crea las tablas `spaces`, `exercises`, `set_logs` y
   `cycle_settings`, todas con Row Level Security activado (`auth.uid() = user_id`).

3. **Auth**: en Authentication > Providers dejá Email activado. Pedí un magic link una vez
   desde la app para crear tu usuario, y después desactivá "Allow new users to sign up" en
   Authentication > Settings para que nadie más pueda registrarse.

4. **Variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   Completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Settings > API en el dashboard
   de Supabase).

5. **Instalar y correr**:
   ```bash
   npm install
   npm run dev
   ```

6. **Deploy**: ver la sección "Deploy a GitHub Pages" abajo.

## Deploy a GitHub Pages

Ya viene armado el workflow (`.github/workflows/deploy.yml`) que compila y publica
automáticamente cada vez que hacés push a `main`.

1. **Creá el repo en GitHub** llamado `carga` (si le ponés otro nombre, actualizá
   `base` en `vite.config.js` para que coincida, ej: `/otro-nombre/`).

2. **Subí el código**:
   ```bash
   git init
   git add .
   git commit -m "CARGA v1"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/carga.git
   git push -u origin main
   ```

3. **Agregá tus credenciales como secrets** (no como `.env` — Pages es estático,
   así que se inyectan en el momento del build): en el repo, `Settings > Secrets
   and variables > Actions > New repository secret`, creá:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. **Activá Pages con GitHub Actions como fuente**: `Settings > Pages > Build and
   deployment > Source` → elegí **GitHub Actions** (no "Deploy from branch").

5. El push a `main` ya dispara el workflow. Revisá la pestaña **Actions** del
   repo — cuando termine en verde, tu app va a estar en
   `https://TU-USUARIO.github.io/carga/`.

6. **Actualizá Supabase con la URL real**: `Authentication > URL Configuration` →
   poné esa URL de GitHub Pages tanto en **Site URL** como en **Redirect URLs**
   (con `/**` al final, ej: `https://TU-USUARIO.github.io/carga/**`). Sin esto el
   magic link te va a seguir redirigiendo a localhost y se va a quedar "cargando".

## Estructura

```
src/
  App.jsx              — UI completa (visualizaciones de equipo, tarjetas de ejercicio, etc.)
  supabaseClient.js     — cliente de Supabase
  hooks/useCarga.js     — toda la lógica de datos (spaces/exercises/set_logs/cycle)
  components/AuthGate.jsx — login por magic link
supabase/schema.sql     — schema + RLS, pegar en el SQL Editor
```

## Modelo de datos

- **spaces**: los espacios de rutina (antes "Día 1", "Día 2 - Tren superior", etc.)
- **exercises**: ejercicios dentro de un espacio, con `equipment` y `bar_weight`
- **set_logs**: cada ronda registrada. Guarda `exercise_name` duplicado a propósito para
  poder comparar el mismo ejercicio entre distintos espacios (el feature de "historial").
- **cycle_settings**: una fila con la fecha de inicio del ciclo de 3 semanas.

## Notas / próximos pasos posibles

- No hay manejo de errores de red visible en la UI todavía (solo `console.error`) — para
  uso personal es aceptable, pero si querés algo más robusto se puede agregar un toast simple.
- El detector de nombres parecidos (Levenshtein) es texto-vs-texto, no entiende sinónimos
  reales (ej. "Sentadilla" vs "Squat"). Si eso importa, la siguiente iteración natural es
  llamar a la API de Claude para juzgar equivalencia semántica al agregar un ejercicio nuevo.
- Ideas del brainstorm anterior (gráfico de progreso, PRs automáticos, deload sugerido,
  export CSV) quedan pendientes como backlog — ya con datos reales en Supabase son mucho
  más fáciles de construir.
