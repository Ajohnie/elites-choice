import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { RolesController } from "./roles.controller";
import { RoleUpdatedListener, UserCreatedListener, UserDeletedListener, UserUpdatedListener } from "../listeners/users";
import { GuestLoginListener } from "../listeners/users/guest-login.listener";
import { EmailsModule } from "../emails/emails.module";
import { RolesModule } from "./roles.module";

@Module({
  imports: [EmailsModule, RolesModule],
  controllers: [UsersController, RolesController],
  exports: [UsersService],
  providers: [
    UsersService,
    UserCreatedListener,
    UserUpdatedListener,
    UserDeletedListener,
    RoleUpdatedListener,
    GuestLoginListener
  ]
})
export class UsersModule {
}
