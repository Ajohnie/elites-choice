import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { Converter } from "../converter";
import { AccountingErrors, AppUtils, Entry, EntryItem } from "../lib";
import { EntriesService } from "./entries.service";
import { AccountsService } from "../accounts/accounts.service";

@Controller("entries")
export class EntriesController {
  constructor(private readonly service: EntriesService,
              private readonly accountService: AccountsService) {
  }

  @Post("import-entries")
  import(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const entryObj = Converter.fromBody(body);
        if (!entryObj) {
          return reject("Please select entries and try again !");
        }
        if (AppUtils.hasElements(entryObj.entryItems)) {
          return reject("Entry Format not supported, Please import entries and try again");
        }
        const destinationLedgerId = entryObj.destinationLedgerId;
        if (!AppUtils.stringIsSet(destinationLedgerId)) {
          return reject("Please select destination Ledger and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not import entries, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryFactory = await this.service.getEntryFactory(account, true);
        const entryItems = entryObj.entries.map((item: any) => new EntryItem().toObject(item));
        const entries = await this.service.groupEntries(entryItems, destinationLedgerId, account);
        let processed = 0;
        for (const entry of entries) {
          const saved = await this.service.saveEntry(entry, account, false, entryFactory);
          if (saved) {
            processed++;
          }
        }
        return resolve(processed);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("reconcile-entries")
  reconcile(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const entryObj = Converter.fromBody(body);
        if (!entryObj) {
          return reject("Please select entries and try again !");
        }
        if (AppUtils.hasElements(entryObj.entries)) {
          return reject("Entry Format not supported, Please import entries and try again");
        }
        const destinationLedgerId = entryObj.destinationLedgerId;
        if (!AppUtils.stringIsSet(destinationLedgerId)) {
          return reject("Please select destination Ledger and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not import entries, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryFactory = await this.service.getEntryFactory(account, true);
        const entries = entryObj.entries.map((item: any) => {
          const entry = new Entry().toObject(item);
          return this.service.saveEntry(entry, account, false, entryFactory);
        });
        return Promise.all(entries).then(() => resolve(true)).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("save-entries")
  saveEntries(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const entryObj = Converter.fromBody(body);
        if (!entryObj) {
          return reject("Please set entry and try again !");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not save entries, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryFactory = await this.service.getEntryFactory(account, true);
        const toSave = (new Entry()).toObject(entryObj);
        return this.service.saveEntry(toSave, account, false, entryFactory).then((saved) => {
          return resolve(AppUtils.sanitizeObject(saved));
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-entries")
  getEntries(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load entries, no default account");
        }
        const entryFactory = await this.service.getEntryFactory(account, true);
        const allEntries = await this.service.getAllEntries(options, entryFactory.getId());
        return resolve(AppUtils.sanitizeObject(allEntries));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete-entries")
  deleteEntries(@Query("entryId") entryId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(entryId)) {
          return reject("select entry and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not delete entry, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryFactory = await this.service.getEntryFactory(account, true);
        const entry = await this.service.getEntryById(entryId, entryFactory.getId());
        if (!entry) {
          return reject("selected entry was not found or does not exist");
        }
        return this.service.deleteEntry(entry, entryFactory).then((ok) => {
          return resolve(ok);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
