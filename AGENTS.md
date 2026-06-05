# Codex Instructions

## Git publishing

- When pushing changes to `main`, also push the same completed change to `test`.
- If the same patch already exists on `test`, still run `git push origin test` and report that it was already up to date.
- Do not include unrelated local changes when syncing branches.

## Product communication

- Ristak is built for business users who are not technical. Frontend copy, onboarding, settings, empty states, errors, tutorials, and educational text must explain the next action in plain beginner-friendly language.
- Avoid exposing implementation terms in the UI unless the user must match an exact label from an external platform. Prefer words like "conectar", "llave de conexion", "numero", "saldo", and "estado" over developer terms.
- If a technical term is unavoidable, add a short plain-language explanation nearby and keep the user's task obvious.
