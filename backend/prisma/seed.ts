import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Skip seeding if data already exists (preserve user data across Docker restarts)
  const existingSkills = await prisma.skill.count();
  if (existingSkills > 0) {
    console.log(`Seed skipped: ${existingSkills} skills already exist`);
    return;
  }

  // Create real tech skills (flat — no hierarchy)
  const skillNames = [
    'React', 'Angular', 'Vue', 'TypeScript', 'Node.js',
    'Python', 'Java', 'Go', 'Rust', 'PostgreSQL',
    'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
    'GraphQL',
  ];

  const skills: Record<string, string> = {};
  for (const name of skillNames) {
    const skill = await prisma.skill.create({ data: { name } });
    skills[name] = skill.id;
  }

  // Create developers with realistic skill sets
  const devs = [
    { name: 'Alice', skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'] },
    { name: 'Bob', skills: ['Java', 'PostgreSQL', 'Docker', 'Kubernetes'] },
    { name: 'Carol', skills: ['React', 'TypeScript', 'Python', 'AWS', 'Docker'] },
    { name: 'Dave', skills: ['Go', 'PostgreSQL', 'Redis', 'Kubernetes'] },
  ];

  for (const dev of devs) {
    await prisma.developer.create({
      data: {
        name: dev.name,
        skills: { connect: dev.skills.map(name => ({ id: skills[name] })) },
      },
    });
  }

  console.log(`Seed complete: ${skillNames.length} skills, ${devs.length} developers`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
