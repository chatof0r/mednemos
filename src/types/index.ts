export interface Item {
  label: string;
  enonce: string;
  justification: string;
  image_url?: string | null;  // image illustrant cet item
  choices?: string[];         // QS uniquement : options du menu déroulant
  correct?: string;           // QS uniquement : option correcte (parmi choices)
  neutralisee?: boolean;      // item neutralisé — ne compte pas, ne peut pas être juste
}

export interface HotspotPoint {
  x: number; // % de la largeur du conteneur
  y: number; // % de la hauteur du conteneur
}

export interface Hotspot {
  points: HotspotPoint[]; // sommets du polygone (≥ 3)
  ar: number;             // width/height du conteneur au moment de la création
}

export interface Question {
  id: string;
  created_at: string;
  niveau: 'P2' | 'D1';
  matiere: string;
  cours: string[] | null;
  annee: number | null;
  session: 1 | 2 | null;
  /** QCM/QRU  : items à cocher
   *  QZONE    : zone sur image
   *  QROC     : réponse texte libre — reponses[] = mots acceptés
   *  QS       : items avec menu déroulant — réponse correcte dans Item.correct
   */
  type: 'QCM' | 'QRU' | 'QZONE' | 'QROC' | 'QS';
  enonce: string;
  image_url: string | null;
  items: Item[];
  reponses: string[];
  hotspot: Hotspot | null;
  statut: 'brouillon' | 'publiee';
  numero_officiel: number | null;
  source: 'annale' | 'ronéo';
  note_correction: string | null;
  dossier_id: string | null;
  ordre_dossier: number | null;
}

export interface Dossier {
  id: string;
  created_at: string;
  titre: string;
  enonce: string | null;
  image_url: string | null;
  niveau: 'P2' | 'D1';
  matiere: string;
  cours: string[] | null;
  annee: number | null;
  session: 1 | 2 | null;
  source: 'annale' | 'ronéo';
  statut: 'brouillon' | 'publiee';
  numero_officiel: number | null;
  type_dossier: 'dp' | 'dl';
}

export interface Profile {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  niveau: 'P2' | 'D1' | null;
  faculte: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Suggestion {
  id: string;
  created_at: string;
  message: string;
  lu: boolean;
}

export interface SessionConfig {
  questions: Question[];
  dossiers: Dossier[];
  order: 'official' | 'random';
}

export interface FilterConfig {
  niveau: 'P2' | 'D1';
  matiere: string;
  cours: string[] | null;
  annee: number | null;
  order: 'official' | 'random';
}
