import { Injectable } from "@nestjs/common";
import {
  AppRoutes,
  AppUser,
  AppUtils,
  DefaultPhoto,
  FirestoreQuery,
  HarsherUtils,
  RippleUtils,
  Role,
  Sex,
  User
} from "../lib";
import { FireBase } from "../firebase";
import { DefaultUser } from "./defaultUsers";
import { UserCreatedEvent, UserDeletedEvent, UserEvents, UserUpdatedEvent } from "../events/users";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class UsersService {
  private usersDb = FireBase.getCollection(AppRoutes.users.api.INDEX);
  private users: User[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  findOrCreateUser(userName: string) {
    return new Promise<User | null>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(userName)) {
          return resolve(null);
        }
        const existing = this.findUserByName(userName, false);
        if (existing) {
          return resolve(existing);
        }
        // new user with that name
        const newUser = new User();
        const names = userName.split(" ");
        const hasFName = names.length === 1;
        const hasLName = names.length === 2;
        const hasOtherNames = names.length === 3;
        if (hasOtherNames) {
          newUser.setFName(names[0]);
          newUser.setLName(names[1]);
          newUser.setOtherNames(names[2]);
        } else if (hasLName) {
          newUser.setFName(names[0]);
          newUser.setLName(names[1]);
        } else if (hasFName) {
          newUser.setFName(names[0]);
        }
        const encryptedPassword = HarsherUtils.encrypt(newUser.getName(), 0);
        newUser.setPassword(encryptedPassword);
        newUser.setRepeatPassword("");
        const email = names.map((n) => n.toString().trim()).join("").concat("@eripplesoutions.com");
        newUser.setEmail(email);
        const savedUser = await this.saveUser(newUser);
        return resolve(savedUser);
      } catch (e) {
        return reject(e);
      }
    });
  }

  findOrCreateSystemUser() {
    return new Promise<User | null>(async (resolve, reject) => {
      try {
        let existing = this.findUserByName(AppUser.NAME);
        if (existing) {
          return resolve(existing);
        }
        existing = this.findUserByEmail(AppUser.EMAIL);
        if (existing) {
          return resolve(existing);
        }
        // new user with that name
        const newUser = new User();
        newUser.setFName(AppUser.FNAME);
        newUser.setLName(AppUser.LNAME);
        const encryptedPassword = HarsherUtils.encrypt(newUser.getName(), 0);
        newUser.setPassword(encryptedPassword);
        newUser.setRepeatPassword("");
        newUser.setEmail(AppUser.EMAIL);
        const savedUser = await this.saveUser(newUser);
        return resolve(savedUser);
      } catch (e) {
        return reject(e);
      }
    });
  }

  findUserByName(userName: string, caseSensitive = true) {
    return new Promise<User | null>((resolve, reject) => {
      if (AppUtils.hasElements(this.users)) {
        const user = this.users.find((user) => {
          let name = caseSensitive ? user.getName() : user.getName().toLocaleLowerCase();
          let toComp = caseSensitive ? userName : userName.toLocaleLowerCase();
          if (name === toComp) {
            return true;
          }
          // compare f name and l name
          const names = userName.split(" ");
          const hasFName = names.length === 1;
          const hasLName = names.length === 2;
          const hasOtherNames = names.length === 3;
          if (hasOtherNames) {
            const compFName = user.getFName().toLocaleLowerCase() === names[0].toLocaleLowerCase() &&
              user.getLName().toLocaleLowerCase() === names[1].toLocaleLowerCase();
            const compLName = user.getFName().toLocaleLowerCase() === names[1].toLocaleLowerCase() &&
              user.getLName().toLocaleLowerCase() === names[0].toLocaleLowerCase();
            if (!(compFName || compLName)) {
              return false;
            }
            const compOName = user.getOtherNames().toLocaleLowerCase() === names[3].toLocaleLowerCase();
            if (compOName) {
              return true;
            }
          }
          if (hasLName) {
            const compFName = user.getFName().toLocaleLowerCase() === names[0].toLocaleLowerCase() &&
              user.getLName().toLocaleLowerCase() === names[1].toLocaleLowerCase();
            const compLName = user.getFName().toLocaleLowerCase() === names[1].toLocaleLowerCase() &&
              user.getLName().toLocaleLowerCase() === names[0].toLocaleLowerCase();
            if (compFName || compLName) {
              return true;
            }
          }
          if (hasFName) {
            const compFName = user.getFName().toLocaleLowerCase() === names[0].toLocaleLowerCase();
            const compLName = user.getLName().toLocaleLowerCase() === names[0].toLocaleLowerCase();
            if (compFName || compLName) {
              return true;
            }
          }
          return false;
        });
        return resolve(user || null);
      }
      return this.getUsersByOptions({}).then((users) => {
        const user = users.find((user) => user.getName() === userName);
        return resolve(user || null);
      }).catch((reason) => reject(reason));
    });
  }

  findUserByEmail(userEmail: string) {
    return new Promise<User | null>((resolve, reject) => {
      if (AppUtils.hasElements(this.users)) {
        const user = this.users.find((user) => user.getEmail() === userEmail);
        return resolve(user || null);
      }
      return this.getUsersByOptions({}).then((users) => {
        const user = users.find((user) => user.getEmail() === userEmail);
        return resolve(user || null);
      }).catch((reason) => reject(reason));
    });
  }

  getUserById(id: string) {
    return new Promise<User | null>((resolve, reject) => {
      if (typeof id === "object") {
        return reject(`unsupported user record identifier, contact admin`);
      }
      if (!AppUtils.stringIsSet(id)) {
        return reject("provide user identifier");
      }
      if (this.users.length > 0) {
        const user = this.users.find((us) => us.getId() === id);
        if (user) {
          return resolve(user);
        }
      }
      return this.usersDb.doc(id).get().then((snapshot) => {
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const user = (new User()).toObject(rawData);
          user.setId(snapshot.id);
          return resolve(user);
        }
        return resolve(null);
      }).catch((error) => reject(error));
    });
  }

  getUsersById = (id: any, limit = 1, idName = "id") => {
    return new Promise<User[]>((resolve, reject) => {
      if (!id) {
        return reject(`provide ${idName} and try again`);
      }
      if (this.users.length > 0) {
        const users = this.users.filter((us) => AppUtils.sanitizeObject(us)[idName] === id);
        if (AppUtils.hasElements(users)) {
          return resolve(users);
        }
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
  };
  getUserFromDefaultUser = (defaultUser: DefaultUser, roles: Role[], usePin = false) => {
    const user = new User();
    user.setFName(defaultUser.fName || defaultUser.name);
    user.setLName(defaultUser.lName || "");
    user.setEmail(defaultUser.email);
    const role = roles.find((anotherRole) => anotherRole.getName() === defaultUser.userGroup);
    if (role) {
      user.setRole(role);
    }
    const phoneNo = defaultUser.phoneNo.replace("-", "");
    /*const pin = phoneNo.substring(phoneNo.length - 5, phoneNo.length); // take last 5 digits
    if (!user.isAdmin()) {
        user.setPin(defaultUser.pin);
        user.setPassword(harsherUtils.encrypt(defaultUser.password));
    } else {
        user.setPin(defaultUser.pin);
        user.setPassword(harsherUtils.encrypt(defaultUser.password));
    }*/
    user.setPin(defaultUser.pin.substring(0, 5));
    if (usePin) {
      user.setPassword(HarsherUtils.encrypt(defaultUser.password));
    } else {
      user.setPassword(defaultUser.password);
    }
    user.setPhoneNo(phoneNo);
    user.setSex(defaultUser.sex);
    if (defaultUser.photo && defaultUser.photo.length > 0) {
      user.setPhoto(defaultUser.photo);
    } else {
      if (defaultUser.sex === Sex.MALE) {
        user.setPhoto(DefaultPhoto.MALE);
      } else {
        user.setPhoto(DefaultPhoto.FEMALE);
      }
    }
    user.setUser("system");
    user.logOut();
    return user;
  };

  saveManyUsers = (users: User[], emitEvents = true) => {
    return new Promise<boolean>((resolve, reject) => {
      if (users.length === 0) {
        return reject("select users and try again");
      }
      let batch: any = this.usersDb.firestore.batch();
      const createdUsers: User[] = [];
      const updatedUsers: User[] = [];
      users.forEach((user) => {
        if (user.getId()) {
          batch = batch.set(this.usersDb.doc(user.getId()), RippleUtils.sanitizeObject(user));
          updatedUsers.push(user);
        } else {
          batch = batch.create(this.usersDb.doc(), RippleUtils.sanitizeObject(user));
          createdUsers.push(user);
        }
      });
      return batch.commit().then((result: any) => {
        if (emitEvents) {
          createdUsers.forEach((user) => {
            this.eventEmitter.emit(UserEvents.CREATE, new UserCreatedEvent(
              user.getEmail(),
              user.getPassword(),
              user.getName(),
              user.getPhoneNo(),
              user.getPhoto()
            ));
          });
          updatedUsers.forEach((user) => {
            this.eventEmitter.emit(UserEvents.UPDATE, new UserUpdatedEvent(
              user.getEmail(), // set email before
              user.getEmail(),
              user.getPassword(),
              user.getName(),
              user.getPhoneNo(),
              user.getPhoto()
            ));
          });
        }
        this.users.splice(0);
        return resolve(result.length === users.length);
      })
        .catch((error: any) => {
          FireBase.log(error);
          return resolve(false);
        });
    });
  };
  deleteManyUsers = (users: User[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (users.length === 0) {
        return reject("select users and try again");
      }
      let batch = this.usersDb.firestore.batch();
      users.forEach((user) => {
        if (user.getId()) {
          batch = batch.delete(this.usersDb.doc(user.getId()));
        }
      });
      return batch.commit().then((result) => {
        users.forEach((user) => {
          this.eventEmitter.emit(UserEvents.DELETE, new UserDeletedEvent(user.getEmail()));
          if (AppUtils.stringIsSet(user.getId())) {
            const index = this.users.findIndex((prd) => prd.getId() === user.getId());
            if (index > -1) {
              this.users.splice(index, 1);
            }
          }
        });
        return resolve(result.length === users.length);
      }).catch((error) => reject(error));
    });
  };

  saveUser(user: User, emailBefore?: string) {
    return new Promise<User>((resolve, reject) => {
      if (user.getId()) {
        return this.usersDb.doc(user.getId())
          .set(AppUtils.sanitizeObject(user))
          .then(() => {
            const oldUser = (new User()).toObject(user);
            const oldIndex = this.users.findIndex((us) => us.getId() === oldUser.getId());
            if (oldIndex > -1) {
              this.users[oldIndex] = oldUser;
            } else {
              this.users.push(oldUser);
            }
            this.eventEmitter.emit(UserEvents.UPDATE, new UserUpdatedEvent(
              emailBefore || user.getEmail(),
              user.getEmail(),
              user.getPassword(),
              user.getName(),
              user.getPhoneNo(),
              user.getPhoto()
            ));
            return resolve(oldUser);
          })
          .catch((error) => reject(error));
      }
      return this.usersDb.add(AppUtils.sanitizeObject(user))
        .then((result) => {
          this.eventEmitter.emit(UserEvents.CREATE, new UserCreatedEvent(
            user.getEmail(),
            user.getPassword(),
            user.getName(),
            user.getPhoneNo(),
            user.getPhoto()
          ));
          const newUser = (new User()).toObject(user);
          newUser.setId(result.id);
          this.users.push(newUser);
          return resolve(newUser);
        }).catch((error) => reject(error));
    });
  }

  getUsers(set?: Set<FirestoreQuery>, refresh = false) {
    return new Promise<User[]>((resolve, reject) => {
      if (!set) {
        if (refresh) {
          this.users.splice(0);
        }
        if (this.hasUsers()) {
          console.log(`\n------------using existing ${this.users.length} users---------------\n`);
          return resolve(this.users);
        }
      }
      return FireBase.getQueryReference(this.usersDb, set).get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const users = snap.docs.map((doc) => {
          const user = (new User()).toObject(doc.data());
          user.setId(doc.id);
          return user;
        });
        if (!set) {
          this.users = users;
        }
        return resolve(users);
      }).catch((reason) => reject(reason));
    });
  }

  hasUsers() {
    return this.users.length > 0;
  }

  getUsersByOptions(options: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<User[]>((resolve, reject) => {
      if (!AppUtils.hasResponse(options) && this.hasUsers()) {
        console.log(`\n------------using existing ${this.users.length} users---------------\n`);
        return resolve(this.users);
      }
      let queryFn = this.usersDb.orderBy("created");
      const set = new Set<FirestoreQuery>();
      // Only a single array-contains clause is allowed in a query
      if (options.merchandiserId !== undefined) {
        queryFn = queryFn.where("merchandiserIds", "array-contains", options.merchandiserId);
      }
      if (options.supermarketId !== undefined) {
        queryFn = queryFn.where("supermarketIds", "array-contains", options.supermarketId);
      }
      if (AppUtils.stringIsSet(options.modifiedBy)) {
        set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
      }
      if (AppUtils.stringIsSet(options.date)) {
        const operator = options.dateOperator || "==";
        set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
      }
      queryFn = FireBase.getQueryReference(queryFn, set);
      if (options.startDate && options.endDate) {
        queryFn = FireBase.getEntitiesByDateRange(queryFn,
          options.startDate,
          options.endDate,
          true, "created");
      }
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const users: User[] = snap.docs.map((doc) => {
          const user = new User().toObject(doc.data());
          user.setId(doc.id);
          return user;
        });
        if (!AppUtils.hasResponse(options)) {
          this.users = users;
        }
        return resolve(users);
      }).catch((reason) => reject(reason));
    });
  }
}
