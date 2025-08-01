import { createServer } from "http";
import { Server } from "socket.io";
import { 
  streamRoom, 
  users, 
  streams, 
  upvotes
 } from "./utils/utils";
import { prismaClient } from "./utils/db";

export type StreamType = 'Youtube' | 'Spotify' | 'Twitch'; // Extend based on your actual enum

export interface UserStreamPayload {
  userId: string;
  streamId: string;
  stream: {
    id: string;
    type: StreamType;
    active: boolean;
    extractedId: string;
    url: string;
    bigImage: string;
    smallImg: string;
    title: string;
    creatorId: string;
    createdAt: Date; // Because Prisma returns a Date object
    played: boolean;
    playedTs: Date | null; // Also Date, or null
  };
}

 
export let activeStream:UserStreamPayload | null = null;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});




io.on("connection", async (socket) => {
  const creatorUsername = socket.handshake.query.creatorUsername as string;
  const creatorId = socket.handshake.query.creatorId as string;
  const joineeId = socket.handshake.query.joineeId as string;
  const socketId = socket.id;
  const fullName = socket.handshake.query.fullName as string;
  const joineeUsername = socket.handshake.query.joineeUsername as string;
  const imageUrl = socket.handshake.query.imageUrl as string;

  // Track socket ID to joinee ID
  users.set(socketId, joineeId);

  // Join socket.io room
  socket.join(creatorUsername);

  // Create or update the stream room
  if (!streamRoom[creatorUsername]) {
    streamRoom[creatorUsername] = {};
  }

  streamRoom[creatorUsername][joineeUsername] = {
    socketId,
    joineeUsername,
    imageUrl,
    fullName
  };


  console.log(JSON.stringify({ streamRoom, users: Object.fromEntries(users) }));

  // Fetch user by creatorUsername to get user.id
  const user = await prismaClient.user.findUnique({
    where: { username: creatorUsername },
    select: { id: true },
  });

  if (!user) {
    socket.emit("error", { message: "Creator user not found" });
    return;
  }

  const [streamsFetch, activeStreamFetch] = await Promise.all([
    prismaClient.stream.findMany({
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
  
    prismaClient.currentStream.findFirst({
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
  
  console.log(formattedStreams,activeStreamFetch);
  streams.length = 0;
  streams.push(...formattedStreams);
  if (
    activeStreamFetch &&
    activeStreamFetch.userId &&
    activeStreamFetch.streamId &&
    activeStreamFetch.stream
  ) {
    activeStream = {
      userId: activeStreamFetch.userId,
      streamId: activeStreamFetch.streamId,
      stream: activeStreamFetch.stream,
    };
  }
  

  const getJoineeUsernames  = Object.values(streamRoom[creatorUsername]).map(user => user.joineeUsername);
  console.log("getJoineeUsernames ",getJoineeUsernames);
  

  // Broadcast updated list to others in the room (optional)
  io.to(creatorUsername).emit("joined_room", {
    onlineusers: getJoineeUsernames,
    users: Object.fromEntries(users),
    onlineUserFullDetails:streamRoom[creatorUsername],
    streams,
    activeStream:activeStreamFetch
  });

  socket.on("add_stream",(stream)=>{
    console.log("add_stream", stream);
    stream.upvotes= 0
    stream.hasUpvoted = false;    
    streams.push(stream);
    io.to(creatorUsername).emit("added_stream",streams)
  })

  socket.on("play_next",()=>{
    const nextStream = streams.shift();
    if(nextStream){
      activeStream = {
        userId: nextStream.creatorId,
        streamId: nextStream.id,
        stream: nextStream,
      };
    }
    io.to(creatorUsername).emit("get_active_stream",activeStream)
    io.to(creatorUsername).emit("get_updated_streams",streams)
  })


  socket.on("upvote_stream", ({ streamId, userId }: { streamId: string, userId: string }) => {
    upvotes.push({ streamId, userId });
  
    const selectedStream = streams.find(stream => stream.id === streamId);
    if (selectedStream) {
      selectedStream.upvotes += 1;
      selectedStream.hasUpvoted = true;
    }
  
    // 🔁 Re-sort the array after upvote
    streams.sort((a, b) => {
      if (b.upvotes === a.upvotes) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return b.upvotes - a.upvotes;
    });
  
    io.to(creatorUsername).emit("get_updated_streams", streams);
  });

  socket.on("downvote_stream", ({ streamId, userId }: { streamId: string, userId: string }) => {
    const upvoteIndex = upvotes.findIndex(
      (upvote) => upvote.streamId === streamId && upvote.userId === userId
    );
    if (upvoteIndex !== -1) {
      upvotes.splice(upvoteIndex, 1);
    }
  
    const selectedStream = streams.find(stream => stream.id === streamId);
    if (selectedStream) {
      selectedStream.upvotes = Math.max(0, selectedStream.upvotes - 1);
      selectedStream.hasUpvoted = false;
    }
  
    // 🔁 Re-sort the array after downvote
    streams.sort((a, b) => {
      if (b.upvotes === a.upvotes) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return b.upvotes - a.upvotes;
    });
  
    io.to(creatorUsername).emit("get_updated_streams", streams);
  });
  


  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id} (${joineeUsername})`);
    users.delete(socket.id);
  
    if (streamRoom[creatorUsername]) {
      delete streamRoom[creatorUsername][joineeUsername];
  
      // Clean up if room is empty
      if (Object.keys(streamRoom[creatorUsername]).length === 0) {
        delete streamRoom[creatorUsername];
      }
    }
  
    const updatedRoom = streamRoom[creatorUsername] || {};
    const updatedUsernames = Object.values(updatedRoom).map(user => user.joineeUsername);
  
    io.to(creatorUsername).emit("joined_room", {
      onlineusers: updatedUsernames,
      users: Object.fromEntries(users),
      onlineUserFullDetails: updatedRoom,
      streams,
      activeStream:activeStreamFetch
    });

  });
  
});

httpServer.listen(4000, () => {
  console.log("🚀 WebSocket server running on http://localhost:4000");
});
