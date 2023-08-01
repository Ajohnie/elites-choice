import { Injectable } from "@nestjs/common";
import { Account, AppRoutes, AppUtils, BranchOffice } from "../lib";
import { AuthService } from "../auth/auth.service";
import { FireBase } from "../firebase";

@Injectable()
export class AccountsService {
  private accountsDb = FireBase.getCollection(AppRoutes.accounts.INDEX);
  private newAccountQueue = new Map<string, Account>();

  constructor(private readonly auth: AuthService) {
  }

  getAccountById(id: string) {
    return new Promise<Account | null>((resolve, reject) => {
      if (!id) {
        return reject("provide account identifier");
      }
      if (typeof id === "object") {
        return reject(`unsupported account record identifier, contact admin`);
      }
      return this.accountsDb.doc(id).get().then((snap) => {
        if (!snap.exists) {
          return reject("account does not exist");
        }
        const account: Account = AppUtils.toObject(new Account(), snap.data());
        account.setId(snap.id);
        return resolve(account);
      });
    });
  }

  getDefaultAccount() {
    return new Promise<Account>(async (resolve, reject) => {
      try {
        const branchName = this.auth.getFirstBranchName();
        if (!AppUtils.stringIsSet(branchName)) {
          return reject("can not access default account, provide branch name and try again");
        }
        const accounts = await this.getAllAccounts();
        const noAccounts = accounts.length === 0;
        if (noAccounts) {
          return this.addNewAccount(BranchOffice.MAIN, BranchOffice.MAIN).then((response) => {
            return resolve(response);
          }).catch((reason) => reject(reason));
        }
        const active = accounts.filter((acc) => {
          return acc.isActive() && acc.belongsToBranch(branchName);
        }).find((acc2) => !acc2.isExpired());
        if (active) {
          // find account whose financial range lies with in current date
          return resolve(active);
        }
        const account = new Account();
        account.activate();
        account.setLabel("NOT CONFIGURED");
        return reject(`contact admin to configure account for branch ${branchName}`);
      } catch (e) {
        return reject(e);
      }
    });
  }

  accountNameExists(label: string, accounts: Account[]) {
    return this.getAccountIndex(label, accounts) > -1;
  }

  getAccountIndex(label: string, accounts: Account[]) {
    // make checking, case-insensitive
    return accounts.findIndex((account) => AppUtils.stringsSimilar(account.getLabel(), label));
  }

  getAccountLabel(accountNumber = 1, accounts: Account[]) {
    let newLabel = "Account " + accountNumber;
    if (this.accountNameExists(newLabel, accounts)) {
      // keep adding numbers and checking if those names exist
      newLabel = this.getAccountLabel(accountNumber + 1, accounts);
    }
    return newLabel;
  }

  addAccount(accounts: Account[],
             accountLabel?: string,
             branchOffice?: BranchOffice) {
    const currentUser = this.auth.getUser();
    let label = accountLabel;
    if (!label) {
      label = this.getAccountLabel(1, accounts);
    }
    let branch = branchOffice;
    if (!branch) {
      branch = BranchOffice.MAIN;
    }
    const currentUserName = currentUser.getName();
    const newAccount = new Account(label);
    const noOtherActiveAccounts = accounts.filter((acc) => acc.isActive()).length === 0;
    /* accounts are inactive by default, if no active account exists,
    * activate current account*/
    if (noOtherActiveAccounts) {
      newAccount.activate();
    }
    newAccount.setUser(currentUserName);
    newAccount.getSettings().setBranchName(branch);
    accounts.unshift(newAccount);
    return newAccount;
  }

  addNewAccount(label: string, branch: BranchOffice) {
    return new Promise<Account>(async (resolve, reject) => {
      try {
        const duplicateBeingSaved = this.newAccountQueue.has(label);
        if (duplicateBeingSaved) {
          const fn = () => console.log("New Account Queue not empty");
          setTimeout(fn, 2000);
        }
        const result = await this.getAccountByLabel(label);
        if (result) {
          return reject(`account similar to ${label} already exists`);
        }
        const accounts = await this.getAllAccounts();
        const account = this.addAccount(accounts, label, branch);
        this.newAccountQueue.set(label, account);
        const saved = await this.saveAccount(account, true);
        if (!saved.getId()) {
          return reject(`creating account ${label} failed`);
        }
        // save system accounts
        account.setId(saved.getId());
        // TODO removed await this.migrateAccounts(account);
        this.newAccountQueue.delete(label);
        return resolve(account);
      } catch (e) {
        return reject(e);
      }
    });
  }

  beforeSave(account: Account) {
    return new Promise<Account>((resolve, reject) => {
      account.getSettings().setAccountId(account.getId());
      account.getSettings().setAccountLabel(account.getLabel());
      if (!account.isDefault()) {
        return resolve(account);
      }
      return this.getAllAccounts().then((accounts) => {
        const duplicateDefaultAccount = accounts.find((acc) => acc.isDefault() && acc.getLabel() !== account.getLabel());
        if (duplicateDefaultAccount) {
          return reject("Another Default Account Already exists !");
        }
        return resolve(account);
      }).catch((reason) => reject(reason));
    });
  }

  saveAccount(account: Account, parentOnly = false) {
    return new Promise<Account>(async (resolve, reject) => {
      try {
        account.getSettings().setAccountLabel(account.getLabel());
        if (account.getId()) {
          const ok = await this.beforeSave(account);
          if (ok) {
            let sanitized = AppUtils.sanitizeObject(account);
            if (parentOnly) {
              sanitized = AppUtils.sanitizeObject(account.toShortObject());
            }
            return this.accountsDb
              .doc(account.getId())
              .set(sanitized).then(() => resolve((new Account()).toObject(account)))
              .catch((error) => reject(error));
          }
          return reject("can not save account, validation failed");
        }
        const existing = await this.getAccountByLabel(account.getLabel());
        if (existing) {
          // overwrite existing account
          // this is dangerous if the existing version is ahead of current version
          const savedAcc: any = this.saveAccount(account, true);
          return resolve(savedAcc);
        }
        const bs = await this.beforeSave(account);
        if (bs) {
          let toSanitize = account;
          if (parentOnly) {
            toSanitize = account.toShortObject();
          }
          return this.accountsDb.add(AppUtils.sanitizeObject(toSanitize))
            .then((result) => {
              const newAccount = (new Account()).toObject(account);
              newAccount.setId(result.id);
              account.getSettings().setAccountId(newAccount.getId());
              account.getSettings().setAccountLabel(newAccount.getLabel());
              return resolve(newAccount);
            }).catch((error) => reject(error));
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  getAccountsById = (id: any, limit = 1, idName = "id") => {
    return new Promise<Account[]>((resolve, reject) => {
      if (!AppUtils.stringIsSet(id)) {
        return reject(`can not retrieve accounts, empty ${idName}`);
      }
      let queryFn = this.accountsDb.where(idName, "==", id);
      if (limit > 0) {
        queryFn = queryFn.limit(limit);
      }
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const accounts = snap.docs.map((doc) => {
          const entity = new Account().toObject(doc.data());
          entity.setId(doc.id);
          entity.getSettings().setAccountId(entity.getId());
          entity.getSettings().setAccountLabel(entity.getLabel());
          return entity;
        }).sort();
        return resolve(accounts);
      });
    });
  };

  getAccountByLabel(label: string) {
    return new Promise<Account | undefined>((resolve, reject) => {
      return this.getAccountsById(label, 1, "label").then((accounts) => {
        return resolve(accounts[0]);
      }).catch((reason) => reject(reason));
    });
  }

  getAllAccounts() {
    return new Promise<Account[]>((resolve, reject) => {
      return this.accountsDb.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const map = snap.docs.map((doc) => {
          const account = (new Account()).toObject(doc.data());
          account.setId(doc.id);
          account.getSettings().setAccountId(account.getId());
          account.getSettings().setAccountLabel(account.getLabel());
          return account;
        });
        return resolve(map);
      }).catch((reason) => reject(reason));
    });
  }

  getCurrentBranchName() {
    return this.auth.getFirstBranchName();
  }
}
