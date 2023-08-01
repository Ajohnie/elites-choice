import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, Branch, FirestoreQuery } from "../lib";
import { FireBase } from "../firebase";
import { BranchDeletedEvent, BranchEvents, BranchSavedEvent } from "../events/branches";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class BranchesService {
  private branchesDb = FireBase.getCollection(AppRoutes.branches.api.INDEX);
  private useDemo = false;
  private branches: Branch[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  save(branch: Branch) {
    return new Promise<Branch>((resolve, reject) => {
      return branch.validate().then(async () => {
        try {
          if (AppUtils.stringIsSet(branch.getId())) {
            branch.modified = new Date();
            return this.branchesDb.doc(branch.getId().toString())
              .set(AppUtils.sanitizeObject(branch))
              .then(() => {
                const savedBr = (new Branch()).toObject(branch);
                const index = this.branches.findIndex((prd) => prd.branchId === savedBr.branchId);
                if (index > -1) {
                  this.branches[index] = savedBr;
                } else {
                  this.branches.push(savedBr);
                }
                // resolve address
                this.eventEmitter.emit(BranchEvents.SAVE, new BranchSavedEvent(branch));
                return resolve((new Branch()).toObject(branch));
              })
              .catch((error) => reject(error));
          }
          return this.branchesDb.add(AppUtils.sanitizeObject(branch))
            .then((result) => {
              const newBranch = (new Branch()).toObject(branch);
              newBranch.setId(result.id);
              this.branches.push(newBranch);
              // resolve address
              this.eventEmitter.emit(BranchEvents.SAVE, new BranchSavedEvent(newBranch));
              return resolve(newBranch);
            }).catch((error) => reject(error));
        } catch (e) {
          return reject(e);
        }
      }).catch((error) => reject(error));
    });
  }

  getBranchById(id: string) {
    return new Promise<Branch | null>((resolve, reject) => {
      if (typeof id === "object") {
        return reject(`unsupported branch record identifier, contact admin`);
      }
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide branch identifier");
      }
      return this.branchesDb.doc(id.toString()).get().then((snapshot) => {
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const branch = (new Branch()).toObject(rawData);
          branch.setId(snapshot.id);
          return resolve(branch);
        }
        return resolve(null);
      }).catch((error) => reject(error));
    });
  }

  getBranchByBranchId(id: string) {
    return new Promise<Branch | null>((resolve, reject) => {
      if (typeof id === "object") {
        return reject(`unsupported branch record identifier, contact admin`);
      }
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide branch identifier");
      }
      console.log("branch ID: " + id);
      return this.getBranchesByOptions()
        .then((branches) => {
          const branch = branches.find((br) => {
            return br.branchId.toString() === id.toString();
          });
          return resolve(branch || null);
        })
        .catch((reason) => reject(reason));
    });
  }

  deleteManyBranches = (branchIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (branchIds.length === 0) {
        return reject("select branches and try again");
      }
      let batch = this.branchesDb.firestore.batch();
      branchIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.branchesDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        branchIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.branches.findIndex((prd) => prd.getId() === id);
            if (index > -1) {
              this.branches.splice(index, 1);
            }
            this.eventEmitter.emit(BranchEvents.DELETE, new BranchDeletedEvent(id));
          }
        });
        return resolve(result.length === branchIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveBranches(branches: Branch[]) {
    return new Promise<boolean>((resolve, reject) => {
      let batch = this.branchesDb.firestore.batch();
      for (const branch of branches) {
        branch.modified = new Date();
        if (!AppUtils.stringIsSet(branch.getId())) {
          batch = batch.create(this.branchesDb.doc(), AppUtils.sanitizeObject(branch));
        } else {
          batch = batch.set(this.branchesDb.doc(branch.getId().toString()), AppUtils.sanitizeObject(branch));
        }
      }
      return batch.commit()
        .then((saved) => {
          this.branches.splice(0);
          return resolve(saved.length === branches.length);
        })
        .catch((error) => reject(error));
    });
  }

  hasBranches() {
    return this.branches.length > 0;
  }

  getBranchesByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Branch[]>((resolve, reject) => {
      if (!AppUtils.hasResponse(options) && this.hasBranches()) {
        console.log(`\n------------using existing ${this.branches.length} branches---------------\n`);
        return resolve(this.branches);
      }
      let queryFn = this.branchesDb.orderBy("created");
      const set = new Set<FirestoreQuery>();
      if (AppUtils.stringIsSet(options.branchId)) {
        set.add({ key: "branchId", operator: "==", value: options.branchId.toString() });
      }
      if (AppUtils.stringIsSet(options.id)) {
        set.add({ key: "id", operator: "==", value: options.id });
      }
      if (AppUtils.stringIsSet(options.name)) {
        set.add({ key: "name", operator: "==", value: options.name });
      }
      if (AppUtils.stringIsSet(options.modifiedBy)) {
        set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
      }
      if (AppUtils.stringIsSet(options.date)) {
        const operator = options.dateOperator || "==";
        set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
      }
      queryFn = FireBase.getQueryReference(queryFn, set);
      if (options.startDate && options.endDate) {
        queryFn = FireBase.getEntitiesByDateRange(queryFn,
          options.startDate,
          options.endDate,
          true, "created");
      }
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const branches: Branch[] = snap.docs.map((doc) => {
          const branch = new Branch().toObject(doc.data());
          branch.setId(doc.id);
          return branch;
        });
        if (!AppUtils.hasResponse(options)) {
          this.branches = branches;
          console.log(`\n------------loaded ${this.branches.length} branches successfully---------------\n`);
        }
        return resolve(branches);
      }).catch((reason) => reject(reason));
    });
  }

  private addDemoData() {
    return new Promise<boolean>((resolve, reject) => {
      const data = [{ name: "MAIN" }];
      const branches = data.map((br) => {
        const branch = new Branch();
        branch.setName(br.name);
        return branch;
      });
      return this.saveBranches(branches).then((ok) => resolve(ok)).catch((reason) => reject(reason));
    });
  }
}

function imports() {
  throw new Error("Function not implemented.");
}

