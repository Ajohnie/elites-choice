"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.ProductsService = void 0;
var common_1 = require("@nestjs/common");
var lib_1 = require("../lib");
var UsersService = /** @class */ (function () {
    function ProductsService() {
    }
    ProductsService.prototype.create = function (product) {
        return "This action adds a new product";
    };
    ProductsService.prototype.findAll = function () {
        return new Promise(function (resolve, reject) {
            var products = [
                new lib_1.Product("Movit Herbal Jelly", 1),
                new lib_1.Product("Movit Herbal Soap", 2),
                new lib_1.Product("Movit Herbal Powder", 3)
            ];
            return resolve(products);
        });
    };
    ProductsService.prototype.findOne = function (id) {
        return "This action returns a #".concat(id, " product");
    };
    ProductsService.prototype.update = function (id, product) {
        return "This action updates a #".concat(id, " product");
    };
    ProductsService.prototype.remove = function (id) {
        return "This action removes a #".concat(id, " product");
    };
    ProductsService = __decorate([
        (0, common_1.Injectable)()
    ], ProductsService);
    return ProductsService;
}());
exports.ProductsService = UsersService;
