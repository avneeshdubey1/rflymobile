import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:9688656667@localhost:5432/daas_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Users
  const admin = await prisma.user.upsert({
    where: { phone: '9000000001' },
    update: {},
    create: { name: 'Seshu (Admin)', phone: '9000000001', role: 'Admin' },
  });

  const pilot1 = await prisma.user.upsert({
    where: { phone: '9000000002' },
    update: {},
    create: { name: 'Ravi Kumar', phone: '9000000002', role: 'Pilot' },
  });

  const pilot2 = await prisma.user.upsert({
    where: { phone: '9000000003' },
    update: {},
    create: { name: 'Suresh Reddy', phone: '9000000003', role: 'Pilot' },
  });

  const ops = await prisma.user.upsert({
    where: { phone: '1234567890' },
    update: {},
    create: { name: 'Priya Sharma', phone: '1234567890', role: 'Ops' },
  });

  const finance = await prisma.user.upsert({
    where: { phone: '9000000005' },
    update: {},
    create: { name: 'Anita Desai', phone: '9000000005', role: 'Finance' },
  });

  const rep = await prisma.user.upsert({
    where: { phone: '9000000006' },
    update: {},
    create: { name: 'Vikram Rep', phone: '9000000006', role: 'Representative' },
  });

  // Customers
  const bb1 = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000bb1' },
    update: {},
    create: { name: 'AgriChem Corp', phone: '9100000001', type: 'BB', billingCycleDays: 15 },
  });

  const bb2 = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000bb2' },
    update: {},
    create: { name: 'GreenFields Co-op', phone: '9100000002', type: 'BB', billingCycleDays: 30 },
  });

  const bc1 = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000bc1' },
    update: {},
    create: { name: 'Ramesh Farmer', phone: '9200000001', type: 'BC', billingCycleDays: 0 },
  });

  const bbUser1 = await prisma.user.upsert({
    where: { phone: '9100000001' },
    update: {},
    create: { name: 'AgriChem Admin', phone: '9100000001', role: 'BB', customerId: bb1.id },
  });

  const bcUser1 = await prisma.user.upsert({
    where: { phone: '9200000001' },
    update: {},
    create: { name: 'Ramesh Farmer', phone: '9200000001', role: 'BC', customerId: bc1.id },
  });

  // Seed default Time Slots
  console.log('Seeding default time slots...');
  const defaultSlots = ['06:00-08:00','07:00-09:00','08:00-10:00','10:00-12:00','14:00-16:00','16:00-18:00'];
  for (const slot of defaultSlots) {
    await prisma.timeSlot.upsert({
      where: { slot },
      update: {},
      create: { slot, isActive: true },
    });
  }

  // Seed default System Settings
  console.log('Seeding default system settings...');
  const configs = [
    { key: 'cost_per_acre', value: '650' },
    { key: 'crop_presets', value: JSON.stringify(['Paddy', 'Cotton', 'Wheat', 'Maize']) },
    { key: 'chemical_presets', value: JSON.stringify(['Pesticide A', 'Urea', 'Fungicide']) }
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
