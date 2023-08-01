import { Branch } from "../../lib";

export class BranchSavedEvent {
  branch: Branch;

  constructor(branch: Branch) {
    this.branch = branch;
  }
}