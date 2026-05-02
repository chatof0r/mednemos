export interface Item {
  label: string;
  enonce: string;
  justification: string;
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
  type: 'QCM' | 'QRU' | 'QZONE';
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
