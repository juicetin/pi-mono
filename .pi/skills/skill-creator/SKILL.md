---
name: skill-creator
description: Analyzes past pi agent sessions to find repeated usage patterns, then generates new skills for those patterns. Uses a checkpoint file to avoid reprocessing sessions across runs.
---

# Skill Creator

Analyze past sessions, find repeated patterns, and turn them into reusable skills. Use shell tools to read files and write outputs.

---

## Step 1 — Discover Sessions

List all session files:

```bash
find ~/.pi/agent/sessions -name "*.jsonl" | sort
```

Sessions are organized as:
```
~/.pi/agent/sessions/--<working-dir-path>--/<timestamp>_<uuid>.jsonl
```

Each `.jsonl` file is one session. Each line in the file is a JSON entry (an `AgentMessage`).

---

## Step 2 — Load the Checkpoint

Read `~/.pi/agent/skill-creator-checkpoint.json`. If it does not exist, treat it as:

```json
{
  "processed": [],
  "patternCandidates": {},
  "skillsCreated": [],
  "lastRun": null
}
```

- `processed`: array of absolute session file paths already analyzed
- `patternCandidates`: map of `patternKey → { description, count, sessions[] }` — patterns seen so far but not yet turned into skills
- `skillsCreated`: array of `{ name, path, createdAt }` for skills already generated
- `lastRun`: ISO timestamp of the last run

---

## Step 3 — Find Unprocessed Sessions

Filter the discovered session files to those **not** in `checkpoint.processed`. Only analyze these.

If there are no unprocessed sessions, report that and stop.

---

## Step 4 — Parse Sessions

For each unprocessed session file, extract **user messages** by parsing each JSONL line:

- Keep lines where the parsed JSON has `role: "user"`
- Extract text: if `content` is a string, use it directly; if it's an array, join all blocks where `type === "text"` using their `.text` fields
- Skip empty messages, images, and system entries
- Also note the working directory context from the session path (the `--<path>--` segment)

Build a per-session summary:
```
{
  "path": "<absolute path>",
  "workingDir": "<decoded working dir>",
  "userMessages": ["<text>", ...]
}
```

---

## Step 5 — Identify Patterns

Across all user messages from all sessions (processed and new), look for:

1. **Repeated task types** — similar phrasings that indicate the same kind of task (e.g., "set up a new package", "add a test for X", "refactor Y to use Z")
2. **Repeated workflows** — multi-step processes the user keeps orchestrating manually
3. **Repeated slash commands with context** — patterns like `/commit` always followed by cleanup, or always preceded by running tests
4. **Domain-specific conventions** — patterns specific to this project or language (e.g., always adding a certain type annotation, always creating files in a specific structure)

For each candidate pattern:
- Give it a concise `patternKey` (lowercase, hyphens, e.g., `add-typed-test`)
- Write a short description (one sentence)
- Record which session files it was seen in
- Merge with any existing entry in `checkpoint.patternCandidates`

**A pattern qualifies for skill creation if** it has been seen in **2 or more distinct sessions**.

---

## Step 6 — Create Skills

For each qualifying pattern not already in `checkpoint.skillsCreated`:

1. Choose a skill name: use the `patternKey` directly (must be lowercase a–z, 0–9, hyphens, max 64 chars, no leading/trailing/consecutive hyphens)
2. Create the directory: `~/.pi/agent/skills/<name>/`
3. Write `~/.pi/agent/skills/<name>/SKILL.md` using this exact format:

```
---
name: <name>
description: <one sentence, max 1024 chars>
---

# <Title>

<Clear instructions for carrying out this task. Be specific about steps, conventions, and any project-specific details inferred from the sessions. Write in imperative mood ("Do X", "Check Y"). Include example inputs/outputs where helpful.>
```

**Guidelines for writing a good skill:**
- Be prescriptive, not descriptive — tell the model *what to do*, not just what the pattern is
- Include relevant context from the sessions (e.g., file paths, conventions, tool usage)
- Keep it focused: one workflow per skill
- If the pattern involves a multi-step process, list the steps

---

## Step 7 — Update the Checkpoint

Write back `~/.pi/agent/skill-creator-checkpoint.json` with:

- `processed`: add all newly analyzed session file paths
- `patternCandidates`: merge in the new pattern data (update counts, append session paths)
- `skillsCreated`: append entries for any newly created skills
- `lastRun`: current ISO timestamp

---

## Step 8 — Report

Output a summary:

```
Sessions analyzed this run: <N>
Total sessions in checkpoint: <M>

Patterns found:
  <patternKey> — seen in <count> sessions [NEW SKILL CREATED / candidate (<count> sessions so far)]
  ...

Skills created this run:
  ~/.pi/agent/skills/<name>/SKILL.md
  ...

Skills already existing (skipped):
  <name>
  ...
```

If no qualifying patterns were found, say so and list what patterns are currently accumulating with their counts.
