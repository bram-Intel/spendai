# Requirements Document

## Introduction

This feature establishes the data foundation for Spend.AI by replacing React state management with a persistent PostgreSQL database hosted on Supabase. The system will provide secure, scalable data storage for user profiles, wallets, and transactions with proper authentication and row-level security.

## Glossary

- **System**: The Spend.AI backend database and authentication system
- **User**: An authenticated individual using the Spend.AI application
- **Profile**: Extended user information beyond basic authentication
- **Wallet**: A user's financial account containing balance and virtual account details
- **Transaction**: A record of money movement (credit or debit) in a wallet
- **RLS**: Row Level Security - PostgreSQL security policies that restrict data access
- **Auth_User**: The authenticated user from Supabase auth.users table
- **NUBAN**: Nigeria Uniform Bank Account Number - the virtual account number
- **Kobo**: The smallest unit of Nigerian currency (1 Naira = 100 Kobo)

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to securely sign up and log in to the application, so that I can access my personal financial data.

#### Acceptance Criteria

1. WHEN a user provides valid email and password, THE System SHALL create an authenticated account
2. WHEN a user provides existing credentials, THE System SHALL authenticate and grant access
3. WHEN authentication fails, THE System SHALL return a descriptive error message
4. THE System SHALL store authentication tokens securely in the client
5. WHEN a user logs out, THE System SHALL invalidate the session and clear tokens

### Requirement 2: User Profile Management

**User Story:** As a user, I want my profile information stored persistently, so that my account details are preserved across sessions.

#### Acceptance Criteria

1. WHEN a user account is created, THE System SHALL automatically create a corresponding profile record
2. THE Profile SHALL store the user's full name, email, avatar URL, and KYC verification status
3. WHEN a user updates their profile, THE System SHALL persist the changes to the database
4. THE System SHALL link each profile to exactly one auth user via user ID
5. THE Profile SHALL include a KYC tier field with values 1, 2, or 3

### Requirement 3: Wallet Creation and Management

**User Story:** As a user, I want a wallet to store my balance and account details, so that I can manage my funds within the application.

#### Acceptance Criteria

1. WHEN a user profile is created, THE System SHALL automatically create a corresponding wallet
2. THE Wallet SHALL store balance in kobo (integer) to avoid floating-point errors
3. THE Wallet SHALL support Nigerian Naira (NGN) currency
4. THE Wallet SHALL store NUBAN account details including account number, bank name, and account name
5. THE Wallet SHALL store the Paystack customer code for payment integration
6. WHEN wallet balance changes, THE System SHALL update the timestamp

### Requirement 4: Transaction Recording

**User Story:** As a user, I want all my financial transactions recorded, so that I can track my spending and income history.

#### Acceptance Criteria

1. WHEN money enters or leaves a wallet, THE System SHALL create a transaction record
2. THE Transaction SHALL store amount, type (credit or debit), description, and category
3. THE Transaction SHALL include a unique payment reference from the payment gateway
4. THE Transaction SHALL track status as pending, success, or failed
5. THE Transaction SHALL be linked to exactly one wallet via wallet ID
6. THE System SHALL record the transaction timestamp automatically

### Requirement 5: Row Level Security

**User Story:** As a user, I want my financial data protected from other users, so that my privacy and security are maintained.

#### Acceptance Criteria

1. WHEN a user queries their profile, THE System SHALL return only their own profile data
2. WHEN a user queries their wallet, THE System SHALL return only their own wallet data
3. WHEN a user queries transactions, THE System SHALL return only transactions from their wallet
4. THE System SHALL enforce security policies using the authenticated user ID
5. IF a user attempts to access another user's data, THEN THE System SHALL deny the request

### Requirement 6: Database Schema Initialization

**User Story:** As a developer, I want the database schema properly initialized, so that the application has the correct table structure and relationships.

#### Acceptance Criteria

1. THE System SHALL create a profiles table extending auth.users
2. THE System SHALL create a wallets table with foreign key to profiles
3. THE System SHALL create a transactions table with foreign key to wallets
4. THE System SHALL enable UUID generation extension for primary keys
5. THE System SHALL create appropriate indexes for query performance
6. THE System SHALL set up foreign key constraints with CASCADE delete behavior

### Requirement 7: Environment Configuration

**User Story:** As a developer, I want Supabase credentials properly configured, so that the frontend can connect to the database securely.

#### Acceptance Criteria

1. THE System SHALL provide the project URL for API connections
2. THE System SHALL provide a publishable key for client-side authentication
3. WHEN credentials are retrieved, THE System SHALL store them in environment variables
4. THE System SHALL use NEXT_PUBLIC prefix for client-accessible variables
5. THE System SHALL keep service role keys separate and secure (not in frontend)

### Requirement 8: Type Safety

**User Story:** As a developer, I want TypeScript types generated from the database schema, so that I have type-safe database queries.

#### Acceptance Criteria

1. WHEN the database schema changes, THE System SHALL generate updated TypeScript types
2. THE Generated_Types SHALL include all table definitions with correct field types
3. THE Generated_Types SHALL include relationship types for foreign keys
4. THE System SHALL export types for profiles, wallets, and transactions tables
5. THE Generated_Types SHALL match the actual database schema exactly
