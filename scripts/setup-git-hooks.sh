#!/bin/bash
# SCN-051/052 — Setup git hooks و .gitignore
# اجرا: bash scripts/setup-git-hooks.sh

set -e

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo ""
echo "🔧 Setup: Git Security Hooks"
echo ""

# ── .gitignore ──────────────────────────────────────────────────────────────

GITIGNORE="$PROJECT_ROOT/.gitignore"
ADDITIONS=(
  "# Secrets & credentials (SCN-051/052)"
  ".env"
  ".env.local"
  ".env.*.local"
  ".env.production"
  "*.pem"
  "*.key"
  "*service-account*.json"
  "*firebase-adminsdk*.json"
  "*credentials*.json"
  "config/secrets/"
  ""
  "# AWS"
  ".aws/"
  "aws-credentials"
)

echo "📝 بروزرسانی .gitignore ..."
for line in "${ADDITIONS[@]}"; do
  if ! grep -qF "$line" "$GITIGNORE" 2>/dev/null; then
    echo "$line" >> "$GITIGNORE"
  fi
done
echo "   ✅ .gitignore updated"

# ── pre-commit hook ──────────────────────────────────────────────────────────

HOOK_FILE="$HOOKS_DIR/pre-commit"

cat > "$HOOK_FILE" << 'HOOK_EOF'
#!/bin/bash
# SCN-051/052 — pre-commit secret scan

echo "🔍 Scanning for secrets before commit..."

# فقط فایل‌های staged را بررسی کن
STAGED=$(git diff --cached --name-only --diff-filter=ACM)

for FILE in $STAGED; do
  [ -f "$FILE" ] || continue

  # بررسی AWS credentials
  if grep -qE 'AKIA[0-9A-Z]{16}' "$FILE" 2>/dev/null; then
    echo "❌ AWS Access Key detected in: $FILE"
    echo "   Commit blocked. Remove the key and use environment variables."
    exit 1
  fi

  # بررسی Firebase API key
  if grep -qE 'AIzaSy[A-Za-z0-9_-]{33}' "$FILE" 2>/dev/null; then
    echo "❌ Firebase API Key detected in: $FILE"
    echo "   Commit blocked. Move to FIREBASE_API_KEY env variable."
    exit 1
  fi

  # بررسی private keys (به جز فایل‌های اسکنر خودش)
  if [[ "$FILE" != "scripts/scan-secrets.js" && "$FILE" != "scripts/setup-git-hooks.sh" ]] && grep -q '-----BEGIN.*PRIVATE KEY-----' "$FILE" 2>/dev/null; then
    echo "❌ Private key detected in: $FILE"
    echo "   Commit blocked."
    exit 1
  fi

  # هشدار برای .env واقعی
  BASENAME=$(basename "$FILE")
  if [ "$BASENAME" = ".env" ]; then
    echo "❌ .env file staged for commit!"
    echo "   Add .env to .gitignore immediately."
    exit 1
  fi
done

# اسکریپت کامل (اگر نصب شده)
if [ -f "scripts/scan-secrets.js" ]; then
  node scripts/scan-secrets.js . 2>/dev/null || {
    echo "❌ Secret scan failed. Commit blocked."
    exit 1
  }
fi

echo "✅ No secrets detected. Proceeding with commit."
exit 0
HOOK_EOF

chmod +x "$HOOK_FILE"
echo "   ✅ pre-commit hook installed: $HOOK_FILE"

# ── بررسی git history ────────────────────────────────────────────────────────

echo ""
echo "⚠️  بررسی git history برای credentials قدیمی:"
echo ""

# بررسی اگر قبلاً credentials commit شده
if git log --all --full-history -S 'AKIA' --oneline 2>/dev/null | grep -q .; then
  echo "   ❌ AWS credentials در git history یافت شد!"
  echo "   → برای پاک کردن: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository"
  echo "   → ابزار: git filter-repo یا BFG Repo Cleaner"
  echo "   → حتماً credentials را REVOKE کنید!"
else
  echo "   ✅ هیچ AWS key در history یافت نشد"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 مراحل بعدی:"
echo "   ۱. cp .env.example .env"
echo "   ۲. مقادیر واقعی را در .env وارد کنید"
echo "   ۳. node scripts/scan-secrets.js . — برای تست"
echo ""