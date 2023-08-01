import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { Account, AccountingErrors, AppUtils, EntryType } from "../lib";
import { Converter } from "../converter";
import { EntryTypesService } from "./entry-types.service";
import { EntriesService } from "./entries.service";
import { AccountsService } from "../accounts/accounts.service";

@Controller("entry-types")
export class EntryTypesController {
  constructor(private readonly service: EntryTypesService,
              private readonly entryService: EntriesService,
              private readonly accountService: AccountsService) {
  }

  @Post("save-entry-types")
  saveEntryTypes(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const entryTypeObj = Converter.fromBody(body);
        if (!entryTypeObj) {
          return reject("Please set entry type and try again !");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not save entry types, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryTypeFactory = await this.service.getEntryTypeFactory(account, true);
        const toSave = (new EntryType()).toObject(entryTypeObj);
        return this.service.saveEntryType(toSave, account, entryTypeFactory).then((saved) => {
          return this.updateEntries(saved, account).then(() => { // use event emitter instead
            return resolve(AppUtils.sanitizeObject(saved));
          }).catch((error: any) => reject(error));
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-entry-types")
  getEntryTypes(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load entry types, no default account");
        }
        const entryTypeFactory = await this.service.getEntryTypeFactory(account, true);
        const allEntryTypes = await this.service.getAllEntryTypes(entryTypeFactory.getId());
        if (allEntryTypes.length === 0) {
          const newTypes = await this.service.addSystemEntryTypes(account, entryTypeFactory);
          return resolve(AppUtils.sanitizeObject(newTypes));
        }
        return resolve(AppUtils.sanitizeObject(allEntryTypes));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete-entry-types")
  deleteEntryTypes(@Query("typeId") entryTypeId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(entryTypeId)) {
          return reject("select entry type and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not delete entry type, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryTypeFactory = await this.service.getEntryTypeFactory(account, true);
        const entryType = await this.service.getEntryTypeById(entryTypeId, entryTypeFactory.getId());
        if (!entryType) {
          return reject("selected entry type was not found or does not exist");
        }
        const entryFactory = await this.entryService.getEntryFactory(account);
        const entry = await this.entryService.getEntryById(entryType.getId(), entryFactory.getId(), "type.id");
        if (entry) {
          return reject(`Can not delete Entry Type, Entries With this type Exist e.g ${entry.getNarration()}`);
        }
        return this.service.deleteEntryType(entryType, entryTypeFactory).then((ok) => {
          return resolve(ok);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  private updateEntries = (entryType: EntryType, account: Account) => {
    return new Promise<EntryType>(async (resolve, reject) => {
      try {
        if (!entryType.getId()) {
          return resolve(entryType);
        }
        // update Entry Types
        const entryFactory = await this.entryService.getEntryFactory(account, true);
        const entriesWithTypes = await this.entryService.getEntriesById(entryType.getId(), entryFactory.getId(), "type.id");
        if (entriesWithTypes.length > 0) {
          for (const entry of entriesWithTypes) {
            if (entry.getType().getId() === entryType.getId()) {
              entry.setType(entryType);
              await this.entryService.saveEntry(entry, account, true, entryFactory);
            }
          }
        }
        return resolve(entryType);
      } catch (e: any) {
        return reject(e);
      }
    });
  };
}
