const { test, expect } = require('@playwright/test');

const TEST_EMAIL = `e2e-${Date.now()}@manifoldgen.local`;
const TEST_PASSWORD = 'manifold-test-123';
const FIXED_EMAIL = 'account-flow@manifoldgen.local';
const FIXED_PASSWORD = 'manifold-test-123';

async function installStripeMock(page) {
  await page.route('https://js.stripe.com/v3/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.Stripe = function () {
          return {
            initEmbeddedCheckout: async function () {
              return {
                mount: function (target) {
                  const root = typeof target === 'string' ? document.querySelector(target) : target;
                  const checkout = document.createElement('div');
                  checkout.setAttribute('data-testid', 'mock-stripe-checkout');
                  checkout.textContent = 'Mock Stripe Embedded Checkout';
                  checkout.style.cssText = 'padding:24px;border:1px solid #cbd5e1;border-radius:8px;font-weight:700;';
                  const frame = document.createElement('iframe');
                  frame.src = 'https://checkout.stripe.com/mock-session';
                  frame.title = 'Mock Stripe Checkout Frame';
                  frame.style.cssText = 'width:100%;height:120px;border:0;margin-top:12px;';
                  root.appendChild(checkout);
                  root.appendChild(frame);
                },
                destroy: function () {
                  document.querySelectorAll('[data-testid="mock-stripe-checkout"], iframe[title="Mock Stripe Checkout Frame"]').forEach(el => el.remove());
                }
              };
            }
          };
        };
      `,
    });
  });
}

async function installAccountAPIMocks(page) {
  let user = null;
  let password = FIXED_PASSWORD;

  await installStripeMock(page);

  await page.route('**/api/auth/email-login', async (route) => {
    const req = route.request().postDataJSON();
    if (!req.email || !req.email.includes('@') || !req.password || req.password.length < 8) {
      await route.fulfill({ status: 400, json: { error: 'valid email and password required' } });
      return;
    }
    if (user && req.email === user.email && req.password !== password) {
      await route.fulfill({ status: 401, json: { error: 'invalid email or password' } });
      return;
    }
    const created = !user;
    if (!user) {
      user = {
        id: 'user_account_flow',
        wallet_address: 'email:accountflow000000000000000000000000000000',
        email: req.email,
        api_key: 'mg_account_flow_test_key',
        credits: 0,
      };
      password = req.password;
    }
    await route.fulfill({
      status: 200,
      json: {
        user,
        api_key: user.api_key,
        created,
        cute_price_usd: 0.01,
        credits_usd: 0,
      },
    });
  });

  await page.route('**/api/auth/session', async (route) => {
    if (!user) {
      await route.fulfill({ status: 401, json: { error: 'invalid API key' } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        user,
        api_key: user.api_key,
        has_password: true,
        cute_price_usd: 0.01,
        credits_usd: 0,
      },
    });
  });

  await page.route('**/api/auth/forgot-password', async (route) => {
    const req = route.request().postDataJSON() || {};
    if (!req.email || !String(req.email).includes('@')) {
      await route.fulfill({ status: 400, json: { error: 'valid email required' } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: { success: true, reset_token: 'test_reset_token_account_flow' },
    });
  });

  await page.route('**/api/auth/reset-password', async (route) => {
    const req = route.request().postDataJSON() || {};
    if (!req.token || !req.password || String(req.password).length < 8) {
      await route.fulfill({ status: 400, json: { error: 'invalid or expired reset token' } });
      return;
    }
    password = req.password;
    if (!user) {
      user = {
        id: 'user_account_flow',
        wallet_address: 'email:accountflow000000000000000000000000000000',
        email: FIXED_EMAIL,
        api_key: 'mg_account_flow_test_key',
        credits: 0,
      };
    }
    await route.fulfill({
      status: 200,
      json: {
        success: true,
        user,
        api_key: user.api_key,
        cute_price_usd: 0.01,
        credits_usd: 0,
      },
    });
  });

  // Old path must not be used by the app (404 in prod without alias).
  await page.route('**/api/session', async (route) => {
    await route.fulfill({ status: 404, json: { error: 'use /api/auth/session' } });
  });

  await page.route('**/api/stripe-checkout', async (route) => {
    const auth = route.request().headers().authorization || '';
    if (!auth.startsWith('Bearer ')) {
      await route.fulfill({
        status: 400,
        json: { error: 'authorization required: use Authorization Bearer API key or wallet_address' },
      });
      return;
    }
    if (!user?.email) {
      await route.fulfill({ status: 400, json: { error: 'email required before stripe checkout' } });
      return;
    }
    const req = route.request().postDataJSON() || {};
    await route.fulfill({
      status: 200,
      json: {
        success: true,
        session_id: 'cs_test_account_flow',
        customer_id: 'cus_test_account_flow',
        client_secret: 'cs_test_account_flow_secret',
        publishable_key: 'pk_test_account_flow',
        ui_mode: 'embedded_page',
        type: req.type || 'credits',
        plan: req.plan || '',
        amount_usd: req.amount_usd || 25,
      },
    });
  });

  await page.route('**/api/stripe/portal', async (route) => {
    const auth = route.request().headers().authorization || '';
    if (!auth.startsWith('Bearer ')) {
      await route.fulfill({ status: 401, json: { error: 'api key required' } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: { url: 'https://billing.stripe.com/mock-manifoldgen-portal', customer_id: 'cus_test_account_flow' },
    });
  });
}

test('account signup, logout, login, and embedded Stripe checkout', async ({ page }) => {
  await installAccountAPIMocks(page);

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();

  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-password').fill(FIXED_PASSWORD);
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

  await page.getByTestId('account-sign-out').click();
  await expect(page.getByTestId('account-auth-form')).toBeVisible();

  await page.getByTestId('account-auth-signin-tab').click();
  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-password').fill(FIXED_PASSWORD);
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);

  await page.getByTestId('account-buy-credits').click();
  const checkout = page.getByTestId('embedded-checkout-container');
  await expect(checkout).toBeVisible();
  await expect(checkout.getByText('Checkout', { exact: true })).toBeVisible();
  await expect(checkout.getByText('Credits: $50')).toBeVisible();
  await expect(page.getByTestId('mock-stripe-checkout')).toBeVisible();
  await expect(page.locator('iframe[title="Mock Stripe Checkout Frame"]')).toHaveCount(1);
});

test('account opens the Stripe billing portal', async ({ page }) => {
  await installAccountAPIMocks(page);
  await page.route('https://billing.stripe.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Stripe billing portal</title>' });
  });

  await page.goto('/account');
  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-password').fill(FIXED_PASSWORD);
  await page.getByTestId('account-auth-submit').click();

  await page.getByTestId('account-manage-billing').click();
  await expect(page).toHaveURL('https://billing.stripe.com/mock-manifoldgen-portal');
  await expect(page).toHaveTitle('Stripe billing portal');
});

test('homepage signup then account monthly embedded checkout', async ({ page }) => {
  await installAccountAPIMocks(page);

  await page.goto('/');
  await page.getByTestId('home-sign-up').click();
  await page.getByTestId('home-auth-email').fill(FIXED_EMAIL);
  await page.getByTestId('home-auth-password').fill(FIXED_PASSWORD);
  await page.getByTestId('home-auth-submit').click();
  await expect(page.getByRole('button', { name: /Creator · \$14\.99\/month/i })).toBeVisible();
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('mg_user');
    return raw ? JSON.parse(raw) : null;
  });
  expect(stored?.api_key).toBeTruthy();
  expect(stored?.email).toBe(FIXED_EMAIL);
  await page.getByRole('button', { name: /Creator · \$14\.99\/month/i }).click();
  await expect(page.getByText('Checkout', { exact: true })).toBeVisible();
  await expect(page.getByTestId('mock-stripe-checkout')).toBeVisible();

  await page.goto('/account');
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);
  await page.getByTestId('account-buy-monthly').click();
  await expect(page.getByTestId('embedded-checkout-container')).toBeVisible();
  await expect(page.getByText('Plan: creator monthly')).toBeVisible();
  await expect(page.getByTestId('mock-stripe-checkout')).toBeVisible();
});

test('account stays signed in from localStorage even if session refresh fails', async ({ page }) => {
  await installAccountAPIMocks(page);

  await page.goto('/account');
  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-password').fill(FIXED_PASSWORD);
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);

  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ status: 404, json: { error: 'not found' } });
  });

  await page.reload();
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);
  const key = await page.evaluate(() => localStorage.getItem('mg_api_key'));
  expect(key).toBeTruthy();
});

test('account page soft-refreshes credits after reload without signing out', async ({ page }) => {
  await installAccountAPIMocks(page);

  await page.goto('/account');
  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-password').fill(FIXED_PASSWORD);
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);

  const sessionReq = page.waitForRequest(
    (req) => req.method() === 'GET' && new URL(req.url()).pathname === '/api/auth/session',
  );
  await page.reload();
  await sessionReq;
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);
});

test('account forgot + reset password flow signs user in', async ({ page }) => {
  await installAccountAPIMocks(page);

  await page.goto('/account');
  await page.getByTestId('account-auth-signin-tab').click();
  await page.getByTestId('account-forgot-password').click();
  await expect(page.getByTestId('account-auth-mode-label')).toHaveText('Forgot password');
  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-auth-mode-label')).toHaveText('Set a new password');
  await page.getByTestId('account-password').fill('new-manifold-456');
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-signed-in-email')).toHaveText(FIXED_EMAIL);
});

test('account reset_token query opens reset form', async ({ page }) => {
  await installAccountAPIMocks(page);
  await page.goto('/account?reset_token=from_email_link_token');
  await expect(page.getByTestId('account-auth-mode-label')).toHaveText('Set a new password');
  await page.getByTestId('account-password').fill('reset-from-link-99');
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-signed-in-email')).toBeVisible();
});

test('account topup presets default to $50 and show API copy', async ({ page }) => {
  await installAccountAPIMocks(page);
  await page.goto('/account');
  await page.getByTestId('account-email').fill(FIXED_EMAIL);
  await page.getByTestId('account-password').fill(FIXED_PASSWORD);
  await page.getByTestId('account-auth-submit').click();
  await expect(page.getByTestId('account-buy-credits')).toContainText('Add $50');
  await page.getByTestId('account-topup-100').click();
  await expect(page.getByTestId('account-buy-credits')).toContainText('Add $100');
  await expect(page.getByTestId('account-api-snippet')).toContainText('service":"zimage"');
  await expect(page.getByTestId('account-api-key')).toBeVisible();
});

test.describe('live API', () => {
  test.skip(!process.env.MANIFOLDGEN_E2E_LIVE, 'set MANIFOLDGEN_E2E_LIVE=1 to run against the configured API');

  test('live API resolves MANIFOLD_API_KEY and creates a Stripe portal URL', async ({ request }) => {
    const apiKey = process.env.MANIFOLD_API_KEY;
    test.skip(!apiKey, 'MANIFOLD_API_KEY is required');
    const apiOrigin = process.env.MANIFOLDGEN_E2E_API_ORIGIN || process.env.MANIFOLDGEN_API_ORIGIN || 'https://manifoldgen.com';
    const headers = { Authorization: `Bearer ${apiKey}` };

    const session = await request.get(`${apiOrigin}/api/auth/session`, { headers });
    expect(session.ok()).toBeTruthy();
    expect((await session.json()).api_key).toBe(apiKey);

    const portal = await request.post(`${apiOrigin}/api/stripe/portal`, { headers });
    expect(portal.ok()).toBeTruthy();
    const data = await portal.json();
    expect(data.customer_id).toMatch(/^cus_/);
    expect(data.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
  });

  test('live signup/login and Stripe checkout session mounts', async ({ page }) => {
    await installStripeMock(page);
    const email = TEST_EMAIL;
    const password = TEST_PASSWORD;

    await page.goto('/account');
    await page.getByTestId('account-email').fill(email);
    await page.getByTestId('account-password').fill(password);
    await page.getByTestId('account-auth-submit').click();
    await expect(page.getByTestId('account-signed-in-email')).toHaveText(email);

    await page.getByTestId('account-sign-out').click();
    await page.getByTestId('account-auth-signin-tab').click();
    await page.getByTestId('account-email').fill(email);
    await page.getByTestId('account-password').fill(password);
    await page.getByTestId('account-auth-submit').click();
    await expect(page.getByTestId('account-signed-in-email')).toHaveText(email);

    await page.getByTestId('account-buy-credits').click();
    await expect(page.getByTestId('embedded-checkout-container')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mock-stripe-checkout')).toBeVisible();
  });
});
