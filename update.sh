echo `date`

apk -U upgrade --no-cache
cd /app/srv
wget https://codeberg.org/ltguillaume/music-folder-player/archive/main.zip
unzip -jo main.zip */music.*
cp -f music.defaults.ini ../data
mv music.htm index.html
rm main.zip

if [ ! -d /app/data/playlists ]; then
	mkdir /app/data/playlists
	chmod 777 /app/data/playlists
	ln -s /app/data/playlists /app/srv/music.pls
fi
if [ ! -f /app/data/music.ini ]; then
	touch /app/data/music.ini
	chmod 777 /app/data/music.ini
	ln -s /app/data/music.ini /app/srv/music.ini
fi