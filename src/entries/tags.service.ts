import { Injectable } from "@nestjs/common";
import { FireBase } from "../firebase";
import { Account, AppRoutes, AppUtils, EntryTag, EntryTagFactory } from "../lib";

@Injectable()
export class TagsService {
  private entryTagsDb = FireBase.getCollection(AppRoutes.tags.api.DB);
  private entryTagsDetailsDb = FireBase.getCollection(AppRoutes.tags.api.DETAILS_DB);

  constructor() {
  }

  getEntryTagById = (entryTagId: any, entryTagFactoryId: string | number, idName = "id") => {
    return new Promise<EntryTag | null>((resolve, reject) => {
      if (typeof entryTagId === null) {
        return reject(`unknown entry Type, contact admin`);
      }
      if (!entryTagFactoryId) {
        return reject(`provide entry Type Factory identifier`);
      }
      if (typeof entryTagFactoryId === "object") {
        return reject(`unsupported entry type factory record identifier, contact admin`);
      }
      return this.entryTagsDetailsDb
        .where(idName, "==", isNaN(entryTagId) ? entryTagId : parseInt(entryTagId, 0))
        .where("factoryId", "==", entryTagFactoryId).limit(1).get().then((snap) => {
          if (snap.empty) {
            console.error(`entry Type with ${idName} ${entryTagId?.toString()} not found`);
            return resolve(null);
          }
          const doc: any = snap.docs[0];
          if (doc.exists) {
            const posEntryTag = new EntryTag().toObject(doc.data());
            return resolve(posEntryTag);
          }
          console.error(`entry Type with ${idName} ${entryTagId?.toString()} does not exist`);
          return resolve(null);
        }).catch((reason) => reject(reason));
    });
  };
  getAllEntryTags = (entryTagFactoryId: any) => {
    return new Promise<EntryTag[]>((resolve, reject) => {
      if (!entryTagFactoryId) {
        return reject(`provide entry Type Factory identifier`);
      }
      return this.entryTagsDetailsDb
        .where("factoryId", "==", entryTagFactoryId).get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const entryTags = snap.docs.map((doc: any) => new EntryTag().toObject(doc.data()));
          return resolve(entryTags);
        }).catch((reason) => reject(reason));
    });
  };

  getEntryTagFactory(account: Account, parentOnly = false) {
    return new Promise<EntryTagFactory>((resolve, reject) => {
      const factoryId = account.getId();
      if (!factoryId) {
        return reject(`provide account identifier for ${account.getSettings().getAccountLabel(true)}`);
      }
      return this.entryTagsDb.doc(factoryId).get().then((snap) => {
        if (!snap.exists) {
          // return Promise.reject(`Job cards for ${account.getName()} are not configured`);
          return this.saveEntryTagFactory(account).then((savedFactory) => {
            return resolve(savedFactory);
          }).catch((reason) => reject(reason));
        }
        const factory: EntryTagFactory = AppUtils.toObject(new EntryTagFactory(), snap.data());
        factory.setId(snap.id);
        if (parentOnly) {
          return resolve(factory);
        }
        account.setEntryTagFactory(factory);
        return resolve(factory);
      }).catch((reason) => reject(reason));
    });
  }

  saveEntryTagFactory = (account: Account, entryTagFactory?: EntryTagFactory): Promise<EntryTagFactory> => {
    return new Promise<EntryTagFactory>((resolve, reject) => {
      /* don't accept to save factory minus saving account*/
      if (!account.getId()) {
        return reject(`Save ${account.getSettings().getAccountLabel(true)}\'s Account config`);
      }
      if (!entryTagFactory) {
        account.configureFactories();
      } else {
        entryTagFactory.setConfiguration(account.getConfiguration());
      }
      const factory = !entryTagFactory ? account.getEntryTagFactory() : entryTagFactory;
      const sanitized = !entryTagFactory ? AppUtils.sanitizeObject(factory) : AppUtils.sanitizeObject(factory.toShortObject());
      return this.entryTagsDb.doc(account.getId()).set(sanitized).then(() => {
        const saved = (new EntryTagFactory()).toObject(factory);
        if (!entryTagFactory) {
          account.setEntryTagFactory(saved);
        }
        return resolve(saved);
      }).catch((error) => reject(error));
    });
  };
  saveEntryTag = (entryTag: any, account: Account, factory: EntryTagFactory = account.getEntryTagFactory(), byPassIsSystemCheck = false): Promise<EntryTag> => {
    return new Promise<EntryTag>(async (resolve, reject) => {
      try {
        if (account.isLocked()) {
          return reject("Account is Locked");
        }
        const toSave = (new EntryTag()).toObject(entryTag);
        toSave.setFactoryId(factory.getId());
        let entity = toSave;
        if (!byPassIsSystemCheck) {
          try {
            if (!toSave.getId()) {
              entity = await this.addEntryTag(account, toSave, factory);
            } else {
              entity = await this.editEntryTag(toSave, factory);
            }
          } catch (e: any) {
            return reject(e?.toString());
          }
        }
        const sanitized = AppUtils.sanitizeObject(entity);
        if (sanitized.factoryId === null) {
          return reject(`unable to save entry type, code 0xf`);
        }
        if (typeof sanitized.id !== "number") {
          return reject(`unable to process entry type, code 1xf`);
        }
        return this.entryTagsDetailsDb.doc(toSave.getEntityDbId()).set(sanitized).then(() => {
          return resolve(entryTag);
        }).catch((error: any) => reject(error.toString()));
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  addEntryTag = (account: Account, entryTag: EntryTag, entryTagFactory: EntryTagFactory) => {
    return new Promise<EntryTag>((resolve, reject) => {
      entryTag.setFactoryId(entryTagFactory.getId());
      return (new EntryTagFactory()).beforeSave(entryTag).then(async (toSave) => {
        try {
          if (!entryTag.getId()) { // id was not set when adding entryTag number
            entryTag.setId(await this.getNewEntryTagId(entryTagFactory.getLastEntryTagId(), entryTagFactory));
          }
          return this.saveEntryTagFactory(account, entryTagFactory).then(() => resolve(toSave)).catch((reason) => reject(reason));
        } catch (e: any) {
          return reject(e);
        }
      }).catch((reason) => reject(reason));
    });
  };

  editEntryTag = (entryTag: EntryTag, entryTagFactory: EntryTagFactory) => {
    return new Promise<EntryTag>(async (resolve, reject) => {
      try {
        entryTag.setFactoryId(entryTagFactory.getId());
        const oldEntryTag = await this.getEntryTagById(entryTag.getId(), entryTagFactory.getId());
        if (!oldEntryTag) {
          return reject("EntryTag Not Found or was deleted!");
        }
        return (new EntryTagFactory()).beforeSave(entryTag).then((toSave) => {
          return resolve(toSave);
        }).catch((reason) => reject(reason));
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  getNewEntryTagId = async (lastId: number, entryTagFactory: EntryTagFactory) => {
    let newId = lastId + 1;
    /*as item become many, this will become inefficient and will need to be removed or optimised
    * if ids are tracked properly, then it is not needed*/
    const entryTagExists = (id: any) => {
      return this.getEntryTagById(id, entryTagFactory.getId()).then((found) => found !== null).catch(() => false);
    };
    if (await entryTagExists(newId)) {
      // keep adding numbers and checking if id exists
      newId = await this.getNewEntryTagId(newId + 1, entryTagFactory);
    }
    entryTagFactory.setLastEntryTagId(newId);
    return newId;
  };
  deleteEntryTag = (entryTag: EntryTag, entryTagFactory: EntryTagFactory, account: Account) => {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const oldEntryTag = await this.getEntryTagById(entryTag.getId(), entryTagFactory.getId());
        if (!oldEntryTag) {
          return reject("Entry Type Not Found or was deleted!");
        }
        return this.entryTagsDetailsDb.doc(oldEntryTag.getEntityDbId()).delete().then(() => {
          return resolve(true);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  };
}
