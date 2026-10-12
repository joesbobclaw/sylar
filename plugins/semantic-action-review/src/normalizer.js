import { randomUUID } from "node:crypto";
import { opaqueFingerprint, parameterShape } from "./redaction.js";

const READ_TOOLS = new Set([
  "memory_get", "memory_search", "read_mcp_resource", "list_mcp_resources",
  "list_mcp_resource_templates", "sessions_list", "sessions_history", "sessions_search",
  "web_fetch", "web_search", "view_image", "session_status", "conversations_list",
  "read", "openclawread", "openclawweb_fetch", "openclawsessions_list",
  "openclawsessions_history", "openclawsessions_search", "openclawgithub_identity_status",
  "openclawmemory_search", "openclawmemory_get",
]);

const FILE_WRITE_TOOLS = new Set(["apply_patch", "write", "edit", "openclawwrite"]);
const EXEC_TOOLS = new Set([
  "exec", "exec_command", "gateway_exec", "openclawgateway_exec", "terminal",
  "process", "gateway_process", "openclawgateway_process",
]);
const INTERNAL_STATUS_TOOLS = new Set(["progress_card", "sessions_yield", "openclawsessions_yield"]);
const OUTBOUND_SESSION_TOOLS = new Set(["sessions_send", "openclawsessions_send"]);
const SPAWN_TOOLS = new Set(["sessions_spawn", "openclawsessions_spawn"]);
const ASK_USER_TOOLS = new Set(["ask_user", "openclawask_user"]);
const AUTOMATION_TOOLS = new Set(["automations", "openclawautomations"]);
const HEARTBEAT_TOOLS = new Set(["heartbeat_respond", "openclaw_directheartbeat_respond"]);
const DESTRUCTIVE_ACTION = /(delete|remove|destroy|drop|revoke|disable|uninstall|terminate|cancel)/i;
const SEND_ACTION = /^(send|reply|publish|post|create_post|email|sms)$/i;
const LOW_RISK_MESSAGE_ACTION = /^(react|typing|read|list|get|status)$/i;
const LOW_RISK_AUTOMATION_ACTION = /^(list|get|history|status)$/i;

function stringParam(params, names) {
  for (const name of names) if (typeof params?.[name] === "string") return params[name];
  return "";
}

export function classifyToolCall(event) {
  const toolName = event.toolName;
  const action = stringParam(event.params, ["action", "method", "operation"]);
  if (READ_TOOLS.has(toolName)) return { kind: "read", consequential: false, reason: "known-read-tool" };
  if (INTERNAL_STATUS_TOOLS.has(toolName)) return { kind: "internal_status", consequential: false, reason: "internal-status-only" };
  if (OUTBOUND_SESSION_TOOLS.has(toolName)) return { kind: "message_send", consequential: true, reason: "outbound-session-message" };
  if (SPAWN_TOOLS.has(toolName)) return { kind: "agent_spawn", consequential: true, reason: "agent-session-creation" };
  if (ASK_USER_TOOLS.has(toolName)) return { kind: "message_send", consequential: true, reason: "outbound-user-prompt" };
  if (AUTOMATION_TOOLS.has(toolName)) {
    return LOW_RISK_AUTOMATION_ACTION.test(action)
      ? { kind: "automation_metadata", consequential: false, reason: "automation-read-action" }
      : { kind: "automation_mutation", consequential: true, reason: "automation-mutation-or-unknown-action" };
  }
  if (HEARTBEAT_TOOLS.has(toolName)) {
    return event.params?.notify === true
      ? { kind: "notification_send", consequential: true, reason: "outbound-heartbeat-notification" }
      : { kind: "internal_status", consequential: false, reason: "silent-heartbeat-status" };
  }
  if (toolName === "skill_workshop") return { kind: "capability_mutation", consequential: true, reason: "skill-publication-or-repair" };
  if (FILE_WRITE_TOOLS.has(toolName)) return { kind: "file_write", consequential: true, reason: "filesystem-mutation" };
  if (EXEC_TOOLS.has(toolName) || event.toolKind === "code_mode_exec") return { kind: "code_execution", consequential: true, reason: "code-or-command-execution" };
  if (toolName === "message") {
    if (LOW_RISK_MESSAGE_ACTION.test(action)) return { kind: "message_metadata", consequential: false, reason: "non-send-message-action" };
    return { kind: "message_send", consequential: true, reason: SEND_ACTION.test(action) ? "outbound-message" : "unknown-message-action" };
  }
  if (toolName === "image_generate" || toolName === "video_generate") return { kind: "external_generation", consequential: true, reason: "billable-external-generation" };
  if (DESTRUCTIVE_ACTION.test(action) || DESTRUCTIVE_ACTION.test(toolName)) return { kind: "destructive_mutation", consequential: true, reason: "destructive-action-name" };
  return { kind: "unknown", consequential: true, reason: "unknown-tools-fail-into-review" };
}

export function normalizeBeforeToolCall(event, ctx, { processSalt, rulesVersion = "shadow-2" }) {
  const classification = classifyToolCall(event);
  const requester = ctx.requester;
  return {
    schemaVersion: 2,
    recordType: "proposed_effect",
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    mode: "shadow",
    enforced: false,
    tool: {
      name: event.toolName,
      kind: event.toolKind ?? null,
      inputKind: event.toolInputKind ?? null,
      classification,
      parameterShape: parameterShape(event.params),
      derivedPathCount: event.derivedPaths?.length ?? 0,
    },
    actor: {
      agentId: ctx.agentId ?? null,
      requesterProven: requester !== undefined,
      requesterOwner: requester?.senderIsOwner === true,
      channel: requester?.channel ?? null,
      roleCount: requester?.roleIds?.length ?? 0,
    },
    correlation: {
      run: opaqueFingerprint(event.runId ?? ctx.runId ?? "missing", processSalt),
      toolCall: opaqueFingerprint(event.toolCallId ?? ctx.toolCallId ?? "missing", processSalt),
      session: opaqueFingerprint(ctx.sessionId ?? ctx.sessionKey ?? "missing", processSalt),
    },
    policy: {
      rulesVersion,
      semanticReviewCandidate: classification.consequential,
      shadowRecommendation: classification.consequential ? "review" : "allow_fast_path",
      reason: classification.reason,
    },
  };
}
