-- Fingerprint of the log/planner data a standup was built from, so unchanged standups aren't re-polished by the AI.
-- Applied to project "proofwork" on 2026-10-20.
alter table public.standups add column source_hash text not null default '';
