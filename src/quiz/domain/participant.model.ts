export interface Participant {
  id: string;
  name: string;
  teamId: string | null;
  isCaptain: boolean;
  socketId: string | null;
  score: number;
  joinedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[];
  captainId: string;
  score: number;
  joinedAt: Date;
}
