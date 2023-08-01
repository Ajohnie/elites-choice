export class BranchDeletedEvent {
  branchId: string;

  constructor(branchId: string) {
    this.branchId = branchId;
  }
}