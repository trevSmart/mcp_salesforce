# Analyze Apex Debug Log

Generates a simplified timeline of a Salesforce Apex debug log and emits:

- A structured JSON of completed events (type, name, start/end/duration in ms)
- A Mermaid Gantt definition (best-effort, relative to a base epoch)
- A plain ASCII timeline for quick inspection
- PNG export of the Mermaid diagram to tmp folder

---
## Agent Instructions
- **MANDATORY**: When analyzing Apex debug logs in Salesforce, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.

---
## Inputs:
- `logPath` (optional): Absolute path to a .log file
- `logId` (optional): Apex Log Id (fetched via `sf apex:log:get --include-body`)
- `logContent` (optional): Raw log content
- `minDurationMs` (optional): Filter out events shorter than this duration
- `maxEvents` (optional): Maximum number of events to include after filtering
- `output` (optional): `both` (default), `json`, or `diagram`

Outputs:
- A short textual summary and links to created resources
- `structuredContent.summary` with aggregates by type and top slowest events
- Resources for JSON, Mermaid and ASCII artifacts
- PNG file exported to tmp folder (if mmdc CLI is available, otherwise Mermaid text file)

Notes:
- Best-effort parsing of METHOD, SOQL, DML, CODE_UNIT, FLOW and WORKFLOW events following Salesforce debug log format.
- PNG generation requires mmdc (Mermaid CLI) to be installed. Falls back to text file if not available.
