# Updates and backups

## Updating Materialize

Every 6 hours, the server checks for a new version (and right away when you open **Settings → Updates** or press **Check now**). When there is one, administrators see it right away: a pill with the version number appears at the top right (hover it for the first changes), an **Update** card on the Overview, and a dot on **Settings**. The pill closes with its ×, and comes back with the next version. In **Settings → Updates**, an administrator sees what's new and clicks **Update now**:

1. Materialize makes a **backup** of the database and the media;
2. it downloads the new version **while the site stays online**;
3. it restarts on the new version in a few seconds. The page reloads by itself and shows "Updated from … to …".

If the new version **doesn't start**, the previous one comes back by itself and the panel explains what happened. The site is down for a few seconds at most.

**Going back**: after an update, the same page has a **Go back to** button for the previous version. Your content stays as it is.

**Automatic fixes**: the **Install fixes automatically** switch lets versions that fix problems install by themselves, for example from 0.2.0 to 0.2.1. Versions with new features, for example 0.3.0, are always your call.

Updates never touch your content or the site's files (layouts, blocks, configuration).

> Updates from the panel work on sites installed with the VPS script or with Docker. On a site started some other way, the panel shows the command to run by hand. On your own computer, in development, you update from the terminal with `npm install`.

### Updating the VPS system

Security updates for Debian or Ubuntu install by themselves: the installer turned them on. Bigger system upgrades are still up to you, every so often.

## Backups

In **Settings → Backups**:

- **Automatic daily backups** of the database, with **How many copies to keep**;
- a copy of all uploaded images, which keeps deleted files for at least 30 days;
- **Download everything**: a single `.tar.gz` archive with the database, media and fonts, to keep on your computer;
- **Off-server copy**: the real protection, see below.

Before every update, Materialize makes an extra backup anyway.

## Off-server copy

Regular backups live on the same server as the site: if the server breaks, you lose them too. The **off-server copy** sends them every night to external storage, encrypted before they leave.

Two kinds of storage:

- **S3 compatible**: Cloudflare R2, Backblaze B2, Hetzner Object Storage, Amazon S3, Scaleway, OVH, Wasabi and others. For a typical site they cost a few cents a month. You create a "bucket" and an access key in the service's dashboard, then copy the address, bucket, region and key into Materialize.
- **WebDAV**: Nextcloud, ownCloud, a Synology or QNAP NAS at the office, pCloud, kDrive. You need the folder address, the username and the password (with Nextcloud, an app password is better).

To turn it on, in **Settings → Backups → Off-server copy**:

1. choose **S3 compatible** or **WebDAV** and fill in the fields;
2. **Test the connection**: Materialize writes, reads back and deletes a test file;
3. **Save**: the **recovery key** appears.

### The recovery key

Everything is encrypted with a key that Materialize creates for you. Anyone who opens the external storage, including the provider, sees only unreadable data. **Without the key, the backups can't be restored**: copy it or download it as a file, and keep it away from the server, for example in your password manager. You can see it again with **Show the recovery key**, after confirming your password.

### What happens every night

- The latest copy of the database is sent. Keep as many copies as you like (7, 14, 30, 90 or 365); the oldest are deleted.
- New images and fonts are sent, only the ones not sent yet. On the external storage, images are never deleted, because an old copy of the database might use them.
- If a night fails, administrators get an email and **Settings → Protection → Security** flags it. Materialize tries again every hour until it works.

**Run now** makes a copy right away, for example after you upload a lot of images.

## Moving the site to another server

To move a site to another server, to Docker Desktop, or from a trial to a real server, two steps are enough, with no terminal:

1. On the site you're moving, go to **Settings → Backups → Download everything**: a `materialize-….tar.gz` archive with the database, images, fonts and form attachments.
2. On the new server, install Materialize and open the installation link. On the first screen choose **«Already have a Materialize site? Upload its archive»** and upload that file.
3. The server checks the archive, restarts and puts it in place. After a few minutes you sign in with your usual accounts.

On a site that's already installed, do the same from **Settings → Backups → Restore from an archive**, which asks you to confirm: content, pages, settings and accounts become those in the archive, and the previous database is saved among the backups («before the restore»). The outcome of the last restore shows on the same tab.

From the panel, restoring works with `materialize start`: with Docker, on a VPS and in production. An archive from a newer version of Materialize can be restored once the site is updated. The archive doesn't include the site's code (`materialize.config.ts`, `src/`): if you customized it, copy it separately, usually with Git. The limit is 10 GB, changed with `MATERIALIZE_RESTORE_MAX` (in MB).

## Restoring a backup

Archives can also be restored from the panel (see above). A database copy, and in development an archive too, is restored from the server's terminal, with the site **stopped**. Materialize always keeps a copy of the previous database, so you can undo a restore too.

**On a VPS installed with the script:**

```bash
sudo systemctl stop materialize
cd /srv/materialize
sudo -u materialize node_modules/.bin/materialize restore path/to/backup
sudo systemctl start materialize
```

**With Docker**, in the folder with `compose.yaml` and `.env`:

```bash
docker compose stop materialize
docker compose run --rm materialize restore path/to/backup
docker compose start materialize
```

The file can be a database backup (`content-….db`, in the site's `.materialize/backups` folder) or a full archive downloaded with **Download everything** (`materialize-….tar.gz`). With Docker, the file must be in the site's volume.

### From the off-server copy

If the server is lost, install Materialize on a new server, then:

1. **Download** the backup folder from the external storage: from the service's console, from the Nextcloud client, or with [rclone](https://rclone.org).
2. **Decrypt it**, in the site's folder: `npx materialize decrypt <downloaded folder> --key mzk1-…`. The decrypted files appear next to the encrypted ones, and the command tells you which database to restore.
3. **Restore the database** with `npx materialize restore …/database/content-….db`, with the server stopped.
4. **Copy** the decrypted `media` and `fonts` folders into the site's `.materialize/` folder.
