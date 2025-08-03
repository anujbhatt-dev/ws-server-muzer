"use strict";
// lib/prisma.ts (or wherever you store it)
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaClient = void 0;
const prisma_1 = require("../generated/prisma");
const globalForPrisma = globalThis;
exports.prismaClient = globalForPrisma.prisma ??
    new prisma_1.PrismaClient({
        log: ['query'], // optional: for debugging
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prismaClient;
