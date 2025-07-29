import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Default users
const defaultUsers = [
  // default root user
  {
    email: 'root@root.com',
    password: '12345678', // This will be hashed before saving
    firstName: 'rootName',
    lastName: 'rootLastName',
    secondLastName: 'rootSecondLastName',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ 'root' ],
    profile: {
      phone: '2211778811',
      avatarUrl: null,
      bio: 'Root user profile',
      birthDate: '1990-01-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '123',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
];

// Default companies
const defaultCompanies = [
  {
    isActive: true,
    name: 'Default Company',
    description: 'Default company for seed data',
    businessSector: 'Technology',
    businessUnit: 'Software Development',
    host: 'default-company.local',
    address: {
      country: 'United States',
      state: 'California',
      city: 'San Francisco',
      street: 'Market Street',
      exteriorNumber: '123',
      interiorNumber: 'Suite 100',
      postalCode: '94105',
    },
    language: 'es-MX',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    logoUrl: null,
    websiteUrl: null,
    privacyPolicyUrl: null,
  },
];

// Helper function to hash password
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export default async function main(prisma: PrismaClient) {
  // Create default companies
  console.log('Creating default companines...');
  for (const companyData of defaultCompanies) {
      await prisma.company.upsert({
        where: { name: companyData.name },
        update: {
          name: companyData.name,
          description: companyData.description,
          businessSector: companyData.businessSector,
          businessUnit: companyData.businessUnit,
          host: companyData.host,
          isActive: companyData.isActive,
          address: {
            upsert: {
              update: {
                city: companyData.address.city,
                street: companyData.address.street,
                exteriorNumber: companyData.address.exteriorNumber,
                interiorNumber: companyData.address.interiorNumber,
                postalCode: companyData.address.postalCode,
                /*country: {
                  connect: { name: companyData.address.country },
                },
                state: {
                  connect: { name: companyData.address.state },
                },*/
                country: companyData.address.country,
                state: companyData.address.state,
              },
              create: companyData.address,
            },
          },
          language: companyData.language,
          timezone: companyData.timezone,
          currency: companyData.currency,
          logoUrl: companyData.logoUrl,
          websiteUrl: companyData.websiteUrl,
          privacyPolicyUrl: companyData.privacyPolicyUrl,
        },
        create: {
          name: companyData.name,
          description: companyData.description,
          businessSector: companyData.businessSector,
          businessUnit: companyData.businessUnit,
          host: companyData.host,
          isActive: companyData.isActive,
          address: {
            create: companyData.address,
          },
          language: companyData.language,
          timezone: companyData.timezone,
          currency: companyData.currency,
          logoUrl: companyData.logoUrl,
          websiteUrl: companyData.websiteUrl,
          privacyPolicyUrl: companyData.privacyPolicyUrl,
        },
      });
  }

  // Create default users
  console.log('Creating default users...');
  for (const user of defaultUsers) {
    const hashedPassword = await hashPassword(user.password);
    
    const company = await prisma.company.findUnique({
      where: { name: user.company },
    });
    
    if (!company) {
      console.warn(`Company ${user.company} not found. Skipping user '${user.firstName}' creation.`);
      continue;
    }
    
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        email: user.email,
        passwordHash: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        isActive: user.isActive,
        emailVerified: user.emailVerified,        
        companyId: company.id,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
        agentPhone: user.agentPhone,
        roles: {
          deleteMany: {},
          create: user.roles.map(role => ({
            role: {
              connect: { name: role },
            },
          })),
        },
        profile: {
          upsert: {
            update: {
              phone: user.profile.phone,
              avatarUrl: user.profile.avatarUrl,
              bio: user.profile.bio,
              birthdate: user.profile.birthDate,
            },
            create: {
              phone: user.profile.phone,
              avatarUrl: user.profile.avatarUrl,
              bio: user.profile.bio,
              birthdate: user.profile.birthDate,
            },
          },
        },
        address: {
          upsert: {
            update: {
              city: user.address.city,
              street: user.address.street,
              exteriorNumber: user.address.exteriorNumber,
              interiorNumber: user.address.interiorNumber,
              postalCode: user.address.postalCode,
              country: {
                connect: { name: user.address.country },
              },
              state: {
                connect: { name: user.address.state },
              },
            },
            create: {
              city: user.address.city,
              street: user.address.street,
              exteriorNumber: user.address.exteriorNumber,
              interiorNumber: user.address.interiorNumber,
              postalCode: user.address.postalCode,
              country: {
                connect: { name: user.address.country },
              },
              state: {
                connect: { name: user.address.state },
              },
            },
          },
        },
      },
      create: {
        email: user.email,
        passwordHash: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        isActive: user.isActive,
        emailVerified: user.emailVerified,        
        companyId: company.id,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
        agentPhone: user.agentPhone,
        roles: {
          create: user.roles.map(role => ({
            role: {
              connect: { name: role },
            },
          })),
        },
        profile: {
          create: {
            phone: user.profile.phone,
            avatarUrl: user.profile.avatarUrl,
            bio: user.profile.bio,
            birthdate: user.profile.birthDate,
          },
        },
        address: {
          create: {
            country: {
              connect: { name: user.address.country },
            },
            state: {
              connect: { name: user.address.state },
            },
            city: user.address.city,
            street: user.address.street,
            exteriorNumber: user.address.exteriorNumber,
            interiorNumber: user.address.interiorNumber,
            postalCode: user.address.postalCode,
          },
        },
      },
    });

    console.log(`User: ${user.firstName} (${user.roles.join(', ')}) created...`);
  }
}
