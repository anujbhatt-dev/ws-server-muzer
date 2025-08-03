"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streams = exports.upvotes = exports.streamRoom = exports.users = void 0;
// Tracks which socketId belongs to which userId
exports.users = new Map();
// Tracks which users are in which creator's stream room
exports.streamRoom = {};
exports.upvotes = [];
exports.streams = [];
