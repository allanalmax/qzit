import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.fromAddress = config.getOrThrow<string>('RESEND_FROM');
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const existing = await this.prisma.host.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      const host = await this.prisma.host.create({
        data: { email: dto.email, passwordHash },
      });
      return { accessToken: this.sign(host.id, host.email) };
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const host = await this.prisma.host.findUnique({
      where: { email: dto.email },
    });
    if (!host) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, host.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { accessToken: this.sign(host.id, host.email) };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const host = await this.prisma.host.findUnique({
      where: { email: dto.email },
    });

    // Always respond the same way to avoid leaking whether an email exists
    if (!host) return;

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

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const host = await this.prisma.host.findUnique({
      where: { resetToken: hashedToken },
    });

    if (!host || !host.resetTokenExpiresAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (host.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
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

  private sign(hostId: string, email: string): string {
    return this.jwt.sign({ sub: hostId, email });
  }
}
