# WRKT

Personal workout + meal tracker. Installable web app (PWA) for phone and laptop.

Live: https://chkusiak-web.github.io/wrkt/

## Features
- **Workouts:** 4-day rotation (Strength A, Heart & Lungs, Strength B, Easy Day) built for ~30 minutes. Pick gym / home dumbbells / bodyweight each session.
- **Fast flow:** supersets, one-tap set logging, auto rest timer with beeps + vibration, screen stays awake, 30-min clock.
- **Beat last time:** every set shows last session's numbers and a target (double progression: add reps, then weight).
- **Streaks:** any completed workout (including easy days) keeps the daily streak alive. PRs detected automatically.
- **Food:** USDA FoodData Central search, Open Food Facts barcode lookup, quick add, one-tap re-log of recent foods.
- **Targets:** calories from Mifflin-St Jeor with a moderate deficit sized to your timeline; protein target from goal weight.
- **Progress:** 7-day average weight trend, goal ETA, weekly stats, PR list, history.
- **Sync:** Supabase (email + password). Data also lives offline on each device; changes merge.

## Develop
```sh
npm install
npm run dev
```
Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.

## Supabase setup
Run in the SQL editor:
```sql
create table public.app_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;
create policy "own row" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
