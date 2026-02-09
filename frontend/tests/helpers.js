/**
 * Mock data and route helpers for Playwright tests.
 *
 * Strategy: intercept all network requests that leave the browser —
 *   /config.json          → static config
 *   cognito-idp.*         → fake auth tokens
 *   cognito-identity.*    → fake identity + credentials
 *   lambda.*              → fake Lambda invoke responses
 */

export const CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_testPool',
  clientId: 'testClientId',
  identityPoolId: 'us-east-1:test-identity-pool',
  movieqListFunctionName: 'movie-finder-dev-movieq-list',
  movieqWriteFunctionName: 'movie-finder-dev-movieq-write',
};

export const MOVIES = [
  { movie_id: 'id-1', title: 'The Matrix', year: 1999, genre: 'Sci-Fi', rating: 8.7, director: 'Wachowskis', status: 'active', rank: 'a00' },
  { movie_id: 'id-2', title: 'Inception', year: 2010, genre: 'Sci-Fi', rating: 8.8, director: 'Christopher Nolan', status: 'active', rank: 'a01' },
  { movie_id: 'id-3', title: 'Interstellar', year: 2014, genre: 'Sci-Fi', rating: 8.6, director: 'Christopher Nolan', status: 'active', rank: 'a02' },
  { movie_id: 'id-4', title: 'The Godfather', year: 1972, genre: 'Crime', rating: 9.2, director: 'Francis Ford Coppola', status: 'recentlyWatched', rank: 'a00' },
  { movie_id: 'id-5', title: 'Pulp Fiction', year: 1994, genre: 'Crime', rating: 8.9, director: 'Quentin Tarantino', status: 'notInterested', rank: 'a00' },
];

/**
 * Set up all route mocks on a Playwright page.
 * Returns a handle to track Lambda write calls.
 */
export async function setupMocks(page) {
  const writeCalls = [];

  // Mock /config.json
  await page.route('**/config.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONFIG) })
  );

  // Mock Cognito auth calls (InitiateAuth, GetId, GetCredentialsForIdentity)
  await page.route('https://cognito-idp.us-east-1.amazonaws.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/x-amz-json-1.1',
      body: JSON.stringify({
        AuthenticationResult: {
          IdToken: 'fake-id-token',
          AccessToken: 'fake-access-token',
          RefreshToken: 'fake-refresh-token',
        },
      }),
    })
  );

  await page.route('https://cognito-identity.us-east-1.amazonaws.com/**', async (route) => {
    const body = route.request().postData() || '';
    if (body.includes('GetId')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-amz-json-1.1',
        body: JSON.stringify({ IdentityId: 'us-east-1:fake-identity-id' }),
      });
    }
    // GetCredentialsForIdentity
    return route.fulfill({
      status: 200,
      contentType: 'application/x-amz-json-1.1',
      body: JSON.stringify({
        IdentityId: 'us-east-1:fake-identity-id',
        Credentials: {
          AccessKeyId: 'FAKEKEYID',
          SecretKey: 'FAKESECRET',
          SessionToken: 'FAKETOKEN',
          Expiration: Date.now() / 1000 + 3600,
        },
      }),
    });
  });

  // Mock Lambda invoke
  await page.route('https://lambda.us-east-1.amazonaws.com/**', async (route) => {
    const url = route.request().url();

    // movieq-list
    if (url.includes('movieq-list')) {
      const response = { statusCode: 200, body: JSON.stringify({ movies: MOVIES }) };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }

    // movieq-write
    if (url.includes('movieq-write')) {
      const reqBody = route.request().postData();
      writeCalls.push(reqBody ? JSON.parse(reqBody) : null);
      const response = { statusCode: 200, body: JSON.stringify({ success: true }) };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }

    return route.fulfill({ status: 200, body: '{}' });
  });

  return { writeCalls };
}

/**
 * Log in via the UI — fills username/password and clicks Sign in.
 */
export async function loginViaUI(page) {
  await page.fill('input[placeholder="Username"]', 'testuser');
  await page.fill('input[placeholder="Password"]', 'TestPass123!');
  await page.click('button:has-text("Sign in")');
  // Wait for movie list to appear
  await page.waitForSelector('text=The Matrix', { timeout: 10000 });
}
