import { Injectable } from "@nestjs/common";
import { FireBase } from "../firebase";
import {
  Account,
  AccountRestrictionType,
  AppRoutes,
  AppUtils,
  EntryType,
  EntryTypeFactory,
  SYSTEM_ENTRY_TYPE
} from "../lib";
import { TagsService } from "./tags.service";

@Injectable()
export class EntryTypesService extends TagsService {
  private entryTypesDb = FireBase.getCollection(AppRoutes.entryTypes.api.DB);
  private entryTypesDetailsDb = FireBase.getCollection(AppRoutes.entryTypes.api.DETAILS_DB);

  constructor() {
    super();
  }

  getEntryTypeById = (entryTypeId: any, entryTypeFactoryId: string | number, idName = "id") => {
    return new Promise<EntryType | null>((resolve, reject) => {
      if (typeof entryTypeId === null) {
        return reject(`unknown entry Type, contact admin`);
      }
      if (!entryTypeFactoryId) {
        return reject(`provide entry Type Factory identifier`);
      }
      if (typeof entryTypeFactoryId === "object") {
        return reject(`unsupported entry type factory record identifier, contact admin`);
      }
      return this.entryTypesDetailsDb
        .where(idName, "==", isNaN(entryTypeId) ? entryTypeId : parseInt(entryTypeId, 0))
        .where("factoryId", "==", entryTypeFactoryId).get().then((snap) => {
          if (snap.empty) {
            console.error(`entry Type with ${idName} ${entryTypeId?.toString()} was not found`);
            return resolve(null);
          }
          const doc: any = snap.docs[0];
          if (doc.exists) {
            const posEntryType = new EntryType().toObject(doc.data());
            return resolve(posEntryType);
          }
          console.error(`entry Type with ${idName} ${entryTypeId?.toString()} does not exist`);
          return resolve(null);
        }).catch((reason) => reject(reason));
    });
  };
  getAllEntryTypes = (entryTypeFactoryId: any) => {
    return new Promise<EntryType[]>((resolve, reject) => {
      if (!entryTypeFactoryId) {
        return reject(`provide entry Type Factory identifier`);
      }
      return this.entryTypesDetailsDb
        .where("factoryId", "==", entryTypeFactoryId).get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const entryTypes = snap.docs.map((doc: any) => new EntryType().toObject(doc.data()));
          return resolve(entryTypes);
        }).catch((reason) => reject(reason));
    });
  };

  getEntryTypeFactory(account: Account, parentOnly = false) {
    return new Promise<EntryTypeFactory>((resolve, reject) => {
      const factoryId = account.getId();
      if (!factoryId) {
        return reject(`provide account identifier for ${account.getSettings().getAccountLabel(true)}`);
      }
      return this.entryTypesDb.doc(factoryId).get().then((snap) => {
        if (!snap.exists) {
          // return Promise.reject(`Job cards for ${account.getName()} are not configured`);
          return this.saveEntryTypeFactory(account).then((savedFactory) => {
            return resolve(savedFactory);
          }).catch((reason) => reject(reason));
        }
        const factory: EntryTypeFactory = AppUtils.toObject(new EntryTypeFactory(), snap.data());
        factory.setId(snap.id);
        if (parentOnly) {
          return resolve(factory);
        }
        account.setEntryTypeFactory(factory);
        return resolve(factory);
      }).catch((reason) => reject(reason));
    });
  }

  saveEntryTypeFactory = (account: Account, entryTypeFactory?: EntryTypeFactory): Promise<EntryTypeFactory> => {
    return new Promise<EntryTypeFactory>((resolve, reject) => {
      /* don't accept to save factory minus saving account*/
      if (!account.getId()) {
        return reject(`Save ${account.getSettings().getAccountLabel(true)}\'s Account config`);
      }
      if (!entryTypeFactory) {
        account.configureFactories();
      } else {
        entryTypeFactory.setConfiguration(account.getConfiguration());
      }
      const factory = !entryTypeFactory ? account.getEntryTypeFactory() : entryTypeFactory;
      const sanitized = AppUtils.sanitizeObject(factory.toShortObject());
      return this.entryTypesDb.doc(account.getId()).set(sanitized).then(() => {
        const saved = (new EntryTypeFactory()).toObject(factory);
        if (!entryTypeFactory) {
          account.setEntryTypeFactory(saved);
        }
        return resolve(saved);
      }).catch((error) => reject(error));
    });
  };
  saveEntryType = (entryType: any, account: Account, factory: EntryTypeFactory = account.getEntryTypeFactory(), byPassIsSystemCheck = false): Promise<EntryType> => {
    return new Promise<EntryType>(async (resolve, reject) => {
      try {
        if (account.isLocked()) {
          return reject("Account is Locked");
        }
        const toSave = (new EntryType()).toObject(entryType);
        toSave.setFactoryId(factory.getId());
        let entity = toSave;
        if (!byPassIsSystemCheck) {
          try {
            if (!toSave.getId()) {
              entity = await this.addEntryType(account, toSave, factory);
            } else {
              entity = await this.editEntryType(toSave, factory);
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
        return this.entryTypesDetailsDb.doc(entity.getEntityDbId()).set(sanitized).then(() => {
          return resolve(entity);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  validateEntryTypeInputs = (type: EntryType, factoryId: any) => {
    return new Promise<EntryType>(async (resolve, reject) => {
      try {
        const labelNotSet = type.getLabel() === "";
        if (labelNotSet) {
          return reject("Label can not be empty");
        }
        const oldTypeLabel = await this.getEntryTypeById(type.getLabel(), factoryId, "label");
        const labelInUse = oldTypeLabel && oldTypeLabel.getId() !== type.getId();
        if (labelInUse) {
          return reject("Label is already in use");
        }
        const labelIsZero = type.getLabel() === "0";
        if (labelIsZero) {
          return reject("Label can not be 0");
        }
        const nameNotSet = type.getName() === "";
        if (nameNotSet) {
          return reject("Name can not be empty");
        }
        const oldTypeName = await this.getEntryTypeById(type.getName(), factoryId, "name");
        const nameInUse = oldTypeName && oldTypeName.getId() !== type.getId();
        if (nameInUse) {
          return reject("Name is already in use");
        }
        /* there a bunch of other validations in the original cake php system
        * especially those that relate to max-length of strings*/
        return resolve(type);
      } catch (e: any) {
        return reject(e);
      }
    });
  };

  beforeSavingEntryType = (type: EntryType, factoryId: any) => {
    return new Promise<EntryType>((resolve, reject) => {
      return this.validateEntryTypeInputs(type, factoryId).then((toSave) => resolve(toSave)).catch((reason) => reject(reason));
    });
  };
  addEntryType = (account: Account, entryType: EntryType, entryTypeFactory: EntryTypeFactory) => {
    return new Promise<EntryType>(async (resolve, reject) => {
      try {
        entryType.setFactoryId(entryTypeFactory.getId());
        const toSave = await this.beforeSavingEntryType(entryType, entryTypeFactory.getId());
        if (!entryType.getId()) { // id was not set when adding entryType number
          const newId = await this.getNewEntryTypeId(entryTypeFactory.getLastEntryTypeId(), entryTypeFactory);
          entryType.setId(newId);
        }
        return this.saveEntryTypeFactory(account, entryTypeFactory).then(() => resolve(toSave)).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  };

  editEntryType = (entryType: EntryType, entryTypeFactory: EntryTypeFactory) => {
    return new Promise<EntryType>(async (resolve, reject) => {
      try {
        entryType.setFactoryId(entryTypeFactory.getId());
        const oldEntryType = await this.getEntryTypeById(entryType.getId(), entryTypeFactory.getId());
        if (!oldEntryType) {
          return reject("Entry Type Not Found or was deleted!");
        }
        const toSave = await this.beforeSavingEntryType(entryType, entryTypeFactory.getId());
        return resolve(toSave);
      } catch (e: any) {
        return reject(e);
      }
    });
  };

  getNewEntryTypeId = (lastId: number, entryTypeFactory: EntryTypeFactory) => {
    return new Promise<number>(async (resolve, reject) => {
      try {
        let newId = lastId + 1;
        /*as item become many, this will become inefficient and will need to be removed or optimised
        * if ids are tracked properly, then it is not needed*/
        const entryTypeExists = (id: any) => {
          return this.getEntryTypeById(id, entryTypeFactory.getId())
            .then((found) => found !== null)
            .catch((reason) => reject(reason));
        };
        if (await entryTypeExists(newId)) {
          // keep adding numbers and checking if id exists
          newId = await this.getNewEntryTypeId(newId + 1, entryTypeFactory);
        }
        entryTypeFactory.setLastEntryTypeId(newId);
        return resolve(newId);
      } catch (e) {
        return reject(e);
      }
    });
  };

  deleteEntryType = (entryType: EntryType, entryTypeFactory: EntryTypeFactory) => {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const oldEntryType = await this.getEntryTypeById(entryType.getId(), entryTypeFactory.getId());
        if (!oldEntryType) {
          return reject("Entry Type Not Found or was deleted!");
        }
        if (entryType.isSystemType()) {
          return reject("Can not delete system EntryType!");
        }
        return this.entryTypesDetailsDb.doc(oldEntryType.getEntityDbId()).delete().then(() => {
          return resolve(true);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  };

  addSystemEntryTypes(account: Account, factory: EntryTypeFactory) {
    return new Promise<EntryType[]>(async (resolve, reject) => {
      try {
        const saved: EntryType[] = [];
        const names = [
          {
            label: SYSTEM_ENTRY_TYPE.Receipt.toLowerCase(),
            name: SYSTEM_ENTRY_TYPE.Receipt,
            description: "Received in Bank account or Cash account",
            restrictionType: AccountRestrictionType.BANK_OR_CASH_DEBIT
          },
          {
            label: SYSTEM_ENTRY_TYPE.Payment.toLowerCase(),
            name: SYSTEM_ENTRY_TYPE.Payment,
            description: "Payment made from Bank account or Cash account",
            restrictionType: AccountRestrictionType.BANK_OR_CASH_CREDIT
          },
          {
            label: SYSTEM_ENTRY_TYPE.Contra.toLowerCase(),
            name: SYSTEM_ENTRY_TYPE.Contra,
            description: "Transfer between Bank account and Cash account",
            restrictionType: AccountRestrictionType.ONLY_BANK_OR_CASH
          },
          {
            label: SYSTEM_ENTRY_TYPE.Journal.toLowerCase(),
            name: SYSTEM_ENTRY_TYPE.Journal,
            description: "Transaction that does not involve a Bank account or Cash account",
            restrictionType: AccountRestrictionType.ONLY_NONE_BANK_OR_CASH
          }
        ];
        const toSave: EntryType[] = names.map((name: any) => {
          const type = new EntryType(name.name, name.label, name.description, name.restrictionType);
          type.markAsSystemType(true);
          return type;
        });
        for (const type of toSave) {
          const added = await this.addEntryType(account, type, factory);
          await this.saveEntryType(added, account, factory, true);
        }
        return resolve(saved);
      } catch (e) {
        return reject(e);
      }
    });
  }
}
