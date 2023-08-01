import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { UserCreatedEvent, UserEvents } from "../../events/users";
import { FireBase } from "../../firebase";
import { AppUtils, DefaultPhoto } from "../../lib";
import { EmailsService } from "../../emails/emails.service";

@Injectable()
export class UserCreatedListener {
  constructor(private emails: EmailsService) {
  }

  @OnEvent(UserEvents.CREATE)
  handleUserCreatedEvent(event: UserCreatedEvent) {
    const photoURL = AppUtils.isUrl(event.photoURL) ? event.photoURL : DefaultPhoto.MALE;
    const phoneNo = AppUtils.getIntPhoneNo(event.phoneNumber);
    const phoneNumber = AppUtils.stringIsSet(phoneNo) ? phoneNo : null;
    console.log(`user ${event.displayName}, phone No ${event.phoneNumber}-${phoneNumber}, email ${event.email} was created successfully`);
    FireBase.auth().createUser({
      email: event.email,
      password: event.password,
      displayName: event.displayName,
      phoneNumber,
      photoURL
    }).then(() => {
      return this.emails.sendPassword(event.displayName, event.email, event.password)
        .then(() => console.log(`sent password to user with email ${event.email}`))
        .catch((reason) => console.error(reason));
    }).catch((reason: any) => console.error(reason));
  }
}