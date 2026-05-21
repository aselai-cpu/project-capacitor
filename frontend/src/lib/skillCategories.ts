import type { Skill } from './types';

export const SKILL_CATEGORIES: Record<string, string[]> = {
  'Languages': ['TypeScript', 'Python', 'Java', 'Go', 'Rust', 'JavaScript', 'SQL'],
  'Frameworks': ['React', 'Angular', 'Vue', 'Node.js', 'Flask', 'FastAPI', 'Spring Boot', 'React Native'],
  'Infrastructure': ['Docker', 'Kubernetes', 'AWS', 'AWS Lambda'],
  'Data': ['PostgreSQL', 'MongoDB', 'Redis', 'Neo4j', 'Elasticsearch'],
  'Tools': ['Git', 'GraphQL', 'Jest', 'JUnit', 'Cypress', 'Jira', 'Figma'],
  'AI/ML': ['LangChain', 'OpenAI API', 'Amazon Bedrock', 'Amazon Textract', 'OCR', 'RAG'],
};

export const NON_TECHNICAL_SKILLS = [
  'Communication', 'Collaboration', 'Pair Programming', 'Agile', 'TDD',
];

/** Group skills by category for display. Non-technical skills are excluded. Unknown skills go to "Other". */
export function groupSkillsByCategory(skills: Skill[]): Record<string, Skill[]> {
  const allCategorized = new Set(Object.values(SKILL_CATEGORIES).flat());
  const nonTech = new Set(NON_TECHNICAL_SKILLS);

  const groups: Record<string, Skill[]> = {};
  for (const [category, names] of Object.entries(SKILL_CATEGORIES)) {
    const matched = skills.filter(s => names.includes(s.name));
    if (matched.length > 0) groups[category] = matched;
  }

  const other = skills.filter(s => !allCategorized.has(s.name) && !nonTech.has(s.name));
  if (other.length > 0) groups['Other'] = other;

  return groups;
}

/** Filter out non-technical skills from a skill list (for task forms). */
export function filterTechnicalSkills(skills: Skill[]): Skill[] {
  const nonTech = new Set(NON_TECHNICAL_SKILLS);
  return skills.filter(s => !nonTech.has(s.name));
}
