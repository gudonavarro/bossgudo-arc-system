import {
  Schema,
  Types,
  type Connection,
  type Model,
} from "mongoose";

export interface Session {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const sessionSchema = new Schema<Session>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getSessionModel(connection: Connection): Model<Session> {
  return (
    (connection.models.Session as Model<Session> | undefined) ??
    connection.model<Session>("Session", sessionSchema, "sessions")
  );
}
