import { PrismaClient } from '@prisma/client';

// Countries
const countries = [
  {
    name: "México",
    imageUrl: null,
    phoneCode: "+52",
    langCode: "es-MX",
  },
];

// States
const states = [
  {
    country: "México",
    states: [
      "Puebla",
    ]
  }
];

export default async function main(prisma: PrismaClient) {
  // Create countries and states
  console.log('Creating countries and states...');

  const added = {};

  for (const country of countries) {
    const countryName = country.name.trim();

    if (added[countryName]) {
      continue;
    }

    added[countryName] = true;

    await prisma.country.upsert({
      where: { name: countryName },
      update: {},
      create: { 
        name: countryName,
        imageUrl: country.imageUrl,
        phoneCode: country.phoneCode,
        langCode: country.langCode,
      },
    });

    const statesObj = states.find(s => s.country === countryName);

    if (!statesObj) {
      continue;
    }

    for (let n = 0; n < statesObj.states.length; n++) {
      const stateName = statesObj.states[n];
      await prisma.state.upsert({
        where: { name: stateName },
        update: {},
        create: {
          name: stateName,
          country: { connect: { name: countryName } },
        },
      });
    }
  }
}
