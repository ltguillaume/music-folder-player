echo ==== `date` ====

apk -U upgrade --no-cache
cd /app/srv

repo=ltguillaume/music-folder-player
commit=`wget -q -O- "https://codeberg.org/api/v1/repos/$repo/commits?limit=1&stat=false&verification=false&files=false" | jq --raw-output '.[0].sha'`
touch /app/data/commit
if [ -f /app/srv/index.html ] && [ "$commit" == "`cat /app/data/commit`" ]; then
	echo "Already using the latest commit ($commit)"
	exit
fi

rm $commit.zip > /dev/null

wget "https://codeberg.org/$repo/archive/$commit.zip"
if [ $? == 0 ]; then
	if [ "$(unzip -jo $commit.zip */music.*)" ]; then
		echo $commit > /app/data/commit
	else
		echo "Error ($?) while extracting the archive $commit.zip."
		exit
	fi
else
	echo "Error ($?) while downloading the archive https://codeberg.org/$repo/archive/$commit.zip."
	exit
fi

cp -f music.defaults.ini ../data
mv music.htm index.html
rm $commit.zip

if [ ! -d /app/data/playlists ]; then
	mkdir /app/data/playlists
	chmod 777 /app/data/playlists
fi
if [ ! -f /app/data/music.ini ]; then
	touch /app/data/music.ini
	chmod 777 /app/data/music.ini
fi
if [ ! -d /app/srv/music.pls ]; then
	ln -s /app/data/playlists /app/srv/music.pls
fi
if [ ! -f /app/srv/music.ini ]; then
	ln -s /app/data/music.ini /app/srv/music.ini
fi

echo Using commit https://codeberg.org/$repo/commit/$commit