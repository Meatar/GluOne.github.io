#!/usr/bin/env bash
set -euo pipefail

# === БАЗА ===
WEBROOT="${WEBROOT:-/www/gluone.ru}"
HTA="${WEBROOT}/.htaccess"
DEFAULT_VERSION="$(date +%F)-v1"

VER_PRIVACY="$DEFAULT_VERSION"
VER_CONSENT="$DEFAULT_VERSION"
VER_TERMS="$DEFAULT_VERSION"
VER_OFFER="$DEFAULT_VERSION"

# === GIT ОПЦИИ (по умолчанию выключены) ===
DO_GIT_COMMIT=false
DO_GIT_TAG=false
DO_GIT_PUSH=false
GIT_BRANCH="${GIT_BRANCH:-main}"
GIT_TAG_PREFIX="${GIT_TAG_PREFIX:-policy}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
INIT_GIT_IF_NEEDED=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [-v VERSION] [--privacy V] [--consent V] [--terms V] [--offer V]
                        [--webroot PATH]
                        [--git-commit] [--git-tag] [--git-push]
                        [--git-branch BR] [--git-remote R] [--init-git]

Examples:
  $(basename "$0") -v 2025-09-20-v2 --git-commit --git-tag
  $(basename "$0") --consent 2025-10-01-v3 --git-commit --git-push
EOF
}

[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && { usage; exit 0; }

# --- разбор аргументов ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v)        VER_PRIVACY="$2"; VER_CONSENT="$2"; VER_TERMS="$2"; VER_OFFER="$2"; shift 2;;
    --privacy) VER_PRIVACY="$2"; shift 2;;
    --consent) VER_CONSENT="$2"; shift 2;;
    --terms)   VER_TERMS="$2";   shift 2;;
    --offer)   VER_OFFER="$2";   shift 2;;
    --webroot) WEBROOT="$2"; HTA="${WEBROOT}/.htaccess"; shift 2;;
    --git-commit) DO_GIT_COMMIT=true; shift;;
    --git-tag)    DO_GIT_TAG=true;    shift;;
    --git-push)   DO_GIT_PUSH=true;   shift;;
    --git-branch) GIT_BRANCH="$2";    shift 2;;
    --git-remote) GIT_REMOTE="$2";    shift 2;;
    --init-git)   INIT_GIT_IF_NEEDED=true; shift;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

cd "$WEBROOT"

# --- sha256 ---
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "No sha256 tool found (sha256sum/shasum)." >&2; exit 2
  fi
}

# --- проверки наличия ---
for f in privacy.html consent.html terms.html offer.html; do
  [[ -f "$f" ]] || { echo "Missing file: $WEBROOT/$f" >&2; exit 3; }
done
[[ -f "$HTA" ]] || { echo "Missing .htaccess: $HTA" >&2; exit 4; }

# --- считаем хэши ---
H_PRIVACY="$(sha256 privacy.html)"
H_CONSENT="$(sha256 consent.html)"
H_TERMS="$(sha256 terms.html)"
H_OFFER="$(sha256 offer.html)"

# --- бэкап .htaccess ---
cp -a "$HTA" "${HTA}.bak.$(date +%Y%m%d-%H%M%S)"

# --- апдейт секций <Files> ---
update_section() { # fileSection version hash
  local section="$1" ver="$2" hash="$3"
  sed -i -E "/<Files \"${section}\">/,/<\/Files>/{
    s/(Header set X-Policy-Version \")[^\"]+(\".*)/\1${ver}\2/;
    s/(Header set X-Policy-ETag \")[^\"]+(\".*)/\1${hash}\2/;
    s#^\s*Header set ETag.*#    Header set ETag \"\\\"${hash}\\\"\"#;
  }" "$HTA"
}

update_section "privacy.html" "$VER_PRIVACY" "$H_PRIVACY"
update_section "consent.html" "$VER_CONSENT" "$H_CONSENT"
update_section "terms.html"   "$VER_TERMS"   "$H_TERMS"
update_section "offer.html"   "$VER_OFFER"   "$H_OFFER"

echo "Updated .htaccess:"
printf "  privacy  : %s  %s\n" "$VER_PRIVACY" "$H_PRIVACY"
printf "  consent  : %s  %s\n" "$VER_CONSENT" "$H_CONSENT"
printf "  terms    : %s  %s\n" "$VER_TERMS"   "$H_TERMS"
printf "  offer    : %s  %s\n" "$VER_OFFER"   "$H_OFFER"

# === GIT ===
if $DO_GIT_COMMIT || $DO_GIT_TAG || $DO_GIT_PUSH; then
  if [[ ! -d ".git" ]]; then
    if $INIT_GIT_IF_NEEDED; then
      echo "Initializing git repo in $WEBROOT"
      git init -b "$GIT_BRANCH"
      # если нет user.* — установим локально
      git config user.name  "${GIT_USER_NAME:-Site Bot}"
      git config user.email "${GIT_USER_EMAIL:-bot@gluone.local}"
    else
      echo "No .git in $WEBROOT. Re-run with --init-git or run git init yourself." >&2
      exit 10
    fi
  fi

  # добавляем файлы
  git add .htaccess privacy.html consent.html terms.html offer.html

  if $DO_GIT_COMMIT; then
    COMMIT_MSG=$(
      cat <<EOF
docs(policy): update versions & hashes

privacy: ${VER_PRIVACY}  sha256=${H_PRIVACY}
consent: ${VER_CONSENT}  sha256=${H_CONSENT}
terms  : ${VER_TERMS}    sha256=${H_TERMS}
offer  : ${VER_OFFER}    sha256=${H_OFFER}
EOF
    )
    git commit -m "$COMMIT_MSG" || echo "Nothing to commit."
  fi

  if $DO_GIT_TAG; then
    TAG_NAME="${GIT_TAG_PREFIX}-$(date +%Y%m%d-%H%M%S)"
    TAG_MSG=$(
      cat <<EOF
policy snapshot

privacy: ${VER_PRIVACY}  sha256=${H_PRIVACY}
consent: ${VER_CONSENT}  sha256=${H_CONSENT}
terms  : ${VER_TERMS}    sha256=${H_TERMS}
offer  : ${VER_OFFER}    sha256=${H_OFFER}
EOF
    )
    git tag -a "$TAG_NAME" -m "$TAG_MSG" || echo "Tag ${TAG_NAME} already exists?"
    echo "Created tag: $TAG_NAME"
  fi

  if $DO_GIT_PUSH; then
    # убеждаемся, что есть remote
    if git remote get-url "$GIT_REMOTE" >/dev/null 2>&1; then
      git push "$GIT_REMOTE" "$GIT_BRANCH" || true
      if $DO_GIT_TAG; then git push "$GIT_REMOTE" --tags || true; fi
    else
      echo "Remote '$GIT_REMOTE' not set. Run: git remote add $GIT_REMOTE <URL>" >&2
    fi
  fi
fi

echo
echo "Quick check:"
echo "  curl -I https://gluone.ru/privacy | grep -i 'x-policy'"
echo "  curl -I https://gluone.ru/consent | grep -i 'x-policy'"
echo "  curl -I https://gluone.ru/terms   | grep -i 'x-policy'"
echo "  curl -I https://gluone.ru/offer   | grep -i 'x-policy'"
