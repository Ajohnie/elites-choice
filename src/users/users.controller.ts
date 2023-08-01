import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { UsersService } from "./users.service";
import {
  AppRoutes,
  AppUtils,
  FirestoreQuery,
  HarsherUtils,
  Permission,
  RippleUtils,
  User,
  UserGroup,
  UserLog
} from "../lib";
import { defaultAdminUser, defaultUsers } from "./defaultUsers";
import { FireBase } from "../firebase";
import { SysLog } from "./sys-log";
import { RolesService } from "./roles.service";
import { Converter } from "../converter";
import { GuestLoginEvent, UserEvents } from "../events/users";
import { EventEmitter2 } from "@nestjs/event-emitter";

const SALT_NO = 0;

@Controller("users")
export class UsersController {
  constructor(private readonly rolesService: RolesService,
              private readonly service: UsersService,
              private eventEmitter: EventEmitter2) {
  }

  @Get("getCustomToken")
  getCustomToken(@Query() params: any) {
    return new Promise<string>((resolve, reject) => {
      const password = params.password;
      const usePin = params.usePin;
      const userId = params.userId;
      if (usePin) {
        return this.getUserFromPin(password).then((user) => {
          if (!user) {
            return reject("user not found");
          }
          user.setUid(userId);
          return this.createToken(password, user)
            .then((token) => resolve(token))
            .catch((reason: any) => reject(reason));
        }).catch((reason: any) => reject(reason));
      } else {
        const email = params.username;
        return this.getUserFromEmail(email).then((user) => {
          if (!user) {
            return reject("user not found");
          }
          user.setUid(userId);
          // authenticate pass word or sign in with email and password on the front end
          return this.createToken(email, user)
            .then((token) => resolve(token))
            .catch((reason: any) => reject(reason));
        }).catch((reason: any) => reject(reason));
      }
    });
  }

  @Post("verifyOtp")
  verifyOtp(@Body() body: any) {
    return new Promise<boolean>((resolve, reject) => {
      const bodyObj = Converter.fromBody(body);
      const { otp, email } = bodyObj;
      if (!AppUtils.stringIsSet(otp)) {
        return reject("Please enter OTP sent to your email and try again !");
      }
      if (!AppUtils.isEmail(email)) {
        return reject("Please login with a valid email and try again !");
      }
      return this.getUserFromEmail(email).then((user) => {
        if (!user) {
          return reject(`user with email ${email} was not found or was removed`);
        }
        if (!user.isOtp(otp)) {
          return reject(`the OTP ${otp} you entered is invalid, login and try again`);
        }
        // user.setOtp("", new Date());// clear otp
        return this.logInUser(user)
          .then(() => resolve(true))
          .catch((reason: any) => reject(reason));
      }).catch((reason: any) => reject(reason));
    });
  }

  @Get("getUserByPin")
  getUserByPin(@Query() params: any) {
    return new Promise<User>((resolve, reject) => {
      const password = params.password;
      let usePin = params.usePin;
      if (typeof params.usePin === "string") {
        usePin = usePin === "true";
      }
      const userId = params.userId;
      if (usePin) {
        return this.getUserFromPin(password).then((user) => {
          if (!user) {
            return reject("user not found");
          }
          if (user.isGuest() && user.otpExpired()) {
            this.eventEmitter.emit(UserEvents.GUEST_LOGIN, new GuestLoginEvent(user.getId()));
            return resolve(user);
          }
          return this.logInUser(user, userId)
            .then((value) => resolve(value))
            .catch((reason: any) => reject(reason));
        }).catch((reason: any) => reject(reason));
      } else {
        const email = params.username;
        return this.getUserFromEmail(email).then((user) => {
          if (!user) {
            return reject("user not found");
          }
          user.setUid(userId);
          if (user.isGuest() && user.otpExpired()) {
            this.eventEmitter.emit(UserEvents.GUEST_LOGIN, new GuestLoginEvent(user.getId()));
            return resolve(user);
          }
          return this.logInUser(user, userId)
            .then((value) => resolve(value))
            .catch((reason: any) => reject(reason));
        }).catch((reason: any) => reject(reason));
      }
    });
  };

  @Get("getRoleByEmail")
  getRoleByEmail(@Query("email") email: any) {
    return new Promise<any>((resolve, reject) => {
      if (!AppUtils.stringIsSet(email)) {
        return reject("unknown user email selected");
      }
      return this.getUserFromEmail(email).then((user) => {
        this.logInUser(user).then(() => {
          return resolve({
            userId: user.getId(),
            role: user.getRoleName(),
            phoneNo: user.getPhoneNo(),
            photo: user.getPhoto(),
            name: user.getName(),
            displayName: user.getFName(),
            sex: user.getSex()
          });
        }).catch((reason) => reject(reason));
      }).catch((reason) => reject(reason));
    });
  }

  @Get("getRoleById")
  getRoleById(@Query("userId") userId: any) {
    return new Promise<any>((resolve, reject) => {
      if (!AppUtils.stringIsSet(userId)) {
        return reject("unknown user selected");
      }
      return this.service.getUserById(userId).then((user) => {
        if (!user) {
          return reject("unknown user selected");
        }
        this.logInUser(user).then(() => {
          return resolve({
            userId: user.getId(),
            role: user.getRoleName(),
            phoneNo: user.getPhoneNo(),
            photo: user.getPhoto(),
            name: user.getName(),
            displayName: user.getFName(),
            sex: user.getSex()
          });
        }).catch((reason) => reject(reason));
      }).catch((reason) => reject(reason));
    });
  }

  @Get("logOutUser")
  logOutUser(@Query() params: any) {
    return new Promise<boolean>((resolve, reject) => {
      const userId = params.userId;
      if (!userId) {
        return resolve(true);
      }
      const lastRoutePath = params.lastRoutePath || "";
      return this.service.getUserById(userId).then((user) => {
        if (user) {
          user.logOut();
          user.setLastRoutePath(lastRoutePath);
          user.setToken("");
          return this.service.saveUser(user)
            .then(() => {
              // this.efris.setPassword(null);
              return resolve(true);
            })
            .catch((reason: any) => reject(reason));
        }
        return reject("incorrect username or password !");
      }).catch((reason: any) => reject(reason));
    });
  }

  @Get("changeUserBranch")
  changeUserBranch(@Query() params: any) {
    const options: any = params || {};
    const branchOffice = options.branchOffice;
    const userId = options.userId;
    return new Promise<boolean>((resolve, reject) => {
      if (!branchOffice) {
        return reject("Unknown branch, contact admin!");
      }
      if (!userId) {
        return reject("set user ID and try again!");
      }
      return this.getUserByUid(userId).then((toSave) => {
        if (!toSave) {
          return reject("unknown user, login and try again!");
        }
        // first rest branch permissions
        toSave.getRole().getBranches().forEach((branch) => {
          branch.setAsDefault(false);
          branch.setAllowed(false);
        });
        toSave.getRole().setDefaultBranch(branchOffice);
        return this.service.saveUser(toSave).then((saved) => {
          if (saved) {
            return resolve(true);
          }
          return reject("unable to change branch, try again later");
        }).catch((reason) => reject(reason));
      });
    });
  }

  @Get("loadUserLog")
  loadUserLogs(@Query() params: any) {
    return new Promise<UserLog[]>((resolve, reject) => {
      const options: any = params || {};
      return SysLog.getUserLogByOptions(options)
        .then((log) => resolve(log))
        .catch((reason: any) => reject(reason));
    });
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<User>((resolve, reject) => {
      const userObject = Converter.fromBody(body);
      if (!userObject) {
        return reject("Please set user and try again !");
      }
      const toSave = (new User()).toObject(userObject);
      return this.service.getUsers().then((users) => {
        const phoneNo = toSave.getPhoneNo();
        const hasPhoneNo = RippleUtils.stringIsSet(phoneNo);
        if (!hasPhoneNo) {
          return reject("set phone No and try again !");
        }
        const phoneNoExists = hasPhoneNo && users.find((u) => u.isPhoneNoSimilar(phoneNo));
        if (phoneNoExists) {
          // check if existing user is being edited
          const sameId = phoneNoExists.getId() === toSave.getId();
          if (!sameId) {
            return reject("phone No already exists !");
          }
        }
        const hasPin = RippleUtils.stringIsSet(toSave.getPin());
        if (!hasPin) {
          /*plain pin will default to the last 5 digits of their phone no*/
          const newPin = phoneNo.replace(/-/g, "").substring(phoneNo.length - 7, phoneNo.length);
          toSave.setRepeatPin(newPin);
        }
        const hasPassword = RippleUtils.stringIsSet(toSave.getPassword());
        if (!hasPassword) {
          const newPassword = phoneNo.replace(/-/g, "");
          /*plain password will default to their phone no*/
          toSave.setRepeatPassword(newPassword);
        }
        const exists = users.find((u) => u.isEmailSimilar(toSave.getEmail()));
        let emailBefore = toSave.getEmail();
        if (exists) {
          emailBefore = exists.getEmail();
          // check if existing user is being edited
          const idIsSame = exists.getId() === toSave.getId();
          if (!idIsSame) {
            return reject("email already exists !");
          }
        }
        const pinExists = hasPin && users.find((u) => u.isPinSimilar(toSave.getPin()));
        if (pinExists) {
          // check if existing user is being edited
          const sameId = pinExists.getId() === toSave.getId();
          if (!sameId) {
            return reject("pin already exists !");
          }
        }
        const passwordWasChanged = toSave.getRepeatPassword().length > 0;
        if (passwordWasChanged) {
          // const encryptedPassword = toSave.getRepeatPassword();
          const encryptedPassword = HarsherUtils.encrypt(toSave.getRepeatPassword(), SALT_NO);
          toSave.setPassword(encryptedPassword);
          toSave.setRepeatPassword("");
        }
        const pinWasChanged = toSave.getRepeatPin().length > 0;
        if (pinWasChanged) {
          const encryptedPin = toSave.getRepeatPin(); // this.harsher.encrypt(user.getRepeatPin(), this.auth.getSalt());
          toSave.setPin(encryptedPin);
          toSave.setRepeatPin(""); // clear repeat pin
        }
        toSave.setToken(""); // clear so that document is below 1mb
        return this.service.saveUser(toSave, emailBefore)
          .then((saved) => resolve(saved))
          .catch((reason: any) => reject(reason));
      }).catch((reason: any) => reject(reason));
    });
  }

  @Get("findAll")
  findAll(@Query() params: any) {
    const refresh = (params?.refresh || "false")?.toString() === "true";
    return this.service.getUsers(undefined, refresh);
  }

  @Delete("delete")
  remove(@Query("userId") userId: string) {
    return new Promise<boolean>((resolve, reject) => {
      if (!userId) {
        return reject("Please specify user identifier and try again !");
      }
      return this.service.getUserById(userId).then((user) => {
        if (!user) {
          return reject("User not found or was removed !");
        }
        if (user.isLoggedIn()) {
          return reject("user is currently logged in, they will not be able to log out");
        }
        return this.service.deleteManyUsers([user])
          .then((removed) => {
            return resolve(removed);
          }).catch((reason: any) => reject(reason));
        /*return this.service.deleteManyUsers([user])
          .then((removed) => {
            return this.service.getUsersByOptions({}).then((allUsers) => {
              const email1 = "nkwasibweosbert@eripplesoutions.com";
              const email2 = "ayebazibwemodern@eripplesoutions.com";
              const toDel = allUsers.filter((user) => {
                return user.getEmail().toLocaleLowerCase() === email1 || user.getEmail().toLocaleLowerCase() === email2;
              });
              return this.service.deleteManyUsers(toDel).then(() => {
                return resolve(removed);
              }).catch((reason) => reject(reason));
            });
          })
          .catch((reason: any) => reject(reason));*/
      }).catch((reason: any) => reject(reason));
    });
  }

  getDefaultUsers(usePin = false) {
    return new Promise<User[]>((resolve, reject) => {
      return this.service.getUsers().then((users) => {
        if (users.length === 0) {
          return this.rolesService.getDefaultRoles().then((roles) => {
            const otherUsers: User[] = defaultUsers.map((defaultUser) => {
              const user = this.service.getUserFromDefaultUser(defaultUser, roles, usePin);
              const permissions: Permission[] = AppRoutes.routePaths.map((path) => {
                const permission = new Permission().fromRoutePath(path);
                permission.setAllowed(true);
                return permission;
              });
              user.getRole().setPermissions(permissions);
              return user;
            });
            return this.service.saveManyUsers(otherUsers).then(() => {
              return resolve(otherUsers);
            }).catch((reason: any) => reject(reason));
          }).catch((reason: any) => reject(reason));
        }
        return resolve(users);
      }).catch((reason: any) => reject(reason));
    });
  };

  createToken(param: string, user: any) {
    return new Promise<any>((resolve, reject) => {
      return FireBase.auth().createCustomToken(param, { uid: user.id })
        .then((token) => {
          return this.logInUser(user).then(() => {
            // send them separately since combining them might be larger than 1mb, then user wont be saved
            return resolve({ user, token });
          });
        }).catch((error) => reject(error));
    });
  }

  logInUser(user: User, uid?: any) {
    return new Promise<User>((resolve, reject) => {
      user.logIn();
      user.setToken("");
      if (uid) {
        user.setUid(uid);
      }
      return this.service.saveUser(user)
        .then((result) => resolve(result))
        .catch((reason) => reject(reason));
    });
  }

  getUserFromEmail(email: string) {
    return new Promise<User>((resolve, reject) => {
      return this.getUserFromUserField(email, "email")
        .then((value) => resolve(value)).catch((message) => reject(message));
    });
  }

  getUserFromPin(pin: any) {
    return new Promise<User>((resolve, reject) => {
      return this.getUserFromUserField(pin, "pin")
        .then((value) => resolve(value)).catch((message) => reject(message));
    });
  }

  getUserFromUserField(credentials: any, userField = "pin") {
    const isPin = userField === "pin";
    const isEmail = userField === "email";
    return new Promise<User>((resolve, reject) => {
      if (!RippleUtils.stringIsSet(credentials)) {
        return reject(`please enter correct ${userField} and try again`);
      }
      return FireBase.auth().listUsers(2).then(async (list) => {
        try {
          const noAuthUsers = list.users.length < 2;
          if (noAuthUsers) {
            const query = new Set<FirestoreQuery>();
            if (isEmail) {
              query.add({ key: "email", value: defaultAdminUser.email, operator: "==" });
            } else {
              query.add({ key: "pin", value: defaultAdminUser.pin, operator: "==" });
            }
            const users = await this.service.getUsers(query);
            if (users.length > 1) {
              return reject(`another user with similar ${userField} was found`);
            }
            const defaultExists = users.length === 1;
            if (defaultExists) {
              const value = users[0];
              return resolve(value);
            }
            /*// auth record exists but user collection record not found
            // try searching for user among default users
            return getDefaultUsers().then((defUsers) => {
                const defaultUser = defUsers.find((user: User) => user.getEmail() === email) || null;
                if (!defaultUser) {
                    FireBase.log("Auth Record missing user record, contact admin");
                    return reject("Auth Record missing user record, contact admin");
                }
                return resolve(defaultUser);
            }).catch((reason) => reject(reason));*/
            // add first user
            return this.addFirstUser(userField === "pin").then((saved) => {
              if (isPin && saved.isPinSimilar(credentials)) {
                return resolve(saved);
              }
              if (isEmail && saved.isEmailSimilar(credentials)) {
                return resolve(saved);
              }
              return reject("incorrect username or password !");
            }).catch((reason) => reject(reason));
          }
          const set = new Set<FirestoreQuery>();
          set.add({ key: userField, operator: "==", value: credentials });
          return this.service.getUsers(set).then((users) => {
            const usersNotFound = users.length === 0;
            if (usersNotFound) {
              return reject("incorrect username or password !");
            }
            const duplicatesFound = users.length > 1;
            if (duplicatesFound) {
              return reject("duplicate user found !");
            }
            const value = users[0];
            return resolve(value);
          }).catch((reason) => {
            return reject(reason);
          });
        } catch (e) {
          return reject(e);
        }
      }).catch((reason) => {
        return reject(reason);
      });
    });
  };

  @Get("isPinAuthorized")
  pinIsAuthorized(pin: any, userGroups: UserGroup[] = []) {
    return new Promise<boolean>((resolve, reject) => {
      return this.getUserFromPin(pin).then((user) => {
        if (!user) {
          return resolve(false);
        }
        const groupNotAllowed = userGroups.length > 0 && (userGroups.find((group) => group === user.getUserGroup()) === undefined);
        if (groupNotAllowed) {
          return reject("User belongs to an unauthorized user group");
        }
        return resolve(true);
      }).catch((reason: any) => reject(true));
    });
  }

  @Post("isPasswordAuthorized")
  passwordIsAuthorized(@Body() body: any) {
    return new Promise<any>((resolve, reject) => {
      const params = Converter.fromBody(body);
      if (!params) {
        return reject("Please set email and try again !");
      }
      const email: string = params.email;
      const password: string = params.password;
      const userGroups: any[] = params.userGroups || [];
      return this.getUserFromEmail(email).then((user) => {
        if (!user) {
          return resolve("user not found or was deleted");
        }
        const groupNotAllowed = userGroups.length > 0 && (userGroups.find((group) => group === user.getUserGroup()) === undefined);
        if (groupNotAllowed) {
          return reject("User belongs to an unauthorized user group");
        }
        const pwdMatches = user.getPassword() === password.toString();
        if (!pwdMatches) {
          return reject("Password not recognized");
        }
        return resolve({ valid: true });
      }).catch((reason: any) => reject(reason));
    });
  }

  getUserByUid(userId?: any) {
    return new Promise<User | null>((resolve, reject) => {
      if (!RippleUtils.stringIsSet(userId)) {
        return resolve(null);
      }
      const toDo = FireBase.auth().getUser(userId);
      return toDo.then((record: any) => {
        const email = record?.userId;
        if (!email) {
          return resolve(null);
        }
        const query = new Set<FirestoreQuery>();
        query.add({ key: "email", operator: "==", value: email });
        return this.service.getUsers(query).then((users) => {
          const userFound = users.find((user: User) => user.getEmail() === email);
          if (!userFound) {
            return resolve(null);
          }
          const properties: any = {}; // type of UpdateRequest
          if (!RippleUtils.stringIsSet(record.displayName)) {
            properties["displayName"] = userFound.getName();
          }
          // incorrect phone or photo format triggers firebase auth error
          /*if (!RippleUtils.stringIsSet(record.phoneNo)) {
              properties["phoneNo"] = userFound.getPhoneNo();
          }
          if (!RippleUtils.stringIsSet(record.photoURL)) {
              properties["photoURL"] = userFound.getPhoto();
          }*/
          const userFieldsAlreadySet = Object.getOwnPropertyNames(properties).length === 0;
          if (userFieldsAlreadySet) {
            return resolve(userFound);
          }
          return FireBase.auth().updateUser(userId, properties)
            .then(() => resolve(userFound))
            .catch(() => reject(userFound));
        }).catch((error) => reject(error));
      }).catch((error) => reject(error));
    });
  };

  addFirstUser(usePin = false) {
    return new Promise<User>((resolve, reject) => {
      return this.rolesService.getDefaultRoles().then((roles) => {
        const user = this.service.getUserFromDefaultUser(defaultAdminUser, [], usePin);
        const permissions: Permission[] = AppRoutes.routePaths.map((path) => {
          const permission = new Permission().fromRoutePath(path);
          permission.setAllowed(true);
          return permission;
        });
        const adminRole = roles.find((role) => role.isAdmin());
        if (adminRole) {
          user.setRole(adminRole);
        }
        user.getRole().setPermissions(permissions);
        user.getRole().setBranches(this.rolesService.getDefaultBranches());
        return this.service.saveUser(user).then((saved) => {
          if (!saved) {
            return reject("system was unable to configure users, contact admin");
          }
          return resolve(saved);
        }).catch((reason) => reject(reason));
      });
    });
  };
}
