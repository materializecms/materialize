# Installing Materialize

Materialize is a program that runs all the time. It powers the panel and builds the site. That is why you need **your own server**:

| Where                                                                                      | Suitable?                                                        |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **VPS** (Hetzner, DigitalOcean, OVH, Aruba Cloud…) with Debian 12 or Ubuntu 22.04 or newer | ✓ the easiest way, with one command                              |
| **Server with Docker**                                                                     | ✓                                                                |
| **Your computer**                                                                          | ✓ to try it out or develop a site                                |
| Shared PHP hosting (even with Node in cPanel)                                              | ✗ too little memory, and processes are paused when no one visits |

The site Materialize builds is made of static files. If you ever want to, you can publish those files on any hosting. The panel, however, needs the server.

**Minimum requirements**: 1 GB of memory (2 GB recommended), 2 GB of free disk space, a domain or subdomain.

## On a VPS, with one command

Before you start, go to your domain's control panel and create an **A record** that points to the VPS IP address (for example `example.com` → `203.0.113.10`). The HTTPS certificate only arrives once the domain points to the server.

Then connect to the VPS (with `ssh`) and run:

```bash
curl -fsSL https://cdn.jsdelivr.net/npm/@materializecms/cli/install.sh | sudo bash -s -- --domain example.com
```

Replace `example.com` with your domain. In a few minutes the script:

1. checks the system, memory, disk, and that the domain points to the server;
2. installs Node.js and **Caddy**, which serves the site over HTTPS with a Let's Encrypt certificate that renews itself;
3. creates the site in `/srv/materialize` and starts it as a service, which restarts by itself after a reboot or an error;
4. opens only SSH, HTTP, and HTTPS in the firewall;
5. turns on the system's security updates and, on servers with little memory, adds swap space;
6. prints the **link to finish the installation** in the browser.

Useful options (`--help` lists them all):

| Option                     | What it does                                         |
| -------------------------- | ---------------------------------------------------- |
| `--email name@example.com` | Get certificate notices from Let's Encrypt           |
| `--version 0.1.0`          | Install a specific version instead of the latest one |
| `--no-firewall`            | Leave the firewall as it is                          |

If something goes wrong, the script tells you what happened and where to look. Once you fix the problem, run the same command again: it picks up where it stopped. If you run it again after the installation is finished, it repairs the configuration without touching the site.

## With Docker

On a server with Docker, with the domain already pointing to the server:

```bash
mkdir materialize && cd materialize
curl -fsSLO https://cdn.jsdelivr.net/npm/@materializecms/cli/compose.yaml
echo "DOMAIN=example.com" > .env
docker compose up -d
docker compose logs materialize
```

The `.env` file remembers the domain. Docker reads it by itself on every command run in the same folder. The last command shows the link to finish the installation. The site and its content live in the `site` volume, so you can stop, update, or recreate the containers without losing anything.

## On your computer

You need [Node.js](https://nodejs.org) 24 or newer. Then:

```bash
npm create materialize@latest
```

The command asks for a folder name and sets up the site. Then:

```bash
cd my-site
npm run dev
```

and open `http://localhost:4321/admin`. On your computer you don't need the installation link. In development the site can only be reached from your computer, so no one else on a shared Wi-Fi can open it and become the administrator before you. To try it from your phone on the same network, start it with `npm run dev -- --host 0.0.0.0`.

The terminal speaks the system's language: Italian on an Italian computer, English otherwise. To choose it by hand, set `MATERIALIZE_LANG=en` (or `it`) in the environment, for example with `export MATERIALIZE_LANG=en` in your `~/.zshrc` file.

## Finishing the installation in the browser

Open the link the installation gave you. It ends with `/admin/?installa=` followed by a code. The code makes sure no one else can "take over" a server that just went online.

The installation has three steps:

1. **Check**: Materialize checks the server (Node.js, folders, site, HTTPS, updates). Anything in red must be fixed before you continue.
2. **The site**: name and main language. You can change them later.
3. **Your account**: name, email, and a password of at least 10 characters. You will be the administrator.

At the end, press **Go to the panel**.

> If you lose the link: on a VPS, run the installation command again and it prints the link again. With Docker, run `docker compose logs materialize`. The code stays valid until the installation is finished.

Next step: [Getting started](02-getting-started.md).
