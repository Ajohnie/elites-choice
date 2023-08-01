import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { BranchEvents, BranchSavedEvent } from "../../events/branches";

@Injectable()
export class BranchSavedListener {
  @OnEvent(BranchEvents.SAVE)
  handleBranchSavedEvent(event: BranchSavedEvent) {
  }
}