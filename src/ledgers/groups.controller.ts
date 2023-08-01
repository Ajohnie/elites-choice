import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { Converter } from "../converter";
import { AccountingErrors, AppUtils, Group } from "../lib";
import { AccountsService } from "../accounts/accounts.service";
import { EntriesService } from "../entries/entries.service";

@Controller("groups")
export class GroupsController {
  constructor(private readonly service: EntriesService,
              private readonly accountService: AccountsService) {
  }

  @Post("save-groups")
  saveGroups(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const groupObj = Converter.fromBody(body);
        if (!groupObj) {
          return reject("Please set group and try again !");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not save groups, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const typeSet = Object.getOwnPropertyDescriptor(groupObj, "abstractLedgerType");
        if (!typeSet) {
          return reject("Specify Account Type !");
        }
        const groupFactory = await this.service.getGroupFactory(account, true);
        const toSave = (new Group()).toObject(groupObj);
        const parent = await this.service.getGroupById(toSave.getParentId(), groupFactory.getId());
        if (!parent) {
          return reject("Selected Parent Group Does not exist");
        }
        toSave.setParentName(parent.getName());
        return this.service.saveGroup(toSave, account, groupFactory).then((saved) => {
          return resolve(AppUtils.sanitizeObject(saved));
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-groups")
  getGroups(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load groups, no default account");
        }
        const groupFactory = await this.service.getGroupFactory(account, true);
        const allGroups = await this.service.getAllGroups(groupFactory.getId());
        return resolve(AppUtils.sanitizeObject(allGroups));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete-groups")
  deleteGroups(@Query("groupId") groupId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(groupId)) {
          return reject("select group and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not delete group, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const groupFactory = await this.service.getGroupFactory(account, true);
        const group = await this.service.getGroupById(groupId, groupFactory.getId());
        if (!group) {
          return reject("selected group was not found or does not exist");
        }
        const ledgerFactory = await this.service.getLedgerFactory(account);
        const ledger = await this.service.getLedgerById(group.getId(), ledgerFactory.getId(), "parentId");
        if (ledger) {
          return reject(`group is a parent to ledger ${ledger.getName()}`);
        }
        return this.service.deleteGroup(group, groupFactory, account).then((ok) => {
          return resolve(ok);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
