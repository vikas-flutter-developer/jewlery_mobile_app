import mongoose, { ClientSession } from "mongoose";
import { isDbConnected } from "./serverState.js";

export async function withMongoTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  if (!isDbConnected()) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
