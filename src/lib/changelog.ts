export const APP_VERSION = '1.6';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: { emoji: string; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6',
    date: '7 avril 2026',
    title: 'Connexion & confort',
    items: [
      { emoji: '🔑', text: "Option « Se souvenir de moi » sur l'écran de connexion : les identifiants sont mémorisés localement pour une reconnexion en un clic." },
    ],
  },
  {
    version: '1.5',
    date: '27 mars 2026',
    title: 'Améliorations UX & heures supplémentaires',
    items: [
      { emoji: '🐙', text: 'Lien GitHub ajouté dans le pied de page — accès direct au dépôt source.' },
      { emoji: '📅', text: 'Nouvelle option dans les paramètres : choisissez la période de référence pour la détection automatique des heures supplémentaires (semaine, mois, trimestre, semestre, année ou à vie).' },
      { emoji: '🕐', text: "Les heures supplémentaires sont maintenant affichées dans un format lisible : « 1 h 30 min » au lieu d'un nombre brut de minutes." },
    ],
  },
  {
    version: '1.4',
    date: '10 mars 2026',
    title: 'Compatibilité mobile & sécurité renforcée',
    items: [
      { emoji: '📱', text: "L'application est désormais pleinement compatible mobile — chaque écran, bouton et interaction a été optimisé pour une utilisation confortable sur smartphone et tablette." },
      { emoji: '🔒', text: "Audit de sécurité complet : migration vers Supabase Auth natif, suppression des colonnes legacy, rotation des emails techniques en identifiants opaques UUID. L'application respecte désormais pleinement les standards de sécurité en production." },
    ],
  },
  {
    version: '1.3',
    date: '2 mars 2026',
    title: 'Heures planifiées',
    items: [
      { emoji: '📅', text: "Il est maintenant possible d'ajouter des entrées pour aujourd'hui ou des jours futurs depuis l'historique — pratique pour préremplir un RDV ou une demi-journée prévue." },
      { emoji: '🧠', text: "Logique intelligente : si des heures sont planifiées pour plus tard dans la journée, elles sont prises en compte dans le calcul du temps restant. L'heure de départ estimée est ajustée en conséquence, et le mode pause ne se déclenche pas si les heures planifiées couvrent le reste de la journée." },
      { emoji: '🏷️', text: "Les entrées planifiées (aujourd'hui ou futur) sont affichées avec un style distinct et le label « Planifié », aussi bien dans l'historique du jour que dans le panneau de modification." },
    ],
  },
  {
    version: '1.2',
    date: '27 février 2026',
    title: 'Améliorations du suivi',
    items: [
      { emoji: '🔛', text: "Toggle rapide pour activer/désactiver l'heure de départ minimum sans perdre la valeur configurée." },
      { emoji: '✏️', text: "Saisie manuelle d'une heure personnalisée directement dans l'historique." },
      { emoji: '🗑️', text: "Suppression du bloc d'heure de départ forcée, inutilisé." },
    ],
  },
  {
    version: '1.1',
    date: '24 février 2026',
    title: 'Heure de départ minimum',
    items: [
      { emoji: '🚪', text: 'Nouvelle option dans les paramètres : définissez une heure de départ minimum le soir.' },
      { emoji: '🧠', text: "La pause déjeuner recommandée s'adapte automatiquement pour que vous atteigniez vos heures tout en respectant l'heure de départ minimum." },
      { emoji: '⏱️', text: "Le timer de pause déjeuner tient désormais compte de cette contrainte — plus besoin de calculer manuellement." },
      { emoji: '🔧', text: "L'option est entièrement optionnelle : laissez le champ vide pour revenir au comportement classique." },
    ],
  },
];
