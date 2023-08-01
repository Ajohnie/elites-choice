import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { UserDeletedEvent, UserEvents } from "../../events/users";
import { FireBase } from "../../firebase";

@Injectable()
export class UserDeletedListener {
  @OnEvent(UserEvents.DELETE)
  handleUserDeletedEvent(event: UserDeletedEvent) {
    FireBase.auth().getUserByEmail(event.email)
      .then((u) => {
        if (!u) {
          console.log(`failed to remove user with email ${event.email}`);
          return Promise.resolve();
        }
        return FireBase.auth().deleteUser(u.uid)
          .then(() => console.log(`removed user with email ${event.email}`))
          .catch((reason) => console.error(reason));
      }).catch((reason: any) => console.error(reason));
  }
}