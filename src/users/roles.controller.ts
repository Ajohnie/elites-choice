import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { AppUtils, Role } from "../lib";
import { UsersService } from "./users.service";
import { Converter } from "../converter";

@Controller("roles")
export class RolesController {
  constructor(private readonly service: RolesService,
              private readonly usersService: UsersService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>((resolve, reject) => {
      const roleObject = Converter.fromBody(body);
      if (!roleObject) {
        return reject("Please set role and try again !");
      }
      const toSave = (new Role()).toObject(roleObject);
      return this.service.saveRole(toSave)
        .then((saved) => resolve(AppUtils.sanitizeObject(saved)))
        .catch((reason) => reject(reason));
    });
  }

  @Get("findAll")
  findAll() {
    return new Promise<any[]>((resolve, reject) => {
      return this.service.findAll()
        .then((roles) => resolve(AppUtils.sanitizeObject(roles)))
        .catch((reason) => reject(reason));
    });
  }

  @Delete(":id")
  remove(@Query("roleId") roleId: string) {
    return new Promise<boolean>((resolve, reject) => {
      if (!AppUtils.stringIsSet(roleId)) {
        return reject("Please specify role identifier and try again !");
      }
      return this.service.getRoleById(roleId).then((role) => {
        if (!role) {
          return reject("Role not found or was removed !");
        }
        return this.usersService.getUsers().then((users) => {
          const usersExist = users.find((user) => user.getRole().isSameAs(role));
          if (usersExist) {
            return reject("users with this group exist, reassign users");
          }
          return this.service.deleteManyRoles([role])
            .then((removed) => resolve(removed))
            .catch((reason: any) => reject(reason));
        }).catch((reason: any) => reject(reason));
      }).catch((reason: any) => reject(reason));
    });
  }
}
