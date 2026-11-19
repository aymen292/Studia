# Studia

Studia est une petite application web (PWA) de planification de révisions, en français et **100 % côté navigateur**. Elle fonctionne hors-ligne, sans compte, sans serveur de données et sans dépendances à installer.

Tu crées des **UE** (modules) avec des **chapitres**, puis tu organises tes séances dans un **agenda hebdomadaire** :
- en mode **Basique**, tu places les créneaux manuellement ;
- en mode **Avancé**, tu peux en plus générer automatiquement un planning de tes chapitres restants.

Dans les deux modes, chaque chapitre terminé est **revu plusieurs fois** (3, 5 ou 7 au choix) grâce à des révisions espacées programmées automatiquement (par défaut 3 révisions à J+3, J+7 et J+16).

---

## Lancer l'application

Il n'y a **rien à installer ni à compiler** : ce sont des fichiers HTML/CSS/JS statiques. Il faut juste les servir via un petit serveur HTTP local.

### Avec Python (le plus simple)

```bash
cd "$HOME/Desktop/BELLATRECHE Aymen/Projets/Studia"
python3 -m http.server 8000
```

Puis ouvre dans ton navigateur :

```
http://localhost:8000/
```

Pour arrêter le serveur, fais `Ctrl+C` dans le terminal.

> Le port 8000 est déjà occupé ? Utilise un autre port, par exemple `python3 -m http.server 8080`, puis ouvre `http://localhost:8080/`.

N'importe quel serveur statique fonctionne aussi, par exemple `npx serve .` si Node est installé.

### Important

- Ne ouvre pas `index.html` en double-cliquant dessus (`file://...`) : les modules JavaScript ES sont bloqués par le navigateur. Passe toujours par `http://`.
- Le service worker (mode hors-ligne) nécessite un contexte sécurisé : `localhost` ou HTTPS. Sur une simple adresse LAN du type `http://192.168.x.x:8000`, l'appli s'affiche mais le cache hors-ligne peut ne pas s'activer.
- Pour installer l'appli sur un téléphone, héberge-la en HTTPS, puis utilise « Ajouter à l'écran d'accueil » depuis le navigateur.

---

## Prise en main

### 1. Premier lancement

Au premier démarrage, une fenêtre d'accueil te demande de choisir un mode :

- **Basique** : tu crées tes séances toi-même dans l'agenda.
- **Avancé** : tu gardes la saisie manuelle et tu gagnes le bouton « Générer mon planning ».

Ce choix est modifiable à tout moment dans **Réglages**.

### 2. Mes UE

Depuis l'onglet **Mes UE** :

- crée une UE avec un nom, une couleur et des chapitres (un chapitre par ligne) ;
- modifie ou supprime une UE ;
- coche les chapitres déjà terminés.

Supprimer une UE ou un chapitre supprime aussi les séances associées.

### 3. Agenda

Depuis l'onglet **Agenda** :

- navigue entre les semaines avec les flèches ou reviens à « Aujourd'hui » ;
- clique sur un créneau horaire libre pour créer une séance : jour, heure, UE, chapitre ;
- clique sur un bloc de séance pour voir le détail.

Dans le détail d'une séance, tu peux la marquer **Terminé** (le chapitre est alors coché automatiquement) ou **Pas fini**. Dans ce dernier cas, l'appli te propose de reprogrammer la séance quelques jours plus tard.

Les créneaux manuels sont vérifiés : l'heure de fin doit être après l'heure de début et il ne doit pas y avoir de chevauchement avec une autre séance.

### 4. Mode Avancé : génération automatique

En mode Avancé, un bouton « Générer » apparaît dans la barre de l'agenda.

Le générateur :

1. récupère tous les chapitres non terminés ;
2. supprime les anciennes séances **automatiques** (les séances manuelles sont conservées) ;
3. place les séances à partir d'aujourd'hui, dans la plage horaire définie dans les réglages ;
4. alterne les UE (chapitre 1 de A, chapitre 1 de B, chapitre 2 de A…) en gardant l'ordre des chapitres ;
5. remplit chaque jour jusqu'à la charge max (rythme soutenu), mais répartit équitablement entre les jours nécessaires (ex. 5 chapitres avec 4 séances/jour max → 3 + 2) ;
6. étale les séances d'une même journée (matin, après-midi, soir) au lieu de les enchaîner, en évitant la pause déjeuner (12h–13h, désactivable) ;
7. garde de la place les jours où tomberont les révisions de chaque chapitre.

Les séances générées sont marquées `auto` : tu peux donc les modifier ou les supprimer comme les autres, mais une nouvelle génération les remplacera.

### 5. Révisions espacées (3, 5 ou 7 par chapitre)

Dès qu'un chapitre est terminé (bouton « Terminé » sur un créneau, ou case cochée dans « Mes UE »), Studia programme des révisions dans tes créneaux libres. Tu choisis dans les Réglages **combien** (3, 5 ou 7) et **à quel rythme** (jours après la fin du chapitre) :

| Rythme | R1 | R2 | R3 | R4 | R5 | R6 | R7 |
|---|---|---|---|---|---|---|---|
| Intensif | J+1 | J+4 | J+10 | J+18 | J+30 | J+45 | J+60 |
| **Équilibré** (défaut) | **J+3** | **J+7** | **J+16** | J+30 | J+50 | J+75 | J+110 |
| Long terme | J+4 | J+12 | J+30 | J+50 | J+80 | J+120 | J+180 |

Passer de 3 à 5 révisions ajoute les révisions manquantes aux chapitres déjà terminés, dans la continuité de la dernière ; revenir à 3 retire celles en trop encore à venir.

Le placement est automatique et adaptatif :

- chaque révision prend le premier créneau libre du jour visé, dans ta plage horaire, sans dépasser ta charge max par jour, avec la pause, et en évitant le dimanche si l'option est active (sinon elle glisse au lendemain) ;
- **Bien retenu** : la révision est validée (et rangée à aujourd'hui si tu l'as faite en avance) ; la suite est recalculée à partir d'aujourd'hui pour garder un vrai écart ;
- **À revoir** : la même révision est refaite dès le lendemain (marquée « à refaire » dans la liste) et toute la suite est recalée à partir de là ;
- les révisions oubliées (passées sans réponse) sont signalées « en retard » et le bouton **Les replacer** les reprogramme dès aujourd'hui ;
- décocher un chapitre annule ses révisions à venir ;
- quand toutes ses révisions sont réussies, le chapitre est **maîtrisé**.

Les prochaines révisions et l'avancée par UE sont visibles dans le panneau latéral de l'agenda (sur grand écran), et chaque chapitre affiche ses pastilles de progression dans « Mes UE ».

### 6. Réglages

L'onglet **Réglages** permet de :

- changer de mode ;
- activer/désactiver les révisions espacées, choisir leur rythme et leur durée ;
- régler la durée des séances, le délai de reprogrammation, les horaires de travail, la pause et le nombre d'heures max par jour ;
- ignorer le dimanche ;
- **exporter** toutes tes données en JSON ;
- **importer** une sauvegarde JSON ;
- **réinitialiser** l'application (retour à l'accueil de premier lancement).

Exporte régulièrement une sauvegarde si tu utilises beaucoup l'appli : les données vivent dans le navigateur.

---

## Fonctionnement technique

### Stack

- HTML statique, CSS vanilla, JavaScript ES modules natifs.
- Aucun framework, aucun bundler, aucune base de données, aucun backend.
- Interface responsive, plein écran sans défilement sur l'agenda (la journée s'adapte à la hauteur de l'écran), thème rose poudré.
- Données et formatage des dates en français.

### Structure du projet

```text
.
├── index.html                Structure de l'application
├── manifest.webmanifest      Configuration PWA / installation
├── sw.js                     Service worker (cache hors-ligne)
├── css/
│   └── style.css             Tous les styles
├── js/
│   ├── app.js                Démarrage, navigation, rendu global
│   ├── store.js              État, persistance localStorage, import/export
│   ├── calendar.js           Agenda, créneaux, modales de séance
│   ├── scheduler.js          Génération automatique du planning
│   ├── reviews.js            Révisions espacées et replanification
│   ├── slots.js              Recherche de créneaux libres
│   ├── modules.js            Gestion des UE et chapitres
│   ├── settings.js           Réglages, onboarding, aide, sauvegardes
│   ├── ui.js                 Modales et notifications toast
│   └── utils.js              Dates, IDs et helpers
├── icons/                    Icônes de l'application
│   └── ui/                   Icônes d'interface (SVG)
└── images/                   Illustrations (SVG)
```

### Données

Tout l'état est stocké dans une seule clé `localStorage` :

```text
studia.state.v1
```

Il contient notamment le mode choisi, les réglages, la liste des UE/chapitres et la liste des séances. Chaque modification est sérialisée en JSON puis sauvegardée immédiatement. Les abonnés au store sont ensuite notifiés pour redessiner l'interface.

Aucune donnée ne quitte ton appareil. Effacer les données du site supprime donc tes UE et tes séances, sauf si tu as exporté une sauvegarde.

### Hors-ligne et PWA

Le service worker `sw.js` met en cache l'application :

- les requêtes de navigation sont servies en priorité depuis le réseau, avec repli sur `index.html` ;
- les autres fichiers sont servis depuis le cache, puis mis en cache lors d'un chargement en ligne.

Après une modification du code, un simple rechargement peut encore afficher l'ancienne version. Dans ce cas :

1. fais un rechargement forcé (`Ctrl+F5`) ;
2. si nécessaire, incrémente `CACHE_NAME` dans `sw.js` (par exemple `studia-v3` → `studia-v4`) ;
3. ou supprime les données du site depuis les outils de développement.

La liste `APP_SHELL` de `sw.js` doit être tenue à jour lors de l'ajout de nouveaux fichiers importants. Les fichiers non listés sont tout de même mis en cache au premier chargement en ligne.

### À savoir

- Il n'y a **pas de notifications push, ni d'alarme** : les retours sont uniquement des messages dans l'application.
- La génération automatique part toujours d'aujourd'hui, pas de la semaine affichée.
- Le délai de reprogrammation des réglages s'applique au bouton « Pas fini » ; les révisions espacées suivent le rythme choisi dans « Révisions espacées ».
- Marquer une séance « Terminé » coche le chapitre, mais supprimer la séance ne décoche pas le chapitre.
- L'import JSON vérifie surtout que `ues` et `sessions` sont des tableaux : importe de préférence un fichier exporté par Studia.

---

## Dépannage

| Symptôme | Solution |
|---|---|
| Page blanche ou erreur CORS | Sers le dossier via HTTP, pas avec `file://` |
| Ancienne version après une modification | `Ctrl+F5`, ou augmentation de `CACHE_NAME` dans `sw.js` |
| Le port 8000 est occupé | Change de port : `python3 -m http.server 8080` |
| Je veux repartir de zéro | Réglages → Réinitialiser, ou supprime `studia.state.v1` du localStorage |
| L'installation PWA ne propose pas | Vérifie que le site est en `localhost` ou en HTTPS |

---

## Crédits des images

- Icônes d'interface : [Lucide](https://lucide.dev) (licence ISC), dans `icons/ui/`.
- Nœud du logo : [IconPark](https://github.com/bytedance/IconPark) (licence Apache 2.0), `icons/ui/bow.svg`.
- Illustrations : [unDraw](https://undraw.co) (licence libre unDraw, sans attribution obligatoire), recolorées en rose, dans `images/`.
