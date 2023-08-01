import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { Converter } from "../converter";
import { AccountingErrors, AppUtils, EntryTag } from "../lib";
import { TagsService } from "./tags.service";
import { EntriesService } from "./entries.service";
import { AccountsService } from "../accounts/accounts.service";

@Controller("tags")
export class TagsController {
  constructor(private readonly service: TagsService,
              private readonly entryService: EntriesService,
              private readonly accountService: AccountsService) {
  }

  @Post("save-entry-tags")
  saveEntryTags(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const entryTagObj = Converter.fromBody(body);
        if (!entryTagObj) {
          return reject("Please set entry type and try again !");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not save entry types, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryTagFactory = await this.service.getEntryTagFactory(account, true);
        const toSave = (new EntryTag()).toObject(entryTagObj);
        return this.service.saveEntryTag(toSave, account, entryTagFactory).then((saved) => {
          return resolve(AppUtils.sanitizeObject(saved));
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-entry-tags")
  getEntryTags(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load entry types, no default account");
        }
        const entryTagFactory = await this.service.getEntryTagFactory(account, true);
        const allEntryTags = await this.service.getAllEntryTags(entryTagFactory.getId());
        return resolve(AppUtils.sanitizeObject(allEntryTags));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete-entry-tags")
  deleteEntryTags(@Query("typeId") entryTagId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(entryTagId)) {
          return reject("select entry type and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not delete entry type, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const entryTagFactory = await this.service.getEntryTagFactory(account, true);
        const entryTag = await this.service.getEntryTagById(entryTagId, entryTagFactory.getId());
        if (!entryTag) {
          return reject("selected entry type was not found or does not exist");
        }
        const entryFactory = await this.entryService.getEntryFactory(account, true);
        const entriesWithTags = await this.entryService.getEntriesById(entryTagId, entryFactory.getId(), "tag.id");
        if (entriesWithTags.length > 0) {
          return reject("Can not delete Tag, Entries With this Tag Exist");
        }
        return this.service.deleteEntryTag(entryTag, entryTagFactory, account).then((ok) => {
          return resolve(ok);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
