import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import type { AppRole } from "../../auth/roles.js";

const PASSWORD_MIN_LENGTH = 8;
const SALT_ROUNDS = 12;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPortalPassword(password: string): Promise<string> {
  const trimmed = password.trim();
  if (trimmed.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  return bcrypt.hash(trimmed, SALT_ROUNDS);
}

async function verifyPortalPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

type LoginResult = {
  token: string;
  role: AppRole;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

function signPortalToken(params: { role: AppRole; userId: string; email: string }): string {
  const signOptions: SignOptions = {
    subject: params.userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(
    {
      role: params.role,
      email: params.email
    },
    env.JWT_SECRET,
    signOptions
  );
}

export async function loginPortalUser(params: {
  role: AppRole;
  email: string;
  password: string;
}): Promise<LoginResult> {
  const normalizedEmail = normalizeEmail(params.email);

  if (params.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { email: normalizedEmail }
    });

    if (!doctor || !doctor.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const valid = await verifyPortalPassword(params.password, doctor.passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    if (!doctor.isActive) {
      throw new Error("Doctor account is inactive");
    }

    const token = signPortalToken({
      role: "DOCTOR",
      userId: doctor.id,
      email: doctor.email
    });

    return {
      token,
      role: "DOCTOR",
      user: {
        id: doctor.id,
        email: doctor.email,
        fullName: doctor.fullName
      }
    };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail }
  });

  if (!admin) {
    throw new Error("Invalid credentials");
  }

  const valid = await verifyPortalPassword(params.password, admin.passwordHash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  if (!admin.isActive) {
    throw new Error("Admin account is inactive");
  }

  const token = signPortalToken({
    role: "ADMIN",
    userId: admin.id,
    email: admin.email
  });

  return {
    token,
    role: "ADMIN",
    user: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName
    }
  };
}

export async function getPortalUserByRole(params: {
  role: AppRole;
  userId: string;
}): Promise<{ id: string; email: string; fullName: string; role: AppRole } | null> {
  if (params.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.userId }
    });
    if (!doctor) {
      return null;
    }

    return {
      id: doctor.id,
      email: doctor.email,
      fullName: doctor.fullName,
      role: "DOCTOR"
    };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: params.userId }
  });
  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    role: "ADMIN"
  };
}
