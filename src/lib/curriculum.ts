export type Niveau = 'P2' | 'D1';
export type Sem = 'S1' | 'S2';

export const CURRICULUM: Record<Niveau, Record<Sem, string[]>> = {
  P2: {
    S1: ['Cardiologie', 'Pneumologie', 'Nutrition', 'Pharmacologie', 'Hémato'],
    S2: ['Appareil Locomoteur', 'Dermatologie', 'Tête et cou', 'Immunologie', 'Biopathologie'],
  },
  D1: {
    S1: ['Appareil digestif', 'Génétique / Pédiatrie', 'SSH', 'Hormonologie', 'Neurosensoriel'],
    S2: ['Néphrologie', 'AEM', 'Sémiologie écrite', 'Infectiologie', 'Psychiatrie'],
  },
};

// Cours prédéfinis par matière — à compléter au fur et à mesure
export const COURSES: Record<string, string[]> = {
  'Tête et cou': [
    'Histologie organe des sens',
    'Biophysique et physiologie de l\'audition',
    'Neurophysiologie de la vision',
    'Sémiologie maxillo',
    'Sémiologie otologique',
    'Sémiologie pharyngol laryngée et cervicale',
    'Sémiologie rhinologique',
  ],
};

export const ANNEES = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export function getAllMatieres(niveau: Niveau): string[] {
  return [...CURRICULUM[niveau].S1, ...CURRICULUM[niveau].S2];
}
