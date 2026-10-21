import { PrismaClient, RoleDataScope } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.upsert({
    where: { key: "superadmin" },
    update: {},
    create: {
      key: "superadmin",
      name: "Superadmin",
      description: "Acceso total al sistema",
      isSystem: true,
      dataScope: RoleDataScope.all,
      permissions: [],
    },
  });

  const passwordHash = await hashPassword("Password1!");

  // Correo real de Francisco: los mails de Resend llegan; .local rebotaba.
  const superadminEmail = "fsoto@nachipa-w.com";

  await prisma.user.upsert({
    where: { legacyMongoId: "seed-superadmin" },
    update: {
      email: superadminEmail,
      username: "fsoto",
      firstName: "Francisco",
      lastName: "Soto",
      passwordHash,
      confirmed: true,
      state: true,
      deletedAt: null,
      roleId: role.id,
      internalRol: "superadmin",
    },
    create: {
      legacyMongoId: "seed-superadmin",
      run: "1-9",
      username: "fsoto",
      passwordHash,
      firstName: "Francisco",
      lastName: "Soto",
      email: superadminEmail,
      internalRol: "superadmin",
      roleId: role.id,
      confirmed: true,
      state: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
