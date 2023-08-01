import { Injectable } from "@nestjs/common";
import { FireBase } from "../firebase";
import { Account, AppRoutes, AppUtils, Group, GroupFactory } from "../lib";
import { EntryTypesService } from "../entries/entry-types.service";


@Injectable()
export class GroupsService extends EntryTypesService {
  private groupsDb = FireBase.getCollection(AppRoutes.groups.api.DB);
  private groupsDetailsDb = FireBase.getCollection(AppRoutes.groups.api.DETAILS_DB);
  private groups: Group[] = [];

  constructor() {
    super();
  }

  getGroupById = (groupId: any, groupFactoryId: string | number, idName = "id") => {
    return new Promise<Group | null>((resolve, reject) => {
      if (typeof groupId === null) {
        return reject(`unknown group, contact admin`);
      }
      if (!groupFactoryId) {
        return reject(`provide group Factory identifier`);
      }
      if (typeof groupFactoryId === "object") {
        return reject(`unsupported group factory record identifier, contact admin`);
      }
      return this.groupsDetailsDb
        .where(idName, "==", isNaN(groupId) ? groupId : parseInt(groupId, 0))
        .where("factoryId", "==", groupFactoryId).limit(1).get().then((snap) => {
          if (snap.empty) {
            console.error(`group with ${idName} ${groupId?.toString()} and Factory Id ${groupFactoryId?.toString()} not found`);
            return resolve(null);
          }
          const doc: any = snap.docs[0];
          if (doc.exists) {
            const posGroup = new Group().toObject(doc.data());
            return resolve(posGroup);
          }
          console.error(`group with ${idName} ${groupId?.toString()} does not exist`);
          return resolve(null);
        }).catch((reason) => reject(reason));
    });
  };

  getGroupFactory(account: Account, parentOnly = false) {
    return new Promise<GroupFactory>((resolve, reject) => {
      const factoryId = account.getId();
      if (!factoryId) {
        return reject(`provide account identifier for ${account.getSettings().getAccountLabel(true)}`);
      }
      return this.groupsDb.doc(factoryId).get().then((snap) => {
        if (!snap.exists) {
          // return Promise.reject(`Job cards for ${account.getName()} are not configured`);
          return this.saveGroupFactory(account).then((savedFactory) => {
            return resolve(savedFactory);
          }).catch((reason) => reject(reason));
        }
        const factory: GroupFactory = AppUtils.toObject(new GroupFactory(), snap.data());
        factory.setId(snap.id);
        if (parentOnly) {
          return resolve(factory);
        }
        account.setGroupFactory(factory);
        return resolve(factory);
      }).catch((reason) => reject(reason));
    });
  }

  saveGroupFactory = (account: Account, groupFactory?: GroupFactory): Promise<GroupFactory> => {
    return new Promise<GroupFactory>((resolve, reject) => {
      /* don't accept to save factory minus saving account*/
      if (!account.getId()) {
        return reject(`Save ${account.getSettings().getAccountLabel(true)}\'s Account config`);
      }
      if (!groupFactory) {
        account.configureFactories();
      } else {
        groupFactory.setConfiguration(account.getConfiguration());
      }
      const factory = !groupFactory ? account.getGroupFactory() : groupFactory;
      const sanitized = !groupFactory ? AppUtils.sanitizeObject(factory) : AppUtils.sanitizeObject(factory.toShortObject());
      return this.groupsDb.doc(account.getId()).set(sanitized).then(() => {
        const saved = (new GroupFactory()).toObject(factory);
        if (!groupFactory) {
          account.setGroupFactory(saved);
        }
        return resolve(saved);
      }).catch((error) => reject(error));
    });
  };
  beforeSavingGroup = (group: Group, factoryId: any) => {
    return new Promise<Group>((resolve, reject) => {
      return this.validateGroupInputs(group, factoryId).then((sameGroup) => {
        return resolve(sameGroup);
      }).catch((reason) => {
        return reject(reason);
      });
    });
  };
  getAllGroups = (groupFactoryId: any) => {
    return new Promise<Group[]>((resolve, reject) => {
      if (!groupFactoryId) {
        return reject(`provide group Factory identifier`);
      }
      return this.groupsDetailsDb
        .where("factoryId", "==", groupFactoryId).get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const groups = snap.docs.map((doc: any) => new Group().toObject(doc.data()));
          return resolve(groups);
        }).catch((reason) => reject(reason));
    });
  };
  getValidParentIds = (currentGroupId: any, factoryId: any) => {
    return new Promise<any[]>(async (resolve, reject) => {
      try {
        const groups = await this.getAllGroups(factoryId);
        const validGroups: Group[] = [];
        validGroups.push(...groups);
        if (currentGroupId) {
          groups.forEach((group) => {
            const isBeingEdited = group.getId() === currentGroupId;
            if (isBeingEdited) {
              const index = validGroups.indexOf(group);
              validGroups.splice(index, 1);
            }
            const removeChild = (child: Group, parentId: any) => {
              const isChild = child.belongsToParent(parentId);
              if (isChild) {
                const index = validGroups.indexOf(child);
                validGroups.splice(index, 1);
                const grandChildren = groups.filter((grp) => grp.belongsToParent(child.getId()));
                grandChildren.forEach((gChild) => removeChild(gChild, child.getId()));
              }
            };
            removeChild(group, currentGroupId);
          });
        }
        return resolve(validGroups.map((group) => group.getId()));
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  };
  validateGroupInputs = (group: Group, factoryId: any) => {
    return new Promise<Group>(async (resolve, reject) => {
      try {
        const nameIsNotSet = group.getName() === "";
        if (nameIsNotSet) {
          return reject("Group name is required");
        }
        if (group.getId()) {
          const oldGroupId = await this.getGroupById(group.getId(), factoryId);
          if (!oldGroupId) {
            return reject("Group Not Found or was deleted!");
          }
        }
        const parentIdIsNotSet = (group.getParentId() === null || group.getParentId() === "");
        const parentIsNotSet = parentIdIsNotSet && !group.isSystemType();
        if (parentIsNotSet) {
          return reject("Parent Group is not set");
        }
        const parentIsNotValid = (await this.getValidParentIds(group.getId(), factoryId)).indexOf(group.getParentId()) < 0;
        if (parentIsNotValid) {
          return reject("Parent Group is Invalid, parent group can not be a sub group of the current group");
        }
        const parent = await this.getGroupById(group.getParentId(), factoryId);
        if (!parent) {
          return reject("Parent Group does not exist");
        }
        // if parent affects gross, child will affect gross too
        group.setAffectsGross(parent.getAffectsGross());
        const oldGroup = await this.getGroupById(group.getName(), factoryId, "name");
        const oldGroupCode = await this.getGroupById(group.getCode(), factoryId, "code");
        const nameExists = oldGroup && oldGroup.getId() !== group.getId();
        const codeSame = AppUtils.stringsSimilar(oldGroup?.getReferenceNo() || "a", oldGroupCode?.getReferenceNo() || "b");
        const nameSame = AppUtils.stringsSimilar(oldGroup?.getName() || "a", oldGroupCode?.getName() || "b");
        if (nameExists) {
          /*check code, if the code(phoneNo) is the same, update the group and continue*/
          if (oldGroupCode && codeSame) {
            return resolve(oldGroupCode);
          }
          return reject("Group name is already in use");
        }
        const codeExists = oldGroupCode && oldGroupCode.getId() !== group.getId();
        if (codeExists) {
          /*check if name and phone no match*/
          if (oldGroupCode && codeSame && nameSame) {
            return resolve(oldGroupCode);
          }
          return reject("Group code is already in use");
        }
        return resolve(group);
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  addGroup = (account: Account, group: Group, groupFactory: GroupFactory) => {
    return new Promise<Group>((resolve, reject) => {
      group.setFactoryId(groupFactory.getId());
      return this.beforeSavingGroup(group, groupFactory.getId()).then(async (toSave) => {
        try {
          if (!group.getId()) { // id was not set when adding group number
            group.setId(await this.getNewGroupId(groupFactory.getLastGroupId(), groupFactory));
          }
          return this.saveGroupFactory(account, groupFactory).then(() => resolve(toSave)).catch((reason) => reject(reason));
        } catch (e: any) {
          return reject(e);
        }
      }).catch((reason) => reject(reason));
    });
  };

  editGroup = (group: Group, groupFactory: GroupFactory) => {
    return new Promise<Group>(async (resolve, reject) => {
      try {
        group.setFactoryId(groupFactory.getId());
        const oldGroup = await this.getGroupById(group.getId(), groupFactory.getId());
        if (!oldGroup) {
          return reject("Group Not Found or was deleted!");
        }
        return this.beforeSavingGroup(group, groupFactory.getId()).then((toSave) => {
          return resolve(toSave);
        }).catch((reason) => reject(reason));
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  getNewGroupId = async (lastId: number, groupFactory: GroupFactory) => {
    let newId = lastId + 1;
    /*as item become many, this will become inefficient and will need to be removed or optimised
    * if ids are tracked properly, then it is not needed*/
    const groupExists = (id: any) => {
      return this.getGroupById(id, groupFactory.getId()).then((found) => found !== null).catch(() => false);
    };
    if (await groupExists(newId)) {
      // keep adding numbers and checking if id exists
      newId = await this.getNewGroupId(newId + 1, groupFactory);
    }
    groupFactory.setLastGroupId(newId);
    return newId;
  };
  deleteGroup = (group: Group, groupFactory: GroupFactory, account: Account) => {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const oldGroup = await this.getGroupById(group.getId(), groupFactory.getId());
        if (!oldGroup) {
          return reject("Group Not Found or was deleted!");
        }
        if (group.isSystemType()) {
          return reject("Can not delete system Group!");
        }
        if (group.isBaseType()) {
          return reject("Group is a base group and can not be deleted");
        }
        if (group.hasChildren()) {
          return reject("Can not delete group that has descendants!");
        }
        return this.groupsDetailsDb.doc(oldGroup.getEntityDbId()).delete().then(() => {
          return resolve(true);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  };
  saveGroup = (group: any, account: Account, factory: GroupFactory = account.getGroupFactory(), byPassIsSystemCheck = false): Promise<Group> => {
    return new Promise<Group>(async (resolve, reject) => {
      try {
        if (account.isLocked()) {
          return reject("Account is Locked");
        }
        const toSave = (new Group()).toObject(group);
        toSave.setFactoryId(factory.getId());
        let entity = toSave;
        if (!byPassIsSystemCheck) {
          try {
            if (!toSave.getId()) {
              entity = await this.addGroup(account, toSave, factory);
            } else {
              entity = await this.editGroup(toSave, factory);
            }
          } catch (e: any) {
            return reject(e?.toString());
          }
        }
        const sanitized = AppUtils.sanitizeObject(entity);
        if (sanitized.factoryId === null) {
          return reject(`unable to save group, code 0xf`);
        }
        if (typeof sanitized.id !== "number") {
          return reject(`unable to process group, code 1xf`);
        }
        return this.groupsDetailsDb.doc(toSave.getEntityDbId()).set(sanitized).then(() => {
          return resolve(group);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e);
      }
    });
  };
}
