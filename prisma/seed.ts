import bcrypt from "bcryptjs";
import { PrismaClient, DoctorKycStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

function envValue(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error("Seed password must be at least 8 characters");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function seedAdminUser() {
  const email = envValue("ADMIN_BOOTSTRAP_EMAIL", "admin@wadoctors.local").toLowerCase();
  const fullName = envValue("ADMIN_BOOTSTRAP_NAME", "WAdoctors Admin");
  const password = envValue("ADMIN_BOOTSTRAP_PASSWORD", "ChangeMeNow123!");
  const passwordHash = await hashPassword(password);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      fullName,
      passwordHash,
      isActive: true
    },
    update: {
      fullName,
      passwordHash,
      isActive: true
    }
  });

  return { admin, password };
}

async function seedDoctorUser() {
  const email = envValue("DOCTOR_BOOTSTRAP_EMAIL", "doctor@wadoctors.local").toLowerCase();
  const fullName = envValue("DOCTOR_BOOTSTRAP_NAME", "Dr. Demo");
  const password = envValue("DOCTOR_BOOTSTRAP_PASSWORD", "ChangeMeNow123!");
  const npiNumber = envValue("DOCTOR_BOOTSTRAP_NPI", "1234567890");
  const specialty = envValue("DOCTOR_BOOTSTRAP_SPECIALTY", "Family Medicine");
  const licenseState = envValue("DOCTOR_BOOTSTRAP_STATE", "OH").toUpperCase();
  const maxConcurrentCases = Number.parseInt(envValue("DOCTOR_BOOTSTRAP_MAX_CONCURRENT", "3"), 10);
  const passwordHash = await hashPassword(password);
  const availability = {
    monday: { start: "09:00", end: "17:00" },
    tuesday: { start: "09:00", end: "17:00" },
    wednesday: { start: "09:00", end: "17:00" },
    thursday: { start: "09:00", end: "17:00" },
    friday: { start: "09:00", end: "17:00" }
  };

  const doctor = await prisma.doctor.upsert({
    where: { email },
    create: {
      email,
      fullName,
      passwordHash,
      npiNumber,
      specialty,
      licenseState,
      availability,
      maxConcurrentCases: Number.isFinite(maxConcurrentCases) && maxConcurrentCases > 0 ? maxConcurrentCases : 3,
      kycStatus: DoctorKycStatus.APPROVED,
      isActive: true
    },
    update: {
      fullName,
      passwordHash,
      specialty,
      licenseState,
      availability,
      maxConcurrentCases: Number.isFinite(maxConcurrentCases) && maxConcurrentCases > 0 ? maxConcurrentCases : 3,
      kycStatus: DoctorKycStatus.APPROVED,
      isActive: true
    }
  });

  return { doctor, password };
}

async function main() {
  const { admin, password: adminPassword } = await seedAdminUser();
  const { doctor, password: doctorPassword } = await seedDoctorUser();

  console.log("Seed completed.");
  console.log(`Admin user:  ${admin.email}  password: ${adminPassword}`);
  console.log(`Doctor user: ${doctor.email}  password: ${doctorPassword}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
