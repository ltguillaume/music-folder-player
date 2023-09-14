# Music Folder Player for Docker
The provided Docker template should build a set-it-and-forget-it container with an environment that updates the system, PHP8, Caddy and MFP weekly. Caddy should automatically get you an SSL certificate.

Download and edit `docker-compose.yml` as follows:

## Setting the environment variables
#### For outside access
- Set `ADDRESS` to the (sub)domain or external IP you want MFP to be reached at, e.g. `ADDRESS=music.mydomain.com`
- Clear the port number: `PORT=`

#### Behind a reverse proxy
- To let your reverse proxy handle SSL certificates, set `ADDRESS` to the (sub)domain or external IP you want MFP to be reached at, prepended by `http://`, e.g. `ADDRESS=http://music.mydomain.com`
- Set the port to a random number, e.g. `PORT=4444`

#### For local use/testing:
- In host network mode, either set `PORT=80` (HTTP only), or `ADDRESS=localhost` (HTTPS via self-signed certificate).
- In bridge network mode, either set `PORT=80` (HTTP only), or `ADDRESS` to the container's IP (HTTPS via self-signed certificate).

## Pointing to the folder with your music
Create a folder `library` next to `docker-compose.yml` or replace `./library` with your music folder on the host system.