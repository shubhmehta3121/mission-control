# AI transcripts

Every conversation with an AI coding tool during the challenge, **unedited**, as the brief asks: dead ends, changes of direction and mistakes included.


| Folder                         | Tool and models                           | What it covers                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cursor/](./cursor/)           | Cursor, with Kimi K3 Max and Composer 2.5 | The Cursor sessions, including the initial design document (v1, commit `cdab97d`) and the project scaffold.                                                                                                                                                                                          |
| [claude-code/](./claude-code/) | Claude Code, with Claude Opus 5.5         | The design review (research into real crew assignment, decisions agreed one by one) that produced design v2; building v2 layer by layer; reviewing the audit and resolving its findings (v2.1); CLI login and port discovery; the test layers and the verification report; packaging the submission. |


Work moved back and forth between the two tools, with the code reviewed by hand throughout, so one phase can span both folders. See [How we worked](../SUBMISSION.md#how-we-worked).

## What is in each folder

**[cursor/](./cursor/)**, as exported from Cursor:

- `[cursor_mission_crew_automation_design.md](./cursor/cursor_mission_crew_automation_design.md)`: the main chat, readable as Markdown. It starts from the brief and works through the design.
- `[agent-transcripts/](./cursor/agent-transcripts/)`: agent sessions as JSON Lines, including their subagents.
- `[agent-tools/](./cursor/agent-tools/)`: outputs of the tools those agents ran.
- `[terminals/](./cursor/terminals/)`: the terminal sessions.

**[claude-code/](./claude-code/)**, Claude Code session files (JSON Lines, one event per line: messages, tool calls and their results):

- `b29c72cf-….jsonl`: the main session (design review, v2 build, audit fixes, verification, packaging), copied part-way through.
- `b29c72cf-…-final.jsonl`: the same session copied again at the very end. The earlier copy is an exact prefix of this one, so read this one for the complete history.
- The `b29c72cf-…/` and similar folders hold each session's side files (subagent logs, saved tool outputs).



## How the transcripts map to the repository

- **Initial design:** `DESIGN.md` [at](https://github.com/shubhmehta3121/mission-control/blob/cdab97d/DESIGN.md) `cdab97d`.
- **Design as built:** `[DESIGN.md](../DESIGN.md)`. Its revision history lists what changed in v2 and v2.1, and why.
- **How the agent was constrained:** `[CLAUDE.md](../CLAUDE.md)` and the build order in [DESIGN.md §20](../DESIGN.md#20-build-order-and-acceptance-criteria-used-to-direct-the-agent).
- **How its output was checked:** `[AUDIT.md](../AUDIT.md)` (Appendix C maps each finding to its fix) and `[test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html)`.

The full map of the submission is in [SUBMISSION.md](../SUBMISSION.md).