# Music Folder Player for Docker
The provided Docker template should build a set-it-and-forget-it container with an environment that updates the system, PHP8, Caddy and MFP weekly. Caddy should automatically get you an SSL certificate.

Download and edit `docker-compose.yml` as follows:

## Setting the environment variables
#### For outside access
- Set `HOST` to the (sub)domain or external IP you want MFP to be reached at, e.g. `HOST=music.mydomain.com`
- Clear the port number: `PORT=`

#### Behind a reverse proxy
- To let your reverse proxy handle SSL certificates, set `HOST` to the (sub)domain or external IP you want MFP to be reached at, prepended by `http://`, e.g. `HOST=http://music.mydomain.com`
- Set the port to a random number, e.g. `PORT=4444`

#### For local use/testing:
- In host network mode, either set `PORT=80` (HTTP only), or `HOST=localhost` (HTTPS via self-signed certificate).
- In bridge network mode, either set `PORT=80` (HTTP only), or `HOST` to the container's IP (HTTPS via self-signed certificate).

## Pointing to the folder with your music
Create a folder `library` next to `docker-compose.yml` or replace `./library` with your music folder on the host system.

## Creating the container
Use `docker compose up -d` to build the image and to create the container.

## Changing settings
- A volume called `<something>mfp` will be created, which is usually located in `/var/lib/docker/volumes`. Inside, you'll find the `music.ini`.
- Either copy `music.defaults.ini` to `music.ini` and change the values, or set only the variables you'd like to change (recommended, but don't forget including the lines [server] and [client] and to correctly position the variables underneath them).