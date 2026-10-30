#!/usr/bin/env bash
# Materialize on a VPS, in one command (Debian 12+ or Ubuntu 22.04+, as root):
#
#   curl -fsSL https://cdn.jsdelivr.net/npm/@materializecms/cli/install.sh | sudo bash -s -- --domain esempio.it
#
# Installs Node.js and Caddy (HTTPS with Let's Encrypt), creates the site in /srv/materialize, runs
# it as a service that starts with the server, opens only SSH, HTTP and HTTPS in the firewall and
# prints the link that finishes the installation in the browser. Running it again repairs the
# installation and prints the link again: the site and its content are never touched.
#
# Options:
#   --domain <nome>      The site's domain (asked when missing)
#   --email <indirizzo>  For Let's Encrypt's notices about the certificate (optional)
#   --version <x.y.z>    The Materialize version for a new site (default: the latest)
#   --dir <cartella>     Where the site lives (default: /srv/materialize)
#   --port <numero>      The local port behind Caddy (default: 4321)
#   --registry <url>     Another npm registry (a mirror, or a local one for trials)
#   --tls internal       A certificate from Caddy's own authority, to try it without a public domain
#   --no-firewall        Leaves the firewall as it is
#   --yes                Asks nothing

set -Eeuo pipefail

# Everything lives in main, run on the last line: a download cut halfway runs nothing.
main() {
  DOMAIN='' EMAIL='' VERSION='latest' DIR='/srv/materialize' PORT='4321' REGISTRY='' TLS='' FIREWALL=1 YES=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) DOMAIN="${2:-}"; shift 2 ;;
      --email) EMAIL="${2:-}"; shift 2 ;;
      --version) VERSION="${2:-}"; shift 2 ;;
      --dir) DIR="${2:-}"; shift 2 ;;
      --port) PORT="${2:-}"; shift 2 ;;
      --registry) REGISTRY="${2:-}"; shift 2 ;;
      --tls) TLS="${2:-}"; shift 2 ;;
      --no-firewall) FIREWALL=0; shift ;;
      --yes | -y) YES=1; shift ;;
      -h | --help) usage; exit 0 ;;
      *) die "Opzione sconosciuta: $1" ;;
    esac
  done

  LOG=/var/log/materialize-install.log
  USER_NAME=materialize
  HOME_DIR=/var/lib/materialize
  NODE_MAJOR=24

  title
  preflight
  ask_domain
  check_dns

  : >"$LOG"
  trap 'failed $LINENO' ERR
  step 'Aggiorno l’elenco dei pacchetti'
  apt_get update
  apt_get install ca-certificates curl gnupg
  add_swap
  install_node
  install_caddy
  install_updates
  create_user
  create_site
  write_service
  write_caddy
  open_firewall
  start_site
  finish
}

usage() {
  cat <<'EOF'

  curl -fsSL https://cdn.jsdelivr.net/npm/@materializecms/cli/install.sh | sudo bash -s -- --domain esempio.it

  --domain <nome>      Il dominio del sito (se manca, lo chiede)
  --email <indirizzo>  Per gli avvisi di Let's Encrypt sul certificato (facoltativo)
  --version <x.y.z>    La versione di Materialize per un sito nuovo (predefinita: l'ultima)
  --dir <cartella>     Dove sta il sito (predefinita: /srv/materialize)
  --port <numero>      La porta locale dietro Caddy (predefinita: 4321)
  --registry <url>     Un altro registro npm
  --tls internal       Un certificato di Caddy stesso, per provare senza un dominio pubblico
  --no-firewall        Lascia il firewall com'è
  --yes                Non chiede niente

EOF
}

# ── Output ────────────────────────────────────────────────────────────────────────────────

if [ -t 1 ]; then B=$'\e[1m' D=$'\e[2m' G=$'\e[32m' R=$'\e[31m' Y=$'\e[33m' C=$'\e[34m' N=$'\e[0m'; else B='' D='' G='' R='' Y='' C='' N=''; fi

title() { printf '\n  %sMaterialize%s %sinstallazione su VPS%s\n\n' "$B$C" "$N" "$D" "$N"; }
step() { printf '  %s→%s %s…\n' "$C" "$N" "$1"; }
ok() { printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
note() { printf '    %s%s%s\n' "$D" "$1" "$N"; }
die() { printf '\n  %s✗ %s%s\n\n' "$R" "$1" "$N" >&2; exit 1; }

failed() {
  printf '\n  %s✗ Qualcosa non è andato (riga %s).%s Le ultime righe del registro:\n\n' "$R" "$1" "$N" >&2
  tail -n 15 "$LOG" 2>/dev/null | sed 's/^/    /' >&2
  printf '\n  Il registro completo è in %s. Sistemato il problema, rilancia lo stesso comando:\n' "$LOG" >&2
  printf '  riprende da dove si era fermato.\n\n' >&2
  exit 1
}

# Long commands write to the log, not to the screen.
quiet() { "$@" >>"$LOG" 2>&1; }
apt_get() { DEBIAN_FRONTEND=noninteractive quiet apt-get -y -o Dpkg::Options::=--force-confold "$@"; }
# Commands of the site run as its own user, with its home for npm's cache.
as_site() { runuser -u "$USER_NAME" -- env HOME="$HOME_DIR" ${REGISTRY:+npm_config_registry="$REGISTRY"} "$@"; }

# Questions go to the terminal even when the script itself arrives from curl on stdin.
can_ask() { [ "$YES" = 0 ] && { : </dev/tty; } 2>/dev/null; }
ask() {
  local answer
  printf '  %s ' "$1" >/dev/tty
  read -r answer </dev/tty || answer=''
  printf '%s' "$answer"
}

# ── Checks ────────────────────────────────────────────────────────────────────────────────

preflight() {
  [ "$(id -u)" = 0 ] || die 'Serve l’utente root: rilancia con sudo davanti a bash.'
  [ -r /etc/os-release ] || die 'Sistema non riconosciuto: servono Debian 12 o Ubuntu 22.04 (o più recenti).'
  # In a subshell: os-release has its own VERSION.
  local ID VERSION_ID PRETTY_NAME
  IFS='|' read -r ID VERSION_ID PRETTY_NAME < <(. /etc/os-release && echo "$ID|${VERSION_ID:-}|${PRETTY_NAME:-$ID}")
  local major="${VERSION_ID%%.*}"
  case "$ID" in
    debian) [ "${major:-0}" -ge 12 ] || die "Debian $VERSION_ID è troppo vecchio: serve Debian 12 o più recente." ;;
    ubuntu) [ "${major:-0}" -ge 22 ] || die "Ubuntu $VERSION_ID è troppo vecchio: serve Ubuntu 22.04 o più recente." ;;
    *) die "${PRETTY_NAME:-Questo sistema} non è supportato: servono Debian 12 o Ubuntu 22.04 (o più recenti)." ;;
  esac
  [ -d /run/systemd/system ] || die 'Manca systemd, che tiene acceso il sito: serve un VPS vero, non un container.'
  case "$(uname -m)" in x86_64 | aarch64) ;; *) die "Il processore $(uname -m) non è supportato: servono x86_64 o arm64." ;; esac
  [[ "$PORT" =~ ^[0-9]+$ ]] || die "Porta non valida: $PORT"
  if [ -d "$DIR" ] && [ ! -f "$DIR/materialize.config.ts" ] && [ ! -f "$DIR/materialize.config.js" ] && [ -n "$(ls -A "$DIR")" ]; then
    die "$DIR esiste e contiene altri file: scegli un’altra cartella con --dir."
  fi

  local ram_mb disk_mb
  ram_mb=$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
  mkdir -p "$(dirname "$DIR")"
  disk_mb=$(df -Pm "$(dirname "$DIR")" | awk 'NR == 2 { print $4 }')
  [ "$disk_mb" -ge 2048 ] || die "Servono almeno 2 GB liberi su disco, ce ne sono $((disk_mb / 1024))."
  [ "$ram_mb" -ge 900 ] || die "Servono almeno 1 GB di memoria, il server ne ha ${ram_mb} MB."
  ok "${PRETTY_NAME}, $((ram_mb + 50)) MB di memoria, $((disk_mb / 1024)) GB liberi"
}

ask_domain() {
  if [ -z "$DOMAIN" ] && [ -f /etc/caddy/materialize.caddy ]; then
    # Running again: the domain chosen the first time.
    DOMAIN=$(sed -n 's/^# dominio: //p' /etc/caddy/materialize.caddy | head -n 1)
  fi
  if [ -z "$DOMAIN" ]; then
    can_ask || die 'Indica il dominio del sito: --domain esempio.it'
    DOMAIN=$(ask 'Il dominio del sito (per esempio esempio.it):')
  fi
  DOMAIN=$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z' | sed -e 's#^https\{0,1\}://##' -e 's#/.*$##')
  [[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$ ]] || die "«$DOMAIN» non sembra un dominio."
}

# Let's Encrypt gives a certificate only to a domain that already points here.
check_dns() {
  WWW=0
  [ "$TLS" = internal ] && return
  local addresses mine
  addresses=$(getent ahosts "$DOMAIN" | awk '{ print $1 }' | sort -u | tr '\n' ' ')
  mine=" $(hostname -I 2>/dev/null) $(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || true) $(curl -fsS6 --max-time 5 https://api6.ipify.org 2>/dev/null || true) "
  if [ -z "$addresses" ]; then
    warn "$DOMAIN non punta ancora a nessun indirizzo."
    note 'Nel pannello del dominio crea un record A con l’indirizzo IP di questo server.'
    note 'Puoi continuare: il certificato HTTPS arriva da solo appena il dominio punta qui.'
  else
    local found=0 a
    for a in $addresses; do case "$mine" in *" $a "*) found=1 ;; esac; done
    if [ "$found" = 1 ]; then
      ok "$DOMAIN punta a questo server"
    else
      warn "$DOMAIN punta a ${addresses% }, che non sembra questo server."
      note 'Se usi Cloudflare con la nuvola arancione, mettila grigia finché il certificato non è pronto.'
      note 'Altrimenti correggi il record A: il certificato HTTPS arriva da solo appena il dominio punta qui.'
    fi
  fi
  # www.<domain> gets a redirect when it points here too.
  if [ -n "$(getent ahosts "www.$DOMAIN" 2>/dev/null)" ]; then WWW=1; fi
  if can_ask && [ -n "${addresses:-}" ] && [ "${found:-0}" = 0 ]; then
    case "$(ask 'Continuo lo stesso? [S/n]')" in [nN]*) exit 1 ;; esac
  fi
}

# ── Installation ──────────────────────────────────────────────────────────────────────────

# Building the site needs more than 1 GB: small servers get some swap.
add_swap() {
  local ram_mb
  ram_mb=$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
  if [ "$ram_mb" -lt 1900 ] && [ -z "$(swapon --show --noheadings 2>/dev/null)" ] && [ ! -e /swapfile ]; then
    step 'Aggiungo 2 GB di memoria di scambio (il server ha poca memoria)'
    if quiet fallocate -l 2G /swapfile && chmod 600 /swapfile && quiet mkswap /swapfile && quiet swapon /swapfile; then
      echo '/swapfile none swap sw 0 0' >>/etc/fstab
    else
      rm -f /swapfile
      warn 'Non sono riuscito ad aggiungerla: la prima generazione del sito potrebbe essere lenta.'
    fi
  fi
}

install_node() {
  local current
  current=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || true)
  if [ "${current:-0}" -ge "$NODE_MAJOR" ] 2>/dev/null; then
    ok "Node.js $(node -v) già installato"
    return
  fi
  step "Installo Node.js $NODE_MAJOR"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
  # The distribution's own nodejs must not win over this one.
  printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' >/etc/apt/preferences.d/nodejs
  apt_get update
  apt_get install nodejs
  ok "Node.js $(node -v)"
}

install_caddy() {
  if command -v caddy >/dev/null; then
    ok "Caddy $(caddy version | awk '{ print $1 }') già installato"
    return
  fi
  step 'Installo Caddy, che serve il sito in HTTPS'
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt >/etc/apt/sources.list.d/caddy-stable.list
  apt_get update
  apt_get install caddy
  ok "Caddy $(caddy version | awk '{ print $1 }')"
}

# The system's security fixes install by themselves; Materialize updates itself from the panel.
install_updates() {
  if ! dpkg -s unattended-upgrades >/dev/null 2>&1; then
    step 'Attivo gli aggiornamenti di sicurezza automatici del sistema'
    apt_get install unattended-upgrades
  fi
  [ -f /etc/apt/apt.conf.d/20auto-upgrades ] ||
    printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' >/etc/apt/apt.conf.d/20auto-upgrades
}

create_user() {
  id "$USER_NAME" >/dev/null 2>&1 ||
    useradd --system --home-dir "$HOME_DIR" --create-home --shell /usr/sbin/nologin "$USER_NAME"
  install -d -o "$USER_NAME" -g "$USER_NAME" -m 0750 "$HOME_DIR"
}

create_site() {
  if [ -f "$DIR/materialize.config.ts" ] || [ -f "$DIR/materialize.config.js" ]; then
    ok "Il sito c’è già in $DIR: lo lascio com’è"
  else
    step "Creo il sito in $DIR ($([ "$VERSION" = latest ] && echo 'l’ultima versione di Materialize' || echo "Materialize $VERSION"))"
    install -d -o "$USER_NAME" -g "$USER_NAME" -m 0750 "$DIR"
    (cd "$DIR" && as_site npx --yes "create-materialize@$VERSION" . --no-install >>"$LOG" 2>&1)
    # The updates from the panel use the same registry.
    if [ -n "$REGISTRY" ]; then
      echo "registry=$REGISTRY" >"$DIR/.npmrc"
      chown "$USER_NAME:" "$DIR/.npmrc"
    fi
  fi
  if [ ! -x "$DIR/node_modules/.bin/materialize" ]; then
    step 'Scarico i pacchetti del sito (qualche minuto)'
    (cd "$DIR" && as_site npm install --no-audit --no-fund >>"$LOG" 2>&1)
  fi
  ok "Materialize $(node -p "require('$DIR/node_modules/@materializecms/cli/package.json').version")"
}

write_service() {
  install -d -m 0750 /etc/materialize
  # The site's own secrets (ANTHROPIC_API_KEY…), kept when this script runs again.
  [ -f /etc/materialize/env ] ||
    printf '# Variabili per il sito, una per riga (NOME=valore). Poi: systemctl restart materialize\n' >/etc/materialize/env
  chmod 0640 /etc/materialize/env
  chgrp "$USER_NAME" /etc/materialize/env
  cat >/etc/systemd/system/materialize.service <<EOF
# Scritto da install.sh di Materialize: rilanciandolo viene riscritto.
[Unit]
Description=Materialize ($DOMAIN)
After=network-online.target
Wants=network-online.target

[Service]
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$DIR
ExecStart=$DIR/node_modules/.bin/materialize start
Environment=NODE_ENV=production
Environment=HOME=$HOME_DIR
Environment=MATERIALIZE_HOST=127.0.0.1
Environment=MATERIALIZE_PORT=$PORT
Environment=MATERIALIZE_TRUST_PROXY=1
Environment=MATERIALIZE_SITE_URL=https://$DOMAIN
EnvironmentFile=-/etc/materialize/env
Restart=always
RestartSec=5
TimeoutStopSec=30
# The site writes only in its own folder and in its home (npm's cache).
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DIR $HOME_DIR
ProtectKernelTunables=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
}

write_caddy() {
  local site=/etc/caddy/materialize.caddy main=/etc/caddy/Caddyfile
  {
    echo '# Scritto da install.sh di Materialize: rilanciandolo viene riscritto.'
    echo "# dominio: $DOMAIN"
    echo "$DOMAIN {"
    if [ "$TLS" = internal ]; then echo '	tls internal'; elif [ -n "$EMAIL" ]; then echo "	tls $EMAIL"; fi
    echo '	encode zstd gzip'
    echo "	reverse_proxy 127.0.0.1:$PORT"
    echo '}'
    if [ "$WWW" = 1 ]; then
      echo
      echo "www.$DOMAIN {"
      echo "	redir https://$DOMAIN{uri} permanent"
      echo '}'
    fi
  } >"$site"
  # The stock Caddyfile (Caddy's welcome page) is replaced; one written by someone is kept, with ours imported.
  if [ ! -f "$main" ] || grep -q '/usr/share/caddy' "$main"; then
    printf '# I siti serviti da Caddy. Materialize è in materialize.caddy.\nimport materialize.caddy\n' >"$main"
  elif ! grep -q 'import materialize.caddy' "$main"; then
    printf '\nimport materialize.caddy\n' >>"$main"
  fi
  quiet caddy validate --config "$main" --adapter caddyfile
  quiet systemctl enable caddy
  quiet systemctl reload-or-restart caddy
  ok "Caddy serve $DOMAIN in HTTPS"
}

open_firewall() {
  [ "$FIREWALL" = 1 ] || return 0
  if ! command -v ufw >/dev/null; then apt_get install ufw; fi
  # Every port sshd listens on stays open, so this session is never cut off.
  local ports
  # Either tool may be missing on a minimal image: what it does not say, the other does.
  ports=$({
    sshd -T 2>/dev/null | awk '$1 == "port" { print $2 }' || true
    ss -Htlnp 2>/dev/null | awk '/"sshd"/ { n = split($4, a, ":"); print a[n] }' || true
  } | sort -un)
  [ -n "$ports" ] || ports=22
  {
    local p
    for p in $ports; do ufw allow "$p/tcp" comment 'SSH'; done
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw allow 443/udp comment 'HTTP/3'
    ufw --force enable
  } >>"$LOG" 2>&1 && ok "Firewall attivo: aperti solo SSH ($(echo $ports | tr ' ' ',')), HTTP e HTTPS" ||
    warn 'Non sono riuscito ad attivare il firewall (ufw): controlla quello del fornitore del VPS.'
}

start_site() {
  if systemctl is-active --quiet materialize; then
    step 'Riavvio Materialize'
    systemctl restart materialize
  else
    step 'Avvio Materialize: la prima volta genera il sito (un paio di minuti)'
    quiet systemctl enable --now materialize
  fi
  local i
  for i in $(seq 1 300); do
    # The panel answers at once, the site once it is built (until then: 503).
    if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 &&
      [ "$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")" != 503 ]; then
      ok 'Materialize è acceso e il sito è pronto'
      return
    fi
    if [ "$i" -gt 20 ] && ! systemctl is-active --quiet materialize; then break; fi
    sleep 1
  done
  printf '\n  %s✗ Materialize non parte.%s Le ultime righe del suo registro:\n\n' "$R" "$N" >&2
  journalctl -u materialize -n 20 --no-pager 2>/dev/null | sed 's/^/    /' >&2
  printf '\n  Il registro completo: journalctl -u materialize\n\n' >&2
  exit 1
}

finish() {
  local secure=0 i insecure=''
  [ "$TLS" = internal ] && insecure=-k
  # Caddy asks Let's Encrypt for the certificate on its first start: it takes a few seconds.
  for i in $(seq 1 30); do
    if curl -fsS $insecure --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" >/dev/null 2>&1; then
      secure=1
      break
    fi
    sleep 2
  done
  echo
  if [ "$secure" = 1 ]; then
    ok "https://$DOMAIN è online"
  else
    warn "Il certificato HTTPS per $DOMAIN non è ancora pronto."
    note 'Arriva da solo quando il dominio punta a questo server e le porte 80 e 443 sono aperte'
    note "(anche nel firewall del fornitore). Per vedere cosa succede: journalctl -u caddy -f"
  fi
  local code
  code=$(cat "$DIR/.materialize/install-code" 2>/dev/null || true)
  echo
  if [ -n "$code" ]; then
    printf '  %sManca un passo:%s apri questo link e crea il tuo account.\n\n' "$B" "$N"
    printf '    %shttps://%s/admin/?installa=%s%s\n\n' "$B$C" "$DOMAIN" "$code" "$N"
    note 'Il link vale finché non hai finito: se lo perdi, rilancia questo comando.'
  else
    printf '  %sMaterialize è installato:%s https://%s/admin\n' "$B" "$N" "$DOMAIN"
  fi
  echo
  printf '  %sDa sapere%s\n' "$B" "$N"
  note "Il sito è in $DIR, i contenuti in $DIR/.materialize"
  note 'Gli aggiornamenti si installano dal pannello: Impostazioni → Aggiornamenti'
  note 'Stato: systemctl status materialize   Registro: journalctl -u materialize -f'
  note 'Variabili per il sito (chiavi AI…): /etc/materialize/env'
  echo
}

main "$@"
