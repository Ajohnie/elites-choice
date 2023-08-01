import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { BranchDeletedEvent, BranchEvents } from "../../events/branches";

@Injectable()
export class BranchDeletedListener {
  constructor() {
  }

  @OnEvent(BranchEvents.DELETE)
  async handleBranchDeletedEvent(event: BranchDeletedEvent) {
    try {

    } catch (e) {
      console.error(e);
    }
  }
}