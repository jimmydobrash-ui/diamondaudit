export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  positions: string[];
  bats: 'L' | 'R' | 'S';
  throws: 'L' | 'R';
  height: string;
  weight: number;
  jerseyNumber: number;
  notes: string;
  tags: string[];
}

export interface EvaluationCategory {
  id: string;
  name: string;
  skills: { id: string; name: string; label: string }[];
}

export interface Evaluation {
  playerId: string;
  coachId: string;
  eventId: string;
  scores: Record<string, number>;
  notes: string;
  timestamp: string;
}

export const evaluationTemplate: EvaluationCategory[] = [
  {
    id: 'hitting',
    name: 'Hitting',
    skills: [
      { id: 'contact', name: 'contact', label: 'Contact' },
      { id: 'power', name: 'power', label: 'Power' },
      { id: 'batSpeed', name: 'batSpeed', label: 'Bat Speed' },
      { id: 'approach', name: 'approach', label: 'Approach' },
    ],
  },
  {
    id: 'fielding',
    name: 'Fielding',
    skills: [
      { id: 'glovePresentation', name: 'glovePresentation', label: 'Glove Work' },
      { id: 'prepStep', name: 'prepStep', label: 'Prep Step' },
      { id: 'hands', name: 'hands', label: 'Hands' },
      { id: 'footwork', name: 'footwork', label: 'Footwork' },
      { id: 'fieldingOverall', name: 'fieldingOverall', label: 'Overall' },
    ],
  },
  {
    id: 'pitching',
    name: 'Pitching',
    skills: [
      { id: 'fastballVelocity', name: 'fastballVelocity', label: 'Fastball Velo' },
      { id: 'changeup', name: 'changeup', label: 'Changeup' },
      { id: 'breakingBall', name: 'breakingBall', label: 'Breaking Ball' },
      { id: 'command', name: 'command', label: 'Command' },
      { id: 'control', name: 'control', label: 'Control' },
    ],
  },
  {
    id: 'catching',
    name: 'Catching',
    skills: [
      { id: 'popTime', name: 'popTime', label: 'Pop Time' },
      { id: 'receiving', name: 'receiving', label: 'Receiving' },
      { id: 'transfer', name: 'transfer', label: 'Transfer' },
      { id: 'blocking', name: 'blocking', label: 'Blocking' },
      { id: 'catchingOverall', name: 'catchingOverall', label: 'Overall' },
    ],
  },
  {
    id: 'running',
    name: 'Running',
    skills: [
      { id: 'homeToFirst', name: 'homeToFirst', label: 'Home to 1st' },
      { id: 'lateralSpeed', name: 'lateralSpeed', label: 'Lateral Speed' },
    ],
  },
];

function calcPlayingAge(dob: string): number {
  const birthDate = new Date(dob);
  const currentYear = new Date().getFullYear();
  const may1 = new Date(currentYear, 4, 1); // May 1
  let age = may1.getFullYear() - birthDate.getFullYear();
  const m = may1.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && may1.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getPlayingAge(dob: string): number {
  return calcPlayingAge(dob);
}

export function getAgeGroup(dob: string): string {
  return `${calcPlayingAge(dob)}U`;
}

/**
 * The tryout age group to display for a player. Prefers an explicit "NNU" tag
 * (set on CSV import from Playbook's class_session, editable via the player
 * form) so a player registered to try out one level up is filed under the
 * right group — falls back to the DOB-derived age when no tag is present.
 */
export function playerAgeGroup(p: { date_of_birth: string; tags: string[] | null }): string {
  const tag = (p.tags ?? []).find(t => /^\d{1,2}U$/i.test(t));
  return tag ? tag.toUpperCase() : getAgeGroup(p.date_of_birth);
}

export const mockPlayers: Player[] = [
  { id: '1', firstName: 'Marcus', lastName: 'Johnson', dateOfBirth: '2012-03-15', positions: ['SS', 'P'], bats: 'R', throws: 'R', height: "5'4\"", weight: 115, jerseyNumber: 7, notes: 'Strong arm, quick hands', tags: ['Top Prospect'] },
  { id: '2', firstName: 'Ethan', lastName: 'Williams', dateOfBirth: '2012-08-22', positions: ['C', '1B'], bats: 'L', throws: 'R', height: "5'6\"", weight: 130, jerseyNumber: 12, notes: 'Great game awareness', tags: [] },
  { id: '3', firstName: 'Jordan', lastName: 'Davis', dateOfBirth: '2013-01-10', positions: ['OF', '2B'], bats: 'S', throws: 'R', height: "5'2\"", weight: 105, jerseyNumber: 3, notes: 'Very fast', tags: ['Top Prospect'] },
  { id: '4', firstName: 'Tyler', lastName: 'Martinez', dateOfBirth: '2012-11-05', positions: ['P', '3B'], bats: 'R', throws: 'L', height: "5'7\"", weight: 140, jerseyNumber: 21, notes: 'Developing breaking ball', tags: [] },
  { id: '5', firstName: 'Aiden', lastName: 'Brown', dateOfBirth: '2013-06-18', positions: ['OF'], bats: 'L', throws: 'L', height: "5'3\"", weight: 110, jerseyNumber: 9, notes: 'Consistent contact hitter', tags: [] },
  { id: '6', firstName: 'Noah', lastName: 'Garcia', dateOfBirth: '2012-04-30', positions: ['SS', '2B'], bats: 'R', throws: 'R', height: "5'5\"", weight: 120, jerseyNumber: 14, notes: '', tags: [] },
  { id: '7', firstName: 'Liam', lastName: 'Rodriguez', dateOfBirth: '2013-09-12', positions: ['1B', 'OF'], bats: 'L', throws: 'R', height: "5'8\"", weight: 145, jerseyNumber: 44, notes: 'Power potential', tags: ['Top Prospect'] },
  { id: '8', firstName: 'Caleb', lastName: 'Wilson', dateOfBirth: '2012-07-03', positions: ['C'], bats: 'R', throws: 'R', height: "5'5\"", weight: 125, jerseyNumber: 2, notes: 'Quick release', tags: [] },
];

export const mockEvaluations: Record<string, Record<string, number>> = {
  '1': { contact: 8, power: 7, batSpeed: 8.5, approach: 7.5, glovePresentation: 8, prepStep: 7, hands: 8.5, footwork: 7.5, fieldingOverall: 8, fastballVelocity: 7, command: 6.5, homeToFirst: 8, lateralSpeed: 7.5 },
  '2': { contact: 7, power: 6.5, batSpeed: 7, approach: 8, popTime: 7.5, receiving: 8, transfer: 7, blocking: 7.5, catchingOverall: 7.5 },
  '3': { contact: 7.5, power: 5.5, batSpeed: 7, approach: 6.5, homeToFirst: 9, lateralSpeed: 8.5, glovePresentation: 7, hands: 7, fieldingOverall: 7 },
  '4': { fastballVelocity: 8, changeup: 6.5, breakingBall: 6, command: 7, control: 7.5, contact: 6, power: 7, batSpeed: 6.5, approach: 6 },
  '5': { contact: 8.5, power: 5, batSpeed: 7, approach: 8, homeToFirst: 7, lateralSpeed: 7, glovePresentation: 6.5, hands: 7, fieldingOverall: 6.5 },
  '6': { contact: 7, power: 6, batSpeed: 7.5, approach: 7, glovePresentation: 8, prepStep: 8, hands: 8, footwork: 8.5, fieldingOverall: 8, homeToFirst: 7.5, lateralSpeed: 7 },
  '7': { contact: 6.5, power: 8.5, batSpeed: 8, approach: 6, homeToFirst: 6, lateralSpeed: 5.5, glovePresentation: 6, hands: 6, fieldingOverall: 6 },
  '8': { contact: 6, power: 5.5, batSpeed: 6, approach: 7, popTime: 8, receiving: 7.5, transfer: 8, blocking: 7, catchingOverall: 7.5 },
};

export function getOverallScore(playerId: string): number {
  const scores = mockEvaluations[playerId];
  if (!scores) return 0;
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function getCategoryAverage(playerId: string, category: EvaluationCategory): number | null {
  const scores = mockEvaluations[playerId];
  if (!scores) return null;
  const categoryScores = category.skills
    .map(s => scores[s.id])
    .filter((v): v is number => v !== undefined);
  if (categoryScores.length === 0) return null;
  return Math.round((categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length) * 10) / 10;
}
