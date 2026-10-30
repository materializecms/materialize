#!/bin/sh
# Starts Materialize from the /site volume, creating the site there on the first start.
set -eu

SITE=/site
STARTER=/opt/materialize/site

# Started as root (the default): a folder from the host may belong to root, the site runs as "node".
if [ "$(id -u)" = 0 ]; then
  if [ "$(stat -c %u "$SITE")" != "$(id -u node)" ]; then chown -R node:node "$SITE"; fi
  HOME=/home/node exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

if [ ! -f "$SITE/materialize.config.ts" ] && [ ! -f "$SITE/materialize.config.js" ]; then
  if [ -n "$(ls -A "$SITE")" ]; then
    echo "  /site contiene altri file ma non un sito Materialize: usa un volume vuoto." >&2
    exit 1
  fi
  echo "  Primo avvio: preparo il sito nel volume /site…"
  cp -a "$STARTER/." "$SITE/"
fi

cd "$SITE"
# The site in the volume keeps its own version: a newer image does not replace it, the panel does.
site=$(node -p "require('./node_modules/@materializecms/cli/package.json').version" 2>/dev/null || echo '')
image=$(node -p "require('$STARTER/node_modules/@materializecms/cli/package.json').version")
if [ -n "$site" ] && [ "$site" != "$image" ]; then
  echo "  Il sito usa Materialize $site (questa immagine porta la $image): gli aggiornamenti si installano dal pannello."
fi

exec node_modules/.bin/materialize "$@"
