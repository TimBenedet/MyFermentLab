import { Router, Request, Response } from 'express';

const router = Router();

// URL de l'API moneaudebrassage.fr
const WATER_API_BASE_URL = 'https://apidb.moneaudebrassage.fr';

// Interface pour le profil d'eau retourné par l'API
interface WaterApiResponse {
  inseecommune: string;
  departement: string;
  quartiers: Array<{
    nomreseau: string;
    cdreseau: string;
    quartier: string;
    ca: number | null;
    mg: number | null;
    na: number | null;
    cl: number | null;
    so4: number | null;
    hco3: number | null;
    ph: number | null;
    k: number | null;
  }>;
}

// Interface pour le profil d'eau simplifié
interface WaterProfile {
  name: string;
  commune: string;
  departement: string;
  reseau: string;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
  ph: number | null;
  ratioSO4Cl: number | null;
}

/**
 * GET /api/water/profile/:codeInsee
 * Récupère le profil d'eau d'une commune via l'API moneaudebrassage.fr
 */
router.get('/profile/:codeInsee', async (req: Request, res: Response) => {
  try {
    const { codeInsee } = req.params;

    // Validation du code INSEE (5 chiffres)
    if (!/^\d{5}$/.test(codeInsee)) {
      return res.status(400).json({
        error: 'Code INSEE invalide',
        message: 'Le code INSEE doit contenir exactement 5 chiffres'
      });
    }

    // Appel à l'API moneaudebrassage.fr
    const response = await fetch(`${WATER_API_BASE_URL}/lastanalyses/${codeInsee}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MyFermentLab/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Erreur API',
        message: `Impossible de récupérer les données pour le code INSEE ${codeInsee}`
      });
    }

    const data: WaterApiResponse = await response.json();

    // Vérifier si des données existent
    if (!data.quartiers || data.quartiers.length === 0) {
      return res.status(404).json({
        error: 'Aucune donnée',
        message: `Aucune analyse d'eau disponible pour le code INSEE ${codeInsee}`
      });
    }

    // Prendre le premier quartier (généralement le réseau principal)
    const q = data.quartiers[0];

    // Vérifier si les données minérales sont présentes
    if (q.ca === null && q.so4 === null && q.cl === null) {
      return res.status(404).json({
        error: 'Données incomplètes',
        message: `Les analyses minérales ne sont pas disponibles pour cette commune`
      });
    }

    // Calculer le ratio SO4/Cl
    let ratioSO4Cl: number | null = null;
    if (q.so4 !== null && q.cl !== null && q.cl > 0) {
      ratioSO4Cl = Math.round((q.so4 / q.cl) * 100) / 100;
    }

    // Construire le profil simplifié
    const profile: WaterProfile = {
      name: `${data.inseecommune} (${data.departement})`,
      commune: data.inseecommune,
      departement: data.departement,
      reseau: q.nomreseau || 'Réseau principal',
      calcium: q.ca || 0,
      magnesium: q.mg || 0,
      sodium: q.na || 0,
      chloride: q.cl || 0,
      sulfate: q.so4 || 0,
      bicarbonate: q.hco3 || 0,
      ph: q.ph,
      ratioSO4Cl
    };

    res.json(profile);
  } catch (error) {
    console.error('[Water API] Error fetching water profile:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Impossible de contacter l\'API moneaudebrassage.fr'
    });
  }
});

/**
 * GET /api/water/styles
 * Retourne les profils d'eau cibles par style de bière
 */
router.get('/styles', (req: Request, res: Response) => {
  const styles = {
    pilsner: {
      name: 'Pilsner (Plzen)',
      description: 'Eau très douce, légère',
      calcium: 10,
      magnesium: 3,
      sodium: 3,
      chloride: 5,
      sulfate: 5,
      bicarbonate: 25,
      ratioSO4Cl: 1.0
    },
    ipa: {
      name: 'IPA/Pale Ale (Burton)',
      description: 'Eau sulfatée, accentue le houblon',
      calcium: 275,
      magnesium: 40,
      sodium: 25,
      chloride: 35,
      sulfate: 450,
      bicarbonate: 260,
      ratioSO4Cl: 12.9
    },
    stout: {
      name: 'Stout/Porter (Dublin)',
      description: 'Eau alcaline, rondeur maltée',
      calcium: 120,
      magnesium: 4,
      sodium: 12,
      chloride: 19,
      sulfate: 54,
      bicarbonate: 319,
      ratioSO4Cl: 2.8
    },
    lager: {
      name: 'Lager (Munich)',
      description: 'Eau modérément minéralisée',
      calcium: 77,
      magnesium: 18,
      sodium: 2,
      chloride: 2,
      sulfate: 10,
      bicarbonate: 295,
      ratioSO4Cl: 5.0
    },
    amber: {
      name: 'Amber/Brown (London)',
      description: 'Eau équilibrée, polyvalente',
      calcium: 90,
      magnesium: 5,
      sodium: 15,
      chloride: 20,
      sulfate: 40,
      bicarbonate: 125,
      ratioSO4Cl: 2.0
    },
    belgian: {
      name: 'Belgian (Bruxelles)',
      description: 'Eau légèrement minéralisée',
      calcium: 45,
      magnesium: 8,
      sodium: 15,
      chloride: 20,
      sulfate: 50,
      bicarbonate: 100,
      ratioSO4Cl: 2.5
    },
    balanced: {
      name: 'Balanced (Polyvalent)',
      description: 'Profil équilibré pour tous styles',
      calcium: 80,
      magnesium: 15,
      sodium: 25,
      chloride: 60,
      sulfate: 80,
      bicarbonate: 100,
      ratioSO4Cl: 1.3
    }
  };

  res.json(styles);
});

/**
 * GET /api/water/search?q=douai
 * Recherche une commune par nom (retourne les communes correspondantes)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim().toLowerCase();

    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Requête invalide',
        message: 'Le terme de recherche doit contenir au moins 2 caractères'
      });
    }

    // Liste des départements français (métropole + DOM-TOM)
    const departements = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '21',
      '22', '23', '24', '25', '26', '27', '28', '29', '2A', '2B',
      '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
      '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
      '50', '51', '52', '53', '54', '55', '56', '57', '58', '59',
      '60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
      '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
      '80', '81', '82', '83', '84', '85', '86', '87', '88', '89',
      '90', '91', '92', '93', '94', '95', '97'
    ];

    const results: Array<{ insee: string; commune: string; departement: string }> = [];

    // Recherche parallèle dans tous les départements (par lots pour éviter surcharge)
    const batchSize = 10;
    for (let i = 0; i < departements.length && results.length < 20; i += batchSize) {
      const batch = departements.slice(i, i + batchSize);

      const promises = batch.map(async (dept) => {
        try {
          const response = await fetch(`${WATER_API_BASE_URL}/communes/${dept}`, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'MyFermentLab/1.0'
            }
          });

          if (!response.ok) return [];

          const data = await response.json();
          const communes = data.Communes || [];

          return communes
            .filter((c: { nom: string }) =>
              c.nom && c.nom.toLowerCase().includes(query)
            )
            .map((c: { insee: string; nom: string }) => ({
              insee: c.insee,
              commune: c.nom,
              departement: dept
            }));
        } catch {
          return [];
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.flat().forEach(r => {
        if (results.length < 20) {
          results.push(r);
        }
      });

      // Arrêter dès qu'on a assez de résultats
      if (results.length >= 20) break;
    }

    // Trier par pertinence (commence par > contient)
    results.sort((a, b) => {
      const aStarts = a.commune.toLowerCase().startsWith(query);
      const bStarts = b.commune.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.commune.localeCompare(b.commune);
    });

    res.json(results);
  } catch (error) {
    console.error('[Water API] Error searching communes:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: 'Erreur lors de la recherche de communes'
    });
  }
});

export default router;
