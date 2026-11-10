# ADR 0006: Real-World Resource Compatibility

Status: accepted

## Resource resolution

Resource access is resolved through a typed intent-aware flow:

- `preview`
- `file`
- `download`

A record may point to a direct URL, a same-origin file-access endpoint, or a signed CDN URL. The resolver validates HTTPS, host allowlists, signed-URL expiry and preview-only status before a request.

## Credential boundary

- Signed CDN URLs are fetched with `credentials: omit`.
- The Xiaoya Bearer token is attached only to same-origin platform endpoints.
- Final response URLs are validated after redirects.
- If browser CORS blocks an already-authorized signed URL, the userscript may use `GM_xmlhttpRequest` with a narrow explicit `@connect` allowlist and anonymous mode.

## Encrypted file URLs

The historical Xiaoya `/cloud/file_url/<id>` response may set `is_encryption`. Petite Grace decrypts this platform-issued addressing form locally and then applies the same origin checks before using it.

## Video

Video playback uses platform-issued authorization first. Native HTML5 MP4 is preferred, native HLS is used when available, and hls.js is the fallback. DRM bypass and unrestricted downloading are out of scope.
