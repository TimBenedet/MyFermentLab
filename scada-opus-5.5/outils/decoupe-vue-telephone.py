#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
decoupe-vue-telephone.py
=======================

Duplique, dans un fichier HTML autonome, les blocs CSS conditionnels
(`@media (max-width:900px)` et `@media (max-width:640px)`) en une copie où
chaque règle de premier niveau est prefixee par « html.vue-tel ».

But : quand la classe « vue-tel » est posee sur <html>, le rendu doit etre
EXACTEMENT celui des media queries, mais a n'importe quelle largeur d'ecran.

Ce que fait le script
---------------------
1. Il lit le fichier et repere tous les blocs `@media` dont la condition
   vaut exactement `max-width:900px` ou `max-width:640px` (equilibrage des
   accolades, blocs situes dans un <style> uniquement).
2. Pour chacun, il produit une copie dont chaque regle de premier niveau est
   prefixee par `html.vue-tel ` (un selecteur multiple separe par des virgules
   est prefixe selecteur par selecteur).
3. La copie est inseree juste apres le bloc media d'origine, entre les deux
   commentaires de balisage :
       /* ===== vue telephone : regles generees, ne pas editer a la main ===== */
       ...
       /* ===== fin vue telephone ===== */
   Si une zone existe deja, elle est integralement remplacee : le script est
   idempotent (une seconde execution ne change plus rien).
4. Le fichier est reecrit en conservant exactement les fins de ligne
   d'origine (CRLF si CRLF) et l'encodage UTF-8 (BOM conserve s'il existe).

Modes
-----
Par defaut, le script n'ecrit RIEN : il imprime un rapport.
Avec `--ecrire`, il applique reellement les modifications.

Usage
-----
    python decoupe-vue-telephone.py                    # rapport seul
    python decoupe-vue-telephone.py --ecrire           # applique
    python decoupe-vue-telephone.py --fichier <chemin> # cible un autre fichier

Python 3 standard uniquement, aucune dependance, aucun navigateur.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# Constantes
# --------------------------------------------------------------------------

PREFIXE = "html.vue-tel "

DEBUT_ZONE = "/* ===== vue téléphone : règles générées, ne pas éditer à la main ===== */"
FIN_ZONE = "/* ===== fin vue téléphone ===== */"

# Conditions cibles (normalisees : minuscules, sans espace)
CONDITIONS_CIBLES = ("max-width:900px", "max-width:640px")

# Chemin par defaut : <racine>/hakko-dashboard.html quand le script vit dans
# <racine>/outils/decoupe-vue-telephone.py
FICHIER_PAR_DEFAUT = Path(__file__).resolve().parent.parent / "hakko-dashboard.html"


# --------------------------------------------------------------------------
# Lecture / ecriture sans abimer le fichier
# --------------------------------------------------------------------------

def lire_fichier(chemin: Path):
    """Retourne (texte, nl, bom). Le texte est decode en UTF-8."""
    octets = chemin.read_bytes()
    bom = b""
    if octets.startswith(b"\xef\xbb\xbf"):
        bom = b"\xef\xbb\xbf"
        octets = octets[3:]
    texte = octets.decode("utf-8")
    # Fin de ligne dominante : CRLF des qu'il y en a au moins un.
    nl = "\r\n" if "\r\n" in texte else "\n"
    return texte, nl, bom


def ecrire_fichier(chemin: Path, texte: str, bom: bytes) -> None:
    """Ecrit en UTF-8, fins de ligne preservees telles quelles (newline='')."""
    with open(chemin, "w", encoding="utf-8", newline="") as f:
        if bom:
            f.write("\ufeff")  # re-encode en EF BB BF par l'encodage utf-8
        f.write(texte)


# --------------------------------------------------------------------------
# Petit utilitaire : decoupage d'une liste de selecteurs sur les virgules
# --------------------------------------------------------------------------

def decouper_selecteurs(core: str):
    """Decoupe une liste de selecteurs sur les virgules de premier niveau.

    Les virgules situees dans des parentheses/crochets ou dans une chaine
    entre guillemets ne coupent pas (ex. `:is(a,b)`, `[data-x="a,b"]`).
    """
    morceaux = []
    courant = []
    profondeur = 0
    quote = None
    i = 0
    while i < len(core):
        c = core[i]
        if quote is not None:
            courant.append(c)
            if c == "\\" and i + 1 < len(core):
                courant.append(core[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'":
            quote = c
            courant.append(c)
        elif c in "([":
            profondeur += 1
            courant.append(c)
        elif c in ")]":
            profondeur = max(0, profondeur - 1)
            courant.append(c)
        elif c == "," and profondeur == 0:
            morceaux.append("".join(courant))
            courant = []
        else:
            courant.append(c)
        i += 1
    morceaux.append("".join(courant))
    return morceaux


def prefixer_selecteur(brut: str, avertissements: list):
    """Prefixe un bloc de texte « selecteur(s) » en gardant les espaces de bord.

    Preserve egalement un eventuel commentaire CSS place avant le selecteur.
    """
    gauche = brut[: len(brut) - len(brut.lstrip())]
    droite = brut[len(brut.rstrip()):]
    coeur = brut.strip()
    avant = ""

    # Un commentaire CSS colle au selecteur reste en place, inchange.
    if "/*" in coeur:
        fin_com = coeur.rfind("*/")
        if fin_com != -1:
            avant = coeur[: fin_com + 2]
            reste = coeur[fin_com + 2:]
            avant += reste[: len(reste) - len(reste.lstrip())]
            coeur = reste.strip()

    if not coeur:
        return brut

    # At-rule imbriquee (@media, @supports...) : on ne touche a rien.
    if coeur.startswith("@"):
        avertissements.append("at-rule ignoree dans la copie : " + coeur[:60])
        return brut

    nouveaux = []
    for morceau in decouper_selecteurs(coeur):
        sel = morceau.strip()
        if not sel:
            continue
        if sel.startswith("html.vue-tel"):
            nouveaux.append(sel)  # deja prefixe : securite anti double prefixe
            continue
        if sel == "html" or sel == ":root":
            avertissements.append(
                "selecteur %r prefixe tel quel (ne matchera pas sous html.vue-tel)" % sel
            )
        nouveaux.append(PREFIXE + sel)

    return gauche + avant + ",".join(nouveaux) + droite


def prefixer_regles(inner: str):
    """Prefixe chaque regle de premier niveau du contenu d'un bloc @media.

    Retourne (nouveau_texte, nb_regles, avertissements). Le corps des regles et
    la mise en forme d'origine sont conserves a l'identique : seul le texte du
    selecteur est reecrit, le reste est recopie par tranches.
    """
    segments = []
    avertissements = []
    nb_regles = 0
    profondeur = 0
    debut_selecteur = 0   # debut du texte du selecteur en cours
    debut_corps = 0       # debut du corps ({ ... }) a recopier tel quel
    i = 0
    n = len(inner)

    while i < n:
        c = inner[i]
        if c == "{":
            if profondeur == 0:
                segments.append(prefixer_selecteur(inner[debut_selecteur:i], avertissements))
                nb_regles += 1
                debut_corps = i
            profondeur += 1
        elif c == "}":
            profondeur = max(0, profondeur - 1)
            if profondeur == 0:
                segments.append(inner[debut_corps:i + 1])  # corps + accolade, verbatim
                debut_selecteur = i + 1
        i += 1

    if debut_selecteur < n:
        segments.append(inner[debut_selecteur:])  # reste (espaces, commentaire final)

    return "".join(segments), nb_regles, avertissements


# --------------------------------------------------------------------------
# Zones generees : detection et suppression (idempotence)
# --------------------------------------------------------------------------

def retirer_zones(texte: str):
    """Supprime toutes les zones deja generees.

    Retourne (texte_nettoye, nb_zones_supprimees). La suppression inclut la fin
    de ligne qui precedait le commentaire d'ouverture, afin que le texte
    redevienne exactement celui d'avant la generation.
    """
    nb = 0
    while True:
        a = texte.find(DEBUT_ZONE)
        if a == -1:
            break
        b = texte.find(FIN_ZONE, a)
        if b == -1:
            # Marqueur d'ouverture orphelin : on ne devine pas, on s'arrete.
            break
        b += len(FIN_ZONE)
        # Absorbe la fin de ligne precedant l'ouverture.
        if texte[max(0, a - 2):a] == "\r\n":
            a -= 2
        elif texte[max(0, a - 1):a] == "\n":
            a -= 1
        texte = texte[:a] + texte[b:]
        nb += 1
    return texte, nb


# --------------------------------------------------------------------------
# Detection des blocs @media cibles
# --------------------------------------------------------------------------

def regions_style(texte: str):
    """Retourne la liste des intervalles (debut, fin) des blocs <style>.</style>."""
    regions = []
    for m in re.finditer(r"<style\b[^>]*>(.*?)</style>", texte, re.S | re.I):
        regions.append((m.start(1), m.end(1)))
    return regions


def dans_regions(pos: int, regions) -> bool:
    return any(d <= pos < f for d, f in regions)


def normaliser_condition(condition: str) -> str:
    """Normalise une condition @media : minuscules, sans espaces ni parentheses.

    `@media (max-width:900px)` -> `max-width:900px`
    """
    return re.sub(r"\s+", "", condition).lower().replace("(", "").replace(")", "")


def trouver_blocs(texte: str):
    """Repere les blocs @media cibles.

    Retourne (blocs, nb_media_total, ignores). Chaque bloc est un dict :
    {debut, fin, condition, inner, ligne}. `debut` pointe sur '@media',
    `fin` juste apres l'accolade fermante du bloc.
    """
    regions = regions_style(texte)
    blocs = []
    ignores = []
    total = 0

    for m in re.finditer(r"@media\b", texte):
        total += 1
        i = m.end()
        # Condition : jusqu'a la premiere accolade ouvrante.
        j = i
        while j < len(texte) and texte[j] != "{":
            if texte[j] == ";":  # pas un bloc : @media malforme
                break
            j += 1
        if j >= len(texte) or texte[j] != "{":
            continue
        condition = normaliser_condition(texte[i:j])
        if condition not in CONDITIONS_CIBLES:
            continue

        # Equilibrage des accolades a partir de l'accolade ouvrante.
        profondeur = 0
        k = j
        ferme = -1
        while k < len(texte):
            c = texte[k]
            if c == "{":
                profondeur += 1
            elif c == "}":
                profondeur -= 1
                if profondeur == 0:
                    ferme = k
                    break
            k += 1
        if ferme == -1:
            continue

        if not dans_regions(m.start(), regions):
            ignores.append((condition, "hors <style>, ignore"))
            continue

        blocs.append(
            {
                "debut": m.start(),
                "fin": ferme + 1,
                "condition": condition,
                "inner": texte[j + 1:ferme],
                "ligne": texte.count("\n", 0, m.start()) + 1,
            }
        )
    return blocs, total, ignores


# --------------------------------------------------------------------------
# Transformation
# --------------------------------------------------------------------------

def transformer(texte: str, nl: str):
    """Retourne (nouveau_texte, rapport). Ne modifie pas le texte recu."""
    # 1) On repart d'un texte sans zone generee (idempotence).
    texte_nettoye, nb_zones_anciennes = retirer_zones(texte)

    # 2) On repere les blocs cibles dans le texte nettoye.
    blocs, total_media, ignores = trouver_blocs(texte_nettoye)

    # 3) On construit les copies, puis on insere de la fin vers le debut pour
    #    que les positions des blocs precedents restent valides.
    copies = []
    nb_regles_total = 0
    avertissements = []
    for bloc in blocs:
        copie, nb_regles, avert = prefixer_regles(bloc["inner"])
        nb_regles_total += nb_regles
        avertissements.extend(avert)
        corps = copie.strip("\r\n")
        zone = (
            nl
            + DEBUT_ZONE
            + nl
            + "/* source : media (max-width:%s), copie non conditionnelle */" % bloc["condition"].split(":")[1]
            + nl
            + corps
            + nl
            + FIN_ZONE
        )
        copies.append({"bloc": bloc, "nb_regles": nb_regles, "zone": zone})

    resultat = texte_nettoye
    for item in sorted(copies, key=lambda it: it["bloc"]["fin"], reverse=True):
        pos = item["bloc"]["fin"]
        resultat = resultat[:pos] + item["zone"] + resultat[pos:]

    rapport = {
        "nb_media_total": total_media,
        "nb_blocs": len(blocs),
        "nb_regles_total": nb_regles_total,
        "nb_zones_anciennes": nb_zones_anciennes,
        "copies": copies,
        "ignores": ignores,
        "avertissements": avertissements,
        "change": resultat != texte,
        "texte": resultat,
    }
    return resultat, rapport


# --------------------------------------------------------------------------
# Affichage
# --------------------------------------------------------------------------

def afficher_rapport(chemin: Path, texte_origine: str, nl: str, bom: bytes, rapport):
    print("fichier      : %s" % chemin)
    print("taille       : %d octets" % chemin.stat().st_size)
    print("lignes       : %d" % (texte_origine.count("\n") + 1))
    print("fins de ligne: %s" % ("CRLF" if nl == "\r\n" else "LF"))
    print("BOM          : %s" % ("oui" if bom else "non"))
    print("blocs @media au total : %d" % rapport["nb_media_total"])
    print(
        "blocs cibles (%s) : %d"
        % (" / ".join("(max-width:%s)" % c.split(":")[1] for c in CONDITIONS_CIBLES),
           rapport["nb_blocs"])
    )
    print("zones deja presentes, remplacees : %d" % rapport["nb_zones_anciennes"])
    print("regles prefixees : %d" % rapport["nb_regles_total"])
    print("")
    print("detail des blocs cibles :")
    for item in rapport["copies"]:
        b = item["bloc"]
        print(
            "  - ligne %-5d @media (%s) : %d regle(s) prefixee(s)"
            % (b["ligne"], b["condition"], item["nb_regles"])
        )
    for cond, raison in rapport["ignores"]:
        print("  ! @media (%s) : %s" % (cond, raison))
    for avert in rapport["avertissements"]:
        print("  ! avertissement : %s" % avert)

    if rapport["copies"]:
        premiere = rapport["copies"][0]["zone"]
        lignes = premiere.splitlines()
        extrait = lignes[:14]
        print("")
        print("extrait de la zone generee (1er bloc, %d lignes au total) :" % len(lignes))
        for lg in extrait:
            print("  | " + lg)
        if len(lignes) > len(extrait):
            print("  | ... (%d ligne(s) non affichee(s))" % (len(lignes) - len(extrait)))
    else:
        print("")
        print("aucun bloc cible : rien a generer.")

    print("")
    print("le fichier changerait : %s" % ("OUI" if rapport["change"] else "non"))


# --------------------------------------------------------------------------
# Programme principal
# --------------------------------------------------------------------------

def main(argv=None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Duplique les blocs @media (max-width:900px) et (max-width:640px) "
            "en regles prefixees par html.vue-tel."
        )
    )
    parseur.add_argument(
        "--ecrire",
        action="store_true",
        help="ecrit reellement les modifications (sinon, rapport seul)",
    )
    parseur.add_argument(
        "--fichier",
        default=str(FICHIER_PAR_DEFAUT),
        help="fichier HTML cible (defaut : %s)" % FICHIER_PAR_DEFAUT,
    )
    args = parseur.parse_args(argv)

    chemin = Path(args.fichier)
    if not chemin.is_file():
        print("erreur : fichier introuvable : %s" % chemin, file=sys.stderr)
        return 2

    texte, nl, bom = lire_fichier(chemin)
    nouveau, rapport = transformer(texte, nl)

    afficher_rapport(chemin, texte, nl, bom, rapport)

    if args.ecrire:
        if not rapport["change"]:
            print("")
            print("mode --ecrire : aucun changement, fichier laisse intact.")
            return 0
        # Garde-fou : le nombre de blocs @media d'origine doit rester identique.
        # (on retire les zones generees avant de compter : le commentaire
        #  « source : @media (...) » contient lui aussi le mot @media)
        texte_hors_zones, _ = retirer_zones(nouveau)
        avant = len(re.findall(r"@media\b", texte))
        apres = len(re.findall(r"@media\b", texte_hors_zones))
        if avant != apres:
            print("")
            print(
                "ERREUR : le nombre de @media a change (%d -> %d), ecriture annulee."
                % (avant, apres),
                file=sys.stderr,
            )
            return 3
        ecrire_fichier(chemin, nouveau, bom)
        print("")
        print("mode --ecrire : fichier reecrit (%d octets)." % chemin.stat().st_size)
    else:
        print("")
        print("mode rapport : aucune ecriture (ajoutez --ecrire pour appliquer).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
