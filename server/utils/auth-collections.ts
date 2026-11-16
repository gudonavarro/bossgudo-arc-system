import type { Model } from "mongoose";
import type { Session } from "../models/session";
import type { User } from "../models/user";

interface ProjectionOptions {
  projection?: Record<string, 0 | 1>;
}

interface UpdateOptions {
  projection?: Record<string, 0 | 1>;
  returnDocument?: "before" | "after";
}

function applyProjection<T>(
  query: import("mongoose").Query<unknown, T>,
  projection?: Record<string, 0 | 1>,
) {
  if (!projection) {
    return query;
  }
  const fields = Object.entries(projection)
    .filter(([, include]) => include === 1)
    .map(([field]) =>
      field === "password" || field === "resetTokenHash" ? `+${field}` : field,
    );
  return query.select(fields.join(" "));
}

export function createAuthCollections(
  userModel: Model<User>,
  sessionModel: Model<Session>,
) {
  return {
    users: {
      findOne(filter: Record<string, unknown>, options: ProjectionOptions = {}) {
        return applyProjection(userModel.findOne(filter), options.projection).lean();
      },
      async insertOne(document: Partial<User>) {
        const user = await userModel.create(document);
        return { insertedId: user._id };
      },
      updateOne(filter: Record<string, unknown>, update: Record<string, unknown>) {
        return userModel.updateOne(filter, update);
      },
      findOneAndUpdate(
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options: UpdateOptions = {},
      ) {
        const query = userModel.findOneAndUpdate(filter, update, {
          returnDocument: options.returnDocument,
        });
        return applyProjection(query, options.projection).lean();
      },
    },
    sessions: {
      findOne(filter: Record<string, unknown>) {
        return sessionModel.findOne(filter).lean();
      },
      async insertOne(document: Partial<Session>) {
        const session = await sessionModel.create(document);
        return { insertedId: session._id };
      },
      deleteOne(filter: Record<string, unknown>) {
        return sessionModel.deleteOne(filter);
      },
      deleteMany(filter: Record<string, unknown>) {
        return sessionModel.deleteMany(filter);
      },
    },
  };
}
