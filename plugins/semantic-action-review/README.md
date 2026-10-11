# Sylar Semantic Action Review plugin

An OpenClaw plugin that observes real tool-call hooks and writes privacy-minimized JSONL telemetry for later SAR evaluation.

## Current mode

**Shadow-only.** Both hooks return `undefined`. The plugin cannot block a call, rewrite parameters, request approval, or expand authority.

The plugin records consequential calls by default. Known reads are skipped unless `includeReads` is enabled. Unknown tools are treated as review candidates.

## Privacy boundary

Audit records contain tool names, classifications, parameter counts/types/lengths, requester proof flags, counts, and process-salted correlation fingerprints. They do not contain:

- parameter or result values;
- parameter or result object key names;
- prompts, messages, commands, patches, URLs, queries, or file paths;
- recipient, sender, role, session, run, or tool-call identifiers;
- error text.

The audit directory and file are forced to modes `0700` and `0600`. Writes stop at 50 MiB rather than growing without a bound.

Schema version 2 records both the proposed tool name and the tool name observed
after execution because OpenClaw may normalize aliases between the two hooks.
Older schema version 1 telemetry can remain in the same append-only log.

## Configuration

```json
{
  "enabled": true,
  "auditPath": "/absolute/path/to/sar-shadow.jsonl",
  "includeReads": false
}
```

Default audit path: `~/.openclaw/audit/sar-shadow.jsonl`.

## Verify

```sh
npm test
npm run check
npm run report
npm run benchmark
openclaw plugins inspect sylar-semantic-action-review --runtime --json
```

To isolate a deployment window from older records:

```sh
node scripts/analyze-shadow.mjs ~/.openclaw/audit/sar-shadow.jsonl --since=2026-10-11T06:35:00Z
```

The report deliberately stays fail-closed. It checks logical pairing, duplicate
hook delivery, unknown-tool coverage, schema drift, shadow-only invariants, and
sample size. Tool execution duration is reported separately and must not be
misrepresented as SAR hook overhead; the local benchmark measures the plugin's
own paired audit path.

Expected runtime surface: exactly two typed hooks (`before_tool_call` and
`after_tool_call`), with prompt injection and conversation access denied.

## Rollback

Disable without deleting the audit log:

```sh
openclaw plugins disable sylar-semantic-action-review
openclaw gateway restart
```

The Bob deployment also has a pre-install backup and an operator-local undo
script. These machine-specific paths are intentionally not committed here.

No enforcement should be added until sustained shadow data is labeled and the false-negative, false-positive, latency, and redaction gates in the ability specification pass.
