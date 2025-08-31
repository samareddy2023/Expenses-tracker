
import { Category, PaymentMethod } from './types';

export const CATEGORIES: Category[] = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Other'];
export const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'Card', 'Cash'];

export const PIE_CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b', '#64748b'];

export const DEFAULT_USER = {
  name: 'Guest',
  profilePicture: null,
};