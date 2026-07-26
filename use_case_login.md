# EOL — Firebase-Era Login Use Case

This document is retained only as a historical description of the current Firebase-dependent baseline. It is not an approved login specification and must not guide new implementation.

Start with [docs/plan/AGENTS.md](docs/plan/AGENTS.md), then follow the canonical [context](docs/plan/CONTEXT.md), [technical specification](docs/plan/SPEC.md), [hardening register](docs/plan/production_hardening.md), [placeholder register](docs/plan/current_placeholders.md), and [production-readiness plan](docs/plan/plan_for_production_rediness.md). The approved target retires Firebase and uses an application-owned OTP challenge with WhatsApp-first provider delivery and SMS fallback.
