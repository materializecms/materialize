# Installing Materialize

Materialize is a program that runs all the time. It powers the panel and builds the site. That is why you need **your own server**:

| Where                                                                                      | Suitable?                                                        |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **VPS** (Hetzner, DigitalOcean, OVH, Aruba Cloud…) with Debian 12 or Ubuntu 22.04 or newer | ✓ the easiest way, with one command                              |
| **Server with Docker**                                                                     | ✓                                                                |
| **Your computer**, with Node.js or Docker Desktop                                          | ✓ to try it out or develop a site                                |
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

The `.env` file remembers the domain. Docker reads it by itself on every command run in the same folder. The last command shows the link to finish the installation, at the domain's address. The server's messages are in Italian; for English, add `MATERIALIZE_LANG=en` to the `.env` file. The site and its content live in the `site` volume, so you can stop, update, or recreate the containers without losing anything.

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

## On your computer, with Docker Desktop

To try Materialize the way it runs on a server, without installing Node.js, all you need is [Docker Desktop](https://www.docker.com/products/docker-desktop/), for Mac, Windows and Linux.

1. Install Docker Desktop and open it: it has to stay running.
2. Open the Terminal (PowerShell on Windows) and run:

   ```bash
   docker run -d --name materialize -p 127.0.0.1:4321:4321 -v materialize:/site -e MATERIALIZE_LANG=en --restart unless-stopped --pull always ghcr.io/materializecms/materialize:latest
   ```

   On the first start Docker downloads the image and sets up the site: it takes a few minutes.

3. Ask for the link to finish the installation:

   ```bash
   docker logs materialize
   ```

   The **Setup** line has an address like `http://localhost:4321/admin/?installa=…`: open it in the browser and go on as in [Finishing the installation in the browser](#finishing-the-installation-in-the-browser). On your computer, HTTPS isn't needed.

What the command does:

| Part                       | What it's for                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `--name materialize`       | The container's name, as you see it in Docker Desktop                                     |
| `-p 127.0.0.1:4321:4321`   | The site at `http://localhost:4321`, reachable from this computer only                    |
| `-v materialize:/site`     | The volume that keeps the site, content, images and backups                               |
| `-e MATERIALIZE_LANG=en`   | The server's messages in English (`it` for Italian)                                       |
| `--restart unless-stopped` | Starts again by itself when you reopen Docker Desktop, unless you stopped it              |
| `--pull always`            | Downloads the latest image: otherwise Docker uses the one it already has, even an old one |

Then:

- **Stopping and starting it**: in Docker Desktop, under **Containers**, the ■ and ▶ buttons next to `materialize`; or `docker stop materialize` and `docker start materialize`. The content stays.
- **Updating it**: from the panel, in **Settings → Updates**, as on a server.
- **Port 4321 is already taken**, for example by another site started with `npm run dev`: write `-p 127.0.0.1:4322:4321` in the command, and `4322` instead of `4321` in the link.
- **Removing it**: `docker rm -f materialize` deletes the container but not the volume, so the same command as before starts again from the site as it was. To delete the site and its content too, run `docker volume rm materialize`: there is no going back.
- **Putting it online**: this installation is meant for your computer. For a site with its own domain, use [Docker on a server](#with-docker) or [a VPS](#on-a-vps-with-one-command).

## Finishing the installation in the browser

Open the link the installation gave you. It ends with `/admin/?installa=` followed by a code. The code makes sure no one else can "take over" a server that just went online.

The installation has three steps:

1. **Check**: Materialize checks the server (Node.js, folders, site, HTTPS, updates). Anything in red must be fixed before you continue.
2. **The site**: name and main language. You can change them later.
3. **Your account**: name, email, and a password of at least 10 characters. You will be the administrator.

At the end, press **Go to the panel**.

> If you lose the link: on a VPS, run the installation command again and it prints the link again. With Docker, run `docker compose logs materialize` (with Docker Desktop, `docker logs materialize`). The code stays valid until the installation is finished.

Next step: [Getting started](02-getting-started.md).
