import { PrismaClient } from '@prisma/client';

// Roles
export const AIAssistantsFeatures = [
  {
    assistantName: 'Lily',
    features: [
      {
        name: 'schedule_appointments',
        title: {
          'es-MX': 'Agendar citas',
          'en-US': 'Schedule appointments',
        },
        description: {
          'es-MX': 'Activa la generación de citas con tus clientes.',
          'en-US': 'Enables appointment scheduling with your clients.',
        },
      },
      {
        name: 'technical_sheets',
        title: {
          'es-MX': 'Fichas técnicas',
          'en-US': 'Technical sheets',
        },
        description: {
          'es-MX': 'Permite enviar fichas técnicas a tus clientes.',
          'en-US': 'Allows sending technical sheets to your clients.',
        },
      },
      {
        name: 'faq',
        title: {
          'es-MX': 'Preguntas frecuentes',
          'en-US': 'Frequently Asked Questions',
        },
        description: {
          'es-MX': 'Le permite responder preguntas frecuentes.',
          'en-US': 'Allows answering frequently asked questions.',
        },
      },
    ],
  },
  {
    assistantName: 'Zoe',
    features: [
      {
        name: 'bonuses',
        title: {
          'es-MX': 'Bonos',
          'en-US': 'Bonuses',
        },
        description: {
          'es-MX': 'Bonos.',
          'en-US': 'Bonuses.',
        },
      },
      {
        name: 'promotions',
        title: {
          'es-MX': 'Promociones',
          'en-US': 'Promotions',
        },
        description: {
          'es-MX': 'Promociones.',
          'en-US': 'Promotions.',
        },
      },
      {
        name: 'marketing_campaigns',
        title: {
          'es-MX': 'Campañas de marketing',
          'en-US': 'Marketing campaigns',
        },
        description: {
          'es-MX': 'Campañas de marketing.',
          'en-US': 'Marketing campaigns.',
        },
      },
    ],
  },
  {
    assistantName: 'Oscar',
    features: [
      {
        name: 'financing',
        title: {
          'es-MX': 'Financiamiento',
          'en-US': 'Financing',
        },
        description: {
          'es-MX': 'Financiamiento.',
          'en-US': 'Financing.',
        },
      },
      {
        name: 'quotations',
        title: {
          'es-MX': 'Cotizaciones',
          'en-US': 'Quotations',
        },
        description: {
          'es-MX': 'Cotizaciones.',
          'en-US': 'Quotations.',
        },
      },
      {
        name: 'payment_simulator',
        title: {
          'es-MX': 'Simulador de pagos',
          'en-US': 'Payment simulator',
        },
        description: {
          'es-MX': 'Simulador de pagos.',
          'en-US': 'Payment simulator.',
        },
      },
    ],
  },
  {
    assistantName: 'Niko',
    features: [
      {
        name: 'push_notifications',
        title: {
          'es-MX': 'Notificaciones push',
          'en-US': 'Push notifications',
        },
        description: {
          'es-MX': 'Notificaciones push.',
          'en-US': 'Push notifications.',
        },
      },
      {
        name: 'attached_documents',
        title: {
          'es-MX': 'Documentos adjuntos',
          'en-US': 'Attached documents',
        },
        description: {
          'es-MX': 'Documentos adjuntos.',
          'en-US': 'Attached documents.',
        },
      },
    ],
  },
];

export default async function main(prisma: PrismaClient) {
  // Create AI assistants features
  console.log('Creating AI assistants features...');
  for (const assistantFeature of AIAssistantsFeatures) {
    const assistant = await prisma.aIAssistant.findUnique({
      where: { name: assistantFeature.assistantName },
    });

    if (!assistant) {
      console.warn(`Assistant ${assistantFeature.assistantName} not found.`);
      continue;
    }

    for (const feature of assistantFeature.features) {
      await prisma.aIAssistantFeature.upsert({
        where: {
          keyName: feature.name
        },
        update: {},
        create: {
          aiAssistantId: assistant.id,
          keyName: feature.name,
          title: feature.title,
          description: feature.description,
        },
      });
    }
  }
}
