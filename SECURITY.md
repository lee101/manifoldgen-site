# Secret scanning and API key prefixes

Install Gitleaks, then install the repository hook:

```sh
./scripts/install-gitleaks-hook.sh
gitleaks detect --config .gitleaks.toml --redact
```

The pre-push hook scans commits being pushed. CI runs the same Gitleaks
configuration. User-facing ManifoldGen keys use `sk-mg-`; administrative keys
use `sk-mg-admin-`. Never commit `.env` files or move a discovered live secret
into tracked configuration. Revoke and rotate any credential found in Git.
