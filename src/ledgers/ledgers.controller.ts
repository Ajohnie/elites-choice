import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { Converter } from "../converter";
import {
  AccountingErrors,
  AppUtils,
  BalanceSheet,
  BranchOffice,
  ChartOfAccounts,
  EntryOptions,
  Ledger,
  LedgerStatement,
  ProfitAndLossStatement,
  ReconciliationStatement,
  TrialBalance
} from "../lib";
import { AccountsService } from "../accounts/accounts.service";
import { EntriesService } from "../entries/entries.service";

@Controller("ledgers")
export class LedgersController {
  constructor(private readonly service: EntriesService,
              private readonly accountService: AccountsService) {
  }

  @Post("import-ledgers")
  import(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const ledgerObj = Converter.fromBody(body);
        if (!ledgerObj) {
          return reject("Please select ledgers and try again !");
        }
        if (AppUtils.hasElements(ledgerObj.ledgers)) {
          return reject("Ledger Format not supported, Please import ledgers and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not import ledgers, no default account");
        }
        const ledgerFactory = await this.service.getLedgerFactory(account, true);
        const ledgers = ledgerObj.ledgers.map((item: any) => new Ledger().toObject(item));
        let processed = 0;
        for (const ledger of ledgers) {
          const existing = await this.service.getLedgerById(ledger.getName(), ledgerFactory.getId(), "name");
          if (!existing) {
            const saved = await this.service.saveLedger(ledger, account, ledgerFactory);
            if (saved) {
              processed++;
            }
          }
        }
        return resolve(processed);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("save-ledgers")
  saveLedgers(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const ledgerObj = Converter.fromBody(body);
        if (!ledgerObj) {
          return reject("Please set ledger and try again !");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not save ledgers, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const typeSet = Object.getOwnPropertyDescriptor(ledgerObj, "abstractLedgerType");
        if (!typeSet) {
          return reject("Specify Account Type !");
        }
        const ledgerFactory = await this.service.getLedgerFactory(account, true);
        const groupFactory = await this.service.getGroupFactory(account, true);
        const toSave = (new Ledger()).toObject(ledgerObj);
        const parent = await this.service.getGroupById(toSave.getParentId(), groupFactory.getId());
        if (!parent) {
          return reject("Selected Parent Group Does not exist");
        }
        toSave.setParentName(parent.getName());
        return this.service.saveLedger(toSave, account, ledgerFactory).then((saved) => {
          this.service.updateEntryItems(toSave, ledgerFactory.getId(), account).then(() => {
            return resolve(AppUtils.sanitizeObject(saved));
          }).catch((reason) => reject(reason));
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-ledgers")
  getLedgers(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load ledgers, no default account");
        }
        const ledgerFactory = await this.service.getLedgerFactory(account, true);
        const allLedgers = await this.service.getAllLedgers(ledgerFactory.getId());
        return resolve(AppUtils.sanitizeObject(allLedgers));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete-ledgers")
  deleteLedgers(@Query("ledgerId") ledgerId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(ledgerId)) {
          return reject("select ledger and try again");
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not delete ledger, no default account");
        }
        if (account.isLocked()) {
          return reject(AccountingErrors.accountLocked());
        }
        const ledgerFactory = await this.service.getLedgerFactory(account, true);
        const ledger = await this.service.getLedgerById(ledgerId, ledgerFactory.getId());
        if (!ledger) {
          return reject("selected ledger was not found or does not exist");
        }
        const entryFactory = await this.service.getEntryFactory(account);
        const options: EntryOptions = { ledgerId: ledger.getId() };
        const entries = (await this.service.getAllEntries(options, entryFactory.getId()));
        const entriesExist = entries.length > 0;
        if (entriesExist) {
          return reject("Can not delete a Ledger that has entries");
        }
        return this.service.deleteLedger(ledger, ledgerFactory, account).then((ok) => {
          return resolve(ok);
        }).catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-chart-of-accounts")
  getChartOfAccounts(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        if (AppUtils.stringIsSet(params?.startDate)) {
          params.startDate = AppUtils.fireDate(params.startDate);
        }
        if (AppUtils.stringIsSet(params?.endDate)) {
          params.endDate = AppUtils.fireDate(params.endDate);
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load ledgers, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const charts: ChartOfAccounts[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const chartOfAccounts = await this.service.getAccountChartOfAccounts(params, account);
            charts.push(chartOfAccounts);
          }
          if (charts.length === 0) {
            return resolve(AppUtils.sanitizeObject(new ChartOfAccounts()));
          }
          const mergedCharts = charts.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedCharts));
        } else {
          const chartOfAccounts = await this.service.getAccountChartOfAccounts(params, account);
          return resolve(AppUtils.sanitizeObject(chartOfAccounts));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-flat-chart-of-accounts")
  getFlatChartOfAccounts(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        if (AppUtils.stringIsSet(params?.startDate)) {
          params.startDate = AppUtils.fireDate(params.startDate);
        }
        if (AppUtils.stringIsSet(params?.endDate)) {
          params.endDate = AppUtils.fireDate(params.endDate);
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load ledgers, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const charts: ChartOfAccounts[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const chartOfAccounts = await this.service.getAccountChartOfAccounts(params, account);
            charts.push(chartOfAccounts);
          }
          if (charts.length === 0) {
            return resolve(AppUtils.sanitizeObject(new ChartOfAccounts()));
          }
          const mergedCharts = charts.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedCharts));
        } else {
          const chartOfAccounts = await this.service.getAccountChartOfAccounts(params, account);
          return resolve(AppUtils.sanitizeObject(chartOfAccounts));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-balance-sheet")
  getBalanceSheet(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        if (AppUtils.stringIsSet(params?.startDate)) {
          params.startDate = AppUtils.fireDate(params.startDate);
        }
        if (AppUtils.stringIsSet(params?.endDate)) {
          params.endDate = AppUtils.fireDate(params.endDate);
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load balance sheet, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const sheets: BalanceSheet[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const sheet = await this.service.getAccountBalanceSheet(params, account);
            sheets.push(sheet);
          }
          if (sheets.length === 0) {
            return resolve(AppUtils.sanitizeObject(new BalanceSheet()));
          }
          const mergedSheets = sheets.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedSheets));
        } else {
          const sheet = await this.service.getAccountBalanceSheet(params, account);
          return resolve(AppUtils.sanitizeObject(sheet));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-profit-and-loss-statement")
  getProfitAndLossStatement(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        if (AppUtils.stringIsSet(params?.startDate)) {
          params.startDate = AppUtils.fireDate(params.startDate);
        }
        if (AppUtils.stringIsSet(params?.endDate)) {
          params.endDate = AppUtils.fireDate(params.endDate);
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load balance sheet, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const statements: ProfitAndLossStatement[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const statement = await this.service.getAccountProfitAndLossStatement(params, account);
            statements.push(statement);
          }
          if (statements.length === 0) {
            return resolve(AppUtils.sanitizeObject(new ProfitAndLossStatement()));
          }
          const mergedStatements = statements.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedStatements));
        } else {
          const statement = await this.service.getAccountProfitAndLossStatement(params, account);
          return resolve(AppUtils.sanitizeObject(statement));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-trial-balance")
  getTrialBalance(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        if (AppUtils.stringIsSet(params?.startDate)) {
          params.startDate = AppUtils.fireDate(params.startDate);
        }
        if (AppUtils.stringIsSet(params?.endDate)) {
          params.endDate = AppUtils.fireDate(params.endDate);
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load balance sheet, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const balances: TrialBalance[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const balance = await this.service.getAccountTrialBalance(account);
            balances.push(balance);
          }
          if (balances.length === 0) {
            return resolve(AppUtils.sanitizeObject(new TrialBalance()));
          }
          const mergedBalances = balances.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedBalances));
        } else {
          const balance = await this.service.getAccountTrialBalance(account);
          return resolve(AppUtils.sanitizeObject(balance));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-reconciliation")
  getReconciliation(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        if (AppUtils.stringIsSet(params?.startDate)) {
          params.startDate = AppUtils.fireDate(params.startDate);
        }
        if (AppUtils.stringIsSet(params?.endDate)) {
          params.endDate = AppUtils.fireDate(params.endDate);
        }
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load balance sheet, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const statements: ReconciliationStatement[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const statement = await this.service.getReconciliationStatement(params, account);
            statements.push(statement);
          }
          if (statements.length === 0) {
            return resolve(AppUtils.sanitizeObject(new ReconciliationStatement()));
          }
          const mergedStatements = statements.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedStatements));
        } else {
          const statement = await this.service.getReconciliationStatement(params, account);
          return resolve(AppUtils.sanitizeObject(statement));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("get-ledger-statement")
  getLedgerStatement(@Query() params: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const allBranches = params?.allBranches?.toString() === "true" || false;
        const account = await this.accountService.getDefaultAccount();
        if (!account) {
          return reject("can not load balance sheet, no default account");
        }
        if (allBranches) {
          const branchNames = AppUtils.enumToArray(BranchOffice);
          const statements: LedgerStatement[] = [];
          const allAccounts = (await this.accountService.getAllAccounts()).filter((acc) => acc.isActive());
          for (const branchName of branchNames) {
            const account = allAccounts.find((acc) => acc.belongsToBranch(branchName));
            if (!account) {
              continue;
            }
            const statement = await this.service.getAccountLedgerStatement(params, account);
            statements.push(statement);
          }
          if (statements.length === 0) {
            return resolve(AppUtils.sanitizeObject(new LedgerStatement()));
          }
          const mergedStatements = statements.reduce((pv, cv) => cv.mergeWith(pv));
          return resolve(AppUtils.sanitizeObject(mergedStatements));
        } else {
          const statement = await this.service.getAccountLedgerStatement(params, account);
          return resolve(AppUtils.sanitizeObject(statement));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }
}
