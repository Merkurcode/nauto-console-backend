import { PrismaClient } from '@prisma/client';
import { AssistantAreaEnum } from '@shared/constants/enums';

// Roles
export const AIAssistants = [
  {
    available: true,
    name: 'Lily',
    description: {
      "es-MX": 'Responde dudas generales sobre servicios, ubicaciones y agenda citas.',
      "en-US": 'Answers general questions about services, locations, and schedules appointments.',
    },
    area: AssistantAreaEnum.BRAND_EXPERT, // Lily
  },
  {
    available: true,
    name: 'Zoe',
    description: {
      "es-MX": 'Comparte promociones, descuentos y campañas de marketing digital.',
      "en-US": 'Shares promotions, discounts, and digital marketing campaigns.',
    },
    area: AssistantAreaEnum.MARKETING_ASSISTANT, // Zoe
  },
  {
    available: true,
    name: 'Oscar',
    description: {
      "es-MX": 'Informa sobre seguros, cotizaciones, créditos y pagos.',
      "en-US": 'Informs about insurance, quotes, credits, and payments.',
    },
    area: AssistantAreaEnum.FINCANCE_ASSISTANT, // Oscar
  },
  {
    available: true,
    name: 'Niko',
    description: {
      "es-MX": 'Segmenta clientes y activa ventas cruzadas o post-venta con base en datos.',
      "en-US": 'Segments customers and activates cross-selling or post-sale based on data.',
    },
    area: AssistantAreaEnum.UPSELL_ASSISTANT, // Niko
  },
];

export default async function main(prisma: PrismaClient) {
  // Create ai assistants
  console.log('Creating AI assistants...');
  for (const assistant of AIAssistants) {
    await prisma.aIAssistant.upsert({
      where: { name: assistant.name },
      update: {},
      create: {
        name: assistant.name,
        area: assistant.area,
        description: assistant.description,
        available: assistant.available,
      },
    });
  }
}
