// Dummy env vars so module-level initialization in lambda handlers doesn't throw.
// Tests use createHandler() with their own mocks and never touch these values.
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
process.env.TABLE_NAME = "test-products";
process.env.PRODUCTS_TABLE = "test-products";
process.env.CHECKOUTS_TABLE = "test-checkouts";
process.env.ORDERS_TABLE = "test-orders";
process.env.SITE_URL = "https://test.example.com";
process.env.OWNER_EMAIL = "owner@test.example.com";
process.env.FROM_EMAIL = "from@test.example.com";
process.env.INQUIRIES_TABLE = "test-inquiries";
process.env.RESEND_API_KEY = "re_test_dummy";
