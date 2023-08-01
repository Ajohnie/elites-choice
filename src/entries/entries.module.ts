import { Module } from "@nestjs/common";
import { EntriesController } from "./entries.controller";
import { SharedModule } from "../shared/shared.module";
import { AccountsModule } from "../accounts/accounts.module";
import { EntriesService } from "./entries.service";
import { TagsService } from "./tags.service";
import { EntryTypesService } from "./entry-types.service";
import { EntryTypesController } from "./entry-types.controller";
import { TagsController } from "./tags.controller";
import { LedgersModule } from "../ledgers/ledgers.module";

@Module({
  controllers: [EntriesController, EntryTypesController, TagsController],
  exports: [EntriesService, EntryTypesService, TagsService],
  providers: [EntryTypesService, TagsService, EntriesService],
  imports: [SharedModule, AccountsModule, LedgersModule]
})
export class EntriesModule {
}
