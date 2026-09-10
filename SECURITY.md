# Politique de sécurité du développement

Ce document rassemble les pratiques appliquées au développement de Kura. Il
décrit ce qui est en place, pas une cible.

## Portes bloquantes

Aucun code n'est publié sans avoir passé une série de contrôles automatisés.
Ils sont répartis sur les deux dépôts du projet, chacun couvrant les
technologies qui lui sont propres.

| Contrôle | Outil | Portée | Seuil de blocage |
|---|---|---|---|
| Analyse statique du code | gosec | 8 services Go | sévérité MEDIUM |
| Configuration d'infrastructure | checkov | OpenTofu, Kubernetes | tout constat non excepté |
| Secrets committés | gitleaks | historique complet | toute détection |
| Vulnérabilités des dépendances | grype, sur SBOM syft | conteneurs et modules | sévérité High |
| Scripts et playbooks | shellcheck, ansible-lint | amorçage des machines | toute erreur |
| Tests unitaires | go test, vitest | services Go et frontend | tout échec |

L'inventaire logiciel (SBOM) est produit avant l'analyse : il dit ce qui est
embarqué, indépendamment des vulnérabilités connues du jour. Les deux questions
sont distinctes et n'ont pas la même durée de validité.

## Revue et fusion

La branche principale est protégée par une règle de dépôt : la fusion passe
obligatoirement par une demande, les dix-huit contrôles doivent être verts, et
ni la suppression de la branche ni la réécriture d'historique ne sont
autorisées. La règle s'applique sans exception, y compris aux administrateurs :
un contrôle rouge bloque la fusion, il ne se contourne pas.

L'approbation par un tiers n'est pas exigée, le dépôt n'ayant qu'un mainteneur.
C'est une limite assumée : la revue humaine repose sur la relecture de sa
propre demande, et seuls les contrôles automatisés sont réellement
contraignants.

## Traitement d'un constat

Un constat se corrige. À défaut, il fait l'objet d'une exception nominative et
motivée, jamais d'un abaissement du seuil de gravité : le reste de l'analyse
reste bloquant, et l'exception se relit comme le reste du code.

Chaque exception indique pourquoi le risque est accepté, ce qui le compense, et
à quelle condition elle doit tomber. Une exception sans compensation est une
vulnérabilité qu'on a décidé d'ignorer.

Les exceptions de configuration d'infrastructure vivent dans `.checkov.yml` du
dépôt Kuro. Les rares exceptions de code portent un commentaire `#nosec` suivi
de sa justification, sur la ligne concernée.

Le contournement est un risque réel et connu : la première correction du
constat G304 sur la copie du cache de fournisseurs a été un `#nosec`. En
reprenant l'analyse, l'outil a signalé un G122, une possibilité de traversée
par lien symbolique entre le parcours du répertoire et l'ouverture du fichier.
La correction retenue a été de scoper les accès avec `os.Root` plutôt que de
faire taire l'avertissement. C'est la règle : on ne masque un constat qu'après
avoir compris ce qu'il désigne.

## Sécurité dès la conception

Les charges déployées sont durcies par défaut dans le chart Helm, sans réglage
à la charge de l'exploitant :

- exécution sous un utilisateur non privilégié, jamais root ;
- racine du conteneur en lecture seule, les répertoires réellement écrits étant
  déclarés explicitement ;
- toutes les capacités Linux retirées, élévation de privilèges interdite ;
- profil seccomp par défaut du runtime.

Les images le respectent aussi hors orchestrateur : elles déclarent leur
utilisateur, et leur binaire est placé hors des répertoires réservés à root.

Les droits d'accès à l'API Kubernetes sont accordés au plus juste : le
collecteur de métriques dispose d'un Role limité à son namespace, pas d'un
ClusterRole.

## Secrets

Aucun secret n'entre dans un dépôt, et gitleaks vérifie l'historique complet à
chaque exécution, un secret retiré restant lisible dans les commits antérieurs.

Les secrets d'exécution sont fournis par l'exploitant sous forme de Secret
Kubernetes, jamais versionné. Les identifiants que la plateforme utilise pour
joindre les systèmes externes sont chiffrés au repos avec une clé maître
distincte, dont la perte rend ces valeurs illisibles : elle se sauvegarde avec
la base.

## Dépendances

Renovate ouvre les montées de version le samedi avant 6 h, hors trafic. Les
correctifs et versions mineures sont fusionnés automatiquement une fois les
contrôles verts ; les versions majeures ouvrent une demande étiquetée, examinée
en revue.

Les images de base des outils d'analyse sont épinglées par empreinte et non par
étiquette : une étiquette peut être republiée sur un registre, une empreinte
non.

## Limites connues

- Aucune analyse dynamique (DAST) n'est en place : l'analyse est statique et
  porte sur le code, les dépendances et la configuration.
- Le cloisonnement réseau entre pods n'est pas encore déclaré : tout pod du
  namespace peut joindre les briques de données.
- La revue de code n'est pas contradictoire : le dépôt n'a qu'un mainteneur,
  aucune approbation par un tiers n'est donc exigée.
