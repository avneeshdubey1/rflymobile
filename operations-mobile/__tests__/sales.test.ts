import { CustomerSchema, LeadSchema, CreateCustomerResponseSchema } from '../src/api/sales';

describe('Sales DTO Schema Validation', () => {
  it('accepts valid customer DTO', () => {
    const valid = {
      id: 'c1',
      displayName: 'Ramesh',
      phone: '+919876543210',
      totalAcres: '5.5',
      location: {
        village: 'MyVillage',
      }
    };
    const result = CustomerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid customer DTO (missing displayName)', () => {
    const invalid = {
      id: 'c1',
      name: 'Ramesh', // wrong field!
      phone: '+919876543210',
    };
    const result = CustomerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts valid create response', () => {
    const valid = {
      success: true,
      created: true,
      customer: {
        id: 'c1',
        displayName: 'Ramesh',
        phone: '+919876543210'
      }
    };
    const result = CreateCustomerResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts valid lead DTO', () => {
    const valid = {
      id: 'l1',
      status: 'PENDING',
      acreage: '12.5',
      crop: 'Cotton',
      createdAt: '2023-01-01T00:00:00.000Z'
    };
    const result = LeadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
