import { Module } from "@nestjs/common";
import { LedgersController } from "./ledgers.controller";
import { SharedModule } from "../shared/shared.module";
import { AccountsModule } from "../accounts/accounts.module";
import { GroupsController } from "./groups.controller";
import { EntriesService } from "../entries/entries.service";

@Module({
  imports: [SharedModule, AccountsModule],
  exports: [],
  providers: [EntriesService],
  controllers: [LedgersController, GroupsController]
})
export class LedgersModule {
}
