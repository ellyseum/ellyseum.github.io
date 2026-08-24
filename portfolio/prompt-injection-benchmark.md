---
layout: portfolio-item
title: "Prompt-injection benchmark"
subtitle: "Measured before it was defended"
status: live
permalink: /portfolio/prompt-injection-benchmark/
---

An 18-model prompt-injection vulnerability study across self-hosted open models, **run before
building the security-tooling architecture it informed**. Full results table:
<a href="https://ellyseum.me/2026/02/06/i-broke-every-open-source-llm/" target="_blank" rel="noopener">ellyseum.me/2026/02/06/i-broke-every-open-source-llm</a>,
dated 2026-02-06 — a stranger can check the method and the numbers directly rather than take
them on report.

## How the numbers were obtained

The study has two halves, and each is backed by raw run records — 43 JSON result files
retained alongside the research notes.

**Model vulnerability.** 18 models: 12 self-hosted through Ollama (qwen2.5:7b, mistral:7b,
gemma2:9b, gemma3:4b, moondream, phi3:mini, llama3.2:3b, falcon3:3b, gpt-oss:20b,
gpt-oss:120b, qwen3:8b, deepseek-r1:14b) and 6 hosted through the GitHub Models API
(gpt-4o, gpt-4o-mini, llama-3.3-70b, mistral-small, phi-4, deepseek-r1). Each self-hosted
model received the same 12 scripted attacks — instruction override, role injection, identity
hijack, system-prompt extraction, credential request, completion attack, social engineering,
roleplay jailbreak, logic trap, few-shot, authority impersonation, encoding evasion — and
hosted models received 10. An attack is scored a success from the response's content alone:
the model emitted the attack's canary token, leaked its system prompt, or completed a
credential. An automated check, not a judgment call.

Taking each model's most recent run, the 12 self-hosted models averaged a **40% attack
success rate** (57 of 144 attack runs), ranging from 0% (deepseek-r1:14b) to 83%
(qwen2.5:7b). GPT-4o came through at 0 of 10 — with the caveat that half of those attacks
were stopped by the provider's content filter before reaching the model. Claude (Haiku)
resisted all 12 scripted attacks plus roughly 36 conversational variants, documented in the
research report written from the same runs. All runs are dated 2026-02-05 and 2026-02-06
(UTC), the timestamps carried in the result files themselves.

**Scanner accuracy.** The detection layer was measured against a 1,530-payload corpus:
1,380 malicious payloads across 23 attack categories, each rendered through 15 delivery
vectors (HTML comments and invisible text, email bodies and signatures, four chat formats,
markdown, JSON, API message arrays, code comments, image EXIF), plus 150 clean messages.
The final run blocks 1,380 of 1,380 malicious payloads and 0 of 150 clean messages — 10
clean messages drew a warning and 20 a log entry, flags rather than blocks. One boundary
stated plainly: the records show 21 tuning iterations against this same corpus on
2026-02-05, climbing from 591 blocks and 97 misses to the final figures, so the detection
rate is measured on the development corpus the rules were tuned against, not a held-out set.

The underlying defense architecture built from this benchmark is a private repo; the raw
result records live with it.
