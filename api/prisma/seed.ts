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

  await prisma.user.upsert({
    where: { legacyMongoId: "seed-superadmin" },
    update: {
      passwordHash,
      confirmed: true,
      state: true,
      deletedAt: null,
      roleId: role.id,
    },
    create: {
      legacyMongoId: "seed-superadmin",
      run: "1-9",
      username: "superadmin",
      passwordHash,
      firstName: "francisco",
      lastName: "soto",
      email: "superadmin@nachipa.local",
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
