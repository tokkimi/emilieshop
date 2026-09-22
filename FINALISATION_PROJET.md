# Mémoire Maison — plan de finalisation

Mise à jour : 22 septembre 2026. Cette liste distingue ce qui existe vraiment, ce qui est codé mais attend des clés, et ce qui exige encore un fournisseur, un compte externe ou une décision d’Émilie.

## Ajouts déjà réalisés sans Stripe

- [x] Architecture Supabase actuelle prête pour Vercel : authentification par lien courriel, sessions SSR par cookies, base Postgres et stockage privé.
- [x] Migration complète versionnée pour profils, projets, médias, livres, validations, commandes, professionnels, invitations, Memory Links, messagerie, newsletter, analytics, paramètres, audit et demandes de données.
- [x] RLS activée sur toutes les tables exposées, politiques par propriétaire et droits Data API explicitement limités.
- [x] Politiques Storage privées avec contrôle du propriétaire et arborescence par utilisateur.
- [x] Adaptateurs Supabase ajoutés aux projets, médias, compositions, validations, messages, newsletter et analytics.
- [x] Connexion/création de compte bilingue sans mot de passe prête à activer.
- [x] Profil réel séparé de la démonstration : aucun faux projet ou faux achat dans un vrai compte.
- [x] Export complet des données du client et demande de suppression avec validation humaine.
- [x] Empreinte SHA-256 de la version approuvée et refus d’afficher « approuvé » si le serveur échoue.
- [x] Centre de lancement dans l’administration avec état réel des intégrations et verrous.
- [x] Dépendances Supabase épinglées, compilation validée et audit de production à 0 vulnérabilité.

### Activation restante pour ces ajouts

- [x] Créer le projet Supabase de production `emilieshop` au Canada et appliquer la migration.
- [x] Créer le bucket privé `project-media` avec limite de 50 Mo et types de fichiers autorisés.
- [x] Ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` à Vercel pour Production, Preview et Development.
- [ ] Ajouter `SUPABASE_SECRET_KEY` à Vercel après authentification au tableau de bord Supabase.
- [ ] Autoriser les redirections `https://emilieshop.vercel.app/auth/callback` dans Supabase Auth.
- [ ] Configurer le SMTP personnalisé pour les liens de connexion et tester une vraie boîte courriel.
- [ ] Attribuer le rôle propriétaire au compte d’Emilie et tester l’isolation de deux comptes distincts.

## État actuel

### Déjà opérationnel

- [x] Site public premium en français et en anglais.
- [x] Version mobile et navigation principales.
- [x] Atelier en quatre étapes avec dix questions, options et calcul du prix.
- [x] Ajout de photos, vidéos et fichiers audio.
- [x] Composition automatique d’un premier livre avec solution de repli fiable.
- [x] Aperçu page par page avant impression.
- [x] Modification des textes, photos, mises en page et ordre des pages.
- [x] Validation explicite de la version du livre.
- [x] Base de données structurée pour utilisateurs, projets, médias, commandes, approbations, professionnels, messages, newsletter, statistiques et Memory Links.
- [x] Stockage privé des médias et vérification de leur propriétaire.
- [x] Authentification des profils et de l’administration.
- [x] Accès administrateur limité au compte propriétaire autorisé.
- [x] Profils de démonstration client et administration séparés des accès réels.
- [x] Pages légales FR/EN, consentements, livraison et retours.
- [x] Carte de partage, métadonnées bilingues, sitemap, robots et pages privées exclues des moteurs de recherche.
- [x] Formulaire d’inscription newsletter avec consentement explicite.

### Présent comme démonstration, mais pas encore relié aux opérations réelles

- [ ] Tableaux financiers et chiffres d’affaires de l’administration.
- [ ] Gestion complète des utilisateurs et rôles depuis l’interface.
- [ ] Envoi réel des campagnes newsletter.
- [ ] Messagerie bidirectionnelle administrateur-client en temps réel.
- [ ] Invitations vendeurs et gestion des crédits B2B.
- [ ] Gestion éditoriale des pages et articles depuis l’administration.
- [ ] Suivi réel d’impression et de livraison.
- [ ] Production automatique du QR/NFC et du Memory Link privé définitif.

## Bloquants avant d’accepter de vraies commandes

### 1. Identité commerciale et légale

- [x] Confirmer le nom légal : Emilie Cauvier Inc.
- [x] Confirmer le territoire principal : Montréal–Laval, Québec, Canada.
- [ ] Fournir l’adresse commerciale à afficher sur les contrats, factures et courriels.
- [ ] Fournir le téléphone de service à la clientèle.
- [ ] Confirmer les numéros d’entreprise, TPS et TVQ lorsqu’applicables.
- [x] Utiliser provisoirement Emilie Cauvier et `emilie@equipecauvier.com` comme contact public et responsable de la protection des renseignements personnels.
- [ ] Faire relire les CGV, la confidentialité, les consentements et les règles de remboursement par un juriste québécois.
- [ ] Fixer la durée de conservation des projets, médias, enregistrements vocaux et Memory Links.
- [ ] Définir la procédure de demande d’accès, correction, export et suppression des données.

### 2. Produits et prix

- [ ] Choisir définitivement le format du livre Essentiel : dimensions, pages incluses, papier, couverture et reliure.
- [ ] Choisir le format du livre Souvenir et les différences réellement livrées.
- [ ] Confirmer si l’offre Famille contient deux ou trois exemplaires.
- [ ] Fixer le prix des pages supplémentaires, copies, coffrets, films, cadres et QR/NFC.
- [ ] Déterminer si la livraison est incluse ou calculée séparément.
- [ ] Définir les taxes par province et les ventes futures aux États-Unis.
- [ ] Définir les délais annoncés pour rédaction, validation, impression et livraison.
- [ ] Définir les frais de correction après approbation et les règles de réimpression.

### 3. Imprimeur

- [ ] Ouvrir un compte Prodigi et créer une clé d’essai.
- [ ] Commander un exemplaire Hardcover carré 21 × 21 cm.
- [ ] Commander un exemplaire Layflat carré avec le même contenu.
- [ ] Commander le même prototype chez Pikto ou Photo Laplante pour comparaison.
- [ ] Vérifier couleurs, contraste, lisibilité, bords perdus, pli central, couverture, emballage et dommages de transport.
- [ ] Choisir le fournisseur principal et un fournisseur de secours.
- [ ] Obtenir le coût exact livré à Laval pour 1, 10, 25 et 50 exemplaires.
- [ ] Obtenir les gabarits définitifs : fond perdu, zone sûre, couverture, dos et profil PDF/X.
- [ ] Confirmer l’emballage sans marque, les retours, réimpressions et numéros de suivi.
- [ ] Brancher l’API seulement après validation physique des prototypes.

### 4. Fichier imprimable

- [ ] Produire un PDF/X conforme au gabarit du fournisseur choisi.
- [ ] Générer séparément l’intérieur et la couverture lorsque requis.
- [ ] Calculer automatiquement la largeur du dos selon le papier et le nombre de pages.
- [ ] Convertir les images et couleurs selon le profil recommandé par l’imprimeur.
- [ ] Vérifier la résolution minimale et signaler les photos trop petites.
- [ ] Effectuer un contrôle de débordement, polices incorporées, transparences et pages manquantes.
- [ ] Conserver le PDF exact approuvé avec son empreinte et son horodatage.
- [ ] Empêcher toute modification après approbation sans créer une nouvelle version.

### 5. Paiements

- [ ] Créer et vérifier le compte Stripe de l’entreprise.
- [ ] Relier le compte bancaire professionnel.
- [ ] Créer les produits, options et règles fiscales.
- [ ] Mettre en place le paiement sécurisé et les reçus bilingues.
- [ ] Ajouter le traitement fiable des confirmations, échecs, remboursements et litiges.
- [ ] Interdire l’impression si le paiement ou l’approbation manque.
- [ ] Tester des paiements réussis, refusés, doublés et remboursés en mode test.

### 6. Comptes clients

- [ ] Choisir une connexion publique sans mot de passe, adaptée aux clients qui n’ont pas de compte ChatGPT.
- [ ] Configurer l’adresse d’envoi et le modèle du courriel de connexion.
- [ ] Prévoir invitation, expiration, renvoi du lien et changement d’adresse courriel.
- [ ] Charger les vrais projets, commandes, messages et Memory Links dans le profil connecté.
- [ ] Ajouter l’export des données et la demande de suppression.
- [ ] Tester qu’un utilisateur ne peut jamais ouvrir les projets ou médias d’un autre.

### 7. Courriels et notifications

- [ ] Activer le domaine d’envoi et ses protections SPF, DKIM et DMARC.
- [ ] Créer les courriels FR/EN : bienvenue, invitation, brouillon, rappel, aperçu prêt, approbation, paiement, impression, expédition, livraison et expiration du Memory Link.
- [ ] Configurer les réponses vers une boîte surveillée par Émilie.
- [ ] Ajouter le désabonnement newsletter en un clic et la preuve de consentement.
- [ ] Prévoir les alertes internes pour fichiers refusés, génération échouée, paiement échoué et commande bloquée.

### 8. Administration réelle

- [ ] Remplacer toutes les statistiques de démonstration par des données calculées depuis la base.
- [ ] Créer la recherche, les filtres, la pagination et les exports.
- [ ] Rendre fonctionnels l’ajout, la modification, l’archivage et les rôles utilisateurs.
- [ ] Ajouter un journal d’audit pour les changements sensibles.
- [ ] Ajouter les actions de production : contrôler, envoyer l’aperçu, verrouiller, transmettre à l’imprimeur, réimprimer et rembourser.
- [ ] Afficher le coût d’impression, la marge, le paiement et le suivi de chaque commande.
- [ ] Ajouter des permissions distinctes pour propriétaire, administrateur, éditeur et soutien.
- [ ] Protéger les exports et opérations sensibles par une confirmation supplémentaire.

### 9. Professionnels de l’immobilier

- [ ] Définir les packs 10, 25, 50 et 100 crédits et leur expiration.
- [ ] Définir co-branding et white-label précisément.
- [ ] Créer le contrat professionnel et les conditions de traitement des données des vendeurs.
- [ ] Créer invitation vendeur, relances et rapport de livraison au courtier.
- [ ] Permettre l’achat, l’attribution, l’utilisation et le remboursement des crédits.
- [ ] Ajouter les équipes, rôles et limites par agence.
- [ ] Créer devis, factures et rapport mensuel.

### 10. Memory Link et produits numériques

- [ ] Définir la durée incluse, le prix de renouvellement et le devenir des données à expiration.
- [ ] Générer une URL longue durée indépendante du fichier imprimé.
- [ ] Générer un QR réel à haute résolution pour l’impression.
- [ ] Ajouter code PIN, invitations famille, révocation et historique des accès.
- [ ] Permettre d’ajouter ou retirer photos, voix et vidéos après livraison.
- [ ] Encoder et compresser les vidéos pour mobile.
- [ ] Définir l’offre du mini-film et son processus de validation.
- [ ] Choisir le fournisseur des cartes, porte-clés NFC/QR et cadres numériques.

## Contrôles qualité avant lancement

- [ ] Tester tout le parcours FR puis EN sur iPhone Safari, Android Chrome, ordinateur et tablette.
- [ ] Tester avec connexion lente, fichier lourd, mauvais format et interruption de téléversement.
- [ ] Tester les dix questions avec réponses courtes, longues, vides et vocales.
- [ ] Vérifier que le récit n’invente aucun fait absent des réponses.
- [ ] Tester remplacement, suppression et réorganisation des photos.
- [ ] Tester une approbation, une correction après approbation et une nouvelle version.
- [ ] Tester toutes les pages, liens, formulaires, états vides et messages d’erreur.
- [ ] Vérifier clavier, contrastes, libellés, tailles tactiles et lecture d’écran.
- [ ] Vérifier les performances avec vingt photos et plusieurs vidéos.
- [ ] Tester sauvegarde, restauration et récupération après erreur.
- [ ] Effectuer trois commandes réelles de bout en bout avant le premier client payant.

## Lancement pilote recommandé

- [ ] Sélectionner trois à cinq vendeurs d’Émilie.
- [ ] Utiliser un seul format et un seul imprimeur pendant le pilote.
- [ ] Mesurer le temps du questionnaire, le taux de complétion, les corrections et la satisfaction.
- [ ] Photographier et filmer l’ouverture des prototypes avec consentement.
- [ ] Recueillir témoignages, objections et questions fréquentes.
- [ ] Calculer le coût réel complet par commande et la marge.
- [ ] Corriger le parcours avant d’ouvrir les publicités.
- [ ] Lancer ensuite le programme de dix courtiers partenaires.

## Ordre d’exécution conseillé

1. Valider le produit physique et choisir l’imprimeur.
2. Recevoir les informations légales et financières d’Émilie.
3. Finaliser le PDF d’impression exact.
4. Activer les comptes clients publics, paiements et courriels.
5. Relier l’administration aux vraies données.
6. Effectuer trois commandes réelles complètes.
7. Corriger les retours du pilote.
8. Ouvrir les ventes B2C, puis les packs B2B.
