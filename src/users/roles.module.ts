import { Module } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [RolesController],
  providers: [RolesService, UsersService],
  exports: [RolesService]
})
export class RolesModule {
}
