import "dotenv/config";
import { prisma } from "../lib/db.ts";
import { hashPassword } from "../lib/password.ts";

// Local test accounts: one job seeker, one employer. Safe to re-run: existing users are updated.
const TEST_USERS = [
  { email: "test@daniel-sowmya.dev", name: "Test User", password: "TestPass123!", role: "SEEKER" },
  { email: "employer@daniel-sowmya.dev", name: "Test Employer", password: "TestPass123!", role: "EMPLOYER" },
];

async function main() {
  for (const { email, name, password, role } of TEST_USERS) {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role },
      create: { email, name, passwordHash, role },
    });
    console.log(`Seeded ${user.role.toLowerCase()} ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
