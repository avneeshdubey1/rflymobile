/// <reference types="jest" />
import React from 'react';
import RoleShellScreen from '../src/screens/RoleShellScreen';
import { useAuthStore } from '../src/store/auth';

jest.mock('../src/store/auth', () => ({
  useAuthStore: jest.fn(),
}));

// A simple manual search for testID in the React elements tree
function findByTestId(element: any, testId: string): any[] {
  if (!element || typeof element !== 'object') return [];
  let found: any[] = [];
  if (element.props && element.props.testID === testId) {
    found.push(element);
  }
  if (element.props && element.props.children) {
    const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
    for (const child of children) {
      found = found.concat(findByTestId(child, testId));
    }
  }
  return found;
}

describe('RoleShellScreen Navigation Conditioning', () => {
  const mockNavigate = jest.fn();
  const mockNavigation = { navigate: mockNavigate, replace: jest.fn() };
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only Sales when user has only SALES_INTAKE', () => {
    (useAuthStore as any).mockReturnValue({
      logout: jest.fn(),
      profile: { name: 'Test User' },
      capabilities: ['SALES_INTAKE']
    });

    const element = RoleShellScreen({ navigation: mockNavigation });
    
    expect(findByTestId(element, 'btn-sales').length).toBe(1);
    expect(findByTestId(element, 'btn-fleet').length).toBe(0);
    expect(findByTestId(element, 'btn-admin').length).toBe(0);
    expect(findByTestId(element, 'no-access').length).toBe(0);
  });

  it('renders Sales and Fleet when user has both capabilities', () => {
    (useAuthStore as any).mockReturnValue({
      logout: jest.fn(),
      profile: { name: 'Test User' },
      capabilities: ['SALES_INTAKE', 'FLEET_SCHEDULE']
    });

    const element = RoleShellScreen({ navigation: mockNavigation });
    
    expect(findByTestId(element, 'btn-sales').length).toBe(1);
    expect(findByTestId(element, 'btn-fleet').length).toBe(1);
    expect(findByTestId(element, 'btn-admin').length).toBe(0);
    expect(findByTestId(element, 'no-access').length).toBe(0);
  });

  it('renders fallback when user has no matching capabilities', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      capabilities: ['farmer:access'],
      profile: { name: 'Stranger' },
      logout: mockLogout,
    });
    const element = RoleShellScreen({ navigation: mockNavigation });
    
    expect(findByTestId(element, 'btn-sales').length).toBe(0);
    expect(findByTestId(element, 'btn-fleet').length).toBe(0);
    expect(findByTestId(element, 'btn-admin').length).toBe(0);
    expect(findByTestId(element, 'no-access').length).toBe(1);
  });
});
