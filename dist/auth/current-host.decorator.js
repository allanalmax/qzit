"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentHost = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentHost = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
});
//# sourceMappingURL=current-host.decorator.js.map