// Usage: node scripts/delete-product.mjs <productId>  (cleanup helper for AI test runs)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const id = process.argv[2];
await prisma.product.delete({ where: { id } });
console.log("deleted", id);
await prisma.$disconnect();
