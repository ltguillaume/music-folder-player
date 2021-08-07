apk -U upgrade --no-cache
cd /app/srv
wget https://github.com/ltGuillaume/MusicFolderPlayer/archive/refs/heads/master.zip
unzip -jo master.zip */music.* -x *.md
mv music.htm index.html
rm master.zip