import { db } from '../../config/db.js';

export interface AnalyticsSnapshot {
  totalRequests: number;
  activeRequests: number;
  totalRevenue: number;
  completionRate: number;
  statusBreakdown: Record<string, number>;
  customerTypeBreakdown: { BB: number; BC: number };
  pilotPerformance: Array<{ pilotId: string; pilotName: string; totalJobs: number; completedJobs: number; totalAcres: number }>;
  topCustomers: Array<{ customerId: string; customerName: string; type: string; jobs: number; revenue: number }>;
}

export class AnalyticsService {
  async getSnapshot(): Promise<AnalyticsSnapshot> {
    const reqs = await db.serviceRequest.findMany({
      include: {
        assignment: { include: { pilot: true } },
        customer: true,
      },
    });

    const totalRequests = reqs.length;

    const completedStatuses = ['Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'];
    const completed = reqs.filter(r => completedStatuses.includes(r.status));
    const completionRate = totalRequests > 0 ? Math.round((completed.length / totalRequests) * 100) : 0;
    const activeRequests = totalRequests - completed.length;

    const totalRevenue = completed.reduce((sum, r) => sum + Number(r.fieldAreaAcres) * Number(r.amountPerAcre), 0);

    const statusBreakdown: Record<string, number> = {};
    for (const r of reqs) {
      statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
    }

    const customerTypeBreakdown = {
      BB: reqs.filter(r => r.customerType === 'BB').length,
      BC: reqs.filter(r => r.customerType === 'BC').length,
    };

    const pilots = await db.user.findMany({ where: { role: 'Pilot' } });
    const pilotPerformance = pilots.map(p => {
      const pilotReqs = reqs.filter(r => r.assignment?.pilotId === p.id);
      const pilotCompleted = pilotReqs.filter(r => completedStatuses.includes(r.status));
      const totalAcres = pilotCompleted.reduce((sum, r) => sum + Number(r.fieldAreaAcres), 0);
      return { pilotId: p.id, pilotName: p.name, totalJobs: pilotReqs.length, completedJobs: pilotCompleted.length, totalAcres };
    });

    const customers = await db.customer.findMany();
    const topCustomers = customers.map(c => {
      const customerReqs = reqs.filter(r => r.customerId === c.id);
      const revenue = customerReqs.filter(r => completedStatuses.includes(r.status)).reduce((sum, r) => sum + Number(r.fieldAreaAcres) * Number(r.amountPerAcre), 0);
      return { customerId: c.id, customerName: c.name, type: c.type, jobs: customerReqs.length, revenue };
    }).sort((a, b) => b.revenue - a.revenue);

    return { totalRequests, activeRequests, totalRevenue, completionRate, statusBreakdown, customerTypeBreakdown, pilotPerformance, topCustomers };
  }
}

export const analyticsService = new AnalyticsService();
