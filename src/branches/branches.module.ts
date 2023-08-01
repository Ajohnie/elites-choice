import { Module } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { BranchesController } from "./branches.controller";
import { BranchDeletedListener, BranchSavedListener } from "../listeners/branches";

@Module({
  controllers: [BranchesController],
  providers: [
    BranchesService,
    BranchSavedListener,
    BranchDeletedListener],
  exports: [BranchesService]
})
export class BranchesModule {
}
