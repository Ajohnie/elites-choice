import { Injectable } from "@nestjs/common";
import { FireBase } from "../firebase";
import {
  AbstractLedger,
  AbstractLedgerType,
  Account,
  AccountEntryType,
  AccountOperator,
  AccountResult,
  AccUtils,
  AppRoutes,
  AppUtils,
  BalanceSheet,
  ChartOfAccounts,
  Entry,
  EntryFactory,
  EntryItem,
  EntryOptions,
  Group,
  Ledger,
  LedgerFactory,
  LedgerStatement,
  ProfitAndLossStatement,
  ReconciliationStatement,
  SourcePrefix,
  SYSTEM_ENTRY_TYPE,
  TrialBalance
} from "../lib";
import { LedgersService } from "../ledgers/ledgers.service";

@Injectable()
export class EntriesService extends LedgersService {
  private entriesDb = FireBase.getCollection(AppRoutes.entries.api.DB);
  private entriesDetailsDb = FireBase.getCollection(AppRoutes.entries.api.DETAILS_DB);
  private entries: Entry[] = [];

  constructor() {
    super();
  }

  getEntryById = (entryId: any, entryFactoryId: string | number, idName = "id") => {
    return new Promise<Entry | null>((resolve, reject) => {
      if (typeof entryId === null) {
        return reject(`unknown entry, contact admin`);
      }
      if (!entryFactoryId) {
        return reject(`provide entry Factory identifier`);
      }
      if (typeof entryFactoryId === "object") {
        return reject(`unsupported entry factory record identifier, contact admin`);
      }
      return this.entriesDetailsDb
        .where(idName, "==", isNaN(entryId) ? entryId : parseInt(entryId, 0))
        .where("factoryId", "==", entryFactoryId).limit(1).get().then((snap) => {
          if (snap.empty) {
            console.error(`entry with ${idName} ${entryId?.toString()} not found`);
            return resolve(null);
          }
          const doc: any = snap.docs[0];
          if (doc.exists) {
            const posEntry = new Entry().toObject(doc.data());
            return resolve(posEntry);
          }
          console.error(`entry with ${idName} ${entryId?.toString()} does not exist`);
          return resolve(null);
        }).catch((reason) => reject(reason));
    });
  };
  getEntriesById = (entryId: any, entryFactoryId: string | number, idName = "id") => {
    return new Promise<Entry[]>((resolve, reject) => {
      if (typeof entryId === null) {
        return reject(`unknown entry id, contact admin`);
      }
      if (!entryFactoryId) {
        return reject(`provide entry Factory identifier`);
      }
      if (typeof entryFactoryId === "object") {
        return reject(`unsupported entry factory record identifier, contact admin`);
      }
      return this.entriesDetailsDb
        .where(idName, "==", isNaN(entryId) ? entryId : parseInt(entryId, 0))
        .where("factoryId", "==", entryFactoryId).get().then((snap) => {
          if (snap.empty) {
            console.error(`entries with ${idName} ${entryId?.toString()} not found`);
            return resolve([]);
          }
          const entries = snap.docs.map((doc: any) => new Entry().toObject(doc.data()));
          return resolve(entries);
        }).catch((reason) => reject(reason));
    });
  };
  getAllEntries = (options: EntryOptions, entryFactoryId: any) => {
    return new Promise<Entry[]>((resolve, reject) => {
      if (!entryFactoryId) {
        return reject(`provide entry Factory identifier`);
      }
      return this.entriesDetailsDb
        .where("factoryId", "==", entryFactoryId).get().then((snap) => {
          if (snap.empty) {
            return resolve([]);
          }
          const entries = snap.docs.map((doc: any) => new Entry().toObject(doc.data()));
          const value = (new EntryFactory()).getEntriesByOptions(options, entries);
          return resolve(value);
        }).catch((reason) => reject(reason));
    });
  };
  getSystemEntry = (transactionRefNo: string,
                    transactionType: string,
                    prefix = SourcePrefix.NONE,
                    account: Account) => {
    return new Promise<Entry | null>(async (resolve, reject) => {
      try {
        const factory = await this.getEntryFactory(account, true);
        const narration = factory.getSystemEntryNarration(transactionRefNo, transactionType, prefix);
        const entry = await this.getEntryById(narration, factory.getId(), "narration");
        return resolve(entry);
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  };
  addEntry = (account: Account,
              entry: Entry,
              entryFactory: EntryFactory,
              byPassIsSystemEntryCheck = false) => {
    return new Promise<Entry>(async (resolve, reject) => {
      try {
        entry.setFactoryId(entryFactory.getId());
        const toSave = await entryFactory.beforeSave(entry, byPassIsSystemEntryCheck);
        if (!entry.getId()) { // id was not set when adding entry number
          entry.setId(await this.getNewEntryId(entryFactory.getLastEntryId(), entryFactory));
        }
        return this.saveEntryFactory(account, entryFactory).then(() => resolve(toSave)).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  };

  editEntry = (entry: Entry,
               entryFactory: EntryFactory,
               byPassIsSystemEntryCheck = false) => {
    return new Promise<Entry>(async (resolve, reject) => {
      try {
        entry.setFactoryId(entryFactory.getId());
        const oldEntry = await this.getEntryById(entry.getId(), entryFactory.getId());
        if (!oldEntry && !byPassIsSystemEntryCheck) {
          return reject("Entry Not Found or was deleted!");
        }
        return entryFactory.beforeSave(entry, byPassIsSystemEntryCheck).then((toSave) => {
          return resolve(toSave);
        }).catch((reason) => reject(reason));
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  getNewEntryId = async (lastId: number, entryFactory: EntryFactory) => {
    let newId = lastId + 1;
    /*as item become many, this will become inefficient and will need to be removed or optimised
    * if ids are tracked properly, then it is not needed*/
    const entryExists = (id: any) => {
      return this.getEntryById(id, entryFactory.getId()).then((found) => found !== null).catch(() => false);
    };
    if (await entryExists(newId)) {
      // keep adding numbers and checking if id exists
      newId = await this.getNewEntryId(newId + 1, entryFactory);
    }
    entryFactory.setLastEntryId(newId);
    return newId;
  };
  deleteEntry = (entry: Entry,
                 entryFactory: EntryFactory,
                 byPassIsSystemEntryCheck = false) => {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const oldEntry = await this.getEntryById(entry.getId(), entryFactory.getId());
        if (!oldEntry) {
          return reject("Entry Not Found or was deleted!");
        }
        const isSystem = oldEntry.getId() && oldEntry.isSystemGenerated();
        if (isSystem && !byPassIsSystemEntryCheck) {
          return reject("Can not delete system generated entry");
        }
        return this.entriesDetailsDb.doc(oldEntry.getEntityDbId()).delete().then(() => {
          return resolve(true);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  saveEntry = (entry: any,
               account: Account,
               byPassIsSystemEntryCheck = false,
               factory: EntryFactory = account.getEntryFactory()): Promise<Entry> => {
    return new Promise<Entry>(async (resolve, reject) => {
      try {
        if (account.isLocked()) {
          return reject("Account is Locked");
        }
        const toSave = (new Entry()).toObject(entry);
        toSave.setFactoryId(factory.getId());
        let entity;
        try {
          if (!toSave.getId()) {
            entity = await this.addEntry(account, toSave, factory, byPassIsSystemEntryCheck);
          } else {
            entity = await this.editEntry(toSave, factory, byPassIsSystemEntryCheck);
          }
        } catch (e: any) {
          return reject(e?.toString());
        }
        const sanitized = AppUtils.sanitizeObject(entity);
        if (typeof sanitized.id !== "number") {
          return reject(`unable to process entry, code 1xf`);
        }
        if (sanitized.factoryId === null) {
          return reject(`unable to save entry, code 0xf`);
        }
        return this.entriesDetailsDb.doc(toSave.getEntityDbId()).set(sanitized).then(() => {
          return resolve(entry);
        }).catch((error: any) => {
          return reject(error.toString());
        });
      } catch (e: any) {
        return reject(e);
      }
    });
  };
  /*use this to save a batch of entries, but only old entries
  * new entries will be skipped*/
  saveManyEntries = (entries: Entry[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (entries.length === 0) {
        return resolve(true);
      }
      const sanitizedEntries = entries.map((entry) => AppUtils.sanitizeObject(entry));
      const invalidEntries = sanitizedEntries.filter((entry: any) => entry.factoryId === null);
      if (invalidEntries.length > 0) {
        return reject(`unable to save entries, code 0xf`);
      }
      const invalidIds = sanitizedEntries.filter((entry: any) => typeof entry.id !== "number");
      if (invalidIds.length > 0) {
        return reject(`unable to process entries, code 1xf`);
      }
      let batch = this.entriesDetailsDb.firestore.batch();
      for (const sanitized of sanitizedEntries) {
        if (!sanitized.id) {
          continue;
        }
        const getEntityDbId = () => {
          return `${sanitized.id}-${sanitized.factoryId}`;
        };
        batch = batch.set(this.entriesDetailsDb.doc(getEntityDbId()), sanitized);
      }
      return batch.commit()
        .then((result) => resolve(result.length === entries.length))
        .catch((error) => reject(error.toString()));
    });
  };

  getEntryFactory(account: Account, parentOnly = false) {
    return new Promise<EntryFactory>((resolve, reject) => {
      const factoryId = account.getId();
      if (!factoryId) {
        return reject(`provide account identifier for ${account.getSettings().getAccountLabel(true)}`);
      }
      return this.entriesDb.doc(factoryId).get().then((snap) => {
        if (!snap.exists) {
          // return Promise.reject(`Job cards for ${account.getName()} are not configured`);
          return this.saveEntryFactory(account).then((savedFactory) => {
            return resolve(savedFactory);
          }).catch((reason) => reject(reason));
        }
        const factory: EntryFactory = AppUtils.toObject(new EntryFactory(), snap.data());
        factory.setId(snap.id);
        if (parentOnly) {
          return resolve(factory);
        }
        account.setEntryFactory(factory);
        return resolve(factory);
      }).catch((reason) => reject(reason));
    });
  }

  saveEntryFactory = (account: Account, entryFactory?: EntryFactory): Promise<EntryFactory> => {
    return new Promise<EntryFactory>((resolve, reject) => {
      /* don't accept to save factory minus saving account*/
      if (!account.getId()) {
        return reject(`Save ${account.getSettings().getAccountLabel(true)}\'s Account config`);
      }
      if (!entryFactory) {
        account.configureFactories();
      } else {
        entryFactory.setConfiguration(account.getConfiguration());
      }
      const factory = !entryFactory ? account.getEntryFactory() : entryFactory;
      const sanitized = !entryFactory ? AppUtils.sanitizeObject(factory) : AppUtils.sanitizeObject(factory.toShortObject());
      return this.entriesDb.doc(account.getId()).set(sanitized).then(() => {
        const saved = (new EntryFactory()).toObject(factory);
        if (!entryFactory) {
          account.setEntryFactory(saved);
        }
        return resolve(saved);
      }).catch((error) => reject(error));
    });
  };
  groupEntries = (importedEntries: EntryItem[], destinationLedgerId: any, account: Account) => {
    return new Promise<Entry[]>(async (resolve, reject) => {
      if (!Array.isArray(importedEntries)) {
        return reject("Data is invalid");
      }
      try {
        // if entry number is specified, group according to entry number
        // entries with same entry number can not have different dates
        const entryNumberMap = new Map<any, EntryItem[]>();
        // if entry number is missing group according to date
        const dateMap = new Map<number, EntryItem[]>();
        const ledgerFactory = await this.getLedgerFactory(account, true);
        const destinationLedger = await this.getLedgerById(destinationLedgerId, ledgerFactory.getId());
        if (!destinationLedger) {
          return reject("Destination Ledger not found or was removed");
        }
        const tagFactory = await this.getEntryTagFactory(account, true);
        const typeFactory = await this.getEntryTypeFactory(account, true);
        for (const importedEntry of importedEntries) {
          const debitAmount = importedEntry.getDebitAmount();
          const creditAmount = importedEntry.getCreditAmount();
          let type = AccountEntryType.DEBIT;
          let amount = debitAmount;
          if (creditAmount > 0) {
            type = AccountEntryType.CREDIT;
            amount = creditAmount;
          }
          const entryNumber = importedEntry.getEntryNumber();
          const entryType = importedEntry.getEntryTypeName();
          const entryDate = importedEntry.getDate();
          const entryTag = importedEntry.getEntryTagTitle();
          const entryNarration = importedEntry.getEntryNarration();
          const entryLedger = importedEntry.getLedgerName();
          const item = new EntryItem(
            new Ledger(),
            type,
            amount,
            entryNumber,
            AppUtils.fireDate(entryDate),
            entryType !== "" ? entryType : SYSTEM_ENTRY_TYPE.Journal,
            entryTag,
            entryNarration);
          const ledgerName = entryLedger;
          const ledger = await this.getLedgerById(ledgerName, ledgerFactory.getId(), "name");
          if (ledger) {
            item.setLedger(ledger.getId(), ledger.getName(), ledger.getType());
          } else {
            item.setLedgerName(ledgerName);
          }
          const hasEntryNumber = item.getEntryNumber() !== "" && item.getEntryNumber() !== "" && item.getEntryNumber() !== undefined;
          if (hasEntryNumber) {
            const entryNumberExists = entryNumberMap.get(item.getEntryNumber());
            if (entryNumberExists) {
              // add another item to the entry number
              entryNumberExists.push(item);
            } else {
              entryNumberMap.set(item.getEntryNumber(), [item]);
            }
          }
          const hasEntryDate = (entryDate !== null && entryDate !== undefined);
          if (hasEntryDate) {
            if (!hasEntryNumber) {
              const dateKey = item.getDate().getTime();
              const entryDateExists = dateMap.get(dateKey);
              if (entryDateExists) {
                entryDateExists.push(item);
              } else {
                dateMap.set(dateKey, [item]);
              }
            }
          } else {
            return reject(`Entry ${item.getAmount()} ${item.getEntryNarration()} has invalid date`);
          }
          // if both entry number and date are not provided throw an error and abort importing
          if (!hasEntryNumber && !hasEntryDate) {
            return reject(`Entry ${item.getAmount()} ${item.getEntryNarration()} must provide either date or entry number`);
          }
          // entryItems.push(item);
        }
        /*check all items sharing entry numbers, if they are more than one, make sure they have the same date
        * then group them into a single entry, and remove them from the dates map so that they are not
        * duplicated, check that they do not exceed the maximum allowed entries*/
        /*check all items sharing date and group them in a single entry, for each date
        * add a corresponding entry item for the destination ledger*/
        const entries: Entry[] = [];
        const hasEntryNumbers = entryNumberMap.size > 0;
        if (hasEntryNumbers) {
          for (const entryNo of entryNumberMap.keys()) {
            const items = entryNumberMap.get(entryNo);
            if (!items) {
              continue;
            }
            // for each entry item create an opposite entry item for the destination ledger
            const entry = new Entry();
            entry.addItems(items);
            // if items do not contain destination ledger, add it, only if they do not balance
            const destinationItem = items.find((item) => AppUtils.stringsSimilar(item.getLedgerName(), destinationLedger.getName()));
            const date = items[0].getDate();
            const entryTypeName = items[0].getEntryTypeName();
            const entryTagTitle = items[0].getEntryTagTitle();
            const entryNarration = items[0].getEntryNarration();
            entry.setNarration(entryNarration);
            const tag = await this.getEntryTagById(entryTagTitle, tagFactory.getId(), "title");
            if (tag) {
              entry.setTag(tag);
            }
            const entryType = await this.getEntryTypeById(entryTypeName, typeFactory.getId(), "name");
            if (entryType) {
              entry.setType(entryType);
            }
            const balances = entry.isCrTotalEqualDrTotal();
            const isCrBal = entry.getCreditTotal() > entry.getDebitTotal();
            if (!destinationItem && !balances) {
              const type = isCrBal ? AccountEntryType.DEBIT : AccountEntryType.CREDIT;
              const amount = isCrBal ? entry.getCreditTotal() : entry.getDebitTotal();
              const item = new EntryItem(
                destinationLedger,
                type,
                amount,
                entryNo,
                date,
                entryTypeName,
                entryTagTitle,
                entryNarration);
              entry.addItem(item);
            }
            entries.push(entry);
          }
        }
        const hasEntryDates = dateMap.size > 0;
        if (hasEntryDates) {
          for (const dateAmount of dateMap.keys()) {
            const items = dateMap.get(dateAmount);
            if (!items) {
              continue;
            }
            // for each entry item create an opposite entry item for the destination ledger
            const entry = new Entry();
            entry.addItems(items);
            // if items do not contain destination ledger, add it, only if they do not balance
            const destinationItem = items.find((item) => AppUtils.stringsSimilar(item.getLedgerName(), destinationLedger.getName()));
            const date = items[0].getDate();
            const entryTypeName = items[0].getEntryTypeName();
            const entryTagTitle = items[0].getEntryTagTitle();
            const entryNarration = items[0].getEntryNarration();
            entry.setNarration(entryNarration);
            const tag = await this.getEntryTagById(entryTagTitle, tagFactory.getId(), "title");
            if (tag) {
              entry.setTag(tag);
            }
            const entryType = await this.getEntryTypeById(entryTypeName, typeFactory.getId(), "name");
            if (entryType) {
              entry.setType(entryType);
            }
            const balances = entry.isCrTotalEqualDrTotal();
            const isCrBal = entry.getCreditTotal() > entry.getDebitTotal();
            if (!destinationItem && !balances) {
              const type = isCrBal ? AccountEntryType.DEBIT : AccountEntryType.CREDIT;
              const amount = isCrBal ? entry.getCreditTotal() : entry.getDebitTotal();
              const item = new EntryItem(
                destinationLedger,
                type,
                amount,
                "",
                date,
                entryTypeName,
                entryTagTitle,
                entryNarration);
              entry.addItem(item);
            }
            entries.push(entry);
          }
        }
        const entryItems: EntryItem[] = [];
        entries.forEach((entry) => entryItems.push(...entry.getEntryItems()));
        return resolve(entries);
      } catch (e: any) {
        return reject(e.toString());
      }
    });
  };

  getLedgerOpeningBalance(allEntries: Entry[] = [],
                          decimalPlaces: number,
                          ledgerFactory: LedgerFactory,
                          entryFactory: EntryFactory,
                          ledgerId: any,
                          startDate?: Date) {
    return new Promise<AccountResult>(async (resolve, reject) => {
      try {
        if (!ledgerId) {
          return reject("Ledger not specified. Failed to calculate opening balance");
        }
        const ledger = await this.getLedgerById(ledgerId, ledgerFactory.getId());
        if (!ledger) {
          return reject("Ledger not found. Failed to calculate opening balance");
        }
        let balance = ledger.getOpeningBalance();
        let openingType = ledger.getOpeningBalanceType();

        /* If start date is not specified then return here */
        if (!startDate) {
          return resolve({ type: openingType, amount: balance });
        }
        const entriesByLedgerId = entryFactory.getEntriesByLedgerId(ledgerId, allEntries);
        let entriesByDate = entriesByLedgerId;
        if (startDate) {
          entriesByDate = entryFactory.getEntriesUpToDate(startDate, entriesByLedgerId, false);
        }
        /* DEBIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.DEBIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        const entries = entriesByDate.map((entry) => entry.computeTotals(ledgerId));
        let drTotal = 0;
        const drMap = entries.map((entry) => entry.getDebitTotal());
        if (drMap.length > 0) {
          drTotal = drMap.reduce((cv, pv) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        /* CREDIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.CREDIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        let crTotal = 0;
        const crMap = entries.map((entry) => entry.getCreditTotal());
        if (crMap.length > 0) {
          crTotal = crMap.reduce((cv, pv) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        let drTotalFinal: number;
        let crTotalFinal: number;
        /* Add opening balance */
        if (openingType === AccountEntryType.DEBIT) {
          drTotalFinal = AccUtils.calculate(balance, drTotal, AccountOperator.PLUS, decimalPlaces);
          crTotalFinal = crTotal;
        } else {
          drTotalFinal = drTotal;
          crTotalFinal = AccUtils.calculate(balance, crTotal, AccountOperator.PLUS, decimalPlaces);
        }

        /* Calculate final opening balance */
        const drGreaterThanCr = AccUtils.compare(drTotalFinal, crTotalFinal, AccountOperator.GT);
        const drEqualToCr = AccUtils.compare(drTotalFinal, crTotalFinal, AccountOperator.EQ);
        if (drGreaterThanCr) {
          balance = AccUtils.calculate(drTotalFinal, crTotalFinal, AccountOperator.MINUS, decimalPlaces);
          openingType = AccountEntryType.DEBIT;
        } else if (drEqualToCr) {
          balance = 0;
          // openingType remains the same
        } else {
          balance = AccUtils.calculate(crTotalFinal, drTotalFinal, AccountOperator.MINUS, decimalPlaces);
          openingType = AccountEntryType.CREDIT;
        }
        return resolve({ type: openingType, amount: balance });
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  getLedgerClosingBalance(allEntries: Entry[] = [],
                          decimalPlaces: number,
                          ledgerFactory: LedgerFactory,
                          entryFactory: EntryFactory,
                          ledgerId: any,
                          startDate?: Date,
                          endDate?: Date) {
    return new Promise<AccountResult>(async (resolve, reject) => {
      try {
        if (!ledgerId) {
          return reject("Ledger not specified. Failed to calculate closing balance");
        }
        const ledger = await this.getLedgerById(ledgerId, ledgerFactory.getId());
        if (!ledger) {
          return reject("Ledger not found. Failed to calculate closing balance");
        }
        let balance = ledger.getOpeningBalance();
        let openingType = ledger.getOpeningBalanceType();
        const entriesByLedgerId = entryFactory.getEntriesByLedgerId(ledgerId, allEntries);
        let entriesByDate = entriesByLedgerId; // consider all available entries by default
        if (startDate && endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(startDate, endDate, entriesByLedgerId);
        } else if (startDate && !endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(startDate, undefined, entriesByLedgerId);
        } else if (!startDate && endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(undefined, endDate, entriesByLedgerId);
        }
        /* DEBIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.DEBIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        const entries = entriesByDate.map((entry) => entry.computeTotals(ledgerId));
        let drTotal = 0;
        const drMap = entries.map((entry) => entry.getDebitTotal());
        if (drMap.length > 0) {
          drTotal = drMap.reduce((cv, pv) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        /* CREDIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.CREDIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        let crTotal = 0;
        const crMap = entries.map((entry) => entry.getCreditTotal());
        if (crMap.length > 0) {
          crTotal = crMap.reduce((cv, pv) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        let drTotalFinal: number;
        let crTotalFinal: number;
        /* Add opening balance */
        if (openingType === AccountEntryType.DEBIT) {
          drTotalFinal = AccUtils.calculate(balance, drTotal, AccountOperator.PLUS, decimalPlaces);
          crTotalFinal = crTotal;
        } else {
          drTotalFinal = drTotal;
          crTotalFinal = AccUtils.calculate(balance, crTotal, AccountOperator.PLUS, decimalPlaces);
        }
        /* Calculate and update closing balance */
        const drEqualToCr = AccUtils.compare(drTotalFinal, crTotalFinal, AccountOperator.EQ);
        const drGreaterThanCr = AccUtils.compare(drTotalFinal, crTotalFinal, AccountOperator.GT);
        if (drGreaterThanCr) {
          balance = AccUtils.calculate(drTotalFinal, crTotalFinal, AccountOperator.MINUS, decimalPlaces);
          openingType = AccountEntryType.DEBIT;
        } else if (drEqualToCr) {
          balance = 0;
          // openingType remains the same
        } else {
          balance = AccUtils.calculate(crTotalFinal, drTotalFinal, AccountOperator.MINUS, decimalPlaces);
          openingType = AccountEntryType.CREDIT;
        }
        return resolve({ type: openingType, amount: balance, drTotal, crTotal });
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  getLedgerDebitAndCreditTotal(allEntries: Entry[] = [],
                               decimalPlaces: number,
                               ledgerFactory: LedgerFactory,
                               entryFactory: EntryFactory,
                               ledgerId: any,
                               startDate?: Date,
                               endDate?: Date) {
    return new Promise<AccountResult>(async (resolve, reject) => {
      try {
        if (!ledgerId) {
          return reject("Ledger not specified. Failed to calculate closing balance");
        }
        const ledger = await this.getLedgerById(ledgerId, ledgerFactory.getId());
        if (!ledger) {
          return reject("Ledger not found. Failed to calculate closing balance");
        }
        const entriesByLedgerId = entryFactory.getEntriesByLedgerId(ledgerId, allEntries);
        let entriesByDate = entriesByLedgerId; // consider all available entries by default
        if (startDate && endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(startDate, endDate, entriesByLedgerId);
        } else if (startDate && !endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(startDate, undefined, entriesByLedgerId);
        } else if (!startDate && endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(undefined, endDate, entriesByLedgerId);
        }
        /* DEBIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.DEBIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        const entries = entriesByDate.map((entry) => entry.computeTotals(ledgerId));
        let drTotal = 0;
        const drMap = entries.map((entry) => entry.getDebitTotal());
        if (drMap.length > 0) {
          drTotal = drMap.reduce((cv, pv) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        /* CREDIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.CREDIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        let crTotal = 0;
        const crMap = entries.map((entry) => entry.getCreditTotal());
        if (crMap.length > 0) {
          crTotal = crMap.reduce((cv, pv) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        return resolve({ drTotal, crTotal });
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  getAccountChartOfAccounts(options: EntryOptions = {}, account: Account) {
    let entryOptions = options;
    if (options === null || options === undefined) {
      entryOptions = {};
    }
    return new Promise<ChartOfAccounts>(async (resolve, reject) => {
      try {
        const decimalPlaces = account.getSettings().getMaximumNoOfDecimalPlaces();
        const entryFactory = await this.getEntryFactory(account, true);
        const allEntries = (await this.getAllEntries({}, entryFactory.getId()));
        const ledgerFactory = await this.getLedgerFactory(account, true);
        const ledgers = await this.getAllLedgers(ledgerFactory.getId());
        const groupFactory = await this.getGroupFactory(account, true);
        const groups = await this.getAllGroups(groupFactory.getId());
        // set weights first
        const weightMap = account.getWeightMap(groups); // compute it once
        groups.forEach((group: Group) => group.setWeight(account.getWeight(group.getParentId(), weightMap)));
        ledgers.forEach((ledger) => ledger.setWeight(account.getWeight(ledger.getParentId(), weightMap)));

        // compute opening and closing balances for ledgers
        const showOnlyOpeningBalance = entryOptions?.showOnlyOpeningBalance?.toString() === "true" || false;
        for (let ledger of ledgers) {
          // console.log(`processing ${ledger.getAbstractLedgerType()} ${ledger.getName()}`);
          const openingBalance = await this.getLedgerOpeningBalance(allEntries, decimalPlaces, ledgerFactory, entryFactory, ledger.getId());
          if (openingBalance.amount !== undefined) {
            ledger.setOpeningBalance(openingBalance.amount);
          }
          if (openingBalance.type !== undefined) {
            ledger.setOpeningBalanceType(openingBalance.type);
          }
          if (showOnlyOpeningBalance) {
            continue;
          }
          const closingBalance = await this.getLedgerClosingBalance(
            allEntries,
            decimalPlaces,
            ledgerFactory,
            entryFactory,
            ledger.getId(), entryOptions.startDate, entryOptions.endDate);
          if (closingBalance.amount !== undefined) {
            ledger.setClosingBalance(closingBalance.amount);
          }
          if (closingBalance.type !== undefined) {
            ledger.setClosingBalanceType(closingBalance.type);
          }
          const total = await this.getLedgerDebitAndCreditTotal(
            allEntries,
            decimalPlaces,
            ledgerFactory,
            entryFactory,
            ledger.getId(), entryOptions.startDate, entryOptions.endDate);
          if (total.drTotal !== undefined) {
            ledger.setDebitTotal(total.drTotal);
            ledger.setDebitTotalType(AccountEntryType.DEBIT);
          }
          if (total.crTotal !== undefined) {
            ledger.setCreditTotal(total.crTotal);
            ledger.setCreditTotalType(AccountEntryType.CREDIT);
          }
          // console.log(`processing ${ledger.getAbstractLedgerType()} ${ledger.getName()} complete`);
        }
        const balanceSet = new Set<any>(); // keep track of groups whose balances are already computed
        const sumGroupBalances = (group: Group) => {
          const balanceNotYetComputed = !balanceSet.has(group.getId());
          if (balanceNotYetComputed && group.hasChildren()) {
            group.getChildren().forEach((child) => {
              if (group.isLedgerType(AbstractLedgerType.GROUP)) {
                sumGroupBalances(child as Group);
              }
              const openingBalResult = AccUtils.calculateWithDrCr(
                group.getOpeningBalance(),
                group.getOpeningBalanceType(),
                child.getOpeningBalance(),
                child.getOpeningBalanceType(),
                decimalPlaces);
              if ((openingBalResult.amount !== undefined) && (openingBalResult.type !== undefined)) {
                group.setOpeningBalance(openingBalResult.amount);
                group.setOpeningBalanceType(openingBalResult.type);
              }
              const closingBalResult = AccUtils.calculateWithDrCr(
                group.getClosingBalance(),
                group.getClosingBalanceType(),
                child.getClosingBalance(),
                child.getClosingBalanceType(),
                decimalPlaces);
              if ((closingBalResult.amount !== undefined) && (closingBalResult.type !== undefined)) {
                group.setClosingBalance(closingBalResult.amount);
                group.setClosingBalanceType(closingBalResult.type);
              }
              const drTotalResult = AccUtils.calculateWithDrCr(
                group.getDebitTotal(),
                group.getDebitTotalType(),
                child.getDebitTotal(),
                child.getDebitTotalType(),
                decimalPlaces);
              if ((drTotalResult.amount !== undefined) && (drTotalResult.type !== undefined)) {
                group.setDebitTotal(drTotalResult.amount);
                group.setDebitTotalType(drTotalResult.type);
              }
              const crTotalResult = AccUtils.calculateWithDrCr(
                group.getCreditTotal(),
                group.getCreditTotalType(),
                child.getCreditTotal(),
                child.getCreditTotalType(),
                decimalPlaces);
              if ((crTotalResult.amount !== undefined) && (crTotalResult.type !== undefined)) {
                group.setCreditTotal(crTotalResult.amount);
                group.setCreditTotalType(crTotalResult.type);
              }
              balanceSet.add(group.getId());
            });
          }
        };
        // set child ledgers for each group
        const ledgersChart: Group[] = groups.map((group: Group) => {
          const childLedgers = ledgerFactory.getLedgersByParentId(group.getId(), ledgers);
          group.addChildren(childLedgers);
          return group;
        });
        // set child groups for each group
        const accountsTree: AbstractLedger[] = ledgersChart.map((group) => {
          const childGroups = ledgersChart.filter((child) => child.belongsToParent(group.getId()));
          group.addChildren(childGroups);
          return group;
        }).filter((child) => child.getParentId() === null);
        accountsTree.forEach((group) => {
          if (group.isLedgerType(AbstractLedgerType.GROUP)) {
            sumGroupBalances(group as Group);
          }
        });
        /*option 1: compute it on demand like we are doing here
         *or
         *option 2: compute it and store it on the account object as a variable and save it in the database,
         * in this case, you will need to add deserialization logic to the Account class's toObject method
         * by calling ChartOfAccounts.toObject(rawObject.chartOfAccounts); where Account.chartOfAccounts is
         * a variable defined on the Account object
         *or
         *option 3: compute it using firebase functions each time an entry is made and store it as in option 2
         * */
        const differenceInOpeningBalance = ledgerFactory.getDifferenceInOpeningBalance(ledgers);
        const chartOfAccounts = new ChartOfAccounts(accountsTree, differenceInOpeningBalance);
        return resolve(chartOfAccounts);
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  getAccountBalanceSheet(options: EntryOptions, account: Account) {
    return new Promise<BalanceSheet>((resolve, reject) => {
      return this.getAccountChartOfAccounts(options, account).then((chart) => {
        const differenceInOpeningBalance = chart.getDifferenceInOpeningBalanceResult();
        const decimalPlaces = account.getSettings().getMaximumNoOfDecimalPlaces();
        const balanceSheet = new BalanceSheet(chart.getTreeChart(), differenceInOpeningBalance, decimalPlaces);
        return resolve(balanceSheet);
      }).catch((error: any) => reject(error));
    });
  }

  getAccountProfitAndLossStatement(options: EntryOptions, account: Account) {
    return new Promise<ProfitAndLossStatement>((resolve, reject) => {
      if (!options) {
        return reject("Please specify search options and try again");
      }
      return this.getAccountChartOfAccounts(options, account).then((chart) => {
        const decimalPlaces = account.getSettings().getMaximumNoOfDecimalPlaces();
        const statement = new ProfitAndLossStatement(chart.getTreeChart(), decimalPlaces);
        return resolve(statement);
      }).catch((error: any) => reject(error));
    });
  }

  getAccountTrialBalance(account: Account) {
    return new Promise<TrialBalance>((resolve, reject) => {
      return this.getAccountChartOfAccounts({}, account).then((chart) => {
        const differenceInOpeningBalance = chart.getDifferenceInOpeningBalanceResult();
        const decimalPlaces = account.getSettings().getMaximumNoOfDecimalPlaces();
        const trialBalance = new TrialBalance(chart.getTreeChart(), differenceInOpeningBalance, decimalPlaces);
        return resolve(trialBalance);
      }).catch((error: any) => reject(error));
    });
  }

  getPendingReconciliationBalance(account: Account, ledgerId: any, startDate?: Date, endDate?: Date) {
    return new Promise<AccountResult>(async (resolve, reject) => {
      try {
        if (!ledgerId) {
          return reject("Ledger not specified. Failed to calculate reconciliation balance");
        }
        const ledgerFactory = await this.getLedgerFactory(account, true);
        const ledger = await this.getLedgerById(ledgerId, ledgerFactory.getId());
        if (!ledger) {
          return reject("Ledger not found. Failed to calculate reconciliation balance");
        }
        const decimalPlaces = account.getSettings().getMaximumNoOfDecimalPlaces();
        const entryFactory = await this.getEntryFactory(account, true);
        const allEntries = await this.getAllEntries({}, entryFactory.getId());
        const entriesByLedgerId = entryFactory.getEntriesByLedgerId(ledgerId, allEntries);
        let entriesByDate = entriesByLedgerId; // consider all available entries by default
        if (startDate && endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(startDate, endDate, entriesByLedgerId);
        } else if (startDate && !endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(startDate, undefined, entriesByLedgerId);
        } else if (!startDate && endDate) {
          entriesByDate = entryFactory.getEntriesByDateRange(undefined, endDate, entriesByLedgerId);
        }
        const entries = entriesByDate.filter((ent: Entry) => {
          // filter out entries that were reconciled already
          const items = ent.getEntryItemsByLedgerId(ledgerId);
          const item = items.find((it) => !it.wasReconciled());
          return !!item; // same as if (item) return true;
        }).map((entry: Entry) => entry.computeTotals(ledgerId));
        /* DEBIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.DEBIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        let drTotal = 0;
        const drMap = entries.map((entry: Entry) => entry.getDebitTotal());
        if (drMap.length > 0) {
          drTotal = drMap.reduce((cv: number, pv: number) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        /* CREDIT TOTAL:- get all entry items whose ledgerId = ledgerId and openingType = AccountEntryType.CREDIT
         * if date is specified, return all entries whose date is < startDate
         * sum all amounts on entry items
         */
        let crTotal = 0;
        const crMap = entries.map((entry: Entry) => entry.getCreditTotal());
        if (crMap.length > 0) {
          crTotal = crMap.reduce((cv: number, pv: number) => AccUtils.calculate(cv, pv, AccountOperator.PLUS, decimalPlaces));
        }
        return resolve({ drTotal, crTotal });
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  }

  getReconciliationStatement(options: EntryOptions, account: Account) {
    return new Promise<ReconciliationStatement>((resolve, reject) => {
      return this.getAccountLedgerStatement(options, account).then((statement) => {
        return this.getPendingReconciliationBalance(account, options.ledgerId, options.startDate, options.endDate).then((pendingReconciliation) => {
          if (!options.showAllEntries) {
            statement.getEntries().forEach((entry, index) => {
              const item = entry.getEntryItemsByLedgerId(options.ledgerId).find((it) => it.wasReconciled());
              if (item) {
                statement.getEntries().splice(index, 1);
              }
            });
          }
          const reconciliation = (new ReconciliationStatement(pendingReconciliation).toObject(statement));
          return resolve(reconciliation);
        });
      }).catch((error: any) => reject(error));
    });
  }

  getAccountLedgerStatement(options: EntryOptions, account: Account) {
    return new Promise<LedgerStatement>(async (resolve, reject) => {
      try {
        if (!options) {
          return reject("Please specify search options and try again");
        }
        const ledgerIdIsNotSet = options.ledgerId === "" || !options.ledgerId;
        if (ledgerIdIsNotSet) {
          return reject("Please select a ledger account and try again");
        }
        const ledgerFactory = await this.getLedgerFactory(account, true);
        const ledger: any = await this.getLedgerById(options.ledgerId, ledgerFactory.getId());
        const ledgerNotFound = !ledger;
        if (ledgerNotFound) {
          return reject("Specified Ledger Account was not found, kindly select another ledger account and try again");
        }
        const entryFactory = await this.getEntryFactory(account, true);
        const decimalPlaces = account.getSettings().getMaximumNoOfDecimalPlaces();
        const allEntries = (await this.getAllEntries({}, entryFactory.getId()));
        return this.getLedgerOpeningBalance(allEntries, decimalPlaces, ledgerFactory, entryFactory, ledger.getId(), options.startDate).then((openingBalance) => {
          return this.getLedgerClosingBalance(allEntries, decimalPlaces, ledgerFactory, entryFactory, ledger.getId(), undefined, options.endDate).then((closingBalance) => {
            const entries: Entry[] = entryFactory.getEntriesByOptions(options, allEntries);
            const statement = new LedgerStatement(entries, openingBalance, closingBalance, ledger);
            return resolve(statement);
          }).catch((error: any) => reject(error));
        }).catch((error: any) => reject(error));
      } catch (e: any) {
        return reject(e);
      }
    });
  }

  updateEntryItems(ledger: Ledger, factoryId: any, account: Account) {
    return new Promise<Ledger>(async (resolve, reject) => {
      try {
        const oldLedger = await this.getLedgerById(ledger.getId(), factoryId);
        const nameChanged = oldLedger ? (ledger.getName() !== oldLedger.getName()) : false;
        const typeChanged = oldLedger ? (ledger.getType() !== oldLedger.getType()) : false;
        const ledgerChanged = nameChanged || typeChanged; // only name and type matter to entry items
        if (ledgerChanged) {
          // update ledger names on entry items
          const entryFactory = await this.getEntryFactory(account, true);
          const options: EntryOptions = { ledgerId: ledger.getId() };
          const entries = (await this.getAllEntries(options, entryFactory.getId()));
          if (entries.length > 0) {
            for (const entry of entries) {
              for (const item of entry.getEntryItems()) {
                if (item.getLedgerId() === ledger.getId()) {
                  item.setLedger(ledger.getId(), ledger.getName(), ledger.getType());
                }
              }
              await this.saveEntry(entry, account, true, entryFactory);
            }
          }
        }
        return resolve(ledger);
      } catch (e: any) {
        return reject(e?.toString());
      }
    });
  }
}
