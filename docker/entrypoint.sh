#!/bin/sh
# Starts Materialize from the /site volume, creating the site there on the first start.
set -eu

SITE=/site
STARTER=/opt/materialize/site

# Messages in the language of the terminal, like Materialize's own (MATERIALIZE_LANG, then LANG).
case "${MATERIALIZE_LANG:-${LANG:-}}" in it*) it=1 ;; *) it= ;; esac
say() { if [ -n "$it" ]; then echo "$1"; else echo "$2"; fi; }

# Started as root (the default): a folder from the host may belong to root, the site runs as "node".
if [ "$(id -u)" = 0 ]; then
  if [ "$(stat -c %u "$SITE")" != "$(id -u node)" ]; then chown -R node:node "$SITE"; fi
  HOME=/home/node exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

if [ ! -f "$SITE/materialize.config.ts" ] && [ ! -f "$SITE/materialize.config.js" ]; then
  if [ -n "$(ls -A "$SITE")" ]; then
    say "  /site contiene altri file ma non un sito Materialize: usa un volume vuoto." \
      "  /site holds other files but not a Materialize site: use an empty volume." >&2
    exit 1
  fi
  say "  Primo avvio: preparo il sito nel volume /site…" "  First start: setting up the site in the /site volume…"
  cp -a "$STARTER/." "$SITE/"
fi

cd "$SITE"
# The site in the volume keeps its own version: a newer image does not replace it, the panel does.
site=$(node -p "require('./node_modules/@materializecms/cli/package.json').version" 2>/dev/null || echo '')
image=$(node -p "require('$STARTER/node_modules/@materializecms/cli/package.json').version")
if [ -n "$site" ] && [ "$site" != "$image" ]; then
  say "  Il sito usa Materialize $site (questa immagine porta la $image): gli aggiornamenti si installano dal pannello." \
    "  The site uses Materialize $site (this image brings $image): updates are installed from the panel."
fi

exec node_modules/.bin/materialize "$@"
