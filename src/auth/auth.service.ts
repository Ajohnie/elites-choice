import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, User } from "../lib";
import { FireBase } from "../firebase";

@Injectable()
export class AuthService {
  private user: User = new User();
  private usersDb = FireBase.getCollection(AppRoutes.users.api.INDEX);

  constructor() {
  }

  setUserFromUid(uid: string) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(uid)) {
          return reject("can not update current user profile, empty UID");
        }
        const record = await FireBase.auth().getUser(uid);
        if (!record) {
          return reject("can not update current user profile, user record was not found");
        }
        const email = record.email || "";
        const user = await this.getUserByEmail(email);
        if (!user) {
          return reject(`can not update current user profile, user with email ${email} was not found`);
        }
        this.user = user;
        return resolve();
      } catch (e) {
        return reject(e);
      }
    });
  }

  setUserFromEmail(email: string) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(email)) {
          return reject("can not update current user profile, empty email");
        }
        const user = await this.getUserByEmail(email);
        if (!user) {
          return reject(`can not update current user profile, user with email ${email} was not found`);
        }
        this.user = user;
        return resolve();
      } catch (e) {
        return reject(e);
      }
    });
  }

  getUserByEmail(email: string) {
    return new Promise<User | undefined>((resolve, reject) => {
      if (!AppUtils.stringIsSet(email)) {
        return reject(`can not update current user profile, email is empty`);
      }
      return this.getUsersById(email, 1, "email")
        .then((users) => resolve(users[0]))
        .catch((reason) => reject(reason));
    });
  }

  getUsersById = (id: any, limit = 1, idName = "id") => {
    return new Promise<User[]>((resolve, reject) => {
      if (!AppUtils.stringIsSet(id)) {
        return reject(`can not update current user profile, empty ${idName}`);
      }
      let queryFn = this.usersDb.where(idName, "==", id);
      if (limit > 0) {
        queryFn = queryFn.limit(limit);
      }
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const users = snap.docs.map((doc) => {
          const entity = new User().toObject(doc.data());
          entity.setId(doc.id);
          return entity;
        }).sort();
        return resolve(users);
      });
    });
  }

  getUser() {
    return this.user;
  }

  getFirstBranch() {
    return this.user.getFirstBranch();
  }

  getFirstBranchName() {
    return this.user.getFirstBranch().getName();
  }
}
