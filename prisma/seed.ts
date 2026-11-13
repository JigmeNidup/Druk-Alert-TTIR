import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { directDatabaseUrl } from "../src/lib/database-url";
import { ZONES } from "../src/lib/zones";

const url = directDatabaseUrl();
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

const ADMIN_USERNAME = "admin";
const ADMIN_CONTACT = "admin@ttirangjung.bt";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? "";

async function main() {
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("Set ADMIN_PASSWORD in .env to at least 12 characters before seeding.");
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      contact: ADMIN_CONTACT,
      passwordHash,
      isAdmin: true,
    },
    create: {
      username: ADMIN_USERNAME,
      contact: ADMIN_CONTACT,
      passwordHash,
      isAdmin: true,
    },
  });

  for (const zone of ZONES) {
    await prisma.zoneStatus.upsert({
      where: { zone: zone.id },
      update: { name: zone.name },
      create: {
        zone: zone.id,
        name: zone.name,
        status: "Awaiting telemetry",
        alert: false,
      },
    });
  }

  console.log("Seeded admin user.");
  console.log(`  username: ${ADMIN_USERNAME}`);
  console.log(`  contact:  ${ADMIN_CONTACT}`);
  console.log("Zone rows are ready.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
