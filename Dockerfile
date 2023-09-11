FROM docker.io/alpine

ENV ADDRESS=
ENV PORT=

WORKDIR /app
COPY Caddyfile .
COPY update.sh .
RUN mkdir srv;\
 chmod 500 update.sh;\
 ./update.sh

RUN apk add --no-cache caddy nss-tools php81-fpm zip;\
 sed -i 's/127.0.0.1:9000/\/var\/run\/php-fpm.sock/g' /etc/php81/php-fpm.d/www.conf;\
 printf "0    5    *    *    1    /app/update.sh" > /etc/crontabs/root

RUN mkdir cfg cfg/playlists;\
 chmod 777 cfg/playlists;\
 ln -s /app/cfg/playlists /app/srv/music.pls;\
 cp srv/music.defaults.ini cfg/music.ini;\
 chmod 777 cfg/music.ini;\
 ln -s /app/cfg/music.ini /app/srv/music.ini

#EXPOSE $PORT 80 443

VOLUME /app/cfg /app/srv/library

CMD crond -L /app/cfg/update.log; /usr/sbin/php-fpm81 -D; caddy run