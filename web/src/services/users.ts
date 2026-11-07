import { api } from "./api";

export interface Profile {
  id: string;
  email: string;
  role: "admin" | "editor" | "operator" | "viewer" | "member";
  status: string;
  effectivePermissions: string[];
}

export const usersService = {
  me: () => api.get<Profile>("/users/me"),
};

export function isPlatformAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function hasPlatformPermission(profile: Profile | null, permission: string): boolean {
  const perms = profile?.effectivePermissions ?? [];
  return perms.includes("*") || perms.includes(permission);
}
