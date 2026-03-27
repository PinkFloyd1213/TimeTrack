FROM php:8.2-apache

# Extensions nécessaires
RUN docker-php-ext-install pdo pdo_mysql

# Activer mod_rewrite (utile si on ajoute des routes plus tard)
RUN a2enmod rewrite

# Config PHP : sessions sécurisées + affichage des erreurs en dev
COPY php.ini /usr/local/etc/php/conf.d/app.ini

# Le document root Apache pointe sur /var/www/html
# L'API sera accessible via http://localhost:8080/api/*.php
