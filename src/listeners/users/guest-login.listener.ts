import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { GuestLoginEvent, UserEvents } from "../../events/users";
import { EmailsService } from "../../emails/emails.service";
import { UsersService } from "../../users/users.service";

@Injectable()
export class GuestLoginListener {
  constructor(private emails: EmailsService,
              private users: UsersService) {
  }

  @OnEvent(UserEvents.GUEST_LOGIN)
  handleGuestLoginEvent(event: GuestLoginEvent) {
    const userId = event.userId;
    this.users.getUserById(userId).then((user) => {
      if (!user) {
        console.error(`Error generating otp, user with id ${userId} was not found`);
      } else {
        const otpDate = new Date();
        const otpString = otpDate.getTime().toString();
        const otp = otpString.length > 4 ? otpString.substring(otpString.length - 4) : otpString;
        user.setOtp(otp, otpDate);
        const expire = user.otpExpiry();
        this.users.saveUser(user)
          .then(() => this.emails.sendOtp(user.getName(), user.getEmail(), otp, expire)
            .then(() => console.log(`sent otp ${otp} to: ${user.getEmail()}`))
            .catch((reason) => console.error(reason)))
          .catch((reason) => console.error(reason));
      }
    }).catch((reason) => console.error(reason));
  }
}