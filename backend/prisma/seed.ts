import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data for idempotent re-runs (Docker restarts)
  await prisma.task.deleteMany();
  await prisma.developer.deleteMany();
  await prisma.skill.deleteMany();

  // Create skills
  const frontend = await prisma.skill.create({ data: { name: 'Frontend' } });
  const backend = await prisma.skill.create({ data: { name: 'Backend' } });

  // Create developers with skills
  const devs = [
    { name: 'Alice', skills: [frontend.id] },
    { name: 'Bob', skills: [backend.id] },
    { name: 'Carol', skills: [frontend.id, backend.id] },
    { name: 'Dave', skills: [backend.id] },
  ];

  for (const dev of devs) {
    await prisma.developer.create({
      data: {
        name: dev.name,
        skills: { connect: dev.skills.map(id => ({ id })) },
      },
    });
  }

  console.log('Seed complete: 2 skills, 4 developers');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
