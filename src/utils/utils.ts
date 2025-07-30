export interface StreamItem {
    extractedId: string;
    url: string;
    bigImage: string;
    smallImg: string;
    title: string;
    creatorId: string;
    createdAt: string; // ISO timestamp
    played: boolean;
    playedTs: string | null; // null if not yet played
    upvotes: number;
    hasUpvoted: boolean;
  }
  
  // Tracks which socketId belongs to which userId
export const users = new Map<string, string>();
  
  // Tracks which users are in which creator's stream room
export const streamRoom: {
    [creatorUsername: string]: {
      [userId: string]: {
        socketId: string;
        fullName: string;
        imageUrl: string;
      };
    };
} = {};
  