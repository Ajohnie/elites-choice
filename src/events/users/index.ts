export * from "./guest-login.event";
export * from "./role-updated.event";
export * from "./user-created.event";
export * from "./user-deleted.event";
export * from "./user-updated.event";

export enum UserEvents {
  "GUEST_LOGIN" = "guest.login",
  "CREATE" = "user.created",
  "DELETE" = "user.deleted",
  "UPDATE" = "user.updated",
  "ROLE_UPDATE" = "role.updated",
}