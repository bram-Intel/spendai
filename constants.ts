import { Transaction } from "./types";

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_1',
    date: '2023-10-24T10:30:00Z',
    amount: 50000,
    type: 'credit',
    description: 'Transfer from GTBank',
    category: 'Funding'
  },
  {
    id: 'tx_2',
    date: '2023-10-25T14:15:00Z',
    amount: 4500,
    type: 'debit',
    description: 'Uber Ride',
    category: 'Transport'
  },
  {
    id: 'tx_3',
    date: '2023-10-26T09:00:00Z',
    amount: 12000,
    type: 'debit',
    description: 'Shoprite Groceries',
    category: 'Food'
  },
  {
    id: 'tx_4',
    date: '2023-10-27T18:45:00Z',
    amount: 2500,
    type: 'debit',
    description: 'Netflix Subscription',
    category: 'Entertainment'
  }
];

export const MOCK_VIRTUAL_ACCOUNT = {
  bankName: 'Wema Bank',
  accountNumber: '9923847562',
  accountName: 'Spend.AI / Chinedu O.',
};