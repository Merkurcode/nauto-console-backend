import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';
import { RolesEnum } from '../../src/shared/constants/enums';

// Default users
const defaultUsers = [
  // default root user
  {
    email: 'root@test.com',
    password: '12345678', // This will be hashed before saving
    firstName: 'Root',
    lastName: 'rootLastName',
    secondLastName: 'rootSecondLastName',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.ROOT ],
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
  // root readonly user
  {
    email: 'root.readonly@test.com',
    password: '12345678',
    firstName: 'RootReadOnly',
    lastName: 'ReadOnly',
    secondLastName: 'User',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.ROOT_READONLY ],
    profile: {
      phone: '2211778812',
      avatarUrl: null,
      bio: 'Root readonly user profile',
      birthDate: '1990-02-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '124',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
  // admin user
  {
    email: 'admin@test.com',
    password: '12345678',
    firstName: 'Admin',
    lastName: 'User',
    secondLastName: 'Test',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.ADMIN ],
    profile: {
      phone: '2211778813',
      avatarUrl: null,
      bio: 'Admin user profile',
      birthDate: '1990-03-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '125',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
  // manager user
  {
    email: 'manager@test.com',
    password: '12345678',
    firstName: 'Manager',
    lastName: 'User',
    secondLastName: 'Test',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.MANAGER ],
    profile: {
      phone: '2211778814',
      avatarUrl: null,
      bio: 'Manager user profile',
      birthDate: '1990-04-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '126',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
  // sales agent user
  {
    email: 'sales.agent@test.com',
    password: '12345678',
    firstName: 'Sales',
    lastName: 'Agent',
    secondLastName: 'Test',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: '2211778890',
    company: 'Default Company',
    roles: [ RolesEnum.SALES_AGENT ],
    profile: {
      phone: '2211778815',
      avatarUrl: null,
      bio: 'Sales agent user profile',
      birthDate: '1990-05-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '127',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
  // host user
  {
    email: 'host@test.com',
    password: '12345678',
    firstName: 'Host',
    lastName: 'User',
    secondLastName: 'Test',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.HOST ],
    profile: {
      phone: '2211778817',
      avatarUrl: null,
      bio: 'Host user profile',
      birthDate: '1990-07-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '129',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
  // guest user
  {
    email: 'guest@test.com',
    password: '12345678',
    firstName: 'Guest',
    lastName: 'User',
    secondLastName: 'Test',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.GUEST ],
    profile: {
      phone: '2211778816',
      avatarUrl: null,
      bio: 'Guest user profile',
      birthDate: '1990-06-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '128',
      interiorNumber: null,
      postalCode: '72000',
    },
  },
  // unverified user (para demostrar el flujo de verificación automática)
  {
    email: 'unverified@test.com',
    password: '12345678',
    firstName: 'Unverified',
    lastName: 'User',
    secondLastName: 'Test',
    isActive: true,
    emailVerified: false, // 👈 Este usuario NO está verificado
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'Default Company',
    roles: [ RolesEnum.GUEST ],
    profile: {
      phone: '2211778820',
      avatarUrl: null,
      bio: 'Unverified user profile for testing',
      birthDate: '1990-08-01',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Calle 5 de Mayo',
      exteriorNumber: '130',
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

// Helper function to hash password using the same configuration as the app
async function hashPassword(password: string): Promise<string> {
  // Use the same salt rounds as configured in the app (PASSWORD_SALT_ROUNDS=12)
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

// Helper function to ask user confirmation
function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export default async function main(prisma: PrismaClient) {
  // Ask if user wants to delete existing users
  const deleteUsers = await askQuestion('¿Quieres eliminar todos los usuarios existentes? (s/n): ');
  
  if (deleteUsers === 's' || deleteUsers === 'si' || deleteUsers === 'y' || deleteUsers === 'yes') {
    const confirmDelete = await askQuestion('¿Estás seguro? Esta acción no se puede deshacer (s/n): ');
    
    if (confirmDelete === 's' || confirmDelete === 'si' || confirmDelete === 'y' || confirmDelete === 'yes') {
      console.log('Eliminando usuarios existentes...');
      // También eliminamos las verificaciones de email
      await prisma.emailVerification.deleteMany({});
      await prisma.user.deleteMany({});
      console.log('Usuarios y verificaciones de email eliminados.');
    } else {
      console.log('Eliminación cancelada.');
    }
  }

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
    
    // Create EmailVerification record if user is marked as emailVerified
    if (user.emailVerified) {
      console.log(`Creating email verification record for ${user.email}...`);
      
      // Check if verification already exists for this email
      const existingVerification = await prisma.emailVerification.findFirst({
        where: { email: user.email }
      });
      
      if (!existingVerification) {
        await prisma.emailVerification.create({
          data: {
            email: user.email,
            code: '000000', // Dummy code for seed data
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            verifiedAt: new Date(), // Mark as already verified
          },
        });
        
        console.log(`✅ Email verification record created for ${user.email}`);
      } else {
        // Update existing verification to be verified
        await prisma.emailVerification.update({
          where: { id: existingVerification.id },
          data: {
            verifiedAt: new Date(), // Mark as verified
            code: '000000', // Dummy code
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }
        });
        
        console.log(`✅ Email verification updated for ${user.email}`);
      }
    } else {
      console.log(`⏸️ Skipping email verification for ${user.email} (emailVerified: false)`);
    }
  }
  
  console.log('\n🎉 All users and email verifications created successfully!');
}
