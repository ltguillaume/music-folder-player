apk -U upgrade --no-cache
cd /app/srv
wget https://codeberg.org/ltguillaume/music-folder-player/archive/main.zip
unzip -jo main.zip */music.*
cp -f music.defaults.ini ../data
mv music.htm index.html
rm main.zip