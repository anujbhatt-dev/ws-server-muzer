"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeStream = void 0;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const utils_1 = require("./utils/utils");
const db_1 = require("./utils/db");
exports.activeStream = null;
const httpServer = (0, http_1.createServer)();
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
});
io.on("connection", async (socket) => {
    const creatorUsername = socket.handshake.query.creatorUsername;
    const creatorId = socket.handshake.query.creatorId;
    const joineeId = socket.handshake.query.joineeId;
    const socketId = socket.id;
    const fullName = socket.handshake.query.fullName;
    const joineeUsername = socket.handshake.query.joineeUsername;
    const imageUrl = socket.handshake.query.imageUrl;
    // Track socket ID to joinee ID
    utils_1.users.set(socketId, joineeId);
    // Join socket.io room
    socket.join(creatorUsername);
    // Create or update the stream room
    if (!utils_1.streamRoom[creatorUsername]) {
        utils_1.streamRoom[creatorUsername] = {};
    }
    utils_1.streamRoom[creatorUsername][joineeUsername] = {
        socketId,
        joineeUsername,
        imageUrl,
        fullName
    };
    console.log(JSON.stringify({ streamRoom: utils_1.streamRoom, users: Object.fromEntries(utils_1.users) }));
    // Fetch user by creatorUsername to get user.id
    const user = await db_1.prismaClient.user.findUnique({
        where: { username: creatorUsername },
        select: { id: true },
    });
    if (!user) {
        socket.emit("error", { message: "Creator user not found" });
        return;
    }
    const [streamsFetch, activeStreamFetch] = await Promise.all([
        db_1.prismaClient.stream.findMany({
            where: {
                creatorId: user.id,
                played: false,
            },
            include: {
                _count: {
                    select: {
                        Upvote: true, // ✅ Correct field
                    },
                },
                Upvote: {
                    where: {
                        userId: joineeId,
                    },
                },
            },
            orderBy: [
                {
                    Upvote: {
                        _count: 'desc',
                    },
                },
                {
                    createdAt: 'asc',
                },
            ],
        }),
        db_1.prismaClient.currentStream.findFirst({
            where: {
                userId: user.id,
            },
            include: {
                stream: true, // ✅ Correct field
            },
        }),
    ]);
    const formattedStreams = streamsFetch.map(({ _count, Upvote, ...rest }) => ({
        ...rest,
        userId: rest.creatorId,
        upvotes: _count.Upvote,
        hasUpvoted: Upvote.length > 0,
    }));
    console.log(formattedStreams, activeStreamFetch);
    utils_1.streams.length = 0;
    utils_1.streams.push(...formattedStreams);
    if (activeStreamFetch &&
        activeStreamFetch.userId &&
        activeStreamFetch.streamId &&
        activeStreamFetch.stream) {
        exports.activeStream = {
            userId: activeStreamFetch.userId,
            streamId: activeStreamFetch.streamId,
            stream: activeStreamFetch.stream,
        };
    }
    const getJoineeUsernames = Object.values(utils_1.streamRoom[creatorUsername]).map(user => user.joineeUsername);
    console.log("getJoineeUsernames ", getJoineeUsernames);
    // Broadcast updated list to others in the room (optional)
    io.to(creatorUsername).emit("joined_room", {
        onlineusers: getJoineeUsernames,
        users: Object.fromEntries(utils_1.users),
        onlineUserFullDetails: utils_1.streamRoom[creatorUsername],
        streams: utils_1.streams,
        activeStream: activeStreamFetch
    });
    socket.on("add_stream", (stream) => {
        console.log("add_stream", stream);
        stream.upvotes = 0;
        stream.hasUpvoted = false;
        utils_1.streams.push(stream);
        io.to(creatorUsername).emit("added_stream", utils_1.streams);
    });
    socket.on("play_next", () => {
        const nextStream = utils_1.streams.shift();
        if (nextStream) {
            exports.activeStream = {
                userId: nextStream.creatorId,
                streamId: nextStream.id,
                stream: nextStream,
            };
        }
        io.to(creatorUsername).emit("get_active_stream", exports.activeStream);
        io.to(creatorUsername).emit("get_updated_streams", utils_1.streams);
    });
    socket.on("upvote_stream", ({ streamId, userId }) => {
        utils_1.upvotes.push({ streamId, userId });
        const selectedStream = utils_1.streams.find(stream => stream.id === streamId);
        if (selectedStream) {
            selectedStream.upvotes += 1;
            selectedStream.hasUpvoted = true;
        }
        // 🔁 Re-sort the array after upvote
        utils_1.streams.sort((a, b) => {
            if (b.upvotes === a.upvotes) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return b.upvotes - a.upvotes;
        });
        io.to(creatorUsername).emit("get_updated_streams", utils_1.streams);
    });
    socket.on("downvote_stream", ({ streamId, userId }) => {
        const upvoteIndex = utils_1.upvotes.findIndex((upvote) => upvote.streamId === streamId && upvote.userId === userId);
        if (upvoteIndex !== -1) {
            utils_1.upvotes.splice(upvoteIndex, 1);
        }
        const selectedStream = utils_1.streams.find(stream => stream.id === streamId);
        if (selectedStream) {
            selectedStream.upvotes = Math.max(0, selectedStream.upvotes - 1);
            selectedStream.hasUpvoted = false;
        }
        // 🔁 Re-sort the array after downvote
        utils_1.streams.sort((a, b) => {
            if (b.upvotes === a.upvotes) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return b.upvotes - a.upvotes;
        });
        io.to(creatorUsername).emit("get_updated_streams", utils_1.streams);
    });
    // Disconnect handler
    socket.on("disconnect", () => {
        console.log(`❌ Disconnected: ${socket.id} (${joineeUsername})`);
        utils_1.users.delete(socket.id);
        if (utils_1.streamRoom[creatorUsername]) {
            delete utils_1.streamRoom[creatorUsername][joineeUsername];
            // Clean up if room is empty
            if (Object.keys(utils_1.streamRoom[creatorUsername]).length === 0) {
                delete utils_1.streamRoom[creatorUsername];
            }
        }
        const updatedRoom = utils_1.streamRoom[creatorUsername] || {};
        const updatedUsernames = Object.values(updatedRoom).map(user => user.joineeUsername);
        io.to(creatorUsername).emit("joined_room", {
            onlineusers: updatedUsernames,
            users: Object.fromEntries(utils_1.users),
            onlineUserFullDetails: updatedRoom,
            streams: utils_1.streams,
            activeStream: activeStreamFetch
        });
    });
});
httpServer.listen(4000, () => {
    console.log("🚀 WebSocket server running on http://localhost:4000");
});
