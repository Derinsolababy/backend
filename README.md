# StellarPOS Backend API

Robust, scalable backend API server for StellarPOS with comprehensive Stellar blockchain integration, business logic, and data management.

## Overview

StellarPOS Backend provides a comprehensive API ecosystem for point-of-sale operations, featuring Stellar blockchain integration, real-time payment processing, inventory management, and business analytics.

## Features

### Authentication & Authorization
- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control**: Admin, manager, cashier roles
- **Multi-tenant Support**: Organization-based data isolation
- **Session Management**: Secure session handling
- **API Key Management**: Third-party integrations

### Payment Processing
- **Stellar Integration**: Native XLM and asset support
- **Payment Verification**: Blockchain transaction validation
- **Multi-Currency**: Support for various Stellar assets
- **Real-time Processing**: Instant payment confirmation
- **Refund Management**: Automated refund processing

### Business Management
- **Inventory System**: Product catalog and stock management
- **Transaction Handling**: Complete sales cycle management
- **Customer Management**: Customer profiles and history
- **Analytics Engine**: Real-time business insights
- **Reporting System**: Comprehensive business reports

### Real-time Features
- **WebSocket Support**: Live updates and notifications
- **Payment Streaming**: Real-time payment status
- **Inventory Alerts**: Stock level notifications
- **Transaction Monitoring**: Live transaction feed

### Security & Compliance
- **Data Encryption**: End-to-end encryption
- **Audit Logging**: Complete action audit trail
- **Rate Limiting**: API abuse protection
- **Input Validation**: Comprehensive data validation
- **CORS Configuration**: Secure cross-origin requests

## Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with async/await
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session and data caching
- **Queue**: Bull Queue for background jobs
- **Blockchain**: Stellar SDK for payments
- **Authentication**: JWT with bcrypt
- **Validation**: Joi for input validation
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest with Supertest
- **Monitoring**: Winston logger + metrics
- **Process Management**: PM2 for production

## Project Structure

```
src/
├── controllers/         # Route handlers and business logic
│   ├── auth.controller.ts
│   ├── products.controller.ts
│   ├── transactions.controller.ts
│   ├── customers.controller.ts
│   ├── payments.controller.ts
│   └── analytics.controller.ts
├── services/           # Business logic services
│   ├── auth.service.ts
│   ├── stellar.service.ts
│   ├── payment.service.ts
│   ├── inventory.service.ts
│   ├── notification.service.ts
│   └── analytics.service.ts
├── models/             # Database models and schemas
│   ├── user.model.ts
│   ├── product.model.ts
│   ├── transaction.model.ts
│   ├── customer.model.ts
│   └── organization.model.ts
├── middleware/         # Express middleware
│   ├── auth.middleware.ts
│   ├── validation.middleware.ts
│   ├── rateLimit.middleware.ts
│   ├── cors.middleware.ts
│   └── error.middleware.ts
├── routes/             # API route definitions
│   ├── auth.routes.ts
│   ├── products.routes.ts
│   ├── transactions.routes.ts
│   ├── customers.routes.ts
│   ├── payments.routes.ts
│   └── analytics.routes.ts
├── utils/              # Utility functions
│   ├── database.ts
│   ├── redis.ts
│   ├── queue.ts
│   ├── logger.ts
│   ├── validators.ts
│   └── helpers.ts
├── types/              # TypeScript type definitions
├── config/             # Configuration files
├── tests/              # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── docs/               # API documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Redis 6+
- Git for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/StellarPOS-App/backend.git
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev

# Server runs on http://localhost:3000
```

### Environment Setup

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/stellarpos_db
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=your-stellar-secret-key
STELLAR_PUBLIC_KEY=your-stellar-public-key

# Application Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# External Services
SENDGRID_API_KEY=your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

## 📡 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/profile` - Get user profile

### Products & Inventory
- `GET /api/v1/products` - List products
- `POST /api/v1/products` - Create product
- `GET /api/v1/products/:id` - Get product
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Transactions
- `GET /api/v1/transactions` - List transactions
- `POST /api/v1/transactions` - Create transaction
- `GET /api/v1/transactions/:id` - Get transaction
- `PUT /api/v1/transactions/:id/refund` - Process refund

### Payments
- `POST /api/v1/payments/stellar` - Process Stellar payment
- `GET /api/v1/payments/:id/status` - Check payment status
- `POST /api/v1/payments/:id/verify` - Verify payment

### Customers
- `GET /api/v1/customers` - List customers
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers/:id` - Get customer
- `PUT /api/v1/customers/:id` - Update customer

### Analytics
- `GET /api/v1/analytics/dashboard` - Dashboard metrics
- `GET /api/v1/analytics/sales` - Sales analytics
- `GET /api/v1/analytics/products` - Product analytics
- `GET /api/v1/analytics/customers` - Customer analytics

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- auth.test.ts
```

## 🏗️ Build & Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# Run with PM2
npm run pm2:start

# Database migrations
npm run db:migrate:prod

# Health check
curl http://localhost:3000/health
```

## 📊 Database Schema

### Core Tables
- **users** - User accounts and authentication
- **organizations** - Multi-tenant organization data
- **products** - Product catalog and inventory
- **categories** - Product categorization
- **transactions** - Sales transactions
- **transaction_items** - Individual transaction items
- **customers** - Customer profiles and data
- **payments** - Payment processing records
- **stellar_accounts** - Stellar account management

### Relationships
- Users belong to Organizations
- Products belong to Categories
- Transactions have many Transaction Items
- Payments belong to Transactions
- Customers have many Transactions

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token-based authentication
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CORS**: Configurable cross-origin requests
- **Helmet**: Security headers middleware

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Database Schema](./docs/database.md)
- [Stellar Integration](./docs/stellar.md)
- [Authentication Guide](./docs/auth.md)
- [Deployment Guide](./docs/deployment.md)
- [Testing Guide](./docs/testing.md)

## 🤝 Contributing

We welcome contributions from developers around the world! 🌍

### Quick Start
1. **⭐ Star** this repository if you find it helpful
2. **🍴 Fork** the repository to your GitHub account  
3. **📥 Clone** your fork locally
4. **🌿 Create** a feature branch (`git checkout -b feature/amazing-feature`)
5. **✨ Make** your changes and add tests
6. **✅ Commit** your changes (`git commit -m 'Add some amazing feature'`)
7. **📤 Push** to your branch (`git push origin feature/amazing-feature`)
8. **🔄 Open** a Pull Request

### 👥 Our Contributors
We have an amazing community of **10+ active contributors**! See our [Contributors Guide](./CONTRIBUTORS.md) for the full list.

### 🎯 Ways to Contribute
- 🐛 **Report bugs** and performance issues
- 💡 **Suggest API improvements** and new endpoints
- 📝 **Improve documentation** and API specs
- 🧪 **Write tests** and improve coverage
- 🔒 **Enhance security** features
- ⚡ **Optimize performance** and scalability
- 🗄️ **Improve database** efficiency
- 🔧 **Add developer tools** and utilities

### 📋 Good First Issues
New to backend development? Check out our [Good First Issues](https://github.com/StellarPOS-App/stellarPOS-backend/labels/good%20first%20issue)!

**Detailed Contributing Guide**: [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Frontend Repository](https://github.com/StellarPOS-App/surface)
- [Smart Contracts](https://github.com/StellarPOS-App/contracts)
- [API Documentation](https://api.stellarpos.app/docs)
- [Live API](https://api.stellarpos.app)

---

Built with ❤️ for the Stellar ecosystem

## Fix for Issue #193: Test coverage below 40 percent for payment module

Increase test coverage for the payment processing module to at least 80 percent by adding unit and integration tests. The current low coverage leaves critical paths untested.

<!-- fix: issue #193 - [TEST-009] Test coverage below 40% for payment processing module -->