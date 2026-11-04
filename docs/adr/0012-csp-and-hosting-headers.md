# ADR-0012: CSP in `<meta>` and hosting headers

- Status: accepted
- Date: 2026-11-03
- Owners: Technical Director
- Task: TR-001 T8

## Context

The app is served as static files and the host may not allow custom HTTP headers. TR-001 therefore
requires a content-security policy in `apps/web/index.html`:

```text
default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:;
object-src 'none'; base-uri 'none'
```

A `<meta>` CSP cannot enforce every directive. MDN states that `frame-ancestors` and `report-uri` are
"not supported in the `<meta>` element", and that `sandbox` is "not supported in the `<meta>` element
or by the `Content-Security-policy-Report-Only` header field". `report-uri` is also deprecated in
favour of `report-to`, which is a header-level reporting mechanism.

This matters because the meta policy alone does not stop another site from framing the app. That
protection depends on the hosting configuration.

## Decision

1. Keep the meta CSP for the directives that work in a `<meta>` element: `default-src`,
   `script-src`, `connect-src`, `img-src`, `object-src` and `base-uri`. It blocks inline scripts,
   third-party scripts and third-party connections even when the host sends no headers.
2. Do not claim that the meta CSP provides `frame-ancestors`, `sandbox` or reporting. Those must be
   sent as HTTP headers by the host.
3. Recommend the following headers to every deployment:
   - `Content-Security-Policy: frame-ancestors 'none'`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: no-referrer`
   - `X-Frame-Options: DENY` for browsers that do not support `frame-ancestors`
4. Do not add a CSP reporting endpoint in v1. There is no error reporter, no analytics and no
   third-party service; a report endpoint would create a new network path for sensitive metadata.
5. Do not use the `sandbox` directive in v1. It would restrict the app's own scripts, storage and
   service worker, and needs a separate design and test pass.
6. Record any future relaxation in a new ADR. The only accepted relaxation today is the stylesheet
   order documented in ADR-0006; there is no relaxation of `script-src`, `connect-src` or
   `frame-ancestors`.

## Consequences

- The app has a useful baseline CSP even on a host that cannot set headers.
- Clickjacking protection is a deployment responsibility. A host that does not send
  `frame-ancestors` or `X-Frame-Options` leaves the app frameable.
- There is no CSP violation report. A broken policy is detected by tests and manual checks, not by a
  reporting service.
- The hosting checklist in `README.md` and `SECURITY.md` must stay in sync with this ADR.
- A future host change must be reviewed against this ADR before deployment.

## Alternatives considered

- **Header-only CSP**: rejected. The static host may not allow headers, and the app would lose the
  baseline policy in that case.
- **Meta CSP plus `frame-ancestors` in the meta tag**: rejected. The directive is ignored in a
  `<meta>` element, so it would create a false sense of protection.
- **Add a CSP report endpoint**: rejected for v1. It adds a network path and a third-party or
  self-hosted collector without a reviewed privacy design.
- **Use `sandbox` to isolate the app**: rejected for v1. It would break service worker, storage and
  the offline flow, and it needs its own tests.
- **No CSP**: rejected. The meta policy is a cheap, tested baseline.
