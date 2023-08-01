import { Role } from "../../lib";

export class RoleUpdatedEvent {
  role: Role;

  constructor(role: Role) {
    this.role = role;
  }
}