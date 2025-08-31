
export type Category = 'Food' | 'Transport' | 'Shopping' | 'Entertainment' | 'Health' | 'Utilities' | 'Other';
export type PaymentMethod = 'Cash' | 'UPI' | 'Card';

export interface Expense {
  id: string;
  date: string;
  category: Category;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
}

export interface User {
  name: string;
  profilePicture: string | null;
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
}

export enum SortOption {
  Latest = 'latest',
  Amount = 'amount'
}