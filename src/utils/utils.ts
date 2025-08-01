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
        fullName?: string;
        imageUrl?: string;
        joineeUsername?:string
      };
    };
} = {};

export interface StreamsSchema {
  id: string;
  type: 'Youtube' | 'Spotify'; // assuming you only use these two as per your enum
  active: boolean;
  extractedId: string;
  url: string;
  bigImage: string;
  smallImg: string;
  title: string;
  creatorId: string;
  createdAt: Date;
  played: boolean;
  playedTs: Date | null;
  upvotes:number,
  hasUpvoted:boolean
}

export interface UpvotesSchema {
  id?: string;
  userId: string;
  streamId: string;
}

export const upvotes:UpvotesSchema[] = []

export const streams:StreamsSchema[] = []