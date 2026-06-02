"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const resend_1 = require("resend");
const library_1 = require("@prisma/client/runtime/library");
const prisma_service_1 = require("../prisma/prisma.service");
const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    resend;
    fromAddress;
    appUrl;
    constructor(prisma, jwt, config) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.resend = new resend_1.Resend(config.getOrThrow('RESEND_API_KEY'));
        this.fromAddress = config.getOrThrow('RESEND_FROM');
        this.appUrl = config.getOrThrow('APP_URL');
    }
    async register(dto) {
        const existing = await this.prisma.host.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw new common_1.ConflictException('Email already in use');
        }
        const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        try {
            const host = await this.prisma.host.create({
                data: { email: dto.email, passwordHash },
            });
            return { accessToken: this.sign(host.id, host.email) };
        }
        catch (err) {
            if (err instanceof library_1.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('Email already in use');
            }
            throw err;
        }
    }
    async login(dto) {
        const host = await this.prisma.host.findUnique({
            where: { email: dto.email },
        });
        if (!host) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const valid = await bcrypt.compare(dto.password, host.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return { accessToken: this.sign(host.id, host.email) };
    }
    async forgotPassword(dto) {
        const host = await this.prisma.host.findUnique({
            where: { email: dto.email },
        });
        if (!host)
            return;
        const plainToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
            .createHash('sha256')
            .update(plainToken)
            .digest('hex');
        await this.prisma.host.update({
            where: { id: host.id },
            data: {
                resetToken: hashedToken,
                resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
            },
        });
        const resetUrl = `${this.appUrl}/reset-password?token=${plainToken}`;
        await this.resend.emails.send({
            from: this.fromAddress,
            to: host.email,
            subject: 'Reset your QZIT password',
            html: `
        <p>You requested a password reset for your QZIT account.</p>
        <p>
          <a href="${resetUrl}">Click here to reset your password</a>
        </p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      `,
        });
    }
    async resetPassword(dto) {
        const hashedToken = crypto
            .createHash('sha256')
            .update(dto.token)
            .digest('hex');
        const host = await this.prisma.host.findUnique({
            where: { resetToken: hashedToken },
        });
        if (!host || !host.resetTokenExpiresAt) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        if (host.resetTokenExpiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        await this.prisma.host.update({
            where: { id: host.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiresAt: null,
            },
        });
    }
    sign(hostId, email) {
        return this.jwt.sign({ sub: hostId, email });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map