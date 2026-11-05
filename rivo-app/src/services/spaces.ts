import { makeCache } from "../store/appCache";
import { mockDb, delay } from "./mockStore";

export interface ApiSpace {
  spaceId:      string;
  name:         string;
  description?: string;
  color:        string;
  createdAt:    string;
  updatedAt:    string;
}

export const spacesCache = makeCache<ApiSpace[]>();

export const spacesService = {
  list: () => {
    const spaces = mockDb.listSpaces();
    spacesCache.set(spaces);
    return delay({ spaces });
  },

  create: (body: { name: string; description?: string; color: string }) =>
    delay({ space: mockDb.createSpace(body) }),

  get: (spaceId: string) => {
    const space = mockDb.getSpace(spaceId);
    if (!space) return Promise.reject(new Error(`Space ${spaceId} not found`));
    return delay({ space });
  },

  update: (spaceId: string, body: { name?: string; description?: string; color?: string }) => {
    const space = mockDb.updateSpace(spaceId, body);
    if (!space) return Promise.reject(new Error(`Space ${spaceId} not found`));
    return delay({ space });
  },

  delete: (spaceId: string) => {
    mockDb.deleteSpace(spaceId);
    return delay({ message: "Space deleted" });
  },
};
