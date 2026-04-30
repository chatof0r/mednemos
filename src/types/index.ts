export interface Item {
  label: string;
  enonce: string;
  justification: string;
}

export interface Question {
  id: string;
  created_at: string;
  niveau: 'P2' | 'D1';
  matiere: string;
  cours: string | null;
  annee: number | null;
  type: 'QCM' | 'QRU';
  enonce: string;
  image_url: string | null;
  items: Item[];
  reponses: string[];
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
  cours: string | null;
  annee: number | null;
  order: 'official' | 'random';
}
