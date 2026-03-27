# TIMETRACK

Application de suivi du temps de travail en self-hosted, construite avec React + TypeScript (frontend) et PHP + MySQL (backend).

![Version](https://img.shields.io/badge/version-1.4-blue)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20PHP%20%2B%20MySQL-green)

---

## Fonctionnalités

### Suivi du temps
- **Pointage** : horodatage d'arrivée et de départ en un clic
- **Chronomètre en direct** : affichage du temps travaillé en temps réel
- **Pause déjeuner** : suivi automatique avec alerte de rappel
- **Seuil de départ** : notification quand 80 % des heures requises sont atteints
- **Heure de départ minimum** : configurable par utilisateur (avec toggle)
- **Édition inline** : modification directe des heures clock-in / clock-out

### Historique
- Consultation de tout l'historique de sessions
- Filtres par plage de dates et par type (travail / pause)
- Ajout de sessions passées ou futures manuellement
- Édition et suppression de sessions avec confirmation

### Statistiques
- Moyennes d'heure d'arrivée, de départ, de pause et de temps travaillé
- Total des jours travaillés et des heures
- Plages filtrables : semaine courante, 7j, 14j, 30j

### Paramètres utilisateur
- Modification du nom d'utilisateur et du mot de passe
- Mode sombre / clair (persisté en base)
- Configuration : heures de travail requises, durée de pause déjeuner, seuil de départ (%)
- Gestion des heures supplémentaires (compensation)
- Export des données (JSON / CSV) et import
- Suppression complète du compte (cascade sur toutes les données)

### Autres
- Interface 100 % responsive (mobile inclus)
- Changelog intégré avec notification des nouvelles versions
- Authentification par session PHP sécurisée (cookie httpOnly)

---

## Architecture

```
TIMETRACK/
├── api/                  # Backend PHP (Apache + PDO)
│   ├── auth.php          # Login, register, logout, session
│   ├── sessions.php      # CRUD des sessions de travail
│   ├── users.php         # CRUD utilisateurs
│   ├── preferences.php   # CRUD préférences utilisateur
│   ├── helpers.php       # PDO, CORS, session, UUID, casting
│   └── config.php        # Config BDD (non versionné)
├── src/                  # Frontend React + TypeScript
│   ├── components/       # Composants UI (TimeTracker, Settings, Statistics…)
│   ├── contexts/         # AuthContext
│   ├── hooks/            # useClickOutside
│   └── lib/              # api-client.ts, changelog.ts, dataTransfer.ts
├── docker/               # Dockerfile PHP 8.2 + Apache
├── migration.sql         # Schéma initial MySQL
├── docker-compose.yml    # Orchestration dev (MySQL + PHP)
└── vite.config.ts        # Proxy /api → PHP en dev
```

**Communication :** le frontend envoie des requêtes `POST /api/*.php` en JSON. L'authentification utilise des cookies de session PHP (httpOnly, SameSite=Lax).

---

## Base de données

3 tables MySQL (utf8mb4) :

| Table | Description |
|---|---|
| `users` | Comptes utilisateurs (UUID, username, bcrypt hash) |
| `user_preferences` | Préférences par utilisateur (1 ligne par user) |
| `work_sessions` | Sessions de travail (clock_in, clock_out, pause) |

Le schéma complet est dans [migration.sql](migration.sql).

---

## Setup — Développement (Docker)

### Prérequis
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) 18+

### Démarrage

```bash
# 1. Copier la config PHP
cp api/config.example.php api/config.php

# 2. Lancer MySQL + PHP (migration.sql appliqué automatiquement)
docker-compose up -d

# 3. Installer les dépendances Node
npm install

# 4. Créer le fichier d'environnement frontend
cp .env.example .env

# 5. Lancer le serveur de développement
npm run dev
```

L'application est accessible sur [http://localhost:5173](http://localhost:5173).
Le proxy Vite redirige `/api/*` vers `http://localhost:8080` (conteneur PHP).

### Variables d'environnement

**.env** (frontend) :
```
VITE_API_URL=/api
```

Les variables du backend sont dans `docker-compose.yml` :
```
DB_HOST=db
DB_NAME=timetrack
DB_USER=timetrack_user
DB_PASS=timetrack_pass
ALLOWED_ORIGINS=http://localhost:5173
```

---

## Setup — Production (Plesk / Apache)

### Frontend

```bash
npm run build
```

Déployer le contenu du dossier `dist/` dans la racine web (document root) de votre hébergeur.

Créer un fichier `.env.production` avec l'URL absolue de votre API :
```
VITE_API_URL=https://votre-domaine.com/api
```

### Backend PHP

1. Déposer le dossier `api/` dans un sous-dossier accessible (ex. `https://votre-domaine.com/api/`)
2. Copier `api/config.example.php` → `api/config.php` et renseigner vos credentials MySQL :

```php
define('DB_HOST',    'localhost');
define('DB_PORT',    3306);
define('DB_NAME',    'timetrack');
define('DB_USER',    'votre_user');
define('DB_PASS',    'votre_password');
define('ALLOWED_ORIGINS', 'https://votre-domaine.com');
```

3. Importer `migration.sql` dans votre base MySQL via phpMyAdmin ou la ligne de commande :

```bash
mysql -u votre_user -p timetrack < migration.sql
```

4. Vérifier que PHP 8.x est actif avec les extensions `pdo_mysql` et `json`.

### Sécurité en production

Dans `docker/php/php.ini` ou la config PHP de Plesk :
```ini
session.cookie_secure = 1    # HTTPS requis
display_errors = Off
```

---

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement Vite (hot reload) |
| `npm run build` | Build de production vers `dist/` |
| `npm run preview` | Prévisualiser le build de production |
| `npm run lint` | Vérification ESLint |
| `npm run typecheck` | Vérification TypeScript sans compilation |

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS 3 (mode dark via classe) |
| Icônes | Lucide React |
| Backend | PHP 8.2, Apache |
| Base de données | MySQL 8.0, PDO (prepared statements) |
| Auth | Sessions PHP (cookie httpOnly, SameSite=Lax) |
| Dev | Docker Compose (MySQL + PHP) |

---

## Changelog

### v1.4 — 10 mars 2026
- Interface 100 % compatible mobile
- Migration de Supabase vers un backend PHP/MySQL self-hosted
- UUIDs opaques, audit sécurité complet

### v1.3 — 2 mars 2026
- Sessions planifiées (entrées futures)
- Logique intelligente de calcul du temps restant

### v1.2 — 27 février 2026
- Toggle heure de départ minimum
- Saisie manuelle de l'heure personnalisée

### v1.1 — 24 février 2026
- Heure de départ minimum configurable
- Adaptation de la recommandation de pause déjeuner
