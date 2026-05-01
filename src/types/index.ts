export interface Item {
  label: string;
  enonce: string;
  justification: string;
}

// Coordonnées en % de la largeur du conteneur (système uniforme)
export interface Hotspot {
  x: number;      // centre x (% de la largeur du conteneur)
  y: number;      // centre y (% de la largeur du conteneur — même unité que x)
  radius: number; // rayon (% de la largeur du conteneur)
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
}

export interface Suggestion {
  id: string;
  created_at: string;
  message: string;
  lu: boolean;
}

export interface SessionConfig {
  questions: Question[];
  order: 'official' | 'random';
}

export interface FilterConfig {
  niveau: 'P2' | 'D1';
  matiere: string;
  cours: string[] | null;
  annee: number | null;
  order: 'official' | 'random';
}
