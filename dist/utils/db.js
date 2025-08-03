"use strict";
// lib/prisma.ts (or wherever you store it)
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaClient = void 0;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
exports.prismaClient = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: ['query'], // optional: for debugging
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prismaClient;
