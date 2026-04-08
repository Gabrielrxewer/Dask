import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import type { IdentityRepository } from '@/modules/identity/repositories/identity-repository';

export class AuthService {
  public constructor(private readonly identityRepository: IdentityRepository) {}

  public async register(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ accessToken: string }> {
    const existing = await this.identityRepository.findUserByEmail(input.email);
    if (existing) {
      throw new AppError('E-mail already in use', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.identityRepository.createUser({
      email: input.email,
      name: input.name,
      passwordHash
    });
    const token = await this.issueToken(user.id, user.email);
    return { accessToken: token };
  }

  public async login(input: { email: string; password: string }): Promise<{ accessToken: string }> {
    const user = await this.identityRepository.findUserByEmail(input.email);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = await this.issueToken(user.id, user.email);
    return { accessToken: token };
  }

  private async issueToken(userId: string, email: string): Promise<string> {
    const roles = await this.identityRepository.getUserRoles(userId);
    const options: jwt.SignOptions = {
      subject: userId,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    };
    return jwt.sign({ email, roles }, env.JWT_SECRET, options);
  }
}
