# AI transcripts

Every conversation with an AI coding tool during the challenge, **unedited**, as the brief asks: dead ends, changes of direction and mistakes included.

| Folder | Tool and models | What it covers |
| --- | --- | --- |
| [cursor/](./cursor/) | Cursor, with Kimi K3 Max and Composer 2.5 | The Cursor sessions, including the initial design document (v1, commit `cdab97d`) and the project scaffold. |
| [claude-code/](./claude-code/) | Claude Code, with Claude Opus 5.5 | The design review (research into real crew assignment, decisions agreed one by one) that produced design v2; building v2 layer by layer; reviewing the audit and resolving its findings (v2.1); CLI login and port discovery; the test layers and the verification report; packaging the submission. |

Work moved back and forth between the two tools, with the code reviewed by hand throughout, so one phase can span both folders. See [How we worked](../SUBMISSION.md#how-we-worked).

## How the transcripts map to the repository

- **Initial design:** [`DESIGN.md` at `cdab97d`](https://github.com/shubhmehta3121/mission-control/blob/cdab97d/DESIGN.md).
- **Design as built:** [`DESIGN.md`](../DESIGN.md). Its revision history lists what changed in v2 and v2.1, and why.
- **How the agent was constrained:** [`CLAUDE.md`](../CLAUDE.md) and the build order in [DESIGN.md §20](../DESIGN.md#20-build-order-and-acceptance-criteria-used-to-direct-the-agent).
- **How its output was checked:** [`AUDIT.md`](../AUDIT.md) (Appendix C maps each finding to its fix) and [`test-report.html`](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html).

The full map of the submission is in [SUBMISSION.md](../SUBMISSION.md).
