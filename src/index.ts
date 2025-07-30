import { createServer } from "http";
import { Server } from "socket.io";
import { streamRoom, users } from "./utils/utils";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

io.on("connection", (socket) => {
  // console.log(`🔌 Socket connected: ${socket.id} `);
  // console.log(JSON.stringify(socket.handshake.query));
  
  const creatorUsername = socket.handshake.query.creatorUsername as string;
  const creatorId = socket.handshake.query.creatorId as string;
  const joineeId = socket.handshake.query.joineeId as string;
  const socketId = socket.id;
  const fullName = socket.handshake.query.fullName as string;
  const imageUrl = socket.handshake.query.imageUrl as string;
  
  
  users.set(socketId,joineeId);  
  socket.join(creatorUsername);
  if(!streamRoom[creatorUsername]){
    streamRoom[creatorUsername] = {}
  }
  streamRoom[creatorUsername] = {
    [joineeId]:{
      socketId,
      fullName:"joinee",
      imageUrl
    }
  }
  
  
  console.log(Object.values(streamRoom[creatorUsername]));

  
  socket.emit("joined_room",{onlineusers:Object.values(streamRoom[creatorUsername])})




  // ========== DISCONNECT ==========
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id} (${joineeId})`);
    users.delete(socket.id);    
  });
 
});

httpServer.listen(4000, () => {
  console.log("🚀 WebSocket server running on http://localhost:4000");
});
