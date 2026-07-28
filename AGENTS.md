# Project agent guidance

## Frontend continuous optimization

When the active objective includes frontend/UI/UX continuous optimization, do not treat it as a one-off styling task.

1. Read `.iteration/state.yaml`, `.iteration/ui/continuous-loop.md`, and
   `.iteration/ui/backlog.json` before choosing work.
2. Run `npm run iterate:ui` to inspect the current round and the highest-value
   eligible UI task.
3. Work in one evidence-backed loop at a time: one primary UI outcome and no
   more than two supporting changes.
4. Preserve the intro scene freeze declared in `.iteration/state.yaml` unless
   new user evidence explicitly reopens it.
5. Verify desktop Chromium at 1440×900 and mobile Chromium at 390×844 and
   375×812 for user-visible UI changes. Include a mid-animation frame when the
   task changes motion or transitions.
6. A UI round is not improved merely because tests pass. It needs visual
   evidence, an explicit before/after outcome, and stable automated guardrails.
7. Run `npm run iterate:ui:verify` before settling a round. Use
   `npm run iterate:ui:verify:full` when navigation, focus, responsiveness, or
   cross-screen flow changed.
8. Record the result in `.iteration/runs/Rxxx.md`, update the backlog item, and
   leave the next highest-value task discoverable through `npm run iterate:ui`.

Do not overwrite unrelated worktree changes or historical screenshots. Store
new visual evidence under a round-specific directory.
