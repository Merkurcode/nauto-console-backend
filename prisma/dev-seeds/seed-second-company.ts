import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RolesEnum } from '../../src/shared/constants/enums';

// Second company users
const secondCompanyUsers = [
  // admin user for second company
  {
    email: 'admin.tech@example.com',
    password: '12345678',
    firstName: 'María',
    lastName: 'González',
    secondLastName: 'López',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'TechCorp Solutions',
    roles: [RolesEnum.ADMIN],
    profile: {
      phone: '5523456789',
      avatarUrl: null,
      bio: 'Admin de TechCorp Solutions',
      birthDate: '1985-03-15',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Piso 5',
      postalCode: '72000',
    },
  },
  // manager user for second company
  {
    email: 'manager.tech@example.com',
    password: '12345678',
    firstName: 'Carlos',
    lastName: 'Hernández',
    secondLastName: 'Ruiz',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'TechCorp Solutions',
    roles: [RolesEnum.MANAGER],
    profile: {
      phone: '5523456790',
      avatarUrl: null,
      bio: 'Gerente de operaciones TechCorp',
      birthDate: '1988-07-22',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Piso 3',
      postalCode: '72000',
    },
  },
  // sales agents for second company
  {
    email: 'sales1.tech@example.com',
    password: '12345678',
    firstName: 'Ana',
    lastName: 'Martínez',
    secondLastName: 'Silva',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: '5523456791',
    company: 'TechCorp Solutions',
    roles: [RolesEnum.SALES_AGENT],
    profile: {
      phone: '5523456791',
      avatarUrl: null,
      bio: 'Agente de ventas senior TechCorp',
      birthDate: '1992-11-08',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Piso 2',
      postalCode: '72000',
    },
  },
  {
    email: 'sales2.tech@example.com',
    password: '12345678',
    firstName: 'Roberto',
    lastName: 'García',
    secondLastName: 'Morales',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: '5523456792',
    company: 'TechCorp Solutions',
    roles: [RolesEnum.SALES_AGENT],
    profile: {
      phone: '5523456792',
      avatarUrl: null,
      bio: 'Agente de ventas junior TechCorp',
      birthDate: '1994-05-18',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Piso 2',
      postalCode: '72000',
    },
  },
  // host user for second company
  {
    email: 'host.tech@example.com',
    password: '12345678',
    firstName: 'Laura',
    lastName: 'Rodríguez',
    secondLastName: 'Castro',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'TechCorp Solutions',
    roles: [RolesEnum.HOST],
    profile: {
      phone: '5523456793',
      avatarUrl: null,
      bio: 'Anfitriona corporativa TechCorp',
      birthDate: '1990-12-03',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Recepción',
      postalCode: '72000',
    },
  },
  // guest users for second company
  {
    email: 'guest1.tech@example.com',
    password: '12345678',
    firstName: 'Patricia',
    lastName: 'López',
    secondLastName: 'Méndez',
    isActive: true,
    emailVerified: true,
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'TechCorp Solutions',
    roles: [RolesEnum.GUEST],
    profile: {
      phone: '5523456794',
      avatarUrl: null,
      bio: 'Usuario invitado TechCorp',
      birthDate: '1996-01-25',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Piso 1',
      postalCode: '72000',
    },
  },
  {
    email: 'guest2.tech@example.com',
    password: '12345678',
    firstName: 'Fernando',
    lastName: 'Vázquez',
    secondLastName: 'Jiménez',
    isActive: true,
    emailVerified: false, // Este usuario no está verificado
    bannedUntil: null,
    banReason: null,
    agentPhone: null,
    company: 'TechCorp Solutions',
    roles: [RolesEnum.GUEST],
    profile: {
      phone: '5523456795',
      avatarUrl: null,
      bio: 'Usuario invitado sin verificar TechCorp',
      birthDate: '1995-09-12',
    },
    address: {
      country: 'México',
      state: 'Puebla',
      city: 'Puebla',
      street: 'Avenida Reforma',
      exteriorNumber: '456',
      interiorNumber: 'Piso 1',
      postalCode: '72000',
    },
  },
];

// Second company definition
const secondCompany = {
  isActive: true,
  name: 'TechCorp Solutions',
  description: 'Empresa tecnológica especializada en desarrollo de software y consultoría IT',
  host: 'techcorp-solutions.local',
  address: {
    country: 'México',
    state: 'Puebla',
    city: 'Puebla',
    street: 'Avenida Reforma',
    exteriorNumber: '456',
    interiorNumber: 'Torre B, Pisos 1-5',
    postalCode: '72000',
    googleMapsUrl: 'https://maps.google.com/?q=Avenida+Reforma+456,Puebla,Puebla,México',
  },
  industrySector: 'TECHNOLOGY',
  industryOperationChannel: 'DIGITAL',
  parentCompanyId: null,
  language: 'es-MX',
  timezone: 'America/Mexico_City',
  currency: 'MXN',
  logoUrl: 'https://techcorp-solutions.com/logo.png',
  websiteUrl: 'https://techcorp-solutions.com',
  privacyPolicyUrl: 'https://techcorp-solutions.com/privacy',
};

// Helper function to hash password using the same configuration as the app
async function hashPassword(password: string): Promise<string> {
  // Use the same salt rounds as configured in the app (PASSWORD_SALT_ROUNDS=12)
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

export default async function main(prisma: PrismaClient) {
  // Only run in development environment
  if (process.env.NODE_ENV !== 'development') {
    console.log('🚫 Second company seed skipped - not in development environment');
    return;
  }

  console.log('🏢 Creating second company (TechCorp Solutions)...');

  // Create second company
  const company = await prisma.company.upsert({
    where: { name: secondCompany.name },
    update: {
      name: secondCompany.name,
      description: secondCompany.description,
      host: secondCompany.host,
      isActive: secondCompany.isActive,
      address: {
        upsert: {
          update: {
            city: secondCompany.address.city,
            street: secondCompany.address.street,
            exteriorNumber: secondCompany.address.exteriorNumber,
            interiorNumber: secondCompany.address.interiorNumber,
            postalCode: secondCompany.address.postalCode,
            googleMapsUrl: secondCompany.address.googleMapsUrl,
            country: secondCompany.address.country,
            state: secondCompany.address.state,
          },
          create: secondCompany.address,
        },
      },
      language: secondCompany.language,
      timezone: secondCompany.timezone,
      currency: secondCompany.currency,
      logoUrl: secondCompany.logoUrl,
      websiteUrl: secondCompany.websiteUrl,
      privacyPolicyUrl: secondCompany.privacyPolicyUrl,
    },
    create: {
      name: secondCompany.name,
      description: secondCompany.description,
      host: secondCompany.host,
      isActive: secondCompany.isActive,
      address: {
        create: secondCompany.address,
      },
      language: secondCompany.language,
      timezone: secondCompany.timezone,
      currency: secondCompany.currency,
      logoUrl: secondCompany.logoUrl,
      websiteUrl: secondCompany.websiteUrl,
      privacyPolicyUrl: secondCompany.privacyPolicyUrl,
    },
  });

  console.log(`✅ Company created: ${company.name}`);

  // Create users for second company
  console.log('👥 Creating users for TechCorp Solutions...');
  for (const user of secondCompanyUsers) {
    const hashedPassword = await hashPassword(user.password);
    
    const createdUser = await prisma.user.upsert({
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

    console.log(`👤 User created: ${user.firstName} ${user.lastName} (${user.roles.join(', ')}) - ${user.email}`);
    
    // Create EmailVerification record if user is marked as emailVerified
    if (user.emailVerified) {
      console.log(`📧 Creating email verification record for ${user.email}...`);
      
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
  
  console.log('\n🎉 TechCorp Solutions company and all users created successfully!');
  console.log('\n📋 Summary:');
  console.log(`🏢 Company: ${secondCompany.name}`);
  console.log(`🌐 Host: ${secondCompany.host}`);
  console.log(`👥 Users created: ${secondCompanyUsers.length}`);
  console.log(`📧 Verified users: ${secondCompanyUsers.filter(u => u.emailVerified).length}`);
  console.log(`🔒 Unverified users: ${secondCompanyUsers.filter(u => !u.emailVerified).length}`);
  
  // Log user details for easy reference
  console.log('\n👤 User accounts created:');
  secondCompanyUsers.forEach(user => {
    const status = user.emailVerified ? '✅' : '⏸️';
    console.log(`${status} ${user.email} - ${user.firstName} ${user.lastName} (${user.roles.join(', ')})`);
  });
}