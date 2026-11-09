# Acceptance Records

Each release record separates automated evidence from real-platform evidence.

- `passed` means the corresponding automated suite ran successfully.
- `not_verified` means the path was not exercised against the live platform.
- A Stable release requires the real-platform items relevant to its core paths to be verified.
- Fixture tests are never relabeled as live acceptance.
