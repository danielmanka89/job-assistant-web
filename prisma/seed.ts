import "dotenv/config";
import { prisma } from "../lib/db.ts";
import { hashPassword } from "../lib/password.ts";

// Local test account. Safe to re-run: updates the user if it already exists.
const TEST_USER = { email: "test@daniel-sowmya.dev", name: "Test User", password: "TestPass123!" };

async function main() {
  const passwordHash = await hashPassword(TEST_USER.password);
  const user = await prisma.user.upsert({
    where: { email: TEST_USER.email },
    update: { name: TEST_USER.name, passwordHash },
    create: { email: TEST_USER.email, name: TEST_USER.name, passwordHash },
  });
  console.log(`Seeded test user ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
