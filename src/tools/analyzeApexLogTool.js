import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import { z } from 'zod';

import { log, textFileContent, getFileNameFromPath } from '../utils.js';
import { runCliCommand } from '../salesforceServices.js';
import { newResource } from '../mcp-server.js';

/**
 * Lightweight Apex Debug Log analyzer that extracts a nested execution timeline
 * (methods, SOQL, DML, code units, flows/workflows) and produces:
 *  - JSON with structured events
 *  - Mermaid Gantt definition (best-effort, relative to a base epoch)
 *  - ASCII timeline for quick inspection in plain text
 *  - PNG export of the Mermaid diagram to tmp folder
 */

export const analyzeApexLogToolDefinition = {
    name: 'analyzeApexLog',
    title: 'Analyze Apex Debug Log',
    description: textFileContent('analyzeApexLogTool'),
    inputSchema: {
        logPath: z
            .string()
            .optional()
            .describe('Absolute path to a .log file.'),
        logId: z
            .string()
            .optional()
            .describe('Salesforce Log Id (will be fetched via sf CLI).'),
        logContent: z
            .string()
            .optional()
            .describe('Raw log content as text.'),
        minDurationMs: z
            .number()
            .optional()
            .default(0)
            .describe('Filter out events shorter than this duration in milliseconds.'),
        maxEvents: z
            .number()
            .optional()
            .default(200)
            .describe('Trim to the first N completed events (after filtering).'),
        output: z
            .enum(['both', 'json', 'diagram'])
            .optional()
            .default('both')
            .describe('Which artifacts to return in the tool output.'),
    },
    annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
        title: 'Analyze Apex Debug Log'
    }
};

export async function analyzeApexLogTool({ logPath, logId, logContent, minDurationMs = 0, maxEvents = 200, output = 'both' }) {
    try {
        const source = await resolveLogSource({ logPath, logId, logContent });
        if (!source?.content) {
            throw new Error('No log content provided or resolved');
        }

        const parseResult = parseApexLog(source.content);
        const { events, totalDurationMs, baseNs } = buildCompletedEvents(parseResult);

        const filtered = events
            .filter(e => e.durationMs >= minDurationMs)
            .slice(0, Math.max(0, maxEvents));

        const summary = summarize(filtered, totalDurationMs);

        const fileBaseName = (source.fileName ? getFileNameFromPath(source.fileName) : 'apex_log') + '_' + Date.now();
        const artifacts = {};

        // JSON resource
        const jsonText = JSON.stringify({ summary, events: filtered }, null, 2);
        const jsonUri = `file://apex-log/${fileBaseName}.events.json`;
        newResource(jsonUri, `${fileBaseName}.events.json`, 'Structured Apex log events (filtered)', 'application/json', jsonText);
        artifacts.json = { uri: jsonUri, text: jsonText };

        // ASCII timeline resource
        const asciiText = renderAsciiTimeline(filtered, totalDurationMs);
        const asciiUri = `file://apex-log/${fileBaseName}.txt`;
        newResource(asciiUri, `${fileBaseName}.txt`, 'ASCII timeline view of Apex log', 'text/plain', asciiText);
        artifacts.ascii = { uri: asciiUri, text: asciiText };

        // Mermaid gantt resource (best-effort)
        const mermaidText = renderMermaidGantt(filtered, totalDurationMs);
        const mermaidUri = `file://apex-log/${fileBaseName}.mermaid`;
        newResource(mermaidUri, `${fileBaseName}.mermaid`, 'Mermaid Gantt definition for Apex log', 'text/plain', mermaidText);
        artifacts.mermaid = { uri: mermaidUri, text: mermaidText };

        // PNG export to tmp folder
        const pngPath = await exportMermaidToPng(mermaidText, fileBaseName);
        artifacts.png = { path: pngPath };

        const contentBlocks = [];
        const lines = [];
        lines.push(`Apex log analyzed: ${source.label}`);
        lines.push(`Duration: ${totalDurationMs.toFixed(2)} ms.`);
        lines.push(`Events (filtered): ${filtered.length}. Groups: ${Object.keys(summary.byType).join(', ')}`);
        lines.push('Top slowest events:');
        summary.top.forEach((e, idx) => {
            lines.push(`${idx + 1}. [${e.type}] ${e.name} — ${e.durationMs.toFixed(2)} ms`);
        });

        contentBlocks.push({ type: 'text', text: lines.join('\n') });

        if (output === 'json' || output === 'both') {
            contentBlocks.push({ type: 'text', text: `JSON: ${jsonUri}` });
        }
        if (output === 'diagram' || output === 'both') {
            contentBlocks.push({ type: 'text', text: `Mermaid: ${mermaidUri}` });
            contentBlocks.push({ type: 'text', text: `ASCII: ${asciiUri}` });
            contentBlocks.push({ type: 'text', text: `PNG: ${pngPath}` });
        }

        return {
            content: contentBlocks,
            structuredContent: { summary, artifacts }
        };

    } catch (error) {
        log(error, 'error');
        return {
            isError: true,
            content: [{ type: 'text', text: `❌ Error analyzing Apex log: ${error.message}` }]
        };
    }
}

async function resolveLogSource({ logPath, logId, logContent }) {
    if (logContent && logContent.trim().length > 0) {
        return { label: 'inline content', content: logContent };
    }
    if (logPath) {
        const abs = path.isAbsolute(logPath) ? logPath : path.resolve(process.cwd(), logPath);
        const content = fs.readFileSync(abs, 'utf8');
        return { label: abs, fileName: abs, content };
    }
    if (logId) {
        const full = await runCliCommand(`sf apex get log --log-id ${logId} --include-body`);
        // CLI prints metadata headers; extract the log body if present between markers
        const body = extractLogBody(full);
        return { label: `logId ${logId}`, content: body || full };
    }
    return null;
}

function extractLogBody(cliOutput) {
    if (!cliOutput) return '';
    // Attempt to find the actual log content from CLI output (between lines of dashes or after a JSON field)
    const dashedIdx = cliOutput.indexOf('--------------------');
    if (dashedIdx !== -1) {
        return cliOutput.slice(dashedIdx).trim();
    }
    return cliOutput.trim();
}

function parseApexLog(text) {
    const lines = text.split(/\r?\n/);
    const records = [];
    for (const line of lines) {
        // Example: "16:06:58.18 (54114689)|EXECUTION_FINISHED"
        //          "16:06:58.18 (52417923)|CODE_UNIT_FINISHED|execute_anonymous_apex"
        //          "16:06:58.49 (49590539)|CUMULATIVE_LIMIT_USAGE_END"
        //          "...|METHOD_ENTRY|...|ClassName.methodName|..."
        const match = line.match(/^[^\(]*\((\d+)\)\|(\w+)(?:\|(.+))?$/);
        if (!match) continue;
        const [, nsStr, event, detailsRaw] = match;
        const ns = Number(nsStr);
        const details = detailsRaw || '';

        records.push({ ns, event, raw: line, details });
    }
    return { records };
}

function buildCompletedEvents(parseResult) {
    const { records } = parseResult;
    if (records.length === 0) return { events: [], totalDurationMs: 0, baseNs: 0 };

    const baseNs = records[0].ns;
    const stack = [];
    const events = [];

    function start(type, name, ns, meta = {}) {
        stack.push({ type, name, ns, meta });
    }
    function end(matchingPredicate, ns) {
        for (let i = stack.length - 1; i >= 0; i--) {
            const it = stack[i];
            if (matchingPredicate(it)) {
                stack.splice(i, 1);
                const durationMs = (ns - it.ns) / 1e6;
                const startMs = (it.ns - baseNs) / 1e6;
                const endMs = startMs + durationMs;
                events.push({ type: it.type, name: it.name, startMs, endMs, durationMs, meta: it.meta });
                return true;
            }
        }
        return false;
    }

    for (const r of records) {
        switch (r.event) {
            case 'CODE_UNIT_STARTED': {
                const name = r.details?.split('|')[0] || 'CodeUnit';
                start('Code Unit', name, r.ns);
                break;
            }
            case 'CODE_UNIT_FINISHED': {
                end(it => it.type === 'Code Unit', r.ns);
                break;
            }
            case 'METHOD_ENTRY': {
                const name = extractMethodName(r.details) || 'Method';
                start('Method', name, r.ns);
                break;
            }
            case 'METHOD_EXIT': {
                end(it => it.type === 'Method', r.ns);
                break;
            }
            case 'SOQL_EXECUTE_BEGIN': {
                const name = extractSoql(r.details);
                start('SOQL', name, r.ns);
                break;
            }
            case 'SOQL_EXECUTE_END': {
                end(it => it.type === 'SOQL', r.ns);
                break;
            }
            case 'DML_BEGIN': {
                const name = extractDml(r.details);
                start('DML', name, r.ns);
                break;
            }
            case 'DML_END': {
                end(it => it.type === 'DML', r.ns);
                break;
            }
            case 'FLOW_START_INTERVIEW':
            case 'FLOW_ELEMENT_BEGIN': {
                const name = (r.details || 'Flow');
                start('Flow', name, r.ns);
                break;
            }
            case 'FLOW_ELEMENT_END':
            case 'FLOW_END_INTERVIEW': {
                end(it => it.type === 'Flow', r.ns);
                break;
            }
            case 'WF_RULE_EVAL_BEGIN':
            case 'WF_RULE_FILTER': {
                start('Workflow', r.details || 'Workflow', r.ns);
                break;
            }
            case 'WF_RULE_EVAL_END': {
                end(it => it.type === 'Workflow', r.ns);
                break;
            }
            default:
                // Ignore
                break;
        }
    }

    const totalDurationMs = (records[records.length - 1].ns - baseNs) / 1e6;
    return { events, totalDurationMs, baseNs };
}

function extractMethodName(details) {
    if (!details) return null;
    const parts = details.split('|');
    const candidate = parts.find(p => /\w+\.\w+/.test(p));
    return candidate || parts[parts.length - 1] || 'Method';
}

function extractSoql(details) {
    if (!details) return 'SOQL';
    const m = details.match(/SELECT[\s\S]*/i);
    let q = m ? m[0] : 'SOQL';
    q = q.replace(/\s+/g, ' ').trim();
    if (q.length > 120) q = q.slice(0, 117) + '...';
    return q;
}

function extractDml(details) {
    if (!details) return 'DML';
    const op = details.split('|')[0] || 'DML';
    return op;
}

function summarize(events, totalDurationMs) {
    const byType = {};
    for (const e of events) {
        byType[e.type] = byType[e.type] || { count: 0, durationMs: 0 };
        byType[e.type].count += 1;
        byType[e.type].durationMs += e.durationMs;
    }
    const top = [...events].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
    return { totalDurationMs, byType, top };
}

function renderAsciiTimeline(events, totalDurationMs) {
    const width = 100; // characters
    const lines = [];
    lines.push('ASCII timeline (relative to log start)');
    for (const e of events) {
        const startPos = Math.max(0, Math.floor((e.startMs / totalDurationMs) * width));
        const endPos = Math.min(width, Math.floor((e.endMs / totalDurationMs) * width));
        const bar = ' '.repeat(startPos) + '#'.repeat(Math.max(1, endPos - startPos));
        const label = `[${e.type}] ${e.name}`;
        lines.push(bar + ' ' + label);
    }
    return lines.join('\n');
}

function renderMermaidGantt(events, totalDurationMs) {
    // Mermaid Gantt requires absolute seconds. Use current epoch as base and add offsets in seconds.
    const baseEpoch = Math.floor(Date.now() / 1000);
    let out = 'gantt\n';
    out += '  title Apex Log Timeline (best-effort)\n';
    out += '  dateFormat X\n';
    out += '  axisFormat %S s\n';

    const byType = new Map();
    for (const e of events) {
        if (!byType.has(e.type)) byType.set(e.type, []);
        byType.get(e.type).push(e);
    }

    let id = 0;
    for (const [type, group] of byType.entries()) {
        out += `  section ${escapeMermaid(type)}\n`;
        for (const e of group) {
            id += 1;
            const start = baseEpoch + Math.max(0, Math.floor(e.startMs / 1000));
            const end = baseEpoch + Math.max(0, Math.ceil(e.endMs / 1000));
            const name = escapeMermaid(truncate(`${e.name} (${e.durationMs.toFixed(1)} ms)`, 80));
            out += `  ${name} :t${id}, ${start}, ${end}\n`;
        }
    }
    return out;
}

function truncate(s, max) {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function escapeMermaid(s) {
    return s.replace(/:/g, '-').replace(/\[/g, '(').replace(/\]/g, ')');
}

async function exportMermaidToPng(mermaidText, fileBaseName) {
    try {
        // Create tmp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const pngPath = path.join(tmpDir, `${fileBaseName}.png`);

        // Try to use mmdc (Mermaid CLI) if available
        try {
            execSync(`mmdc -i - -o "${pngPath}"`, {
                input: mermaidText,
                stdio: ['pipe', 'pipe', 'pipe'],
                encoding: 'utf8'
            });
            log(`PNG exported to: ${pngPath}`, 'info');
            return pngPath;

        } catch (mmdcError) {
            log(`mmdc not available, falling back to text file: ${mmdcError.message}`, 'warning');

            // Fallback: save Mermaid text to tmp folder
            const mermaidPath = path.join(tmpDir, `${fileBaseName}.mermaid`);
            fs.writeFileSync(mermaidPath, mermaidText, 'utf8');
            log(`Mermaid text saved to: ${mermaidPath}`, 'info');
            return mermaidPath;
        }

    } catch (error) {
        log(`Error exporting diagram: ${error.message}`, 'warning');
        return null;
    }
}
