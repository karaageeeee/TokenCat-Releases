# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that may expose tokens,
local credentials, or private usage data.

Instead, report privately using GitHub Security Advisories if available on the
repository. If advisories are not enabled yet, open a minimal issue asking for a
private contact path without including sensitive details.

## Scope

Security-sensitive areas include:

- Claude Code OAuth token handling from macOS Keychain
- Codex app-server process management
- accidental logging of credentials or usage responses
- release signing and notarization

`TokenCat` should not store Claude or Codex tokens itself. Tokens are read
locally at runtime only when the selected provider is refreshed.
