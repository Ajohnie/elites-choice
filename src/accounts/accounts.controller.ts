import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { AccountsService } from "./accounts.service";
import { AccountSettings, AppUtils, BranchOffice } from "../lib";
import { Converter } from "../converter";
import { LedgersService } from "../ledgers/ledgers.service";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly service: AccountsService,
              private readonly ledgerService: LedgersService) {
  }

  @Get("add-account-settings")
  addAccountSettings(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const label = options.label;
        const branch: any = this.service.getCurrentBranchName();
        const account = await this.service.addNewAccount(label, branch);
        const ledgerFactory = await this.ledgerService.getLedgerFactory(account, true);
        const groupFactory = await this.ledgerService.getGroupFactory(account, true);
        const allLedgers = await this.ledgerService.getAllLedgers(ledgerFactory.getId());
        if (allLedgers.length === 0) {
          await this.ledgerService.addSystemGroups(account, ledgerFactory, groupFactory);
        }
        return resolve(AppUtils.sanitizeObject(account.getSettings()));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-default-account-settings")
  getDefaultAccountSettings(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const account = await this.service.getDefaultAccount();
        if (!account) {
          return reject("can not load account settings, default account was not found");
        }
        const settings = account.getSettings();
        settings.setAccountLabel(account.getLabel());
        settings.setAccountId(account.getId());
        const ledgerFactory = await this.ledgerService.getLedgerFactory(account, true);
        const groupFactory = await this.ledgerService.getGroupFactory(account, true);
        const allLedgers = await this.ledgerService.getAllLedgers(ledgerFactory.getId());
        if (allLedgers.length === 0) {
          await this.ledgerService.addSystemGroups(account, ledgerFactory, groupFactory);
        }
        return resolve(AppUtils.sanitizeObject(settings));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("load-account-settings")
  loadAccountSettings(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const accounts = await this.service.getAllAccounts();
        if (accounts.length === 0) {
          return this.service.addNewAccount(BranchOffice.MAIN, BranchOffice.MAIN)
            .then((account) => {
              const settings = account.getSettings();
              settings.setAccountLabel(account.getLabel());
              settings.setAccountId(account.getId());
              return resolve([AppUtils.sanitizeObject(settings)]);
            });
        }
        const results = accounts.map((t) => {
          const settings = t.getSettings();
          settings.setAccountLabel(t.getLabel());
          settings.setAccountId(t.getId());
          return settings;
        });
        return resolve(AppUtils.sanitizeObject(results));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("save-account-settings")
  saveAccountSettings(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const accountObj = Converter.fromBody(body);
        if (!accountObj) {
          return reject("Please set account settings and try again !");
        }
        const settings = (new AccountSettings()).toObject(accountObj);
        const account = await this.service.getAccountById(settings.getAccountId());
        if (!account) {
          return reject("can not save settings, account was not found");
        }
        const accounts = await this.service.getAllAccounts();
        const duplicates = accounts.filter((acc) => acc.belongsToBranch(settings.getBranchName()) && acc.isActive() && acc.getId() !== settings.getAccountId());
        const duplicatesExist = duplicates.length > 0;
        if (duplicatesExist) {
          return reject(`Another Account belonging to branch ${settings.getBranchName()} is already active`);
        }
        account.setSettings(settings);
        return this.service.saveAccount(account, true).then((saved) => {
          return resolve(AppUtils.sanitizeObject(saved));
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
