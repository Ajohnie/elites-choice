import { Module } from "@nestjs/common";
import { AccountsController } from "./accounts.controller";
import { AuthModule } from "../auth/auth.module";
import { SharedModule } from "../shared/shared.module";
import { AccountsService } from "./accounts.service";
import { LedgersService } from "../ledgers/ledgers.service";

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, LedgersService],
  exports: [AccountsService],
  imports: [AuthModule, SharedModule]
})
export class AccountsModule {
}
