import { Injectable } from "@nestjs/common";
import { FireBase } from "../firebase";
import {
  AbstractLedger,
  Account,
  AccountingErrors,
  AccountOperator,
  AccUtils,
  AppRoutes,
  AppUtils,
  Group,
  GroupFactory,
  Ledger,
  LedgerFactory,
  LedgerType,
  Person,
  systemAccounts
} from "../lib";
import { GroupsService } from "./groups.service";

@Injectable()
export class LedgersService extends GroupsService {
  private ledgersDb = FireBase.getCollection(AppRoutes.ledgers.api.DB);
  private ledgersDetailsDb = FireBase.getCollection(AppRoutes.ledgers.api.DETAILS_DB);
  private ledgers: Ledger[] = [];

  constructor() {
    super();
  }

  getLedgerById(ledgerId: any, ledgerFactoryId: string | number, idName = "id") {
    return new Promise<Ledger | null>((resolve, reject) => {
      if (typeof ledgerId === null) {
        return reject(`unknown ledger, contact admin`);
      }
      if (!ledgerFactoryId) {
        return reject(`provide ledger Factory identifier`);
      }
      if (typeof ledgerFactoryId === "object") {
        return reject(`unsupported ledger factory record identifier, contact admin`);
      }
      return this.ledgersDetailsDb
        .where(idName, "==", isNaN(ledgerId) ? ledgerId : parseInt(ledgerId, 0))
        .where("factoryId", "==", ledgerFactoryId).limit(1).get().then((snap) => {
          if (snap.empty) {
            console.error(`ledger with ${idName} ${ledgerId?.toString()} not found`);
            return resolve(null);
          }
          const doc: any = snap.docs[0];
          if (doc.exists) {
            const posLedger = new Ledger().toObject(doc.data());
            return resolve(posLedger);
          }
          console.error(`ledger with ${idName} ${ledgerId?.toString()} does not exist`);
          return resolve(null);
        }).catch((reason) => reject(reason));
    });
  }

  getLedgersById(ledgerId: any, ledgerFactoryId: string | number, idName = "id") {
    return new Promise<Ledger[]>((resolve, reject) => {
      if (typeof ledgerId === null) {
        return reject(`unknown ledger, contact admin`);
      }
      if (!ledgerFactoryId) {
        return reject(`provide ledger Factory identifier`);
      }
      if (typeof ledgerFactoryId === "object") {
        return Promise.reject(`unsupported ledger factory record identifier, contact admin`);
      }
      return this.ledgersDetailsDb
        .where(idName, "==", isNaN(ledgerId) ? ledgerId : parseInt(ledgerId, 0))
        .where("factoryId", "==", ledgerFactoryId).get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const value = snap.docs.map((doc: any) => new Ledger().toObject(doc.data()));
          return resolve(value);
        }).catch((reason) => reject(reason));
    });
  }

  getAllLedgers(ledgerFactoryId: any, params?: any) {
    return new Promise<Ledger[]>((resolve, reject) => {
      if (!ledgerFactoryId) {
        return reject(`provide ledger Factory identifier`);
      }
      return this.ledgersDetailsDb
        .where("factoryId", "==", ledgerFactoryId).get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const value = snap.docs.map((doc: any) => new Ledger().toObject(doc.data()));
          return resolve(value);
        }).catch((reason) => reject(reason));
    });
  }

  getLedgerFactory(account: Account, parentOnly = false) {
    return new Promise<LedgerFactory>((resolve, reject) => {
      const factoryId = account.getId();
      if (!factoryId) {
        return reject(`provide account identifier for ${account.getSettings().getAccountLabel(true)}`);
      }
      return this.ledgersDb.doc(factoryId).get().then((snap) => {
        if (!snap.exists) {
          // return Promise.reject(`Job cards for ${account.getName()} are not configured`);
          return this.saveLedgerFactory(account).then((savedFactory) => {
            return resolve(savedFactory);
          }).catch((reason) => reject(reason));
        }
        const factory: LedgerFactory = AppUtils.toObject(new LedgerFactory(), snap.data());
        factory.setId(snap.id);
        if (parentOnly) {
          return resolve(factory);
        }
        account.setLedgerFactory(factory);
        return resolve(factory);
      }).catch((reason) => reject(reason));
    });
  }

  saveLedgerFactory(account: Account, ledgerFactory?: LedgerFactory) {
    return new Promise<LedgerFactory>((resolve, reject) => {
      /* don't accept to save factory minus saving account*/
      if (!account.getId()) {
        return reject(`Save ${account.getSettings().getAccountLabel(true)}\'s Account config`);
      }
      if (!ledgerFactory) {
        account.configureFactories();
      } else {
        ledgerFactory.setConfiguration(account.getConfiguration());
      }
      const factory = !ledgerFactory ? account.getLedgerFactory() : ledgerFactory;
      const sanitized = AppUtils.sanitizeObject(factory.toShortObject());
      return this.ledgersDb.doc(account.getId()).set(sanitized).then(() => {
        const saved = (new LedgerFactory()).toObject(factory);
        if (!ledgerFactory) {
          account.setLedgerFactory(saved);
        }
        return resolve(saved);
      }).catch((error) => reject(error));
    });
  }

  beforeSavingLedger(ledger: Ledger, factoryId: any, maximumNoOfDecimalPlaces: number) {
    return new Promise<Ledger>((resolve, reject) => {
      return this.validateLedgerInputs(ledger, factoryId, maximumNoOfDecimalPlaces).then((sameLedger) => {
        return resolve(sameLedger);
      }).catch((reason) => {
        return reject(reason);
      });
    });
  }

  validateLedgerInputs(ledger: Ledger,
                       factoryId: any,
                       maximumNoOfDecimalPlaces: number) {
    return new Promise<Ledger>(async (resolve, reject) => {
      try {
        const parentIsNotSet = !ledger.getParentId();
        if (parentIsNotSet) {
          return reject("Parent Group is required");
        }
        const nameIsNotSet = ledger.getName() === "";
        if (nameIsNotSet) {
          return reject("Ledger name is required");
        }
        if (ledger.getId()) {
          const oldLedgerId = await this.getLedgerById(ledger.getId(), factoryId);
          if (!oldLedgerId) {
            return reject("Ledger Not Found or was deleted!");
          }
        }
        const oldLedger = await this.getLedgerById(ledger.getName(), factoryId, "name");
        const oldLedgerCode = AppUtils.stringIsSet(ledger.getCode()) ? await this.getLedgerById(ledger.getCode(), factoryId, "code") : null;
        const nameExists = oldLedger && oldLedger.getId() !== ledger.getId();
        /*added letters to address issue of ledger name already exists***/
        const codeSame = AppUtils.stringsSimilar(oldLedger?.getReferenceNo() || "a", oldLedgerCode?.getReferenceNo() || "b");
        const nameSame = AppUtils.stringsSimilar(oldLedger?.getName() || "a", oldLedgerCode?.getName() || "b");
        if (nameExists) {
          /*check code, if the code(phoneNo) is the same, update the ledger and continue*/
          if (oldLedgerCode && codeSame) {
            return resolve(oldLedgerCode);
          }
          console.log("------------oldLedger----------");
          console.log(oldLedger);
          console.log("------------ledger-------------");
          console.log(ledger);
          return reject("Ledger name is already in use");
        }
        const codeExists = oldLedgerCode && oldLedgerCode.getId() !== ledger.getId();
        if (codeExists) {
          /*check if name and phone no match*/
          if (oldLedgerCode && codeSame && nameSame) {
            return resolve(oldLedgerCode);
          }
          return reject("Ledger code is already in use");
        }
        const openingBalIncorrect = ledger.getOpeningBalance() < 0;
        if (openingBalIncorrect) {
          return reject("Opening Balance cannot be less than 0.00");
        }
        const decimalPlacesIncorrect = AccUtils.countDecimal(ledger.getOpeningBalance()) > maximumNoOfDecimalPlaces;
        if (decimalPlacesIncorrect) {
          return reject(AccountingErrors.getCalculationError(AccountOperator.GT, maximumNoOfDecimalPlaces));
        }
        return resolve(ledger);
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  addPersonLedger(account: Account, ledgerFactory: LedgerFactory, person: Person, parent?: Group) {
    return new Promise<Ledger>(async (resolve, reject) => {
      try {
        /*was using is New but changed to this since while adding default persons,
    * some come without phoneNos*/
        if (person.isNew()) {
          return reject("can not create ledger for new person, save person and try again.");
        }
        const ledgerByReferenceNo = await this.getLedgerById(person.getId(), ledgerFactory.getId(), "referenceNo");
        if (ledgerByReferenceNo) {
          return resolve(ledgerByReferenceNo);
        }
        const prefix = ledgerFactory.getPrefixFromPerson(person);
        const ledgerCode = person.getPhoneNoAsCode(prefix);
        const ledger = await this.getLedgerById(ledgerCode, ledgerFactory.getId(), "code");
        if (ledger) {
          /*compare phone nos and name, and return that existing ledger instead*/
          // TODO remove after fixing duplicate customers
          const namesSame = AppUtils.stringsSimilar(ledger.getName(), person.getName());
          if (namesSame) {
            person.setId(ledger.getReferenceNo());
            return resolve(ledger);
          }
          return reject(`Can not create account(${person.getName() + " : " + person.getPhoneNo()}), Similar Account(${ledger.getName() + " : " + ledger.getCode()}) already exists !`);
        }
        const newLedger = new Ledger();
        newLedger.setName(person.getName());
        /* set reference no as person id, we shall use it later when person has been edited and we need to
        * locate their ledger and edit it too*/
        newLedger.setReferenceNo(person.getId());
        newLedger.setCode(ledgerCode);
        if (!parent) {
          return reject("Parent Account Not Found or not configured !, contact admin");
        }
        newLedger.setParentId(parent.getId());
        newLedger.setParentName(parent.getName());
        newLedger.setOpeningBalance(person.getOpeningBalance());
        newLedger.setOpeningBalanceType(person.getOpeningBalanceType());
        newLedger.setHidden(true);
        // make it a system ledger so that it won't be deleted from the front end
        newLedger.markAsSystemType(true);
        return this.saveLedger(newLedger, account, ledgerFactory)
          .then((saved) => resolve(saved))
          .catch((reason) => reject(reason));
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  }

  saveLedger(ledger: any, account: Account, factory: LedgerFactory = account.getLedgerFactory(), byPassIsSystemCheck = false) {
    return new Promise<Ledger>(async (resolve, reject) => {
      try {
        if (account.isLocked()) {
          return reject("Account is Locked");
        }
        const toSave = (new Ledger()).toObject(ledger);
        toSave.setFactoryId(factory.getId());
        let entity = toSave;
        if (!byPassIsSystemCheck) {
          try {
            if (!toSave.getId()) {
              entity = await this.addLedger(account, toSave, factory);
            } else {
              entity = await this.editLedger(toSave, factory);
            }
          } catch (e: any) {
            return reject(e?.toString());
          }
        }
        const sanitized = AppUtils.sanitizeObject(entity);
        if (sanitized.factoryId === null) {
          return reject(`unable to save ledger, code 0xf`);
        }
        if (typeof sanitized.id !== "number") {
          return reject(`unable to process ledger, code 1xf`);
        }
        return this.ledgersDetailsDb.doc(toSave.getEntityDbId()).set(sanitized).then(() => {
          return resolve(ledger);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  }

  addLedger(account: Account, ledger: Ledger, ledgerFactory: LedgerFactory) {
    return new Promise<Ledger>(async (resolve, reject) => {
      try {
        ledger.setFactoryId(ledgerFactory.getId());
        const toSave = await this.beforeSavingLedger(ledger,
          ledgerFactory.getId(),
          ledgerFactory.getMaximumNoOfDecimalPlaces());
        if (!ledger.getId()) { // id was not set when adding ledger number
          ledger.setId(await this.getNewLedgerId(ledgerFactory.getLastLedgerId(), ledgerFactory));
        }
        await this.saveLedgerFactory(account, ledgerFactory);
        return resolve(toSave);
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  }

  editLedger(ledger: Ledger, ledgerFactory: LedgerFactory) {
    return new Promise<Ledger>((resolve, reject) => {
      try {
        ledger.setFactoryId(ledgerFactory.getId());
        return this.beforeSavingLedger(ledger,
          ledgerFactory.getId(),
          ledgerFactory.getMaximumNoOfDecimalPlaces())
          .then((toSave) => {
            return resolve(toSave);
          }).catch((reason) => reject(reason));
      } catch (e: any) {
        return reject(e);
      }

    });
  }

  async getNewLedgerId(lastId: number, ledgerFactory: LedgerFactory) {
    let newId = lastId + 1;
    /*as item become many, this will become inefficient and will need to be removed or optimised
    * if ids are tracked properly, then it is not needed*/
    const ledgerExists = (id: any) => {
      return this.getLedgerById(id, ledgerFactory.getId()).then((found) => found !== null).catch(() => false);
    };
    if (await ledgerExists(newId)) {
      // keep adding numbers and checking if id exists
      newId = await this.getNewLedgerId(newId + 1, ledgerFactory);
    }
    ledgerFactory.setLastLedgerId(newId);
    return newId;
  }

  deleteLedger(ledger: Ledger, ledgerFactory: LedgerFactory, account: Account) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const oldLedger = await this.getLedgerById(ledger.getId(), ledgerFactory.getId());
        if (!oldLedger) {
          return reject("Ledger Not Found or was deleted!");
        }
        if (ledger.isSystemType()) {
          return reject("Can not delete system Ledger!");
        }
        if (ledger.isBaseType()) {
          return reject("Ledger is a base ledger and can not be deleted");
        }
        return this.ledgersDetailsDb.doc(oldLedger.getEntityDbId()).delete().then(() => {
          return resolve(true);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  /*this will delete passed ledgers without validation or checking
* for dependent entries, so take care when calling it, do so
* only when existing entries have been removed*/
  deleteManyLedgers(ledgers: Ledger[]) {
    return new Promise<boolean>((resolve, reject) => {
      if (ledgers.length === 0) {
        return resolve(true);
      }
      const sanitizedLedgers = ledgers.map((ledger) => AppUtils.sanitizeObject(ledger));
      const invalidLedgers = sanitizedLedgers.filter((entry: any) => entry.factoryId === null);
      if (invalidLedgers.length > 0) {
        return reject(`unable to remove entries, code 0xf`);
      }
      const invalidIds = sanitizedLedgers.filter((entry: any) => typeof entry.id !== "number");
      if (invalidIds.length > 0) {
        return reject(`unable to process deleted entries, code 1xf`);
      }
      let batch = this.ledgersDetailsDb.firestore.batch();
      for (const sanitized of sanitizedLedgers) {
        if (!sanitized.id) {
          continue;
        }
        const getEntityDbId = () => {
          return `${sanitized.id}-${sanitized.factoryId}`;
        };
        batch = batch.delete(this.ledgersDetailsDb.doc(getEntityDbId()));
      }
      return batch.commit()
        .then((result) => resolve(result.length === ledgers.length))
        .catch((error) => reject(error.toString()));
    });
  }

  addSystemGroups(account: Account, ledgerFactory: LedgerFactory, groupFactory: GroupFactory) {
    return new Promise<AbstractLedger[]>(async (resolve, reject) => {
      try {
        console.log(`creating accounts for branch ${account.getSettings().getBranchName()} !`);
        const toSave: Promise<any>[] = [];
        const saved: AbstractLedger[] = [];
        for (const value of systemAccounts) {
          const parent = await this.getGroupById(value.parentId, groupFactory.getId());
          if (value.group) {
            const childGroup = await this.getGroupById(value.id, groupFactory.getId());
            if (!childGroup) {
              console.log(`creating group ${value.name} !`);
              const group = new Group(value.name, "", value.affectSGross);
              group.setId(value.id);
              group.setFactoryId(groupFactory.getId());
              group.markAsSystemType(true);
              if (parent) {
                group.setParentId(parent.getId());
                group.setParentName(parent.getName());
              }
              saved.push(group);
              toSave.push(this.saveGroup(group, account, groupFactory, true));
            } else {
              console.log(`Group ${childGroup.getName()} Exists !`);
            }
          } else {
            const childLedger = await this.getLedgerById(value.id, ledgerFactory.getId());
            if (!childLedger) {
              console.log(`creating ledger ${value.name} !`);
              const ledger = new Ledger(value.name, "");
              ledger.setId(value.id);
              ledger.setFactoryId(ledgerFactory.getId());
              ledger.markAsSystemType(true);
              const type = value.bankOrCash ? LedgerType.BANK_OR_CASH : LedgerType.UNRESTRICTED;
              ledger.setType(type);
              if (parent) {
                ledger.setParentId(parent.getId());
                ledger.setParentName(parent.getName());
              }
              saved.push(ledger);
              toSave.push(this.saveLedger(ledger, account, ledgerFactory, true));
            } else {
              console.log(`Ledger ${childLedger.getName()} Exists !`);
            }
          }
        }
        return Promise.all(toSave).then(() => resolve(saved)).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
