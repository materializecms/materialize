# Materialize in a container. The site lives in the /site volume, node_modules included: the
# updates installed from the panel stay there, and a new container picks up where the old one was.
#
#   docker build --build-arg VERSION=0.1.0 -t materialize docker/
#
# VERSION is the Materialize version of a new site; REGISTRY another npm registry (a local one for trials).

FROM node:24-bookworm-slim

ARG VERSION=latest
ARG REGISTRY=https://registry.npmjs.org/

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# The starting site, ready to run: the first start copies it into the volume.
RUN mkdir -p /opt/materialize \
 && cd /opt/materialize \
 && npm_config_registry="$REGISTRY" npx --yes "create-materialize@$VERSION" il-mio-sito --no-install \
 && mv il-mio-sito site && cd site \
 && npm_config_registry="$REGISTRY" npm install --no-audit --no-fund \
 && if [ "$REGISTRY" != "https://registry.npmjs.org/" ]; then echo "registry=$REGISTRY" > .npmrc; fi \
 && chown -R node:node /opt/materialize/site \
 && mkdir /site && chown node:node /site \
 && npm cache clean --force && rm -rf /root/.npm

COPY entrypoint.sh /usr/local/bin/materialize-entrypoint

ENV NODE_ENV=production
WORKDIR /site
VOLUME /site
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.MATERIALIZE_PORT || 4321) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["tini", "--", "materialize-entrypoint"]
CMD ["start"]
