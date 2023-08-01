import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { AppUtils, Branch } from "../lib";
import { Converter } from "../converter";

@Controller("branches")
export class BranchesController {
  constructor(private readonly service: BranchesService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>((resolve, reject) => {
      const bodyObj = Converter.fromBody(body);
      const obj = bodyObj.branch;
      if (!obj) {
        return reject("Please set branch and try again !");
      }
      const branch = new Branch().toObject(obj);
      if (!AppUtils.stringIsSet(branch.userId)) {
        return reject("Please login and try again !");
      }
      return this.service.save(branch)
        .then((sup) => resolve(AppUtils.sanitizeObject(sup)))
        .catch((reason) => reject(reason));
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>((resolve, reject) => {
      return this.service.getBranchesByOptions(options || {})
        .then((branches) => {
          return resolve(branches);
        }).catch((reason) => reject(reason));
    });
  }

  @Delete("delete")
  remove(@Query("branchId") branchId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(branchId)) {
          return reject("select branch and try again");
        }
        // check for consignments, products etc
        return this.service.deleteManyBranches([branchId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
