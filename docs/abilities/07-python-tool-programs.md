# Python tool programs

## Status

Proposed · Priority P1 · Source: Hermes Agent.

## Source behavior and gap

Hermes supports generated Python programs, persistent local or remote kernels, and bounded RPC calls into parent-owned tools. OpenClaw Code Mode provides JavaScript orchestration in fresh V8 or QuickJS isolates. Python can be run through `exec`, but it is not a first-class policy-checked tool-program runtime. True language/runtime gap.

## Outcome

Agents can use Python's data, scientific, and automation ecosystem while tool access remains brokered by the Gateway and large intermediate data stays out of model context.

## Proposed design

Add a `python` Code Mode backend with:

- per-task kernel identity and explicit reset
- sandbox or remote placement selected by policy
- generated typed client stubs for the allowed tool subset
- RPC through the parent broker, preserving tool policy and audit
- bounded stdout, artifacts, memory, CPU, wall time, and network
- serializable checkpoints for approved state only
- package allowlists or immutable environment images

Kernel persistence is an optimization, not an authority source. Every tool call is reauthorized.

## Trust and safety

- No inherited provider credentials or host environment.
- Network disabled unless explicitly brokered.
- Pickle and arbitrary checkpoint restoration prohibited across trust boundaries.
- Package installation is separate from program execution and reviewed.
- RPC arguments and results use typed schemas with size limits.
- Kernel teardown revokes all handles.

## MVP

Sandboxed CPython for one task, pandas/numpy standard image, persistent state across turns, three read-only tool RPCs, artifact export, and deterministic reset.

## Acceptance tests

- A program cannot call an unexposed tool or raw Gateway endpoint.
- Kernel state persists across turns but not after explicit reset.
- Credential environment and host filesystem are absent.
- Large tabular transforms return an artifact plus bounded summary.
- Timeout kills the process and invalidates handles.
- Policy changes take effect on the next RPC, not the next kernel.

## Acquisition test

The ability is acquired when stateful Python programs can orchestrate a bounded tool set through the Gateway without inheriting secrets, network access, or authority from the host process.
