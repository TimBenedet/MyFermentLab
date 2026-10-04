Tu es l'arbitre d'un protocole de stockage. Lis `design/protocole-donnees-partagees.md`
(chemin absolu : C:/Users/Timothée/Documents/IA/Hermes/MyFermentLab/design/protocole-donnees-partagees.md),
puis lis le code concerné — `scada-opus-5.5/pont/pont.py` et, dans
`scada-opus-5.5/hakko-dashboard.html`, les fonctions de stockage et de dépôt de plan
(`STORE`, `save`, `load`, `planRegulation`, `pontPoussePlan`, `pontLireRegul`).

Contexte à respecter : Python sans aucune dépendance, page sans aucune dépendance ni compilation,
tout en français, deux images distinctes (page et pont), et une régulation qui commande de vraies
prises électriques — une donnée perdue ou un plan périmé se traduit par une chauffe non voulue.

Ta mission, dans cet ordre :

1. **Attaque le protocole** : où peut-on perdre une recette ? Où un appareil périmé peut-il
   encore imposer une chauffe ? Quels cas le 409 strict ne couvre-t-il pas ?
2. **Réponds aux 5 questions du §9**, une par une, explicitement, avec ta décision et sa raison.
3. **Corrige le protocole** : écris la version arbitrée dans
   `design/protocole-donnees-partagees-v2.md` (même dossier), en gardant la structure des
   sections. Signale en tête les sections que tu modifies et pourquoi.
4. **Chiffre le risque de migration** : décris précisément la suite d'actions qui ne doit jamais
   arriver (la perte des données du PC ou du téléphone) et la garde qui l'empêche.
5. Termine par une section « ce que je n'ai pas tranché ».

Contraintes d'écriture : ne modifie AUCUN fichier à part tes deux livrables (le protocole v2 et,
si tu le juges utile, `design/avis-protocole-donnees.md`). Ne touche pas au code. Cite les
fichiers par `fichier:ligne` quand tu parles de l'existant — si tu ne peux pas citer, ne
l'écris pas. Pas de compliment générique. Réponds en français.
