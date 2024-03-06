FROM docker.io/alpine

ENV HOST=
ENV PORT=

WORKDIR /app
COPY Caddyfile .
COPY update.sh .
RUN mkdir data srv;\
 chmod 500 update.sh

RUN apk add --no-cache caddy nss-tools php83-fpm zip;\
 sed -i 's/127.0.0.1:9000/\/var\/run\/php-fpm.sock/g' /etc/php83/php-fpm.d/www.conf;\
 printf "0    5    *    *    1    /app/update.sh >> /app/data/update.log" > /app/crontab.txt;\
 crontab /app/crontab.txt

VOLUME /app/data /app/srv/library

#EXPOSE $PORT 80 443

CMD /app/update.sh >> /app/data/update.log; crond -l 0 -L /app/data/crond.log; /usr/sbin/php-fpm83 -D; caddy run