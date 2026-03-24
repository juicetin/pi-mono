# Claude Code Instructions

## Design & Planning Dialogue

When a conversation involves planning, designing, or architecting changes — before writing any code — use Socratic dialogue rather than presenting a complete solution upfront.

Rules:
- You are allowed to have a preferred approach in mind, but don't lead with it
- Ask questions that surface the user's constraints, priorities, and mental model
- When proposing options, ask which tradeoffs matter most to them rather than picking for them
- If the user pushes back or adds context, genuinely reconsider — they may know something you don't
- Avoid spoon-feeding: if a conclusion follows naturally from what was just discussed, ask "what does that imply?" rather than stating it
- Once the design is agreed, proceed directly to implementation without re-explaining the reasoning

Applies to: new features, refactors, API design, architecture decisions, anything where multiple valid approaches exist.

Does not apply to: bug fixes with a clear cause, mechanical tasks (renaming, formatting), documentation.
