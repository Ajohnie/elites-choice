import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, Branch, BranchOffice, FirestoreQuery, RippleUtils, Role, UserGroup } from "../lib";
import { FireBase } from "../firebase";
import { RoleUpdatedEvent, UserEvents } from "../events/users";
import { EventEmitter2 } from "@nestjs/event-emitter";


export interface DefaultRole {
  name: UserGroup;
  description: string;
  branches: BranchOffice[];
}

@Injectable()
export class RolesService {
  private rolesDb = FireBase.getCollection(AppRoutes.roles.api.INDEX);

  constructor(private eventEmitter: EventEmitter2) {
  }

  create(role: Role) {
    return new Promise<Role>((resolve, reject) => {
      if (!role) {
        return reject("Please set role and try again !");
      }
      const toSave = (new Role()).toObject(role);
      return this.getRoles().then((roles) => {
        const exists = roles.find((r) => r.isSameAs(role));
        if (exists) {
          const idIsSame = exists.getId() === toSave.getId();
          if (!idIsSame) {
            return reject("Similar user group already exist !");
          }
        }
        const roleHasOneBranch = toSave.getBranches().length === 1;
        if (roleHasOneBranch) {
          toSave.getBranches()[0].setAsDefault(true);
        }
        return this.saveRole(toSave)
          .then((saved) => resolve(saved))
          .catch((reason) => reject(reason));
      }).catch((reason) => reject(reason));
    });
  }

  findAll() {
    return new Promise<Role[]>((resolve, reject) => {
      return this.getRoles().then((roles) => resolve(roles)).catch((reason) => reject(reason));
    });
  }

  findOne(id: any) {
    return `This action returns a #${id} role`;
  }

  update(id: any, role: Role) {
    return `This action updates a #${id} role`;
  }

  getRoleById(id: string) {
    return new Promise<Role | null>((resolve, reject) => {
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide role identifier");
      }
      if (typeof id === "object") {
        return reject(`unsupported role record identifier, contact admin`);
      }
      return this.rolesDb.doc(id).get().then((snapshot) => {
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const role = (new Role()).toObject(rawData);
          role.setId(snapshot.id);
          return resolve(role);
        }
        return resolve(null);
      }).catch((error) => reject(error));
    });
  }

  getRoles(set?: Set<FirestoreQuery>) {
    return new Promise<Role[]>((resolve, reject) => {
      return FireBase.getQueryReference(this.rolesDb, set).get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const roles = snap.docs.map((doc) => {
          const role = (new Role()).toObject(doc.data());
          role.setId(doc.id);
          return role;
        });
        return resolve(roles);
      }).catch((reason) => reject(reason));
    });
  };

  saveRole(role: Role) {
    return new Promise<Role>((resolve, reject) => {
      if (role.getId()) {
        return this.rolesDb.doc(role.getId())
          .set(RippleUtils.sanitizeObject(role))
          .then(() => {
            this.eventEmitter.emit(UserEvents.ROLE_UPDATE, new RoleUpdatedEvent(role));
            return resolve((new Role()).toObject(role));
          })
          .catch((error) => reject(error));
      }
      return this.rolesDb.add(RippleUtils.sanitizeObject(role))
        .then((result) => {
          const newRole = (new Role()).toObject(role);
          newRole.setId(result.id);
          return resolve(newRole);
        }).catch((error) => reject(error));
    });
  }

  getDefaultBranches = () => {
    const mainBranch: Branch = new Branch();
    mainBranch.setName(BranchOffice.MAIN);
    mainBranch.setAllowed(true);
    mainBranch.setAsDefault(true);
    return [mainBranch];
  };

  getDefaultRoles = () => {
    return new Promise<Role[]>((resolve, reject) => {
      return this.getRoles()
        .then((roles) => {
          if (roles.length === 0) {
            const defaultRoles: DefaultRole[] = [
              { name: UserGroup.ADMIN, description: UserGroup.ADMIN, branches: [BranchOffice.MAIN] },
              { name: UserGroup.MANAGER, description: UserGroup.MANAGER, branches: [BranchOffice.MAIN] },
              { name: UserGroup.DIRECTOR, description: UserGroup.DIRECTOR, branches: [BranchOffice.MAIN] },
              { name: UserGroup.ACCOUNTANT, description: UserGroup.ACCOUNTANT, branches: [BranchOffice.MAIN] },
              { name: UserGroup.GUEST, description: UserGroup.GUEST, branches: [BranchOffice.MAIN] },
              { name: UserGroup.SALES_REP, description: UserGroup.SALES_REP, branches: [BranchOffice.MAIN] }
            ];
            const otherRoles: Role[] = defaultRoles.map((defaultRole) => {
              const role = new Role();
              role.setName(defaultRole.name);
              role.setDescription(defaultRole.description);
              role.setBranches(this.getDefaultBranches().filter((branch) => {
                const office: any = branch.getName();
                return defaultRole.branches.indexOf(office) > -1;
              }));
              role.setUser("system");
              return role;
            });
            return this.saveManyRoles(otherRoles)
              .then(() => resolve(otherRoles))
              .catch((error) => reject(error));
          }
          return resolve(roles);
        })
        .catch((error) => reject(error));
    });
  };

  saveManyRoles(roles: Role[]) {
    return new Promise<boolean>((resolve, reject) => {
      if (roles.length === 0) {
        return reject("set roles and try again");
      }
      let batch = this.rolesDb.firestore.batch();
      roles.forEach((role) => {
        if (role.getId()) {
          batch = batch.set(this.rolesDb.doc(role.getId()), RippleUtils.sanitizeObject(role));
        } else {
          batch = batch.create(this.rolesDb.doc(), RippleUtils.sanitizeObject(role));
        }
      });
      return batch.commit()
        .then((result) => resolve(result.length === roles.length))
        .catch((error) => reject(error));
    });
  }

  deleteManyRoles(roles: Role[]) {
    return new Promise<boolean>((resolve, reject) => {
      if (roles.length === 0) {
        return reject("set roles and try again");
      }
      let batch = this.rolesDb.firestore.batch();
      roles.forEach((role) => {
        if (role.getId()) {
          batch = batch.delete(this.rolesDb.doc(role.getId()));
        }
      });
      return batch.commit()
        .then((result) => resolve(result.length === roles.length))
        .catch((error) => reject(error));
    });
  }
}
