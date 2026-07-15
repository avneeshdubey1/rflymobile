import type {
  AnalyticsSnapshot,
  AppData,
  ApiResponse,
  CreateRequestInput,
  Invoice,
  NotificationItem,
  ServiceRequest,
  User,
  TimeSlot,
  SystemConfig,
} from '../../types/domain';
import type { DaasApi } from './contracts';

interface RepresentativeApprovalInput {
  representativeName: string;
  representativePhone: string;
  isApproved: boolean;
  rejectionReason?: string;
}

interface BBChecklistInput {
  billCollected: boolean;
  billPhotoUrl?: string;
  screenshotUrl?: string;
}

interface BCPaymentInput {
  upiTransactionRef: string;
  amountPaid: number;
}

export class HttpDaasApi implements DaasApi {
  private readonly baseUrl = '/api';

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem('daas_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers,
      ...init,
    });
    
    if (response.status === 401) {
      if (token) {
        localStorage.removeItem('daas_token');
        localStorage.removeItem('daas_user_id');
        window.location.href = '/';
      }
      throw new Error('Session expired. Please log in again.');
    }
    
    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Ignored
      }
      throw new Error(errorMessage);
    }
    const envelope = (await response.json()) as ApiResponse<T>;
    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error ?? 'API request failed');
    }
    return envelope.data;
  }

  getAppData() {
    return this.request<AppData>('/app-data');
  }
  getAnalytics() {
    return this.request<AnalyticsSnapshot>('/analytics');
  }
  createRequest(input: CreateRequestInput, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>('/requests', { method: 'POST', body: JSON.stringify(input) });
  }
  assignPilot(requestId: string, pilotId: string, representativeId: string | undefined, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>('/assignments', {
      method: 'POST',
      body: JSON.stringify({ serviceRequestId: requestId, pilotId, representativeId }),
    });
  }
  acceptJob(requestId: string, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>(`/assignments/${requestId}/accept`, { method: 'POST' });
  }
  updateRepresentativeApproval(requestId: string, payload: RepresentativeApprovalInput, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>(`/approval/${requestId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  startSpraying(requestId: string, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>(`/assignments/${requestId}/start`, { method: 'POST' });
  }
  completeSpraying(requestId: string, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>(`/assignments/${requestId}/complete`, { method: 'POST' });
  }
  completeBBChecklist(requestId: string, payload: BBChecklistInput, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>('/payments/bb-checklist', {
      method: 'POST',
      body: JSON.stringify({ ...payload, serviceRequestId: requestId }),
    });
  }
  recordBCPayment(requestId: string, payload: BCPaymentInput, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>('/payments/bc', {
      method: 'POST',
      body: JSON.stringify({ ...payload, serviceRequestId: requestId }),
    });
  }
  updateTracker(requestId: string, notes: string, _actor: User) {
    void _actor;
    return this.request<ServiceRequest>(`/tracker/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }
  generateInvoice(customerId: string, _actor: User) {
    void _actor;
    return this.request<Invoice>(`/finance/invoices`, {
      method: 'POST',
      body: JSON.stringify({ customerId }),
    });
  }
  markNotificationRead(notificationId: string, _actor: User) {
    void _actor;
    return this.request<NotificationItem>(`/notifications/${notificationId}/read`, { method: 'POST' });
  }

  sendOtp(phone: string) {
    return this.request<void>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  verifyOtp(phone: string, otp: string) {
    return this.request<{ token: string; user: User }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  }

  getMe() {
    return this.request<User>('/auth/me');
  }

  signUp(payload: { name: string; phone: string; role: 'BC' | 'BB'; businessName?: string; address?: string; region?: string }) {
    return this.request<{ message: string }>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateProfile(payload: { name: string; phone: string }, _actor: User) {
    void _actor;
    return this.request<User>('/users/profile', { method: 'PATCH', body: JSON.stringify(payload) });
  }

  createUser(payload: { name: string; phone: string; role: User['role']; address?: string; region?: string; billingCycleDays?: number }, _actor: User) {
    void _actor;
    return this.request<User>('/users', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateUserStatus(userId: string, isActive: boolean, _actor: User) {
    void _actor;
    return this.request<User>(`/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
  }

  deleteUser(userId: string, _actor: User) {
    void _actor;
    return this.request<void>(`/users/${userId}`, { method: 'DELETE' });
  }

  createTimeSlot(slot: string, _actor: User) {
    void _actor;
    return this.request<TimeSlot>('/settings/slots', { method: 'POST', body: JSON.stringify({ slot }) });
  }

  toggleTimeSlot(id: string, isActive: boolean, _actor: User) {
    void _actor;
    return this.request<TimeSlot>(`/settings/slots/${id}/toggle`, { method: 'PUT', body: JSON.stringify({ isActive }) });
  }

  deleteTimeSlot(id: string, _actor: User) {
    void _actor;
    return this.request<void>(`/settings/slots/${id}`, { method: 'DELETE' });
  }

  updateConfig(key: string, value: string, _actor: User) {
    void _actor;
    return this.request<SystemConfig>('/settings/configs', { method: 'POST', body: JSON.stringify({ key, value }) });
  }
}

export function withActor(actor: User): { actorId: string; actorRole: User['role'] } {
  return { actorId: actor.id, actorRole: actor.role };
}
