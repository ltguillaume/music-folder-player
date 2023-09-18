FROM docker.io/alpine

ENV HOST=
ENV PORT=

WORKDIR /app
COPY Caddyfile .
COPY update.sh .
RUN mkdir data srv;\
 chmod 500 update.sh;\
 ./update.sh

RUN apk add --no-cache caddy nss-tools php81-fpm zip;\
 sed -i 's/127.0.0.1:9000/\/var\/run\/php-fpm.sock/g' /etc/php81/php-fpm.d/www.conf;\
 printf "0    5    *    *    1    /app/update.sh" > /etc/crontabs/root

RUN mkdir data data/playlists;\
 chmod 777 data/playlists;\
 ln -s /app/data/playlists /app/srv/music.pls;\
 cp srv/music.defaults.ini data/;\
 touch data/music.ini;\
 chmod 777 data/music.ini;\
 ln -s /app/data/music.ini /app/srv/music.ini

#EXPOSE $PORT 80 443

VOLUME /app/data /app/srv/library

CMD crond -L /app/data/update.log; /usr/sbin/php-fpm81 -D; caddy run