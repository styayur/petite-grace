# Security Policy

## Reporting

Please report security issues privately through GitHub Security Advisories on `styayur/petite-grace`. Do not include live session cookies, API keys, or private course files in an issue.

## Security boundaries

- Never persist the Xiaoya session token.
- Never attach the Xiaoya Bearer token to a cross-origin download URL.
- Accept only HTTPS resource URLs and validate their host before opening or downloading them.
- Do not use `eval`, remote JavaScript configuration, or dynamic code execution.
- Sanitize platform text before rendering it as HTML.
- Keep the UI inside a Shadow DOM and avoid global host-page style overrides.
- Treat downloaded files and imported JSON as untrusted input.