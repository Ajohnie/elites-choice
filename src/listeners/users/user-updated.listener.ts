import { Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { UserCreatedEvent, UserEvents, UserUpdatedEvent } from "../../events/users";
import { AppUtils, DefaultPhoto } from "../../lib";
import { FireBase } from "../../firebase";

@Injectable()
export class UserUpdatedListener {

  constructor(private eventEmitter: EventEmitter2) {
  }

  @OnEvent(UserEvents.UPDATE)
  handleUserUpdatedEvent(event: UserUpdatedEvent) {
    const createInstead = () => {
      const photoURL = AppUtils.isUrl(event.photoURL) ? event.photoURL : DefaultPhoto.MALE;
      const phoneNo = AppUtils.getIntPhoneNo(event.phoneNumber);
      const phoneNumber: any = AppUtils.stringIsSet(phoneNo) ? phoneNo : null;
      this.eventEmitter.emit(UserEvents.CREATE, new UserCreatedEvent(
        event.email,
        event.password,
        event.displayName,
        phoneNumber,
        photoURL
      ));
    };
    let emailBefore = event.emailBefore;
    if (!AppUtils.stringIsSet(emailBefore)) {
      if (!AppUtils.stringIsSet(event.email)) {
        return;
      }
      emailBefore = event.email;
    }
    FireBase.auth().getUserByEmail(emailBefore).then((record) => {
      // if user exists update else create a new one
      if (record) {
        const photoURL = AppUtils.isUrl(event.photoURL) ? event.photoURL : DefaultPhoto.MALE;
        const phoneNo = AppUtils.getIntPhoneNo(event.phoneNumber);
        const phoneNumber = AppUtils.stringIsSet(phoneNo) ? phoneNo : null;
        FireBase.auth().updateUser(record.uid, {
          email: event.email,
          password: event.password,
          displayName: event.displayName,
          phoneNumber,
          photoURL
        })
          .then(() => console.log(`updated user with email ${event.email}`))
          .catch((reason: any) => console.error(reason));
      } else {
        createInstead();
      }
    }).catch((error) => {
      console.error(error);
      createInstead();
    });
  }
}