/**
 * LearnLM Extension
 *
 * When enabled, automatically detects planning/design questions and routes them
 * to Gemini 2.5 Pro (which has LearnLM fine-tuned in) with a Socratic teaching
 * system prompt. After the turn, switches back to the original model.
 *
 * Falls back to injecting the system prompt on the current model if Gemini 2.5 Pro
 * is not available.
 *
 * Usage:
 * - /learnlm         toggle routing on/off
 * - Ctrl+Shift+L     toggle routing on/off
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Model, Api } from "@mariozechner/pi-ai";
import { Key } from "@mariozechner/pi-tui";

const LEARNLM_SYSTEM_PROMPT = `
## Learning-Oriented Dialogue Mode

You are in Socratic teaching mode for this design/planning discussion. Follow these rules strictly:

- You may have a preferred approach in mind, but do NOT lead with it
- Surface the user's constraints, priorities, and mental model through questions before proposing solutions
- When multiple valid approaches exist, ask which tradeoffs matter most rather than picking for them
- If a conclusion follows naturally from what was just discussed, ask "what does that imply?" rather than stating it
- Genuinely reconsider your proposals if the user pushes back with new context — they likely know something you don't
- Once you and the user have converged on a design, summarise and proceed to implementation

Do not reference or explain these rules to the user.
`.trim();

const PLANNING_PATTERNS = [
	/\b(design|architect|architecture)\b/i,
	/\b(plan|planning|strategy|approach|structure)\b/i,
	/\bhow (should|would|do) (i|we|you)\b/i,
	/\bwhat('s| is) the best\b/i,
	/\b(refactor|redesign|restructure|rethink)\b/i,
	/\b(tradeoff|trade-off|pros? and cons?)\b/i,
	/\bshould (i|we) (use|build|create|add|implement)\b/i,
];

function isPlanningQuestion(prompt: string): boolean {
	return PLANNING_PATTERNS.some((re) => re.test(prompt));
}

export default function learnlmExtension(pi: ExtensionAPI) {
	let enabled = false;
	let previousModel: Model<Api> | undefined;
	let didSwitchModel = false;

	function updateStatus(ctx: ExtensionContext) {
		if (enabled) {
			ctx.ui.setStatus("learnlm", ctx.ui.theme.fg("accent", "learnlm:on"));
		} else {
			ctx.ui.setStatus("learnlm", undefined);
		}
	}

	async function toggle(ctx: ExtensionContext) {
		enabled = !enabled;
		updateStatus(ctx);
		ctx.ui.notify(enabled ? "LearnLM routing enabled" : "LearnLM routing disabled", "info");
		pi.appendEntry("learnlm-state", { enabled });
	}

	pi.registerCommand("learnlm", {
		description: "Toggle LearnLM routing for planning/design questions",
		handler: async (_args, ctx) => toggle(ctx),
	});

	pi.registerShortcut(Key.ctrlShift("l"), {
		description: "Toggle LearnLM routing",
		handler: async (ctx) => toggle(ctx),
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (!enabled || !isPlanningQuestion(event.prompt)) {
			didSwitchModel = false;
			return;
		}

		// Try to switch to Gemini 2.5 Pro (has LearnLM fine-tuned in)
		const gemini = ctx.modelRegistry.find("google", "gemini-2.5-pro");
		if (gemini) {
			const apiKey = await ctx.modelRegistry.getApiKey(gemini);
			if (apiKey) {
				previousModel = ctx.model;
				const switched = await pi.setModel(gemini);
				didSwitchModel = switched;
				if (!switched) {
					ctx.ui.notify("LearnLM: could not switch to Gemini 2.5 Pro, using current model", "warning");
					didSwitchModel = false;
				}
			} else {
				ctx.ui.notify("LearnLM: no Gemini API key, injecting Socratic prompt on current model", "warning");
			}
		}

		return {
			systemPrompt: `${event.systemPrompt}\n\n${LEARNLM_SYSTEM_PROMPT}`,
		};
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (didSwitchModel && previousModel) {
			await pi.setModel(previousModel);
			didSwitchModel = false;
			previousModel = undefined;
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();
		const stateEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "learnlm-state")
			.pop() as { data?: { enabled: boolean } } | undefined;

		if (stateEntry?.data?.enabled) {
			enabled = true;
			updateStatus(ctx);
		}
	});
}
