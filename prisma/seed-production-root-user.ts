import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RolesEnum } from '../src/shared/constants/enums';

// Production-safe root user creation
const users = [
  {
    email: 'crodriguez@nauto.la',
    password: '12345678',
    firstName: 'Carolina',
    lastName: 'Rodríguez',
    secondLastName: null,
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    roles: [RolesEnum.ROOT],
    profile: {
      phone: null,
      phoneCountryCode: null,
      avatarUrl: null,
      bio: 'System Administrator',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: null,
      exteriorNumber: null,
      interiorNumber: null,
      postalCode: null,
    },
  },
  {
    email: 'npulido@nauto.la',
    password: '12345678',
    firstName: 'Carolina',
    lastName: 'Rodríguez',
    secondLastName: null,
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    roles: [RolesEnum.ROOT],
    profile: {
      phone: null,
      phoneCountryCode: null,
      avatarUrl: null,
      bio: 'System Administrator',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: null,
      exteriorNumber: null,
      interiorNumber: null,
      postalCode: null,
    },
  },
  {
    email: 'elsi@nauto.la',
    password: '12345678',
    firstName: 'Carolina',
    lastName: 'Rodríguez',
    secondLastName: null,
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    roles: [RolesEnum.ROOT],
    profile: {
      phone: null,
      phoneCountryCode: null,
      avatarUrl: null,
      bio: 'System Administrator',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: null,
      exteriorNumber: null,
      interiorNumber: null,
      postalCode: null,
    },
  },
  {
    email: 'jcano@merkur.la',
    password: '12345678',
    firstName: 'Carolina',
    lastName: 'Rodríguez',
    secondLastName: null,
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    roles: [RolesEnum.ROOT],
    profile: {
      phone: null,
      phoneCountryCode: null,
      avatarUrl: null,
      bio: 'System Administrator',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: null,
      exteriorNumber: null,
      interiorNumber: null,
      postalCode: null,
    },
  },
  {
    email: 'esanchez@merkur.la',
    password: '12345678',
    firstName: 'Carolina',
    lastName: 'Rodríguez',
    secondLastName: null,
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    roles: [RolesEnum.ROOT],
    profile: {
      phone: null,
      phoneCountryCode: null,
      avatarUrl: null,
      bio: 'System Administrator',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: null,
      exteriorNumber: null,
      interiorNumber: null,
      postalCode: null,
    },
  },
  {
    email: 'aestrada@merkur.la',
    password: '12345678',
    firstName: 'Carolina',
    lastName: 'Rodríguez',
    secondLastName: null,
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    roles: [RolesEnum.ROOT],
    profile: {
      phone: null,
      phoneCountryCode: null,
      avatarUrl: null,
      bio: 'System Administrator',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: null,
      exteriorNumber: null,
      interiorNumber: null,
      postalCode: null,
    },
  }
];

// Helper function to hash password using the same configuration as the app
async function hashPassword(password: string): Promise<string> {
  // Use the same salt rounds as configured in the app (PASSWORD_SALT_ROUNDS=12)
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

export default async function main(prisma: PrismaClient) {
  // PRODUCTION SAFETY CHECK
  console.log('🔐 Creating production root user (without company assignment)...');
  
  for (const rootUser of users) {
    rootUser.email = rootUser.email.toLowerCase().trim();

    // Check if root user already exists
    const existingRootUser = await prisma.user.findUnique({
      where: { email: rootUser.email },
    });

    if (existingRootUser) {
      console.log('⚠️  Root user already exists. Skipping creation.');
      return;
    }

    // Verify that the ROOT role exists
    const rootRole = await prisma.role.findUnique({
      where: { name: RolesEnum.ROOT },
    });

    if (!rootRole) {
      console.error('❌ ROOT role not found. Please run roles seed first.');
      throw new Error('ROOT role not found in database');
    }

    // Verify that required countries and states exist
    const country = await prisma.country.findUnique({
      where: { name: rootUser.address.country },
    });

    const state = await prisma.state.findFirst({
      where: { 
        name: rootUser.address.state,
        countryId: country?.id,
      },
    });

    if (!country || !state) {
      console.error('❌ Required country/state not found. Please run countries seed first.');
      throw new Error('Required geographical data not found');
    }

    // Hash the password
    const hashedPassword = await hashPassword(rootUser.password);

    // Create root user WITHOUT company assignment
    const createdUser = await prisma.user.create({
      data: {
        email: rootUser.email,
        passwordHash: hashedPassword,
        firstName: rootUser.firstName,
        lastName: rootUser.lastName,
        secondLastName: rootUser.secondLastName,
        isActive: rootUser.isActive,
        emailVerified: rootUser.emailVerified,
        companyId: null, // 👈 NO COMPANY ASSIGNMENT
        bannedUntil: rootUser.bannedUntil,
        banReason: rootUser.banReason,
        agentPhone: rootUser.agentPhone,
        roles: {
          create: rootUser.roles.map(role => ({
            role: {
              connect: { name: role },
            },
          })),
        },
        profile: {
          create: {
            phone: rootUser.profile.phone,
            phoneCountryCode: rootUser.profile.phoneCountryCode,
            avatarUrl: rootUser.profile.avatarUrl,
            bio: rootUser.profile.bio,
            birthdate: rootUser.profile.birthDate,
          },
        },
        address: {
          create: {
            country: {
              connect: { id: country.id },
            },
            state: {
              connect: { id: state.id },
            },
            city: rootUser.address.city,
            street: rootUser.address.street,
            exteriorNumber: rootUser.address.exteriorNumber,
            interiorNumber: rootUser.address.interiorNumber,
            postalCode: rootUser.address.postalCode,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    console.log(`✅ Root user created successfully:`);
    console.log(`   📧 Email: ${createdUser.email}`);
    console.log(`   👤 Name: ${createdUser.firstName} ${createdUser.lastName}`);
    console.log(`   🏢 Company: None (system-level)`);
    console.log(`   🔑 Role: ${createdUser.roles.map(r => r.role.name).join(', ')}`);
    console.log(`   ✅ Email Verified: ${createdUser.emailVerified}`);

    // Create EmailVerification record since user is marked as emailVerified
    console.log(`📧 Creating email verification record...`);
    
    await prisma.emailVerification.create({
      data: {
        email: rootUser.email,
        code: '000000', // Dummy code for production seed
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        verifiedAt: new Date(), // Mark as already verified
      },
    });

    console.log(`✅ Email verification record created.`);
  }
  
  console.log('\n🎉 Production root user setup completed successfully!');
  console.log(`Emails: \n${users.map((u) => u.email.trim()).join('\n')}`)
  console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
  console.log(`   Default password: 12345678`);
}
