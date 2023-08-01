import { Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { RoleUpdatedEvent, UserEvents } from "../../events/users";
import { FirestoreQuery } from "../../lib";
import { UsersService } from "../../users/users.service";

@Injectable()
export class RoleUpdatedListener {

  constructor(private eventEmitter: EventEmitter2,
              private usersService: UsersService) {
  }

  @OnEvent(UserEvents.ROLE_UPDATE)
  handleRoleUpdatedEvent(event: RoleUpdatedEvent) {
    const role = event.role;
    const search = [{ key: "role.id", operator: "==", value: role.getId() }];
    const set = new Set<FirestoreQuery>(search);
    this.usersService.getUsers(set).then((users) => {
      const usersExist = users.length > 0;
      if (usersExist) {
        const promises = users.map((user) => {
          user.setRole(role);
          user.setModified(role.getModifiedBy());
          return this.usersService.saveUser(user)
            .then(() => console.log(`updated role for user with email ${user.getEmail()}`))
            .catch((reason) => console.error(reason));
        });
        return Promise.all(promises)
          .then(() => console.log(`updated users with role ${role.getName()}`))
          .catch((reason) => console.error(reason));
      }
    }).catch((reason) => console.error(reason));
  }
}